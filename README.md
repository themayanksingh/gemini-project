# Gemini Chat Manager

**Gemini Chat Manager** is a Chrome extension that helps you organize your Gemini chats into folders/projects, keeping your sidebar clean and efficient.

![Extension Icon](icons/icon128.png)

## 🚀 Key Features

- **📁 Project Folders**: Create, rename, and delete projects to group related chats.
- **🔄 Seamless Integration**: "Move to Project" option injected directly into Gemini's native chat menu.
- **💾 Persistent State**: Projects remember their expanded/collapsed state across page reloads.
- **⚡ High Performance**: Optimized rendering engine ensures no lag, even with hundreds of chats.
- **🎨 Compact UI**: Refined 36px row height with clean visual separation for maximum readability.
- **☁️ Cloud Sync**: Your organization syncs across all your devices via Chrome Storage.

## 🛠️ Installation

### 1. Build the Extension
```bash
# Install dependencies
npm install

# Build for production
npm run build
```

### 2. Load in Chrome
1. Open `chrome://extensions/`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the `Gemini Project` folder (the root directory of this repo).

## 💻 Development

Run in watch mode to automatically rebuild on file changes:
```bash
npm run dev
```

## 📖 Usage Guide

| Action | Instructions |
|--------|--------------|
| **Create Project** | Click the **+ Add** button at the top of the sidebar. |
| **Move Chat** | Click the three-dot menu (⋮) on any chat → Select **Move to Project** → Choose a folder. |
| **Expand/Collapse** | Click the arrow or project header. State is saved automatically. |
| **Manage Project** | Click the project menu (⋮) to **Rename**, **Delete**, or **Set Gem Icon**. |

## 🏗️ Architecture

The project is modularized for maintainability:

```text
src/
├── main.js           # Entry point & orchestration
├── storage.js        # Chrome storage persistence
├── state.js          # Shared state management
├── projects.js       # Project CRUD logic
├── chats.js          # Chat movement & optimization logic
├── nativeMenu.js     # Native Gemini UI injection
└── ui/
    ├── projectList.js # Sidebar rendering engine
    ├── modal.js      # Custom dialogs
    └── contextMenu.js # Custom context menus
```

## 📜 License

MIT
