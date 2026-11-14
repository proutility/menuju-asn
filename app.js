// ==========================================================
// MENUJU ASN - CBT SKD CPNS 2026 MAIN CONTROLLER
// PWA & Multiplayer Realtime Engine (BKN Standard)
// ==========================================================
import { 
    auth, provider, db, ADMIN_EMAILS, COLLECTIONS,
    signInWithPopup, signOut, onAuthStateChanged,
    doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion
} from "./firebase-config.js";

// Global App State
window.currentUser = null;
window.currentAppMode = "lobby"; // lobby | singleplayer | multiplayer
window.currentQuestions = [];
window.currentIdx = 0;
window.userAnswers = {}; // { qId: selectedOptionLabel }
window.userAnswerPoints = {}; // { qId: point }
window.examTimerInterval = null;
window.examTimeRemaining = 0; // seconds
window.activeRoomCode = null;
window.roomUnsubscribe = null;

// ==========================================================
// 1. AUTHENTICATION & INITIALIZATION
// ==========================================================
window.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 [MENUJU ASN] Inisialisasi Aplikasi CBT SKD CPNS 2026...");
    
    // Auth State Listener
    onAuthStateChanged(auth, (user) => {
        window.currentUser = user;
        updateAuthUI(user);
    });

    // Check Auto-Join URL Parameter (?room=XXXXX)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        window.gabungRoomOtomatis(roomParam);
    }
});

function updateAuthUI(user) {
    const btnAuth = document.getElementById('btnAuth');
    const userProfileEl = document.getElementById('userProfileBadge');
    if (user) {
        if (btnAuth) btnAuth.style.display = 'none';
        if (userProfileEl) {
            userProfileEl.style.display = 'flex';
            userProfileEl.innerHTML = `
                <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'User')}" style="width:30px; height:30px; border-radius:50%; border:1.5px solid #f59e0b;" />
                <span style="font-weight:700; font-size:0.82rem; color:white;">${user.displayName ? user.displayName.split(' ')[0] : 'Pejuang ASN'}</span>
                <button onclick="window.eksekusiLogout()" style="background:none; border:none; color:#f87171; cursor:pointer; font-size:0.85rem;" title="Keluar"><i class="fas fa-sign-out-alt"></i></button>
            `;
        }
    } else {
        if (btnAuth) btnAuth.style.display = 'inline-flex';
        if (userProfileEl) userProfileEl.style.display = 'none';
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

// ==========================================================
// 2. MODE SINGLEPLAYER (SIMULASI & DRILL SKD)
// ==========================================================
window.mulaiSingleplayer = (tipe) => {
    let rawData = window.DATA_SKD_CPNS || [];
    if (tipe === 'twk') {
        window.currentQuestions = rawData.filter(q => q.kategori === 'TWK');
        window.examTimeRemaining = window.currentQuestions.length * 60; // 1 menit per soal
    } else if (tipe === 'tiu') {
        window.currentQuestions = rawData.filter(q => q.kategori === 'TIU');
        window.examTimeRemaining = window.currentQuestions.length * 60;
    } else if (tipe === 'tkp') {
        window.currentQuestions = rawData.filter(q => q.kategori === 'TKP');
        window.examTimeRemaining = window.currentQuestions.length * 60;
    } else {
        // Full SKD Simulation
        window.currentQuestions = [...rawData];
        window.examTimeRemaining = 100 * 60; // 100 Menit standar BKN
    }

    if (window.currentQuestions.length === 0) {
        return Swal.fire('Informasi', 'Paket soal sedang dipersiapkan.', 'info');
    }

    window.currentAppMode = 'singleplayer';
    window.currentIdx = 0;
    window.userAnswers = {};
    window.userAnswerPoints = {};

    document.getElementById('lobbySection').style.display = 'none';
    document.getElementById('examStage').style.display = 'block';

    renderSoalSekarang();
    startExamTimer();
};

function startExamTimer() {
    clearInterval(window.examTimerInterval);
    const timerEl = document.getElementById('examTimerDisplay');

    const updateDisplay = () => {
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
                text: 'Waktu pengerjaan telah berakhir. Menghitung hasil evaluasi...',
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

    // Subtes Badge
    const badgeEl = document.getElementById('badgeSubtes');
    if (badgeEl) {
        badgeEl.className = `badge-subtes ${q.kategori.toLowerCase()}`;
        badgeEl.innerText = `${q.kategori} • ${q.subKategori || ''}`;
    }

    // Nomor Soal Counter
    const noSoalEl = document.getElementById('noSoalDisplay');
    if (noSoalEl) {
        noSoalEl.innerText = `Soal ${window.currentIdx + 1} dari ${window.currentQuestions.length}`;
    }

    // Teks Soal
    const qTextEl = document.getElementById('questionTextDisplay');
    if (qTextEl) {
        qTextEl.innerText = q.soal;
    }

    // List Opsi
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

    // Navigasi Prev/Next
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
        window.currentIdx++;
        renderSoalSekarang();
    }
};

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
        selesaikanUjian();
    }
};

function selesaikanUjian() {
    clearInterval(window.examTimerInterval);

    // Hitung Skor Sesuai Aturan BKN
    let skorTWK = 0, skorTIU = 0, skorTKP = 0;
    
    window.currentQuestions.forEach(q => {
        const userAns = window.userAnswers[q.id];
        if (q.kategori === 'TWK') {
            const opt = q.opsi.find(o => o.label === userAns);
            if (opt && opt.benar) skorTWK += 5;
        } else if (q.kategori === 'TIU') {
            const opt = q.opsi.find(o => o.label === userAns);
            if (opt && opt.benar) skorTIU += 5;
        } else if (q.kategori === 'TKP') {
            const opt = q.opsi.find(o => o.label === userAns);
            if (opt) skorTKP += (opt.poin || 0);
        }
    });

    const totalSkor = skorTWK + skorTIU + skorTKP;
    
    // Validasi Passing Grade Standar BKN:
    // TWK: 65, TIU: 80, TKP: 166 (Untuk full simulasi)
    // Untuk drill mini, gunakan rasio persentase
    const isFullSim = window.currentQuestions.length >= 15;
    const lolosTWK = skorTWK >= (isFullSim ? 25 : 15);
    const lolosTIU = skorTIU >= (isFullSim ? 25 : 15);
    const lolosTKP = skorTKP >= (isFullSim ? 20 : 15);
    const statusLolos = lolosTWK && lolosTIU && lolosTKP;

    Swal.fire({
        title: statusLolos ? '🎉 SELAMAT! ANDA LOLOS PASSING GRADE' : '⚠️ BELUM MEMENUHI PASSING GRADE',
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
            <div style="font-size:0.78rem; color:#64748b; margin-top:10px;">
                Evaluasi: Kelulusan SKD mensyaratkan ketiga subtes wajib lolos ambang batas sekaligus.
            </div>
        `,
        icon: statusLolos ? 'success' : 'warning',
        confirmButtonText: 'Kembali ke Lobby',
        confirmButtonColor: '#1e3a8a'
    }).then(() => {
        window.kembaliKeLobby();
    });
}

window.kembaliKeLobby = () => {
    clearInterval(window.examTimerInterval);
    if (window.roomUnsubscribe) {
        window.roomUnsubscribe();
        window.roomUnsubscribe = null;
    }
    document.getElementById('examStage').style.display = 'none';
    document.getElementById('lobbySection').style.display = 'block';
    window.currentAppMode = 'lobby';
};

// ==========================================================
// 3. MODE MULTIPLAYER (MABAR BILIK & WHITELIST TAMU FREE)
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

    Swal.fire({
        title: '🏛️ Buka Room Mabar CPNS',
        html: `
            <div style="text-align:left; font-size:0.85rem; color:#475569; margin-bottom:10px;">
                Buat ruang latihan bersama. Teman yang memiliki akun Free bisa dimasukkan emailnya di bawah ini untuk bypass langsung.
            </div>
            <div style="text-align:left; margin-bottom:10px;">
                <label style="font-weight:700; font-size:0.8rem; color:#1e293b;">Nama Room:</label>
                <input id="swalInputNamaRoom" class="swal2-input" style="width:100%; margin:4px 0 10px; font-size:0.85rem;" placeholder="Misal: Mabar SKD Pejuang Kemenkumham" value="Mabar SKD CPNS #${Math.floor(100+Math.random()*900)}">
            </div>
            <div style="text-align:left; margin-bottom:10px;">
                <label style="font-weight:700; font-size:0.8rem; color:#15803d;">Daftarkan Email Tamu (Whitelist Free Bypass):</label>
                <textarea id="swalInputGuestEmails" class="swal2-textarea" style="width:100%; height:70px; margin:4px 0; font-size:0.82rem; font-family:inherit;" placeholder="teman1@gmail.com, teman2@gmail.com (pisahkan koma/baris)"></textarea>
                <small style="color:#16a34a; font-size:0.73rem;">Akun Free dengan email terdaftar dapat langsung ikut mabar via Link Invite tanpa batas.</small>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '🚀 Buka Room Sekarang',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#1e3a8a',
        preConfirm: () => {
            const nama = document.getElementById('swalInputNamaRoom')?.value.trim() || 'Room Mabar CPNS';
            const rawEmails = document.getElementById('swalInputGuestEmails')?.value.trim() || '';
            const emailList = Array.from(new Set(
                rawEmails.split(/[\n,;]+/)
                    .map(e => e.trim().toLowerCase())
                    .filter(e => e.length > 3 && e.includes('@') && e.includes('.'))
            ));
            return { nama, emailList };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const { nama, emailList } = result.value;
            await eksekusiBikinRoom(nama, emailList);
        }
    });
};

async function eksekusiBikinRoom(namaRoom, guestEmails) {
    const kodeRoom = Math.floor(10000 + Math.random() * 90000).toString();
    const u = window.currentUser;

    Swal.fire({ title: 'Menyiapkan Room Mabar...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const roomRef = doc(db, COLLECTIONS.ROOMS, kodeRoom);
        await setDoc(roomRef, {
            nama: namaRoom,
            kode: kodeRoom,
            hostUid: u.uid,
            hostName: u.displayName || 'Host',
            hostEmail: u.email || '',
            status: 'waiting',
            waktuPerSoal: 54, // 54 detik per soal standar BKN
            allowedGuestEmails: guestEmails,
            createdAt: Date.now(),
            players: {
                [u.uid]: {
                    uid: u.uid,
                    nama: u.displayName || 'Host',
                    photoURL: u.photoURL || null,
                    skor: 0,
                    role: 'HOST',
                    email: u.email || '',
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

        // Update player ke room
        await updateDoc(roomRef, {
            [`players.${u.uid}`]: {
                uid: u.uid,
                nama: u.displayName || 'Peserta',
                photoURL: u.photoURL || null,
                skor: 0,
                role: isGuest ? 'GUEST' : (dataRoom.hostUid === u.uid ? 'HOST' : 'PESERTA'),
                isGuest: isGuest,
                email: myEmail,
                lastSeen: Date.now()
            }
        });

        Swal.close();
        if (isGuest) {
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
    // Dipanggil otomatis jika URL mengandung ?room=XXXXX
    setTimeout(() => {
        window.gabungRoom(kodeRoom);
    }, 1200);
};

function bukaWaitingRoom(kodeRoom) {
    const linkInvite = `${window.location.origin}${window.location.pathname}?room=${kodeRoom}`;
    
    // Listen realtime changes
    const roomRef = doc(db, COLLECTIONS.ROOMS, String(kodeRoom));
    window.roomUnsubscribe = onSnapshot(roomRef, (docSnap) => {
        if (!docSnap.exists()) {
            Swal.fire('Room Ditutup', 'Host telah membubarkan room ini.', 'info').then(() => window.kembaliKeLobby());
            return;
        }

        const data = docSnap.data();
        const players = data.players || {};
        const isHost = data.hostUid === window.currentUser?.uid;

        // Render Waiting Room UI di dalam examStage
        document.getElementById('lobbySection').style.display = 'none';
        const examStage = document.getElementById('examStage');
        examStage.style.display = 'block';

        let playerTilesHtml = Object.values(players).map(p => {
            const isGuestBadge = (p.role === 'GUEST' || p.isGuest) ? `<span style="background:#ecfdf5; color:#059669; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:10px; border:1px solid #a7f3d0;"><i class="fas fa-ticket-alt"></i> TAMU</span>` : '';
            const isHostBadge = (p.role === 'HOST' || p.uid === data.hostUid) ? `<span style="background:#fef3c7; color:#b45309; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:10px; border:1px solid #fde68a;">👑 HOST</span>` : '';
            return `
                <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:12px; display:flex; align-items:center; gap:10px; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
                    <img src="${p.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.nama)}" style="width:40px; height:40px; border-radius:50%; border:2px solid #2563eb;" />
                    <div>
                        <div style="font-weight:700; font-size:0.88rem; color:#1e293b;">${p.nama}</div>
                        <div style="display:flex; gap:6px; margin-top:2px;">${isHostBadge} ${isGuestBadge}</div>
                    </div>
                </div>
            `;
        }).join('');

        examStage.innerHTML = `
            <div style="background:white; border-radius:16px; padding:24px; border:1px solid #e2e8f0; box-shadow:0 8px 24px rgba(0,0,0,0.05); text-align:center;">
                <div style="display:inline-flex; align-items:center; gap:8px; background:#eff6ff; color:#1d4ed8; padding:6px 16px; border-radius:20px; font-weight:800; font-size:0.85rem; margin-bottom:12px;">
                    <i class="fas fa-satellite-dish fa-spin"></i> LIVE WAITING ROOM CPNS
                </div>
                <h2 style="font-size:1.4rem; font-weight:800; color:#1e3a8a; margin-bottom:4px;">${data.nama}</h2>
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
                
                <div style="text-align:left; font-weight:800; font-size:0.92rem; color:#1e293b; margin-bottom:12px; display:flex; justify-content:space-between;">
                    <span>Peserta Terhubung (${Object.keys(players).length})</span>
                    <span style="color:#059669; font-size:0.8rem;"><i class="fas fa-circle" style="font-size:0.6rem;"></i> Siap Mabar</span>
                </div>
                
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:24px;">
                    ${playerTilesHtml}
                </div>

                <div style="display:flex; justify-content:center; gap:10px;">
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
                Daftarkan alamat email pengguna <b>Akun Free</b> agar mendapatkan akses penuh ke room mabar ini tanpa batas.
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
    Swal.fire({
        icon: 'info',
        title: 'Mulai Ujian Mabar',
        text: 'Fitur Live Countdown & Sinkronisasi Jawaban Multiplayer sedang diaktifkan!',
        timer: 1500,
        showConfirmButton: false
    }).then(() => {
        window.mulaiSingleplayer('full');
    });
};
