import React, { createContext, useContext, useState, useCallback } from "react";
import { projectsApi } from "../api/projects.api.js";
import { useToast } from "./ToastContext.jsx";
import { useAuth } from "./AuthContext.jsx";

const ProjectContext = createContext(null);

export const ProjectProvider = ({ children }) => {
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const { addToast } = useToast();
  const { user } = useAuth();

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await projectsApi.getProjects();
      const list = res?.data || [];
      setProjects(list);
      return list;
    } catch (error) {
      // Don't show toast if user is simply unverified (which returns 403)
      if (error?.status !== 403) {
        addToast(error.message || "Failed to load projects", "error");
      }
      return [];
    } finally {
      setLoadingProjects(false);
    }
  }, [addToast]);

  const refreshMembers = useCallback(
    async (projectId) => {
      if (!projectId) return [];
      setLoadingMembers(true);
      try {
        const res = await projectsApi.getMembers(projectId);
        const memberList = res?.data || [];
        setMembers(memberList);

        // Determine current user's role
        if (user?._id) {
          const myMembership = memberList.find((m) => m.user?._id === user._id);
          if (myMembership) {
            setCurrentRole(myMembership.role);
          }
        }
        return memberList;
      } catch (error) {
        console.error("Failed to load project members:", error);
        return [];
      } finally {
        setLoadingMembers(false);
      }
    },
    [user],
  );

  const selectProject = useCallback(
    async (projectId) => {
      if (!projectId) {
        setCurrentProject(null);
        setCurrentRole(null);
        setMembers([]);
        return null;
      }

      try {
        const res = await projectsApi.getProjectById(projectId);
        const proj = res?.data;
        setCurrentProject(proj);
        await refreshMembers(projectId);
        return proj;
      } catch (error) {
        addToast(error.message || "Could not load project", "error");
        return null;
      }
    },
    [addToast, refreshMembers],
  );

  const createProject = async ({ name, description }) => {
    const res = await projectsApi.createProject({ name, description });
    const newProj = res?.data;
    addToast("Project created successfully!", "success");
    await loadProjects();
    return newProj;
  };

  const updateProject = async (projectId, data) => {
    const res = await projectsApi.updateProject(projectId, data);
    const updated = res?.data;
    setCurrentProject(updated);
    addToast("Project updated successfully", "success");
    await loadProjects();
    return updated;
  };

  const deleteProject = async (projectId) => {
    await projectsApi.deleteProject(projectId);
    addToast("Project deleted successfully", "info");
    if (currentProject?._id === projectId) {
      setCurrentProject(null);
      setCurrentRole(null);
    }
    await loadProjects();
  };

  const value = {
    projects,
    loadingProjects,
    currentProject,
    currentRole,
    members,
    loadingMembers,
    loadProjects,
    selectProject,
    refreshMembers,
    createProject,
    updateProject,
    deleteProject,
  };

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
};
