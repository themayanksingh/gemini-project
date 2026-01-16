/**
 * Gemini Chat Manager - Main Entry Point
 * Organizes Gemini chats into projects/folders
 */

// Version - update this when making changes
const GCM_VERSION = "1.1.9";
console.log(`[GCM] Gemini Chat Manager v${GCM_VERSION} loaded`);

import { loadData, saveChatMappings } from "./storage.js";
import { setProjects, setChatMappings } from "./state.js";
import { hideAllMappedChats, cleanupDeletedChats, normalizeChatMappings, recoverHiddenUnmappedChats, syncCurrentChatTitle } from "./chats.js";
import { initContextMenuListener } from "./ui/contextMenu.js";
import { renderProjectList, isContainerInjected } from "./ui/projectList.js";
import { trackChatMenuClicks, watchForNativeMenu } from "./nativeMenu.js";
import { watchForGemChats } from "./gemAutoAssign.js";

// Get conversations list element
const getConversationsList = () =>
    document.querySelector('conversations-list[data-test-id="all-conversations"]');

// Initialize the extension
const init = async () => {
    // Invalid titles that indicate corrupted data (UI elements captured instead of chat titles)
    const INVALID_TITLES = ['projects', 'chats', 'gemini', 'recent', 'starred', 'untitled', 'untitled chat'];

    // Load data from storage
    const data = await loadData();
    console.log('[GCM DEBUG] Loaded data from storage:', JSON.stringify(data));
    setProjects(data.projects);
    const normalizedChatMappings = normalizeChatMappings(data.chatMappings);
    const validProjectIds = new Set(data.projects.map((project) => project.id));
    const prunedChatMappings = {};
    Object.entries(normalizedChatMappings).forEach(([chatId, chatData]) => {
        // Validate: must have valid projectId AND valid title (not a UI element name)
        const hasValidProject = chatData?.projectId && validProjectIds.has(chatData.projectId);
        const hasValidTitle = chatData?.title && !INVALID_TITLES.includes(chatData.title.toLowerCase());

        if (hasValidProject && hasValidTitle) {
            prunedChatMappings[chatId] = chatData;
        } else {
            console.log('[GCM] Removing invalid chat mapping:', { chatId, chatData, hasValidProject, hasValidTitle });
        }
    });
    setChatMappings(prunedChatMappings);
    saveChatMappings(prunedChatMappings);

    // Initialize UI listeners
    initContextMenuListener();
    trackChatMenuClicks();
    watchForNativeMenu();

    // Wait for Gemini sidebar to load
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        const convList = getConversationsList();

        if (convList || attempts > 60) {
            clearInterval(interval);

            if (convList) {
                renderProjectList();

                // Debounce function
                let debounceTimer = null;
                const debounce = (fn, delay) => {
                    return () => {
                        if (debounceTimer) clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(fn, delay);
                    };
                };

                let pendingRender = false;
                const isHoveringProjectList = () => {
                    const container = document.getElementById("gcm-container");
                    return container ? container.matches(":hover") : false;
                };

                const safeRenderProjectList = () => {
                    if (isHoveringProjectList()) {
                        if (pendingRender) return;
                        pendingRender = true;

                        const retry = () => {
                            if (!isHoveringProjectList()) {
                                pendingRender = false;
                                renderProjectList();
                                return;
                            }
                            setTimeout(retry, 150);
                        };

                        setTimeout(retry, 150);
                        return;
                    }

                    pendingRender = false;
                    renderProjectList();
                };

                // Debounced functions
                const debouncedHide = debounce(() => {
                    hideAllMappedChats();
                }, 300); // Increased from 100ms

                const debouncedRender = debounce(() => {
                    safeRenderProjectList();
                }, 200); // Increased from 150ms

                // Watch for DOM changes with debouncing
                const observer = new MutationObserver(() => {
                    if (!isContainerInjected() || !document.getElementById("gcm-container")) {
                        debouncedRender();
                    }
                    debouncedHide();
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                });

                // Initial hide of mapped chats
                setTimeout(() => {
                    hideAllMappedChats();
                    recoverHiddenUnmappedChats();
                }, 500);

                // Start watching for Gem chats to auto-assign
                watchForGemChats(debouncedRender);

                // Periodically clean up deleted chats (less frequent)
                setInterval(() => {
                    if (cleanupDeletedChats()) {
                        debouncedRender();
                    }
                }, 10000);

                // Re-render on URL/navigation changes to update active chat
                let lastUrl = window.location.href;
                setInterval(() => {
                    if (window.location.href !== lastUrl) {
                        lastUrl = window.location.href;
                        renderProjectList(); // Immediate for active state
                    }
                }, 200);

                // Periodic refresh to sync chat names from native sidebar
                setInterval(() => {
                    const didUpdateTitle = syncCurrentChatTitle();
                    if (didUpdateTitle) {
                        debouncedRender();
                        return;
                    }
                    debouncedRender();
                }, 3000);
            }
        }
    }, 200);
};

// Start the extension
init();
