// ============================================================
//  app.js — ProZone Realty Project Dashboard
//  All dashboard logic: render, submit, filter, real-time sync
// ============================================================

// ---- Constants ----
const PROJECT_ICONS = {
  "Bandra Residences": "🏙️",
  "Worli Skyline":     "🌆",
  "Andheri Heights":   "🏗️",
  "Juhu Marina":       "🌊",
  "Powai Greens":      "🌿",
};
const DEFAULT_ICON = "🏢";
const COLLECTION   = "project_updates";
const NEW_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes = "new"

// ---- State ----
let allProjects   = [];   // Latest entry per project
let activityLog   = [];   // All entries (sorted by time desc)
let currentFilter = "all";
let currentSearch = "";

// ---- DOM refs ----
const grid          = document.getElementById("projects-grid");
const emptyState    = document.getElementById("empty-state");
const actList       = document.getElementById("activity-list");
const actCount      = document.getElementById("activity-count");
const modalOverlay  = document.getElementById("modal-overlay");

// ---- Init ----
document.addEventListener("DOMContentLoaded", () => {
  onFirebaseReady((err) => {
    if (err || window._firebaseError) {
      showConfigError();
      return;
    }
    startRealtimeSync();
    setupCharCount();
  });
});

// ---- Real-time Firestore listener ----
function startRealtimeSync() {
  db.collection(COLLECTION)
    .orderBy("timestamp", "desc")
    .onSnapshot((snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      processData(docs);
    }, (err) => {
      console.error("Firestore error:", err);
      showToast("⚠️ Could not connect to database. Check Firebase config.");
    });
}

// ---- Process incoming data ----
function processData(docs) {
  activityLog = docs;

  // Build latest-update-per-project map
  const projectMap = {};
  docs.forEach(doc => {
    if (!projectMap[doc.project]) {
      projectMap[doc.project] = doc;
    }
  });

  // Also collect history per project
  const historyMap = {};
  docs.forEach(doc => {
    if (!historyMap[doc.project]) historyMap[doc.project] = [];
    historyMap[doc.project].push(doc);
  });

  allProjects = Object.values(projectMap).map(p => ({
    ...p,
    history: historyMap[p.project] || []
  }));

  renderDashboard();
  renderActivity();
  updateStats();
}

// ---- Render project cards ----
function renderDashboard() {
  let filtered = allProjects;

  if (currentFilter !== "all") {
    filtered = filtered.filter(p => p.status === currentFilter);
  }
  if (currentSearch.trim()) {
    const q = currentSearch.toLowerCase();
    filtered = filtered.filter(p =>
      p.project.toLowerCase().includes(q) ||
      (p.update || "").toLowerCase().includes(q) ||
      (p.updatedBy || "").toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  // Sort: most recent first
  filtered.sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp));

  grid.innerHTML = filtered.map((p, i) => buildCard(p, i)).join("");
}

function buildCard(p, i) {
  const statusClass = "status-" + p.status.replace(/\s+/g, "-");
  const icon        = PROJECT_ICONS[p.project] || DEFAULT_ICON;
  const timeAgo     = getTimeAgo(p.timestamp);
  const isNew       = (Date.now() - toMs(p.timestamp)) < NEW_THRESHOLD_MS;
  const initials    = getInitials(p.updatedBy || "?");
  const hasHistory  = p.history && p.history.length > 1;

  const statusDot = p.status === "On Track" ? "🟢" : p.status === "Delayed" ? "🔴" : "🔵";

  let historyHTML = "";
  if (hasHistory) {
    const older = p.history.slice(1, 6); // up to 5 older entries
    historyHTML = `
      <button class="card-history-btn" onclick="toggleHistory(this)">
        🕐 ${older.length} older update${older.length > 1 ? "s" : ""}
      </button>
      <div class="card-history">
        ${older.map(h => `
          <div class="history-item">
            <strong>${escHtml(h.updatedBy || "Unknown")}</strong> —
            ${escHtml(h.update || "")}
            <div class="act-time">${getTimeAgo(h.timestamp)}</div>
          </div>
        `).join("")}
      </div>`;
  }

  return `
    <div class="project-card ${statusClass} ${isNew ? "is-new" : ""}" style="animation-delay:${i * 0.05}s">
      <div class="card-top">
        <div class="card-icon">${icon}</div>
        <div class="card-title-wrap">
          <div class="card-name">${escHtml(p.project)}</div>
          <span class="card-status-badge">${statusDot} ${escHtml(p.status)}</span>
        </div>
      </div>
      <p class="card-update">${escHtml(p.update || "No update yet")}</p>
      <div class="card-meta">
        <div class="card-who">
          <div class="card-avatar">${initials}</div>
          ${escHtml(p.updatedBy || "Unknown")}
        </div>
        <div class="card-time" title="${formatFull(p.timestamp)}">${timeAgo}</div>
      </div>
      ${historyHTML}
    </div>`;
}

// ---- Toggle history ----
function toggleHistory(btn) {
  const hist = btn.nextElementSibling;
  hist.classList.toggle("open");
  btn.textContent = hist.classList.contains("open") ? "▲ Hide history" : btn.textContent.replace("▲ Hide history", "🕐 " + btn.textContent.replace(/^[^\d]*/, "").trim());
  if (hist.classList.contains("open")) btn.textContent = "▲ Hide history";
}

// ---- Render activity sidebar ----
function renderActivity() {
  if (activityLog.length === 0) {
    actList.innerHTML = `<li class="activity-empty">No activity yet</li>`;
    actCount.textContent = "0";
    return;
  }

  actCount.textContent = activityLog.length;
  const top = activityLog.slice(0, 50);

  actList.innerHTML = top.map(a => {
    const dotClass = (a.status || "").replace(/\s+/g, "-");
    return `<li class="activity-item">
      <div class="act-project">
        <span class="act-dot ${dotClass}"></span>
        ${escHtml(a.project)}
      </div>
      <div class="act-update">${escHtml(a.update || "")}</div>
      <div class="act-time">by ${escHtml(a.updatedBy || "?")} · ${getTimeAgo(a.timestamp)}</div>
    </li>`;
  }).join("");
}

// ---- Update stats bar ----
function updateStats() {
  document.getElementById("count-total").textContent    = allProjects.length;
  document.getElementById("count-ontrack").textContent  = allProjects.filter(p => p.status === "On Track").length;
  document.getElementById("count-delayed").textContent  = allProjects.filter(p => p.status === "Delayed").length;
  document.getElementById("count-completed").textContent = allProjects.filter(p => p.status === "Completed").length;
}

// ---- Filter ----
function filterCards(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderDashboard();
}

// ---- Search ----
function searchCards(val) {
  currentSearch = val;
  renderDashboard();
}

// ---- Modal ----
function openModal() {
  modalOverlay.classList.add("open");
  document.getElementById("f-project").focus();
}
function closeModal() {
  modalOverlay.classList.remove("open");
}
function closeModalOutside(e) {
  if (e.target === modalOverlay) closeModal();
}

// ---- Form: char count ----
function setupCharCount() {
  const ta  = document.getElementById("f-update");
  const cc  = document.getElementById("char-count");
  ta.addEventListener("input", () => {
    cc.textContent = `${ta.value.length} / 300`;
  });
}

// ---- Submit update ----
async function submitUpdate(e) {
  e.preventDefault();

  const project   = document.getElementById("f-project").value.trim();
  const statusEl  = document.querySelector('input[name="status"]:checked');
  const update    = document.getElementById("f-update").value.trim();
  const updatedBy = document.getElementById("f-name").value.trim();

  if (!project || !statusEl || !update || !updatedBy) {
    showToast("⚠️ Please fill in all fields.");
    return;
  }

  const btn = document.getElementById("submit-btn");
  btn.disabled    = true;
  btn.textContent = "Posting…";

  try {
    await db.collection(COLLECTION).add({
      project,
      status:    statusEl.value,
      update,
      updatedBy,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    e.target.reset();
    document.getElementById("char-count").textContent = "0 / 300";
    closeModal();
    showToast("✅ Update posted successfully!");
  } catch (err) {
    console.error("Write error:", err);
    showToast("❌ Failed to post. Check your Firestore rules.");
  } finally {
    btn.disabled    = false;
    btn.textContent = "Post Update";
  }
}

// ---- Toast notification ----
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3200);
}

// ---- Config error banner ----
function showConfigError() {
  document.body.insertAdjacentHTML("afterbegin", `
    <div style="
      background:#fef3cd;border-bottom:2px solid #f6c90e;
      padding:14px 24px;text-align:center;font-size:14px;
      font-family:'DM Sans',sans-serif;z-index:9999;position:relative;">
      ⚙️ <strong>Firebase not configured.</strong>
      Open <code>firebase.js</code> and paste your Firebase config.
      See <strong>README.md</strong> for step-by-step instructions.
    </div>`);

  // Show demo data so the UI is still useful
  loadDemoData();
}

// ---- Demo data (shown when Firebase isn't configured) ----
function loadDemoData() {
  const now = Date.now();
  const demo = [
    { id:"d1", project:"Bandra Residences", status:"On Track",   update:"Foundation work complete. Structural columns in progress for floors 3–6.", updatedBy:"Rahul Sharma",   timestamp: { toDate: () => new Date(now - 5*60*1000)    }, history:[] },
    { id:"d2", project:"Worli Skyline",     status:"Delayed",    update:"Crane breakdown causing 2-week delay. Procurement team contacted supplier.", updatedBy:"Priya Mehta",    timestamp: { toDate: () => new Date(now - 2*3600*1000)  }, history:[] },
    { id:"d3", project:"Andheri Heights",   status:"Completed",  update:"All OC documents submitted. Possession ceremony scheduled for June 15.",   updatedBy:"Suresh Nair",    timestamp: { toDate: () => new Date(now - 24*3600*1000) }, history:[] },
    { id:"d4", project:"Juhu Marina",       status:"On Track",   update:"Plumbing and electrical rough-in done on floors 1–4. Tiles arriving Monday.", updatedBy:"Anita Desai",   timestamp: { toDate: () => new Date(now - 3*3600*1000)  }, history:[] },
    { id:"d5", project:"Powai Greens",      status:"Delayed",    update:"RERA amendment approval pending. Legal team expects resolution by month-end.", updatedBy:"Vikram Joshi",  timestamp: { toDate: () => new Date(now - 6*3600*1000)  }, history:[] },
  ];

  allProjects = demo.map(d => ({
    ...d,
    timestamp: d.timestamp // Already date-like
  }));
  activityLog = [...demo];
  renderDashboard();
  renderActivity();
  updateStats();
}

// ---- Helpers ----
function toMs(ts) {
  if (!ts) return 0;
  if (ts.toDate) return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

function getTimeAgo(ts) {
  const ms  = Date.now() - toMs(ts);
  const sec = Math.floor(ms / 1000);
  if (sec < 60)  return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60)  return `${min}m ago`;
  const hr  = Math.floor(min / 60);
  if (hr  < 24)  return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function formatFull(ts) {
  const d = ts && ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
  if (!d) return "";
  return d.toLocaleString("en-IN", { dateStyle:"medium", timeStyle:"short" });
}

function getInitials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

// Auto-refresh time labels every minute
setInterval(() => {
  document.querySelectorAll(".card-time").forEach(el => {
    // Labels re-render on next snapshot; this is just a cosmetic refresh
  });
}, 60 * 1000);
