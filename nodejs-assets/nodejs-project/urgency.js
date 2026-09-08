/**
 * urgency.js
 * -----------------------------------------------
 * Modul kecil untuk menganalisis seberapa mendesak sebuah pesan,
 * berdasarkan kata kunci, tanda baca, dan pola waktu.
 * Dipakai oleh index.js setiap ada pesan masuk.
 * -----------------------------------------------
 */

const CRITICAL = [
  'darurat', 'emergency', 'gawat', 'meninggal', 'kecelakaan',
  'sakit keras', 'sekarat', 'tolong', 'help me', 'sos',
];

const HIGH = [
  'urgent', 'penting', 'asap', 'segera', 'deadline', 'jatuh tempo',
  'komplain', 'kecewa', 'marah', 'batal', 'cancel', 'refund',
  'hari ini', 'secepatnya', 'tidak bisa menunggu',
];

const MEDIUM = [
  'jadwal', 'meeting', 'reschedule', 'konfirmasi', 'pending',
  'menunggu', 'follow up', 'invoice', 'pembayaran', 'tagihan', 'reservasi',
];

// Urutan level dari paling rendah ke paling tinggi (dipakai buat bandingkan threshold)
const LEVEL_ORDER = ['rendah', 'sedang', 'tinggi', 'urgent'];

/**
 * Menganalisis satu pesan teks dan mengembalikan:
 * { score: 0-100, level: 'rendah'|'sedang'|'tinggi'|'urgent', signals: [...] }
 */
function analyzeUrgency(text) {
  const original = text || '';
  const t = original.toLowerCase();
  let score = 0;
  const signals = [];

  CRITICAL.forEach((k) => {
    if (t.includes(k)) {
      score += 32;
      signals.push(k);
    }
  });
  HIGH.forEach((k) => {
    if (t.includes(k)) {
      score += 18;
      signals.push(k);
    }
  });
  MEDIUM.forEach((k) => {
    if (t.includes(k)) {
      score += 9;
      signals.push(k);
    }
  });

  const timeMatch = t.match(/\d+\s*(menit|jam)/g);
  if (timeMatch) {
    score += 10;
    signals.push(`batas waktu (${timeMatch[0]})`);
  }

  const exclaimCount = (original.match(/!/g) || []).length;
  if (exclaimCount >= 1) {
    score += Math.min(exclaimCount * 5, 15);
    signals.push(`${exclaimCount}x tanda seru`);
  }

  const qMarkCount = (original.match(/\?/g) || []).length;
  if (qMarkCount >= 2) {
    score += 5;
    signals.push('banyak pertanyaan');
  }

  const capsWords = original.match(/\b[A-Z]{4,}\b/g) || [];
  if (capsWords.length) {
    score += Math.min(capsWords.length * 6, 12);
    signals.push('huruf kapital semua');
  }

  score = Math.min(score, 100);

  let level = 'rendah';
  if (score >= 65) level = 'urgent';
  else if (score >= 40) level = 'tinggi';
  else if (score >= 18) level = 'sedang';

  return { score, level, signals: [...new Set(signals)].slice(0, 4) };
}

/** Bandingkan dua level, return true kalau `level` >= `minLevel` */
function meetsThreshold(level, minLevel) {
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(minLevel);
}

module.exports = { analyzeUrgency, meetsThreshold, LEVEL_ORDER };
