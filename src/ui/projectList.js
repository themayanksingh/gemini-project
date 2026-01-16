/**
 * Project List UI component - Renders projects in sidebar
 */

import { getProjects } from "../state.js";
import { addProject, renameProject, deleteProject, getChatsForProject, setProjectGem, clearProjectGem, toggleProjectExpansion } from "../projects.js";
import { removeChatFromProject, getCurrentChatId, getChatUrl, findConversationContainerById } from "../chats.js";
import { showModal } from "./modal.js";
import { showContextMenu } from "./contextMenu.js";

// Helper to get available Gems from sidebar
const getAvailableGems = () => {
    const gems = [];
    const seenIds = new Set();

    // Gems are in bot-list-item elements
    document.querySelectorAll('bot-list-item').forEach(item => {
        // Get name from .bot-name span
        const nameEl = item.querySelector('.bot-name');
        const name = nameEl?.textContent?.trim();

        // Get gem ID from jslog attribute on .bot-item
        const botItem = item.querySelector('.bot-item');
        const jslog = botItem?.getAttribute('jslog');

        if (jslog && name) {
            // Extract gem ID from jslog - format: "8032b7ea8211"
            const match = jslog.match(/"([a-f0-9]{10,14})"/);
            if (match && !seenIds.has(match[1])) {
                seenIds.add(match[1]);
                gems.push({ id: match[1], name });
            }
        }
    });

    return gems;
};

// Show Gem picker modal
const showGemPicker = (onSelect) => {
    const overlay = document.createElement('div');
    overlay.classList.add('gcm-modal-overlay');

    const gems = getAvailableGems();

    let gemListHtml = '';
    if (gems.length === 0) {
        gemListHtml = '<div class="gcm-empty">No Gems found. Make sure your Gems are visible in the sidebar.</div>';
    } else {
        gemListHtml = gems.map(gem =>
            `<div class="gcm-gem-item" data-gem-id="${gem.id}" data-gem-name="${gem.name}">${gem.name}</div>`
        ).join('');
    }

    overlay.innerHTML = `
    <div class="gcm-modal">
      <h3 class="gcm-modal-title">Select Gem</h3>
      <div class="gcm-gem-list">${gemListHtml}</div>
      <div class="gcm-modal-actions">
        <button class="gcm-modal-btn cancel">Cancel</button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    const cancelBtn = overlay.querySelector('.cancel');
    cancelBtn.addEventListener('click', () => overlay.remove());

    overlay.querySelectorAll('.gcm-gem-item').forEach(item => {
        item.addEventListener('click', () => {
            const gemId = item.dataset.gemId;
            const gemName = item.dataset.gemName;
            onSelect(gemId, gemName);
            overlay.remove();
        });
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
};

// SVG Icons
const createProjectIcon = () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.classList.add("gcm-project-icon");
    svg.innerHTML = `<path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>`;
    return svg;
};

const createMenuIcon = () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.style.fill = "currentColor";
    svg.innerHTML = `<path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>`;
    return svg;
};

// Get conversations list element
const getConversationsList = () =>
    document.querySelector('conversations-list[data-test-id="all-conversations"]');

const navigateWithoutReload = (chatId) => {
    const targetUrl = getChatUrl(chatId);
    if (!targetUrl || window.location.pathname === targetUrl) return;
    window.history.pushState({}, "", targetUrl);
    window.dispatchEvent(new PopStateEvent("popstate"));
};

// Track if container is injected
let containerInjected = false;

export const isContainerInjected = () => containerInjected;

let hasLoggedHeights = false;

const debugRenderHeights = () => {
    if (hasLoggedHeights) return;
    const projectHeader = document.querySelector(".gcm-project-header");
    const chatRow = document.querySelector(".gcm-chat");
    const projectHeight = projectHeader?.getBoundingClientRect().height ?? null;
    const chatHeight = chatRow?.getBoundingClientRect().height ?? null;
    console.log("[GCM] Rendered row heights", { project: projectHeight, chat: chatHeight });
    hasLoggedHeights = true;
};

export const renderProjectList = () => {
    const convList = getConversationsList();
    if (!convList) return;

    let container = document.getElementById("gcm-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "gcm-container";
        container.classList.add("gcm-container");
        convList.insertBefore(container, convList.firstChild);
        containerInjected = true;
    }

    const projects = getProjects();
    const currentChatId = getCurrentChatId();

    container.innerHTML = `
    <div class="gcm-header">
      <h2 class="gcm-title">Projects</h2>
      <button class="gcm-add-btn" id="gcm-add-project">+ Add</button>
    </div>
    <ul class="gcm-projects" id="gcm-projects-list"></ul>
  `;

    const projectsList = container.querySelector("#gcm-projects-list");
    const addBtn = container.querySelector("#gcm-add-project");

    addBtn.addEventListener("click", () => {
        showModal("Create Project", "Project name", (name) => {
            addProject(name, renderProjectList);
        });
    });

    if (projects.length === 0) {
        projectsList.innerHTML = `<li class="gcm-empty">No projects yet. Click "+ Add" to create one.</li>`;
    } else {
        projects.forEach((project) => {
            const chats = getChatsForProject(project.id);

            const li = document.createElement("li");
            li.classList.add("gcm-project");
            li.dataset.projectId = project.id;

            // Restore expanded state
            if (project.isExpanded) {
                li.classList.add("expanded");
            }

            const header = document.createElement("div");
            header.classList.add("gcm-project-header");

            header.appendChild(createProjectIcon());

            // Expand arrow to toggle chats
            const expandBtn = document.createElement("button");
            expandBtn.classList.add("gcm-expand-btn");
            expandBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>`;
            expandBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                // Toggle UI immediately for responsiveness
                li.classList.toggle("expanded");
                // Persist state
                toggleProjectExpansion(project.id, li.classList.contains("expanded"));
            });
            header.appendChild(expandBtn);

            const nameSpan = document.createElement("span");
            nameSpan.classList.add("gcm-project-name");
            nameSpan.textContent = project.name;
            header.appendChild(nameSpan);

            const countSpan = document.createElement("span");
            countSpan.classList.add("gcm-project-count");
            countSpan.textContent = chats.length;
            header.appendChild(countSpan);

            const menuBtn = document.createElement("button");
            menuBtn.classList.add("gcm-project-menu-btn");
            menuBtn.appendChild(createMenuIcon());
            menuBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const menuItems = [
                    {
                        label: project.gemId ? "Change Gem" : "Set Gem",
                        action: () => {
                            showGemPicker((gemId, gemName) => {
                                setProjectGem(project.id, gemId, gemName, renderProjectList);
                            });
                        },
                    },
                ];

                if (project.gemId) {
                    menuItems.push({
                        label: "Clear Gem",
                        action: () => clearProjectGem(project.id, renderProjectList),
                    });
                }

                menuItems.push(
                    {
                        label: "Rename",
                        action: () =>
                            showModal("Rename Project", "New name", (name) => {
                                renameProject(project.id, name, renderProjectList);
                            }, project.name),
                    },
                    {
                        label: "Delete",
                        danger: true,
                        action: () => {
                            if (confirm(`Delete "${project.name}"? Chats will not be deleted.`)) {
                                deleteProject(project.id, renderProjectList);
                            }
                        },
                    }
                );

                showContextMenu(e.clientX, e.clientY, menuItems);
            });
            header.appendChild(menuBtn);

            header.addEventListener("click", () => {
                // If Gem is set, navigate to it by clicking native element
                if (project.gemId) {
                    // Find the bot-list-item with matching gem ID
                    let found = false;
                    document.querySelectorAll('bot-list-item .bot-item').forEach(botItem => {
                        const jslog = botItem.getAttribute('jslog');
                        if (jslog && jslog.includes(project.gemId)) {
                            // Click the button inside to navigate
                            const btn = botItem.querySelector('button.bot-new-conversation-button');
                            if (btn) {
                                btn.click();
                                found = true;
                            }
                        }
                    });
                    if (!found) {
                        // Fallback: just expand the project
                        li.classList.toggle("expanded");
                        toggleProjectExpansion(project.id, li.classList.contains("expanded"));
                    }
                } else {
                    // Otherwise toggle expand
                    li.classList.toggle("expanded");
                    toggleProjectExpansion(project.id, li.classList.contains("expanded"));
                }
            });

            li.appendChild(header);

            // Chats list
            const chatsUl = document.createElement("ul");
            chatsUl.classList.add("gcm-chats");

            if (chats.length === 0) {
                const emptyLi = document.createElement("li");
                emptyLi.classList.add("gcm-empty");
                emptyLi.textContent = "No chats in this project";
                chatsUl.appendChild(emptyLi);
            } else {
                chats.forEach((chat) => {
                    const chatLi = document.createElement("li");
                    chatLi.classList.add("gcm-chat");
                    // Handle both cases: URL may return c_xxx or just xxx
                    // chat.id always has c_ prefix
                    const isActive = currentChatId && (
                        chat.id === currentChatId ||
                        chat.id === `c_${currentChatId}` ||
                        chat.id.substring(2) === currentChatId
                    );
                    if (isActive) {
                        chatLi.classList.add("active");
                    }

                    const titleSpan = document.createElement("span");
                    titleSpan.classList.add("gcm-chat-title");
                    titleSpan.textContent = chat.title;
                    chatLi.appendChild(titleSpan);

                    // Add menu button (three dots)
                    const menuBtn = document.createElement("button");
                    menuBtn.classList.add("gcm-chat-menu-btn");
                    menuBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>`;
                    menuBtn.addEventListener("click", (e) => {
                        e.stopPropagation();

                        // Helper to trigger native menu action
                        const triggerNativeAction = (actionText) => {
                            const nativeChatContainer = findConversationContainerById(chat.id);
                            const nativeMenuBtn = nativeChatContainer?.querySelector('.conversation-actions-menu-button');

                            if (nativeMenuBtn && nativeChatContainer) {
                                // Find scrollable container(s) and save position
                                const scrollContainers = [
                                    document.querySelector('[data-test-id="overflow-container"]'),
                                    document.querySelector('.overflow-container'),
                                    document.querySelector('infinite-scroller'),
                                ].filter(Boolean);
                                const scrollPositions = scrollContainers.map(c => c.scrollTop);

<<<<<<< HEAD
                                // Add temporary style to hide menu and lock scroll
=======
                                // Add temporary style to hide everything during the operation
>>>>>>> 0af5372 (feat: Gemini Chat Manager extension with project folders)
                                const hideStyle = document.createElement('style');
                                hideStyle.id = 'gcm-hide-native-menu';
                                hideStyle.textContent = `
                                    .cdk-overlay-container { opacity: 0 !important; pointer-events: none !important; }
                                    .overflow-container, infinite-scroller { overflow: hidden !important; }
<<<<<<< HEAD
                                `;
                                document.head.appendChild(hideStyle);

                                nativeChatContainer.style.display = '';
=======
                                    .conversation-items-container[data-gcm-hidden="true"] { 
                                        display: block !important; 
                                        opacity: 0 !important; 
                                        pointer-events: auto !important;
                                        position: absolute !important;
                                        left: -9999px !important;
                                    }
                                `;
                                document.head.appendChild(hideStyle);

>>>>>>> 0af5372 (feat: Gemini Chat Manager extension with project folders)
                                nativeMenuBtn.click();

                                // Restore scroll position immediately
                                scrollContainers.forEach((c, i) => { c.scrollTop = scrollPositions[i]; });

                                // Wait for menu to open, then click the action
                                setTimeout(() => {
                                    const menuItems = document.querySelectorAll('.mat-mdc-menu-panel [role="menuitem"]');
                                    menuItems.forEach(item => {
                                        if (item.textContent?.trim().toLowerCase().includes(actionText.toLowerCase())) {
                                            // Remove hide style before clicking (for dialogs like rename)
                                            hideStyle.remove();
                                            item.click();
                                        }
                                    });
<<<<<<< HEAD
                                    nativeChatContainer.style.display = 'none';
=======
>>>>>>> 0af5372 (feat: Gemini Chat Manager extension with project folders)
                                    // Ensure style is removed
                                    if (document.getElementById('gcm-hide-native-menu')) {
                                        document.getElementById('gcm-hide-native-menu').remove();
                                    }
                                    // Restore scroll again after action
                                    scrollContainers.forEach((c, i) => { c.scrollTop = scrollPositions[i]; });
                                }, 100);
                            }
                        };

                        // Show context menu with all options
                        showContextMenu(e.clientX, e.clientY, [
                            {
                                label: "Share conversation",
                                action: () => triggerNativeAction("share"),
                            },
                            {
                                label: "Pin",
                                action: () => triggerNativeAction("pin"),
                            },
                            {
                                label: "Rename",
                                action: () => triggerNativeAction("rename"),
                            },
                            {
                                label: "Remove from Project",
                                danger: true,
                                action: () => removeChatFromProject(chat.id, renderProjectList),
                            },
                            {
                                label: "Delete",
                                danger: true,
                                action: () => triggerNativeAction("delete"),
                            },
                        ]);
                    });
                    chatLi.appendChild(menuBtn);

                    chatLi.addEventListener("click", (e) => {
                        // Prevent navigation if clicking menu button
                        if (e.target.closest('.gcm-chat-menu-btn')) return;

                        // Find the native chat container
                        const nativeChatContainer = findConversationContainerById(chat.id);
                        const nativeChat = nativeChatContainer?.querySelector('[data-test-id="conversation"]');
                        const clickable = nativeChat ||
                            nativeChatContainer?.querySelector('[role="button"]') ||
                            nativeChatContainer;

                        if (clickable) {
                            // Temporarily show it, click it, and it will navigate via SPA
                            if (nativeChatContainer) {
                                nativeChatContainer.style.display = '';
                            }
                            clickable.click();
                            // Re-hide after navigation starts
                            setTimeout(() => {
                                if (nativeChatContainer) {
                                    nativeChatContainer.style.display = 'none';
                                }
                            }, 100);
                        } else {
                            // Fallback: SPA-friendly navigation without reload
                            navigateWithoutReload(chat.id);
                        }
                    });

                    chatsUl.appendChild(chatLi);
                });
            }

            li.appendChild(chatsUl);
            projectsList.appendChild(li);
        });
    }

    requestAnimationFrame(debugRenderHeights);
};
