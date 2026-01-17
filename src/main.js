/**
 * Gemini Chat Manager - Main Entry Point
 * Organizes Gemini chats into projects/folders
 */

// Version - update this when making changes
const GCM_VERSION = "1.2.0";
console.log(`[GCM] Gemini Chat Manager v${GCM_VERSION} loaded`);

import { loadData, saveChatMappings } from "./storage.js";
import { getAccountId, getAccountChanged } from "./account.js";
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

    // Load data from storage (account-scoped)
    const accountId = getAccountId();
    const data = await loadData();
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
            // console.log('[GCM] Removing invalid chat mapping:', { chatId, chatData, hasValidProject, hasValidTitle });
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

                // Check for account changes (throttled)
                let lastKnownAccount = accountId;
                let lastAccountCheck = 0;

                const checkAccountChange = () => {
                    const now = Date.now();
                    if (now - lastAccountCheck < 2000) return; // Max once every 2s
                    lastAccountCheck = now;

                    const newAccount = getAccountChanged(lastKnownAccount);
                    if (newAccount) {
                        console.log(`[GCM] Account changed from ${lastKnownAccount} to ${newAccount}, reloading...`);
                        lastKnownAccount = newAccount;
                        window.location.reload();
                    }
                };

                // Watch for DOM changes with debouncing
                const observer = new MutationObserver(() => {
                    if (!isContainerInjected() || !document.getElementById("gcm-container")) {
                        debouncedRender();
                    }
                    debouncedHide();
                    // Check account on DOM changes (throttled)
                    checkAccountChange();
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                });

                // Initial hide of mapped chats
                setTimeout(hideAllMappedChats, 500);

                // Start watching for Gem chats to auto-assign
                watchForGemChats(debouncedRender);

                // Periodically clean up deleted chats (less frequent)
                setInterval(() => {
                    if (cleanupDeletedChats()) {
                        debouncedRender();
                    }
                }, 10000);

                // Re-render on URL/navigation changes
                let lastUrl = window.location.href;
                setInterval(() => {
                    if (window.location.href !== lastUrl) {
                        lastUrl = window.location.href;
                        renderProjectList();
                        checkAccountChange(); // Also check account on navigation
                    }
                }, 200);

                // Periodic refresh to sync chat names from native sidebar
                setInterval(() => {
                    debouncedRender();
                }, 3000);
            }
        }
    }, 500);
};

// Start the extension
init();
