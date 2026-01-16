/**
 * Native Menu module - Inject "Move to Project" into Gemini's native menu
 */

import { getProjects, getLastClickedChat, setLastClickedChat, getChatMappings } from "./state.js";
import { moveChatToProject, removeChatFromProject, extractChatIdFromContainer } from "./chats.js";
import { renderProjectList } from "./ui/projectList.js";

const MOVE_TO_PROJECT_ID = "gcm-move-to-project-item";

const injectMoveToProjectOption = (menu) => {
    // Check if already injected
    if (menu.querySelector(`#${MOVE_TO_PROJECT_ID}`)) return;

    const projects = getProjects();
    const lastClickedChat = getLastClickedChat();
    const chatMappings = getChatMappings();

    if (!lastClickedChat) return;

    // Find menu items
    const menuItems = menu.querySelectorAll('[role="menuitem"], .mat-mdc-menu-item, button.mdc-list-item');
    if (menuItems.length === 0) return;

    // Verify this is a chat menu by checking for chat-specific options
    const menuText = Array.from(menuItems).map(i => i.textContent?.toLowerCase() || '').join(' ');
    const isChatMenu = menuText.includes('delete') || menuText.includes('share') || menuText.includes('pin') || menuText.includes('rename');
    if (!isChatMenu) return;

    // Check if this chat is already in a project
    const existingProjectId = chatMappings[lastClickedChat.id]?.projectId;
    const isInProject = !!existingProjectId;

    const lastItem = menuItems[menuItems.length - 1];

    // Create menu item
    const moveItem = document.createElement("button");
    moveItem.id = MOVE_TO_PROJECT_ID;
    moveItem.setAttribute("role", "menuitem");
    moveItem.className = "mat-mdc-menu-item mat-mdc-focus-indicator mdc-list-item gcm-move-item";
    moveItem.style.cssText = `
    position: relative;
    padding: 0 16px;
    height: 48px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: ${isInProject ? '#f28b82' : '#e3e3e3'};
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    font-family: inherit;
  `;

    // Folder icon
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "20");
    icon.setAttribute("height", "20");
    icon.style.fill = isInProject ? '#f28b82' : '#e3e3e3';
    icon.innerHTML = `<path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>`;

    const label = document.createElement("span");
    label.textContent = isInProject ? "Remove from Project" : "Move to Project";
    label.style.flex = "1";

    moveItem.appendChild(icon);
    moveItem.appendChild(label);

    // If chat is in project, show Remove option (no submenu)
    if (isInProject) {
        moveItem.addEventListener("click", (e) => {
            e.stopPropagation();
            removeChatFromProject(lastClickedChat.id, renderProjectList);
            document.body.click();
        });

        moveItem.addEventListener("mouseenter", () => {
            moveItem.style.background = "rgba(255, 255, 255, 0.08)";
        });
        moveItem.addEventListener("mouseleave", () => {
            moveItem.style.background = "";
        });
    } else {
        // Show arrow for submenu
        const arrow = document.createElement("span");
        arrow.textContent = "›";
        arrow.style.cssText = "font-size: 16px; color: #9aa0a6;";
        moveItem.appendChild(arrow);

        // Create submenu
        const submenu = document.createElement("div");
        submenu.classList.add("gcm-native-submenu");
        submenu.style.cssText = `
      position: fixed;
      background: #202124;
      border-radius: 4px;
      padding: 0;
      min-width: 160px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 4px 8px 3px rgba(0,0,0,0.15);
      display: none;
      z-index: 10002;
      font-family: "Google Sans", Roboto, sans-serif;
      overflow: hidden;
    `;

        if (projects.length === 0) {
            const noProjects = document.createElement("div");
            noProjects.style.cssText = `padding: 12px 16px; color: #9aa0a6; font-size: 14px;`;
            noProjects.textContent = "No projects yet";
            submenu.appendChild(noProjects);
        } else {
            projects.forEach((project) => {
                const projectItem = document.createElement("div");
                projectItem.style.cssText = `
          padding: 12px 16px;
          cursor: pointer;
          font-size: 14px;
          color: #e8eaed;
          font-family: "Google Sans", Roboto, sans-serif;
          transition: background 0.1s;
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
                    if (lastClickedChat) {
                        moveChatToProject(lastClickedChat.id, lastClickedChat.title, project.id, renderProjectList);
                        // Close all menus - remove submenu first
                        submenu.remove();
                        // Close native Gemini menu by pressing Escape
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
                        // Also try clicking the overlay backdrop to close
                        const backdrop = document.querySelector('.cdk-overlay-backdrop');
                        if (backdrop) backdrop.click();
                        // Force close any remaining menu panels
                        document.querySelectorAll('.mat-mdc-menu-panel').forEach(panel => {
                            panel.remove();
                        });
                        document.querySelectorAll('.cdk-overlay-pane').forEach(pane => {
                            if (pane.querySelector('.mat-mdc-menu-panel')) {
                                pane.remove();
                            }
                        });
                    }
                });

                submenu.appendChild(projectItem);
            });
        }

        document.body.appendChild(submenu);

        // Position submenu on hover
        moveItem.addEventListener("mouseenter", () => {
            moveItem.style.background = "rgba(255, 255, 255, 0.08)";
            const rect = moveItem.getBoundingClientRect();
            submenu.style.left = `${rect.right}px`;
            submenu.style.top = `${rect.top}px`;
            submenu.style.display = "block";

            const submenuRect = submenu.getBoundingClientRect();
            if (submenuRect.right > window.innerWidth) {
                submenu.style.left = `${rect.left - submenuRect.width}px`;
            }
            if (submenuRect.bottom > window.innerHeight) {
                submenu.style.top = `${window.innerHeight - submenuRect.height - 8}px`;
            }
        });

        moveItem.addEventListener("mouseleave", (e) => {
            const toElement = e.relatedTarget;
            if (submenu.contains(toElement)) return;
            moveItem.style.background = "";
            submenu.style.display = "none";
        });

        submenu.addEventListener("mouseleave", () => {
            moveItem.style.background = "";
            submenu.style.display = "none";
        });

        // Clean up submenu when menu closes
        const cleanup = () => {
            if (!document.body.contains(menu)) {
                submenu.remove();
                document.removeEventListener("click", cleanup);
            }
        };
        setTimeout(() => document.addEventListener("click", cleanup), 100);
    }

    // Insert before "Delete"
    if (lastItem && lastItem.parentElement) {
        lastItem.parentElement.insertBefore(moveItem, lastItem);
    }
};

// Track which chat's menu was clicked
export const trackChatMenuClicks = () => {
    // Invalid titles that should be rejected (UI elements, not chat titles)
    const INVALID_TITLES = ['projects', 'chats', 'gemini', 'recent', 'starred', 'untitled'];

    document.addEventListener("click", (e) => {
        const menuBtn = e.target.closest('.conversation-actions-menu-button') ||
            e.target.closest('[data-test-id="actions-menu-button"]') ||
            e.target.closest('button[aria-haspopup="menu"]');

        if (menuBtn) {
            const conversationContainer = menuBtn.closest('.conversation-items-container');
            console.log('[GCM DEBUG] Menu button clicked, conversationContainer:', conversationContainer);

            if (conversationContainer) {
                const titleEl = conversationContainer.querySelector('.conversation-title');
                const title = titleEl?.textContent?.trim() || "Untitled Chat";
                const chatId = extractChatIdFromContainer(conversationContainer);
                console.log('[GCM DEBUG] Extracted chat info:', { chatId, title, titleEl });

                // Validate both chatId and title
                const isValidTitle = title && !INVALID_TITLES.includes(title.toLowerCase());

                if (chatId && isValidTitle) {
                    setLastClickedChat({ id: chatId, title });
                } else {
                    console.log('[GCM DEBUG] Invalid chat info, not setting lastClickedChat:', { chatId, title, isValidTitle });
                }
            }
        }
    }, true);
};

// Watch for native menu to appear
export const watchForNativeMenu = () => {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;

                const isOverlayPane = node.classList?.contains("cdk-overlay-pane");
                const menuPanel = isOverlayPane ? node.querySelector(".mat-mdc-menu-panel") : null;
                const isMenuPanel = node.classList?.contains("mat-mdc-menu-panel");
                const menu = menuPanel || (isMenuPanel ? node : null);

                if (menu && getLastClickedChat()) {
                    setTimeout(() => injectMoveToProjectOption(menu), 50);
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
};
