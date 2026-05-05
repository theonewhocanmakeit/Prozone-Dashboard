// ============================================================
//  app.js — ProZone Realty Dashboard (v2)
//  Features: edit status, completed history, sub-projects,
//             project slicer, type-or-select project name
// ============================================================

const COLLECTION = "project_updates";
const NEW_THRESHOLD_MS = 10 * 60 * 1000;

const PROJECT_ICONS = {
  "Bandra Residences":"🏙️","Worli Skyline":"🌆",
  "Andheri Heights":"🏗️","Juhu Marina":"🌊","Powai Greens":"🌿"
};

// ---- State ----
let allDocs        = [];   // raw docs from Firestore
let activeProject  = "all";
let activeSubProject = "all";
let activeStatus   = "all";
let currentSearch  = "";

// ---- Init ----
document.addEventListener("DOMContentLoaded", () => {
  onFirebaseReady((err) => {
    if (err || window._firebaseError) { showConfigError(); return; }
    startRealtimeSync();
    setupCharCount();
    setupProjectAutofill();
  });
});

// ---- Real-time sync ----
function startRealtimeSync() {
  db.collection(COLLECTION)
    .orderBy("timestamp", "desc")
    .onSnapshot((snap) => {
      allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      rebuildAll();
    }, (err) => {
      console.error(err);
      showToast("⚠️ Cannot connect to database.");
    });
}

// ---- Master rebuild ----
function rebuildAll() {
  buildProjectSlicer();
  buildSubSlicer();
  renderCards();
  renderActivity();
  updateStats();
  renderCompletedHistory();
}

// ---- Project Slicer ----
function buildProjectSlicer() {
  const projects = [...new Set(allDocs.map(d => d.project).filter(Boolean))].sort();
  const container = document.getElementById("slicer-pills");
  container.innerHTML = `<button class="slicer-btn ${activeProject==='all'?'active':''}" onclick="sliceProject('all',this)">All</button>`;
  projects.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "slicer-btn" + (activeProject === p ? " active" : "");
    btn.textContent = (PROJECT_ICONS[p] || "🏢") + " " + p;
    btn.onclick = () => sliceProject(p, btn);
    container.appendChild(btn);
  });
}

function sliceProject(project, btn) {
  activeProject = project;
  activeSubProject = "all";
  document.querySelectorAll(".slicer-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  buildSubSlicer();
  renderCards();
}

// ---- Sub-Project Slicer ----
function buildSubSlicer() {
  const bar = document.getElementById("sub-slicer-bar");
  const container = document.getElementById("sub-slicer-pills");

  if (activeProject === "all") {
    bar.style.display = "none";
    return;
  }

  const subProjects = [...new Set(
    allDocs
      .filter(d => d.project === activeProject && d.subproject)
      .map(d => d.subproject)
  )].sort();

  if (subProjects.length === 0) {
    bar.style.display = "none";
    return;
  }

  bar.style.display = "flex";
  container.innerHTML = `<button class="slicer-btn ${activeSubProject==='all'?'sub-active':''}" onclick="sliceSubProject('all',this)">All Sub-projects</button>`;
  subProjects.forEach(sp => {
    const btn = document.createElement("button");
    btn.className = "slicer-btn" + (activeSubProject === sp ? " sub-active" : "");
    btn.textContent = sp;
    btn.onclick = () => sliceSubProject(sp, btn);
    container.appendChild(btn);
  });
}

function sliceSubProject(sp, btn) {
  activeSubProject = sp;
  document.querySelectorAll("#sub-slicer-pills .slicer-btn").forEach(b => b.classList.remove("sub-active"));
  btn.classList.add("sub-active");
  renderCards();
}

// ---- Filter by status ----
function filterStatus(status, btn) {
  activeStatus = status;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderCards();
}

// ---- Search ----
function searchCards(val) {
  currentSearch = val;
  renderCards();
}

// ---- Render Cards ----
function renderCards() {
  // Get latest entry per (project + subproject) combo
  const keyMap = {};
  const historyMap = {};

  allDocs.forEach(doc => {
    const key = doc.project + "|||" + (doc.subproject || "");
    if (!keyMap[key]) keyMap[key] = doc;
    if (!historyMap[key]) historyMap[key] = [];
    historyMap[key].push(doc);
  });

  let cards = Object.values(keyMap).map(d => ({
    ...d,
    history: historyMap[d.project + "|||" + (d.subproject || "")] || []
  }));

  // Apply project slicer
  if (activeProject !== "all") {
    cards = cards.filter(c => c.project === activeProject);
  }
  // Apply sub-project slicer
  if (activeSubProject !== "all") {
    cards = cards.filter(c => (c.subproject || "") === activeSubProject);
  }
  // Apply status filter (exclude completed from main view)
  if (activeStatus !== "all") {
    cards = cards.filter(c => c.status === activeStatus);
  } else {
    cards = cards.filter(c => c.status !== "Completed");
  }
  // Search
  if (currentSearch.trim()) {
    const q = currentSearch.toLowerCase();
    cards = cards.filter(c =>
      (c.project||"").toLowerCase().includes(q) ||
      (c.subproject||"").toLowerCase().includes(q) ||
      (c.update||"").toLowerCase().includes(q) ||
      (c.updatedBy||"").toLowerCase().includes(q)
    );
  }

  const grid = document.getElementById("projects-grid");
  const empty = document.getElementById("empty-state");

  if (cards.length === 0) {
    grid.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  cards.sort((a,b) => toMs(b.timestamp) - toMs(a.timestamp));
  grid.innerHTML = cards.map((c, i) => buildCard(c, i)).join("");
}

function buildCard(p, i) {
  const statusClass = "status-" + (p.status||"").replace(/\s+/g,"-");
  const icon = PROJECT_ICONS[p.project] || "🏢";
  const timeAgo = getTimeAgo(p.timestamp);
  const isNew = (Date.now() - toMs(p.timestamp)) < NEW_THRESHOLD_MS;
  const initials = getInitials(p.updatedBy || "?");
  const hasHistory = p.history && p.history.length > 1;
  const statusDot = p.status==="On Track"?"🟢":p.status==="Delayed"?"🔴":"🔵";

  let historyHTML = "";
  if (hasHistory) {
    const older = p.history.slice(1, 6);
    historyHTML = `
      <button class="card-history-btn" onclick="toggleHistory(this)">🕐 ${older.length} older update${older.length>1?"s":""}</button>
      <div class="card-history">
        ${older.map(h=>`
          <div class="history-item">
            <strong>${esc(h.updatedBy||"?")}</strong>: ${esc(h.update||"")}
            <br/><span style="font-size:10px">${esc(h.status||"")} · ${getTimeAgo(h.timestamp)}</span>
          </div>`).join("")}
      </div>`;
  }

  return `
    <div class="project-card ${statusClass} ${isNew?"is-new":""}" style="animation-delay:${i*0.05}s">
      <div class="card-top">
        <div class="card-icon">${icon}</div>
        <div class="card-title-wrap">
          <div class="card-name">${esc(p.project)}</div>
          ${p.subproject ? `<div class="card-subname">📌 ${esc(p.subproject)}</div>` : ""}
          <span class="card-status-badge">${statusDot} ${esc(p.status)}</span>
        </div>
      </div>
      <p class="card-update">${esc(p.update||"No update yet")}</p>
      <div class="card-meta">
        <div class="card-who">
          <div class="card-avatar">${initials}</div>
          ${esc(p.updatedBy||"Unknown")}
        </div>
        <div class="card-time">${timeAgo}</div>
      </div>
      <div class="card-actions">
        <button class="btn-edit" onclick='openEditModal(${JSON.stringify(p)})'>✏️ Edit Status</button>
        ${hasHistory ? `<button class="card-history-btn" onclick="toggleHistory(this)">🕐 ${p.history.length-1} older</button>` : ""}
      </div>
      ${hasHistory ? `<div class="card-history">${p.history.slice(1,6).map(h=>`<div class="history-item"><strong>${esc(h.updatedBy||"?")}</strong>: ${esc(h.update||"")} <br/><span style="font-size:10px">${esc(h.status||"")} · ${getTimeAgo(h.timestamp)}</span></div>`).join("")}</div>` : ""}
    </div>`;
}

function toggleHistory(btn) {
  const hist = btn.nextElementSibling || btn.parentElement.querySelector(".card-history");
  if (!hist) return;
  hist.classList.toggle("open");
  btn.textContent = hist.classList.contains("open") ? "▲ Hide history" : `🕐 ${hist.querySelectorAll(".history-item").length} older`;
}

// ---- Activity Sidebar ----
function renderActivity() {
  const list = document.getElementById("activity-list");
  const count = document.getElementById("activity-count");
  if (allDocs.length === 0) {
    list.innerHTML = `<li class="activity-empty">No activity yet</li>`;
    count.textContent = "0";
    return;
  }
  count.textContent = allDocs.length;
  list.innerHTML = allDocs.slice(0,50).map(a => {
    const dotClass = (a.status||"").replace(/\s+/g,"-");
    return `<li class="activity-item">
      <div class="act-project"><span class="act-dot ${dotClass}"></span>${esc(a.project)}${a.subproject?` › ${esc(a.subproject)}`:""}</div>
      <div class="act-update">${esc(a.update||"")}</div>
      <div class="act-time">by ${esc(a.updatedBy||"?")} · ${getTimeAgo(a.timestamp)}</div>
    </li>`;
  }).join("");
}

// ---- Stats ----
function updateStats() {
  // latest per key
  const keyMap = {};
  allDocs.forEach(d => {
    const key = d.project + "|||" + (d.subproject||"");
    if (!keyMap[key]) keyMap[key] = d;
  });
  const latest = Object.values(keyMap);
  document.getElementById("count-total").textContent = latest.length;
  document.getElementById("count-ontrack").textContent = latest.filter(p=>p.status==="On Track").length;
  document.getElementById("count-delayed").textContent = latest.filter(p=>p.status==="Delayed").length;
  document.getElementById("count-completed").textContent = latest.filter(p=>p.status==="Completed").length;
}

// ---- Completed History Modal ----
function renderCompletedHistory() {
  const container = document.getElementById("history-list");
  // Group completed entries by project
  const completed = allDocs.filter(d => d.status === "Completed");
  if (completed.length === 0) {
    container.innerHTML = `<p class="no-history">No completed projects yet.</p>`;
    return;
  }
  const grouped = {};
  completed.forEach(d => {
    const key = d.project + (d.subproject ? " › " + d.subproject : "");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d);
  });
  container.innerHTML = Object.entries(grouped).map(([name, entries]) => `
    <div class="history-group">
      <div class="history-group-title">🔵 ${esc(name)}</div>
      ${entries.map(e => `
        <div class="history-entry">
          <div class="history-entry-note">${esc(e.update||"")}</div>
          <div class="history-entry-meta">
            <span>👤 ${esc(e.updatedBy||"?")}</span>
            <span>🕐 ${getTimeAgo(e.timestamp)}</span>
          </div>
        </div>`).join("")}
    </div>`).join("");
}

function openHistory() {
  document.getElementById("history-overlay").classList.add("open");
}
function closeHistory() {
  document.getElementById("history-overlay").classList.remove("open");
}
function closeHistoryOutside(e) {
  if (e.target === document.getElementById("history-overlay")) closeHistory();
}

// ---- ADD Modal ----
function openModal() {
  document.getElementById("modal-title").textContent = "Post a Project Update";
  document.getElementById("update-form").reset();
  document.getElementById("f-edit-id").value = "";
  document.getElementById("char-count").textContent = "0 / 300";
  document.getElementById("submit-btn").textContent = "Post Update";
  document.getElementById("modal-overlay").classList.add("open");
  document.getElementById("f-project").focus();
}

// ---- EDIT Modal ----
function openEditModal(p) {
  document.getElementById("modal-title").textContent = "Edit Project Status";
  document.getElementById("f-edit-id").value = p.id || "";
  document.getElementById("f-project").value = p.project || "";
  document.getElementById("f-subproject").value = p.subproject || "";
  document.getElementById("f-update").value = "";
  document.getElementById("f-name").value = p.updatedBy || "";
  document.getElementById("char-count").textContent = "0 / 300";
  document.getElementById("submit-btn").textContent = "Save Update";
  // Set status radio
  const radios = document.querySelectorAll('input[name="status"]');
  radios.forEach(r => { r.checked = r.value === p.status; });
  document.getElementById("modal-overlay").classList.add("open");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
}
function closeModalOutside(e) {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
}

// ---- Submit ----
async function submitUpdate(e) {
  e.preventDefault();
  const project    = document.getElementById("f-project").value.trim();
  const subproject = document.getElementById("f-subproject").value.trim();
  const statusEl   = document.querySelector('input[name="status"]:checked');
  const update     = document.getElementById("f-update").value.trim();
  const updatedBy  = document.getElementById("f-name").value.trim();

  if (!project || !statusEl || !update || !updatedBy) {
    showToast("⚠️ Please fill in all required fields.");
    return;
  }

  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    const payload = {
      project,
      subproject: subproject || null,
      status: statusEl.value,
      update,
      updatedBy,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection(COLLECTION).add(payload);

    // Update project datalist with new name
    addToDatalist("project-list", project);
    if (subproject) addToDatalist("subproject-list", subproject);

    closeModal();
    showToast("✅ Update posted successfully!");
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to save. Check your Firestore rules.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Post Update";
  }
}

// ---- Autofill datalists ----
function setupProjectAutofill() {
  const projectInput = document.getElementById("f-project");
  projectInput.addEventListener("change", () => {
    // Populate sub-project datalist based on chosen project
    const chosen = projectInput.value.trim();
    const subs = [...new Set(
      allDocs.filter(d => d.project === chosen && d.subproject).map(d => d.subproject)
    )];
    const dl = document.getElementById("subproject-list");
    dl.innerHTML = subs.map(s => `<option value="${esc(s)}"/>`).join("");
  });
}

function addToDatalist(id, value) {
  const dl = document.getElementById(id);
  const existing = [...dl.options].map(o => o.value);
  if (!existing.includes(value)) {
    const opt = document.createElement("option");
    opt.value = value;
    dl.appendChild(opt);
  }
}

// ---- Char count ----
function setupCharCount() {
  const ta = document.getElementById("f-update");
  const cc = document.getElementById("char-count");
  ta.addEventListener("input", () => { cc.textContent = `${ta.value.length} / 300`; });
}

// ---- Toast ----
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3200);
}

// ---- Config error ----
function showConfigError() {
  document.body.insertAdjacentHTML("afterbegin", `
    <div style="background:#fef3cd;border-bottom:2px solid #f6c90e;padding:14px 24px;text-align:center;font-size:14px;font-family:'DM Sans',sans-serif;z-index:9999;position:relative;">
      ⚙️ <strong>Firebase not configured.</strong> Open <code>firebase.js</code> and paste your config.
    </div>`);
  loadDemoData();
}

function loadDemoData() {
  const now = Date.now();
  allDocs = [
    {id:"d1",project:"Bandra Residences",subproject:"Tower A",status:"On Track",update:"Foundation complete. Moving to floors 3–6.",updatedBy:"Rahul Sharma",timestamp:{toDate:()=>new Date(now-5*60*1000)}},
    {id:"d2",project:"Bandra Residences",subproject:"Tower B",status:"Delayed",update:"Material delay. Expected next week.",updatedBy:"Priya Mehta",timestamp:{toDate:()=>new Date(now-2*3600*1000)}},
    {id:"d3",project:"Worli Skyline",subproject:"Phase 1",status:"On Track",update:"Structural work on schedule.",updatedBy:"Suresh Nair",timestamp:{toDate:()=>new Date(now-1*3600*1000)}},
    {id:"d4",project:"Andheri Heights",subproject:null,status:"Completed",update:"OC received. Possession on June 15.",updatedBy:"Anita Desai",timestamp:{toDate:()=>new Date(now-24*3600*1000)}},
    {id:"d5",project:"Juhu Marina",subproject:"Parking Block",status:"Delayed",update:"RERA amendment pending.",updatedBy:"Vikram Joshi",timestamp:{toDate:()=>new Date(now-6*3600*1000)}},
    {id:"d6",project:"Powai Greens",subproject:"Club House",status:"On Track",update:"Interior work started.",updatedBy:"Rahul Sharma",timestamp:{toDate:()=>new Date(now-30*60*1000)}},
  ];
  rebuildAll();
}

// ---- Helpers ----
function toMs(ts) {
  if (!ts) return 0;
  if (ts.toDate) return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  return 0;
}
function getTimeAgo(ts) {
  const ms = Date.now() - toMs(ts);
  const sec = Math.floor(ms/1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec/60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min/60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr/24)}d ago`;
}
function getInitials(name) {
  return name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
}
function esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
