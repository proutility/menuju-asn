const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const SUPER_ADMIN_EMAIL = "tamaverseapp@gmail.com";
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-2.5-flash"];

const DAILY_LIMITS = {
  free: { explain: 0, weakness: 0, newsSearch: 0 },
  bronze: { explain: 10, weakness: 1, newsSearch: 0 },
  silver: { explain: 25, weakness: 2, newsSearch: 3 },
  gold: { explain: 50, weakness: 5, newsSearch: 5 },
  admin: { explain: 9999, weakness: 9999, newsSearch: 9999 }
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
  const cpnsCfg = await db.collection("cpns_settings").doc("ai_config").get();
  if (cpnsCfg.exists && cpnsCfg.data()?.apiKey) {
    return String(cpnsCfg.data().apiKey).trim();
  }
  const protamaCfg = await db.collection("settings").doc("ai_config").get();
  if (protamaCfg.exists && protamaCfg.data()?.apiKey) {
    return String(protamaCfg.data().apiKey).trim();
  }
  return "";
}

async function callGemini({ apiKey, systemInstruction, prompt, useGoogleSearch = false }) {
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const body = {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1200
        }
      };
      if (useGoogleSearch) {
        body.tools = [{ google_search: {} }];
      }

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const json = await resp.json();
      if (!resp.ok) {
        const msg = json?.error?.message || `HTTP ${resp.status}`;
        lastError = new Error(`[${model}] ${msg}`);
        if (resp.status === 404 || resp.status === 503 || resp.status === 429) {
          continue;
        }
        throw lastError;
      }

      const cand = json?.candidates?.[0];
      const parts = cand?.content?.parts || [];
      const text = parts.map((p) => p.text || "").join("\n").trim();
      if (!text) {
        lastError = new Error(`[${model}] Respon AI kosong.`);
        continue;
      }

      const rawChunks = cand?.groundingMetadata?.groundingChunks || [];
      const sources = rawChunks
        .map((c) => c.web)
        .filter((w) => w && w.uri)
        .slice(0, 5)
        .map((w) => ({ title: w.title || w.uri, uri: w.uri }));

      return { text, model, sources };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Gagal menghubungi server Gemini.");
}

async function getUserTierAndQuota(uid, email) {
  const isAdmin = String(email || "").toLowerCase() === SUPER_ADMIN_EMAIL;
  const userRef = db.collection("cpns_users").doc(uid);
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
  { region: "asia-southeast2", cors: true, maxInstances: 20 },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
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
      if (!["quota", "explain", "weakness", "newsSearch"].includes(action)) {
        return res.status(400).json({ error: "Action tidak valid." });
      }

      const userCtx = await getUserTierAndQuota(uid, email);

      if (action === "quota") {
        return res.json({
          ok: true,
          tier: userCtx.tier,
          today: userCtx.today,
          used: userCtx.counts,
          limits: userCtx.limits
        });
      }

      const limitForAction = userCtx.limits[action] || 0;
      const usedForAction = userCtx.counts[action] || 0;

      if (!userCtx.isAdmin && limitForAction <= 0) {
        return res.status(403).json({
          error: `Fitur ini belum tersedia di paket ${userCtx.tier.toUpperCase()}. Upgrade paket untuk membuka akses MenujuASN-BOT.`,
          code: "TIER_LOCKED"
        });
      }

      if (!userCtx.isAdmin && usedForAction >= limitForAction) {
        return res.status(429).json({
          error: `Kuota harian MenujuASN-BOT (${limitForAction}x/hari) untuk paket ${userCtx.tier.toUpperCase()} sudah habis. Reset otomatis besok pukul 00.00 WIB.`,
          code: "QUOTA_EXCEEDED",
          used: usedForAction,
          limit: limitForAction
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
          "Kamu adalah MenujuASN-BOT, mentor ahli SKD CPNS Indonesia standar BKN 2026 (TWK, TIU, TKP). " +
          "Jawab dalam bahasa Indonesia yang jelas, terstruktur, ringkas, dan mudah dipahami pejuang CPNS. " +
          "Gunakan poin-poin rapi: (1) Inti Konsep/Trik Cepat, (2) Kenapa Jawaban Benar/Skor 5 Tepat, (3) Kenapa Opsi Lain Kurang Tepat.";

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
        return res.json({
          ok: true,
          cached: false,
          reply: result.text,
          model: result.model,
          used: nextCounts.explain,
          limit: limitForAction
        });
      }

      if (action === "weakness") {
        const statsSummary = String(body.statsSummary || "").trim();
        if (!statsSummary) {
          return res.status(400).json({ error: "Belum ada riwayat latihan untuk dianalisis." });
        }

        const systemInstruction =
          "Kamu adalah MenujuASN-BOT, coach persiapan CPNS 2026. Tugasmu mendiagnosis kelemahan peserta berdasarkan statistik riwayat tryout mereka " +
          "terhadap Passing Grade resmi BKN (TWK min 65, TIU min 80, TKP min 166). " +
          "Berikan: (1) 3 Titik Kelemahan Utama, (2) Prioritas Perbaikan agar Lolos PG, (3) Target Drill Harian yang realistis. Maksimal 250 kata, padat & memotivasi.";

        const prompt = `Data Riwayat Latihan Peserta:\n${statsSummary}\n\nBerikan diagnosis kelemahan dan strategi belajar yang paling efektif.`;
        const result = await callGemini({ apiKey, systemInstruction, prompt });
        const nextCounts = await incrementQuota(userCtx.userRef, userCtx.today, userCtx.counts, "weakness");

        return res.json({
          ok: true,
          reply: result.text,
          model: result.model,
          used: nextCounts.weakness,
          limit: limitForAction
        });
      }

      if (action === "newsSearch") {
        const question = String(body.question || "").trim();
        if (!question || question.length < 4) {
          return res.status(400).json({ error: "Tuliskan pertanyaan informasi CPNS minimal 4 karakter." });
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
          "Kamu adalah MenujuASN-BOT, asisten informasi resmi seleksi CPNS/ASN Indonesia. " +
          "Gunakan Google Search untuk mencari informasi terbaru dari sumber resmi (BKN, KemenPAN-RB, SSCASN, atau media nasional tepercaya). " +
          "Jika informasi belum resmi diumumkan, katakan jujur apa adanya dan hindari spekulasi. Jawaban ringkas, jelas, dalam Bahasa Indonesia.";

        const result = await callGemini({
          apiKey,
          systemInstruction,
          prompt: `Pertanyaan peserta CPNS: ${question}`,
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
