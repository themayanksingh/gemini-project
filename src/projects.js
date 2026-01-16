/**
 * Projects module - Project CRUD operations
 */

import { saveProjects, saveChatMappings } from "./storage.js";
import { getProjects, setProjects, getChatMappings, setChatMappings, generateId } from "./state.js";
import { extractChatIdFromContainer } from "./chats.js";

export const addProject = (name, onComplete) => {
    const projects = getProjects();
    const project = {
        id: generateId(),
        name,
        order: projects.length,
        createdAt: Date.now(),
    };
    projects.push(project);
    setProjects(projects);
    saveProjects(projects);
    if (onComplete) onComplete();
};

export const renameProject = (projectId, newName, onComplete) => {
    const projects = getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (project) {
        project.name = newName;
        setProjects(projects);
        saveProjects(projects);
    }
    if (onComplete) onComplete();
};

export const deleteProject = (projectId, onComplete) => {
    let projects = getProjects();
    let chatMappings = getChatMappings();

    projects = projects.filter((p) => p.id !== projectId);

    // Remove all chat mappings for this project
    Object.keys(chatMappings).forEach((chatId) => {
        if (chatMappings[chatId]?.projectId === projectId) {
            delete chatMappings[chatId];
        }
    });

    setProjects(projects);
    setChatMappings(chatMappings);
    saveProjects(projects);
    saveChatMappings(chatMappings);

    if (onComplete) onComplete();
};

export const setProjectGem = (projectId, gemId, gemName, onComplete) => {
    const projects = getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (project) {
        project.gemName = gemName;
        setProjects(projects);
        saveProjects(projects);
    }
    if (onComplete) onComplete();
};

export const toggleProjectExpansion = (projectId, isExpanded, onComplete) => {
    const projects = getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (project) {
        project.isExpanded = isExpanded;
        setProjects(projects);
        saveProjects(projects);
    }
    if (onComplete) onComplete();
};

export const clearProjectGem = (projectId, onComplete) => {
    const projects = getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (project) {
        delete project.gemId;
        delete project.gemName;
        setProjects(projects);
        saveProjects(projects);
    }
    if (onComplete) onComplete();
};

export const getChatsForProject = (projectId) => {
    const chatMappings = getChatMappings();
    const result = [];

    // Get all chats for this project from storage
    Object.entries(chatMappings).forEach(([chatId, data]) => {
        if (data.projectId === projectId) {
            result.push({ id: chatId, title: data.title, addedAt: data.addedAt || 0 });
        }
    });

    // Build a map of chat IDs to native titles and order (for chats currently loaded)
    const nativeChats = new Map();
    const nativeOrder = [];
    document.querySelectorAll('.conversation-items-container').forEach(container => {
        const chatId = extractChatIdFromContainer(container);
        const titleEl = container.querySelector('.conversation-title');

        if (chatId) {
            const title = titleEl?.textContent?.trim() || "Untitled";
            nativeChats.set(chatId, title);
            nativeOrder.push(chatId);
        }
    });

    // Update titles from native sidebar if available (don't filter!)
    const updated = result.map(chat => {
        const nativeTitle = nativeChats.get(chat.id);
        return {
            ...chat,
            title: nativeTitle || chat.title,
            isLoaded: nativeChats.has(chat.id)
        };
    });

    // Sort: loaded chats by native order first, then unloaded by most recent
    updated.sort((a, b) => {
        // Both loaded - sort by native order
        if (a.isLoaded && b.isLoaded) {
            const aIndex = nativeOrder.indexOf(a.id);
            const bIndex = nativeOrder.indexOf(b.id);
            return aIndex - bIndex;
        }
        // Loaded comes before unloaded
        if (a.isLoaded && !b.isLoaded) return -1;
        if (!a.isLoaded && b.isLoaded) return 1;
        // Both unloaded - sort by newest first
        const aTime = a.addedAt || 0;
        const bTime = b.addedAt || 0;
        return bTime - aTime;
    });

    return updated;
};
