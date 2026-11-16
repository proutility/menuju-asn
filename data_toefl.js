/**
 * ==========================================================
 * WADAH BANK SOAL TOEFL — MENUJU ASN (EKSKLUSIF PLATINUM)
 * ==========================================================
 * Isi array window.DATA_TOEFL di bawah ini dengan daftar soal TOEFL.
 *
 * Contoh format item soal:
 * {
 *   id: 'toefl_str_001',
 *   kategori: 'TOEFL',
 *   subKategori: 'Structure & Written Expression', // atau 'Reading Comprehension' | 'Listening Comprehension'
 *   paketNo: 1,
 *   paketTitle: 'TOEFL Structure Paket #1',
 *   audioUrl: '', // Opsional: URL audio untuk Listening Comprehension
 *   soal: 'The committee _____ already decided on the new schedule before the meeting started.',
 *   opsi: [
 *     { label: 'A', teks: 'has', benar: false, poin: 0 },
 *     { label: 'B', teks: 'have', benar: false, poin: 0 },
 *     { label: 'C', teks: 'had', benar: true, poin: 5 },
 *     { label: 'D', teks: 'will have', benar: false, poin: 0 }
 *   ],
 *   pembahasan: 'Karena terdapat klausa lampau "before the meeting started", kejadian yang lebih dulu terjadi memakai Past Perfect (had + V3).'
 * }
 */
window.DATA_TOEFL = [];
