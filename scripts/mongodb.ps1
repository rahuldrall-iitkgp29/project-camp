[CmdletBinding()]
param([ValidateSet('Install', 'Start', 'Status', 'Stop', 'Smoke')][string]$Action = 'Status')

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$version = '8.0.34'
$archiveName = "mongodb-windows-x86_64-$version.zip"
$expectedHash = '6b021a0864494e4decf278b36477a29eb36072432773e4e62c2f42c302630db0'
$toolsDirectory = Join-Path $projectRoot 'tools/mongodb'
$executable = Join-Path $toolsDirectory "mongodb-win32-x86_64-windows-$version/bin/mongod.exe"
$dataDirectory = Join-Path $projectRoot '.local/mongodb-data'
$logDirectory = Join-Path $projectRoot '.local/mongodb-logs'
$runtimeDirectory = Join-Path $projectRoot '.local/mongodb-runtime'
$configPath = Join-Path $runtimeDirectory 'mongod.cfg'
$statePath = Join-Path $runtimeDirectory 'instance.json'
$helper = Join-Path $PSScriptRoot 'mongodb-admin.js'

function Invoke-Admin([string]$Operation) {
    & node $helper $Operation
    if ($LASTEXITCODE -ne 0) { throw "MongoDB $Operation failed. Inspect $logDirectory\mongod.log; no data was deleted." }
}

function Get-OwnedProcess {
    if (!(Test-Path -LiteralPath $statePath)) { return $null }
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $instance = Get-Process -Id $state.pid -ErrorAction SilentlyContinue
    if (!$instance) { return $null }
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $($state.pid)"
    if ($instance.Path -ne $executable -or $state.executable -ne $executable -or
        $instance.StartTime.ToUniversalTime().Ticks.ToString() -ne $state.startTimeTicks -or
        $processInfo.CommandLine -notlike "*--config `"$configPath`"*") {
        throw 'Instance ownership cannot be verified. Refusing to manage this PID.'
    }
    return $instance
}

New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
# Serialize management commands; this file is not the integration-test lock.
try { $managementLock = [IO.File]::Open((Join-Path $runtimeDirectory 'management.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
catch { throw 'Another MongoDB management command is running. Try again after it finishes.' }
try {
    if ($Action -eq 'Install') {
        if (!(Get-CimInstance Win32_OperatingSystem).OSArchitecture.Contains('64') -or
            (Get-CimInstance Win32_Processor | Select-Object -First 1).Architecture -ne 9) {
            throw 'This pinned official ZIP requires Windows x86_64.'
        }
        $os = Get-CimInstance Win32_OperatingSystem
        if ($os.Caption -notmatch 'Windows 11|Windows Server 2022') { throw 'Verify MongoDB 8.0 platform support for this Windows version before installing.' }
        foreach ($dll in @('vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll')) {
            if (!(Test-Path -LiteralPath (Join-Path $env:SystemRoot "System32/$dll"))) {
                throw "Missing Microsoft Visual C++ x64 runtime dependency: $dll. No system prerequisite will be installed."
            }
        }
        if (Test-Path -LiteralPath $executable) {
            Write-Output "Existing project installation retained: $executable"
            & $executable --version
            if ($LASTEXITCODE -ne 0) { throw 'Existing mongod.exe could not execute; inspect runtime dependencies.' }
            return
        }
        $destination = Split-Path -Parent (Split-Path -Parent $executable)
        if (Test-Path -LiteralPath $destination) { throw 'Partial installation exists; inspect it before retrying. Nothing was overwritten.' }
        New-Item -ItemType Directory -Path $toolsDirectory -Force | Out-Null
        $archive = Join-Path $toolsDirectory $archiveName
        $ProgressPreference = 'SilentlyContinue'
        $url = "https://fastdl.mongodb.org/windows/$archiveName"
        $checksumPath = "$archive.sha256"
        Invoke-WebRequest -UseBasicParsing -Uri "$url.sha256" -OutFile $checksumPath -TimeoutSec 60
        $publishedHash = ((Get-Content -LiteralPath $checksumPath -Raw) -split '\s+')[0]
        if ($publishedHash -ne $expectedHash) { throw 'Official checksum differs from pinned release metadata. Installation stopped.' }
        if (!(Test-Path -LiteralPath $archive)) { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $archive -TimeoutSec 600 }
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Archive checksum mismatch. Do not run or extract it.' }
        Expand-Archive -LiteralPath $archive -DestinationPath $toolsDirectory
        if (!(Test-Path -LiteralPath $executable)) { throw 'Official archive layout differs from the expected executable path.' }
        Write-Output "Verified and extracted MongoDB $version to $toolsDirectory"
        return
    }

    $instance = Get-OwnedProcess
    if ($Action -eq 'Start') {
        if ($instance) { Invoke-Admin 'init'; Write-Output 'Project MongoDB was already running.'; return }
        $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -eq 27018)
        if ($listeners.Count) { throw 'Port 27018 is occupied. Refusing to start or stop an unowned process.' }
        if (!(Test-Path -LiteralPath $executable)) { throw 'Project-local mongod.exe is absent. Run mongodb.ps1 Install first.' }
        New-Item -ItemType Directory -Path $dataDirectory, $logDirectory -Force | Out-Null
        $config = @{
            storage = @{ dbPath = $dataDirectory; wiredTiger = @{ engineConfig = @{ cacheSizeGB = 0.25 } } }
            systemLog = @{ destination = 'file'; path = (Join-Path $logDirectory 'mongod.log'); logAppend = $true }
            net = @{ bindIp = '127.0.0.1'; port = 27018 }
            replication = @{ replSetName = 'rs0' }
        } | ConvertTo-Json -Depth 6
        [IO.File]::WriteAllText($configPath, $config, [Text.UTF8Encoding]::new($false))
        $instance = Start-Process -FilePath $executable -ArgumentList @('--config', "`"$configPath`"") -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'stdout.log') -RedirectStandardError (Join-Path $logDirectory 'stderr.log')
        $state = @{ pid = $instance.Id; executable = $executable; startTimeTicks = $instance.StartTime.ToUniversalTime().Ticks.ToString() } | ConvertTo-Json
        [IO.File]::WriteAllText($statePath, $state, [Text.UTF8Encoding]::new($false))
        $deadline = (Get-Date).AddSeconds(30)
        do {
            $instance.Refresh()
            if ($instance.HasExited) { throw "mongod.exe exited with code $($instance.ExitCode). Inspect $logDirectory\mongod.log and stderr.log. A missing runtime often returns -1073741515 (0xC0000135)." }
            $listener = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq 27018 -and $_.OwningProcess -eq $instance.Id })
            if ($listener.Count) { break }
            if ((Get-Date) -gt $deadline) { throw "MongoDB startup timed out. PID $($instance.Id) retained for inspection; use Status/Stop." }
            Start-Sleep -Milliseconds 300
        } while ($true)
        Invoke-Admin 'init'
    } elseif ($Action -eq 'Stop') {
        if (!$instance) { Write-Output 'Project MongoDB is already stopped; data retained.'; return }
        Invoke-Admin 'stop'
        if (!$instance.WaitForExit(30000)) { throw 'Shutdown did not finish within 30 seconds. No process was force-killed; inspect logs.' }
        Write-Output 'Project MongoDB stopped; database files retained.'
    } else {
        if (!$instance) { throw 'Project MongoDB is not running. Run mongodb.ps1 Start.' }
        Invoke-Admin $Action.ToLowerInvariant()
        Write-Output "Executable: $($instance.Path)"
        $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object OwningProcess -eq $instance.Id)
        if ($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1' -or $listeners[0].LocalPort -ne 27018) {
            throw 'Unexpected MongoDB listening sockets; inspect the running process.'
        }
        $listeners | Select-Object LocalAddress, LocalPort, OwningProcess
    }
} finally { $managementLock.Dispose() }
