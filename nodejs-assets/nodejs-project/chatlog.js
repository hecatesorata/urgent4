/**
 * chatlog.js
 * -----------------------------------------------
 * Menyimpan riwayat pesan masuk beserta hasil analisis urgensinya
 * ke file JSON lokal (data/chats-log.json). Dipakai oleh dashboard
 * untuk menampilkan & menyortir daftar chat, dan mendukung
 * pin manual / hapus lewat aplikasi.
 * -----------------------------------------------
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const LOG_FILE = path.join(DATA_DIR, 'chats-log.json');
const MAX_ENTRIES = 500; // batasi biar file tidak membengkak

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '[]', 'utf-8');
}

function readLog() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function writeLog(entries) {
  ensureFile();
  fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

function makeId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/**
 * Menambahkan satu entri chat ke log.
 * data: { name, phone, chatType, message, score, level, signals, ts }
 * Return entri lengkap (dengan id) yang baru ditambahkan.
 */
function appendEntry(data) {
  const entries = readLog();
  const entry = { id: makeId(), pinned: false, ...data };
  entries.push(entry);
  writeLog(entries.slice(-MAX_ENTRIES));
  return entry;
}

/** Semua entri, urut: pinned dulu, lalu skor tertinggi, lalu terbaru. */
function getSorted(filterLevel) {
  let entries = readLog();
  if (filterLevel && filterLevel !== 'semua') {
    entries = entries.filter((e) => e.level === filterLevel);
  }
  return entries.sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return b.ts - a.ts;
  });
}

function getTopUrgent(limit = 5, sinceMs = 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - sinceMs;
  return getSorted().filter((e) => e.ts >= cutoff).slice(0, limit);
}

function updateEntry(id, patch) {
  const entries = readLog();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...patch };
  writeLog(entries);
  return entries[idx];
}

function deleteEntry(id) {
  const entries = readLog();
  const next = entries.filter((e) => e.id !== id);
  writeLog(next);
  return next.length !== entries.length;
}

function clearLog() {
  writeLog([]);
}

module.exports = {
  appendEntry, getSorted, getTopUrgent,
  updateEntry, deleteEntry, clearLog, readLog,
};
