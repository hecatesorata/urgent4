/**
 * server.js
 * -----------------------------------------------
 * Aplikasi web untuk mengelola bot WhatsApp:
 * - Pairing WhatsApp lewat browser (bukan terminal)
 * - Auto reply chat pribadi & mention grup
 * - Deteksi urgensi otomatis tiap pesan masuk
 * - Dashboard live: daftar chat tersortir berdasarkan urgensi
 * - Notifikasi WA ke owner saat ada pesan mendesak
 *
 * Jalankan dengan: node server.js
 * Lalu buka: http://localhost:3000
 * -----------------------------------------------
 */

const path = require('path');
const express = require('express');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');

const config = require('./config');
const { analyzeUrgency, meetsThreshold } = require('./urgency');
const chatlog = require('./chatlog');
const settingsStore = require('./settingsStore');

const SESSION_DIR = path.join(__dirname, 'session');
const logger = pino({ level: 'silent' });
const startTime = Date.now();

// ---------- Status aplikasi (dibaca dashboard lewat /api/status) ----------
const appState = {
  connected: false,
  registered: false,
  pairingCode: null,
  pairingError: null,
  lastConnectionNote: 'Belum terhubung.',
};

// ---------- Server-Sent Events: dorong update ke dashboard secara live ----------
const sseClients = [];
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((res) => res.write(payload));
}

// ---------- Express app ----------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  res.json(appState);
});

app.get('/api/settings', (req, res) => {
  res.json(settingsStore.getSettings());
});

app.post('/api/settings', (req, res) => {
  const next = settingsStore.updateSettings(req.body || {});
  res.json(next);
});

app.get('/api/chats', (req, res) => {
  const filter = req.query.level;
  res.json(chatlog.getSorted(filter));
});

app.patch('/api/chats/:id', (req, res) => {
  const updated = chatlog.updateEntry(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'not found' });
  res.json(updated);
});

app.delete('/api/chats/:id', (req, res) => {
  const ok = chatlog.deleteEntry(req.params.id);
  res.json({ ok });
});

app.post('/api/pair', async (req, res) => {
  const { phoneNumber } = req.body || {};
  const clean = (phoneNumber || '').replace(/[^0-9]/g, '');
  if (!clean) return res.status(400).json({ error: 'Nomor tidak valid' });
  if (!globalThis.__sock) return res.status(503).json({ error: 'Koneksi belum siap, coba beberapa detik lagi' });

  try {
    const code = await globalThis.__sock.requestPairingCode(clean);
    appState.pairingCode = code;
    appState.pairingError = null;
    settingsStore.updateSettings({ botNumber: clean });
    broadcast('status', appState);
    res.json({ code });
  } catch (err) {
    appState.pairingError = String(err?.message || err);
    broadcast('status', appState);
    res.status(500).json({ error: appState.pairingError });
  }
});

app.get('/api/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write(`event: status\ndata: ${JSON.stringify(appState)}\n\n`);
  sseClients.push(res);
  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// ---------- Baileys: koneksi WhatsApp ----------
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
  });
  globalThis.__sock = sock;

  appState.registered = !!sock.authState.creds.registered;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      appState.connected = true;
      appState.pairingCode = null;
      appState.lastConnectionNote = `Terhubung sebagai ${sock.user?.id || ''}`;
      console.log(`✅ ${config.botName} berhasil terhubung ke WhatsApp!`);
    }

    if (connection === 'close') {
      appState.connected = false;
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      if (isLoggedOut) {
        appState.lastConnectionNote = 'Sesi logout. Hapus folder "session" lalu jalankan ulang untuk pairing baru.';
        console.log('❌ ' + appState.lastConnectionNote);
      } else {
        appState.lastConnectionNote = 'Koneksi terputus, mencoba menyambung ulang...';
        console.log('⚠️  ' + appState.lastConnectionNote);
        startBot();
      }
    }
    broadcast('status', appState);
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    const msg = messages[0];
    if (!msg?.message) return;

    try {
      if (msg.key.fromMe) {
        await handleOwnerCommand(sock, msg);
      } else {
        await handleIncomingMessage(sock, msg);
      }
    } catch (err) {
      console.error('Terjadi error saat memproses pesan:', err);
    }
  });
}

function getMessageText(msg) {
  return (
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    ''
  );
}

function isOwnerJid(jid) {
  if (!jid) return false;
  const jidNumber = jid.split('@')[0].split(':')[0];
  const ownerNumber = (settingsStore.getSettings().ownerNumber || '').replace(/[^0-9]/g, '');
  return ownerNumber !== '' && jidNumber === ownerNumber;
}

async function handleIncomingMessage(sock, msg) {
  const chatId = msg.key.remoteJid;
  const isGroup = chatId.endsWith('@g.us');
  const messageText = getMessageText(msg);
  const settings = settingsStore.getSettings();

  if (config.showIncomingLog) {
    console.log(`📩 Pesan dari ${msg.pushName || chatId} (${isGroup ? 'grup' : 'pribadi'}): ${messageText}`);
  }

  await sock.readMessages([msg.key]);

  if (settings.detectUrgency && messageText.trim()) {
    await handleUrgencyDetection(sock, msg, messageText, isGroup, settings);
  }

  if (!isGroup && isOwnerJid(chatId) && messageText.trim().startsWith(config.prefix)) {
    await handleOwnerCommand(sock, msg);
    return;
  }

  if (!isGroup) {
    await sock.sendMessage(chatId, { text: config.autoReplyPrivate }, { quoted: msg });
    return;
  }

  const mentionedJidList = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  const isBotMentioned = mentionedJidList.some((jid) => jid.startsWith(botJid.split('@')[0]));

  if (isBotMentioned) {
    await sock.sendMessage(chatId, { text: config.autoReplyMention }, { quoted: msg });
  }
}

async function handleUrgencyDetection(sock, msg, messageText, isGroup, settings) {
  const { score, level, signals } = analyzeUrgency(messageText);
  const senderJid = isGroup ? (msg.key.participant || msg.key.remoteJid) : msg.key.remoteJid;
  const senderNumber = senderJid.split('@')[0].split(':')[0];
  const senderName = msg.pushName || senderNumber;

  let entry = null;
  if (settings.logChats) {
    entry = chatlog.appendEntry({
      name: senderName,
      phone: senderNumber,
      chatType: isGroup ? 'grup' : 'pribadi',
      message: messageText,
      score, level, signals,
      ts: Date.now(),
    });
    broadcast('new-chat', entry);
  }

  if (config.showIncomingLog) {
    console.log(`🧭 Urgensi: ${level} (skor ${score}) dari ${senderName}`);
  }

  if (!settings.notifyOnUrgent) return;
  if (!meetsThreshold(level, settings.notifyMinLevel)) return;

  const ownerNumber = (settings.ownerNumber || '').replace(/[^0-9]/g, '');
  if (!ownerNumber || senderNumber === ownerNumber) return;

  const ownerJid = `${ownerNumber}@s.whatsapp.net`;
  const levelEmoji = { urgent: '🔴', tinggi: '🟠', sedang: '🟡', rendah: '⚪' }[level] || '⚪';
  const notifText = [
    `${levelEmoji} *Pesan ${level.toUpperCase()} terdeteksi* (skor ${score})`,
    `Dari: ${senderName} (${senderNumber})`,
    `Chat: ${isGroup ? 'grup' : 'pribadi'}`,
    '',
    `"${messageText.slice(0, 300)}"`,
    signals.length ? `\nSinyal: ${signals.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  try {
    await sock.sendMessage(ownerJid, { text: notifText });
  } catch (err) {
    console.error('Gagal mengirim notifikasi urgent ke owner:', err);
  }
}

async function handleOwnerCommand(sock, msg) {
  const chatId = msg.key.remoteJid;
  const text = getMessageText(msg).trim();
  if (!text.startsWith(config.prefix)) return;

  const [rawCommand, ...args] = text.slice(config.prefix.length).trim().split(/\s+/);
  const command = rawCommand.toLowerCase();

  switch (command) {
    case 'ping': {
      const start = Date.now();
      await sock.sendMessage(chatId, { text: '🏓 Pong!' });
      await sock.sendMessage(chatId, { text: `Kecepatan respon: ${Date.now() - start} ms` });
      break;
    }
    case 'runtime': {
      const uptimeMs = Date.now() - startTime;
      const seconds = Math.floor((uptimeMs / 1000) % 60);
      const minutes = Math.floor((uptimeMs / (1000 * 60)) % 60);
      const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
      await sock.sendMessage(chatId, { text: `⏱️ Bot sudah berjalan: ${hours} jam ${minutes} menit ${seconds} detik` });
      break;
    }
    case 'urgent': {
      const limit = parseInt(args[0], 10) || 5;
      const top = chatlog.getTopUrgent(limit);
      if (top.length === 0) {
        await sock.sendMessage(chatId, { text: 'Belum ada chat tercatat dalam 24 jam terakhir.' });
        break;
      }
      const emoji = { urgent: '🔴', tinggi: '🟠', sedang: '🟡', rendah: '⚪' };
      const lines = top.map((e, i) => {
        const time = new Date(e.ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        return `${i + 1}. ${emoji[e.level] || '⚪'} *${e.level.toUpperCase()}* (skor ${e.score}) — ${e.name}\n   "${e.message.slice(0, 120)}"\n   ${time} · ${e.chatType}`;
      });
      await sock.sendMessage(chatId, { text: `*Chat paling mendesak*\n\n${lines.join('\n\n')}\n\nLihat & sortir lengkap di dashboard: http://localhost:${config.port}` });
      break;
    }
    case 'help':
    case 'menu': {
      const list = [
        `*${config.botName}* - Menu Command Owner`,
        '',
        `${config.prefix}ping - cek kecepatan respon bot`,
        `${config.prefix}runtime - lihat lama bot berjalan`,
        `${config.prefix}urgent [jumlah] - lihat chat paling mendesak`,
        `${config.prefix}help - tampilkan menu ini`,
        '',
        `Dashboard lengkap: http://localhost:${config.port}`,
      ].join('\n');
      await sock.sendMessage(chatId, { text: list });
      break;
    }
    default: {
      await sock.sendMessage(chatId, { text: `Command "${config.prefix}${command}" tidak dikenali. Ketik ${config.prefix}help.` });
    }
  }
}

// ---------- Jalankan semuanya ----------
app.listen(config.port, () => {
  console.log(`🌐 Dashboard berjalan di http://localhost:${config.port}`);
  // Kalau dijalankan di dalam APK (lewat nodejs-mobile-cordova), beri tahu WebView
  // bahwa server sudah siap dibuka. Di luar APK (Termux/desktop), `cordova` tidak
  // ada sehingga baris ini otomatis dilewati.
  if (typeof cordova !== 'undefined' && cordova.channel) {
    try { cordova.channel.post('message', 'server-ready'); } catch (e) { /* abaikan */ }
  }
});

startBot().catch((err) => {
  console.error('Gagal menjalankan koneksi WhatsApp:', err);
});
