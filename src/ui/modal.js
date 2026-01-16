/**
 * Modal UI component
 */

export const showModal = (title, placeholder, onConfirm, defaultValue = "") => {
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
