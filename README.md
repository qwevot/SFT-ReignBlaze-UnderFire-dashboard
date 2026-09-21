# UnderFire — Portable Peatland Smoldering Detection & Telemetry System

### Prerequisites:
- **Node.js** installed on the computer ([Download Node.js LTS](https://nodejs.org/)).

---

### Method 1: Double-Click Launcher (Windows)
1. Double-click **`START_UNDERFIRE.bat`**.
2. It will automatically:
   - Install backend and frontend dependencies if not already present.
   - Build the frontend UI.
   - Launch the server and open your browser at **`http://localhost:5000`**.

---

### Method 2: Development Mode (with Live Hot-Reloading)
1. Double-click **`START_DEV_MODE.bat`**.
2. Opens the Vite hot-reloading dev environment at **`http://localhost:3000`**.

---

### Method 3: Manual Terminal Execution (Mac, Linux, or Windows)
Open your terminal in the root folder and run:
```bash
# 1. Install all dependencies
npm run install:all

# 2. Build the frontend UI
npm run build

# 3. Start the unified server
npm start
```
Then open your browser at: **`http://localhost:5000`**
