import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ListTodo,
} from "lucide-react";
import { tasksApi } from "../../api/tasks.api.js";
import { TaskCard } from "./TaskCard.jsx";
import { TaskModal } from "./TaskModal.jsx";
import { useToast } from "../../context/ToastContext.jsx";

export const TaskBoard = ({ projectId, members = [], userRole = "member" }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [targetColumnStatus, setTargetColumnStatus] = useState("todo");

  const { addToast } = useToast();
  const canCreateTask = userRole === "admin" || userRole === "project_admin";

  const loadTasks = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await tasksApi.getTasks(projectId);
      setTasks(res?.data || []);
    } catch (err) {
      addToast(err.message || "Failed to load tasks", "error");
    } finally {
      setLoading(false);
    }
  }, [projectId, addToast]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleOpenCreate = (status = "todo") => {
    setSelectedTaskId(null);
    setTargetColumnStatus(status);
    setIsTaskModalOpen(true);
  };

  const handleOpenEdit = (taskId) => {
    setSelectedTaskId(taskId);
    setIsTaskModalOpen(true);
  };

  // Filter tasks by search query
  const filteredTasks = tasks.filter((t) => {
    const q = searchQuery.toLowerCase();
    const titleMatch = t.title?.toLowerCase().includes(q);
    const assigneeMatch = t.assignedTo?.username?.toLowerCase().includes(q);
    return titleMatch || assigneeMatch;
  });

  const columns = [
    {
      id: "todo",
      title: "To Do",
      icon: <ListTodo size={16} color="var(--info)" />,
      badgeClass: "badge-todo",
      tasks: filteredTasks.filter((t) => t.status === "todo"),
    },
    {
      id: "in_progress",
      title: "In Progress",
      icon: <Clock size={16} color="var(--warning)" />,
      badgeClass: "badge-in_progress",
      tasks: filteredTasks.filter((t) => t.status === "in_progress"),
    },
    {
      id: "done",
      title: "Done",
      icon: <CheckCircle2 size={16} color="var(--success)" />,
      badgeClass: "badge-done",
      tasks: filteredTasks.filter((t) => t.status === "done"),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Search and Action Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div
          style={{
            position: "relative",
            minWidth: "260px",
            maxWidth: "360px",
            flex: 1,
          }}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter tasks by title or assignee..."
            style={{ paddingLeft: "36px", fontSize: "0.85rem" }}
          />
          <Search
            size={16}
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
        </div>

        {canCreateTask && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleOpenCreate("todo")}
          >
            <Plus size={16} />
            <span>New Task</span>
          </button>
        )}
      </div>

      {/* Kanban Board Columns */}
      {loading ? (
        <div
          style={{
            padding: "60px",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          Loading task board...
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
            gap: "20px",
            alignItems: "start",
          }}
        >
          {columns.map((col) => (
            <div
              key={col.id}
              style={{
                backgroundColor: "rgba(16, 21, 34, 0.4)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                minHeight: "450px",
              }}
            >
              {/* Column Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                  paddingBottom: "10px",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  {col.icon}
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      color: "var(--text-primary)",
                    }}
                  >
                    {col.title}
                  </span>
                  <span
                    className={`badge ${col.badgeClass}`}
                    style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                  >
                    {col.tasks.length}
                  </span>
                </div>

                {canCreateTask && (
                  <button
                    type="button"
                    onClick={() => handleOpenCreate(col.id)}
                    style={{
                      padding: "4px",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                    title={`Add task to ${col.title}`}
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>

              {/* Column Task Cards */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  flex: 1,
                }}
              >
                {col.tasks.map((task) => (
                  <TaskCard
                    key={task._id}
                    task={task}
                    onClick={() => handleOpenEdit(task._id)}
                  />
                ))}

                {col.tasks.length === 0 && (
                  <div
                    style={{
                      border: "1px dashed var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                      padding: "30px 16px",
                      textAlign: "center",
                      color: "var(--text-disabled)",
                      fontSize: "0.82rem",
                    }}
                  >
                    No tasks in {col.title.toLowerCase()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        projectId={projectId}
        taskId={selectedTaskId}
        initialStatus={targetColumnStatus}
        members={members}
        userRole={userRole}
        onTaskUpdated={loadTasks}
      />
    </div>
  );
};
