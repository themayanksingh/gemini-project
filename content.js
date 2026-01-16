/**
 * Gemini Chat Manager - Content Script
 * Organizes Gemini chats into projects/folders
 */

(() => {
    "use strict";

    // ===== Storage Keys =====
    const STORAGE_KEYS = {
        PROJECTS: "gcm_projects",
        CHAT_MAPPINGS: "gcm_chat_mappings",
    };

    // ===== State =====
    let projects = [];
    let chatMappings = {};
    let containerInjected = false;
    let lastClickedChatInfo = null; // Track which chat's menu was clicked

    // ===== Storage Helpers =====
    const loadData = () => {
        return new Promise((resolve) => {
            chrome.storage.sync.get(
                [STORAGE_KEYS.PROJECTS, STORAGE_KEYS.CHAT_MAPPINGS],
                (result) => {
                    projects = result[STORAGE_KEYS.PROJECTS] || [];
                    chatMappings = result[STORAGE_KEYS.CHAT_MAPPINGS] || {};
                    resolve();
                }
            );
        });
    };

    const saveProjects = () => {
        chrome.storage.sync.set({ [STORAGE_KEYS.PROJECTS]: projects });
    };

    const saveChatMappings = () => {
        chrome.storage.sync.set({ [STORAGE_KEYS.CHAT_MAPPINGS]: chatMappings });
    };

    // ===== ID Generation =====
    const generateId = () => `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // ===== DOM Helpers =====
    const getConversationsList = () =>
        document.querySelector('conversations-list[data-test-id="all-conversations"]');

    const getCurrentChatId = () => {
        const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    };

    // ===== UI Components =====
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
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.style.fill = "currentColor";
        svg.innerHTML = `<path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>`;
        return svg;
    };

    // ===== Modal System =====
    const showModal = (title, placeholder, onConfirm, defaultValue = "") => {
        const overlay = document.createElement("div");
        overlay.classList.add("gcm-modal-overlay");

        const modal = document.createElement("div");
        modal.classList.add("gcm-modal");
        modal.innerHTML = `
      <h3 class="gcm-modal-title">${title}</h3>
      <input type="text" class="gcm-modal-input" placeholder="${placeholder}" value="${defaultValue}">
      <div class="gcm-modal-actions">
        <button class="gcm-modal-btn cancel">Cancel</button>
        <button class="gcm-modal-btn primary">Confirm</button>
      </div>
    `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const input = modal.querySelector(".gcm-modal-input");
        const cancelBtn = modal.querySelector(".cancel");
        const confirmBtn = modal.querySelector(".primary");

        input.focus();
        input.select();

        const close = () => overlay.remove();

        cancelBtn.addEventListener("click", close);
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) close();
        });

        confirmBtn.addEventListener("click", () => {
            const value = input.value.trim();
            if (value) {
                onConfirm(value);
                close();
            }
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const value = input.value.trim();
                if (value) {
                    onConfirm(value);
                    close();
                }
            } else if (e.key === "Escape") {
                close();
            }
        });
    };

    // ===== Context Menu =====
    let activeContextMenu = null;

    const closeContextMenu = () => {
        if (activeContextMenu) {
            activeContextMenu.remove();
            activeContextMenu = null;
        }
    };

    const showContextMenu = (x, y, items) => {
        closeContextMenu();

        const menu = document.createElement("div");
        menu.classList.add("gcm-context-menu");
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        items.forEach((item) => {
            const btn = document.createElement("button");
            btn.classList.add("gcm-context-item");
            if (item.danger) btn.classList.add("danger");
            btn.textContent = item.label;
            btn.addEventListener("click", () => {
                closeContextMenu();
                item.action();
            });
            menu.appendChild(btn);
        });

        document.body.appendChild(menu);
        activeContextMenu = menu;

        // Adjust position if off-screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - rect.width - 8}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${window.innerHeight - rect.height - 8}px`;
        }
    };

    document.addEventListener("click", (e) => {
        if (activeContextMenu && !activeContextMenu.contains(e.target)) {
            closeContextMenu();
        }
    });

    // ===== Project CRUD =====
    const addProject = (name) => {
        const project = {
            id: generateId(),
            name,
            order: projects.length,
            createdAt: Date.now(),
        };
        projects.push(project);
        saveProjects();
        renderUI();
    };

    const renameProject = (projectId, newName) => {
        const project = projects.find((p) => p.id === projectId);
        if (project) {
            project.name = newName;
            saveProjects();
            renderUI();
        }
    };

    const deleteProject = (projectId) => {
        projects = projects.filter((p) => p.id !== projectId);
        // Remove all chat mappings for this project
        Object.keys(chatMappings).forEach((chatId) => {
            if (chatMappings[chatId] === projectId) {
                delete chatMappings[chatId];
            }
        });
        saveProjects();
        saveChatMappings();
        renderUI();
    };

    // ===== Chat Management =====
    const moveChatToProject = (chatId, chatTitle, projectId) => {
        chatMappings[chatId] = { projectId, title: chatTitle };
        saveChatMappings();
        renderUI();
        hideChatFromNativeList(chatId);
    };

    const removeChatFromProject = (chatId) => {
        delete chatMappings[chatId];
        saveChatMappings();
        renderUI();
    };

    const getChatsForProject = (projectId) => {
        const result = [];
        Object.entries(chatMappings).forEach(([chatId, data]) => {
            if (data.projectId === projectId) {
                result.push({ id: chatId, title: data.title });
            }
        });
        return result;
    };

    // ===== Hide Chat from Native List =====
    const hideChatFromNativeList = (chatId) => {
        const region = document.querySelector(
            'conversations-list[data-test-id="all-conversations"] div[role="region"]'
        );
        if (!region) return;

        const chatLinks = region.querySelectorAll(`a[href*="${chatId}"]`);
        chatLinks.forEach((link) => {
            const listItem = link.closest('[role="listitem"]') || link.parentElement;
            if (listItem) {
                listItem.style.display = "none";
            }
        });
    };

    // ===== Hide All Mapped Chats =====
    const hideAllMappedChats = () => {
        Object.keys(chatMappings).forEach((chatId) => {
            hideChatFromNativeList(chatId);
        });
    };

    // ===== Move to Project Dialog =====
    const showMoveToProjectMenu = (chatId, chatTitle, x, y) => {
        const items = projects.map((p) => ({
            label: p.name,
            action: () => moveChatToProject(chatId, chatTitle, p.id),
        }));

        if (chatMappings[chatId]) {
            items.push({
                label: "Remove from Project",
                danger: true,
                action: () => removeChatFromProject(chatId),
            });
        }

        if (items.length === 0) {
            items.push({
                label: "No projects yet",
                action: () => { },
            });
        }

        showContextMenu(x, y, items);
    };

    // ===== Inject into Native Gemini Menu =====
    const MOVE_TO_PROJECT_ID = "gcm-move-to-project-item";

    const injectMoveToProjectOption = (menu) => {
        // Check if already injected
        if (menu.querySelector(`#${MOVE_TO_PROJECT_ID}`)) return;

        // Find the menu items container
        const menuItems = menu.querySelectorAll('[role="menuitem"]');
        if (menuItems.length === 0) return;

        // Get the last menu item to clone its structure/styling
        const lastItem = menuItems[menuItems.length - 1];

        // Create "Move to Project" parent item with submenu
        const moveItem = document.createElement("div");
        moveItem.id = MOVE_TO_PROJECT_ID;
        moveItem.setAttribute("role", "menuitem");
        moveItem.style.cssText = `
      position: relative;
      padding: 8px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      color: #e3e3e3;
      transition: background 0.15s;
    `;

        // Folder icon
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("viewBox", "0 0 24 24");
        icon.setAttribute("width", "20");
        icon.setAttribute("height", "20");
        icon.style.fill = "#e3e3e3";
        icon.innerHTML = `<path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>`;

        const label = document.createElement("span");
        label.textContent = "Move to Project";
        label.style.flex = "1";

        // Arrow for submenu
        const arrow = document.createElement("span");
        arrow.textContent = "›";
        arrow.style.cssText = "font-size: 16px; color: #9aa0a6;";

        moveItem.appendChild(icon);
        moveItem.appendChild(label);
        moveItem.appendChild(arrow);

        // Create submenu
        const submenu = document.createElement("div");
        submenu.classList.add("gcm-native-submenu");
        submenu.style.cssText = `
      position: absolute;
      left: 100%;
      top: 0;
      background: #2d2d2d;
      border-radius: 8px;
      padding: 4px 0;
      min-width: 150px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      display: none;
      z-index: 10002;
    `;

        if (projects.length === 0) {
            const noProjects = document.createElement("div");
            noProjects.style.cssText = "padding: 10px 16px; color: #9aa0a6; font-size: 13px;";
            noProjects.textContent = "No projects yet";
            submenu.appendChild(noProjects);
        } else {
            projects.forEach((project) => {
                const projectItem = document.createElement("div");
                projectItem.style.cssText = `
          padding: 10px 16px;
          cursor: pointer;
          font-size: 14px;
          color: #e3e3e3;
          transition: background 0.15s;
        `;
                projectItem.textContent = project.name;

                projectItem.addEventListener("mouseenter", () => {
                    projectItem.style.background = "rgba(255, 255, 255, 0.1)";
                });
                projectItem.addEventListener("mouseleave", () => {
                    projectItem.style.background = "";
                });

                projectItem.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (lastClickedChatInfo) {
                        moveChatToProject(lastClickedChatInfo.id, lastClickedChatInfo.title, project.id);
                        // Close native menu
                        const closeBtn = menu.querySelector('[aria-label="Close"]');
                        if (closeBtn) closeBtn.click();
                        else menu.remove();
                    }
                });

                submenu.appendChild(projectItem);
            });
        }

        moveItem.appendChild(submenu);

        // Show/hide submenu on hover
        moveItem.addEventListener("mouseenter", () => {
            moveItem.style.background = "rgba(255, 255, 255, 0.1)";
            submenu.style.display = "block";
        });
        moveItem.addEventListener("mouseleave", () => {
            moveItem.style.background = "";
            submenu.style.display = "none";
        });

        // Insert before "Delete" (last item typically)
        if (lastItem && lastItem.parentElement) {
            lastItem.parentElement.insertBefore(moveItem, lastItem);
        }
    };

    // ===== Track Chat Menu Clicks =====
    const trackChatMenuClicks = () => {
        document.addEventListener("click", (e) => {
            // Check if clicking a menu button (three dots) on a chat item
            const menuBtn = e.target.closest('[aria-label="More menu"]') ||
                e.target.closest('button[aria-haspopup="menu"]') ||
                e.target.closest('[data-test-id="conversation-menu-button"]');

            if (menuBtn) {
                // Find the parent chat item
                const chatItem = menuBtn.closest('a[href^="/app/"]') ||
                    menuBtn.closest('[role="listitem"]')?.querySelector('a[href^="/app/"]');

                if (chatItem) {
                    const href = chatItem.getAttribute("href");
                    const match = href?.match(/\/app\/([a-zA-Z0-9_-]+)/);
                    if (match) {
                        lastClickedChatInfo = {
                            id: match[1],
                            title: chatItem.textContent?.trim() || "Untitled Chat",
                        };
                    }
                }
            }
        }, true);
    };

    // ===== Watch for Native Menu =====
    const watchForNativeMenu = () => {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;

                    // Look for native menu (usually a div with role="menu")
                    const menu = node.querySelector?.('[role="menu"]') ||
                        (node.getAttribute?.("role") === "menu" ? node : null);

                    if (menu && lastClickedChatInfo) {
                        // Small delay to ensure menu is fully rendered
                        setTimeout(() => injectMoveToProjectOption(menu), 50);
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    };

    // ===== Render UI =====
    const renderUI = () => {
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
            showModal("Create Project", "Project name", addProject);
        });

        if (projects.length === 0) {
            projectsList.innerHTML = `<li class="gcm-empty">No projects yet. Click "+ Add" to create one.</li>`;
        } else {
            projects.forEach((project) => {
                const chats = getChatsForProject(project.id);

                const li = document.createElement("li");
                li.classList.add("gcm-project");
                li.dataset.projectId = project.id;

                const header = document.createElement("div");
                header.classList.add("gcm-project-header");

                header.appendChild(createProjectIcon());

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
                    showContextMenu(e.clientX, e.clientY, [
                        {
                            label: "Rename",
                            action: () =>
                                showModal("Rename Project", "New name", (name) => renameProject(project.id, name), project.name),
                        },
                        {
                            label: "Delete",
                            danger: true,
                            action: () => {
                                if (confirm(`Delete "${project.name}"? Chats will not be deleted.`)) {
                                    deleteProject(project.id);
                                }
                            },
                        },
                    ]);
                });
                header.appendChild(menuBtn);

                header.addEventListener("click", () => {
                    li.classList.toggle("expanded");
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
                        if (chat.id === currentChatId) {
                            chatLi.classList.add("active");
                        }

                        const titleSpan = document.createElement("span");
                        titleSpan.classList.add("gcm-chat-title");
                        titleSpan.textContent = chat.title;
                        chatLi.appendChild(titleSpan);

                        chatLi.addEventListener("click", () => {
                            window.location.href = `/app/${chat.id}`;
                        });

                        chatLi.addEventListener("contextmenu", (e) => {
                            e.preventDefault();
                            showContextMenu(e.clientX, e.clientY, [
                                {
                                    label: "Remove from Project",
                                    danger: true,
                                    action: () => removeChatFromProject(chat.id),
                                },
                            ]);
                        });

                        chatsUl.appendChild(chatLi);
                    });
                }

                li.appendChild(chatsUl);
                projectsList.appendChild(li);
            });
        }

        // Hide chats that are already in projects
        setTimeout(hideAllMappedChats, 100);
    };

    // ===== Initialize =====
    const init = async () => {
        await loadData();

        // Start tracking menu clicks
        trackChatMenuClicks();
        watchForNativeMenu();

        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            const convList = getConversationsList();

            if (convList || attempts > 60) {
                clearInterval(interval);

                if (convList) {
                    renderUI();

                    // Watch for changes
                    const observer = new MutationObserver(() => {
                        if (!containerInjected || !document.getElementById("gcm-container")) {
                            renderUI();
                        }
                        hideAllMappedChats();
                    });

                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                    });
                }
            }
        }, 200);
    };

    init();
})();
