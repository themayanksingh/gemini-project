/**
 * Storage module - Chrome storage helpers
 * Includes error handling for extension context invalidation
 */

const STORAGE_KEYS = {
    PROJECTS: "gcm_projects",
    CHAT_MAPPINGS: "gcm_chat_mappings",
};

// Check if extension context is still valid
const isContextValid = () => {
    try {
        return chrome.runtime?.id !== undefined;
    } catch (e) {
        return false;
    }
};

export const loadData = () => {
    return new Promise((resolve) => {
        if (!isContextValid()) {
            resolve({ projects: [], chatMappings: {} });
            return;
        }

        try {
            chrome.storage.sync.get(
                [STORAGE_KEYS.PROJECTS, STORAGE_KEYS.CHAT_MAPPINGS],
                (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn("[GCM] Storage read error:", chrome.runtime.lastError);
                        resolve({ projects: [], chatMappings: {} });
                        return;
                    }
                    resolve({
                        projects: result[STORAGE_KEYS.PROJECTS] || [],
                        chatMappings: result[STORAGE_KEYS.CHAT_MAPPINGS] || {},
                    });
                }
            );
        } catch (e) {
            console.warn("[GCM] Extension context invalidated");
            resolve({ projects: [], chatMappings: {} });
        }
    });
};

export const saveProjects = (projects) => {
    if (!isContextValid()) return Promise.resolve();

    try {
        return chrome.storage.sync.set({ [STORAGE_KEYS.PROJECTS]: projects });
    } catch (e) {
        console.warn("[GCM] Extension context invalidated");
        return Promise.resolve();
    }
};

export const saveChatMappings = (chatMappings) => {
    if (!isContextValid()) return Promise.resolve();

    try {
        return chrome.storage.sync.set({ [STORAGE_KEYS.CHAT_MAPPINGS]: chatMappings });
    } catch (e) {
        console.warn("[GCM] Extension context invalidated");
        return Promise.resolve();
    }
};
