/**
 * Context Menu UI component
 */

let activeContextMenu = null;

export const closeContextMenu = () => {
    if (activeContextMenu) {
        activeContextMenu.remove();
        activeContextMenu = null;
    }
};

export const showContextMenu = (x, y, items) => {
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

// Close menu when clicking outside
export const initContextMenuListener = () => {
    document.addEventListener("click", (e) => {
        if (activeContextMenu && !activeContextMenu.contains(e.target)) {
            closeContextMenu();
        }
    });
};
