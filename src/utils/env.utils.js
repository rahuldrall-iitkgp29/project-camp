import jwt from "jsonwebtoken";

export const validateEnvironment = (env = process.env) => {
  const required = ["MONGO_URI", "ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET", "ACCESS_TOKEN_EXPIRY", "REFRESH_TOKEN_EXPIRY",
    "SERVER_URL", "FORGOT_PASSWORD_REDIRECT_URL", "MAILTRAP_SMTP_HOST", "MAILTRAP_SMTP_PORT", "MAILTRAP_SMTP_USER", "MAILTRAP_SMTP_PASS"];
  const invalid = required.filter(name => typeof env[name] !== "string" || !env[name].trim());
  for (const name of ["SERVER_URL", "FORGOT_PASSWORD_REDIRECT_URL", "PROJECT_INVITATION_REDIRECT_URL"]) {
    if (!env[name] && name === "PROJECT_INVITATION_REDIRECT_URL") continue;
    try {
      const url = new URL(env[name]);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) invalid.push(name);
    } catch { invalid.push(name); }
  }
  if (!/^mongodb(?:\+srv)?:\/\//.test(env.MONGO_URI || "")) invalid.push("MONGO_URI");
  for (const name of ["PORT", "MAILTRAP_SMTP_PORT"]) {
    if (env[name] && (!/^\d+$/.test(env[name]) || Number(env[name]) < 1 || Number(env[name]) > 65535)) invalid.push(name);
  }
  for (const name of ["ACCESS_TOKEN_EXPIRY", "REFRESH_TOKEN_EXPIRY"]) {
    try {
      // jsonwebtoken treats numeric strings as milliseconds: reject ambiguous durations.
      if (!/^\d+(?:\.\d+)?\s*(?:ms|s|m|h|d|w|y)$/.test(env[name] || "")) throw new Error();
      const payload = jwt.decode(jwt.sign({}, "configuration-validation-only", { expiresIn: env[name] }));
      if (payload.exp <= payload.iat) invalid.push(name);
    } catch { invalid.push(name); }
  }
  if (env.ACCESS_TOKEN_SECRET === env.REFRESH_TOKEN_SECRET) invalid.push("ACCESS_TOKEN_SECRET/REFRESH_TOKEN_SECRET must differ");
  if (env.NODE_ENV === "production") {
    for (const name of ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"]) if ((env[name] || "").length < 32) invalid.push(name);
  }
  if (invalid.length) throw new Error(`Invalid or missing configuration: ${[...new Set(invalid)].join(", ")}`);
};
