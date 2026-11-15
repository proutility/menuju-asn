// ==========================================================
// MENUJU ASN - CBT SKD CPNS 2026 MAIN CONTROLLER
// PWA & Hybrid Hemat-Database Multiplayer Engine (BKN Standard)
// ==========================================================
import { 
    auth, provider, db, ADMIN_EMAILS, COLLECTIONS,
    signInWithPopup, signOut, onAuthStateChanged,
    doc, getDoc, setDoc, updateDoc, onSnapshot
} from "./firebase-config.js";

// Global App State
window.currentUser = null;
window.currentUserProfile = { tier: 'free', isPaid: false };
window.currentAppMode = "lobby"; // lobby | singleplayer | multiplayer
window.currentQuestions = [];
window.currentIdx = 0;
window.userAnswers = {}; // { qId: selectedOptionLabel }
window.userAnswerPoints = {}; // { qId: point }
window.examTimerInterval = null;
window.examTimeRemaining = 0; // seconds
window.examStartTimeMs = 0;
window.syncedSubtes = { TWK: false, TIU: false, TKP: false };
window.activeRoomCode = null;
window.roomUnsubscribe = null;
window.latestRoomData = null;

// Batas Kapasitas Paket Mabar (Hybrid Hemat Database)
const TIER_CAPACITY = {
    bronze: 1,
    silver: 2,
    gold: 3,
    admin: 100
};

// ==========================================================
// 1. AUTHENTICATION & USER PROFILE INITIALIZATION
// ==========================================================
window.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 [MENUJU ASN] Inisialisasi Aplikasi CBT SKD CPNS 2026...");
    
    onAuthStateChanged(auth, async (user) => {
        window.currentUser = user;
        if (user) {
            await loadUserProfile(user);
        } else {
            window.currentUserProfile = { tier: 'free', isPaid: false };
        }
        updateAuthUI(user);
    });

    // Check Auto-Join URL Parameter (?room=XXXXX)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        window.gabungRoomOtomatis(roomParam);
    }
});

async function loadUserProfile(user) {
    const email = (user.email || '').toLowerCase().trim();
    if (ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email)) {
        window.currentUserProfile = { tier: 'admin', isPaid: true, isAdmin: true };
        return;
    }
    try {
        const uSnap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
        if (uSnap.exists()) {
            const d = uSnap.data();
            window.currentUserProfile = {
                tier: d.tier || 'free',
                isPaid: d.isPaid === true,
                isAdmin: false
            };
        } else {
            // Inisialisasi profil awal akun free
            await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
                uid: user.uid,
                email: email,
                nama: user.displayName || 'Pejuang ASN',
                tier: 'free',
                isPaid: false,
                createdAt: Date.now()
            }, { merge: true }).catch(() => {});
            window.currentUserProfile = { tier: 'free', isPaid: false, isAdmin: false };
        }
    } catch (e) {
        console.warn("Gagal load profil user:", e);
        window.currentUserProfile = { tier: 'free', isPaid: false, isAdmin: false };
    }
}

function updateAuthUI(user) {
    const btnAuth = document.getElementById('btnAuth');
    const userProfileEl = document.getElementById('userProfileBadge');
    const preLoginEl = document.getElementById('preLoginLanding');
    const lobbyEl = document.getElementById('lobbySection');
    const dashUserName = document.getElementById('dashUserName');
    const sidebarTierLabel = document.getElementById('sidebarTierLabel');
    const kpiTierValue = document.getElementById('kpiTierValue');

    if (user) {
        let firstName = user.displayName ? user.displayName.split(' ')[0] : 'Pejuang ASN';
        if (firstName.toUpperCase().includes('PRO-TAMA')) firstName = 'MENUJU ASN';
        const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
        const tierText = prof.isAdmin ? 'ADMIN' : String(prof.tier || 'free').toUpperCase();

        if (btnAuth) btnAuth.style.display = 'none';
        if (userProfileEl) {
            const tierBadge = prof.isAdmin
                ? `<span style="background:#f59e0b; color:#0f172a; font-size:0.68rem; font-weight:800; padding:2px 7px; border-radius:10px;">ADMIN</span>`
                : (prof.isPaid
                    ? `<span style="background:#10b981; color:white; font-size:0.68rem; font-weight:800; padding:2px 7px; border-radius:10px;">${tierText}</span>`
                    : `<span style="background:rgba(255,255,255,0.18); color:#cbd5e1; font-size:0.68rem; font-weight:700; padding:2px 7px; border-radius:10px;">FREE</span>`);

            userProfileEl.style.display = 'flex';
            userProfileEl.innerHTML = `
                <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'User')}" style="width:30px; height:30px; border-radius:50%; border:1.5px solid #f59e0b;" />
                <span style="font-weight:700; font-size:0.82rem; color:white;">${firstName}</span>
                ${tierBadge}
                <button onclick="window.eksekusiLogout()" style="background:none; border:none; color:#f87171; cursor:pointer; font-size:0.85rem;" title="Keluar"><i class="fas fa-sign-out-alt"></i></button>
            `;
        }
        if (dashUserName) dashUserName.textContent = firstName;
        if (sidebarTierLabel) sidebarTierLabel.textContent = prof.isPaid || prof.isAdmin ? `PAKET ${tierText}` : 'AKUN FREE';
        if (kpiTierValue) kpiTierValue.textContent = tierText;

        if (preLoginEl) preLoginEl.style.display = 'none';
        if (lobbyEl && window.currentAppMode === 'lobby') {
            lobbyEl.style.display = 'flex';
        }
    } else {
        if (btnAuth) btnAuth.style.display = 'inline-flex';
        if (userProfileEl) userProfileEl.style.display = 'none';
        if (preLoginEl) preLoginEl.style.display = 'block';
        if (lobbyEl) lobbyEl.style.display = 'none';
    }
}

window.eksekusiLoginGoogle = async () => {
    try {
        await signInWithPopup(auth, provider);
        Swal.fire({
            icon: 'success',
            title: 'Berhasil Masuk',
            text: 'Selamat datang di Menuju ASN!',
            timer: 1500,
            showConfirmButton: false
        });
    } catch (err) {
        console.error("Login gagal:", err);
        Swal.fire('Gagal Masuk', err.message, 'error');
    }
};

window.eksekusiLogout = async () => {
    const res = await Swal.fire({
        title: 'Keluar Akun?',
        text: 'Anda yakin ingin keluar dari Menuju ASN?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Keluar',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#dc2626'
    });
    if (res.isConfirmed) {
        await signOut(auth);
        window.location.reload();
    }
};

window.switchAppView = (viewName) => {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) targetView.classList.add('active');

    document.querySelectorAll('.sidebar-item, .mob-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.kirimPesanDiskusi = (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInputText');
    const box = document.getElementById('chatMessagesBox');
    if (!input || !box) return;
    const text = input.value.trim();
    if (!text) return;

    const user = window.currentUser;
    const nama = user && user.displayName ? user.displayName.split(' ')[0] : 'Pejuang ASN';
    const initial = nama.charAt(0).toUpperCase();

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg mine';
    msgEl.innerHTML = `
        <div class="chat-avatar">${initial}</div>
        <div class="chat-bubble">
            <div class="chat-meta"><strong>${nama}</strong> <span>Baru saja</span></div>
            <p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>
    `;
    box.appendChild(msgEl);
    box.scrollTop = box.scrollHeight;
    input.value = '';
};

window.pilihPaketLanding = (namaPaket, harga) => {
    if (window.currentUser) {
        return window.switchAppView('upgrade');
    }
    window.pendingSelectedPackage = { namaPaket, harga };
    return window.eksekusiLoginGoogle();
};

window.mulaiUjiCobaGratis = (subtes) => {
    if (window.currentUser) {
        return window.mulaiSingleplayer(subtes);
    }
    window.pendingTrialSubtes = subtes;
    return window.eksekusiLoginGoogle();
};

window.switchLobbyTab = (tab) => {
    const catPanel = document.getElementById('panelCatSingleplayer');
    const cbtPanel = document.getElementById('panelCbtMultiplayer');
    const tabCatBtn = document.getElementById('tabCatBtn');
    const tabCbtBtn = document.getElementById('tabCbtBtn');

    if (tab === 'cbt') {
        if (catPanel) catPanel.style.display = 'none';
        if (cbtPanel) cbtPanel.style.display = 'block';
        if (tabCatBtn) tabCatBtn.classList.remove('active');
        if (tabCbtBtn) tabCbtBtn.classList.add('active');
    } else {
        if (catPanel) catPanel.style.display = 'block';
        if (cbtPanel) cbtPanel.style.display = 'none';
        if (tabCatBtn) tabCatBtn.classList.add('active');
        if (tabCbtBtn) tabCbtBtn.classList.remove('active');
    }
};

window.filterPaketSoal = (filter, btnEl) => {
    document.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    document.querySelectorAll('.packet-card').forEach(card => {
        const tier = card.getAttribute('data-tier');
        const cat = card.getAttribute('data-cat');
        const show =
            filter === 'all' ||
            (filter === 'free' && tier === 'free') ||
            (filter === 'paid' && tier === 'paid') ||
            (filter === 'subtes' && cat === 'subtes');
        card.style.display = show ? 'flex' : 'none';
    });
};

window.bukaModalUpgrade = (namaFitur, infoHarga) => {
    Swal.fire({
        title: `🔒 ${namaFitur}`,
        html: `
            <p style="font-size:0.9rem; color:#475569; margin-bottom:10px;">
                Fitur ini tersedia khusus untuk paket <b>${infoHarga}</b>.
            </p>
            <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:10px; font-size:0.82rem; color:#92400e;">
                💡 Hubungi Admin untuk aktivasi paket &amp; langsung buka seluruh akses belajar SKD 2026.
            </div>
        `,
        icon: 'info',
        confirmButtonText: 'Mengerti',
        confirmButtonColor: '#1e3a8a'
    });
};

window.infoPaketBelumTersedia = (namaPaket) => {
    Swal.fire({
        title: '🔒 Paket Soal Belum Tersedia',
        html: `<p style="font-size:0.9rem; color:#475569;"><b>${namaPaket}</b> masih terkunci dan sedang dalam proses penyusunan bank soal oleh tim <b>MENUJU ASN</b>.</p>`,
        icon: 'info',
        confirmButtonText: 'Mengerti',
        confirmButtonColor: '#1e3a8a'
    });
};

// ==========================================================
// 2. MODE SINGLEPLAYER & ENGINE SOAL (TANPA WRITE PER KLIK)
// ==========================================================
window.mulaiSingleplayer = (tipe) => {
    let rawData = window.DATA_SKD_CPNS || [];
    if (tipe === 'twk') {
        window.currentQuestions = rawData.filter(q => q.kategori === 'TWK');
        window.examTimeRemaining = window.currentQuestions.length * 60;
    } else if (tipe === 'tiu') {
        window.currentQuestions = rawData.filter(q => q.kategori === 'TIU');
        window.examTimeRemaining = window.currentQuestions.length * 60;
    } else if (tipe === 'tkp') {
        window.currentQuestions = rawData.filter(q => q.kategori === 'TKP');
        window.examTimeRemaining = window.currentQuestions.length * 60;
    } else {
        window.currentQuestions = [...rawData];
        window.examTimeRemaining = 100 * 60; // 100 Menit standar BKN
    }

    if (window.currentQuestions.length === 0) {
        return Swal.fire('Informasi', 'Paket soal sedang dipersiapkan.', 'info');
    }

    window.currentAppMode = 'singleplayer';
    startExamSessionUI();
};

function startExamSessionUI() {
    window.currentIdx = 0;
    window.userAnswers = {};
    window.userAnswerPoints = {};
    window.examStartTimeMs = Date.now();
    window.syncedSubtes = { TWK: false, TIU: false, TKP: false };

    document.getElementById('lobbySection').style.display = 'none';
    const heroEl = document.getElementById('heroBannerSection');
    if (heroEl) heroEl.style.display = 'none';

    const examStage = document.getElementById('examStage');
    examStage.style.display = 'block';
    examStage.innerHTML = buildExamStageMarkup();

    renderSoalSekarang();
    startExamTimer();
}

function buildExamStageMarkup() {
    return `
        <div class="exam-header">
            <div class="exam-meta">
                <span id="badgeSubtes" class="badge-subtes twk">TWK</span>
                <span id="noSoalDisplay" style="font-weight:700; font-size:0.85rem; color:#334155;">Soal 1</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                ${window.currentAppMode === 'multiplayer' ? `
                    <button onclick="window.bukaModalKlasemenMabar()" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:6px 12px; border-radius:20px; font-weight:700; font-size:0.78rem; cursor:pointer;">
                        <i class="fas fa-trophy" style="color:#d97706;"></i> Klasemen
                    </button>
                ` : ''}
                <div class="exam-timer" id="examTimerDisplay">
                    <i class="fas fa-stopwatch"></i> 100:00
                </div>
            </div>
        </div>

        <div class="question-card">
            <div class="question-text" id="questionTextDisplay">
                Memuat butir pertanyaan...
            </div>
            <div class="options-list" id="optionsListDisplay"></div>
            
            <div class="exam-nav">
                <button id="btnPrevSoal" class="btn-nav" onclick="window.prevSoal()">
                    <i class="fas fa-chevron-left"></i> Sebelumnya
                </button>
                <button id="btnNextSoal" class="btn-nav primary" onclick="window.nextSoal()">
                    Berikutnya <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        </div>
    `;
}

function startExamTimer() {
    clearInterval(window.examTimerInterval);
    const updateDisplay = () => {
        const timerEl = document.getElementById('examTimerDisplay');
        const m = Math.floor(window.examTimeRemaining / 60);
        const s = window.examTimeRemaining % 60;
        if (timerEl) {
            timerEl.innerHTML = `<i class="fas fa-stopwatch"></i> ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        if (window.examTimeRemaining <= 0) {
            clearInterval(window.examTimerInterval);
            Swal.fire({
                icon: 'warning',
                title: 'Waktu Habis!',
                text: 'Waktu pengerjaan telah berakhir. Mengirim hasil evaluasi...',
                timer: 2000,
                showConfirmButton: false
            }).then(() => {
                selesaikanUjian();
            });
        }
        window.examTimeRemaining--;
    };

    updateDisplay();
    window.examTimerInterval = setInterval(updateDisplay, 1000);
}

function renderSoalSekarang() {
    const q = window.currentQuestions[window.currentIdx];
    if (!q) return;

    const badgeEl = document.getElementById('badgeSubtes');
    if (badgeEl) {
        badgeEl.className = `badge-subtes ${q.kategori.toLowerCase()}`;
        badgeEl.innerText = `${q.kategori} • ${q.subKategori || ''}`;
    }

    const noSoalEl = document.getElementById('noSoalDisplay');
    if (noSoalEl) {
        noSoalEl.innerText = `Soal ${window.currentIdx + 1} dari ${window.currentQuestions.length}`;
    }

    const qTextEl = document.getElementById('questionTextDisplay');
    if (qTextEl) {
        qTextEl.innerText = q.soal;
    }

    const opsListEl = document.getElementById('optionsListDisplay');
    if (opsListEl) {
        const currentAns = window.userAnswers[q.id];
        opsListEl.innerHTML = q.opsi.map(opt => {
            const isSel = currentAns === opt.label;
            return `
                <div class="option-item ${isSel ? 'selected' : ''}" onclick="window.pilihJawaban('${q.id}', '${opt.label}', ${opt.poin || 0})">
                    <div class="option-circle">${opt.label}</div>
                    <div class="option-label">${opt.teks}</div>
                </div>
            `;
        }).join('');
    }

    const btnPrev = document.getElementById('btnPrevSoal');
    const btnNext = document.getElementById('btnNextSoal');
    if (btnPrev) btnPrev.style.visibility = (window.currentIdx > 0) ? 'visible' : 'hidden';
    if (btnNext) {
        if (window.currentIdx === window.currentQuestions.length - 1) {
            btnNext.innerHTML = `<i class="fas fa-flag-checkered"></i> Selesai Ujian`;
            btnNext.onclick = window.konfirmasiSelesaiUjian;
        } else {
            btnNext.innerHTML = `Berikutnya <i class="fas fa-chevron-right"></i>`;
            btnNext.onclick = window.nextSoal;
        }
    }
}

// HEMAT KUOTA: Klik opsi HANYA simpan di memori lokal (0 write ke Firestore!)
window.pilihJawaban = (qId, label, poin) => {
    window.userAnswers[qId] = label;
    window.userAnswerPoints[qId] = poin;
    renderSoalSekarang();
};

window.prevSoal = () => {
    if (window.currentIdx > 0) {
        window.currentIdx--;
        renderSoalSekarang();
    }
};

window.nextSoal = () => {
    if (window.currentIdx < window.currentQuestions.length - 1) {
        const prevQ = window.currentQuestions[window.currentIdx];
        window.currentIdx++;
        const nextQ = window.currentQuestions[window.currentIdx];

        // HEMAT KUOTA: Sync ke Firestore HANYA saat pergantian subtes (TWK -> TIU -> TKP)
        if (window.currentAppMode === 'multiplayer' && prevQ && nextQ && prevQ.kategori !== nextQ.kategori) {
            syncCheckpointToFirestore(prevQ.kategori, false);
        }

        renderSoalSekarang();
    }
};

function hitungSkorSekarang() {
    let skorTWK = 0, skorTIU = 0, skorTKP = 0;
    window.currentQuestions.forEach(q => {
        const userAns = window.userAnswers[q.id];
        if (!userAns) return;
        const opt = q.opsi.find(o => o.label === userAns);
        if (!opt) return;
        if (q.kategori === 'TWK' && opt.benar) skorTWK += 5;
        else if (q.kategori === 'TIU' && opt.benar) skorTIU += 5;
        else if (q.kategori === 'TKP') skorTKP += (opt.poin || 0);
    });
    return {
        skorTWK,
        skorTIU,
        skorTKP,
        totalSkor: skorTWK + skorTIU + skorTKP,
        totalWaktu: Math.max(1, Math.round((Date.now() - window.examStartTimeMs) / 1000))
    };
}

// Sync Checkpoint (Hanya dipanggil saat pindah subtes atau selesai ujian)
async function syncCheckpointToFirestore(subtesName, isFinal = false) {
    if (!window.activeRoomCode || !window.currentUser) return;
    if (!isFinal && subtesName && window.syncedSubtes[subtesName]) return; // Cegah tulis ulang subtes yang sama

    if (subtesName) window.syncedSubtes[subtesName] = true;
    const stats = hitungSkorSekarang();
    const uid = window.currentUser.uid;

    try {
        const roomRef = doc(db, COLLECTIONS.ROOMS, String(window.activeRoomCode));
        await updateDoc(roomRef, {
            [`players.${uid}.skor`]: stats.totalSkor,
            [`players.${uid}.skorTWK`]: stats.skorTWK,
            [`players.${uid}.skorTIU`]: stats.skorTIU,
            [`players.${uid}.skorTKP`]: stats.skorTKP,
            [`players.${uid}.totalWaktu`]: stats.totalWaktu,
            [`players.${uid}.isFinished`]: isFinal,
            [`players.${uid}.lastSeen`]: Date.now()
        });
        console.log(`📡 [HEMAT KUOTA] Sync checkpoint (${isFinal ? 'FINAL' : subtesName}) berhasil -> Skor: ${stats.totalSkor}`);
    } catch (e) {
        console.warn("Gagal sync checkpoint:", e);
    }
}

window.konfirmasiSelesaiUjian = async () => {
    const totalJawab = Object.keys(window.userAnswers).length;
    const totalSoal = window.currentQuestions.length;
    
    const res = await Swal.fire({
        title: 'Kumpulkan Lembar Ujian?',
        html: `Anda telah menjawab <b>${totalJawab}</b> dari <b>${totalSoal}</b> soal.<br><small style="color:#64748b;">Pastikan telah memeriksa kembali seluruh jawaban.</small>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Kumpulkan',
        cancelButtonText: 'Cek Lagi',
        confirmButtonColor: '#1e3a8a'
    });

    if (res.isConfirmed) {
        await selesaikanUjian();
    }
};

async function selesaikanUjian() {
    clearInterval(window.examTimerInterval);

    if (window.currentAppMode === 'multiplayer') {
        await syncCheckpointToFirestore(null, true);
    }

    const { skorTWK, skorTIU, skorTKP, totalSkor } = hitungSkorSekarang();
    const isFullSim = window.currentQuestions.length >= 15;
    const lolosTWK = skorTWK >= (isFullSim ? 25 : 15);
    const lolosTIU = skorTIU >= (isFullSim ? 25 : 15);
    const lolosTKP = skorTKP >= (isFullSim ? 20 : 15);
    const statusLolos = lolosTWK && lolosTIU && lolosTKP;

    Swal.fire({
        title: statusLolos ? '🎉 SELAMAT! MEMENUHI PASSING GRADE' : '⚠️ BELUM MEMENUHI PASSING GRADE',
        html: `
            <div style="text-align:left; font-size:0.9rem; padding:10px; background:#f8fafc; border-radius:12px; margin-top:10px;">
                <div style="font-size:1.4rem; font-weight:800; color:#1e3a8a; text-align:center; margin-bottom:12px;">
                    Total Nilai: ${totalSkor}
                </div>
                <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #e2e8f0;">
                    <span>TWK (Wawasan Kebangsaan):</span>
                    <b>${skorTWK} ${lolosTWK ? '✅ Lolos' : '❌ Kurang'}</b>
                </div>
                <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #e2e8f0;">
                    <span>TIU (Inteligensi Umum):</span>
                    <b>${skorTIU} ${lolosTIU ? '✅ Lolos' : '❌ Kurang'}</b>
                </div>
                <div style="display:flex; justify-content:space-between; padding:6px 0;">
                    <span>TKP (Karakteristik Pribadi):</span>
                    <b>${skorTKP} ${lolosTKP ? '✅ Lolos' : '❌ Kurang'}</b>
                </div>
            </div>
            ${window.currentAppMode === 'multiplayer' ? `
                <button onclick="Swal.close(); window.bukaModalKlasemenMabar();" style="margin-top:12px; width:100%; background:#d97706; color:white; border:none; padding:10px; border-radius:8px; font-weight:800; cursor:pointer;">
                    🏆 Lihat Klasemen Live Mabar
                </button>
            ` : ''}
        `,
        icon: statusLolos ? 'success' : 'warning',
        confirmButtonText: 'Kembali ke Lobby',
        confirmButtonColor: '#1e3a8a'
    }).then((r) => {
        if (r.isConfirmed || r.dismiss === Swal.DismissReason.backdrop) {
            window.kembaliKeLobby();
        }
    });
}

window.kembaliKeLobby = () => {
    clearInterval(window.examTimerInterval);
    if (window.roomUnsubscribe) {
        window.roomUnsubscribe();
        window.roomUnsubscribe = null;
    }
    window.activeRoomCode = null;
    window.latestRoomData = null;
    document.getElementById('examStage').style.display = 'none';
    document.getElementById('lobbySection').style.display = 'flex';
    const heroEl = document.getElementById('heroBannerSection');
    if (heroEl) heroEl.style.display = 'flex';
    window.currentAppMode = 'lobby';
};

// ==========================================================
// 3. MODE MULTIPLAYER (HYBRID HEMAT DB & KAPASITAS TIER)
// ==========================================================
window.bukaModalBikinRoom = () => {
    if (!window.currentUser) {
        return Swal.fire({
            title: 'Login Diperlukan',
            text: 'Silakan masuk dengan akun Google untuk membuka Room Mabar.',
            icon: 'info',
            confirmButtonText: 'Login Sekarang',
            confirmButtonColor: '#1e3a8a'
        }).then(res => {
            if (res.isConfirmed) window.eksekusiLoginGoogle();
        });
    }

    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    if (!prof.isAdmin && !prof.isPaid) {
        return Swal.fire({
            title: 'Fitur Khusus Paket Aktif',
            html: `Pembuatan Room Mabar hanya tersedia untuk pemilik paket <b>Bronze (1 org)</b>, <b>Silver (2 org)</b>, atau <b>Gold (3 org)</b>.<br><br><small style="color:#64748b;">Akun Free tetap bisa ikut mabar jika didaftarkan oleh Host melalui Whitelist Email Tamu.</small>`,
            icon: 'warning',
            confirmButtonText: 'Mengerti',
            confirmButtonColor: '#1e3a8a'
        });
    }

    const defaultTier = prof.isAdmin ? 'gold' : prof.tier;
    const tierOptionsHtml = prof.isAdmin
        ? `
            <option value="bronze">Bronze (Maks 1 Peserta)</option>
            <option value="silver">Silver (Maks 2 Peserta)</option>
            <option value="gold" selected>Gold (Maks 3 Peserta)</option>
            <option value="admin">Akbar Nasional (Maks 100 Peserta)</option>
          `
        : `<option value="${defaultTier}" selected>${defaultTier.toUpperCase()} (Maks ${TIER_CAPACITY[defaultTier] || 1} Peserta)</option>`;

    Swal.fire({
        title: '🏛️ Buka Room Mabar CPNS',
        html: `
            <div style="text-align:left; font-size:0.82rem; color:#475569; margin-bottom:10px; background:#eff6ff; padding:8px 10px; border-radius:8px; border:1px solid #bfdbfe;">
                <i class="fas fa-bolt" style="color:#2563eb;"></i> <b>Mode Hemat Database:</b> Skor peserta disinkronkan tiap pergantian subtes & selesai ujian.
            </div>
            <div style="text-align:left; margin-bottom:10px;">
                <label style="font-weight:700; font-size:0.8rem; color:#1e293b;">Nama Room:</label>
                <input id="swalInputNamaRoom" class="swal2-input" style="width:100%; margin:4px 0 10px; font-size:0.85rem;" value="Mabar SKD CPNS #${Math.floor(100+Math.random()*900)}">
            </div>
            <div style="text-align:left; margin-bottom:10px;">
                <label style="font-weight:700; font-size:0.8rem; color:#1e293b;">Kapasitas Paket Room:</label>
                <select id="swalSelectTierRoom" class="swal2-select" style="width:100%; margin:4px 0 10px; font-size:0.85rem; padding:8px; border-radius:6px; border:1px solid #cbd5e1;">
                    ${tierOptionsHtml}
                </select>
            </div>
            <div style="text-align:left; margin-bottom:10px;">
                <label style="font-weight:700; font-size:0.8rem; color:#15803d;">Whitelist Email Tamu (Bypass Akun Free):</label>
                <textarea id="swalInputGuestEmails" class="swal2-textarea" style="width:100%; height:65px; margin:4px 0; font-size:0.82rem; font-family:inherit;" placeholder="teman1@gmail.com, teman2@gmail.com"></textarea>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '🚀 Buka Room Sekarang',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#1e3a8a',
        preConfirm: () => {
            const nama = document.getElementById('swalInputNamaRoom')?.value.trim() || 'Room Mabar CPNS';
            const tier = document.getElementById('swalSelectTierRoom')?.value || defaultTier;
            const rawEmails = document.getElementById('swalInputGuestEmails')?.value.trim() || '';
            const emailList = Array.from(new Set(
                rawEmails.split(/[\n,;]+/)
                    .map(e => e.trim().toLowerCase())
                    .filter(e => e.length > 3 && e.includes('@') && e.includes('.'))
            ));
            return { nama, tier, emailList };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const { nama, tier, emailList } = result.value;
            await eksekusiBikinRoom(nama, tier, emailList);
        }
    });
};

async function eksekusiBikinRoom(namaRoom, tier, guestEmails) {
    const kodeRoom = Math.floor(10000 + Math.random() * 90000).toString();
    const u = window.currentUser;
    const maxPlayers = TIER_CAPACITY[tier] || 2;

    Swal.fire({ title: 'Menyiapkan Room Mabar...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const roomRef = doc(db, COLLECTIONS.ROOMS, kodeRoom);
        await setDoc(roomRef, {
            nama: namaRoom,
            kode: kodeRoom,
            tier: tier,
            maxPlayers: maxPlayers,
            hostUid: u.uid,
            hostName: u.displayName || 'Host',
            hostEmail: (u.email || '').toLowerCase(),
            status: 'waiting',
            waktuPerSoal: 54,
            allowedGuestEmails: guestEmails,
            createdAt: Date.now(),
            players: {
                [u.uid]: {
                    uid: u.uid,
                    nama: u.displayName || 'Host',
                    photoURL: u.photoURL || null,
                    skor: 0,
                    skorTWK: 0,
                    skorTIU: 0,
                    skorTKP: 0,
                    totalWaktu: 0,
                    isFinished: false,
                    role: 'HOST',
                    email: (u.email || '').toLowerCase(),
                    lastSeen: Date.now()
                }
            }
        });

        Swal.close();
        window.activeRoomCode = kodeRoom;
        bukaWaitingRoom(kodeRoom);
    } catch (err) {
        console.error("Gagal buat room:", err);
        Swal.fire('Gagal Membuat Room', err.message, 'error');
    }
}

window.bukaModalGabungRoom = () => {
    Swal.fire({
        title: '🔑 Masuk Room Mabar',
        input: 'text',
        inputLabel: 'Masukkan 5 Digit Kode Room:',
        inputPlaceholder: 'Contoh: 76352',
        showCancelButton: true,
        confirmButtonText: 'Gabung Room',
        confirmButtonColor: '#1e3a8a',
        inputValidator: (val) => {
            if (!val || val.trim().length !== 5) return 'Kode room harus 5 digit angka!';
        }
    }).then(async (res) => {
        if (res.isConfirmed) {
            window.gabungRoom(res.value.trim());
        }
    });
};

window.gabungRoom = async (kodeRoom) => {
    if (!window.currentUser) {
        return Swal.fire({
            title: 'Login Diperlukan',
            text: 'Silakan login terlebih dahulu untuk bergabung ke room mabar.',
            icon: 'info',
            confirmButtonText: 'Login Sekarang',
            confirmButtonColor: '#1e3a8a'
        }).then(res => {
            if (res.isConfirmed) window.eksekusiLoginGoogle();
        });
    }

    Swal.fire({ title: 'Menghubungkan ke Room...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const roomRef = doc(db, COLLECTIONS.ROOMS, String(kodeRoom));
        const snap = await getDoc(roomRef);

        if (!snap.exists()) {
            return Swal.fire('Room Tidak Ditemukan', 'Kode room salah atau room sudah ditutup oleh Host.', 'error');
        }

        const dataRoom = snap.data();
        const u = window.currentUser;
        const myEmail = (u.email || '').toLowerCase().trim();
        const guestEmails = (Array.isArray(dataRoom.allowedGuestEmails) ? dataRoom.allowedGuestEmails : []).map(e => e.toLowerCase().trim());
        const isGuest = guestEmails.includes(myEmail);
        const prof = window.currentUserProfile || { isPaid: false, isAdmin: false };

        const existingPlayers = dataRoom.players || {};
        const alreadyJoined = Boolean(existingPlayers[u.uid]);
        const maxPlayers = dataRoom.maxPlayers || 2;

        // Validasi Hak Akses (Harus Paid / Admin / Whitelisted Guest)
        if (!alreadyJoined && !prof.isAdmin && !prof.isPaid && !isGuest) {
            return Swal.fire('Akses Terbatas', 'Room ini hanya untuk peserta berbayar aktif atau Tamu Undangan yang emailnya telah didaftarkan oleh Host.', 'warning');
        }

        // Validasi Batas Kapasitas Room (2 / 5 / 10)
        if (!alreadyJoined && !prof.isAdmin && Object.keys(existingPlayers).length >= maxPlayers) {
            return Swal.fire('Room Penuh!', `Kapasitas maksimal paket ${(dataRoom.tier || 'bronze').toUpperCase()} (${maxPlayers} peserta) telah penuh.`, 'warning');
        }

        if (!alreadyJoined) {
            await updateDoc(roomRef, {
                [`players.${u.uid}`]: {
                    uid: u.uid,
                    nama: u.displayName || 'Peserta',
                    photoURL: u.photoURL || null,
                    skor: 0,
                    skorTWK: 0,
                    skorTIU: 0,
                    skorTKP: 0,
                    totalWaktu: 0,
                    isFinished: false,
                    role: isGuest ? 'GUEST' : (dataRoom.hostUid === u.uid ? 'HOST' : 'PESERTA'),
                    isGuest: isGuest,
                    email: myEmail,
                    lastSeen: Date.now()
                }
            });
        }

        Swal.close();
        if (isGuest && !alreadyJoined) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Akses Tamu Undangan Terverifikasi 🎟️',
                showConfirmButton: false,
                timer: 2500
            });
        }

        window.activeRoomCode = kodeRoom;
        bukaWaitingRoom(kodeRoom);
    } catch (err) {
        console.error("Gagal gabung room:", err);
        Swal.fire('Gagal Gabung', err.message, 'error');
    }
};

window.gabungRoomOtomatis = (kodeRoom) => {
    setTimeout(() => {
        window.gabungRoom(kodeRoom);
    }, 1200);
};

function bukaWaitingRoom(kodeRoom) {
    const linkInvite = `${window.location.origin}${window.location.pathname}?room=${kodeRoom}`;
    const roomRef = doc(db, COLLECTIONS.ROOMS, String(kodeRoom));
    let hasStartedExamClient = false;

    if (window.roomUnsubscribe) window.roomUnsubscribe();
    window.roomUnsubscribe = onSnapshot(roomRef, (docSnap) => {
        if (!docSnap.exists()) {
            Swal.fire('Room Ditutup', 'Host telah membubarkan room ini.', 'info').then(() => window.kembaliKeLobby());
            return;
        }

        const data = docSnap.data();
        window.latestRoomData = data;
        const players = data.players || {};
        const isHost = data.hostUid === window.currentUser?.uid;

        // Jika Host sudah klik MULAI MABAR, otomatis masuk ke ujian
        if (data.status === 'ujian' && !hasStartedExamClient) {
            hasStartedExamClient = true;
            window.currentAppMode = 'multiplayer';
            window.currentQuestions = [...(window.DATA_SKD_CPNS || [])];
            window.examTimeRemaining = 100 * 60;
            startExamSessionUI();
            return;
        }

        if (data.status !== 'waiting') return;

        document.getElementById('lobbySection').style.display = 'none';
        const heroEl = document.getElementById('heroBannerSection');
        if (heroEl) heroEl.style.display = 'none';

        const examStage = document.getElementById('examStage');
        examStage.style.display = 'block';

        let playerTilesHtml = Object.values(players).map(p => {
            const isGuestBadge = (p.role === 'GUEST' || p.isGuest) ? `<span style="background:#ecfdf5; color:#059669; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:10px; border:1px solid #a7f3d0;"><i class="fas fa-ticket-alt"></i> TAMU</span>` : '';
            const isHostBadge = (p.role === 'HOST' || p.uid === data.hostUid) ? `<span style="background:#fef3c7; color:#b45309; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:10px; border:1px solid #fde68a;">👑 HOST</span>` : '';
            return `
                <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:12px; display:flex; align-items:center; gap:10px; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
                    <img src="${p.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.nama)}" style="width:40px; height:40px; border-radius:50%; border:2px solid #2563eb;" />
                    <div style="text-align:left;">
                        <div style="font-weight:700; font-size:0.88rem; color:#1e293b;">${p.nama}</div>
                        <div style="display:flex; gap:6px; margin-top:2px;">${isHostBadge} ${isGuestBadge}</div>
                    </div>
                </div>
            `;
        }).join('');

        examStage.innerHTML = `
            <div style="background:white; border-radius:16px; padding:24px; border:1px solid #e2e8f0; box-shadow:0 8px 24px rgba(0,0,0,0.05); text-align:center;">
                <div style="display:inline-flex; align-items:center; gap:8px; background:#eff6ff; color:#1d4ed8; padding:6px 16px; border-radius:20px; font-weight:800; font-size:0.82rem; margin-bottom:10px;">
                    <i class="fas fa-satellite-dish fa-spin"></i> WAITING ROOM • PAKET ${(data.tier || 'bronze').toUpperCase()} (MAKS ${data.maxPlayers || 1} PESERTA)
                </div>
                <h2 style="font-size:1.35rem; font-weight:800; color:#1e3a8a; margin-bottom:4px;">${data.nama}</h2>
                <div style="font-size:2rem; font-weight:900; letter-spacing:4px; color:#d97706; margin:8px 0; font-family:monospace;">
                    ${kodeRoom}
                </div>
                <div style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin-bottom:20px;">
                    <button onclick="navigator.clipboard.writeText('${linkInvite}'); Swal.fire('Link Disalin!', 'Kirim link ini ke teman untuk mabar langsung.', 'success');" style="background:#2563eb; color:white; border:none; padding:8px 16px; border-radius:20px; font-weight:700; font-size:0.8rem; cursor:pointer;">
                        <i class="fas fa-link"></i> Salin Link Invite
                    </button>
                    ${isHost ? `
                        <button onclick="window.kelolaEmailTamu('${kodeRoom}')" style="background:#059669; color:white; border:none; padding:8px 16px; border-radius:20px; font-weight:700; font-size:0.8rem; cursor:pointer;">
                            <i class="fas fa-user-plus"></i> Whitelist Tamu
                        </button>
                    ` : ''}
                </div>
                
                <div style="text-align:left; font-weight:800; font-size:0.9rem; color:#1e293b; margin-bottom:12px; display:flex; justify-content:space-between;">
                    <span>Peserta Terhubung (${Object.keys(players).length} / ${data.maxPlayers || 2})</span>
                    <span style="color:#059669; font-size:0.8rem;"><i class="fas fa-shield-alt"></i> Mode Hemat Kuota Aktif</span>
                </div>
                
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:24px;">
                    ${playerTilesHtml}
                </div>

                <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
                    <button onclick="window.kembaliKeLobby()" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:10px 20px; border-radius:8px; font-weight:700; font-size:0.85rem; cursor:pointer;">
                        Keluar Room
                    </button>
                    ${isHost ? `
                        <button onclick="window.mulaiUjianMultiplayer('${kodeRoom}')" style="background:#d97706; color:white; border:none; padding:10px 24px; border-radius:8px; font-weight:800; font-size:0.95rem; cursor:pointer; box-shadow:0 4px 12px rgba(217, 119, 6, 0.3);">
                            <i class="fas fa-rocket"></i> MULAI MABAR
                        </button>
                    ` : `
                        <div style="padding:10px 20px; background:#fffbeb; color:#b45309; border-radius:8px; font-weight:700; font-size:0.85rem;">
                            <i class="fas fa-spinner fa-spin"></i> Menunggu Host Memulai Ujian...
                        </div>
                    `}
                </div>
            </div>
        `;
    });
}

window.kelolaEmailTamu = async (kodeRoom) => {
    const roomRef = doc(db, COLLECTIONS.ROOMS, String(kodeRoom));
    const snap = await getDoc(roomRef);
    const existing = snap.data()?.allowedGuestEmails || [];
    const textCurrent = existing.join('\n');

    const { value: newText } = await Swal.fire({
        title: '🎟️ Kelola Email Tamu Undangan',
        html: `
            <div style="text-align:left; font-size:0.82rem; color:#475569; margin-bottom:8px;">
                Daftarkan alamat email pengguna <b>Akun Free</b> agar mendapatkan akses masuk ke room ini (tetap mengikuti batas kapasitas room).
            </div>
            <textarea id="swalUpdateGuestEmails" class="swal2-textarea" style="width:100%; height:110px; font-size:0.85rem;" placeholder="contoh1@gmail.com\ncontoh2@gmail.com">${textCurrent}</textarea>
        `,
        showCancelButton: true,
        confirmButtonText: 'Simpan Tamu',
        confirmButtonColor: '#059669',
        preConfirm: () => document.getElementById('swalUpdateGuestEmails')?.value || ''
    });

    if (newText !== undefined) {
        const parsed = Array.from(new Set(
            newText.split(/[\n,;]+/)
                .map(e => e.trim().toLowerCase())
                .filter(e => e.length > 3 && e.includes('@') && e.includes('.'))
        ));
        await updateDoc(roomRef, { allowedGuestEmails: parsed });
        Swal.fire('Disimpan', `Berhasil mendaftarkan ${parsed.length} email tamu.`, 'success');
    }
};

window.mulaiUjianMultiplayer = async (kodeRoom) => {
    try {
        await updateDoc(doc(db, COLLECTIONS.ROOMS, String(kodeRoom)), {
            status: 'ujian',
            startedAt: Date.now()
        });
    } catch (err) {
        Swal.fire('Gagal Memulai', err.message, 'error');
    }
};

// Klasemen Live Mabar (Tie-Breaker Resmi BKN: Total -> TKP -> TIU -> TWK -> Waktu)
window.bukaModalKlasemenMabar = () => {
    const data = window.latestRoomData || {};
    const players = Object.values(data.players || {});
    
    players.sort((a, b) => {
        if ((b.skor || 0) !== (a.skor || 0)) return (b.skor || 0) - (a.skor || 0);
        if ((b.skorTKP || 0) !== (a.skorTKP || 0)) return (b.skorTKP || 0) - (a.skorTKP || 0);
        if ((b.skorTIU || 0) !== (a.skorTIU || 0)) return (b.skorTIU || 0) - (a.skorTIU || 0);
        if ((b.skorTWK || 0) !== (a.skorTWK || 0)) return (b.skorTWK || 0) - (a.skorTWK || 0);
        return (a.totalWaktu || 999999) - (b.totalWaktu || 999999);
    });

    const rows = players.map((p, idx) => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px; border-bottom:1px solid #e2e8f0; background:${p.uid === window.currentUser?.uid ? '#eff6ff' : 'white'};">
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-weight:900; color:${idx === 0 ? '#d97706' : '#64748b'}; width:22px;">#${idx + 1}</span>
                <div style="text-align:left;">
                    <div style="font-weight:700; font-size:0.86rem; color:#1e293b;">${p.nama} ${p.isFinished ? '✅' : '⏳'}</div>
                    <div style="font-size:0.72rem; color:#64748b;">TWK:${p.skorTWK || 0} | TIU:${p.skorTIU || 0} | TKP:${p.skorTKP || 0}</div>
                </div>
            </div>
            <div style="font-weight:800; font-size:1rem; color:#1e3a8a;">${p.skor || 0}</div>
        </div>
    `).join('');

    Swal.fire({
        title: '🏆 Klasemen Live Mabar',
        html: `
            <div style="font-size:0.75rem; color:#64748b; margin-bottom:10px;">
                Urutan tie-breaker BKN: Total Skor ➔ TKP ➔ TIU ➔ TWK ➔ Waktu.
            </div>
            <div style="max-height:300px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:10px;">
                ${rows || '<div style="padding:16px; color:#94a3b8;">Belum ada data skor.</div>'}
            </div>
        `,
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#1e3a8a'
    });
};
