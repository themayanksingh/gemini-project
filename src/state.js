/**
 * State module - Shared application state
 */

// Application state
let state = {
    projects: [],
    chatMappings: {},
    lastClickedChatInfo: null,
    containerInjected: false,
};

// State getters
export const getProjects = () => state.projects;
export const getChatMappings = () => state.chatMappings;
export const getLastClickedChat = () => state.lastClickedChatInfo;
export const isContainerInjected = () => state.containerInjected;

// State setters
export const setProjects = (projects) => {
    state.projects = projects;
};

export const setChatMappings = (mappings) => {
    state.chatMappings = mappings;
};

export const setLastClickedChat = (chatInfo) => {
    state.lastClickedChatInfo = chatInfo;
};

export const setContainerInjected = (value) => {
    state.containerInjected = value;
};

// Utility
export const generateId = () =>
    `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
