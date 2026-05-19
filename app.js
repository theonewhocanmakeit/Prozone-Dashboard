// ProZone Realty Dashboard v4
const COLLECTION = "project_updates";
const ICONS = {"Bandra Residences":"🏙️","Worli Skyline":"🌆","Andheri Heights":"🏗️","Juhu Marina":"🌊","Powai Greens":"🌿"};

let allDocs = [];
let activeProject = "all";
let activeSubProject = "all";
let activeStatus = "all";
let activeDept = "all";
let activeSort = "newest";
let activeDateFilter = "all";
let currentSearch = "";
let currentView = "list";
let pendingDeps = [];
let pendingImages = [];
let expandedRows = new Set();

document.addEventListener("DOMContentLoaded", () => {
  onFirebaseReady((err) => {
    if (err || window._firebaseError) { showConfigError(); return; }
    startSync();
    setupCharCount();
    setupProjectInput();
  });
});

function startSync() {
  db.collection(COLLECTION).orderBy("timestamp","desc").onSnapshot(snap => {
    allDocs = snap.docs.map(d => ({id:d.id,...d.data()}));
    rebuildAll();
  }, err => { console.error(err); showToast("⚠️ Database connection error"); });
}

function rebuildAll() {
  buildSidenavProjects();
  buildSubProjectBar();
  renderView();
  updateStats();
  renderHistory();
}

// ── SIDENAV ──
function buildSidenavProjects() {
  const projects = [...new Set(allDocs.map(d=>d.project).filter(Boolean))].sort();
  const container = document.getElementById("sidenav-projects");
  const colors = ["#22c55e","#ef4444","#3b82f6","#f59e0b","#ec4899","#8b5cf6","#06b6d4","#f97316"];
  let html = `<button class="sidenav-item proj-item ${activeProject==='all'?'active':''}" onclick="selectProject('all',this)">
    <span class="proj-dot" style="background:#7c6ef7"></span>All Projects</button>`;
  projects.forEach((p,i) => {
    html += `<button class="sidenav-item proj-item ${activeProject===p?'active':''}" onclick="selectProject('${esc(p)}',this)">
      <span class="proj-dot" style="background:${colors[i%colors.length]}"></span>${esc(p)}</button>`;
  });
  container.innerHTML = html;
}

function selectProject(p, btn) {
  activeProject = p;
  activeSubProject = "all";
  document.getElementById("page-title").textContent = p==="all" ? "All Projects" : p;
  document.querySelectorAll(".sidenav-item.proj-item").forEach(b=>b.classList.remove("active"));
  if(btn) btn.classList.add("active");
  expandedRows.clear();
  buildSubProjectBar();
  renderView();
}

// ── SUB PROJECT BAR ──
function buildSubProjectBar() {
  const bar = document.getElementById("subproject-bar");
  if (activeProject==="all") { bar.style.display="none"; return; }
  const subs = [...new Set(allDocs.filter(d=>d.project===activeProject&&d.subproject).map(d=>d.subproject))].sort();
  if (!subs.length) { bar.style.display="none"; return; }
  bar.style.display="flex";
  document.getElementById("active-project-name").textContent = activeProject;
  const chips = document.getElementById("sub-chips");
  chips.innerHTML = `<button class="sub-chip ${activeSubProject==='all'?'active':''}" onclick="selectSub('all',this)">All</button>`;
  subs.forEach(s => {
    chips.innerHTML += `<button class="sub-chip ${activeSubProject===s?'active':''}" onclick="selectSub('${esc(s)}',this)">${esc(s)}</button>`;
  });
}

function selectSub(s, btn) {
  activeSubProject = s;
  document.querySelectorAll(".sub-chip").forEach(b=>b.classList.remove("active"));
  if(btn) btn.classList.add("active");
  renderView();
}

// ── FILTERS ──
function filterStatus(s, btn) {
  activeStatus = s;
  document.querySelectorAll(".filter-chip").forEach(b=>b.classList.remove("active"));
  if(btn) btn.classList.add("active");
  renderView();
}
function filterDept(d, btn) {
  activeDept = d;
  document.querySelectorAll(".dept-filter").forEach(b=>b.classList.remove("active"));
  if(btn) btn.classList.add("active");
  renderView();
}
function applySort(v) { activeSort=v; renderView(); }
function applyDateFilter(v) { activeDateFilter=v; renderView(); }
function searchCards(v) { currentSearch=v; renderView(); }
function setMobileNav(btn) {
  document.querySelectorAll(".mobile-nav-btn").forEach(b=>b.classList.remove("active"));
  if(btn) btn.classList.add("active");
}
function setView(v) {
  currentView = v;
  document.getElementById("list-view").style.display = v==="list"?"block":"none";
  document.getElementById("board-view").style.display = v==="board"?"block":"none";
  renderView();
}

// ── GET FILTERED ──
function getFiltered() {
  const keyMap={}, histMap={};
  allDocs.forEach(d=>{
    const key=d.project+"|||"+(d.subproject||"");
    if(!keyMap[key]) keyMap[key]=d;
    if(!histMap[key]) histMap[key]=[];
    histMap[key].push(d);
  });
  let cards=Object.values(keyMap).map(d=>({...d,history:histMap[d.project+"|||"+(d.subproject||"")]||[]}));

  if(activeProject!=="all") cards=cards.filter(c=>c.project===activeProject);
  if(activeSubProject!=="all") cards=cards.filter(c=>(c.subproject||"")===activeSubProject);
  if(activeStatus==="all") cards=cards.filter(c=>c.status!=="Completed");
  else cards=cards.filter(c=>c.status===activeStatus);
  if(activeDept!=="all") cards=cards.filter(c=>c.department===activeDept);

  const now=Date.now();
  if(activeDateFilter==="today") cards=cards.filter(c=>now-toMs(c.timestamp)<86400000);
  else if(activeDateFilter==="week") cards=cards.filter(c=>now-toMs(c.timestamp)<604800000);
  else if(activeDateFilter==="month") cards=cards.filter(c=>now-toMs(c.timestamp)<2592000000);

  if(currentSearch.trim()){
    const q=currentSearch.toLowerCase();
    cards=cards.filter(c=>(c.project||"").toLowerCase().includes(q)||(c.subproject||"").toLowerCase().includes(q)||(c.update||"").toLowerCase().includes(q)||(c.updatedBy||"").toLowerCase().includes(q));
  }

  if(activeSort==="newest") cards.sort((a,b)=>toMs(b.timestamp)-toMs(a.timestamp));
  else if(activeSort==="oldest") cards.sort((a,b)=>toMs(a.timestamp)-toMs(b.timestamp));
  else if(activeSort==="az") cards.sort((a,b)=>a.project.localeCompare(b.project));
  else if(activeSort==="za") cards.sort((a,b)=>b.project.localeCompare(a.project));

  return cards;
}

// ── RENDER ──
function renderView() {
  if(currentView==="list") renderList();
  else renderBoard();
}

function renderList() {
  const cards=getFiltered();
  const body=document.getElementById("list-body");
  const empty=document.getElementById("empty-state");
  if(!cards.length){body.innerHTML="";empty.style.display="block";return;}
  empty.style.display="none";
  body.innerHTML=cards.map((c,i)=>buildListRow(c,i)).join("");
  expandedRows.forEach(id=>{
    const el=document.getElementById("expand-"+id);
    if(el) el.style.display="block";
  });
}

function buildListRow(c, i) {
  const icon = ICONS[c.project]||"🏢";
  const deps = (c.dependencies&&c.dependencies.length)?c.dependencies:(c.history||[]).map(h=>h.dependencies||[]).find(d=>d.length)||[];
  const images = c.images||[];
  const hasExpand = c.history.length>1||images.length>0;
  const isExp = expandedRows.has(c.id);
  const sbClass = c.status==="On Track"?"sb-ontrack":c.status==="Delayed"?"sb-delayed":"sb-completed";
  const deptClass = (c.department||"").toLowerCase();
  const initials = getInitials(c.updatedBy||"?");
  const avColors = ["#6c47ff","#10b981","#ef4444","#f59e0b","#db2777","#7c3aed","#0891b2","#ea580c"];
  const avColor = avColors[c.updatedBy ? c.updatedBy.charCodeAt(0)%avColors.length : 0];

  return `
<div class="list-row${isExp?" expanded":""}" style="animation-delay:${i*0.04}s" id="row-${c.id}">
  <div class="lr-name"><span class="lr-icon">${icon}</span>${esc(c.project)}</div>
  <div class="lr-sub">${c.subproject?`<span class="lr-sub-badge">${esc(c.subproject)}</span>`:`<span style="color:var(--text4)">—</span>`}</div>
  <div class="lr-status-wrap">
    <span class="status-badge ${sbClass}">${c.status}</span>
    <span class="lr-update-txt">${esc(c.update||"—")}</span>
  </div>
  <div class="lr-dept-cell">${c.department?`<span class="dept-badge dept-${deptClass}">${esc(c.department)}</span>`:`<span style="color:var(--text4)">—</span>`}</div>
  <div>${formatDueDate(c.duedate)}</div>
  <div class="lr-dep-cell">${deps.length?deps.map(d=>`<div class="dep-item-inline"><span class="dep-bullet"></span>${esc(d)}</div>`).join(""):`<span style="color:var(--text4)">—</span>`}</div>
  <div class="lr-who-cell">
    <div class="av" style="background:${avColor}">${initials}</div>
    <div class="who-info">
      <span class="who-name">${esc(c.updatedBy||"?")}</span>
    </div>
  </div>
  <div class="lr-time-cell">${getTimeAgo(c.timestamp)}</div>
  <div class="row-actions">
    <button class="action-btn" onclick='openEditModal(${JSON.stringify({...c,history:undefined,images:undefined})})'>✏️ Edit</button>
    ${hasExpand?`<button class="action-btn" onclick="toggleExpand('${c.id}',this)">${isExp?"▲":"▼"}</button>`:""}
  </div>
</div>
<div class="list-row-expand" id="expand-${c.id}" style="display:${isExp?"block":"none"}">
  ${images.length?`<div class="expand-title">Attachments</div><div class="expand-images">${images.map(img=>`<img class="expand-img" src="${img}" onclick="openLightbox('${img}')" loading="lazy"/>`).join("")}</div>`:""}
  ${c.history.length>1?`<div class="expand-title">Update History</div><div class="hist-entries">${c.history.slice(1,6).map(h=>`<div class="hist-entry"><div class="hist-entry-top"><span class="status-badge ${h.status==="On Track"?"sb-ontrack":h.status==="Delayed"?"sb-delayed":"sb-completed"}" style="font-size:10px">${h.status}</span></div><div class="hist-entry-note">${esc(h.update||"")}</div><div class="hist-entry-meta">by ${esc(h.updatedBy||"?")} · ${getTimeAgo(h.timestamp)}</div></div>`).join("")}</div>`:""}
</div>`;
}

function toggleExpand(id,btn){
  const el=document.getElementById("expand-"+id);
  const row=document.getElementById("row-"+id);
  if(!el) return;
  const open=el.style.display==="block";
  el.style.display=open?"none":"block";
  if(row) row.classList.toggle("expanded",!open);
  if(btn) btn.textContent=open?"▼":"▲";
  if(open) expandedRows.delete(id); else expandedRows.add(id);
}

// ── BOARD ──
function renderBoard(){
  ["ontrack","delayed","completed"].forEach(k=>{document.getElementById("board-"+k).innerHTML="";});
  const cards=getFilteredForBoard();
  const ontrack=[],delayed=[],completed=[];
  cards.forEach(c=>{if(c.status==="On Track")ontrack.push(c);else if(c.status==="Delayed")delayed.push(c);else completed.push(c);});
  document.getElementById("board-count-ontrack").textContent=ontrack.length;
  document.getElementById("board-count-delayed").textContent=delayed.length;
  document.getElementById("board-count-completed").textContent=completed.length;
  document.getElementById("board-ontrack").innerHTML=ontrack.map(buildBoardCard).join("");
  document.getElementById("board-delayed").innerHTML=delayed.map(buildBoardCard).join("");
  document.getElementById("board-completed").innerHTML=completed.map(buildBoardCard).join("");
}

function getFilteredForBoard(){
  const keyMap={},histMap={};
  allDocs.forEach(d=>{const k=d.project+"|||"+(d.subproject||"");if(!keyMap[k])keyMap[k]=d;if(!histMap[k])histMap[k]=[];histMap[k].push(d);});
  let cards=Object.values(keyMap).map(d=>({...d,history:histMap[d.project+"|||"+(d.subproject||"")]||[]}));
  if(activeProject!=="all")cards=cards.filter(c=>c.project===activeProject);
  if(activeSubProject!=="all")cards=cards.filter(c=>(c.subproject||"")===activeSubProject);
  if(activeDept!=="all")cards=cards.filter(c=>c.department===activeDept);
  if(currentSearch.trim()){const q=currentSearch.toLowerCase();cards=cards.filter(c=>(c.project||"").toLowerCase().includes(q)||(c.update||"").toLowerCase().includes(q));}
  return cards;
}

function buildBoardCard(c){
  const initials=getInitials(c.updatedBy||"?");
  const deptClass=(c.department||"").toLowerCase();
  return `<div class="board-card">
    <div class="bc-name">${ICONS[c.project]||"🏢"} ${esc(c.project)}</div>
    ${c.subproject?`<div class="bc-sub">📌 ${esc(c.subproject)}</div>`:""}
    ${c.department?`<div class="bc-dept"><span class="dept-badge dept-${deptClass}">${esc(c.department)}</span></div>`:""}
    <div class="bc-update">${esc(c.update||"")}</div>
    <div class="bc-meta">
      <div class="bc-who"><div class="avatar" style="width:18px;height:18px;font-size:8px">${initials}</div>${esc(c.updatedBy||"?")}</div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="bc-time">${getTimeAgo(c.timestamp)}</span>
        <button class="bc-edit" onclick='openEditModal(${JSON.stringify({...c,history:undefined})})'>✏️</button>
      </div>
    </div>
  </div>`;
}

// ── STATS ──
function updateStats(){
  const keyMap={};
  allDocs.forEach(d=>{const k=d.project+"|||"+(d.subproject||"");if(!keyMap[k])keyMap[k]=d;});
  const latest=Object.values(keyMap);
  document.getElementById("count-total").textContent=latest.length;
  document.getElementById("count-ontrack").textContent=latest.filter(p=>p.status==="On Track").length;
  document.getElementById("count-delayed").textContent=latest.filter(p=>p.status==="Delayed").length;
  document.getElementById("count-completed").textContent=latest.filter(p=>p.status==="Completed").length;
}

// ── HISTORY ──
function renderHistory(){
  const container=document.getElementById("history-body");
  const completed=allDocs.filter(d=>d.status==="Completed");
  if(!completed.length){container.innerHTML=`<p class="no-data">No completed projects yet.</p>`;return;}
  const grouped={};
  completed.forEach(d=>{const k=d.project+(d.subproject?" › "+d.subproject:"");if(!grouped[k])grouped[k]=[];grouped[k].push(d);});
  container.innerHTML=Object.entries(grouped).map(([name,entries])=>`
    <div class="hist-group">
      <div class="hist-group-title">🔵 ${esc(name)}</div>
      ${entries.map(e=>`<div class="hist-completed-entry">
        <div class="note">${esc(e.update||"")}</div>
        <div class="meta"><span>👤 ${esc(e.updatedBy||"?")}</span><span>🕐 ${getTimeAgo(e.timestamp)}</span></div>
      </div>`).join("")}
    </div>`).join("");
}
function openHistory(){document.getElementById("history-overlay").classList.add("open");}
function closeHistory(){document.getElementById("history-overlay").classList.remove("open");}
function closeHistoryOutside(e){if(e.target===document.getElementById("history-overlay"))closeHistory();}

// ── MODAL ──
function openModal(){
  document.getElementById("modal-title").textContent="New Project Update";
  document.getElementById("update-form").reset();
  document.getElementById("f-edit-id").value="";
  document.getElementById("char-count").textContent="0 / 400";
  document.getElementById("submit-btn").textContent="Post Update";
  document.getElementById("f-duedate").value="";
  document.querySelectorAll('input[name="department"]').forEach(r=>r.checked=false);
  pendingDeps=[]; pendingImages=[];
  renderDepTags();
  document.getElementById("image-previews").innerHTML="";
  document.getElementById("modal-overlay").classList.add("open");
  document.getElementById("f-project").focus();
}
function openEditModal(p){
  document.getElementById("modal-title").textContent="Edit — "+p.project;
  document.getElementById("f-edit-id").value=p.id||"";
  document.getElementById("f-project").value=p.project||"";
  document.getElementById("f-subproject").value=p.subproject||"";
  document.getElementById("f-update").value="";
  document.getElementById("f-duedate").value=p.duedate||"";
  document.getElementById("f-name").value=p.updatedBy||"";
  document.getElementById("char-count").textContent="0 / 400";
  document.getElementById("submit-btn").textContent="Save Update";
  document.querySelectorAll('input[name="status"]').forEach(r=>{r.checked=r.value===p.status;});
  document.querySelectorAll('input[name="department"]').forEach(r=>{r.checked=r.value===p.department;});
  pendingDeps=[...(p.dependencies||[])]; pendingImages=[];
  renderDepTags();
  document.getElementById("image-previews").innerHTML="";
  document.getElementById("modal-overlay").classList.add("open");
}
function closeModal(){document.getElementById("modal-overlay").classList.remove("open");}
function closeModalOutside(e){if(e.target===document.getElementById("modal-overlay"))closeModal();}

// ── DEPENDENCIES ──
function addDependency(){
  const inp=document.getElementById("f-dep-input");
  const val=inp.value.trim();
  if(!val||pendingDeps.includes(val))return;
  pendingDeps.push(val); inp.value=""; renderDepTags();
  const dl=document.getElementById("dep-datalist");
  if(![...dl.options].map(o=>o.value).includes(val)){const o=document.createElement("option");o.value=val;dl.appendChild(o);}
}
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&document.activeElement.id==="f-dep-input"){e.preventDefault();addDependency();}});
function removeDep(i){pendingDeps.splice(i,1);renderDepTags();}
function renderDepTags(){
  document.getElementById("dep-tags").innerHTML=pendingDeps.map((d,i)=>`<span class="dep-tag">${esc(d)}<button onclick="removeDep(${i})">×</button></span>`).join("");
}

// ── IMAGES ──
function handleImages(input){
  [...input.files].forEach(file=>{
    const reader=new FileReader();
    reader.onload=e=>{pendingImages.push(e.target.result);renderPreviews();};
    reader.readAsDataURL(file);
  });
}
function removeImage(i){pendingImages.splice(i,1);renderPreviews();}
function renderPreviews(){
  document.getElementById("image-previews").innerHTML=pendingImages.map((img,i)=>`
    <div class="preview-wrap"><img class="preview-img" src="${img}"/>
    <button class="preview-remove" onclick="removeImage(${i})">×</button></div>`).join("");
}
function openLightbox(src){const lb=document.getElementById("lightbox");document.getElementById("lightbox-img").src=src;lb.style.display="flex";}
function closeLightbox(){document.getElementById("lightbox").style.display="none";}

// ── SUBMIT ──
async function submitUpdate(e){
  e.preventDefault();
  const project=document.getElementById("f-project").value.trim();
  const subproject=document.getElementById("f-subproject").value.trim();
  const statusEl=document.querySelector('input[name="status"]:checked');
  const deptEl=document.querySelector('input[name="department"]:checked');
  const update=document.getElementById("f-update").value.trim();
  const updatedBy=document.getElementById("f-name").value.trim();
  const duedate=document.getElementById("f-duedate").value||null;
  if(!project||!statusEl||!update||!updatedBy){showToast("⚠️ Fill in all required fields.");return;}
  const btn=document.getElementById("submit-btn");
  btn.disabled=true; btn.textContent="Saving…";
  try{
    await db.collection(COLLECTION).add({
      project, subproject:subproject||null,
      status:statusEl.value,
      department:deptEl?deptEl.value:null,
      update, updatedBy,
      dependencies:pendingDeps,
      images:pendingImages,
      duedate,
      timestamp:firebase.firestore.FieldValue.serverTimestamp()
    });
    addToDatalist("project-datalist",project);
    if(subproject)addToDatalist("subproject-datalist",subproject);
    closeModal(); showToast("✅ Update posted!");
  }catch(err){console.error(err);showToast("❌ Failed. Check Firestore rules.");}
  finally{btn.disabled=false;btn.textContent="Post Update";}
}

// ── SETUP ──
function setupProjectInput(){
  document.getElementById("f-project").addEventListener("change",function(){
    const chosen=this.value.trim();
    const subs=[...new Set(allDocs.filter(d=>d.project===chosen&&d.subproject).map(d=>d.subproject))];
    const dl=document.getElementById("subproject-datalist");
    dl.innerHTML=subs.map(s=>`<option value="${esc(s)}"/>`).join("");
  });
}
function setupCharCount(){
  const ta=document.getElementById("f-update"),cc=document.getElementById("char-count");
  ta.addEventListener("input",()=>{cc.textContent=`${ta.value.length} / 400`;});
}
function addToDatalist(id,value){
  const dl=document.getElementById(id);
  if(![...dl.options].map(o=>o.value).includes(value)){const o=document.createElement("option");o.value=value;dl.appendChild(o);}
}

// ── MICROPHONE ──
let micRecognition=null, micListening=false;
function toggleMic(){
  const btn=document.getElementById("mic-btn");
  const status=document.getElementById("mic-status");
  if(!("webkitSpeechRecognition" in window)&&!("SpeechRecognition" in window)){showToast("⚠️ Use Chrome for mic feature.");return;}
  if(micListening){micRecognition.stop();return;}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  micRecognition=new SR();
  micRecognition.lang="en-IN"; micRecognition.continuous=false; micRecognition.interimResults=true;
  micRecognition.onstart=()=>{micListening=true;btn.classList.add("listening");status.textContent="🎙️ Listening…";};
  micRecognition.onresult=(e)=>{
    const t=[...e.results].map(r=>r[0].transcript).join("");
    document.getElementById("f-update").value=t;
    document.getElementById("char-count").textContent=t.length+" / 400";
  };
  micRecognition.onend=()=>{micListening=false;btn.classList.remove("listening");status.textContent="";};
  micRecognition.onerror=(e)=>{micListening=false;btn.classList.remove("listening");status.textContent="";if(e.error!=="no-speech")showToast("⚠️ Mic error: "+e.error);};
  micRecognition.start();
}

// ── FORMAT DUE DATE ──
function formatDueDate(d){
  if(!d||d.trim()==="") return '<span style="color:var(--text3)">—</span>';
  const due=new Date(d+"T00:00:00");
  const now=new Date(); now.setHours(0,0,0,0);
  const diff=Math.round((due-now)/(1000*60*60*24));
  const label=due.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
  if(diff<0)   return `<span class="lr-due due-overdue">${label}</span>`;
  if(diff===0) return `<span class="lr-due due-soon">Today</span>`;
  if(diff<=7)  return `<span class="lr-due due-soon">${label}</span>`;
  return `<span class="lr-due due-ok">${label}</span>`;
}

// ── TOAST ──
function showToast(msg){
  const t=document.getElementById("toast");
  t.textContent=msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),3200);
}

// ── CONFIG ERROR / DEMO ──
function showConfigError(){
  document.body.insertAdjacentHTML("afterbegin",`<div style="background:#fef3cd;border-bottom:2px solid #f6c90e;padding:12px 24px;text-align:center;font-size:13px;font-family:Geist,sans-serif;">⚙️ <strong>Firebase not configured.</strong> Open firebase.js and paste your config.</div>`);
  const now=Date.now();
  allDocs=[
    {id:"d1",project:"Bandra Residences",subproject:"Tower A",status:"On Track",department:"Operations",update:"Foundation complete.",updatedBy:"Rahul Sharma",dependencies:["Material delivery"],images:[],duedate:"2025-06-15",timestamp:{toDate:()=>new Date(now-5*60*1000)}},
    {id:"d2",project:"Worli Skyline",subproject:"Phase 1",status:"Delayed",department:"Finance",update:"Budget approval pending.",updatedBy:"Priya Mehta",dependencies:["RERA approval"],images:[],duedate:"",timestamp:{toDate:()=>new Date(now-2*3600*1000)}},
    {id:"d3",project:"Andheri Heights",subproject:null,status:"Completed",department:"Sales",update:"OC received.",updatedBy:"Anita Desai",dependencies:[],images:[],duedate:"",timestamp:{toDate:()=>new Date(now-24*3600*1000)}},
  ];
  rebuildAll();
}

// ── HELPERS ──
function toMs(ts){if(!ts)return 0;if(ts.toDate)return ts.toDate().getTime();if(ts instanceof Date)return ts.getTime();return 0;}
function getTimeAgo(ts){const ms=Date.now()-toMs(ts),sec=Math.floor(ms/1000);if(sec<60)return"just now";const min=Math.floor(sec/60);if(min<60)return`${min}m ago`;const hr=Math.floor(min/60);if(hr<24)return`${hr}h ago`;return`${Math.floor(hr/24)}d ago`;}
function getInitials(name){return name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);}
function esc(str){return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
