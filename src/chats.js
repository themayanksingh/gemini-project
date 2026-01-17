/**
 * Chats module - Chat management operations
 */

import { saveChatMappings } from "./storage.js";
import { getChatMappings, setChatMappings } from "./state.js";

export const normalizeChatId = (chatId) => {
    if (!chatId || typeof chatId !== "string") return null;
    const trimmed = chatId.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("c_")) return trimmed;
    return `c_${trimmed}`;
};

export const normalizeChatMappings = (chatMappings = {}) => {
    const normalized = {};
    Object.entries(chatMappings).forEach(([chatId, data]) => {
        const normalizedId = normalizeChatId(chatId);
        if (!normalizedId) return;
        if (normalized[normalizedId]) {
            normalized[normalizedId] = { ...normalized[normalizedId], ...data };
            return;
        }
        normalized[normalizedId] = data;
    });
    return normalized;
};

const cleanTitle = (title) => {
    if (!title || typeof title !== "string") return "";
    const cleaned = title.replace(/\s+/g, " ").trim();
    if (!cleaned) return "";
    const lower = cleaned.toLowerCase();
    if (lower === "gemini" || lower === "chats") return "";
    return cleaned;
};

const getTitleFromDocument = () => {
    const rawTitle = document.title || "";
    if (!rawTitle) return "";
    const cleaned = rawTitle.replace(/\s*[-|]\s*gemini.*$/i, "").trim();
    return cleanTitle(cleaned);
};

export const getCurrentChatTitle = () => {
    const selectors = [
        'main [data-test-id="conversation-title"]',
        'main [data-test-id="conversation-title-text"]',
        'main [data-test-id="chat-title"]',
        "main h1",
        "main h2",
        '[data-test-id="conversation-title"]',
        '[data-test-id="conversation-title-text"]',
        '[data-test-id="chat-title"]',
    ];

    for (const selector of selectors) {
        const el = document.querySelector(selector);
        const text = cleanTitle(el?.textContent);
        if (text) return text;
    }

    return getTitleFromDocument();
};

const extractChatIdFromJslog = (jslog) => {
    if (!jslog) return null;
    // Require at least 8 chars after c_ to avoid matching words like "click"
    const match = jslog.match(/c_[a-zA-Z0-9_-]{8,}/);
    return match ? normalizeChatId(match[0]) : null;
};

const extractChatIdFromPath = (path) => {
    if (!path || typeof path !== "string") return null;
    const cleanPath = path.split(/[?#]/)[0];
    let match = cleanPath.match(/\/app\/([a-zA-Z0-9_-]+)/);
    if (!match) match = cleanPath.match(/\/gem\/[^/]+\/([a-zA-Z0-9_-]+)/);
    if (!match) match = cleanPath.match(/\/c\/([a-zA-Z0-9_-]+)/);
    return match ? normalizeChatId(match[1]) : null;
};

const extractChatIdFromUrl = (url) => {
    if (!url || typeof url !== "string") return null;
    try {
        const parsed = new URL(url, window.location.origin);
        return extractChatIdFromPath(parsed.pathname);
    } catch (e) {
        return extractChatIdFromPath(url);
    }
};

const isLikelyChatId = (value) => {
    if (!value || typeof value !== "string") return false;
    if (value.includes("c_")) {
        // Require at least 8 chars after c_ to avoid matching words like "click"
        return /c_[a-zA-Z0-9_-]{8,}/.test(value);
    }
    return /^[a-f0-9]{10,}$/i.test(value);
};

const extractChatIdFromElement = (element) => {
    if (!element) return null;
    const dataId = element.getAttribute("data-conversation-id") ||
        element.getAttribute("data-chat-id") ||
        element.dataset?.conversationId ||
        element.dataset?.chatId;
    if (!isLikelyChatId(dataId)) return null;
    return normalizeChatId(dataId);
};

export const extractChatIdFromContainer = (container) => {
    if (!container) return null;
    const conversationEl = container.querySelector('[data-test-id="conversation"]');
    const jslogCandidates = [conversationEl, container];

    for (const candidate of jslogCandidates) {
        const jslog = candidate?.getAttribute?.("jslog");
        const jslogId = extractChatIdFromJslog(jslog);
        if (jslogId) return jslogId;
        const dataId = extractChatIdFromElement(candidate);
        if (dataId) return dataId;
    }

    const jslogDescendant = container.querySelector("[jslog]");
    const jslogId = extractChatIdFromJslog(jslogDescendant?.getAttribute("jslog"));
    if (jslogId) return jslogId;

    const hrefEl = conversationEl?.getAttribute?.("href")
        ? conversationEl
        : (conversationEl?.querySelector?.("a[href]") || container.querySelector("a[href]"));
    const href = hrefEl?.getAttribute?.("href");
    const hrefId = extractChatIdFromUrl(href);
    if (hrefId) return hrefId;

    const dataHref = conversationEl?.getAttribute?.("data-href") ||
        container.getAttribute?.("data-href");
    return extractChatIdFromUrl(dataHref);
};

export const findConversationContainerById = (chatId) => {
    const normalizedId = normalizeChatId(chatId);
    if (!normalizedId) return null;
    const conversations = document.querySelectorAll('.conversation-items-container');
    for (const container of conversations) {
        const containerChatId = extractChatIdFromContainer(container);
        if (containerChatId && containerChatId === normalizedId) {
            return container;
        }
    }
    return null;
};

export const moveChatToProject = (chatId, chatTitle, projectId, onComplete) => {
    const chatMappings = getChatMappings();
    const normalizedId = normalizeChatId(chatId);
    if (!normalizedId) return;
    if (normalizedId !== chatId) {
        delete chatMappings[chatId];
    }
    const existing = chatMappings[normalizedId];
    chatMappings[normalizedId] = {
        projectId,
        title: chatTitle,
        addedAt: existing?.addedAt || Date.now(),
    };
    setChatMappings(chatMappings);
    saveChatMappings(chatMappings);
    hideChatFromNativeList(normalizedId);
    if (onComplete) onComplete();
};

export const removeChatFromProject = (chatId, onComplete) => {
    const chatMappings = getChatMappings();
    const normalizedId = normalizeChatId(chatId);
    if (normalizedId) {
        delete chatMappings[normalizedId];
    }
    if (chatId && chatId !== normalizedId) {
        delete chatMappings[chatId];
    }
    setChatMappings(chatMappings);
    saveChatMappings(chatMappings);
    // Show the chat again in native list
    showChatInNativeList(normalizedId || chatId);
    if (onComplete) onComplete();
};

export const hideChatFromNativeList = (chatId) => {
    const normalizedId = normalizeChatId(chatId);
    if (!normalizedId) return;
    // Look for conversation containers that have the chat ID in jslog
    const conversations = document.querySelectorAll('.conversation-items-container');

    conversations.forEach((container) => {
        const containerChatId = extractChatIdFromContainer(container);

        if (containerChatId && containerChatId === normalizedId) {
            container.style.display = "none";
            container.dataset.gcmHidden = "true";
        }
    });
};

export const showChatInNativeList = (chatId) => {
    const normalizedId = normalizeChatId(chatId);
    if (!normalizedId) return;
    const conversations = document.querySelectorAll('.conversation-items-container');

    conversations.forEach((container) => {
        const containerChatId = extractChatIdFromContainer(container);

        if (containerChatId && containerChatId === normalizedId) {
            container.style.display = "";
            delete container.dataset.gcmHidden;
        }
    });
};

export const hideAllMappedChats = () => {
    // console.time('[GCM Profile] hideAllMappedChats');
    const chatMappings = getChatMappings();
    const mappedIds = new Set(
        Object.keys(chatMappings)
            .map((chatId) => normalizeChatId(chatId))
            .filter(Boolean)
    ); // quick lookup

    // Query DOM once
    const conversations = document.querySelectorAll('.conversation-items-container');

    conversations.forEach((container) => {
        // Check if already hidden to avoid style recalcs

        const chatId = extractChatIdFromContainer(container);
        const shouldHide = chatId && mappedIds.has(chatId);
        if (shouldHide) {
            if (container.style.display !== "none") container.style.display = "none";
            container.dataset.gcmHidden = "true";
        } else if (container.dataset.gcmHidden === "true") {
            container.style.display = "";
            delete container.dataset.gcmHidden;
        }
    });
    // console.timeEnd('[GCM Profile] hideAllMappedChats');
};

export const recoverHiddenUnmappedChats = () => {
    const chatMappings = getChatMappings();
    const mappedIds = new Set(
        Object.keys(chatMappings)
            .map((chatId) => normalizeChatId(chatId))
            .filter(Boolean)
    );
    const conversations = document.querySelectorAll('.conversation-items-container');

    conversations.forEach((container) => {
        const chatId = extractChatIdFromContainer(container);
        if (!chatId) return;
        if (!mappedIds.has(chatId) && container.style.display === "none") {
            container.style.display = "";
            delete container.dataset.gcmHidden;
        }
    });
};

// Clean up mappings for chats that have been deleted
// NOTE: Disabled because Gemini loads chats lazily - can't tell if chat is deleted or not loaded
export const cleanupDeletedChats = () => {
    // Don't auto-cleanup - Gemini loads chats lazily
    // User can manually remove chats via "Remove from Project"
    return false;
};

export const getCurrentChatId = () => {
    // Gemini uses /app/xxx or /gem/gemid/chatid format for chat URLs
    let match = window.location.pathname.match(/\/app\/([a-zA-Z0-9_-]+)/);
    if (!match) {
        // Try /gem/gemid/chatid format
        match = window.location.pathname.match(/\/gem\/[^/]+\/([a-zA-Z0-9_-]+)/);
    }
    if (!match) {
        match = window.location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);
    }
    const id = match ? match[1] : null;
    return id;
};

export const syncCurrentChatTitle = () => {
    // Invalid titles that should never be synced (UI elements, not chat titles)
    const INVALID_TITLES = ['projects', 'chats', 'gemini', 'recent', 'starred', 'untitled', 'untitled chat'];

    const currentChatId = getCurrentChatId();
    const normalizedId = normalizeChatId(currentChatId);
    if (!normalizedId) return false;

    const title = getCurrentChatTitle();
    if (!title) return false;

    // Don't sync if title matches an invalid    // Reject invalid titles
    if (INVALID_TITLES.includes(title.toLowerCase())) {
        return false;
    }

    const chatMappings = getChatMappings();
    const existing = chatMappings[normalizedId];
    if (!existing) return false;

    if (existing.title !== title) {
        chatMappings[normalizedId] = { ...existing, title };
        setChatMappings(chatMappings);
        saveChatMappings(chatMappings);
        return true;
    }

    return false;
};

// Build the correct URL for a chat
export const getChatUrl = (chatId) => {
    // Gemini uses /app format with the conversation ID
    // The ID format is c_XXXX, we need to extract the actual ID part
    const cleanId = chatId.startsWith("c_") ? chatId.substring(2) : chatId;
    return `/app/${cleanId}`;
};
