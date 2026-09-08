/**
 * settingsStore.js
 * -----------------------------------------------
 * Pengaturan yang bisa diubah lewat dashboard (bukan lewat edit file),
 * disimpan persisten di data/settings.json.
 * -----------------------------------------------
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const DEFAULTS = {
  ownerNumber: '',           // nomor owner, format 62xxxxxxxxxx, tanpa +
  botNumber: '',             // nomor bot (opsional, diisi otomatis setelah pairing)
  notifyOnUrgent: true,      // kirim notifikasi WA ke owner saat ada pesan urgent
  notifyMinLevel: 'tinggi',  // level minimum yang memicu notifikasi: rendah|sedang|tinggi|urgent
  detectUrgency: true,       // aktifkan analisis urgensi otomatis
  logChats: true,            // simpan riwayat chat ke data/chats-log.json
};

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULTS, null, 2), 'utf-8');
  }
}

function getSettings() {
  ensureFile();
  try {
    const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    return { ...DEFAULTS, ...saved };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

function updateSettings(patch) {
  const current = getSettings();
  const next = { ...current, ...patch };
  ensureFile();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

module.exports = { getSettings, updateSettings };
