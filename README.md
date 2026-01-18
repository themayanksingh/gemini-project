# Gemini Chat Manager

A Chrome extension to organize your Gemini AI chats into folders. Stop scrolling through hundreds of chats — group them by project!

![Extension Icon](icons/icon48.png)

---

## ✨ What It Does

| Feature | Description |
|---------|-------------|
| **Folders** | Group related chats together |
| **Gem Support** | Link a Gem to a folder — click folder to open that Gem |
| **Multi-Account** | Each Google account has its own folders |
| **Synced** | Your folders sync across all your devices |

![Gemini Projects Screenshot](Gemini%20screenshot.png)

---

## � How to Install

**Step 1:** Download and build
```bash
git clone https://github.com/themayanksingh/gemini-project.git
cd gemini-project
npm install
npm run build
```

**Step 2:** Add to Chrome
1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the folder you just downloaded

**Step 3:** Open [gemini.google.com](https://gemini.google.com) — you'll see a new "Projects" section in the sidebar!

---

## 🎯 How to Use

1. **Create a folder:** Click the **+ Add** button
2. **Move a chat:** Click the ⋮ menu on any chat → **Move to Project**
3. **Link a Gem:** Click ⋮ on a folder → **Set Gem** → Choose your Gem
4. **Open folder:** Click to expand and see all chats inside

---

## 🛠️ For Developers

```bash
npm run dev   # Auto-rebuild on file changes
```

<details>
<summary>Project Structure</summary>

```
src/
├── main.js           # Entry point
├── account.js        # Google account detection
├── storage.js        # Chrome storage (per-account)
├── projects.js       # Folder CRUD
├── chats.js          # Chat management
└── ui/               # UI components
```

</details>

---

## 📜 License

MIT — Free to use, modify, and share.
