// Popup script - loads stats from storage
document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.sync.get(["gcm_projects", "gcm_chat_mappings"], (result) => {
        const projects = result.gcm_projects || [];
        const chatMappings = result.gcm_chat_mappings || {};

        document.getElementById("project-count").textContent = projects.length;
        document.getElementById("chat-count").textContent = Object.keys(chatMappings).length;
    });
});
