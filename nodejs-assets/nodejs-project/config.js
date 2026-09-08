/**
 * config.js
 * -----------------------------------------------
 * Pengaturan statis bot (identitas & teks auto-reply).
 * Pengaturan yang bisa diubah dari dashboard (nomor owner,
 * notifikasi, dll) ada di data/settings.json — lihat settingsStore.js.
 * -----------------------------------------------
 */

module.exports = {
  botName: 'Bot WA Sederhana',

  // Prefix command yang masih dikenali lewat chat WhatsApp (mis. .ping, .urgent)
  prefix: '.',

  // Port web dashboard
  port: 3000,

  // Pesan auto reply untuk chat PRIBADI
  autoReplyPrivate:
    'Halo! 👋 Ini adalah balasan otomatis.\nPesan kamu sudah diterima, mohon tunggu balasan dari owner ya.',

  // Pesan auto reply saat bot di-MENTION di GRUP
  autoReplyMention:
    'Halo, kamu memanggil saya? 🤖\nSaat ini saya masih bot sederhana, coba ketik pesan lain ya.',

  // Tampilkan log pesan masuk di terminal (di luar dashboard)
  showIncomingLog: true,
};
