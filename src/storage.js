/**
 * Storage module - Chrome storage helpers with account scoping
 * Includes error handling for extension context invalidation
 */

import { getAccountId } from "./account.js";

// Base storage keys (will be suffixed with account ID)
const STORAGE_KEYS = {
    PROJECTS: "gcm_projects",
    CHAT_MAPPINGS: "gcm_chat_mappings",
};

// Legacy keys (for migration)
const LEGACY_KEYS = {
    PROJECTS: "gcm_projects",
    CHAT_MAPPINGS: "gcm_chat_mappings",
};

/**
 * Get account-scoped storage key
 */
const getScopedKey = (baseKey) => {
    const accountId = getAccountId();
    if (accountId === 'default') {
        return baseKey; // Fallback to global key if no account detected
    }
    return `${baseKey}_${accountId}`;
};

// Check if extension context is still valid
const isContextValid = () => {
    try {
        return chrome.runtime?.id !== undefined;
    } catch (e) {
        return false;
    }
};

/**
 * Migrate legacy data to account-scoped storage
 * Only runs once - legacy data is deleted after first migration
 */
const migrateLegacyData = async (accountId) => {
    if (!isContextValid() || accountId === 'default') return;

    const globalMigrationKey = 'gcm_legacy_migrated'; // One-time flag

    try {
        const result = await chrome.storage.sync.get([
            globalMigrationKey,
            LEGACY_KEYS.PROJECTS,
            LEGACY_KEYS.CHAT_MAPPINGS
        ]);

        // Skip if already migrated globally
        if (result[globalMigrationKey]) return;

        const legacyProjects = result[LEGACY_KEYS.PROJECTS];
        const legacyChatMappings = result[LEGACY_KEYS.CHAT_MAPPINGS];

        if (!legacyProjects && !legacyChatMappings) {
            // No legacy data, mark as migrated
            await chrome.storage.sync.set({ [globalMigrationKey]: true });
            return;
        }

        // Copy legacy data to CURRENT account's scoped keys
        const scopedProjectsKey = `${STORAGE_KEYS.PROJECTS}_${accountId}`;
        const scopedMappingsKey = `${STORAGE_KEYS.CHAT_MAPPINGS}_${accountId}`;

        const updates = { [globalMigrationKey]: true };

        if (legacyProjects) {
            updates[scopedProjectsKey] = legacyProjects;
        }
        if (legacyChatMappings) {
            updates[scopedMappingsKey] = legacyChatMappings;
        }

        await chrome.storage.sync.set(updates);

        // DELETE legacy keys so they don't migrate to other accounts
        await chrome.storage.sync.remove([LEGACY_KEYS.PROJECTS, LEGACY_KEYS.CHAT_MAPPINGS]);

        console.log('[GCM] Migrated legacy data to account:', accountId);
    } catch (e) {
        console.warn('[GCM] Migration error:', e);
    }
};

export const loadData = async () => {
    if (!isContextValid()) {
        return { projects: [], chatMappings: {} };
    }

    const accountId = getAccountId();

    // Run migration if needed
    await migrateLegacyData(accountId);

    const projectsKey = getScopedKey(STORAGE_KEYS.PROJECTS);
    const mappingsKey = getScopedKey(STORAGE_KEYS.CHAT_MAPPINGS);

    return new Promise((resolve) => {
        try {
            chrome.storage.sync.get([projectsKey, mappingsKey], (result) => {
                if (chrome.runtime.lastError) {
                    console.warn("[GCM] Storage read error:", chrome.runtime.lastError);
                    resolve({ projects: [], chatMappings: {} });
                    return;
                }
                resolve({
                    projects: result[projectsKey] || [],
                    chatMappings: result[mappingsKey] || {},
                });
            });
        } catch (e) {
            console.warn("[GCM] Extension context invalidated");
            resolve({ projects: [], chatMappings: {} });
        }
    });
};

export const saveProjects = (projects) => {
    if (!isContextValid()) return Promise.resolve();

    const key = getScopedKey(STORAGE_KEYS.PROJECTS);

    try {
        return chrome.storage.sync.set({ [key]: projects });
    } catch (e) {
        console.warn("[GCM] Extension context invalidated");
        return Promise.resolve();
    }
};

export const saveChatMappings = (chatMappings) => {
    if (!isContextValid()) return Promise.resolve();

    const key = getScopedKey(STORAGE_KEYS.CHAT_MAPPINGS);

    try {
        return chrome.storage.sync.set({ [key]: chatMappings });
    } catch (e) {
        console.warn("[GCM] Extension context invalidated");
        return Promise.resolve();
    }
};
