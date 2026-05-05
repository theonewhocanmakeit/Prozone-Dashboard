// ============================================================
//  firebase.js — ProZone Realty Dashboard
//  Config already filled in — just save and use!
// ============================================================

const firebaseConfig = {
  apiKey:            "AIzaSyDWUlNgFD2zrUvCpj4Q6KNu6RjDnnnodp0",
  authDomain:        "prozone-project-tracker.firebaseapp.com",
  projectId:         "prozone-project-tracker",
  storageBucket:     "prozone-project-tracker.firebasestorage.app",
  messagingSenderId: "451882108769",
  appId:             "1:451882108769:web:f4d36e1cbda38371eba720"
};

// ---- Firebase SDK (loads automatically) ----
const _fbScripts = [
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"
];

let _loadedCount = 0;
let _firebaseReady = false;
let _onReadyCallbacks = [];

function onFirebaseReady(cb) {
  if (_firebaseReady) { cb(); return; }
  _onReadyCallbacks.push(cb);
}

_fbScripts.forEach(src => {
  const s = document.createElement("script");
  s.src = src;
  s.onload = () => {
    _loadedCount++;
    if (_loadedCount === _fbScripts.length) {
      try {
        firebase.initializeApp(firebaseConfig);
        window.db = firebase.firestore();
        _firebaseReady = true;
        _onReadyCallbacks.forEach(cb => cb());
      } catch (e) {
        console.error("Firebase init error:", e);
        window._firebaseError = e.message;
        _onReadyCallbacks.forEach(cb => cb(e));
      }
    }
  };
  s.onerror = () => {
    console.error("Failed to load Firebase SDK from:", src);
  };
  document.head.appendChild(s);
});
