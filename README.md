# 🏢 ProZone Realty — Project Status Dashboard

A real-time project status dashboard for ProZone Realty, built with Firebase Firestore + plain HTML/CSS/JS. Deploy as a static site on GitHub Pages — no server required.

---

## 📂 Project Structure

```
project-dashboard/
├── index.html    ← Main page (all UI)
├── style.css     ← All styling
├── app.js        ← Dashboard logic (render, submit, filter, sync)
├── firebase.js   ← Firebase config & SDK loader
└── README.md     ← This file
```

---

## ⚡ Step 1 — Create a Firebase Project (one-time setup)

1. Go to **[https://console.firebase.google.com](https://console.firebase.google.com)**
2. Click **"Add project"**
3. Enter a name like `prozone-dashboard` → click **Continue**
4. Disable Google Analytics (not needed) → click **Create project**
5. Click **Continue** when ready

---

## 🔥 Step 2 — Create a Firestore Database

1. In your Firebase project, click **"Firestore Database"** in the left sidebar
2. Click **"Create database"**
3. Choose **"Start in test mode"** (allows read/write for 30 days — good to start)
4. Select a location (e.g., `asia-south1` for Mumbai) → click **Enable**

> ⚠️ **After 30 days**, you'll need to update Firestore Rules (see Step 5 below).

---

## 🔑 Step 3 — Get Your Firebase Config

1. In Firebase console, click the **gear icon** → **"Project settings"**
2. Scroll down to **"Your apps"**
3. Click the **`</>`** (Web) icon to register a web app
4. Enter a nickname like `prozone-dashboard` → click **"Register app"**
5. You'll see a `firebaseConfig` object like this:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "prozone-dashboard.firebaseapp.com",
  projectId:         "prozone-dashboard",
  storageBucket:     "prozone-dashboard.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc123"
};
```

6. **Copy these exact values.**

---

## 📋 Step 4 — Paste Config into firebase.js

Open `firebase.js` and replace the placeholder values:

```js
// BEFORE (placeholder):
const firebaseConfig = {
  apiKey:            "PASTE_YOUR_API_KEY_HERE",
  ...
};

// AFTER (your real values):
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "prozone-dashboard.firebaseapp.com",
  projectId:         "prozone-dashboard",
  storageBucket:     "prozone-dashboard.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc123"
};
```

Save the file. That's it for config!

---

## 🔒 Step 5 — Firestore Security Rules (Important after 30 days)

In the Firebase console:
1. Go to **Firestore Database → Rules**
2. Replace the existing rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /project_updates/{document} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

3. Click **Publish**

> This allows anyone with the URL to read/write. Since there's no login, this is fine for internal team use. For extra security later, you can add IP-based rules or a simple password check.

---

## 💻 Step 6 — Run Locally

No build step needed. Just open the file:

**Option A — Double-click:**
- Double-click `index.html` to open it in your browser
- ⚠️ Some browsers block Firebase from `file://` URLs

**Option B — Use VS Code Live Server (recommended):**
1. Install [VS Code](https://code.visualstudio.com/)
2. Install the **"Live Server"** extension (by Ritwick Dey)
3. Right-click `index.html` → **"Open with Live Server"**
4. Dashboard opens at `http://127.0.0.1:5500`

**Option C — Python (if installed):**
```bash
cd project-dashboard
python3 -m http.server 8080
# Open http://localhost:8080
```

---

## 🚀 Step 7 — Deploy to GitHub Pages

### A. Create a GitHub account (if you don't have one)
Go to [https://github.com](https://github.com) and sign up.

### B. Create a new repository
1. Click the **+** icon (top right) → **"New repository"**
2. Name it: `prozone-dashboard` (or anything you like)
3. Set it to **Public**
4. Do NOT check "Initialize with README" (you already have files)
5. Click **"Create repository"**

### C. Upload your files
You have two options:

**Option 1 — Drag & Drop (easiest for beginners):**
1. On the new repo page, click **"uploading an existing file"**
2. Drag all 4 files (`index.html`, `style.css`, `app.js`, `firebase.js`) into the box
3. Click **"Commit changes"**

**Option 2 — Git (if you have Git installed):**
```bash
cd project-dashboard
git init
git add .
git commit -m "Initial commit: ProZone dashboard"
git remote add origin https://github.com/YOUR_USERNAME/prozone-dashboard.git
git push -u origin main
```

### D. Enable GitHub Pages
1. Go to your repo on GitHub
2. Click **Settings** (top tabs)
3. Click **Pages** (left sidebar, under "Code and automation")
4. Under **"Source"**, select **"Deploy from a branch"**
5. Choose branch: **main**, folder: **/ (root)**
6. Click **Save**

### E. Access your live dashboard
- After ~2 minutes, your dashboard will be live at:
  ```
  https://YOUR_USERNAME.github.io/prozone-dashboard/
  ```
- Share this URL with your team!

---

## ➕ Adding More Projects

To add a new project to the dropdown form:
1. Open `index.html`
2. Find the `<select id="f-project">` section
3. Add a new `<option>` line:
```html
<option>Your New Project Name</option>
```
4. Optionally add an icon in `app.js` in the `PROJECT_ICONS` object:
```js
"Your New Project Name": "🏛️",
```
5. Save & push to GitHub — live in seconds!

---

## 🎨 Features Overview

| Feature | Details |
|---|---|
| Real-time sync | Firestore `onSnapshot` listener — updates appear instantly |
| Color-coded status | 🟢 On Track, 🔴 Delayed, 🔵 Completed |
| "NEW" badge | Shown for updates posted in last 10 minutes |
| Time ago | "5m ago", "2h ago", "1d ago" — auto-refreshes |
| Activity log | Sidebar shows last 50 updates across all projects |
| Project history | Each card shows older updates (collapsible) |
| Filter & search | Filter by status, or search by project/name/update text |
| Demo mode | If Firebase not configured, shows sample data |
| Mobile friendly | Responsive layout for phones and tablets |

---

## 🆘 Troubleshooting

| Problem | Fix |
|---|---|
| Yellow banner "Firebase not configured" | Paste your config into `firebase.js` |
| "Failed to post" error | Check Firestore Rules (Step 5) — make sure writes are allowed |
| Dashboard shows old data | Hard-refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac) |
| GitHub Pages shows 404 | Wait 2–3 minutes after enabling Pages, then try again |
| Blank page locally | Use Live Server or Python http.server (not `file://` directly) |

---

## 📞 Need Help?

Contact your development team or refer to:
- [Firebase Docs](https://firebase.google.com/docs/firestore)
- [GitHub Pages Docs](https://docs.github.com/en/pages)
