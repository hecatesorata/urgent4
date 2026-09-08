let activeFilter = "semua";
let chats = [];

const el = (id) => document.getElementById(id);

function levelLabel(l){ return { urgent:"Urgent", tinggi:"Tinggi", sedang:"Sedang", rendah:"Rendah" }[l] || l; }

function timeAgo(ts){
  const diffMin = Math.floor((Date.now()-ts)/60000);
  if(diffMin < 1) return "baru saja";
  if(diffMin < 60) return diffMin + " menit lalu";
  const diffH = Math.floor(diffMin/60);
  if(diffH < 24) return diffH + " jam lalu";
  return Math.floor(diffH/24) + " hari lalu";
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ---------- Status koneksi ----------
async function refreshStatus(){
  const res = await fetch("/api/status");
  const status = await res.json();
  applyStatus(status);
}

function applyStatus(status){
  const dot = el("conn-dot");
  const note = el("conn-note");
  const pairingView = el("view-pairing");
  const dashView = el("view-dashboard");

  if(status.connected){
    dot.className = "dot on";
    note.textContent = "Tersambung";
    pairingView.style.display = "none";
    dashView.style.display = "block";
    loadChats();
  } else {
    dashView.style.display = "none";
    pairingView.style.display = "block";
    if(status.pairingCode){
      dot.className = "dot pending";
      note.textContent = "Menunggu pairing di HP...";
      el("pairing-result").style.display = "block";
      el("pairing-code").textContent = status.pairingCode;
    } else {
      dot.className = "dot";
      note.textContent = status.lastConnectionNote || "Belum terhubung";
    }
    if(status.pairingError){
      el("pairing-error").textContent = status.pairingError;
    }
  }
}

el("btn-pair").addEventListener("click", async () => {
  const phone = el("in-phone").value.trim();
  if(!phone) return;
  el("pairing-error").textContent = "";
  el("btn-pair").textContent = "Mengirim...";
  try{
    const res = await fetch("/api/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: phone }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || "Gagal meminta kode");
    el("pairing-result").style.display = "block";
    el("pairing-code").textContent = data.code;
  }catch(err){
    el("pairing-error").textContent = err.message;
  }
  el("btn-pair").textContent = "Kirim Kode Pairing";
});

// ---------- Dashboard chat ----------
async function loadChats(){
  const res = await fetch("/api/chats");
  chats = await res.json();
  render();
}

function render(){
  const counts = { semua: chats.length, urgent:0, tinggi:0, sedang:0, rendah:0 };
  chats.forEach(c => counts[c.level] = (counts[c.level]||0) + 1);

  const defs = [["semua","Semua"],["urgent","Urgent"],["tinggi","Tinggi"],["sedang","Sedang"],["rendah","Rendah"]];
  el("filters").innerHTML = defs.map(([key,label]) =>
    `<div class="chip ${activeFilter===key?'active':''}" data-filter="${key}">${label} (${counts[key]||0})</div>`
  ).join("");
  el("filters").querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => { activeFilter = chip.dataset.filter; render(); });
  });

  let list = activeFilter === "semua" ? [...chats] : chats.filter(c => c.level === activeFilter);
  list.sort((a,b) => {
    if(!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    if(b.score !== a.score) return b.score - a.score;
    return b.ts - a.ts;
  });

  const listEl = el("list");
  if(list.length === 0){
    listEl.innerHTML = `<div class="empty">Belum ada chat masuk.<br>Chat yang masuk ke nomor bot akan otomatis muncul & tersortir di sini.</div>`;
    return;
  }

  listEl.innerHTML = list.map(c => `
    <div class="card ${c.level}" data-id="${c.id}">
      <div class="card-top">
        <div>
          <div class="who">${escapeHtml(c.name)}</div>
          <div class="phone">${escapeHtml(c.phone)} · ${escapeHtml(c.chatType)}</div>
        </div>
        <div class="badge ${c.level}">${levelLabel(c.level)}${c.pinned ? " · Dipin" : ""}</div>
      </div>
      <div class="msg">${escapeHtml(c.message)}</div>
      ${c.signals && c.signals.length ? `<div class="signals">${c.signals.map(s => `<div class="signal-tag">${escapeHtml(s)}</div>`).join("")}</div>` : ""}
      <div class="card-bottom">
        <div class="time">${timeAgo(c.ts)} · skor ${c.score}</div>
        <div class="actions">
          <button class="btn-pin ${c.pinned?'pinned':''}">${c.pinned ? "Lepas pin" : "Tandai urgent"}</button>
          <button class="btn-del">Hapus</button>
        </div>
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll(".card").forEach(card => {
    const id = card.dataset.id;
    card.querySelector(".btn-pin").addEventListener("click", () => togglePin(id));
    card.querySelector(".btn-del").addEventListener("click", () => deleteChat(id));
  });
}

async function togglePin(id){
  const c = chats.find(x => x.id === id);
  if(!c) return;
  const res = await fetch(`/api/chats/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned: !c.pinned }),
  });
  const updated = await res.json();
  Object.assign(c, updated);
  render();
}

async function deleteChat(id){
  await fetch(`/api/chats/${id}`, { method: "DELETE" });
  chats = chats.filter(x => x.id !== id);
  render();
}

// ---------- Pengaturan ----------
async function openSettings(){
  const res = await fetch("/api/settings");
  const s = await res.json();
  el("s-owner").value = s.ownerNumber || "";
  el("s-detect").checked = !!s.detectUrgency;
  el("s-notify").checked = !!s.notifyOnUrgent;
  el("s-minlevel").value = s.notifyMinLevel || "tinggi";
  el("settings-overlay").classList.add("open");
}

el("btn-settings").addEventListener("click", openSettings);
el("btn-close-settings").addEventListener("click", () => el("settings-overlay").classList.remove("open"));
el("settings-overlay").addEventListener("click", (e) => {
  if(e.target.id === "settings-overlay") el("settings-overlay").classList.remove("open");
});

el("btn-save-settings").addEventListener("click", async () => {
  const body = {
    ownerNumber: el("s-owner").value.replace(/[^0-9]/g, ""),
    detectUrgency: el("s-detect").checked,
    notifyOnUrgent: el("s-notify").checked,
    notifyMinLevel: el("s-minlevel").value,
  };
  await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  el("settings-overlay").classList.remove("open");
});

// ---------- Live update lewat Server-Sent Events ----------
function connectStream(){
  const stream = new EventSource("/api/stream");
  stream.addEventListener("status", (e) => applyStatus(JSON.parse(e.data)));
  stream.addEventListener("new-chat", (e) => {
    const entry = JSON.parse(e.data);
    chats.push(entry);
    render();
  });
  stream.onerror = () => { /* browser otomatis mencoba reconnect */ };
}

refreshStatus();
connectStream();
setInterval(refreshStatus, 15000);

// ---------- Install sebagai aplikasi (PWA) ----------
let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  el("btn-install").style.display = "block";
});

el("btn-install").addEventListener("click", async () => {
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  el("btn-install").style.display = "none";
});

window.addEventListener("appinstalled", () => {
  el("btn-install").style.display = "none";
});

if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

