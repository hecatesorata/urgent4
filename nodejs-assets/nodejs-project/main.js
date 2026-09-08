/**
 * main.js
 * -----------------------------------------------
 * Entry point yang dijalankan oleh plugin nodejs-mobile-cordova
 * saat aplikasi Android dibuka. Tugasnya cuma dua:
 * 1. Meneruskan setiap console.log/error ke layar loading di WebView,
 *    supaya kamu bisa lihat progresnya tanpa perlu USB/adb/terminal.
 * 2. Menjalankan server.js yang sebenarnya (Express + koneksi WhatsApp).
 * -----------------------------------------------
 */

const hasChannel = typeof cordova !== 'undefined' && cordova.channel;

function sendToWebview(line) {
  if (!hasChannel) return;
  try { cordova.channel.post('message', 'log:' + line); } catch (e) { /* abaikan */ }
}

const originalLog = console.log.bind(console);
const originalError = console.error.bind(console);

console.log = (...args) => {
  const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  originalLog(...args);
  sendToWebview(line);
};

console.error = (...args) => {
  const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  originalError(...args);
  sendToWebview('⚠️ ' + line);
};

process.on('uncaughtException', (err) => {
  console.error('uncaughtException: ' + (err?.stack || err?.message || err));
});

require('./server.js');
