/**
 * Gem Auto-Assign module - Automatically assigns new chats created via Gem to linked project
 */

import { getProjects, getChatMappings } from "./state.js";
import { moveChatToProject, extractChatIdFromContainer } from "./chats.js";

// Track known chat IDs to detect new ones
let knownChatIds = new Set();
let isInitialized = false;
let onChatAssignedCallback = null;

// Get current Gem ID from URL
const getCurrentGemId = () => {
    const match = window.location.pathname.match(/\/gem\/([^/?]+)/);
    return match ? match[1] : null;
};

// Find project linked to a Gem ID
const getProjectForGem = (gemId) => {
    const projects = getProjects();
    return projects.find(p => p.gemId === gemId);
};

// Extract chat title from a conversation container
const extractChatTitle = (container) => {
    const titleEl = container.querySelector('.conversation-title');
    return titleEl?.textContent?.trim() || "Untitled Chat";
};

// Initialize known chat IDs (run once at startup)
const initializeKnownChats = () => {
    if (isInitialized) return;

    document.querySelectorAll('.conversation-items-container').forEach(container => {
        const chatId = extractChatIdFromContainer(container);
        if (chatId) {
            knownChatIds.add(chatId);
        }
    });

    isInitialized = true;
};

// Check if we should auto-assign a new chat
const checkAndAutoAssign = (container) => {
    const chatId = extractChatIdFromContainer(container);
    if (!chatId) return;

    // CRITICAL: Skip if already mapped to any project (check first!)
    const chatMappings = getChatMappings();
    if (chatMappings[chatId]) {
        // Just mark as known and hide it
        knownChatIds.add(chatId);
        return;
    }

    // Skip if we already know this chat (prevents duplicate processing)
    if (knownChatIds.has(chatId)) return;

    // Mark as known
    knownChatIds.add(chatId);

    // Check if we're on a Gem page
    const currentGemId = getCurrentGemId();
    if (!currentGemId) return;

    // Find project linked to this Gem
    const project = getProjectForGem(currentGemId);
    if (!project) return;

    // Auto-assign chat to project
    const chatTitle = extractChatTitle(container);
    console.log(`[GCM] Auto-assigning chat "${chatTitle}" to project "${project.name}"`);

    // Small delay to let the chat fully load, then do proper assignment
    setTimeout(() => {
        const latestChatId = extractChatIdFromContainer(container) || chatId;
        const latestChatTitle = extractChatTitle(container) || chatTitle;
        moveChatToProject(latestChatId, latestChatTitle, project.id, onChatAssignedCallback);
        knownChatIds.add(latestChatId);
    }, 150);
};

// Watch for new chats in sidebar
export const watchForGemChats = (onAssigned) => {
    // Store callback
    onChatAssignedCallback = onAssigned;

    // Initialize known chats first
    setTimeout(initializeKnownChats, 1000);

    const observer = new MutationObserver((mutations) => {
        // Only process if we're on a Gem page
        const currentGemId = getCurrentGemId();
        if (!currentGemId) return;

        // Check if any project is linked to this Gem
        const project = getProjectForGem(currentGemId);
        if (!project) return;

        // Look for new conversation containers
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) return;

                // Check if this is a conversation container
                if (node.classList?.contains('conversation-items-container')) {
                    checkAndAutoAssign(node);
                }

                // Also check children
                node.querySelectorAll?.('.conversation-items-container').forEach(container => {
                    checkAndAutoAssign(container);
                });
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
};

// Re-scan for new chats (can be called periodically)
export const rescanForNewChats = () => {
    const currentGemId = getCurrentGemId();
    if (!currentGemId) return;

    const project = getProjectForGem(currentGemId);
    if (!project) return;

    document.querySelectorAll('.conversation-items-container').forEach(container => {
        checkAndAutoAssign(container);
    });
};
