const { onRequest } = require("firebase-functions/v2/https");
const crypto = require("crypto");

let _admin = null;
let _db = null;

function getAdmin() {
  if (!_admin) {
    _admin = require("firebase-admin");
    if (!_admin.apps.length) {
      _admin.initializeApp();
    }
  }
  return _admin;
}

function getDb() {
  if (!_db) {
    _db = getAdmin().firestore();
  }
  return _db;
}

const SUPER_ADMIN_EMAIL = "tamaverseapp@gmail.com";
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash"];
let _cachedApiKey = "";
let _cachedApiKeyAt = 0;

const DAILY_LIMITS = {
  free: { total: 0, explain: 0, weakness: 0, newsSearch: 0 },
  bronze: { total: 10, explain: 10, weakness: 10, newsSearch: 0 },
  silver: { total: 20, explain: 20, weakness: 20, newsSearch: 20 },
  gold: { total: 30, explain: 30, weakness: 30, newsSearch: 30 },
  admin: { total: 9999, explain: 9999, weakness: 9999, newsSearch: 9999 }
};

function getTodayWIB() {
  const now = new Date();
  const wibMs = now.getTime() + 7 * 60 * 60 * 1000;
  return new Date(wibMs).toISOString().slice(0, 10);
}

function makeHashId(str) {
  return crypto.createHash("sha256").update(String(str || "")).digest("hex").slice(0, 32);
}

async function getGeminiApiKey() {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY.trim();
  }
  if (_cachedApiKey && Date.now() - _cachedApiKeyAt < 180000) {
    return _cachedApiKey;
  }
  const db = getDb();
  const cpnsCfg = await db.collection("cpns_settings").doc("ai_config").get();
  if (cpnsCfg.exists && cpnsCfg.data()?.apiKey) {
    _cachedApiKey = String(cpnsCfg.data().apiKey).trim();
    _cachedApiKeyAt = Date.now();
    return _cachedApiKey;
  }
  const protamaCfg = await db.collection("settings").doc("ai_config").get();
  if (protamaCfg.exists && protamaCfg.data()?.apiKey) {
    _cachedApiKey = String(protamaCfg.data().apiKey).trim();
    _cachedApiKeyAt = Date.now();
    return _cachedApiKey;
  }
  return "";
}

async function callGemini({ apiKey, systemInstruction, prompt, useGoogleSearch = false, responseMimeType = "" }) {
  const errors = [];
  for (const model of GEMINI_MODELS) {
    let resp;
    let json;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const generationConfig = {
        temperature: 0.3,
        maxOutputTokens: 900
      };
      if (model === "gemini-3.8-flash") {
        generationConfig.thinkingConfig = { thinkingLevel: "LOW" };
      }
      if (responseMimeType) {
        generationConfig.responseMimeType = responseMimeType;
      }
      const body = {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig
      };
      if (useGoogleSearch) {
        body.tools = [{ google_search: {} }];
      }

      const timeoutMs = model === "gemini-3.8-flash" ? 22000 : 15000;
      resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs)
      });
      json = await resp.json();
    } catch (err) {
      errors.push(`[${model}] ${err.message}`);
      continue;
    }

    if (!resp.ok) {
      const msg = json?.error?.message || `HTTP ${resp.status}`;
      errors.push(`[${model} HTTP ${resp.status}] ${msg}`);
      if (resp.status === 404 || resp.status === 503 || resp.status === 429 || resp.status === 400) {
        continue;
      }
      throw new Error(errors.join(" | "));
    }

    const cand = json?.candidates?.[0];
    const parts = (cand?.content?.parts || []).filter((p) => !p.thought);
    const text = parts.map((p) => p.text || "").join("\n").trim();
    if (!text) {
      errors.push(`[${model}] Respon AI kosong.`);
      continue;
    }

    const rawChunks = cand?.groundingMetadata?.groundingChunks || [];
    const sources = rawChunks
      .map((c) => c.web)
      .filter((w) => w && w.uri)
      .slice(0, 5)
      .map((w) => ({ title: w.title || w.uri, uri: w.uri }));

    return { text, model, sources };
  }
  const all429 = errors.length > 0 && errors.every((e) => e.includes("HTTP 429"));
  if (all429 && useGoogleSearch) {
    throw new Error(
      "Kuota Google Search Grounding (Tanya Info Live) pada API Key server saat ini sedang limit/habis (HTTP 429). " +
      "Biasanya ini terjadi jika key masih memakai kuota Free Tier untuk Search Grounding. " +
      "Fitur Bedah Soal & Analisis Kelemahan tetap berjalan normal; Admin dapat memasang API Key Tier 1 ber-billing di Command Center → Pusat Berita & BOT."
    );
  }
  throw new Error(errors.join(" | ") || "Gagal menghubungi server Gemini.");
}

async function getUserTierAndQuota(uid, email) {
  const isAdmin = String(email || "").toLowerCase() === SUPER_ADMIN_EMAIL;
  const userRef = getDb().collection("cpns_users").doc(uid);
  const snap = await userRef.get();
  const data = snap.exists ? snap.data() : {};
  let tier = "free";
  if (isAdmin) {
    tier = "admin";
  } else if (data?.isPaid && ["bronze", "silver", "gold"].includes(data.tier)) {
    tier = data.tier;
  }

  const today = getTodayWIB();
  const savedQuota = data?.aiQuota || {};
  const counts = savedQuota.date === today
    ? {
        explain: Number(savedQuota.explain || 0),
        weakness: Number(savedQuota.weakness || 0),
        newsSearch: Number(savedQuota.newsSearch || 0)
      }
    : { explain: 0, weakness: 0, newsSearch: 0 };

  return { userRef, tier, isAdmin, today, counts, limits: DAILY_LIMITS[tier] || DAILY_LIMITS.free };
}

async function incrementQuota(userRef, today, counts, actionKey) {
  const nextCounts = {
    date: today,
    explain: counts.explain + (actionKey === "explain" ? 1 : 0),
    weakness: counts.weakness + (actionKey === "weakness" ? 1 : 0),
    newsSearch: counts.newsSearch + (actionKey === "newsSearch" ? 1 : 0)
  };
  await userRef.set({ aiQuota: nextCounts }, { merge: true });
  return nextCounts;
}

exports.menujuAsnBot = onRequest(
  { region: "asia-southeast2", cors: true, maxInstances: 20, memory: "512MiB", timeoutSeconds: 90 },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const admin = getAdmin();
      const db = getDb();
      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Silakan login terlebih dahulu." });
      }
      const idToken = authHeader.slice(7).trim();
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;
      const email = decoded.email || "";

      const body = req.body || {};
      const action = String(body.action || "").trim();
      if (!["quota", "explain", "weakness", "newsSearch", "homogenize"].includes(action)) {
        return res.status(400).json({ error: "Action tidak valid." });
      }

      const userCtx = await getUserTierAndQuota(uid, email);
      const totalUsed = (userCtx.counts.explain || 0) + (userCtx.counts.weakness || 0) + (userCtx.counts.newsSearch || 0);
      const totalLimit = userCtx.limits.total ?? userCtx.limits.explain ?? 0;

      if (action === "quota") {
        return res.json({
          ok: true,
          tier: userCtx.tier,
          today: userCtx.today,
          used: userCtx.counts,
          limits: userCtx.limits,
          totalUsed,
          totalLimit,
          remaining: Math.max(0, totalLimit - totalUsed)
        });
      }

      const limitForAction = totalLimit;
      const usedForAction = totalUsed;

      if (!userCtx.isAdmin && totalLimit <= 0) {
        return res.status(403).json({
          error: `Fitur MenujuASN-BOT belum tersedia di paket ${userCtx.tier.toUpperCase()}. Upgrade ke Bronze (10 token/hari), Silver (20 token/hari), atau Gold (30 token/hari).`,
          code: "TIER_LOCKED"
        });
      }

      if (!userCtx.isAdmin && totalUsed >= totalLimit) {
        return res.status(429).json({
          error: `Token harian MenujuASN-BOT (${totalLimit} token/hari) untuk paket ${userCtx.tier.toUpperCase()} sudah habis. Reset otomatis besok pukul 00.00 WIB.`,
          code: "QUOTA_EXCEEDED",
          used: totalUsed,
          limit: totalLimit,
          totalUsed,
          totalLimit,
          remaining: 0
        });
      }

      const apiKey = await getGeminiApiKey();
      if (!apiKey) {
        return res.status(503).json({
          error: "API Key MenujuASN-BOT belum dikonfigurasi oleh Admin."
        });
      }

      if (action === "explain") {
        const soalId = String(body.soalId || "").trim();
        const kategori = String(body.kategori || "SKD").trim();
        const soal = String(body.soal || "").trim();
        const opsiText = String(body.opsiText || "").trim();
        const kunci = String(body.kunci || "").trim();
        const userAns = String(body.userAns || "").trim();
        const pembahasan = String(body.pembahasan || "").trim();
        const followUp = String(body.followUp || "").trim();

        if (!soal) {
          return res.status(400).json({ error: "Teks soal tidak boleh kosong." });
        }

        const cacheKey = soalId ? makeHashId(`explain_${soalId}`) : makeHashId(`explain_${soal.slice(0, 120)}`);
        if (!followUp) {
          const cacheSnap = await db.collection("cpns_ai_cache").doc(cacheKey).get();
          if (cacheSnap.exists && cacheSnap.data()?.reply) {
            return res.json({
              ok: true,
              cached: true,
              reply: cacheSnap.data().reply,
              model: cacheSnap.data().model || "gemini-3.8-flash",
              used: usedForAction,
              limit: limitForAction
            });
          }
        }

        const systemInstruction =
          "Kamu adalah MenujuASN-BOT, mentor ahli SKD CASN Indonesia standar BKN 2026 (TWK, TIU, TKP). " +
          "Jawab dalam bahasa Indonesia yang jelas, terstruktur, ringkas, dan mudah dipahami pejuang CASN. " +
          "Gunakan poin-poin rapi: (1) Inti Konsep/Trik Cepat, (2) Kenapa Jawaban Benar/Skor 5 Tepat, (3) Kenapa Opsi Lain Kurang Tepat. " +
          "PENTING: DILARANG menulis kode LaTeX atau tanda dolar ($...$, \\rightarrow, \\dots, \\times, \\frac). Gunakan teks biasa dan simbol Unicode langsung (contoh: →, ×, ÷, ..., +, -, =).";

        const prompt =
          `Kategori: ${kategori}\n` +
          `Soal: ${soal}\n` +
          (opsiText ? `Pilihan:\n${opsiText}\n` : "") +
          (kunci ? `Kunci/Terbaik: ${kunci}\n` : "") +
          (userAns ? `Jawaban Peserta: ${userAns}\n` : "") +
          (pembahasan ? `Catatan Pembahasan Awal: ${pembahasan}\n` : "") +
          (followUp ? `\nPertanyaan Lanjutan Peserta: ${followUp}` : "\nTolong bedah soal ini secara runtut dan berikan trik cepat menjawabnya.");

        const result = await callGemini({ apiKey, systemInstruction, prompt });

        if (!followUp) {
          await db.collection("cpns_ai_cache").doc(cacheKey).set({
            soalId: soalId || cacheKey,
            kategori,
            reply: result.text,
            model: result.model,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        const nextCounts = await incrementQuota(userCtx.userRef, userCtx.today, userCtx.counts, "explain");
        const newTotalUsed = totalUsed + 1;
        return res.json({
          ok: true,
          cached: false,
          reply: result.text,
          model: result.model,
          used: newTotalUsed,
          limit: totalLimit,
          totalUsed: newTotalUsed,
          totalLimit,
          remaining: Math.max(0, totalLimit - newTotalUsed)
        });
      }

      if (action === "weakness") {
        const statsSummary = String(body.statsSummary || "").trim();
        if (!statsSummary) {
          return res.status(400).json({ error: "Belum ada riwayat latihan untuk dianalisis." });
        }

        const systemInstruction =
          "Kamu adalah MenujuASN-BOT, mentor strategis persiapan CASN 2026 standar BKN (TWK min 65, TIU min 80, TKP min 166). " +
          "Jawab SANGAT TO THE POINT, taktis, dan langsung ke aksi (maksimal 170 kata): " +
          "(1) **Prioritas Terlemah**: sebutkan 1-2 subtes/topik dengan akurasi terendah beserta angkanya; " +
          "(2) **Strategi Cepat**: cara taktis mendongkrak skor di topik itu; " +
          "(3) **Aksi Ulang Soal**: arahkan peserta langsung klik tombol **Mode Drill** (untuk pahami pola jawaban) atau **Mode CAT** (untuk latih kecepatan) di panel sebelah kanan.";

        const prompt = `Data Riwayat Latihan Peserta:\n${statsSummary}\n\nBerikan diagnosis kelemahan dan strategi belajar yang paling efektif.`;
        const result = await callGemini({ apiKey, systemInstruction, prompt });
        const nextCounts = await incrementQuota(userCtx.userRef, userCtx.today, userCtx.counts, "weakness");
        const newTotalUsed = totalUsed + 1;

        return res.json({
          ok: true,
          reply: result.text,
          model: result.model,
          used: newTotalUsed,
          limit: totalLimit,
          totalUsed: newTotalUsed,
          totalLimit,
          remaining: Math.max(0, totalLimit - newTotalUsed)
        });
      }

      if (action === "homogenize") {
        if (!userCtx.isAdmin) {
          return res.status(403).json({ error: "Fitur homogenisasi opsi khusus Super Admin." });
        }
        const kategori = String(body.kategori || "TWK").toUpperCase();
        const subKategori = String(body.subKategori || "").trim();
        const soal = String(body.soal || "").trim();
        const opsi = Array.isArray(body.opsi) ? body.opsi : [];
        if (!soal || opsi.length < 2) {
          return res.status(400).json({ error: "Teks soal dan daftar opsi A-E wajib diisi." });
        }

        let locked = [];
        let targets = [];
        if (kategori === "TKP") {
          const maxPoin = opsi.reduce((mx, o) => Math.max(mx, Number(o.poin || 0)), 0);
          locked = opsi.filter((o) => Number(o.poin || 0) >= maxPoin);
          targets = opsi.filter((o) => Number(o.poin || 0) < maxPoin);
        } else {
          locked = opsi.filter((o) => Boolean(o.benar));
          targets = opsi.filter((o) => !o.benar);
        }

        if (!locked.length || !targets.length) {
          return res.status(400).json({ error: "Kunci jawaban benar (atau opsi poin tertinggi) harus ditandai agar opsi salah bisa dihomogenkan." });
        }

        const lockedSummary = locked
          .map((o) => `${o.label}. ${o.teks}${kategori === "TKP" ? ` (Poin ${o.poin})` : " (KUNCI BENAR - TERKUNCI)"}`)
          .join("\n");
        const targetSummary = targets
          .map((o) => `${o.label}. ${o.teks}${kategori === "TKP" ? ` (Poin ${o.poin})` : " (SALAH - WAJIB DIHOMOGENKAN)"}`)
          .join("\n");

        const systemInstruction =
          "Kamu adalah editor ahli penyusun soal CAT SKD CASN standar BKN. " +
          "Tugasmu melakukan HOMOGENISASI HANYA PADA OPSI YANG SALAH (pengecoh/distractor) agar secara psikometrik setara dengan kunci jawaban. " +
          "Aturan WAJIB: " +
          "(1) JANGAN PERNAH mengubah atau menyentuh opsi KUNCI BENAR / Poin Tertinggi; " +
          "(2) Tulis ulang HANYA opsi salah yang diminta agar panjang kata, pola kalimat (misal sama-sama diawali kata benda/imbuhan pe-N/me-N), nada birokrasi/akademis formal BKN, dan tingkat kemasukakalannya HOMOGEN dengan opsi kunci; " +
          "(3) Pastikan setiap opsi yang ditulis ulang TETAP SALAH secara substansi (atau tetap di bobot poinnya untuk TKP) dan TIDAK menjadi jawaban benar kedua; " +
          "(4) Kembalikan JSON murni dengan format: {\"opsi\": {\"LABEL\": \"teks baru\"}} hanya untuk label opsi salah.";

        const prompt =
          `Kategori: ${kategori}${subKategori ? ` (${subKategori})` : ""}\n` +
          `Soal:\n${soal}\n\n` +
          `Opsi Terkunci (ACUAN GAYA & PANJANG, JANGAN DIUBAH):\n${lockedSummary}\n\n` +
          `Opsi Salah yang HARUS Dihomogenkan:\n${targetSummary}\n\n` +
          `Kembalikan JSON berisi key "opsi" hanya untuk label [${targets.map((t) => t.label).join(", ")}].`;

        const result = await callGemini({
          apiKey,
          systemInstruction,
          prompt,
          responseMimeType: "application/json"
        });

        let parsedJson = null;
        try {
          const clean = result.text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
          parsedJson = JSON.parse(clean);
        } catch (e) {
          throw new Error("Format JSON hasil homogenisasi AI tidak valid. Silakan coba klik ulang.");
        }

        const outMap = {};
        const rawMap = parsedJson?.opsi || parsedJson || {};
        targets.forEach((t) => {
          if (typeof rawMap[t.label] === "string" && rawMap[t.label].trim()) {
            outMap[t.label] = rawMap[t.label].trim();
          }
        });

        return res.json({
          ok: true,
          homogenized: outMap,
          lockedLabels: locked.map((l) => l.label),
          model: result.model
        });
      }

      if (action === "newsSearch") {
        const question = String(body.question || "").trim();
        if (!question || question.length < 4) {
          return res.status(400).json({ error: "Tuliskan pertanyaan informasi CASN minimal 4 karakter." });
        }

        const newsKey = makeHashId(`news_${question.toLowerCase().replace(/\s+/g, " ")}`);
        const newsCacheRef = db.collection("cpns_ai_news_cache").doc(newsKey);
        const newsCacheSnap = await newsCacheRef.get();
        if (newsCacheSnap.exists) {
          const cData = newsCacheSnap.data();
          const ageMs = Date.now() - (cData.createdAtMs || 0);
          if (ageMs < 6 * 60 * 60 * 1000 && cData.reply) {
            return res.json({
              ok: true,
              cached: true,
              reply: cData.reply,
              sources: cData.sources || [],
              model: cData.model || "gemini-3.8-flash",
              used: usedForAction,
              limit: limitForAction
            });
          }
        }

        const systemInstruction =
          "Kamu adalah MenujuASN-BOT, asisten informasi resmi seleksi CASN Indonesia. " +
          "Gunakan Google Search untuk mencari informasi terbaru dari sumber resmi (BKN, KemenPAN-RB, SSCASN, atau media nasional tepercaya). " +
          "Jika informasi belum resmi diumumkan, katakan jujur apa adanya dan hindari spekulasi. Jawaban ringkas, jelas, dalam Bahasa Indonesia.";

        const result = await callGemini({
          apiKey,
          systemInstruction,
          prompt: `Pertanyaan peserta CASN: ${question}`,
          useGoogleSearch: true
        });

        await newsCacheRef.set({
          question,
          reply: result.text,
          sources: result.sources || [],
          model: result.model,
          createdAtMs: Date.now()
        });

        const nextCounts = await incrementQuota(userCtx.userRef, userCtx.today, userCtx.counts, "newsSearch");
        return res.json({
          ok: true,
          cached: false,
          reply: result.text,
          sources: result.sources || [],
          model: result.model,
          used: nextCounts.newsSearch,
          limit: limitForAction
        });
      }
    } catch (err) {
      console.error("[menujuAsnBot] Error:", err);
      return res.status(500).json({
        error: err.message || "Terjadi kesalahan pada MenujuASN-BOT."
      });
    }
  }
);


// ==========================================================
// MIDTRANS SNAP & WEBHOOK INTEGRATION (SANDBOX / PRODUCTION)
// ==========================================================
const MIDTRANS_PACKAGES = {
  satuan_paket: { name: "Paket Satuan (1 Paket Latihan)", price: 9999, grantType: "satuan" },
  satuan_to: { name: "Tryout Akbar Satuan", price: 24999, grantType: "satuan" },
  bronze: { name: "Paket Bronze Menuju ASN", price: 49999, grantType: "tier", tier: "bronze" },
  silver: { name: "Paket Silver Menuju ASN", price: 74999, grantType: "tier", tier: "silver" },
  gold: { name: "Paket Gold Menuju ASN (All-In)", price: 99999, grantType: "tier", tier: "gold" },
  platinum: { name: "Paket Platinum Menuju ASN (VIP)", price: 149999, grantType: "tier", tier: "platinum" }
};

async function getMidtransConfig() {
  const db = getDb();
  const snap = await db.collection("cpns_settings").doc("midtrans_config").get();
  const d = snap.exists ? snap.data() : {};
  const serverKey = String(d?.serverKey || process.env.MIDTRANS_SERVER_KEY || "").trim();
  const clientKey = String(d?.clientKey || process.env.MIDTRANS_CLIENT_KEY || "").trim();
  const signatureKey = String(d?.signatureKey || process.env.MIDTRANS_SIGNATURE_KEY || "").trim();
  const isProduction = Boolean(d?.isProduction);
  return { serverKey, clientKey, signatureKey, isProduction };
}

function getMidtransUrls(isProduction) {
  return isProduction
    ? {
        snap: "https://app.midtrans.com/snap/v1/transactions",
        api: "https://api.midtrans.com/v2"
      }
    : {
        snap: "https://app.sandbox.midtrans.com/snap/v1/transactions",
        api: "https://api.sandbox.midtrans.com/v2"
      };
}

async function activatePaidOrder(db, admin, orderId, orderData, notifPayload = {}) {
  if (!orderData || !orderData.uid) return false;
  if (orderData.status === "paid") return true;

  await db.collection("cpns_orders").doc(orderId).set({
    status: "paid",
    paidAtMs: Date.now(),
    paymentType: String(notifPayload.payment_type || ""),
    transactionStatus: String(notifPayload.transaction_status || "settlement")
  }, { merge: true });

  const userRef = db.collection("cpns_users").doc(orderData.uid);
  if (orderData.grantType === "tier" && orderData.tier) {
    await userRef.set({
      isPaid: true,
      tier: orderData.tier,
      paidVia: "midtrans",
      lastOrderId: orderId,
      updatedAtMs: Date.now()
    }, { merge: true });
  } else if (orderData.grantType === "satuan") {
    await userRef.set({
      satuanCredits: admin.firestore.FieldValue.increment(1),
      paidVia: "midtrans",
      lastOrderId: orderId,
      updatedAtMs: Date.now()
    }, { merge: true });
  }
  return true;
}

exports.midtransApi = onRequest(
  { region: "asia-southeast2", cors: true, maxInstances: 20, memory: "256MiB", timeoutSeconds: 30 },
  async (req, res) => {
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {
      const admin = getAdmin();
      const db = getDb();
      const body = req.body || {};
      const action = String(body.action || "").trim();
      const cfg = await getMidtransConfig();

      if (action === "config") {
        return res.json({
          ok: true,
          enabled: Boolean(cfg.serverKey),
          isProduction: cfg.isProduction,
          clientKey: cfg.clientKey
        });
      }

      if (!cfg.serverKey) {
        return res.status(503).json({
          error: "Server Key Midtrans belum dikonfigurasi oleh Admin di Command Center."
        });
      }

      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Silakan login terlebih dahulu." });
      }
      const decoded = await admin.auth().verifyIdToken(authHeader.slice(7).trim());
      const uid = decoded.uid;
      const email = decoded.email || "";
      const name = decoded.name || email.split("@")[0] || "Pejuang ASN";
      const urls = getMidtransUrls(cfg.isProduction);
      const authBasic = "Basic " + Buffer.from(`${cfg.serverKey}:`).toString("base64");

      if (action === "createTransaction") {
        const packageId = String(body.packageId || "").trim().toLowerCase();
        const pkg = MIDTRANS_PACKAGES[packageId];
        if (!pkg) {
          return res.status(400).json({ error: "Paket pembayaran tidak valid." });
        }

        const orderId = `MASN-${uid.slice(0, 6).toUpperCase()}-${Date.now()}`;
        const snapPayload = {
          transaction_details: {
            order_id: orderId,
            gross_amount: pkg.price
          },
          item_details: [
            {
              id: packageId,
              price: pkg.price,
              quantity: 1,
              name: pkg.name.slice(0, 50)
            }
          ],
          customer_details: {
            first_name: name.slice(0, 50),
            email: email || "peserta@menuju-asn.web.app"
          },
          callbacks: {
            finish: "https://menuju-asn.web.app/?payment=finish"
          }
        };

        const resp = await fetch(urls.snap, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": authBasic
          },
          body: JSON.stringify(snapPayload),
          signal: AbortSignal.timeout(15000)
        });
        const json = await resp.json();
        if (!resp.ok || !json.token) {
          const msg = (json?.error_messages || []).join(", ") || json?.status_message || `HTTP ${resp.status}`;
          return res.status(400).json({ error: `Midtrans Error: ${msg}` });
        }

        await db.collection("cpns_orders").doc(orderId).set({
          orderId,
          uid,
          email,
          packageId,
          packageName: pkg.name,
          amount: pkg.price,
          grantType: pkg.grantType,
          tier: pkg.tier || null,
          isProduction: cfg.isProduction,
          status: "pending",
          snapToken: json.token,
          redirectUrl: json.redirect_url || "",
          createdAtMs: Date.now()
        });

        return res.json({
          ok: true,
          orderId,
          token: json.token,
          redirectUrl: json.redirect_url || "",
          clientKey: cfg.clientKey,
          isProduction: cfg.isProduction,
          packageName: pkg.name,
          amount: pkg.price
        });
      }

      if (action === "checkStatus") {
        const orderId = String(body.orderId || "").trim();
        if (!orderId) return res.status(400).json({ error: "orderId wajib diisi." });

        const orderSnap = await db.collection("cpns_orders").doc(orderId).get();
        if (!orderSnap.exists) return res.status(404).json({ error: "Order tidak ditemukan." });
        const orderData = orderSnap.data();
        if (orderData.uid !== uid) return res.status(403).json({ error: "Akses ditolak." });

        if (orderData.status === "paid") {
          return res.json({ ok: true, status: "paid", activated: true, tier: orderData.tier || null });
        }

        const resp = await fetch(`${urls.api}/${encodeURIComponent(orderId)}/status`, {
          method: "GET",
          headers: { "Accept": "application/json", "Authorization": authBasic },
          signal: AbortSignal.timeout(12000)
        });
        const json = await resp.json();
        const txStatus = String(json?.transaction_status || "").toLowerCase();
        const fraudStatus = String(json?.fraud_status || "accept").toLowerCase();

        if (txStatus === "settlement" || (txStatus === "capture" && fraudStatus === "accept")) {
          await activatePaidOrder(db, admin, orderId, orderData, json);
          return res.json({ ok: true, status: "paid", activated: true, tier: orderData.tier || null });
        }

        return res.json({ ok: true, status: txStatus || orderData.status, activated: false });
      }

      return res.status(400).json({ error: "Action Midtrans tidak dikenali." });
    } catch (err) {
      console.error("[midtransApi] Error:", err);
      return res.status(500).json({ error: err.message || "Gagal memproses Midtrans." });
    }
  }
);

exports.midtransWebhook = onRequest(
  { region: "asia-southeast2", cors: true, maxInstances: 20, memory: "256MiB", timeoutSeconds: 30 },
  async (req, res) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      return res.status(200).json({ ok: true, service: "midtransWebhook" });
    }
    if (req.method !== "POST") return res.status(405).send("Method not allowed");
    try {
      const admin = getAdmin();
      const db = getDb();
      const notif = req.body || {};
      const orderId = String(notif.order_id || "").trim();
      const statusCode = String(notif.status_code || "").trim();
      const grossAmount = String(notif.gross_amount || "").trim();
      const signatureKey = String(notif.signature_key || "").trim();

      if (!orderId || !statusCode || !grossAmount || !signatureKey) {
        return res.status(200).json({ ok: true, ping: true });
      }

      if (orderId.toLowerCase().includes("test") && !orderId.startsWith("MASN-")) {
        return res.status(200).json({ ok: true, testPing: true });
      }

      const cfg = await getMidtransConfig();
      if (!cfg.serverKey && !cfg.signatureKey) {
        return res.status(200).json({ ok: true, pendingConfig: true });
      }

      const validKeys = [cfg.signatureKey, cfg.serverKey].filter(Boolean);
      const isValidSig = validKeys.some((k) => {
        const expectedSig = crypto
          .createHash("sha512")
          .update(`${orderId}${statusCode}${grossAmount}${k}`)
          .digest("hex");
        return expectedSig === signatureKey;
      });

      if (!isValidSig) {
        console.warn("[midtransWebhook] Invalid signature for order:", orderId);
        return res.status(403).json({ error: "Invalid signature" });
      }

      const orderSnap = await db.collection("cpns_orders").doc(orderId).get();
      if (!orderSnap.exists) {
        return res.status(200).json({ ok: true, ignored: "Order not found" });
      }

      const orderData = orderSnap.data();
      const txStatus = String(notif.transaction_status || "").toLowerCase();
      const fraudStatus = String(notif.fraud_status || "accept").toLowerCase();

      if (txStatus === "settlement" || (txStatus === "capture" && fraudStatus === "accept")) {
        await activatePaidOrder(db, admin, orderId, orderData, notif);
      } else if (["expire", "cancel", "deny"].includes(txStatus)) {
        await db.collection("cpns_orders").doc(orderId).set({
          status: txStatus,
          updatedAtMs: Date.now()
        }, { merge: true });
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[midtransWebhook] Error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);
