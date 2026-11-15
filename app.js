// ==========================================================
// MENUJU ASN - CBT SKD CPNS 2026 MAIN CONTROLLER
// PWA & Hybrid Hemat-Database Multiplayer Engine (BKN Standard)
// ==========================================================
import { 
    auth, provider, db, ADMIN_EMAILS, COLLECTIONS,
    signInWithPopup, signOut, onAuthStateChanged,
    collection, getDocs, deleteDoc, query, where, limit,
    doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion
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

// Batas Kapasitas Paket CBT Arena (Hybrid Hemat Database)
const TIER_CAPACITY = {
    bronze: 2,
    silver: 3,
    gold: 4,
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
        const firstName = user.displayName ? user.displayName.split(' ')[0] : 'Pejuang ASN';
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

        const navCmdBtn = document.getElementById('navCommandCenterBtn');
        if (navCmdBtn) navCmdBtn.style.display = prof.isAdmin ? 'flex' : 'none';

        if (preLoginEl) preLoginEl.style.display = 'none';
        if (lobbyEl && window.currentAppMode === 'lobby') {
            lobbyEl.style.display = 'flex';
        }
        if (typeof window.renderTwk40PaketCards === 'function') {
            window.renderTwk40PaketCards();
        }
        if (typeof window.renderTiu40PaketCards === 'function') {
            window.renderTiu40PaketCards();
        }
        if (typeof window.renderTkp40PaketCards === 'function') {
            window.renderTkp40PaketCards();
        }
        if (typeof window.applyAdminBypassUI === 'function') {
            window.applyAdminBypassUI();
        }
        if (typeof window.renderBrankasPembahasan === 'function') {
            window.renderBrankasPembahasan();
        }
        if (typeof window.renderBerandaProgressPanel === 'function') {
            window.renderBerandaProgressPanel();
        }
        if (typeof window.renderArenaSavedRooms === 'function') {
            window.renderArenaSavedRooms();
        }
        if (typeof window.renderArenaLeaderboardHistory === 'function') {
            window.renderArenaLeaderboardHistory();
        }
        if (typeof startInvitePopupListener === 'function') {
            startInvitePopupListener(user);
        }
    } else {
        if (window.invitePopupUnsubscribe) {
            window.invitePopupUnsubscribe();
            window.invitePopupUnsubscribe = null;
        }
        const navCmdBtn = document.getElementById('navCommandCenterBtn');
        if (navCmdBtn) navCmdBtn.style.display = 'none';
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
    if (viewName === 'command' && !window.currentUserProfile?.isAdmin) {
        return Swal.fire('Akses Ditolak', 'Halaman ini khusus Super Admin.', 'error');
    }

    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) targetView.classList.add('active');

    document.querySelectorAll('.sidebar-item, .mob-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewName === 'command') {
        window.loadCommandCenterData();
        if (typeof window.loadPusatBerita === 'function') window.loadPusatBerita();
    } else if (viewName === 'bot') {
        if (typeof window.refreshBotAndNewsView === 'function') window.refreshBotAndNewsView();
    } else if (viewName === 'beranda') {
        if (typeof window.renderSavedExamsOnBeranda === 'function') window.renderSavedExamsOnBeranda();
        if (typeof window.renderBerandaProgressPanel === 'function') window.renderBerandaProgressPanel();
    } else if (viewName === 'brankas' && typeof window.renderBrankasPembahasan === 'function') {
        window.renderBrankasPembahasan();
    } else if (viewName === 'cbt') {
        if (typeof window.renderArenaSavedRooms === 'function') window.renderArenaSavedRooms();
        if (typeof window.renderArenaLeaderboardHistory === 'function') window.renderArenaLeaderboardHistory();
    }
};

// ==========================================================
// SUPER ADMIN COMMAND CENTER (tamaverseapp@gmail.com)
// ==========================================================
window.ccCachedUsers = [];

window.switchCommandTab = (tabName) => {
    document.querySelectorAll('.cc-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-cctab') === tabName);
    });
    document.querySelectorAll('.cc-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `ccPanel-${tabName}`);
    });
};

window.loadCommandCenterData = async () => {
    if (!window.currentUserProfile?.isAdmin) return;

    try {
        // 1. Load Users (Radar Peserta & Langganan)
        const usersSnap = await getDocs(query(collection(db, COLLECTIONS.USERS), limit(100)));
        window.ccCachedUsers = [];
        let paidCount = 0;
        usersSnap.forEach(d => {
            const u = { id: d.id, ...d.data() };
            window.ccCachedUsers.push(u);
            if (u.isPaid && u.tier && u.tier !== 'free') paidCount++;
        });
        const statUsers = document.getElementById('ccStatUsers');
        const statPaid = document.getElementById('ccStatPaid');
        if (statUsers) statUsers.textContent = window.ccCachedUsers.length;
        if (statPaid) statPaid.textContent = paidCount;
        window.filterCommandUsers();

        // 2. Load Rooms (Monitor Room Mabar)
        const roomsSnap = await getDocs(query(collection(db, COLLECTIONS.ROOMS), limit(50)));
        const roomsBody = document.getElementById('ccRoomsTableBody');
        const statRooms = document.getElementById('ccStatRooms');
        if (statRooms) statRooms.textContent = roomsSnap.size;
        if (roomsBody) {
            if (roomsSnap.empty) {
                roomsBody.innerHTML = '<tr><td colspan="5" class="cc-empty">Belum ada room mabar aktif saat ini.</td></tr>';
            } else {
                let html = '';
                roomsSnap.forEach(d => {
                    const r = d.data();
                    const pCount = r.players ? Object.keys(r.players).length : 0;
                    const maxP = r.maxPlayers || 1;
                    html += `
                        <tr>
                            <td><strong>#${d.id}</strong></td>
                            <td>${r.hostName || '-'}</td>
                            <td><span class="cc-tier-badge">${String(r.tier || 'bronze').toUpperCase()}</span> (${pCount}/${maxP})</td>
                            <td>${r.status || 'waiting'}</td>
                            <td>
                                <button class="cc-btn danger" onclick="window.adminTutupRoom('${d.id}')">Tutup</button>
                            </td>
                        </tr>
                    `;
                });
                roomsBody.innerHTML = html;
            }
        }

        // 3. Load Reports (Laporan Masuk)
        const reportsSnap = await getDocs(query(collection(db, 'laporan_soal'), limit(50)));
        const reportsList = document.getElementById('ccReportsList');
        const statReports = document.getElementById('ccStatReports');
        if (statReports) statReports.textContent = reportsSnap.size;
        if (reportsList) {
            if (reportsSnap.empty) {
                reportsList.innerHTML = '<div class="cc-empty">Belum ada laporan masuk dari peserta.</div>';
            } else {
                let rHtml = '';
                const sortedReps = [];
                reportsSnap.forEach(d => sortedReps.push({ id: d.id, ...d.data() }));
                sortedReps.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
                sortedReps.forEach(rep => {
                    const status = rep.status || 'pending';
                    const tgl = rep.createdAt ? new Date(rep.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
                    rHtml += `
                        <div class="cc-report-card">
                            <div style="flex:1;">
                                <div class="cc-report-head">
                                    <strong>${rep.judul || 'Laporan Peserta'}</strong>
                                    <span class="cc-status-pill ${status}">${status.toUpperCase()}</span>
                                </div>
                                <p style="white-space:pre-line;">${rep.pesan || rep.keterangan || '-'}</p>
                                <small>Pelapor: ${rep.nama_pelapor ? rep.nama_pelapor + ' • ' : ''}${rep.email || rep.uid_pelapor || '-'} • ${tgl}</small>
                            </div>
                            <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                                ${status !== 'selesai' ? `<button class="cc-btn success" onclick="window.adminSelesaiLaporan('${rep.id}')">Tandai Selesai</button>` : ''}
                                <button class="cc-btn danger" onclick="window.adminHapusLaporan('${rep.id}')">Hapus</button>
                            </div>
                        </div>
                    `;
                });
                reportsList.innerHTML = rHtml;
            }
        }

        // 4. Load Global Settings
        const settingsSnap = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'global'));
        if (settingsSnap.exists()) {
            const s = settingsSnap.data();
            const tAkbar = document.getElementById('ccToggleAkbar');
            const tSub = document.getElementById('ccToggleFreeSubtes');
            const ann = document.getElementById('ccAnnouncementInput');
            if (tAkbar) tAkbar.checked = !!s.unlockAkbar;
            if (tSub) tSub.checked = !!s.unlockFreeSubtes;
            if (ann) ann.value = s.announcement || '';
        }
    } catch (err) {
        console.error('Gagal memuat Command Center:', err);
        Swal.fire('Gagal Memuat', err.message, 'error');
    }
};

window.filterCommandUsers = () => {
    const tbody = document.getElementById('ccUsersTableBody');
    if (!tbody) return;
    const qText = (document.getElementById('ccSearchUser')?.value || '').toLowerCase();
    const qTier = document.getElementById('ccFilterTier')?.value || 'all';

    const filtered = (window.ccCachedUsers || []).filter(u => {
        const matchText = (u.nama || '').toLowerCase().includes(qText) || (u.email || '').toLowerCase().includes(qText);
        const userTier = (u.tier || 'free').toLowerCase();
        const matchTier = qTier === 'all' || userTier === qTier;
        return matchText && matchTier;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="cc-empty">Tidak ada peserta yang cocok dengan filter.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(u => {
        const tier = (u.tier || 'free').toLowerCase();
        const blocked = !!u.isBlocked;
        return `
            <tr>
                <td>
                    <strong>${u.nama || 'Pejuang ASN'}</strong><br>
                    <small style="color:#64748b;">${u.email || '-'}</small>
                </td>
                <td><span class="cc-tier-badge ${tier}">${tier.toUpperCase()}</span></td>
                <td>${blocked ? '<span class="cc-status-pill blocked">DIBLOKIR</span>' : '<span class="cc-status-pill active">AKTIF</span>'}</td>
                <td>
                    <select id="tierSelect-${u.id}" class="cc-select-mini">
                        <option value="free" ${tier === 'free' ? 'selected' : ''}>FREE</option>
                        <option value="satuan" ${tier === 'satuan' ? 'selected' : ''}>SATUAN</option>
                        <option value="bronze" ${tier === 'bronze' ? 'selected' : ''}>BRONZE</option>
                        <option value="silver" ${tier === 'silver' ? 'selected' : ''}>SILVER</option>
                        <option value="gold" ${tier === 'gold' ? 'selected' : ''}>GOLD</option>
                    </select>
                </td>
                <td class="cc-actions-cell">
                    <button class="cc-btn primary" onclick="window.adminUbahTierUser('${u.id}')">Simpan</button>
                    <button class="cc-btn ${blocked ? 'success' : 'danger'}" onclick="window.adminToggleBlokirUser('${u.id}', ${blocked})">
                        ${blocked ? 'Buka' : 'Blokir'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
};

window.adminUbahTierUser = async (uid) => {
    const sel = document.getElementById(`tierSelect-${uid}`);
    if (!sel) return;
    const newTier = sel.value;
    const isPaid = newTier !== 'free';
    try {
        await updateDoc(doc(db, COLLECTIONS.USERS, uid), { tier: newTier, isPaid });
        Swal.fire({ icon: 'success', title: 'Paket Diperbarui', text: `User diubah ke paket ${newTier.toUpperCase()}.`, timer: 1400, showConfirmButton: false });
        window.loadCommandCenterData();
    } catch (err) {
        Swal.fire('Gagal Update', err.message, 'error');
    }
};

window.adminToggleBlokirUser = async (uid, currentBlocked) => {
    try {
        await updateDoc(doc(db, COLLECTIONS.USERS, uid), { isBlocked: !currentBlocked });
        window.loadCommandCenterData();
    } catch (err) {
        Swal.fire('Gagal', err.message, 'error');
    }
};

window.adminTutupRoom = async (roomCode) => {
    try {
        await deleteDoc(doc(db, COLLECTIONS.ROOMS, roomCode));
        Swal.fire({ icon: 'success', title: 'Room Ditutup', timer: 1200, showConfirmButton: false });
        window.loadCommandCenterData();
    } catch (err) {
        Swal.fire('Gagal Tutup Room', err.message, 'error');
    }
};

window.adminSelesaiLaporan = async (docId) => {
    try {
        await updateDoc(doc(db, 'laporan_soal', docId), { status: 'selesai' });
        window.loadCommandCenterData();
    } catch (err) {
        Swal.fire('Gagal', err.message, 'error');
    }
};

window.adminHapusLaporan = async (docId) => {
    try {
        await deleteDoc(doc(db, 'laporan_soal', docId));
        Swal.fire({ icon: 'success', title: 'Laporan Dihapus', timer: 1100, showConfirmButton: false });
        window.loadCommandCenterData();
    } catch (err) {
        Swal.fire('Gagal Hapus', err.message, 'error');
    }
};

window.adminSimpanPengaturan = async () => {
    const unlockAkbar = !!document.getElementById('ccToggleAkbar')?.checked;
    const unlockFreeSubtes = !!document.getElementById('ccToggleFreeSubtes')?.checked;
    const announcement = (document.getElementById('ccAnnouncementInput')?.value || '').trim();
    try {
        await setDoc(doc(db, COLLECTIONS.SETTINGS, 'global'), {
            unlockAkbar,
            unlockFreeSubtes,
            announcement,
            updatedAt: Date.now()
        }, { merge: true });
        Swal.fire({ icon: 'success', title: 'Pengaturan Disimpan', timer: 1400, showConfirmButton: false });
    } catch (err) {
        Swal.fire('Gagal Simpan', err.message, 'error');
    }
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
    window.activePaketSoalFilter = filter || 'all';
    document.querySelectorAll('#view-cat .filter-chip').forEach(btn => btn.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    document.querySelectorAll('#paketSoalGrid .packet-card').forEach(card => {
        const tier = card.getAttribute('data-tier');
        const cat = card.getAttribute('data-cat');
        const subtes = card.getAttribute('data-subtes');
        const show =
            filter === 'all' ||
            (filter === 'free' && tier === 'free') ||
            (filter === 'paid' && tier === 'paid') ||
            (filter === 'subtes' && cat === 'subtes') ||
            (filter === 'twk' && subtes === 'twk') ||
            (filter === 'tiu' && subtes === 'tiu') ||
            (filter === 'tkp' && subtes === 'tkp');
        card.style.display = show ? 'flex' : 'none';
    });
};

window.renderTwk40PaketCards = () => {
    const grid = document.getElementById('paketSoalGrid');
    if (!grid) return;

    grid.querySelectorAll('.twk-40-card').forEach(el => el.remove());

    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    const hasAccess = Boolean(prof.isPaid || prof.isAdmin);
    const fragment = document.createDocumentFragment();

    for (let i = 1; i <= 40; i++) {
        const card = document.createElement('div');
        card.className = 'card-mode packet-card paid twk-40-card';
        card.setAttribute('data-tier', 'paid');
        card.setAttribute('data-cat', 'subtes');
        card.setAttribute('data-subtes', 'twk');

        const ctaHtml = hasAccess
            ? `<button class="btn-card paid-cta" onclick="window.mulaiSingleplayer('twk', ${i})"><i class="fas fa-play"></i> Mulai Latihan TWK #${i}</button>`
            : `<button class="btn-card paid-cta" onclick="window.bukaModalUpgrade('TWK Paket #${i} (1.200 Soal)', 'Paket Satuan (Rp 5.000) / Bronze (Rp 49.999) / Silver (Rp 74.999) / Gold (Rp 99.999)')"><i class="fas fa-lock"></i> Buka Paket TWK #${i}</button>`;

        card.innerHTML = `
            <div>
                <div class="packet-badges">
                    <span class="badge-access paid"><i class="fas fa-crown"></i> PAKET BERBAYAR</span>
                    <span class="badge-cat">TWK • PAKET ${i}</span>
                </div>
                <div class="card-mode-header">
                    <div class="mode-icon blue"><i class="fas fa-landmark"></i></div>
                    <div>
                        <h3>TWK Paket #${i}</h3>
                        <span style="font-size:0.75rem; color:#1d4ed8; font-weight:700;">30 Soal • 30 Menit • 5 Pilar TWK</span>
                    </div>
                </div>
                <p>Simulasi TWK 30 soal lengkap (Nasionalisme, Integritas, Bela Negara, Pilar Negara, Bahasa Indonesia • Paket ${i} dari 40).</p>
            </div>
            ${ctaHtml}
        `;
        fragment.appendChild(card);
    }

    grid.appendChild(fragment);

    if (window.activePaketSoalFilter && window.activePaketSoalFilter !== 'all') {
        const activeChip = document.querySelector('#view-cat .filter-chip.active');
        window.filterPaketSoal(window.activePaketSoalFilter, activeChip);
    }
};

window.renderTiu40PaketCards = () => {
    const grid = document.getElementById('paketSoalGrid');
    if (!grid) return;

    grid.querySelectorAll('.tiu-40-card').forEach(el => el.remove());

    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    const hasAccess = Boolean(prof.isPaid || prof.isAdmin);
    const fragment = document.createDocumentFragment();

    for (let i = 1; i <= 40; i++) {
        const card = document.createElement('div');
        card.className = 'card-mode packet-card paid tiu-40-card';
        card.setAttribute('data-tier', 'paid');
        card.setAttribute('data-cat', 'subtes');
        card.setAttribute('data-subtes', 'tiu');

        const ctaHtml = hasAccess
            ? `<button class="btn-card paid-cta" onclick="window.mulaiSingleplayer('tiu', ${i})"><i class="fas fa-play"></i> Mulai Latihan TIU #${i}</button>`
            : `<button class="btn-card paid-cta" onclick="window.bukaModalUpgrade('TIU Paket #${i} (1.400 Soal + 350 Cadangan)', 'Paket Satuan (Rp 5.000) / Bronze (Rp 49.999) / Silver (Rp 74.999) / Gold (Rp 99.999)')"><i class="fas fa-lock"></i> Buka Paket TIU #${i}</button>`;

        card.innerHTML = `
            <div>
                <div class="packet-badges">
                    <span class="badge-access paid"><i class="fas fa-crown"></i> PAKET BERBAYAR</span>
                    <span class="badge-cat">TIU • PAKET ${i}</span>
                </div>
                <div class="card-mode-header">
                    <div class="mode-icon gold"><i class="fas fa-brain"></i></div>
                    <div>
                        <h3>TIU Paket #${i}</h3>
                        <span style="font-size:0.75rem; color:#b45309; font-weight:700;">35 Soal • 35 Menit • Mode Lama &amp; Baru</span>
                    </div>
                </div>
                <p>Simulasi TIU 35 soal seimbang (12 Verbal, 16 Numerik, 7 Figural SVG • Paket ${i} dari 40).</p>
            </div>
            ${ctaHtml}
        `;
        fragment.appendChild(card);
    }

    grid.appendChild(fragment);

    if (window.activePaketSoalFilter && window.activePaketSoalFilter !== 'all') {
        const activeChip = document.querySelector('#view-cat .filter-chip.active');
        window.filterPaketSoal(window.activePaketSoalFilter, activeChip);
    }
};

window.renderTkp40PaketCards = () => {
    const grid = document.getElementById('paketSoalGrid');
    if (!grid) return;

    grid.querySelectorAll('.tkp-40-card').forEach(el => el.remove());

    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    const hasAccess = Boolean(prof.isPaid || prof.isAdmin);
    const fragment = document.createDocumentFragment();

    for (let i = 1; i <= 40; i++) {
        const card = document.createElement('div');
        card.className = 'card-mode packet-card paid tkp-40-card';
        card.setAttribute('data-tier', 'paid');
        card.setAttribute('data-cat', 'subtes');
        card.setAttribute('data-subtes', 'tkp');

        const ctaHtml = hasAccess
            ? `<button class="btn-card paid-cta" onclick="window.mulaiSingleplayer('tkp', ${i})"><i class="fas fa-play"></i> Mulai Latihan TKP #${i}</button>`
            : `<button class="btn-card paid-cta" onclick="window.bukaModalUpgrade('TKP Paket #${i} (1.800 Soal)', 'Paket Satuan (Rp 5.000) / Bronze (Rp 49.999) / Silver (Rp 74.999) / Gold (Rp 99.999)')"><i class="fas fa-lock"></i> Buka Paket TKP #${i}</button>`;

        card.innerHTML = `
            <div>
                <div class="packet-badges">
                    <span class="badge-access paid"><i class="fas fa-crown"></i> PAKET BERBAYAR</span>
                    <span class="badge-cat">TKP • PAKET ${i}</span>
                </div>
                <div class="card-mode-header">
                    <div class="mode-icon green"><i class="fas fa-user-check"></i></div>
                    <div>
                        <h3>TKP Paket #${i}</h3>
                        <span style="font-size:0.75rem; color:#059669; font-weight:700;">45 Soal • 45 Menit • 6 Topik Seimbang</span>
                    </div>
                </div>
                <p>Simulasi TKP 45 soal seimbang semua aspek (Paket ${i} dari 40 • 1.800 Bank Soal TKP).</p>
            </div>
            ${ctaHtml}
        `;
        fragment.appendChild(card);
    }

    grid.appendChild(fragment);

    if (window.activePaketSoalFilter && window.activePaketSoalFilter !== 'all') {
        const activeChip = document.querySelector('#view-cat .filter-chip.active');
        window.filterPaketSoal(window.activePaketSoalFilter, activeChip);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.renderTwk40PaketCards();
    window.renderTiu40PaketCards();
    window.renderTkp40PaketCards();
    if (typeof window.renderSavedExamsOnBeranda === 'function') {
        window.renderSavedExamsOnBeranda();
    }
});

window.filterTryoutPaket = (filter, btnEl) => {
    document.querySelectorAll('#view-tryout .filter-chip').forEach(btn => btn.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    document.querySelectorAll('#tryoutSoalGrid .packet-card').forEach(card => {
        const tier = card.getAttribute('data-tier');
        const show =
            filter === 'all' ||
            (filter === 'free' && tier === 'free') ||
            (filter === 'paid' && tier === 'paid');
        card.style.display = show ? 'flex' : 'none';
    });
};

window.applyAdminBypassUI = () => {
    if (!window.currentUserProfile?.isAdmin) return;
    document.querySelectorAll('.app-view:not(#view-upgrade) .btn-card.paid-cta, .app-view:not(#view-upgrade) .btn-card.locked-free').forEach(btn => {
        const oc = btn.getAttribute('onclick') || '';
        if (oc.includes('mulaiSingleplayer')) return;
        let label = 'Admin Bypass: Buka Akses';
        if (oc.includes('Mode Belajar')) label = 'Admin Bypass: Mode Belajar';
        else if (oc.includes('Coba Lagi') || oc.includes('Remedial')) label = 'Admin Bypass: Remedial Soal';
        else if (oc.includes('Tryout SKD')) label = 'Admin Bypass: Buka Tryout';
        else if (oc.includes('Pusat Studi')) label = 'Admin Bypass: Buka Materi';
        else if (oc.includes('infoPaketBelumTersedia')) label = 'Admin Bypass: Cek Paket';
        btn.classList.remove('locked-free');
        btn.innerHTML = `<i class="fas fa-unlock-alt"></i> ${label}`;
    });
};

window.bukaModalUpgrade = (namaFitur, infoHarga) => {
    if (window.currentUserProfile?.isAdmin) {
        const f = String(namaFitur || '');
        if (f.includes('Pusat Studi ASN')) {
            const sub = f.includes('TWK') ? 'twk' : f.includes('TIU') ? 'tiu' : 'tkp';
            return Swal.fire({
                title: `🔓 Admin Crosscheck: ${f}`,
                html: `<p style="font-size:0.9rem; color:#475569;">Akses Super Admin aktif. Anda dapat langsung meninjau simulasi soal subtes <b>${sub.toUpperCase()}</b> atau kembali ke Command Center.</p>`,
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: `🚀 Uji Soal ${sub.toUpperCase()}`,
                cancelButtonText: 'Tutup',
                confirmButtonColor: '#1e3a8a'
            }).then(res => {
                if (res.isConfirmed) window.mulaiSingleplayer(sub);
            });
        }
        if (f.includes('TKP')) {
            const matchNo = f.match(/#(\d+)/);
            return window.mulaiSingleplayer('tkp', matchNo ? Number(matchNo[1]) : 1);
        }
        return window.mulaiSingleplayer('full');
    }

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
    if (window.currentUserProfile?.isAdmin) {
        const p = String(namaPaket || '').toUpperCase();
        const sub = p.includes('TWK') ? 'twk' : p.includes('TIU') ? 'tiu' : p.includes('TKP') ? 'tkp' : 'full';
        return window.mulaiSingleplayer(sub);
    }

    Swal.fire({
        title: '🔒 Paket Soal Belum Tersedia',
        html: `<p style="font-size:0.9rem; color:#475569;"><b>${namaPaket}</b> masih terkunci dan sedang dalam proses penyusunan bank soal oleh tim <b>MENUJU ASN</b>.</p>`,
        icon: 'info',
        confirmButtonText: 'Mengerti',
        confirmButtonColor: '#1e3a8a'
    });
};

// ==========================================================
// 2. MODE SINGLEPLAYER, PEMBAGI PAKET SEIMBANG & MODE SAVE
// ==========================================================
function buildBalancedTkpPackages(tkpQuestions, totalPackages = 40, perPackage = 45) {
    if (window._cachedBalancedTkpPackages && window._cachedBalancedTkpLen === tkpQuestions.length) {
        return window._cachedBalancedTkpPackages;
    }

    const groups = {};
    tkpQuestions.forEach(q => {
        const key = q.subKategori || 'Umum';
        if (!groups[key]) groups[key] = [];
        groups[key].push(q);
    });

    const subKeys = Object.keys(groups).sort();
    subKeys.forEach(k => groups[k].sort((a, b) => String(a.id).localeCompare(String(b.id))));

    const packages = Array.from({ length: totalPackages }, () => []);
    const cursors = {};
    subKeys.forEach(k => { cursors[k] = 0; });

    // Hitung jatah proporsional tiap topik per paket agar seimbang 45 soal x 40 paket
    const totalCount = tkpQuestions.length;
    const baseAlloc = {};
    let baseSum = 0;
    subKeys.forEach(k => {
        baseAlloc[k] = Math.floor((groups[k].length * perPackage) / totalCount);
        baseSum += baseAlloc[k];
    });

    // Sebar sisa jatah ke paket secara round-robin
    const extraNeed = {};
    subKeys.forEach(k => {
        extraNeed[k] = groups[k].length - baseAlloc[k] * totalPackages;
    });

    let extraCursor = 0;
    for (let p = 0; p < totalPackages; p++) {
        subKeys.forEach(k => {
            const takeBase = Math.min(baseAlloc[k], groups[k].length - cursors[k]);
            for (let c = 0; c < takeBase; c++) {
                packages[p].push(groups[k][cursors[k]++]);
            }
        });
        while (packages[p].length < perPackage) {
            let added = false;
            for (let attempt = 0; attempt < subKeys.length; attempt++) {
                const k = subKeys[(extraCursor + attempt) % subKeys.length];
                if (extraNeed[k] > 0 && cursors[k] < groups[k].length) {
                    packages[p].push(groups[k][cursors[k]++]);
                    extraNeed[k]--;
                    extraCursor = (extraCursor + attempt + 1) % subKeys.length;
                    added = true;
                    break;
                }
            }
            if (!added) break;
        }
    }

    window._cachedBalancedTkpPackages = packages;
    window._cachedBalancedTkpLen = tkpQuestions.length;
    return packages;
}

function getSavedExamsStorageKey() {
    const uid = window.currentUser?.uid || 'guest';
    return `menuju_asn_saved_exams_v1_${uid}`;
}

function getSavedExamsMap() {
    try {
        const raw = localStorage.getItem(getSavedExamsStorageKey());
        const parsed = raw ? JSON.parse(raw) : {};
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) {
        return {};
    }
}

function setSavedExamsMap(mapObj) {
    try {
        localStorage.setItem(getSavedExamsStorageKey(), JSON.stringify(mapObj || {}));
    } catch (err) {
        console.warn('Gagal menyimpan progres ke localStorage:', err);
    }
}

window.removeSavedExamById = (saveId) => {
    if (!saveId) return;
    const map = getSavedExamsMap();
    if (map[saveId]) {
        delete map[saveId];
        setSavedExamsMap(map);
        if (typeof window.renderSavedExamsOnBeranda === 'function') {
            window.renderSavedExamsOnBeranda();
        }
    }
};

window.hapusUjianTersimpan = async (saveId) => {
    const res = await Swal.fire({
        title: 'Hapus Progres Tersimpan?',
        text: 'Progres pengerjaan paket ini akan dihapus dari Beranda.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#dc2626'
    });
    if (res.isConfirmed) {
        window.removeSavedExamById(saveId);
    }
};

window.simpanDanKembaliKeBeranda = async () => {
    if (window.currentAppMode !== 'singleplayer') {
        return window.kembaliKeLobby();
    }

    const totalSoal = (window.currentQuestions || []).length;
    const totalJawab = Object.keys(window.userAnswers || {}).length;
    const remSec = Math.max(0, window.examTimeRemaining || 0);
    const remM = String(Math.floor(remSec / 60)).padStart(2, '0');
    const remS = String(remSec % 60).padStart(2, '0');

    const res = await Swal.fire({
        title: 'Simpan Progres & Kembali?',
        html: `Progres <b>${totalJawab}/${totalSoal}</b> soal (sisa waktu <b>${remM}:${remS}</b>) akan disimpan dan muncul di <b>Beranda</b> agar bisa dilanjutkan nanti.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '💾 Simpan & ke Beranda',
        cancelButtonText: 'Lanjut Mengerjakan',
        confirmButtonColor: '#1e3a8a'
    });

    if (!res.isConfirmed) return;

    const meta = window.currentPackageMeta || {
        saveId: `single_${Date.now()}`,
        tipe: 'tkp',
        paketNo: 1,
        title: 'Latihan Soal SKD'
    };

    const map = getSavedExamsMap();
    map[meta.saveId] = {
        saveId: meta.saveId,
        title: meta.title,
        tipe: meta.tipe,
        paketNo: meta.paketNo,
        questionIds: (window.currentQuestions || []).map(q => q.id),
        userAnswers: { ...(window.userAnswers || {}) },
        userAnswerPoints: { ...(window.userAnswerPoints || {}) },
        raguAnswers: { ...(window.raguAnswers || {}) },
        currentIdx: window.currentIdx || 0,
        examTimeRemaining: remSec,
        totalDurationSeconds: meta.totalDurationSeconds || totalSoal * 60,
        totalQuestions: totalSoal,
        answeredCount: totalJawab,
        savedAt: Date.now()
    };
    setSavedExamsMap(map);

    window.kembaliKeLobby();
    window.switchAppView('beranda');
    window.renderSavedExamsOnBeranda();

    Swal.fire({
        icon: 'success',
        title: 'Progres Tersimpan',
        text: `${meta.title} siap dilanjutkan kapan saja dari Beranda.`,
        timer: 1700,
        showConfirmButton: false
    });
};

window.lanjutkanUjianTersimpan = (saveId) => {
    const map = getSavedExamsMap();
    const saved = map[saveId];
    if (!saved) {
        return Swal.fire('Info', 'Data progres tidak ditemukan.', 'info');
    }

    const pool = [
        ...(window.DATA_SKD_CPNS || []),
        ...(window.DATA_TWK_GRATIS || []),
        ...(window.DATA_TIU_GRATIS || []),
        ...(window.DATA_TKP_GRATIS || [])
    ];
    const byId = new Map(pool.map(q => [q.id, q]));
    const restoredQuestions = (saved.questionIds || []).map(id => byId.get(id)).filter(Boolean);

    if (restoredQuestions.length === 0) {
        return Swal.fire('Info', 'Bank soal untuk progres ini tidak ditemukan.', 'warning');
    }

    window.currentQuestions = restoredQuestions;
    window.currentAppMode = 'singleplayer';
    window.currentPackageMeta = {
        saveId: saved.saveId,
        tipe: saved.tipe,
        paketNo: saved.paketNo,
        title: saved.title,
        totalDurationSeconds: saved.totalDurationSeconds || restoredQuestions.length * 60
    };

    window.switchAppView('cat');
    startExamSessionUI(saved);
};

window.renderSavedExamsOnBeranda = () => {
    const container = document.getElementById('savedExamsBerandaSection');
    if (!container) return;

    const items = Object.values(getSavedExamsMap()).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    if (items.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    container.style.display = 'block';
    const cardsHtml = items.map(item => {
        const rem = Math.max(0, item.examTimeRemaining || 0);
        const mm = String(Math.floor(rem / 60)).padStart(2, '0');
        const ss = String(rem % 60).padStart(2, '0');
        const pct = item.totalQuestions > 0 ? Math.round(((item.answeredCount || 0) / item.totalQuestions) * 100) : 0;
        const tgl = new Date(item.savedAt || Date.now()).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
        return `
            <div class="card-mode packet-card" style="border:1.5px solid #fdba74; background:#fffaf5; padding:16px;">
                <div>
                    <div class="packet-badges" style="margin-bottom:8px;">
                        <span class="badge-access" style="background:#ffedd5; color:#c2410c;"><i class="fas fa-bookmark"></i> TERSIMPAN</span>
                        <span class="badge-cat">${item.answeredCount || 0}/${item.totalQuestions} Soal (${pct}%)</span>
                    </div>
                    <h4 style="margin:0 0 6px; font-size:0.98rem; color:#0f172a;">${item.title}</h4>
                    <div style="font-size:0.8rem; color:#475569; margin-bottom:12px;">
                        <span><i class="fas fa-stopwatch" style="color:#c2410c;"></i> Sisa Waktu: <b>${mm}:${ss}</b></span>
                        <span style="margin-left:10px; color:#94a3b8;">• ${tgl}</span>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn-card primary" style="flex:1;" onclick="window.lanjutkanUjianTersimpan('${item.saveId}')">
                        <i class="fas fa-play"></i> Lanjutkan
                    </button>
                    <button class="btn-card" style="width:auto; padding:0 12px; background:#fee2e2; color:#b91c1c;" title="Hapus Progres" onclick="window.hapusUjianTersimpan('${item.saveId}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="dash-section-head" style="margin-bottom:12px;">
            <h3><i class="fas fa-bookmark" style="color:#ea580c;"></i> Lanjutkan Latihan Tersimpan</h3>
            <span>${items.length} paket belum selesai</span>
        </div>
        <div class="dash-quick-grid">${cardsHtml}</div>
    `;
};

window.mulaiSingleplayer = (tipe, paketNo = null) => {
    window.isInstantReviewMode = false;
    let rawData = window.DATA_SKD_CPNS || [];
    let title = 'Latihan Soal SKD';
    let saveId = tipe;

    if (tipe === 'twk') {
        const allPaidTwk = rawData.filter(q => q.kategori === 'TWK' && /^twk_\d{4}$/.test(q.id));
        if (paketNo) {
            const no = Math.max(1, Math.min(40, Number(paketNo) || 1));
            window.currentQuestions = allPaidTwk.slice((no - 1) * 30, no * 30);
            window.examTimeRemaining = window.currentQuestions.length * 60; // 30 Menit
            title = `TWK Paket #${no}`;
            saveId = `twk_${no}`;
        } else {
            window.currentQuestions = allPaidTwk.slice(0, 30);
            window.examTimeRemaining = window.currentQuestions.length * 60;
            title = 'TWK Paket #1';
            saveId = 'twk_1';
        }
    } else if (tipe === 'twk_gratis') {
        const no = Math.max(1, Math.min(3, Number(paketNo) || 1));
        const gratisPool = window.DATA_TWK_GRATIS || [];
        window.currentQuestions = gratisPool.slice((no - 1) * 30, no * 30);
        window.examTimeRemaining = window.currentQuestions.length * 60; // 30 Menit
        title = `TWK Gratis — Paket ${no}`;
        saveId = `twk_gratis_${no}`;
    } else if (tipe === 'tiu') {
        const allPaidTiu = rawData.filter(q => q.kategori === 'TIU' && /^tiu_\d{4}$/.test(q.id));
        const no = Math.max(1, Math.min(40, Number(paketNo) || 1));
        window.currentQuestions = allPaidTiu.slice((no - 1) * 35, no * 35);
        window.examTimeRemaining = window.currentQuestions.length * 60; // 35 Menit
        title = `TIU Paket #${no}`;
        saveId = `tiu_${no}`;
    } else if (tipe === 'tiu_gratis') {
        const no = Math.max(1, Math.min(3, Number(paketNo) || 1));
        const gratisPool = window.DATA_TIU_GRATIS || [];
        window.currentQuestions = gratisPool.slice((no - 1) * 35, no * 35);
        window.examTimeRemaining = window.currentQuestions.length * 60; // 35 Menit
        title = `TIU Gratis — Paket ${no}`;
        saveId = `tiu_gratis_${no}`;
    } else if (tipe === 'tkp_gratis') {
        const no = Math.max(1, Math.min(3, Number(paketNo) || 1));
        const gratisPool = window.DATA_TKP_GRATIS || [];
        window.currentQuestions = gratisPool.slice((no - 1) * 45, no * 45);
        window.examTimeRemaining = window.currentQuestions.length * 60; // 45 Menit
        title = `TKP Gratis — Paket ${no}`;
        saveId = `tkp_gratis_${no}`;
    } else if (tipe === 'tkp') {
        const allTkp = rawData.filter(q => q.kategori === 'TKP');
        if (paketNo) {
            const no = Math.max(1, Math.min(40, Number(paketNo) || 1));
            const packages = buildBalancedTkpPackages(allTkp, 40, 45);
            window.currentQuestions = packages[no - 1] || [];
            window.examTimeRemaining = window.currentQuestions.length * 60; // 45 Menit
            title = `TKP Paket #${no}`;
            saveId = `tkp_${no}`;
        } else {
            const packages = buildBalancedTkpPackages(allTkp, 40, 45);
            window.currentQuestions = packages[0] || allTkp.slice(0, 45);
            window.examTimeRemaining = window.currentQuestions.length * 60;
            title = 'TKP Paket #1';
            saveId = 'tkp_1';
        }
    } else {
        window.currentQuestions = [...rawData];
        window.examTimeRemaining = 100 * 60; // 100 Menit standar BKN
        title = 'Simulasi SKD Lengkap';
    }

    if (window.currentQuestions.length === 0) {
        return Swal.fire('Informasi', 'Paket soal sedang dipersiapkan.', 'info');
    }

    window.currentPackageMeta = {
        saveId,
        tipe,
        paketNo: paketNo ? Number(paketNo) : null,
        title,
        totalDurationSeconds: window.examTimeRemaining
    };
    window.currentAppMode = 'singleplayer';
    startExamSessionUI();
};

function startExamSessionUI(restoredState = null) {
    if (restoredState) {
        window.currentIdx = Math.min(restoredState.currentIdx || 0, Math.max(0, window.currentQuestions.length - 1));
        window.userAnswers = { ...(restoredState.userAnswers || {}) };
        window.userAnswerPoints = { ...(restoredState.userAnswerPoints || {}) };
        window.raguAnswers = { ...(restoredState.raguAnswers || {}) };
        window.examTimeRemaining = Math.max(1, restoredState.examTimeRemaining || (window.currentQuestions.length * 60));
        const elapsedSec = Math.max(0, (restoredState.totalDurationSeconds || (window.currentQuestions.length * 60)) - window.examTimeRemaining);
        window.examStartTimeMs = Date.now() - (elapsedSec * 1000);
    } else {
        window.currentIdx = 0;
        window.userAnswers = {};
        window.userAnswerPoints = {};
        window.raguAnswers = {};
        window.examStartTimeMs = Date.now();
    }
    window.syncedSubtes = { TWK: false, TIU: false, TKP: false };

    document.getElementById('lobbySection').style.display = 'none';
    const heroEl = document.getElementById('heroBannerSection');
    if (heroEl) heroEl.style.display = 'none';

    const examStage = document.getElementById('examStage');
    examStage.style.display = 'block';
    examStage.innerHTML = buildExamStageMarkup();

    renderSoalSekarang();
    if (window.currentAppMode === 'multiplayer') {
        if (typeof window.mountArenaFloatingChatDock === 'function') window.mountArenaFloatingChatDock();
        if (typeof window.renderInlineArenaKlasemen === 'function') window.renderInlineArenaKlasemen();
        if (typeof window.renderArenaChatFeed === 'function') window.renderArenaChatFeed();
    }
    startExamTimer();
}

function buildExamStageMarkup() {
    const pkgTitle = window.currentPackageMeta?.title ? ` • ${window.currentPackageMeta.title}` : '';
    return `
        <div class="exam-header">
            <div class="exam-meta">
                <span id="badgeSubtes" class="badge-subtes twk">TWK</span>
                <span id="noSoalDisplay" style="font-weight:700; font-size:0.85rem; color:#334155;">Soal 1${pkgTitle}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                ${window.currentAppMode === 'singleplayer' ? `
                    <button onclick="window.simpanDanKembaliKeBeranda()" style="background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; padding:6px 12px; border-radius:20px; font-weight:700; font-size:0.78rem; cursor:pointer;">
                        <i class="fas fa-bookmark"></i> Simpan &amp; Kembali
                    </button>
                ` : ''}
                <button onclick="window.bukaModalLaporSoal()" title="Laporkan kesalahan soal/kunci" style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; padding:6px 11px; border-radius:20px; font-weight:700; font-size:0.78rem; cursor:pointer;">
                    <i class="fas fa-flag"></i> Lapor
                </button>
                ${window.currentAppMode === 'multiplayer' ? `
                    <button onclick="window.bukaModalKlasemenMabar()" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:6px 12px; border-radius:20px; font-weight:700; font-size:0.78rem; cursor:pointer;">
                        <i class="fas fa-trophy" style="color:#d97706;"></i> Klasemen
                    </button>
                ` : ''}
                <div class="exam-timer" id="examTimerDisplay">
                    <i class="fas fa-stopwatch"></i> 45:00
                </div>
            </div>
        </div>

        <div class="exam-workspace-grid">
            <div class="question-card">
                <div class="question-text" id="questionTextDisplay">
                    Memuat butir pertanyaan...
                </div>
                <div class="options-list" id="optionsListDisplay"></div>
                <div id="instantPembahasanBox" style="display:none; margin-top:14px;"></div>
                <div id="arenaBotNextBanner" style="display:none; margin-top:14px;"></div>
                
                <div class="exam-nav" style="${window.currentAppMode === 'multiplayer' ? 'display:none;' : ''}">
                    <button id="btnPrevSoal" class="btn-nav" onclick="window.prevSoal()">
                        <i class="fas fa-chevron-left"></i> Sebelumnya
                    </button>
                    <button id="btnRaguSoal" class="btn-nav ragu" onclick="window.toggleRaguSoal()">
                        <i class="fas fa-flag"></i> Ragu-Ragu
                    </button>
                    <button id="btnNextSoal" class="btn-nav primary" onclick="window.nextSoal()">
                        Berikutnya <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>

            <aside class="exam-nav-panel" id="examNavPanel">
                ${window.currentAppMode === 'multiplayer' ? `
                    <div id="arenaLiveKlasemenSidebar"></div>
                ` : `
                    <div class="exam-nav-panel-head">
                        <h4><i class="fas fa-th" style="color:var(--primary);"></i> Nomor Soal</h4>
                        <span class="exam-nav-count" id="examNavAnsweredCount">0/0 Terjawab</span>
                    </div>
                    <div class="exam-number-grid" id="examNumberGrid"></div>
                    <div class="exam-nav-legend">
                        <span class="exam-legend-item"><span class="exam-legend-dot answered"></span> Dijawab</span>
                        <span class="exam-legend-item"><span class="exam-legend-dot ragu"></span> Ragu-ragu</span>
                        <span class="exam-legend-item"><span class="exam-legend-dot empty"></span> Belum diisi</span>
                    </div>
                `}
            </aside>
        </div>
    `;
}

function startExamTimer() {
    clearInterval(window.examTimerInterval);
    const updateDisplay = () => {
        const timerEl = document.getElementById('examTimerDisplay');
        const rem = Math.max(0, Number(window.examTimeRemaining || 0));
        const m = Math.floor(rem / 60);
        const s = rem % 60;
        if (timerEl) {
            timerEl.innerHTML = `<i class="fas fa-stopwatch"></i> ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        if (rem <= 0) {
            clearInterval(window.examTimerInterval);
            if (window.currentAppMode === 'multiplayer') {
                window._arenaQuestionTimedOut = true;
                renderSoalSekarang();
                if (typeof window.evaluateMenujuAsnBotAutoNext === 'function') {
                    window.evaluateMenujuAsnBotAutoNext(window.latestRoomData || {});
                }
                return;
            }
            Swal.fire({
                icon: 'warning',
                title: 'Waktu Habis!',
                text: 'Waktu pengerjaan telah berakhir. Mengirim hasil evaluasi...',
                timer: 2000,
                showConfirmButton: false
            }).then(() => {
                selesaikanUjian();
            });
            return;
        }
        window.examTimeRemaining--;
    };

    updateDisplay();
    window.examTimerInterval = setInterval(updateDisplay, 1000);
}

function formatQuestionTextHtml(rawText) {
    const safe = String(rawText || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const lines = safe.split(/\r?\n/);
    const rowRegex = /^(?:Baris\s*(\d+)\s*:\s*)?\[([^\]]+)\]$/i;

    const out = [];
    let tableRows = [];

    const flushTable = () => {
        if (tableRows.length < 2) {
            tableRows.forEach(r => out.push(r.raw));
            tableRows = [];
            return;
        }
        const colCount = tableRows.reduce((mx, r) => Math.max(mx, r.cells.length), 0);
        const hasLabel = tableRows.some(r => r.label);
        const headerCells = (hasLabel ? '<th>Baris</th>' : '') +
            Array.from({ length: colCount }, (_, idx) => `<th>Kolom ${idx + 1}</th>`).join('');

        const bodyRows = tableRows.map(r => {
            const cellsHtml = r.cells.map(c => {
                const isQ = c === '?';
                return `<td class="${isQ ? 'qmark-cell' : ''}">${c}</td>`;
            }).join('');
            return `<tr>${hasLabel ? `<td style="background:#f8fafc; color:#475569; font-size:0.82rem;">${r.label}</td>` : ''}${cellsHtml}</tr>`;
        }).join('');

        out.push(`<div class="soal-data-table-wrap"><table class="soal-data-table"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`);
        tableRows = [];
    };

    lines.forEach(line => {
        const trimmed = line.trim();
        const m = trimmed.match(rowRegex);
        if (m) {
            const cells = m[2].split(',').map(s => s.trim());
            tableRows.push({
                raw: line,
                label: m[1] ? `Baris ${m[1]}` : '',
                cells
            });
        } else {
            flushTable();
            out.push(line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'));
        }
    });
    flushTable();

    return out.join('\n');
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
        const formatted = formatQuestionTextHtml(q.soal)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
        const modeBadge = q.mode === 'baru'
            ? `<div style="margin-bottom:10px;"><span style="display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #93c5fd;color:#1d4ed8;font-size:0.75rem;font-weight:800;letter-spacing:0.3px;"><i class="fas fa-bolt"></i> TIPE SOAL TERBARU 2026</span></div>`
            : '';
        qTextEl.innerHTML = q.gambar
            ? `${modeBadge}${formatted}<div style="margin-top:14px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; overflow-x:auto;">${q.gambar}</div>`
            : `${modeBadge}${formatted}`;
    }

    const opsListEl = document.getElementById('optionsListDisplay');
    const instantBoxEl = document.getElementById('instantPembahasanBox');
    if (opsListEl) {
        const currentAns = window.userAnswers[q.id];
        const showInstant = Boolean(
            (window.isInstantReviewMode && currentAns) ||
            (window.currentAppMode === 'multiplayer' && (currentAns || window._arenaQuestionTimedOut))
        );
        const maxPoin = (q.opsi || []).reduce((mx, o) => Math.max(mx, Number(o.poin || (o.benar ? 5 : 0))), 0) || 5;

        opsListEl.innerHTML = q.opsi.map(opt => {
            const isSel = currentAns === opt.label;
            let inlineStyle = '';
            let badgeHtml = '';

            if (showInstant) {
                const isBest = q.kategori === 'TKP' ? Number(opt.poin || 0) >= maxPoin : Boolean(opt.benar);
                if (isBest) {
                    inlineStyle = 'border-color:#16a34a; background:#f0fdf4;';
                } else if (isSel && !isBest) {
                    inlineStyle = 'border-color:#ef4444; background:#fef2f2;';
                }
                badgeHtml = q.kategori === 'TKP'
                    ? `<span style="margin-left:auto; font-size:0.75rem; font-weight:800; color:#475569;">Poin ${opt.poin || 0}</span>`
                    : (opt.benar ? `<span style="margin-left:auto; font-size:0.75rem; font-weight:800; color:#15803d;">Kunci</span>` : '');
            }

            return `
                <div class="option-item ${isSel ? 'selected' : ''}" style="${inlineStyle}" onclick="window.pilihJawaban('${q.id}', '${opt.label}', ${opt.poin || 0})">
                    <div class="option-circle">${opt.label}</div>
                    <div class="option-label">${opt.teks}</div>
                    ${badgeHtml}
                </div>
            `;
        }).join('');

        if (instantBoxEl) {
            if (showInstant) {
                const pickedOpt = (q.opsi || []).find(o => o.label === currentAns);
                const gotPoin = q.kategori === 'TKP' ? Number(pickedOpt?.poin || 0) : (pickedOpt?.benar ? 5 : 0);
                instantBoxEl.style.display = 'block';
                instantBoxEl.innerHTML = window.buildInteractivePembahasanHtml(q, currentAns, `instant_${q.id}`, {
                    headerTitle: window.currentAppMode === 'multiplayer' ? 'Pembahasan Mentor (Live CBT Arena)' : 'Pembahasan Mentor (1x Klik)',
                    gotPoin,
                    maxPoin
                });
            } else {
                instantBoxEl.style.display = 'none';
                instantBoxEl.innerHTML = '';
            }
        }
    }

    const btnPrev = document.getElementById('btnPrevSoal');
    const btnRagu = document.getElementById('btnRaguSoal');
    const btnNext = document.getElementById('btnNextSoal');
    if (btnPrev) btnPrev.style.visibility = (window.currentIdx > 0) ? 'visible' : 'hidden';
    if (btnRagu) {
        const isRagu = Boolean(window.raguAnswers && window.raguAnswers[q.id]);
        btnRagu.classList.toggle('active', isRagu);
        btnRagu.innerHTML = isRagu
            ? `<i class="fas fa-flag"></i> Batal Ragu`
            : `<i class="fas fa-flag"></i> Ragu-Ragu`;
    }
    if (btnNext) {
        if (window.currentIdx === window.currentQuestions.length - 1) {
            btnNext.innerHTML = `<i class="fas fa-flag-checkered"></i> Selesai Ujian`;
            btnNext.onclick = window.konfirmasiSelesaiUjian;
        } else {
            btnNext.innerHTML = `Berikutnya <i class="fas fa-chevron-right"></i>`;
            btnNext.onclick = window.nextSoal;
        }
    }

    renderExamNumberGrid();
    if (window.currentAppMode === 'multiplayer' && typeof window.evaluateMenujuAsnBotAutoNext === 'function') {
        window.evaluateMenujuAsnBotAutoNext(window.latestRoomData || {});
    }
}

function renderExamNumberGrid() {
    const gridEl = document.getElementById('examNumberGrid');
    if (!gridEl) return;

    const questions = window.currentQuestions || [];
    const answers = window.userAnswers || {};
    const ragu = window.raguAnswers || {};
    let answeredCount = 0;

    gridEl.innerHTML = questions.map((item, idx) => {
        const isAnswered = Boolean(answers[item.id]);
        const isRagu = Boolean(ragu[item.id]);
        if (isAnswered) answeredCount++;

        let statusClass = '';
        if (isRagu) statusClass = 'ragu';
        else if (isAnswered) statusClass = 'answered';

        const currentClass = idx === window.currentIdx ? 'current' : '';
        return `<button type="button" class="exam-num-btn ${statusClass} ${currentClass}" onclick="window.lompatKeSoal(${idx})">${idx + 1}</button>`;
    }).join('');

    const countEl = document.getElementById('examNavAnsweredCount');
    if (countEl) {
        countEl.textContent = `${answeredCount}/${questions.length} Terjawab`;
    }
}

window.toggleRaguSoal = () => {
    const q = (window.currentQuestions || [])[window.currentIdx];
    if (!q) return;
    if (!window.raguAnswers) window.raguAnswers = {};
    window.raguAnswers[q.id] = !window.raguAnswers[q.id];
    renderSoalSekarang();
};

window.lompatKeSoal = (idx) => {
    const questions = window.currentQuestions || [];
    if (idx < 0 || idx >= questions.length || idx === window.currentIdx) return;

    const prevQ = questions[window.currentIdx];
    window.currentIdx = idx;
    const nextQ = questions[window.currentIdx];

    if (window.currentAppMode === 'multiplayer' && prevQ && nextQ && prevQ.kategori !== nextQ.kategori) {
        syncCheckpointToFirestore(prevQ.kategori, false);
    }

    renderSoalSekarang();
};

// HEMAT KUOTA: Klik opsi simpan lokal + kunci jawaban di Live Arena + live sync klasemen Arena
window.pilihJawaban = (qId, label, poin) => {
    if (window.currentAppMode === 'multiplayer' && window.userAnswers[qId]) {
        return; // Kunci jawaban setelah memilih di Live CBT Arena agar adil
    }
    window.userAnswers[qId] = label;
    window.userAnswerPoints[qId] = poin;
    renderSoalSekarang();
    if (window.currentAppMode === 'multiplayer') {
        if (typeof window.renderInlineArenaKlasemen === 'function') window.renderInlineArenaKlasemen();
        syncCheckpointToFirestore(null, false, true);
    }
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

function syncLiveArenaScoreThrottled() {
    if (!window.activeRoomCode || !window.currentUser) return;
    const now = Date.now();
    if (window._lastArenaLiveSyncMs && now - window._lastArenaLiveSyncMs < 5000) return;
    window._lastArenaLiveSyncMs = now;
    syncCheckpointToFirestore(null, false, true);
}

// Sync Checkpoint (Saat pindah subtes, update klasemen sementara, atau selesai ujian)
async function syncCheckpointToFirestore(subtesName, isFinal = false, forceLive = false) {
    if (!window.activeRoomCode || !window.currentUser) return;
    if (!isFinal && !forceLive && subtesName && window.syncedSubtes[subtesName]) return;

    if (subtesName) window.syncedSubtes[subtesName] = true;
    const stats = hitungSkorSekarang();
    const answeredCount = Object.keys(window.userAnswers || {}).length;
    const uid = window.currentUser.uid;

    try {
        const roomRef = doc(db, COLLECTIONS.ROOMS, String(window.activeRoomCode));
        await updateDoc(roomRef, {
            [`players.${uid}.skor`]: stats.totalSkor,
            [`players.${uid}.skorTWK`]: stats.skorTWK,
            [`players.${uid}.skorTIU`]: stats.skorTIU,
            [`players.${uid}.skorTKP`]: stats.skorTKP,
            [`players.${uid}.answeredCount`]: answeredCount,
            [`players.${uid}.lastAnsweredIdx`]: window.currentIdx,
            [`players.${uid}.totalWaktu`]: stats.totalWaktu,
            [`players.${uid}.isFinished`]: isFinal,
            [`players.${uid}.lastSeen`]: Date.now()
        });
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
    clearInterval(window._botAutoNextInterval);
    document.getElementById('arenaFloatingChatDock')?.remove();

    if (window.currentPackageMeta?.saveId && typeof window.removeSavedExamById === 'function') {
        window.removeSavedExamById(window.currentPackageMeta.saveId);
    }

    if (window.currentAppMode === 'multiplayer') {
        await syncCheckpointToFirestore(null, true);
        if (typeof window.saveArenaResultToHistory === 'function') {
            await window.saveArenaResultToHistory();
        }
    }

    const { skorTWK, skorTIU, skorTKP, totalSkor, totalWaktu } = hitungSkorSekarang();
    const qs = window.currentQuestions || [];
    const countTWK = qs.filter(q => q.kategori === 'TWK').length;
    const countTIU = qs.filter(q => q.kategori === 'TIU').length;
    const countTKP = qs.filter(q => q.kategori === 'TKP').length;

    const pgTWK = countTWK >= 30 ? 65 : Math.max(5, Math.round(countTWK * 5 * 0.43));
    const pgTIU = countTIU >= 35 ? 80 : Math.max(5, Math.round(countTIU * 5 * 0.45));
    const pgTKP = countTKP >= 45 ? 166 : Math.max(5, Math.round(countTKP * 5 * 0.73));

    const lolosTWK = countTWK === 0 || skorTWK >= pgTWK;
    const lolosTIU = countTIU === 0 || skorTIU >= pgTIU;
    const lolosTKP = countTKP === 0 || skorTKP >= pgTKP;
    const statusLolos = lolosTWK && lolosTIU && lolosTKP;

    const maxSkor = (countTWK + countTIU + countTKP) * 5;
    const menit = Math.floor((totalWaktu || 0) / 60);
    const detik = (totalWaktu || 0) % 60;
    const durasiText = `${menit}m ${detik}d`;

    const savedAttempt = saveAttemptToBrankas({
        title: window.currentPackageMeta?.title || 'Simulasi SKD ASN',
        tipe: window.currentPackageMeta?.tipe || 'full',
        paketNo: window.currentPackageMeta?.paketNo || null,
        mode: window.currentAppMode === 'multiplayer' ? 'CBT Arena' : 'CAT Mandiri',
        durasiText,
        totalSkor,
        maxSkor,
        statusLolos,
        skorTWK,
        skorTIU,
        skorTKP,
        questions: qs,
        userAnswers: { ...(window.userAnswers || {}) }
    });
    if (savedAttempt) {
        window.selectedBrankasAttemptId = savedAttempt.id;
        window.brankasReviewFilter = 'all';
        window.brankasMode = 'list';
    }

    const rows = [];
    if (countTWK > 0) rows.push({ label: 'Tes Wawasan Kebangsaan (TWK)', pg: pgTWK, nilai: skorTWK, max: countTWK * 5, lolos: lolosTWK });
    if (countTIU > 0) rows.push({ label: 'Tes Inteligensi Umum (TIU)', pg: pgTIU, nilai: skorTIU, max: countTIU * 5, lolos: lolosTIU });
    if (countTKP > 0) rows.push({ label: 'Tes Karakteristik Pribadi (TKP)', pg: pgTKP, nilai: skorTKP, max: countTKP * 5, lolos: lolosTKP });

    const rowsHtml = rows.map(r => {
        const pct = r.max > 0 ? Math.min(100, Math.round((r.nilai / r.max) * 100)) : 0;
        return `
            <tr>
                <td>
                    <strong>${r.label}</strong>
                    <div class="res-bar-track"><div class="res-bar-fill ${r.lolos ? 'pass' : 'fail'}" style="width:${pct}%;"></div></div>
                </td>
                <td>${r.pg}</td>
                <td><strong>${r.nilai}</strong> <small style="color:#94a3b8;">/ ${r.max}</small></td>
                <td>
                    <span class="res-badge ${r.lolos ? 'pass' : 'fail'}">
                        ${r.lolos ? 'Lulus PG' : 'Belum Lulus'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');

    const podiumHtml = (window.currentAppMode === 'multiplayer' && typeof buildArenaPodiumHtml === 'function')
        ? buildArenaPodiumHtml()
        : '';

    const examStage = document.getElementById('examStage');
    if (examStage) {
        examStage.style.display = 'block';
        examStage.innerHTML = `
            <div class="result-shell">
                <div class="result-top-banner">
                    <div>
                        <span class="result-eyebrow"><i class="fas fa-award"></i> LAPORAN HASIL EVALUASI CAT • MENUJU ASN</span>
                        <h2>${window.currentAppMode === 'multiplayer' ? 'Podium &amp; Hasil Live CBT Arena' : 'Hasil Simulasi SKD ASN'}</h2>
                        <div class="result-meta-chips">
                            <span><i class="fas fa-list-ol"></i> ${qs.length} Soal</span>
                            <span><i class="fas fa-stopwatch"></i> Waktu: ${durasiText}</span>
                            <span><i class="fas fa-gamepad"></i> ${window.currentAppMode === 'multiplayer' ? 'CBT Arena' : 'CAT Mandiri'}</span>
                        </div>
                    </div>
                    <button class="btn-dash-ghost" onclick="window.kembaliKeLobby()">
                        <i class="fas fa-arrow-left"></i> Kembali ke Dashboard
                    </button>
                </div>

                ${podiumHtml}

                <div class="result-grid">
                    <!-- PANEL KIRI: RINCIAN NILAI -->
                    <div class="result-breakdown-card">
                        <div class="result-card-head">
                            <h3><i class="fas fa-chart-bar" style="color:var(--primary);"></i> Rincian Skor &amp; Ambang Batas BKN</h3>
                            <span class="res-chip-info">Perolehan Nilai Terbaru</span>
                        </div>
                        <div class="result-table-wrap">
                            <table class="result-table">
                                <thead>
                                    <tr>
                                        <th>SUBTES</th>
                                        <th>PASSING GRADE</th>
                                        <th>NILAI KAMU</th>
                                        <th>STATUS</th>
                                    </tr>
                                </thead>
                                <tbody>${rowsHtml}</tbody>
                            </table>
                        </div>
                    </div>

                    <!-- PANEL KANAN: TOTAL SKOR -->
                    <div class="result-score-card ${statusLolos ? 'pass' : 'fail'}">
                        <div class="score-box-inner">
                            <span class="score-box-label">Total Perolehan Nilai Kamu</span>
                            <div class="score-big-num">${totalSkor}</div>
                            <span class="score-max-sub">dari maksimal ${maxSkor} poin</span>
                            <div class="score-status-pill ${statusLolos ? 'pass' : 'fail'}">
                                ${statusLolos ? '<i class="fas fa-check-circle"></i> LULUS PASSING GRADE' : '<i class="fas fa-exclamation-circle"></i> BELUM MEMENUHI PG'}
                            </div>
                        </div>
                        <div class="score-actions-stack">
                            ${savedAttempt ? `
                                <button class="btn-card primary" onclick="window.kembaliKeLobby(); window.switchAppView('brankas'); window.bukaReviewBrankas('${savedAttempt.id}', 'all');">
                                    <i class="fas fa-book-open"></i> Lihat Pembahasan Lengkap
                                </button>
                            ` : `
                                <button class="btn-card primary" onclick="window.kembaliKeLobby(); window.switchAppView('brankas');">
                                    <i class="fas fa-vault"></i> Buka Brankas Pembahasan
                                </button>
                            `}
                            ${window.currentAppMode === 'multiplayer' ? `
                                <button class="btn-card accent" onclick="window.bukaModalKlasemenMabar()">
                                    <i class="fas fa-trophy"></i> Klasemen Live CBT Arena
                                </button>
                            ` : ''}
                            <button class="btn-card outline" onclick="window.kembaliKeLobby()">
                                <i class="fas fa-home"></i> Kembali ke Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function getBrankasStorageKey() {
    const uid = window.currentUser?.uid || 'guest';
    return `menuju_asn_brankas_v1_${uid}`;
}

function getBrankasHistory() {
    try {
        const raw = localStorage.getItem(getBrankasStorageKey());
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function setBrankasHistory(list) {
    try {
        localStorage.setItem(getBrankasStorageKey(), JSON.stringify((list || []).slice(0, 30)));
    } catch (e) {
        console.warn('Gagal menyimpan riwayat Brankas:', e);
    }
}

function saveAttemptToBrankas(payload) {
    const questions = payload.questions || [];
    const answers = payload.userAnswers || {};

    const items = questions.map((q, idx) => {
        const userAns = answers[q.id] || null;
        const selectedOpt = userAns ? (q.opsi || []).find(o => o.label === userAns) : null;
        const maxPoin = (q.opsi || []).reduce((mx, o) => Math.max(mx, Number(o.poin || (o.benar ? 5 : 0))), 0) || 5;
        let userPoin = 0;
        let isCorrect = false;

        if (q.kategori === 'TKP') {
            userPoin = Number(selectedOpt?.poin || 0);
            isCorrect = userPoin >= maxPoin && userPoin > 0;
        } else {
            isCorrect = Boolean(selectedOpt?.benar);
            userPoin = isCorrect ? 5 : 0;
        }

        return {
            no: idx + 1,
            id: q.id,
            kategori: q.kategori,
            subKategori: q.subKategori || '',
            soal: q.soal || '',
            opsi: q.opsi || [],
            pembahasan: q.pembahasan || '',
            userAns,
            userPoin,
            maxPoin,
            isCorrect
        };
    });

    const record = {
        id: `brk_${Date.now()}`,
        title: payload.title || 'Simulasi SKD ASN',
        tipe: payload.tipe || 'full',
        paketNo: payload.paketNo || null,
        mode: payload.mode || 'CAT Mandiri',
        durasiText: payload.durasiText || '0m 0d',
        totalSkor: payload.totalSkor || 0,
        maxSkor: payload.maxSkor || (questions.length * 5),
        statusLolos: Boolean(payload.statusLolos),
        skorTWK: payload.skorTWK || 0,
        skorTIU: payload.skorTIU || 0,
        skorTKP: payload.skorTKP || 0,
        totalQuestions: questions.length,
        answeredCount: items.filter(it => it.userAns).length,
        wrongCount: items.filter(it => !it.isCorrect).length,
        finishedAt: Date.now(),
        items
    };

    const history = getBrankasHistory();
    history.unshift(record);
    setBrankasHistory(history);
    return record;
}

window.hapusRiwayatBrankas = async (attemptId) => {
    const history = getBrankasHistory();
    const target = history.find(item => item.id === attemptId);
    const label = target?.title ? `<b>${target.title}</b>` : 'riwayat paket ini';

    const res = await Swal.fire({
        title: 'Yakin Hapus Riwayat?',
        html: `Data hasil &amp; pembahasan ${label} akan dihapus permanen dan <b>tidak bisa dikembalikan lagi</b>.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus Permanen',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#b91c1c'
    });
    if (!res.isConfirmed) return;

    const filtered = history.filter(item => item.id !== attemptId);
    setBrankasHistory(filtered);
    if (window.selectedBrankasAttemptId === attemptId) {
        window.selectedBrankasAttemptId = filtered[0]?.id || null;
    }

    if (window.currentUser && COLLECTIONS.BRANKAS) {
        try {
            await deleteDoc(doc(db, COLLECTIONS.BRANKAS, `${window.currentUser.uid}_${attemptId}`));
        } catch (_) {}
        try {
            await deleteDoc(doc(db, COLLECTIONS.BRANKAS, String(attemptId)));
        } catch (_) {}
    }

    window.renderBrankasPembahasan();
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Riwayat Brankas dihapus permanen',
        showConfirmButton: false,
        timer: 2000
    });
};

window.bukaReviewBrankas = (attemptId, filterMode = 'all') => {
    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    const canReview = Boolean(prof.isPaid || prof.isAdmin);
    if (!canReview) {
        return window.bukaModalUpgrade(
            'Review Brankas Pembahasan',
            'Paket Satuan (Rp 5.000) / Bronze (Rp 49.999) / Silver (Rp 74.999) / Gold (Rp 99.999)'
        );
    }
    window.reviewState = {
        attemptId,
        filterMode: filterMode || 'all',
        idx: 0
    };
    window.renderBrankasReviewStage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.setReviewFilterMode = (filterMode) => {
    if (!window.reviewState) return;
    window.reviewState.filterMode = filterMode || 'all';
    window.reviewState.idx = 0;
    window.renderBrankasReviewStage();
};

window.lompatKeReviewSoal = (idx) => {
    if (!window.reviewState) return;
    window.reviewState.idx = idx;
    window.renderBrankasReviewStage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.kembaliDariReviewKeBrankas = () => {
    window.kembaliKeLobby();
    window.switchAppView('brankas');
};

window.renderBrankasReviewStage = () => {
    const state = window.reviewState;
    if (!state) return;

    const attempt = getBrankasHistory().find(h => h.id === state.attemptId);
    if (!attempt) return window.kembaliDariReviewKeBrankas();

    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    const tier = String(prof.tier || 'free').toLowerCase();
    const canRemedial = Boolean(prof.isAdmin || tier === 'gold');

    const lobbyEl = document.getElementById('lobbySection');
    const heroEl = document.getElementById('heroBannerSection');
    const examStage = document.getElementById('examStage');
    if (lobbyEl) lobbyEl.style.display = 'none';
    if (heroEl) heroEl.style.display = 'none';
    if (!examStage) return;

    examStage.style.display = 'block';

    const activeFilter = state.filterMode || 'all';
    const filteredItems = (attempt.items || []).filter(it => {
        if (activeFilter === 'wrong') return !it.isCorrect;
        if (activeFilter === 'correct') return it.isCorrect;
        return true;
    });

    if (state.idx >= filteredItems.length) state.idx = Math.max(0, filteredItems.length - 1);
    const currentItem = filteredItems[state.idx];

    const gridButtonsHtml = filteredItems.map((it, idx) => {
        const statusCls = it.isCorrect ? 'answered' : 'wrong';
        const currentCls = idx === state.idx ? 'current' : '';
        return `<button type="button" class="exam-num-btn ${statusCls} ${currentCls}" onclick="window.lompatKeReviewSoal(${idx})">${it.no}</button>`;
    }).join('');

    let leftCardHtml = '';
    if (!currentItem) {
        leftCardHtml = `
            <div class="question-card" style="text-align:center; padding:36px 24px;">
                <h3 style="margin:0 0 8px; color:#0f172a;">Tidak ada soal pada filter ini</h3>
                <p style="color:#64748b; margin:0 0 16px;">Silakan pilih filter lain di atas untuk melihat pembahasan soal.</p>
                <button class="btn-nav primary" onclick="window.setReviewFilterMode('all')">Tampilkan Semua Soal</button>
            </div>
        `;
    } else {
        const opsiHtml = (currentItem.opsi || []).map(o => {
            const isUserPick = currentItem.userAns === o.label;
            const isBest = currentItem.kategori === 'TKP'
                ? Number(o.poin || 0) >= currentItem.maxPoin
                : Boolean(o.benar);

            let border = '1.5px solid #e2e8f0';
            let bg = '#ffffff';
            let circleStyle = '';
            if (isBest) {
                border = '1.5px solid #16a34a';
                bg = '#f0fdf4';
                circleStyle = 'background:#16a34a; color:#ffffff; border-color:#16a34a;';
            } else if (isUserPick && !isBest) {
                border = '1.5px solid #ef4444';
                bg = '#fef2f2';
                circleStyle = 'background:#ef4444; color:#ffffff; border-color:#ef4444;';
            }

            const poinTag = currentItem.kategori === 'TKP'
                ? `<span style="font-size:0.75rem; font-weight:700; color:#475569; white-space:nowrap;">Poin ${o.poin || 0}</span>`
                : (o.benar ? `<span style="font-size:0.75rem; font-weight:800; color:#15803d; white-space:nowrap;">Kunci Benar</span>` : '');

            return `
                <div class="option-item" style="cursor:default; border:${border}; background:${bg}; align-items:flex-start;">
                    <div class="option-circle" style="${circleStyle}">${o.label}</div>
                    <div class="option-label" style="flex:1;">${o.teks}</div>
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-left:8px;">
                        ${isUserPick ? `<span style="font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:999px; background:#dbeafe; color:#1d4ed8;">Jawabanmu</span>` : ''}
                        ${poinTag}
                    </div>
                </div>
            `;
        }).join('');

        leftCardHtml = `
            <div class="question-card">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:14px;">
                    <span class="badge-subtes ${String(currentItem.kategori || 'twk').toLowerCase()}">
                        SOAL #${currentItem.no} • ${currentItem.kategori}${currentItem.subKategori ? ' • ' + currentItem.subKategori : ''}
                    </span>
                    <span style="font-size:0.8rem; font-weight:800; padding:5px 12px; border-radius:999px; ${currentItem.isCorrect ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                        ${currentItem.userAns ? `Jawabanmu: ${currentItem.userAns} (+${currentItem.userPoin} poin)` : 'Tidak Dijawab (0 poin)'}
                    </span>
                </div>

                <div class="question-text">${formatQuestionTextHtml(currentItem.soal)}</div>
                ${currentItem.gambar ? `<div style="margin:10px 0 14px; text-align:center;">${currentItem.gambar}</div>` : ''}
                <div class="options-list">${opsiHtml}</div>

                <div style="margin-top:18px;">
                    ${window.buildInteractivePembahasanHtml(currentItem, currentItem.userAns, `rev_${currentItem.no}`, {
                        headerTitle: 'Pembahasan Mentor',
                        gotPoin: currentItem.userPoin,
                        maxPoin: currentItem.maxPoin
                    })}
                </div>

                <div class="exam-nav">
                    <button class="btn-nav" ${state.idx === 0 ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : `onclick="window.lompatKeReviewSoal(${state.idx - 1})"`}>
                        <i class="fas fa-chevron-left"></i> Sebelumnya
                    </button>
                    <button class="btn-nav primary" ${state.idx >= filteredItems.length - 1 ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : `onclick="window.lompatKeReviewSoal(${state.idx + 1})"`}>
                        Berikutnya <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    examStage.innerHTML = `
        <div class="exam-header" style="gap:12px;">
            <div class="exam-meta" style="flex-wrap:wrap;">
                <button class="btn-nav" onclick="window.kembaliDariReviewKeBrankas()" style="padding:7px 14px;">
                    <i class="fas fa-arrow-left"></i> Kembali ke Brankas
                </button>
                <div>
                    <div style="font-weight:800; font-size:0.95rem; color:#0f172a;">Review: ${attempt.title}</div>
                    <div style="font-size:0.76rem; color:#64748b;">Skor: <b>${attempt.totalSkor}/${attempt.maxSkor}</b> • ${attempt.mode}</div>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <div class="filter-chips" style="margin:0;">
                    <button class="filter-chip ${activeFilter === 'all' ? 'active' : ''}" onclick="window.setReviewFilterMode('all')">Semua (${attempt.totalQuestions})</button>
                    <button class="filter-chip ${activeFilter === 'wrong' ? 'active' : ''}" onclick="window.setReviewFilterMode('wrong')">Salah (${attempt.wrongCount})</button>
                    <button class="filter-chip ${activeFilter === 'correct' ? 'active' : ''}" onclick="window.setReviewFilterMode('correct')">Benar (${attempt.totalQuestions - attempt.wrongCount})</button>
                </div>
                <button class="btn-card ${canRemedial ? 'accent' : 'paid-cta'}" style="width:auto; padding:8px 14px; font-size:0.8rem;" onclick="window.mulaiRemedialBrankas('${attempt.id}')">
                    <i class="fas ${canRemedial ? 'fa-redo-alt' : 'fa-crown'}"></i> Ulangi Salah (${attempt.wrongCount})
                </button>
            </div>
        </div>

        <div class="exam-workspace-grid">
            ${leftCardHtml}
            <aside class="exam-nav-panel">
                <div class="exam-nav-panel-head">
                    <h4><i class="fas fa-th" style="color:var(--primary);"></i> Navigasi Review</h4>
                    <span class="exam-nav-count">${filteredItems.length} Soal</span>
                </div>
                <div class="exam-number-grid">${gridButtonsHtml}</div>
                <div class="exam-nav-legend">
                    <span class="exam-legend-item"><span class="exam-legend-dot answered"></span> Benar / Maks</span>
                    <span class="exam-legend-item"><span class="exam-legend-dot wrong"></span> Salah / Kurang</span>
                </div>
            </aside>
        </div>
    `;
};

window.kembaliKeDaftarBrankas = () => {
    window.brankasMode = 'list';
    window.renderBrankasPembahasan();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.setBrankasDateFilter = (val) => {
    window.brankasDateFilter = val || 'all';
    window.renderBrankasPembahasan();
};

window.mulaiRemedialBrankas = (attemptId) => {
    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    const tier = String(prof.tier || 'free').toLowerCase();
    const canRemedial = Boolean(prof.isAdmin || tier === 'gold');
    if (!canRemedial) {
        return window.bukaModalUpgrade('Coba Lagi Soal yang Salah', 'Paket Gold (Rp 99.999)');
    }

    const attempt = getBrankasHistory().find(a => a.id === attemptId);
    if (!attempt) return;

    const wrongItems = (attempt.items || []).filter(it => !it.isCorrect);
    if (wrongItems.length === 0) {
        return Swal.fire('Mantap!', 'Semua soal pada paket ini sudah terjawab dengan poin maksimal.', 'success');
    }

    window.currentQuestions = wrongItems.map(it => ({
        id: it.id,
        kategori: it.kategori,
        subKategori: it.subKategori,
        soal: it.soal,
        opsi: it.opsi,
        pembahasan: it.pembahasan
    }));
    window.examTimeRemaining = window.currentQuestions.length * 60;
    window.currentAppMode = 'singleplayer';
    window.currentPackageMeta = {
        saveId: `remedial_${attempt.id}`,
        tipe: 'remedial',
        paketNo: null,
        title: `Remedial: ${attempt.title}`,
        totalDurationSeconds: window.examTimeRemaining
    };
    startExamSessionUI();
};

window.renderBrankasPembahasan = () => {
    const area = document.getElementById('brankasContentArea');
    if (!area) return;

    const history = getBrankasHistory();
    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    const tier = String(prof.tier || 'free').toLowerCase();
    const canReview = Boolean(prof.isPaid || prof.isAdmin);
    const canRemedial = Boolean(prof.isAdmin || tier === 'gold');

    const statTotal = document.getElementById('brankasStatTotal');
    const statLast = document.getElementById('brankasStatLast');
    const statLastLabel = document.getElementById('brankasStatLastLabel');
    const statAccess = document.getElementById('brankasStatAccess');
    if (statTotal) statTotal.textContent = `${history.length} Paket`;
    if (statLast && history.length === 0) statLast.textContent = '-';
    if (statLastLabel && history.length === 0) statLastLabel.textContent = 'Skor Rata-Rata';
    if (statAccess) {
        if (prof.isAdmin) statAccess.textContent = 'ADMIN (Full + Remedial)';
        else if (tier === 'gold') statAccess.textContent = 'GOLD (Full + Remedial)';
        else if (canReview) statAccess.textContent = `${tier.toUpperCase()} (Review Aktif)`;
        else statAccess.textContent = 'FREE (Skor Saja)';
    }

    if (history.length === 0) {
        window.brankasMode = 'list';
        area.innerHTML = `
            <div class="empty-state-card">
                <div class="empty-icon"><i class="fas fa-folder-open"></i></div>
                <h3>Belum Ada Riwayat Simulasi Tersimpan</h3>
                <p>Selesaikan simulasi CAT atau Tryout untuk menyimpan riwayat nilai, kunci jawaban, dan pembahasan otomatis di Brankas Pembahasan.</p>
                <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                    <button class="btn-card primary" style="width:auto;" onclick="window.switchAppView('cat')">
                        <i class="fas fa-play"></i> Pilih Paket Simulasi CAT
                    </button>
                </div>
            </div>
        `;
        return;
    }

    // HALAMAN KHUSUS REVIEW PEMBAHASAN / REVIEW SALAH
    if (window.brankasMode === 'review' && canReview) {
        const activeAttempt = history.find(h => h.id === window.selectedBrankasAttemptId) || history[0];
        if (!activeAttempt) {
            window.brankasMode = 'list';
            return window.renderBrankasPembahasan();
        }
        const activeFilter = window.brankasReviewFilter || 'all';
        const filteredItems = (activeAttempt.items || []).filter(it => {
            if (activeFilter === 'wrong') return !it.isCorrect;
            if (activeFilter === 'correct') return it.isCorrect;
            return true;
        });

        const itemsMarkup = filteredItems.map(it => {
            const opsiHtml = (it.opsi || []).map(o => {
                const isUserPick = it.userAns === o.label;
                const isBest = it.kategori === 'TKP' ? Number(o.poin || 0) >= it.maxPoin : Boolean(o.benar);
                let border = '1px solid #e2e8f0';
                let bg = '#ffffff';
                if (isBest) {
                    border = '1.5px solid #16a34a';
                    bg = '#f0fdf4';
                } else if (isUserPick && !isBest) {
                    border = '1.5px solid #dc2626';
                    bg = '#fef2f2';
                }
                const poinTag = it.kategori === 'TKP'
                    ? `<span style="font-size:0.74rem; font-weight:700; color:#475569; margin-left:auto;">Poin ${o.poin || 0}</span>`
                    : (o.benar ? `<span style="font-size:0.74rem; font-weight:700; color:#15803d; margin-left:auto;">Kunci</span>` : '');

                return `
                    <div style="display:flex; align-items:flex-start; gap:10px; padding:10px 12px; border-radius:8px; border:${border}; background:${bg}; font-size:0.86rem;">
                        <strong style="min-width:20px;">${o.label}.</strong>
                        <span style="flex:1; color:#1e293b;">${o.teks}</span>
                        ${isUserPick ? `<span style="font-size:0.72rem; font-weight:800; padding:2px 7px; border-radius:999px; background:#dbeafe; color:#1d4ed8;">Jawabanmu</span>` : ''}
                        ${poinTag}
                    </div>
                `;
            }).join('');

            return `
                <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:18px; margin-bottom:14px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
                        <span class="badge-cat">SOAL #${it.no} • ${it.kategori}${it.subKategori ? ' • ' + it.subKategori : ''}</span>
                        <span style="font-size:0.78rem; font-weight:800; padding:4px 10px; border-radius:999px; ${it.isCorrect ? 'background:#dcfce7; color:#15803d;' : 'background:#fef3c7; color:#b45309;'}">
                            ${it.userAns ? `Jawaban: ${it.userAns} (+${it.userPoin} poin)` : 'Tidak Dijawab (0 poin)'}
                        </span>
                    </div>
                    <div style="font-size:0.93rem; color:#0f172a; line-height:1.6; margin:0 0 12px; white-space:pre-line;">${formatQuestionTextHtml(it.soal)}</div>
                    ${it.gambar ? `<div style="margin:0 0 12px; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; overflow-x:auto;">${it.gambar}</div>` : ''}
                    <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">${opsiHtml}</div>
                    ${window.buildInteractivePembahasanHtml(it, it.userAns, `brankas_${it.no}`, {
                        headerTitle: 'Pembahasan Mentor',
                        gotPoin: it.userPoin,
                        maxPoin: it.maxPoin
                    })}
                </div>
            `;
        }).join('');

        area.innerHTML = `
            <div style="background:white; border:1px solid #e2e8f0; border-radius:14px; padding:16px 18px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <button class="btn-nav" onclick="window.kembaliKeDaftarBrankas()">
                        <i class="fas fa-arrow-left"></i> Kembali ke Brankas
                    </button>
                    <div>
                        <h3 style="margin:0; font-size:1.05rem; color:#0f172a;">${activeAttempt.title}</h3>
                        <span style="font-size:0.78rem; color:#64748b;">Skor: <b>${activeAttempt.totalSkor}/${activeAttempt.maxSkor}</b> • ${activeAttempt.mode}</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <div class="filter-chips" style="margin:0;">
                        <button class="filter-chip ${activeFilter === 'all' ? 'active' : ''}" onclick="window.bukaReviewBrankas('${activeAttempt.id}', 'all')">Semua (${activeAttempt.totalQuestions})</button>
                        <button class="filter-chip ${activeFilter === 'wrong' ? 'active' : ''}" onclick="window.bukaReviewBrankas('${activeAttempt.id}', 'wrong')">Salah / Belum Maks (${activeAttempt.wrongCount})</button>
                        <button class="filter-chip ${activeFilter === 'correct' ? 'active' : ''}" onclick="window.bukaReviewBrankas('${activeAttempt.id}', 'correct')">Benar (${activeAttempt.totalQuestions - activeAttempt.wrongCount})</button>
                    </div>
                    <button class="btn-card ${canRemedial ? 'accent' : 'paid-cta'}" style="width:auto; padding:8px 14px;" onclick="window.mulaiRemedialBrankas('${activeAttempt.id}')">
                        <i class="fas ${canRemedial ? 'fa-redo-alt' : 'fa-crown'}"></i> Ulangi Soal Salah (${activeAttempt.wrongCount})
                    </button>
                </div>
            </div>
            ${itemsMarkup || '<div class="empty-state-card"><p>Tidak ada soal pada filter ini.</p></div>'}
        `;
        return;
    }

    // HALAMAN UTAMA BRANKAS: FILTER KATEGORI + TANGGAL + PROGRES GRAFIK
    const toDayKey = (ts) => {
        const d = new Date(ts || Date.now());
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const todayKey = toDayKey(Date.now());
    const dateFilter = window.brankasDateFilter || 'all';
    const catFilter = window.brankasCatFilter || 'all';

    window.setBrankasCatFilter = (cat) => {
        window.brankasCatFilter = cat || 'all';
        window.renderBrankasPembahasan();
    };

    const getBrankasCat = (item) => {
        const tipe = String(item?.tipe || '').toLowerCase();
        const title = String(item?.title || '').toLowerCase();
        if (tipe.startsWith('twk') || title.includes('twk')) return 'twk';
        if (tipe.startsWith('tiu') || title.includes('tiu')) return 'tiu';
        if (tipe.startsWith('tkp') || title.includes('tkp')) return 'tkp';
        return 'tryout';
    };

    const uniqueDays = [];
    const seenDays = new Set();
    history.forEach(item => {
        const key = toDayKey(item.finishedAt);
        if (!seenDays.has(key)) {
            seenDays.add(key);
            const label = new Date(item.finishedAt || Date.now()).toLocaleDateString('id-ID', {
                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
            });
            uniqueDays.push({ key, label });
        }
    });

    const filteredHistory = history.filter(item => {
        const key = toDayKey(item.finishedAt);
        const matchDate = dateFilter === 'all' || key === dateFilter;
        const matchCat = catFilter === 'all' || getBrankasCat(item) === catFilter;
        return matchDate && matchCat;
    });

    const calcAvgStats = (list) => {
        if (!list || !list.length) return { count: 0, avgSkor: 0, avgMax: 0, avgPct: 0 };
        const avgSkor = Math.round(list.reduce((s, x) => s + Number(x.totalSkor || 0), 0) / list.length);
        const avgMax = Math.round(list.reduce((s, x) => s + Number(x.maxSkor || 0), 0) / list.length);
        const avgPct = Math.round(list.reduce((s, x) => s + (x.maxSkor > 0 ? (Number(x.totalSkor || 0) / x.maxSkor) * 100 : 0), 0) / list.length);
        return { count: list.length, avgSkor, avgMax, avgPct };
    };
    window.brankasAverageSummary = {
        all: calcAvgStats(history),
        tryout: calcAvgStats(history.filter(x => getBrankasCat(x) === 'tryout')),
        twk: calcAvgStats(history.filter(x => getBrankasCat(x) === 'twk')),
        tiu: calcAvgStats(history.filter(x => getBrankasCat(x) === 'tiu')),
        tkp: calcAvgStats(history.filter(x => getBrankasCat(x) === 'tkp')),
        filtered: calcAvgStats(filteredHistory)
    };
    const catAvgLabelMap = {
        all: 'Skor Rata-Rata (Semua)',
        tryout: 'Skor Rata-Rata Tryout',
        twk: 'Skor Rata-Rata TWK',
        tiu: 'Skor Rata-Rata TIU',
        tkp: 'Skor Rata-Rata TKP'
    };
    if (statLastLabel) statLastLabel.textContent = catAvgLabelMap[catFilter] || 'Skor Rata-Rata';
    if (statLast) {
        const curAvg = window.brankasAverageSummary.filtered;
        statLast.textContent = curAvg.count > 0 ? `${curAvg.avgSkor} / ${curAvg.avgMax} (${curAvg.avgPct}%)` : '-';
    }

    const dayOptionsHtml = uniqueDays.map(d =>
        `<option value="${d.key}" ${dateFilter === d.key ? 'selected' : ''}>${d.label}${d.key === todayKey ? ' (Hari Ini)' : ''}</option>`
    ).join('');

    const CAT_META = {
        tryout: { label: 'Tryout', color: '#7c3aed' },
        twk: { label: 'TWK', color: '#2563eb' },
        tiu: { label: 'TIU', color: '#d97706' },
        tkp: { label: 'TKP', color: '#16a34a' }
    };

    const buildProgressAnalyticsHtml = (dataset) => {
        if (!dataset || dataset.length === 0) {
            if (!history || history.length === 0) return '';
            return `
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:16px 18px; margin-bottom:16px; color:#64748b; font-size:0.84rem; text-align:center;">
                    Belum ada riwayat nilai untuk filter kategori/tanggal ini.
                </div>
            `;
        }
        const chrono = [...dataset].slice(0, 12).reverse();
        const pctList = chrono.map(it => it.maxSkor > 0 ? Math.round(((it.totalSkor || 0) / it.maxSkor) * 100) : 0);
        const avgPct = Math.round(pctList.reduce((a, b) => a + b, 0) / pctList.length);
        const bestItem = dataset.reduce((best, cur) => {
            const bPct = best.maxSkor > 0 ? best.totalSkor / best.maxSkor : 0;
            const cPct = cur.maxSkor > 0 ? cur.totalSkor / cur.maxSkor : 0;
            return cPct > bPct ? cur : best;
        }, dataset[0]);
        const lulusCount = dataset.filter(it => it.statusLolos).length;

        // SVG Line Chart (Grafik Garis Naik-Turun Multi-Warna sesuai Filter)
        const w = 440, h = 156, padL = 32, padR = 20, padT = 18, padB = 26;
        const plotW = w - padL - padR;
        const plotH = h - padT - padB;
        const allPts = chrono.map((it, idx) => {
            const x = chrono.length === 1 ? padL + plotW / 2 : padL + (idx / (chrono.length - 1)) * plotW;
            const pct = pctList[idx];
            const y = padT + plotH - (pct / 100) * plotH;
            return {
                x: Number(x.toFixed(1)),
                y: Number(y.toFixed(1)),
                pct,
                skor: it.totalSkor || 0,
                max: it.maxSkor || 0,
                cat: getBrankasCat(it),
                idx
            };
        });

        const activeCats = catFilter === 'all'
            ? Object.keys(CAT_META).filter(c => allPts.some(p => p.cat === c))
            : [catFilter];

        const defsSvg = Object.entries(CAT_META).map(([cat, meta]) => `
            <linearGradient id="brankasArea-${cat}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${meta.color}" stop-opacity="0.20"/>
                <stop offset="100%" stop-color="${meta.color}" stop-opacity="0.01"/>
            </linearGradient>
            <marker id="brankasArrow-${cat}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="${meta.color}"/>
            </marker>
        `).join('');

        const seriesSvg = activeCats.map(cat => {
            const meta = CAT_META[cat] || CAT_META.tryout;
            const pts = allPts.filter(p => p.cat === cat);
            if (!pts.length) return '';
            const polyPoints = pts.map(p => `${p.x},${p.y}`).join(' ');
            const areaPoints = (catFilter !== 'all' && pts.length > 1)
                ? `${pts[0].x},${padT + plotH} ${polyPoints} ${pts[pts.length - 1].x},${padT + plotH}`
                : '';
            const lineSvg = pts.length > 1
                ? `<polyline fill="none" stroke="${meta.color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#brankasArrow-${cat})" points="${polyPoints}"/>`
                : '';
            const dotsSvg = pts.map(p => `
                <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="${meta.color}" stroke="#ffffff" stroke-width="2"/>
                <text x="${p.x}" y="${Math.max(11, p.y - 8)}" text-anchor="middle" font-size="9" font-weight="800" fill="${meta.color}">${p.skor}</text>
            `).join('');
            return `
                ${areaPoints ? `<polygon points="${areaPoints}" fill="url(#brankasArea-${cat})"/>` : ''}
                ${lineSvg}
                ${dotsSvg}
            `;
        }).join('');

        const xLabelsSvg = allPts.map((p, idx) => `
            <text x="${p.x}" y="${h - 6}" text-anchor="middle" font-size="9" font-weight="700" fill="#64748b">#${idx + 1}</text>
        `).join('');

        const legendHtml = catFilter === 'all'
            ? `<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:6px; padding-top:6px; border-top:1px dashed #e2e8f0; font-size:0.72rem; font-weight:700; color:#475569;">
                ${Object.entries(CAT_META).map(([cat, meta]) => `
                    <span style="display:inline-flex; align-items:center; gap:5px; ${allPts.some(p => p.cat === cat) ? '' : 'opacity:0.45;'}">
                        <span style="display:inline-block; width:14px; height:3px; border-radius:2px; background:${meta.color};"></span>
                        <span style="color:${meta.color}; font-weight:800;">${meta.label}</span>
                    </span>
                `).join('')}
               </div>`
            : `<div style="display:flex; align-items:center; gap:6px; margin-top:6px; padding-top:6px; border-top:1px dashed #e2e8f0; font-size:0.72rem; font-weight:800; color:${(CAT_META[catFilter] || CAT_META.tryout).color};">
                <span style="display:inline-block; width:14px; height:3px; border-radius:2px; background:${(CAT_META[catFilter] || CAT_META.tryout).color};"></span>
                Tren Kategori ${(CAT_META[catFilter] || CAT_META.tryout).label}
               </div>`;

        // Bar Batang Rata-Rata Subtes (TWK, TIU, TKP)
        const subMetrics = [
            { label: 'TWK', val: Math.round(dataset.reduce((s, x) => s + (x.skorTWK || 0), 0) / dataset.length), refMax: 150, color: '#2563eb' },
            { label: 'TIU', val: Math.round(dataset.reduce((s, x) => s + (x.skorTIU || 0), 0) / dataset.length), refMax: 175, color: '#d97706' },
            { label: 'TKP', val: Math.round(dataset.reduce((s, x) => s + (x.skorTKP || 0), 0) / dataset.length), refMax: 225, color: '#16a34a' }
        ];
        const barsHtml = subMetrics.map(m => {
            const hPct = Math.max(10, Math.min(100, Math.round((m.val / m.refMax) * 100)));
            return `
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:5px;">
                    <span style="font-size:0.74rem; font-weight:800; color:#0f172a;">${m.val}</span>
                    <div style="width:100%; max-width:52px; height:86px; background:#f1f5f9; border-radius:8px; display:flex; align-items:flex-end; overflow:hidden; border:1px solid #e2e8f0;">
                        <div style="width:100%; height:${hPct}%; background:${m.color}; border-radius:6px 6px 0 0; transition:height 0.3s;"></div>
                    </div>
                    <span style="font-size:0.75rem; font-weight:800; color:#475569;">${m.label}</span>
                </div>
            `;
        }).join('');

        return `
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:16px 18px; margin-bottom:16px; box-shadow:0 4px 14px rgba(15,23,42,0.03);">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
                    <h3 style="margin:0; font-size:0.98rem; font-weight:800; color:#1e3a8a;"><i class="fas fa-chart-line" style="color:#2563eb;"></i> Progres &amp; Klasemen Nilai</h3>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; font-size:0.75rem; font-weight:800;">
                        <span style="background:#eff6ff; color:#1d4ed8; padding:4px 10px; border-radius:999px;">Rata-rata: ${avgPct}%</span>
                        <span style="background:#fef3c7; color:#b45309; padding:4px 10px; border-radius:999px;">Terbaik: ${bestItem.totalSkor}/${bestItem.maxSkor}</span>
                        <span style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:999px;">Lulus PG: ${lulusCount}/${dataset.length}</span>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:14px; align-items:stretch;">
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="font-size:0.76rem; font-weight:800; color:#475569; margin-bottom:4px;">Grafik Garis Tren Nilai (Skor Paket)</div>
                        <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:145px; display:block;">
                            <defs>${defsSvg}</defs>
                            <line x1="${padL}" y1="${padT}" x2="${w - padR}" y2="${padT}" stroke="#e2e8f0" stroke-dasharray="3,3"/>
                            <line x1="${padL}" y1="${padT + plotH / 2}" x2="${w - padR}" y2="${padT + plotH / 2}" stroke="#e2e8f0" stroke-dasharray="3,3"/>
                            <line x1="${padL}" y1="${padT + plotH}" x2="${w - padR}" y2="${padT + plotH}" stroke="#cbd5e1"/>
                            <text x="4" y="${padT + 3}" font-size="8.5" fill="#94a3b8" font-weight="700">100%</text>
                            <text x="8" y="${padT + plotH / 2 + 3}" font-size="8.5" fill="#94a3b8" font-weight="700">50%</text>
                            <text x="14" y="${padT + plotH + 3}" font-size="8.5" fill="#94a3b8" font-weight="700">0%</text>
                            ${seriesSvg}
                            ${xLabelsSvg}
                        </svg>
                        ${legendHtml}
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="font-size:0.76rem; font-weight:800; color:#475569; margin-bottom:8px;">Diagram Bar Batang Rata-Rata Subtes</div>
                        <div style="display:flex; align-items:flex-end; justify-content:space-around; gap:12px; flex:1; padding-top:4px;">
                            ${barsHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    const analyticsHtml = buildProgressAnalyticsHtml(filteredHistory);

    const listHtml = filteredHistory.map(item => {
        const tgl = new Date(item.finishedAt || Date.now()).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        return `
            <div class="card-mode packet-card" style="padding:18px;">
                <div>
                    <div class="packet-badges">
                        <span class="badge-access ${item.statusLolos ? 'free' : 'paid'}" style="${item.statusLolos ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                            ${item.statusLolos ? 'LULUS PG' : 'BELUM PG'}
                        </span>
                        <span class="badge-cat">${item.mode} • ${item.durasiText}</span>
                    </div>
                    <h3 style="margin:6px 0 4px; font-size:1rem;">${item.title}</h3>
                    <div style="font-size:0.78rem; color:#64748b; margin-bottom:10px;">
                        ${tgl} • Dijawab ${item.answeredCount}/${item.totalQuestions} • Salah/Kurang: <b>${item.wrongCount}</b>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <span style="font-size:0.82rem; color:#475569; font-weight:600;">Total Skor</span>
                        <strong style="font-size:1.1rem; color:var(--primary);">${item.totalSkor} <small style="color:#94a3b8; font-weight:600;">/ ${item.maxSkor}</small></strong>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <button class="btn-card primary" style="padding:9px 10px; font-size:0.8rem;" onclick="window.bukaReviewBrankas('${item.id}', 'all')">
                        <i class="fas ${canReview ? 'fa-book-open' : 'fa-lock'}"></i> Review
                    </button>
                    <button class="btn-card outline" style="padding:9px 10px; font-size:0.8rem;" onclick="window.bukaReviewBrankas('${item.id}', 'wrong')">
                        <i class="fas ${canReview ? 'fa-times-circle' : 'fa-lock'}"></i> Review Salah (${item.wrongCount})
                    </button>
                    <button class="btn-card ${canRemedial ? 'accent' : 'paid-cta'}" style="padding:9px 10px; font-size:0.8rem;" onclick="window.mulaiRemedialBrankas('${item.id}')">
                        <i class="fas ${canRemedial ? 'fa-redo-alt' : 'fa-crown'}"></i> Ulangi Salah
                    </button>
                    <button class="btn-card" style="padding:9px 10px; font-size:0.8rem; background:#fee2e2; color:#b91c1c;" onclick="window.hapusRiwayatBrankas('${item.id}')">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </div>
            </div>
        `;
    }).join('');

    area.innerHTML = `
        ${analyticsHtml}
        <div class="lobby-filter-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
            <div class="filter-chips" style="margin:0;">
                <button class="filter-chip ${catFilter === 'all' ? 'active' : ''}" onclick="window.setBrankasCatFilter('all')">Semua (${history.length})</button>
                <button class="filter-chip ${catFilter === 'tryout' ? 'active' : ''}" onclick="window.setBrankasCatFilter('tryout')">Tryout</button>
                <button class="filter-chip ${catFilter === 'twk' ? 'active' : ''}" onclick="window.setBrankasCatFilter('twk')">TWK</button>
                <button class="filter-chip ${catFilter === 'tiu' ? 'active' : ''}" onclick="window.setBrankasCatFilter('tiu')">TIU</button>
                <button class="filter-chip ${catFilter === 'tkp' ? 'active' : ''}" onclick="window.setBrankasCatFilter('tkp')">TKP</button>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <label for="brankasDaySelect" style="font-size:0.8rem; font-weight:700; color:#475569;"><i class="fas fa-calendar-alt"></i> Pilih Tanggal:</label>
                <select id="brankasDaySelect" onchange="window.setBrankasDateFilter(this.value)" style="padding:7px 12px; border-radius:10px; border:1px solid #cbd5e1; background:white; font-size:0.82rem; font-weight:600; color:#1e293b;">
                    <option value="all" ${dateFilter === 'all' ? 'selected' : ''}>Semua Tanggal</option>
                    ${dayOptionsHtml}
                </select>
            </div>
        </div>
        ${filteredHistory.length > 0
            ? `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(310px, 1fr)); gap:16px;">${listHtml}</div>`
            : `<div class="empty-state-card"><p>Tidak ada riwayat simulasi pada kategori/tanggal yang dipilih.</p></div>`
        }
    `;
};

window.pilihPreviewLanding = (btnEl, poin, feedbackText) => {
    const container = document.getElementById('landingPreviewOptions');
    if (container) {
        container.querySelectorAll('.preview-opt-btn').forEach(b => b.classList.remove('best', 'mid'));
    }
    if (btnEl) {
        btnEl.classList.add(poin >= 5 ? 'best' : 'mid');
    }
    const fb = document.getElementById('landingPreviewFeedback');
    if (fb) {
        fb.style.display = 'block';
        fb.style.borderLeftColor = poin >= 5 ? '#16a34a' : '#f59e0b';
        fb.style.background = poin >= 5 ? '#f0fdf4' : '#fffbeb';
        fb.style.color = poin >= 5 ? '#14532d' : '#78350f';
        fb.innerHTML = `<strong>Skor Opsi: +${poin} Poin</strong> — ${feedbackText}`;
    }
};

window.ubahTargetSkorSKD = async () => {
    const uid = window.currentUser?.uid || 'guest';
    const key = `menuju_asn_target_skor_${uid}`;
    const current = Number(localStorage.getItem(key) || 420);
    const res = await Swal.fire({
        title: 'Atur Target Skor SKD',
        input: 'number',
        inputValue: current,
        inputAttributes: { min: 150, max: 550, step: 5 },
        text: 'Masukkan target skor SKD impianmu (maksimal 550):',
        showCancelButton: true,
        confirmButtonText: 'Simpan Target',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#1e3a8a'
    });
    if (res.isConfirmed && res.value) {
        const val = Math.max(150, Math.min(550, Number(res.value) || 420));
        localStorage.setItem(key, String(val));
        window.renderBerandaProgressPanel();
    }
};

window.renderBerandaProgressPanel = () => {
    const el = document.getElementById('berandaProgressPanel');
    if (!el) return;

    const uid = window.currentUser?.uid || 'guest';
    const targetSkor = Number(localStorage.getItem(`menuju_asn_target_skor_${uid}`) || 420);
    const history = typeof getBrankasHistory === 'function' ? getBrankasHistory() : [];
    const recent = history.slice(0, 6).reverse();
    const bestSkor = history.reduce((mx, h) => Math.max(mx, Number(h.totalSkor || 0)), 0);
    const pct = Math.min(100, Math.round((bestSkor / targetSkor) * 100));

    let trendHtml = '';
    if (recent.length === 0) {
        trendHtml = `
            <div style="font-size:0.84rem; color:#64748b; padding:12px 0;">
                Belum ada riwayat simulasi. Selesaikan 1 paket latihan untuk melihat grafik perkembangan skormu di sini!
            </div>
        `;
    } else {
        const maxBar = recent.reduce((mx, h) => Math.max(mx, Number(h.maxSkor || 225), Number(h.totalSkor || 0)), 100);
        const bars = recent.map((h, i) => {
            const hPct = Math.max(10, Math.round(((h.totalSkor || 0) / maxBar) * 100));
            return `
                <div class="trend-bar-col" title="${h.title}: ${h.totalSkor}/${h.maxSkor}">
                    <span class="trend-bar-val">${h.totalSkor}</span>
                    <div class="trend-bar-rect" style="height:${hPct}%;"></div>
                    <span class="trend-bar-lbl">#${i + 1}</span>
                </div>
            `;
        }).join('');
        trendHtml = `<div class="trend-bars-wrap">${bars}</div>`;
    }

    el.innerHTML = `
        <div class="progress-card-grid">
            <div class="progress-box">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <strong style="font-size:0.94rem; color:#0f172a;"><i class="fas fa-bullseye" style="color:var(--primary);"></i> Target Skor SKD Kamu</strong>
                    <button onclick="window.ubahTargetSkorSKD()" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:8px; padding:4px 10px; font-size:0.74rem; font-weight:700; cursor:pointer;">Ubah Target</button>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:10px;">
                    <span style="font-size:1.35rem; font-weight:900; color:var(--primary);">${bestSkor} <small style="font-size:0.82rem; color:#64748b; font-weight:600;">/ ${targetSkor} poin</small></span>
                    <span style="font-size:0.82rem; font-weight:800; color:#16a34a;">${pct}% Tercapai</span>
                </div>
                <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%;"></div></div>
                <div style="font-size:0.76rem; color:#64748b;">Skor terbaik diambil otomatis dari riwayat Brankas Pembahasanmu.</div>
            </div>
            <div class="progress-box">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <strong style="font-size:0.94rem; color:#0f172a;"><i class="fas fa-chart-line" style="color:#16a34a;"></i> Tren ${recent.length || ''} Simulasi Terakhir</strong>
                    <span style="font-size:0.75rem; color:#64748b; font-weight:600;">${history.length} Total Paket</span>
                </div>
                ${trendHtml}
            </div>
        </div>
    `;
};

window.mulaiModeBelajar1Klik = async () => {
    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    if (!prof.isPaid && !prof.isAdmin) {
        return window.bukaModalUpgrade(
            'Mode Belajar 1x Klik Pembahasan',
            'Paket Bronze (Rp 49.999) / Silver (Rp 74.999) / Gold (Rp 99.999)'
        );
    }

    const res = await Swal.fire({
        title: 'Mode Belajar 1x Klik Pembahasan',
        text: 'Pilih fokus subtes yang ingin dipelajari (langsung tampil kunci, bobot 1–5 & pembahasan saat klik opsi):',
        input: 'select',
        inputOptions: {
            tkp: 'TKP (45 Soal • Bobot 1–5)',
            twk: 'TWK (Tes Wawasan Kebangsaan)',
            tiu: 'TIU (Tes Inteligensi Umum)'
        },
        inputValue: 'tkp',
        showCancelButton: true,
        confirmButtonText: 'Mulai Belajar',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#1e3a8a'
    });

    if (!res.isConfirmed || !res.value) return;
    window.mulaiSingleplayer(res.value);
    window.isInstantReviewMode = true;
    if (window.currentPackageMeta) {
        window.currentPackageMeta.title = `Mode Belajar 1x Klik (${String(res.value).toUpperCase()})`;
    }
    renderSoalSekarang();
};

window.kembaliKeLobby = () => {
    clearInterval(window.examTimerInterval);
    clearInterval(window._botAutoNextInterval);
    document.getElementById('arenaFloatingChatDock')?.remove();
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
    if (typeof window.renderArenaSavedRooms === 'function') window.renderArenaSavedRooms();
    if (typeof window.renderArenaLeaderboardHistory === 'function') window.renderArenaLeaderboardHistory();
};

// ==========================================================
// 3. MODE MULTIPLAYER CBT ARENA (HYBRID HEMAT DB & KAPASITAS TIER)
// ==========================================================
function isAllowedArenaUser(prof) {
    if (!prof) return false;
    if (prof.isAdmin) return true;
    const t = String(prof.tier || 'free').toLowerCase();
    return Boolean(prof.isPaid && ['bronze', 'silver', 'gold'].includes(t));
}

function buildArenaPaketOptionsHtml() {
    let html = `
        <option value="full">Simulasi SKD Lengkap (TWK + TIU + TKP)</option>
    `;
    for (let i = 1; i <= 40; i++) {
        html += `<option value="twk_${i}">TWK Paket #${i} (30 Soal)</option>`;
    }
    for (let i = 1; i <= 40; i++) {
        html += `<option value="tiu_${i}">TIU Paket #${i} (35 Soal)</option>`;
    }
    for (let i = 1; i <= 40; i++) {
        html += `<option value="tkp_${i}">TKP Paket #${i} (45 Soal)</option>`;
    }
    return html;
}

function getQuestionsForRoomPaket(paketKey) {
    const rawData = window.DATA_SKD_CPNS || [];
    const key = String(paketKey || 'full');
    if (key === 'twk') {
        const qs = rawData.filter(q => q.kategori === 'TWK' && /^twk_\d{4}$/.test(q.id)).slice(0, 30);
        return { questions: qs, durationSec: qs.length * 60, label: 'TWK Paket #1' };
    }
    if (key.startsWith('twk_')) {
        const no = Math.max(1, Math.min(40, Number(key.split('_')[1]) || 1));
        const allPaidTwk = rawData.filter(q => q.kategori === 'TWK' && /^twk_\d{4}$/.test(q.id));
        const qs = allPaidTwk.slice((no - 1) * 30, no * 30);
        return { questions: qs, durationSec: qs.length * 60, label: `TWK Paket #${no}` };
    }
    if (key.startsWith('tiu_')) {
        const no = Math.max(1, Math.min(40, Number(key.split('_')[1]) || 1));
        const allPaidTiu = rawData.filter(q => q.kategori === 'TIU' && /^tiu_\d{4}$/.test(q.id));
        const qs = allPaidTiu.slice((no - 1) * 35, no * 35);
        return { questions: qs, durationSec: qs.length * 60, label: `TIU Paket #${no}` };
    }
    if (key.startsWith('tkp_')) {
        const no = Math.max(1, Math.min(40, Number(key.split('_')[1]) || 1));
        const allTkp = rawData.filter(q => q.kategori === 'TKP');
        const packages = buildBalancedTkpPackages(allTkp, 40, 45);
        const qs = packages[no - 1] || [];
        return { questions: qs, durationSec: qs.length * 60, label: `TKP Paket #${no}` };
    }
    return { questions: [...rawData], durationSec: 100 * 60, label: 'Simulasi SKD Lengkap' };
}

window.bukaModalBikinRoom = () => {
    if (!window.currentUser) {
        return Swal.fire({
            title: 'Login Diperlukan',
            text: 'Silakan masuk dengan akun Google untuk membuka Room CBT Arena.',
            icon: 'info',
            confirmButtonText: 'Login Sekarang',
            confirmButtonColor: '#1e3a8a'
        }).then(res => {
            if (res.isConfirmed) window.eksekusiLoginGoogle();
        });
    }

    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    if (!isAllowedArenaUser(prof)) {
        return window.bukaModalUpgrade(
            'Buat Room CBT Arena',
            'Khusus Paket Bronze (2 Peserta), Silver (3 Peserta), atau Gold (4 Peserta). Akun Free terkunci.'
        );
    }

    const defaultTier = prof.isAdmin ? 'gold' : String(prof.tier || 'bronze').toLowerCase();
    const tierOptionsHtml = prof.isAdmin
        ? `
            <option value="bronze">Bronze (Maks 2 Peserta)</option>
            <option value="silver">Silver (Maks 3 Peserta)</option>
            <option value="gold" selected>Gold (Maks 4 Peserta)</option>
            <option value="custom_10">Admin Bebas (Maks 10 Peserta)</option>
            <option value="custom_25">Admin Bebas (Maks 25 Peserta)</option>
            <option value="admin">Akbar Nasional (Maks 100 Peserta)</option>
          `
        : `<option value="${defaultTier}" selected>${defaultTier.toUpperCase()} (Terkunci: Maks ${TIER_CAPACITY[defaultTier] || 2} Peserta)</option>`;

    Swal.fire({
        title: '🏛️ Buat Room CBT Arena',
        html: `
            <div style="text-align:left; font-size:0.82rem; color:#475569; margin-bottom:10px; background:#eff6ff; padding:8px 10px; border-radius:8px; border:1px solid #bfdbfe;">
                <i class="fas fa-user-check" style="color:#2563eb;"></i> Undangan teman via email dilakukan <b>di dalam Waiting Room</b> setelah room dibuat.
            </div>
            <div style="text-align:left; margin-bottom:10px;">
                <label style="font-weight:700; font-size:0.8rem; color:#1e293b;">Nama Room:</label>
                <input id="swalInputNamaRoom" class="swal2-input" style="width:100%; margin:4px 0 10px; font-size:0.85rem;" value="Arena SKD ASN #${Math.floor(100+Math.random()*900)}">
            </div>
            <div style="text-align:left; margin-bottom:10px;">
                <label style="font-weight:700; font-size:0.8rem; color:#1e293b;">Pilih Paket Soal Multiplayer:</label>
                <select id="swalSelectPaketRoom" class="swal2-select" style="width:100%; margin:4px 0 10px; font-size:0.85rem; padding:8px; border-radius:6px; border:1px solid #cbd5e1;">
                    ${buildArenaPaketOptionsHtml()}
                </select>
            </div>
            <div style="text-align:left; margin-bottom:6px;">
                <label style="font-weight:700; font-size:0.8rem; color:#1e293b;">Kapasitas Room ${prof.isAdmin ? '(Admin Bebas)' : '(Terkunci Sesuai Paket)'}:</label>
                <select id="swalSelectTierRoom" class="swal2-select" ${prof.isAdmin ? '' : 'disabled'} style="width:100%; margin:4px 0 6px; font-size:0.85rem; padding:8px; border-radius:6px; border:1px solid #cbd5e1; ${prof.isAdmin ? '' : 'background:#f1f5f9; color:#475569; cursor:not-allowed;'}">
                    ${tierOptionsHtml}
                </select>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '🚀 Buat Room Sekarang',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#1e3a8a',
        preConfirm: () => {
            const nama = document.getElementById('swalInputNamaRoom')?.value.trim() || 'Room CBT Arena';
            const tierSel = document.getElementById('swalSelectTierRoom')?.value || defaultTier;
            const paketEl = document.getElementById('swalSelectPaketRoom');
            const paketKey = paketEl?.value || 'full';
            const paketLabel = paketEl?.options?.[paketEl.selectedIndex]?.text || 'Simulasi SKD Lengkap';
            return { nama, tierSel, paketKey, paketLabel };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const { nama, tierSel, paketKey, paketLabel } = result.value;
            await eksekusiBikinRoom(nama, tierSel, paketKey, paketLabel);
        }
    });
};

async function eksekusiBikinRoom(namaRoom, tierSel, paketKey, paketLabel) {
    const kodeRoom = Math.floor(10000 + Math.random() * 90000).toString();
    const u = window.currentUser;
    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };

    let maxPlayers = TIER_CAPACITY[tierSel] || 2;
    let roomTier = tierSel;
    if (tierSel === 'custom_10') { maxPlayers = 10; roomTier = 'admin'; }
    else if (tierSel === 'custom_25') { maxPlayers = 25; roomTier = 'admin'; }

    if (!prof.isAdmin) {
        const userTier = String(prof.tier || 'bronze').toLowerCase();
        roomTier = userTier;
        maxPlayers = TIER_CAPACITY[userTier] || 2;
    }

    Swal.fire({ title: 'Menyiapkan Room Arena...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const roomRef = doc(db, COLLECTIONS.ROOMS, kodeRoom);
        await setDoc(roomRef, {
            nama: namaRoom,
            kode: kodeRoom,
            tier: roomTier,
            maxPlayers: maxPlayers,
            paketKey: paketKey || 'full',
            paketLabel: paketLabel || 'Simulasi SKD Lengkap',
            hostUid: u.uid,
            hostName: u.displayName || 'Host',
            hostEmail: (u.email || '').toLowerCase(),
            status: 'waiting',
            waktuPerSoal: 54,
            allowedGuestEmails: [],
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
        saveRoomToMyHistory(kodeRoom);
        window.activeRoomCode = kodeRoom;
        bukaWaitingRoom(kodeRoom);
    } catch (err) {
        console.error("Gagal buat room:", err);
        Swal.fire('Gagal Membuat Room', err.message, 'error');
    }
}

window.bukaModalGabungRoom = () => {
    if (!window.currentUser) {
        return Swal.fire({
            title: 'Login Diperlukan',
            text: 'Silakan login terlebih dahulu untuk bergabung ke room CBT Arena.',
            icon: 'info',
            confirmButtonText: 'Login Sekarang',
            confirmButtonColor: '#1e3a8a'
        }).then(res => {
            if (res.isConfirmed) window.eksekusiLoginGoogle();
        });
    }

    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    if (!isAllowedArenaUser(prof)) {
        return window.bukaModalUpgrade(
            'Gabung Room CBT Arena',
            'Akun Free terkunci dari fitur multiplayer. Upgrade ke Paket Bronze, Silver, atau Gold untuk bergabung.'
        );
    }

    Swal.fire({
        title: '🔑 Masuk Room CBT Arena',
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
            text: 'Silakan login terlebih dahulu untuk bergabung ke room CBT Arena.',
            icon: 'info',
            confirmButtonText: 'Login Sekarang',
            confirmButtonColor: '#1e3a8a'
        }).then(res => {
            if (res.isConfirmed) window.eksekusiLoginGoogle();
        });
    }

    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    if (!isAllowedArenaUser(prof)) {
        return window.bukaModalUpgrade(
            'Gabung Room CBT Arena',
            'Akun Free terkunci dan tidak dapat bergabung ke room multiplayer. Upgrade ke Bronze, Silver, atau Gold.'
        );
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
        const existingPlayers = dataRoom.players || {};
        const alreadyJoined = Boolean(existingPlayers[u.uid]);
        const roomTierKey = String(dataRoom.tier || 'bronze').toLowerCase();
        const maxPlayers = roomTierKey === 'admin'
            ? (dataRoom.maxPlayers || 100)
            : (TIER_CAPACITY[roomTierKey] || dataRoom.maxPlayers || 2);

        if (!alreadyJoined && dataRoom.status !== 'waiting') {
            return Swal.fire('Room Sudah Dimulai / Ditutup', 'Ujian di room ini sudah berjalan sehingga peserta baru tidak dapat masuk.', 'warning');
        }

        // Validasi Batas Kapasitas Room (Terkunci otomatis saat penuh untuk siapapun)
        if (!alreadyJoined && Object.keys(existingPlayers).length >= maxPlayers) {
            return Swal.fire('Room Penuh & Terkunci!', `Kapasitas maksimal paket ${roomTierKey.toUpperCase()} (${maxPlayers} peserta) sudah penuh.`, 'warning');
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
                    role: dataRoom.hostUid === u.uid ? 'HOST' : 'PESERTA',
                    email: myEmail,
                    lastSeen: Date.now()
                }
            });
        }

        Swal.close();
        saveRoomToMyHistory(kodeRoom);
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

window.kirimUndanganEmailRoom = async (kodeRoom) => {
    const inputEl = document.getElementById('waitingInviteEmailInput');
    const email = (inputEl?.value || '').trim().toLowerCase();
    if (!email || !email.includes('@') || !email.includes('.')) {
        return Swal.fire('Email Tidak Valid', 'Masukkan alamat email teman yang valid (contoh: teman@gmail.com).', 'warning');
    }

    const data = window.latestRoomData;
    const currentCount = Object.keys(data?.players || {}).length;
    const maxPlayers = data?.maxPlayers || 2;
    if (currentCount >= maxPlayers) {
        return Swal.fire('Room Penuh & Terkunci', `Kapasitas ${maxPlayers} peserta sudah terpenuhi.`, 'warning');
    }

    try {
        const roomRef = doc(db, COLLECTIONS.ROOMS, String(kodeRoom));
        await updateDoc(roomRef, {
            allowedGuestEmails: arrayUnion(email)
        });
        if (inputEl) inputEl.value = '';
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Undangan terkirim ke ${email}`,
            showConfirmButton: false,
            timer: 2500
        });
    } catch (err) {
        Swal.fire('Gagal Mengundang', err.message, 'error');
    }
};

function startInvitePopupListener(user) {
    if (!user || !user.email) return;
    const myEmail = user.email.toLowerCase().trim();
    if (window.invitePopupUnsubscribe) window.invitePopupUnsubscribe();
    if (!window.shownRoomInvites) window.shownRoomInvites = new Set();

    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    if (!isAllowedArenaUser(prof)) return;

    const qInv = query(
        collection(db, COLLECTIONS.ROOMS),
        where('allowedGuestEmails', 'array-contains', myEmail)
    );

    window.invitePopupUnsubscribe = onSnapshot(qInv, (snap) => {
        snap.docChanges().forEach((change) => {
            if (change.type !== 'added' && change.type !== 'modified') return;
            const room = change.doc.data();
            const kode = String(room.kode || change.doc.id);
            const players = room.players || {};
            const isFull = Object.keys(players).length >= (room.maxPlayers || 2);

            if (
                room.status === 'waiting' &&
                !players[user.uid] &&
                !isFull &&
                window.activeRoomCode !== kode &&
                !window.shownRoomInvites.has(kode)
            ) {
                window.shownRoomInvites.add(kode);
                Swal.fire({
                    title: '📩 Undangan CBT Arena!',
                    html: `
                        <div style="text-align:left; font-size:0.88rem; line-height:1.6;">
                            <b>${room.hostName || 'Temanmu'}</b> mengundang kamu bergabung ke room:<br/>
                            <div style="margin-top:8px; padding:10px 12px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px;">
                                <div><b>Room:</b> ${room.nama || kode}</div>
                                <div><b>Paket Soal:</b> ${room.paketLabel || 'Simulasi SKD'}</div>
                                <div><b>Kode:</b> ${kode} (${Object.keys(players).length}/${room.maxPlayers || 2} Peserta)</div>
                            </div>
                        </div>
                    `,
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonText: 'Gabung Sekarang',
                    cancelButtonText: 'Nanti',
                    confirmButtonColor: '#1e3a8a'
                }).then((res) => {
                    if (res.isConfirmed) {
                        window.gabungRoom(kode);
                    }
                });
            }
        });
    });
}

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
        if (typeof handleIncomingArenaChatMessages === 'function') {
            handleIncomingArenaChatMessages(data.chatMessages || []);
        }
        const players = data.players || {};
        const playerCount = Object.keys(players).length;
        const maxPlayers = data.maxPlayers || 2;
        const isFull = playerCount >= maxPlayers;
        const isHost = data.hostUid === window.currentUser?.uid;

        // Jika Host sudah klik MULAI ARENA, otomatis masuk ke ujian dengan paket soal yang dipilih
        if (data.status === 'ujian' && !hasStartedExamClient) {
            const myPlayer = players[window.currentUser?.uid];
            if (myPlayer && myPlayer.isFinished) {
                window.kembaliKeLobby();
                window.switchAppView('cbt');
                window.bukaModalKlasemenMabar();
                return;
            }
            hasStartedExamClient = true;
            window.currentAppMode = 'multiplayer';
            const paketInfo = getQuestionsForRoomPaket(data.paketKey || 'full');
            window.currentQuestions = paketInfo.questions;
            window.examTimeRemaining = 60;
            window._arenaQuestionTimedOut = false;
            window.currentPackageMeta = {
                saveId: `arena_${kodeRoom}`,
                tipe: 'arena',
                paketNo: null,
                title: `${data.nama} (${paketInfo.label})`,
                totalDurationSeconds: paketInfo.durationSec
            };
            startExamSessionUI();
            return;
        }

        if (data.status === 'finished' && hasStartedExamClient) {
            clearInterval(window._botAutoNextInterval);
            selesaikanUjian();
            return;
        }

        if (data.status === 'ujian' && hasStartedExamClient) {
            if (typeof data.currentQuestionIdx === 'number' && data.currentQuestionIdx > window.currentIdx) {
                clearInterval(window._botAutoNextInterval);
                window._botCountdownTargetIdx = null;
                if (data.currentQuestionIdx >= (window.currentQuestions || []).length) {
                    selesaikanUjian();
                    return;
                }
                window.currentIdx = data.currentQuestionIdx;
                window.examTimeRemaining = 60;
                window._arenaQuestionTimedOut = false;
                renderSoalSekarang();
                startExamTimer();
            }
            if (typeof window.renderInlineArenaKlasemen === 'function') window.renderInlineArenaKlasemen();
            if (typeof window.renderArenaChatFeed === 'function') window.renderArenaChatFeed();
            if (typeof window.evaluateMenujuAsnBotAutoNext === 'function') window.evaluateMenujuAsnBotAutoNext(data);
            return;
        }

        if (data.status !== 'waiting') return;

        document.getElementById('lobbySection').style.display = 'none';
        const heroEl = document.getElementById('heroBannerSection');
        if (heroEl) heroEl.style.display = 'none';

        const examStage = document.getElementById('examStage');
        examStage.style.display = 'block';

        let playerTilesHtml = Object.values(players).map(p => {
            const isHostBadge = (p.role === 'HOST' || p.uid === data.hostUid) ? `<span style="background:#fef3c7; color:#b45309; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:10px; border:1px solid #fde68a;">👑 HOST</span>` : `<span style="background:#eff6ff; color:#1d4ed8; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:10px; border:1px solid #bfdbfe;">PESERTA</span>`;
            return `
                <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:12px; display:flex; align-items:center; gap:10px; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
                    <img src="${p.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.nama)}" style="width:40px; height:40px; border-radius:50%; border:2px solid #2563eb;" />
                    <div style="text-align:left;">
                        <div style="font-weight:700; font-size:0.88rem; color:#1e293b;">${p.nama}</div>
                        <div style="display:flex; gap:6px; margin-top:2px;">${isHostBadge}</div>
                    </div>
                </div>
            `;
        }).join('');

        const invitedList = Array.isArray(data.allowedGuestEmails) ? data.allowedGuestEmails : [];
        const inviteBoxHtml = isHost ? (
            isFull
                ? `<div style="margin:0 auto 20px; max-width:520px; background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; padding:10px 14px; border-radius:10px; font-size:0.84rem; font-weight:700;">
                        <i class="fas fa-lock"></i> Room Penuh &amp; Terkunci (${playerCount}/${maxPlayers} Peserta). Tidak ada peserta lain yang bisa bergabung.
                   </div>`
                : `<div style="margin:0 auto 20px; max-width:540px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; text-align:left;">
                        <label style="display:block; font-size:0.82rem; font-weight:800; color:#0f172a; margin-bottom:8px;">
                            <i class="fas fa-paper-plane" style="color:#2563eb;"></i> Undang Teman via Email (Muncul Pop-up Otomatis saat Login)
                        </label>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            <input id="waitingInviteEmailInput" type="email" placeholder="teman@gmail.com" style="flex:1; min-width:200px; padding:9px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.85rem;" />
                            <button onclick="window.kirimUndanganEmailRoom('${kodeRoom}')" style="background:#059669; color:white; border:none; padding:9px 16px; border-radius:8px; font-weight:700; font-size:0.84rem; cursor:pointer;">
                                <i class="fas fa-user-plus"></i> Kirim Undangan
                            </button>
                        </div>
                        ${invitedList.length > 0 ? `<div style="margin-top:8px; font-size:0.76rem; color:#475569;">Diundang: <b>${invitedList.join(', ')}</b></div>` : ''}
                   </div>`
        ) : '';

        examStage.innerHTML = `
            <div style="background:white; border-radius:16px; padding:24px; border:1px solid #e2e8f0; box-shadow:0 8px 24px rgba(0,0,0,0.05); text-align:center;">
                <div style="display:inline-flex; align-items:center; gap:8px; background:${isFull ? '#fef2f2' : '#eff6ff'}; color:${isFull ? '#b91c1c' : '#1d4ed8'}; padding:6px 16px; border-radius:20px; font-weight:800; font-size:0.82rem; margin-bottom:10px;">
                    <i class="fas ${isFull ? 'fa-lock' : 'fa-satellite-dish fa-spin'}"></i> WAITING ROOM • PAKET ${(data.tier || 'bronze').toUpperCase()} (${playerCount}/${maxPlayers} PESERTA)
                </div>
                <h2 style="font-size:1.35rem; font-weight:800; color:#1e3a8a; margin-bottom:4px;">${data.nama}</h2>
                <div style="font-size:0.84rem; font-weight:700; color:#0f766e; margin-bottom:6px;"><i class="fas fa-book"></i> Paket Soal: ${data.paketLabel || 'Simulasi SKD Lengkap'}</div>
                <div style="font-size:2rem; font-weight:900; letter-spacing:4px; color:#d97706; margin:8px 0; font-family:monospace;">
                    ${kodeRoom}
                </div>
                ${isHost && !isFull ? `
                    <div style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
                        <button onclick="navigator.clipboard.writeText('${linkInvite}'); Swal.fire('Link Disalin!', 'Kirim link ini ke teman untuk bergabung ke CBT Arena.', 'success');" style="background:#2563eb; color:white; border:none; padding:8px 16px; border-radius:20px; font-weight:700; font-size:0.8rem; cursor:pointer;">
                            <i class="fas fa-link"></i> Salin Link Room
                        </button>
                    </div>
                ` : '<div style="margin-bottom:14px;"></div>'}

                ${inviteBoxHtml}
                
                <div style="text-align:left; font-weight:800; font-size:0.9rem; color:#1e293b; margin-bottom:12px; display:flex; justify-content:space-between;">
                    <span>Peserta Terhubung (${playerCount} / ${maxPlayers})</span>
                    <span style="color:#059669; font-size:0.8rem;"><i class="fas fa-shield-alt"></i> Mode Hemat Kuota Aktif</span>
                </div>
                
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:20px;">
                    ${playerTilesHtml}
                </div>

                <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
                    <button onclick="window.kembaliKeLobby()" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:10px 20px; border-radius:8px; font-weight:700; font-size:0.85rem; cursor:pointer;">
                        Keluar Room
                    </button>
                    ${isHost ? `
                        <button onclick="window.mulaiUjianMultiplayer('${kodeRoom}')" style="background:#d97706; color:white; border:none; padding:10px 24px; border-radius:8px; font-weight:800; font-size:0.95rem; cursor:pointer; box-shadow:0 4px 12px rgba(217, 119, 6, 0.3);">
                            <i class="fas fa-rocket"></i> MULAI ARENA
                        </button>
                    ` : `
                        <div style="padding:10px 20px; background:#fffbeb; color:#b45309; border-radius:8px; font-weight:700; font-size:0.85rem;">
                            <i class="fas fa-spinner fa-spin"></i> Menunggu Host Memulai Ujian...
                        </div>
                    `}
                </div>
            </div>
        `;
        if (typeof window.mountArenaFloatingChatDock === 'function') window.mountArenaFloatingChatDock();
        if (typeof window.renderArenaChatFeed === 'function') window.renderArenaChatFeed();
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
            currentQuestionIdx: 0,
            startedAt: Date.now()
        });
    } catch (err) {
        Swal.fire('Gagal Memulai', err.message, 'error');
    }
};

// Klasemen Live CBT Arena (Tie-Breaker Resmi BKN: Total -> TKP -> TIU -> TWK -> Waktu)
function sortArenaPlayersBkn(playersList) {
    return [...playersList].sort((a, b) => {
        if ((b.skor || 0) !== (a.skor || 0)) return (b.skor || 0) - (a.skor || 0);
        if ((b.skorTKP || 0) !== (a.skorTKP || 0)) return (b.skorTKP || 0) - (a.skorTKP || 0);
        if ((b.skorTIU || 0) !== (a.skorTIU || 0)) return (b.skorTIU || 0) - (a.skorTIU || 0);
        if ((b.skorTWK || 0) !== (a.skorTWK || 0)) return (b.skorTWK || 0) - (a.skorTWK || 0);
        return (a.totalWaktu || 999999) - (b.totalWaktu || 999999);
    });
}

window.bukaModalKlasemenMabar = () => {
    const data = window.latestRoomData || {};
    const players = sortArenaPlayersBkn(Object.values(data.players || {}));

    const rows = players.map((p, idx) => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px; border-bottom:1px solid #e2e8f0; background:${p.uid === window.currentUser?.uid ? '#eff6ff' : 'white'};">
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-weight:900; color:${idx === 0 ? '#d97706' : '#64748b'}; width:22px;">#${idx + 1}</span>
                <div style="text-align:left;">
                    <div style="font-weight:700; font-size:0.86rem; color:#1e293b;">${p.nama} ${p.isFinished ? '✅ Selesai' : `⏳ ${p.answeredCount || 0} soal`}</div>
                    <div style="font-size:0.72rem; color:#64748b;">TWK:${p.skorTWK || 0} | TIU:${p.skorTIU || 0} | TKP:${p.skorTKP || 0} • ${p.totalWaktu || 0}d</div>
                </div>
            </div>
            <div style="font-weight:800; font-size:1rem; color:#1e3a8a;">${p.skor || 0}</div>
        </div>
    `).join('');

    Swal.fire({
        title: '🏆 Klasemen Live CBT Arena',
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

function buildArenaPodiumHtml() {
    const data = window.latestRoomData || {};
    const myUid = window.currentUser?.uid;
    const rawPlayers = Object.values(data.players || {});
    const stats = hitungSkorSekarang();
    const myEntry = {
        uid: myUid || 'me',
        nama: window.currentUser?.displayName || 'Kamu',
        photoURL: window.currentUser?.photoURL || null,
        skor: stats.totalSkor,
        skorTWK: stats.skorTWK,
        skorTIU: stats.skorTIU,
        skorTKP: stats.skorTKP,
        totalWaktu: stats.totalWaktu,
        isFinished: true
    };
    const mergedMap = {};
    rawPlayers.forEach(p => { if (p && p.uid) mergedMap[p.uid] = p; });
    if (myUid) mergedMap[myUid] = { ...(mergedMap[myUid] || {}), ...myEntry };
    else mergedMap['me'] = myEntry;

    const sorted = sortArenaPlayersBkn(Object.values(mergedMap));
    const p1 = sorted[0];
    const p2 = sorted[1];
    const p3 = sorted[2];

    const slot = (p, rank, heightPx, bg, border, medal) => {
        if (!p) return '';
        return `
            <div style="flex:1; min-width:110px; max-width:185px; display:flex; flex-direction:column; align-items:center;">
                <div style="font-size:1.5rem; margin-bottom:4px;">${medal}</div>
                <div style="font-weight:800; font-size:0.84rem; color:#0f172a; text-align:center; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px;">${p.nama || 'Peserta'}</div>
                <div style="font-size:0.75rem; font-weight:700; color:#1e3a8a; margin-bottom:6px;">${p.skor || 0} poin</div>
                <div style="width:100%; height:${heightPx}px; background:${bg}; border:2px solid ${border}; border-radius:12px 12px 0 0; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:1.25rem; color:#0f172a;">
                    #${rank}
                </div>
            </div>
        `;
    };

    const fullRows = sorted.map((p, idx) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-bottom:1px solid #f1f5f9; font-size:0.82rem; background:${p.uid === myUid ? '#eff6ff' : '#fff'};">
            <div>
                <strong style="color:${idx === 0 ? '#d97706' : '#475569'}; margin-right:6px;">#${idx + 1}</strong>
                <span style="font-weight:700; color:#0f172a;">${p.nama}</span>
                <span style="font-size:0.72rem; color:#64748b; margin-left:6px;">(TWK:${p.skorTWK || 0} | TIU:${p.skorTIU || 0} | TKP:${p.skorTKP || 0} • ${p.totalWaktu || 0}d)</span>
            </div>
            <strong style="color:#1e3a8a;">${p.skor || 0} poin</strong>
        </div>
    `).join('');

    return `
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:18px; margin-bottom:18px; box-shadow:0 4px 16px rgba(15,23,42,0.04);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
                <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:#1e3a8a;"><i class="fas fa-trophy" style="color:#d97706;"></i> Podium Juara CBT Arena</h3>
                <span style="font-size:0.75rem; font-weight:700; color:#64748b;">Tie-Breaker Resmi BKN (Skor ➔ TKP ➔ TIU ➔ TWK ➔ Waktu)</span>
            </div>
            <div style="display:flex; align-items:flex-end; justify-content:center; gap:10px; padding:8px 4px 0; border-bottom:3px solid #e2e8f0; margin-bottom:12px;">
                ${slot(p2, 2, 68, '#f1f5f9', '#94a3b8', '🥈')}
                ${slot(p1, 1, 92, '#fef3c7', '#f59e0b', '🥇')}
                ${slot(p3, 3, 52, '#ffedd5', '#ea580c', '🥉')}
            </div>
            <div style="border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">${fullRows}</div>
        </div>
    `;
}

window.renderInlineArenaKlasemen = () => {
    const el = document.getElementById('arenaLiveKlasemenSidebar');
    if (!el || window.currentAppMode !== 'multiplayer') return;

    const data = window.latestRoomData || {};
    const myUid = window.currentUser?.uid;
    const stats = hitungSkorSekarang();
    const answeredCount = Object.keys(window.userAnswers || {}).length;
    const curQ = (window.currentQuestions || [])[window.currentIdx];
    const iAnsweredThisQ = Boolean(curQ && window.userAnswers?.[curQ.id]);

    const mergedMap = {};
    Object.values(data.players || {}).forEach(p => { if (p && p.uid) mergedMap[p.uid] = p; });
    if (myUid) {
        mergedMap[myUid] = {
            ...(mergedMap[myUid] || {}),
            uid: myUid,
            nama: window.currentUser?.displayName || 'Kamu',
            skor: stats.totalSkor,
            skorTWK: stats.skorTWK,
            skorTIU: stats.skorTIU,
            skorTKP: stats.skorTKP,
            answeredCount,
            lastAnsweredIdx: iAnsweredThisQ ? Math.max(Number(mergedMap[myUid]?.lastAnsweredIdx ?? -1), window.currentIdx) : (mergedMap[myUid]?.lastAnsweredIdx ?? -1),
            totalWaktu: stats.totalWaktu
        };
    }

    const allPlayers = Object.values(mergedMap);
    const answeredThisQCount = allPlayers.filter(p => Number(p.lastAnsweredIdx ?? -1) >= window.currentIdx).length;
    const totalP = Math.max(1, allPlayers.length);

    const players = sortArenaPlayersBkn(allPlayers);
    const rows = players.map((p, idx) => {
        const doneThisQ = Number(p.lastAnsweredIdx ?? -1) >= window.currentIdx;
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-radius:8px; font-size:0.78rem; margin-bottom:6px; background:${p.uid === myUid ? '#eff6ff' : '#f8fafc'}; border:1px solid ${p.uid === myUid ? '#bfdbfe' : '#e2e8f0'};">
                <div style="min-width:0; flex:1;">
                    <div style="font-weight:800; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        #${idx + 1} ${p.nama || 'Peserta'} ${doneThisQ ? '<span title="Sudah menjawab soal ini">✅</span>' : '<span title="Sedang menjawab">⏳</span>'}
                    </div>
                    <div style="font-size:0.7rem; color:#64748b;">TKP:${p.skorTKP || 0} • TIU:${p.skorTIU || 0} • TWK:${p.skorTWK || 0}</div>
                </div>
                <strong style="color:#1d4ed8; font-size:0.9rem; margin-left:6px;">${p.skor || 0}</strong>
            </div>
        `;
    }).join('');

    el.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:7px 10px; margin-bottom:12px;">
            <span style="font-size:0.76rem; font-weight:800; color:#334155;"><i class="fas fa-user-check" style="color:#16a34a;"></i> Menjawab Soal Ini</span>
            <span style="font-size:0.76rem; font-weight:800; background:${answeredThisQCount >= totalP ? '#dcfce7' : '#eff6ff'}; color:${answeredThisQCount >= totalP ? '#15803d' : '#1d4ed8'}; padding:2px 9px; border-radius:999px;">
                ${answeredThisQCount}/${totalP} Peserta
            </span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:0.86rem; color:#1e3a8a;"><i class="fas fa-trophy" style="color:#d97706;"></i> Klasemen Sementara</strong>
            <span style="font-size:0.68rem; font-weight:800; background:#dcfce7; color:#15803d; padding:2px 7px; border-radius:999px;">LIVE</span>
        </div>
        ${rows || '<div style="font-size:0.76rem; color:#64748b;">Menunggu skor...</div>'}
    `;
};

window.hostBypassNextSoal = async () => {
    if (!window.activeRoomCode || !window.currentUser) return;
    const data = window.latestRoomData || {};
    if (data.hostUid !== window.currentUser.uid) return;

    clearInterval(window._botAutoNextInterval);
    window._botCountdownTargetIdx = null;

    const nextIdx = window.currentIdx + 1;
    const isLast = nextIdx >= (window.currentQuestions || []).length;
    try {
        await updateDoc(doc(db, COLLECTIONS.ROOMS, String(window.activeRoomCode)), isLast
            ? { status: 'finished', currentQuestionIdx: nextIdx }
            : { currentQuestionIdx: nextIdx }
        );
    } catch (e) {
        console.warn('Gagal bypass next soal:', e);
    }
};

window.evaluateMenujuAsnBotAutoNext = (roomData) => {
    const bannerEl = document.getElementById('arenaBotNextBanner');
    if (!bannerEl || window.currentAppMode !== 'multiplayer') return;

    const curQ = (window.currentQuestions || [])[window.currentIdx];
    const iAnswered = Boolean(curQ && window.userAnswers?.[curQ.id]);
    if (!iAnswered && !window._arenaQuestionTimedOut) {
        bannerEl.style.display = 'none';
        bannerEl.innerHTML = '';
        return;
    }

    const data = roomData || window.latestRoomData || {};
    const myUid = window.currentUser?.uid;
    const isHost = data.hostUid === myUid;
    const playersObj = { ...(data.players || {}) };
    if (myUid && iAnswered) {
        playersObj[myUid] = {
            ...(playersObj[myUid] || {}),
            lastAnsweredIdx: Math.max(Number(playersObj[myUid]?.lastAnsweredIdx ?? -1), window.currentIdx)
        };
    }

    const allPlayers = Object.values(playersObj);
    const totalP = Math.max(1, allPlayers.length);
    const answeredCount = allPlayers.filter(p => Number(p.lastAnsweredIdx ?? -1) >= window.currentIdx).length;
    const allReady = answeredCount >= totalP || Boolean(window._arenaQuestionTimedOut);
    const isLastQ = window.currentIdx >= (window.currentQuestions || []).length - 1;
    const nextLabel = isLastQ ? 'Podium & Hasil Akhir' : `Soal #${window.currentIdx + 2}`;

    const bypassBtn = isHost
        ? `<button type="button" onclick="window.hostBypassNextSoal()" style="background:#d97706; color:#fff; border:none; padding:5px 11px; border-radius:7px; font-size:0.74rem; font-weight:800; cursor:pointer; white-space:nowrap;">⚡ Bypass Next (Host)</button>`
        : '';

    bannerEl.style.display = 'block';

    if (!allReady) {
        clearInterval(window._botAutoNextInterval);
        window._botCountdownTargetIdx = null;
        bannerEl.innerHTML = `
            <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:10px 13px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                <div style="font-size:0.8rem; color:#92400e; line-height:1.45;">
                    <strong>🤖 MenujuASN-Bot:</strong> Menunggu peserta lain menjawab (<b>${answeredCount}/${totalP}</b>).<br/>
                    <span>Silakan baca &amp; pahami pembahasan di bawah sementara menunggu next soal.</span>
                </div>
                ${bypassBtn}
            </div>
        `;
        return;
    }

    // Semua peserta sudah menjawab (atau waktu 60 detik habis) -> hentikan timer soal & jalankan hitung mundur 5 detik
    clearInterval(window.examTimerInterval);
    const timerEl = document.getElementById('examTimerDisplay');
    if (timerEl && !timerEl.innerHTML.includes('fa-pause-circle')) {
        const rem = Math.max(0, Number(window.examTimeRemaining || 0));
        const m = Math.floor(rem / 60);
        const s = rem % 60;
        timerEl.innerHTML = `<i class="fas fa-pause-circle" style="color:#4ade80;"></i> ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    if (window._botCountdownTargetIdx !== window.currentIdx) {
        clearInterval(window._botAutoNextInterval);
        window._botCountdownTargetIdx = window.currentIdx;
        let sec = 5;

        const renderCountdown = () => {
            bannerEl.innerHTML = `
                <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:10px 13px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                    <div style="font-size:0.8rem; color:#1e40af; line-height:1.45;">
                        <strong>🤖 MenujuASN-Bot:</strong> Menuju <b>${nextLabel}</b> otomatis dalam <b style="font-size:0.95rem; color:#d97706;">${sec} detik</b>.<br/>
                        <span>Silakan baca &amp; pahami pembahasan di bawah ini.</span>
                    </div>
                    ${bypassBtn}
                </div>
            `;
        };
        renderCountdown();

        window._botAutoNextInterval = setInterval(async () => {
            sec--;
            if (sec > 0) {
                renderCountdown();
            } else {
                clearInterval(window._botAutoNextInterval);
                window._botCountdownTargetIdx = null;
                if (isHost) {
                    await window.hostBypassNextSoal();
                } else {
                    // Fallback jika Host terputus, peserta sinkron otomatis
                    const nextIdx = window.currentIdx + 1;
                    try {
                        await updateDoc(doc(db, COLLECTIONS.ROOMS, String(window.activeRoomCode)), isLastQ
                            ? { status: 'finished', currentQuestionIdx: nextIdx }
                            : { currentQuestionIdx: nextIdx }
                        );
                    } catch (_) {}
                }
            }
        }, 1000);
    }
};

function buildArenaChatWidgetHtml(ctx = 'floating') {
    const stickers = [
        { icon: '👏', label: 'Mantap!' },
        { icon: '🔥', label: 'Gaspol!' },
        { icon: '😎', label: 'Santai' },
        { icon: '🤯', label: 'Susah!' },
        { icon: '💪', label: 'Semangat!' },
        { icon: '🎉', label: 'Juara!' }
    ];
    const stickerBtns = stickers.map(s => `
        <button type="button" onclick="window.kirimArenaStiker('${s.icon} ${s.label}')" style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:999px; padding:3px 7px; font-size:0.72rem; font-weight:700; cursor:pointer;">
            ${s.icon} ${ctx === 'waiting' ? s.label : ''}
        </button>
    `).join('');

    const feedId = `arenaChatFeed_${ctx}`;
    const inputId = `arenaChatInput_${ctx}`;
    return `
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:10px; display:flex; flex-direction:column; height:100%; box-sizing:border-box;">
            ${ctx === 'waiting' ? `
                <div style="font-size:0.8rem; font-weight:800; color:#0f172a; margin-bottom:6px;">
                    <i class="fas fa-comments" style="color:#2563eb;"></i> Live Chat &amp; Stiker (Zoom Mode)
                </div>
            ` : ''}
            <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:7px;">${stickerBtns}</div>
            <div id="${feedId}" class="arena-chat-feed-list" style="flex:1; min-height:${ctx === 'waiting' ? '100px' : '190px'}; max-height:${ctx === 'waiting' ? '130px' : '240px'}; overflow-y:auto; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:7px 9px; margin-bottom:7px; font-size:0.75rem; color:#334155;">
                <span style="color:#94a3b8;">Belum ada pesan atau stiker.</span>
            </div>
            <div style="display:flex; gap:6px;">
                <input id="${inputId}" type="text" maxlength="120" placeholder="Tulis chat..." onkeydown="if(event.key==='Enter'){window.kirimArenaChat('${inputId}');}" style="flex:1; min-width:0; padding:6px 9px; border:1px solid #cbd5e1; border-radius:7px; font-size:0.76rem;" />
                <button type="button" onclick="window.kirimArenaChat('${inputId}')" style="background:#2563eb; color:#fff; border:none; padding:6px 10px; border-radius:7px; font-size:0.75rem; font-weight:700; cursor:pointer;">
                    Kirim
                </button>
            </div>
        </div>
    `;
}

window.toggleArenaFloatingChat = (forceOpen) => {
    const btn = document.getElementById('arenaFloatingChatToggleBtn');
    const panel = document.getElementById('arenaFloatingChatPanel');
    if (!btn || !panel) return;
    const willOpen = typeof forceOpen === 'boolean' ? forceOpen : (panel.style.display === 'none');
    panel.style.display = willOpen ? 'flex' : 'none';
    btn.style.display = willOpen ? 'none' : 'flex';
    if (willOpen) {
        const badge = document.getElementById('arenaChatUnreadBadge');
        if (badge) { badge.style.display = 'none'; badge.textContent = '0'; }
        window.renderArenaChatFeed();
    }
};

window.mountArenaFloatingChatDock = () => {
    if (window.currentAppMode !== 'multiplayer' && !window.activeRoomCode) {
        document.getElementById('arenaFloatingChatDock')?.remove();
        return;
    }
    if (document.getElementById('arenaFloatingChatDock')) {
        if (typeof window.renderArenaChatFeed === 'function') window.renderArenaChatFeed();
        return;
    }

    const dock = document.createElement('div');
    dock.id = 'arenaFloatingChatDock';
    dock.style.cssText = 'position:fixed; left:16px; bottom:20px; z-index:9990;';
    dock.innerHTML = `
        <button id="arenaFloatingChatToggleBtn" type="button" onclick="window.toggleArenaFloatingChat(true)" style="display:flex; align-items:center; gap:7px; background:#1e3a8a; color:#fff; border:none; padding:10px 14px; border-radius:999px; font-size:0.82rem; font-weight:800; cursor:pointer; box-shadow:0 8px 22px rgba(30,58,138,0.35);">
            <i class="fas fa-comments"></i> Chat
            <span id="arenaChatUnreadBadge" style="display:none; background:#ef4444; color:#fff; font-size:0.68rem; padding:1px 6px; border-radius:999px;">0</span>
        </button>
        <div id="arenaFloatingChatPanel" style="display:none; width:275px; height:380px; flex-direction:column; background:#fff; border:1px solid #cbd5e1; border-radius:14px; box-shadow:0 14px 36px rgba(15,23,42,0.22); overflow:hidden;">
            <div id="arenaFloatingChatDragHandle" style="background:#1e3a8a; color:#fff; padding:9px 12px; display:flex; justify-content:space-between; align-items:center; cursor:grab; user-select:none;">
                <span style="font-size:0.8rem; font-weight:800;"><i class="fas fa-arrows-alt"></i> Live Chat &amp; Stiker</span>
                <button type="button" onclick="window.toggleArenaFloatingChat(false)" title="Tutup / Minimize" style="background:rgba(255,255,255,0.2); color:#fff; border:none; width:24px; height:24px; border-radius:6px; font-weight:800; cursor:pointer;">✕</button>
            </div>
            <div style="flex:1; padding:8px; overflow:hidden;">
                ${buildArenaChatWidgetHtml('floating')}
            </div>
        </div>
    `;
    document.body.appendChild(dock);

    // Drag support (mouse & touch)
    const handle = document.getElementById('arenaFloatingChatDragHandle');
    if (handle) {
        let dragging = false, startX = 0, startY = 0, origLeft = 16, origBottom = 20;
        const onStart = (cx, cy) => {
            dragging = true;
            startX = cx;
            startY = cy;
            const rect = dock.getBoundingClientRect();
            origLeft = rect.left;
            origBottom = window.innerHeight - rect.bottom;
            handle.style.cursor = 'grabbing';
        };
        const onMove = (cx, cy) => {
            if (!dragging) return;
            const dx = cx - startX;
            const dy = cy - startY;
            dock.style.left = `${Math.max(8, Math.min(window.innerWidth - 285, origLeft + dx))}px`;
            dock.style.bottom = `${Math.max(8, Math.min(window.innerHeight - 390, origBottom - dy))}px`;
        };
        const onEnd = () => {
            dragging = false;
            handle.style.cursor = 'grab';
        };
        handle.addEventListener('mousedown', (e) => { if (e.target.tagName !== 'BUTTON') onStart(e.clientX, e.clientY); });
        window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', onEnd);
        handle.addEventListener('touchstart', (e) => { if (e.target.tagName !== 'BUTTON' && e.touches[0]) onStart(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
        window.addEventListener('touchmove', (e) => { if (dragging && e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
        window.addEventListener('touchend', onEnd);
    }
};

window.renderArenaChatFeed = () => {
    const msgs = Array.isArray(window.latestRoomData?.chatMessages) ? window.latestRoomData.chatMessages : [];
    const latest = msgs.slice(-20);
    const html = latest.length
        ? latest.map(m => `
            <div style="margin-bottom:5px; line-height:1.35;">
                <strong style="color:#1e3a8a;">${escapeHtmlMentor(m.nama || 'Peserta')}:</strong>
                <span>${escapeHtmlMentor(m.text || '')}</span>
            </div>
        `).join('')
        : '<span style="color:#94a3b8;">Belum ada pesan atau stiker.</span>';

    document.querySelectorAll('.arena-chat-feed-list').forEach(box => {
        box.innerHTML = html;
        box.scrollTop = box.scrollHeight;
    });
};

function showArenaFloatingReactionToast(senderName, text) {
    let container = document.getElementById('arenaFloatingReactionBox');
    if (!container) {
        container = document.createElement('div');
        container.id = 'arenaFloatingReactionBox';
        container.style.cssText = 'position:fixed; bottom:74px; left:16px; z-index:9999; display:flex; flex-direction:column; gap:6px; pointer-events:none;';
        document.body.appendChild(container);
    }
    const pill = document.createElement('div');
    pill.style.cssText = 'background:rgba(15,23,42,0.9); color:#fff; padding:8px 14px; border-radius:999px; font-size:0.84rem; font-weight:700; box-shadow:0 8px 20px rgba(0,0,0,0.2); transition:opacity 0.3s;';
    pill.textContent = `${senderName}: ${text}`;
    container.appendChild(pill);
    setTimeout(() => { pill.style.opacity = '0'; }, 2600);
    setTimeout(() => { pill.remove(); }, 3000);
}

function handleIncomingArenaChatMessages(msgs) {
    if (!Array.isArray(msgs) || msgs.length === 0) return;
    if (!window._seenArenaChatIds) window._seenArenaChatIds = new Set(msgs.map(m => m.id));
    msgs.forEach(m => {
        if (m && m.id && !window._seenArenaChatIds.has(m.id)) {
            window._seenArenaChatIds.add(m.id);
            showArenaFloatingReactionToast(m.nama || 'Peserta', m.text || '');
            const panel = document.getElementById('arenaFloatingChatPanel');
            const badge = document.getElementById('arenaChatUnreadBadge');
            if (panel && panel.style.display === 'none' && badge) {
                badge.textContent = String((Number(badge.textContent) || 0) + 1);
                badge.style.display = 'inline-block';
            }
        }
    });
}

async function sendArenaChatPayload(text, type = 'text') {
    if (!window.activeRoomCode || !window.currentUser) return;
    const clean = String(text || '').trim().slice(0, 120);
    if (!clean) return;
    const msgObj = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        uid: window.currentUser.uid,
        nama: window.currentUser.displayName || 'Peserta',
        type,
        text: clean,
        createdAt: Date.now()
    };
    try {
        await updateDoc(doc(db, COLLECTIONS.ROOMS, String(window.activeRoomCode)), {
            chatMessages: arrayUnion(msgObj)
        });
    } catch (e) {
        console.warn('Gagal kirim chat Arena:', e);
    }
}

window.kirimArenaStiker = (stickerText) => {
    sendArenaChatPayload(stickerText, 'sticker');
};

window.kirimArenaChat = (inputId) => {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    const val = inp.value.trim();
    if (!val) return;
    inp.value = '';
    sendArenaChatPayload(val, 'text');
};

function getMyRoomsStorageKey() {
    const uid = window.currentUser?.uid || 'guest';
    return `menuju_asn_my_rooms_v1_${uid}`;
}

function saveRoomToMyHistory(kodeRoom) {
    if (!kodeRoom || !window.currentUser) return;
    try {
        const key = getMyRoomsStorageKey();
        const cur = JSON.parse(localStorage.getItem(key) || '[]');
        const next = [String(kodeRoom), ...cur.filter(k => k !== String(kodeRoom))].slice(0, 20);
        localStorage.setItem(key, JSON.stringify(next));
    } catch (_) {}
}

window.hapusRoomArena = async (kodeRoom) => {
    const res = await Swal.fire({
        title: 'Hapus Room Arena?',
        text: `Room #${kodeRoom} akan dihapus permanen dan peserta tidak bisa masuk lagi.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus Room',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#b91c1c'
    });
    if (!res.isConfirmed) return;

    try {
        await deleteDoc(doc(db, COLLECTIONS.ROOMS, String(kodeRoom)));
        const key = getMyRoomsStorageKey();
        const cur = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify(cur.filter(k => k !== String(kodeRoom))));
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Room #${kodeRoom} dihapus`, showConfirmButton: false, timer: 2000 });
        window.renderArenaSavedRooms();
    } catch (err) {
        Swal.fire('Gagal Menghapus', err.message, 'error');
    }
};

window.renderArenaSavedRooms = async () => {
    const el = document.getElementById('arenaMyRoomsArea');
    if (!el) return;
    if (!window.currentUser) {
        el.innerHTML = '';
        return;
    }

    const uid = window.currentUser.uid;
    const savedCodes = new Set(JSON.parse(localStorage.getItem(getMyRoomsStorageKey()) || '[]'));

    try {
        const hostSnap = await getDocs(query(collection(db, COLLECTIONS.ROOMS), where('hostUid', '==', uid), limit(15)));
        hostSnap.forEach(d => savedCodes.add(String(d.id)));
    } catch (_) {}

    const rooms = [];
    const stillValidCodes = [];
    for (const kode of Array.from(savedCodes)) {
        try {
            const snap = await getDoc(doc(db, COLLECTIONS.ROOMS, String(kode)));
            if (snap.exists()) {
                const d = snap.data();
                if (d.hostUid === uid || (d.players && d.players[uid])) {
                    rooms.push({ kode: String(kode), ...d });
                    stillValidCodes.push(String(kode));
                }
            }
        } catch (_) {}
    }
    try { localStorage.setItem(getMyRoomsStorageKey(), JSON.stringify(stillValidCodes)); } catch (_) {}

    if (rooms.length === 0) {
        el.innerHTML = '';
        return;
    }

    rooms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const cardsHtml = rooms.map(r => {
        const players = r.players || {};
        const pCount = Object.keys(players).length;
        const maxP = r.maxPlayers || 2;
        const isHost = r.hostUid === uid;
        const isFull = pCount >= maxP;
        const statusBadge = r.status === 'ujian'
            ? '<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:999px; font-size:0.72rem; font-weight:800;">Ujian Berlangsung</span>'
            : (isFull
                ? '<span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:999px; font-size:0.72rem; font-weight:800;">🔒 Penuh &amp; Terkunci</span>'
                : '<span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:999px; font-size:0.72rem; font-weight:800;">Waiting Room</span>');

        return `
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
                <div>
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                        <strong style="color:#0f172a; font-size:0.94rem;">${r.nama || 'Room Arena'}</strong>
                        <span style="font-family:monospace; font-weight:800; color:#d97706; background:#fffbeb; padding:2px 8px; border-radius:6px; font-size:0.8rem;">#${r.kode}</span>
                        ${statusBadge}
                    </div>
                    <div style="font-size:0.78rem; color:#64748b;">
                        Paket: <b>${r.paketLabel || 'Simulasi SKD'}</b> • Peserta: <b>${pCount}/${maxP}</b> (${String(r.tier || 'bronze').toUpperCase()})
                    </div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button onclick="window.gabungRoom('${r.kode}')" style="background:#1e3a8a; color:#fff; border:none; padding:8px 14px; border-radius:8px; font-size:0.8rem; font-weight:700; cursor:pointer;">
                        <i class="fas fa-sign-in-alt"></i> Masuk Room
                    </button>
                    ${isHost ? `
                        <button onclick="window.hapusRoomArena('${r.kode}')" style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; padding:8px 12px; border-radius:8px; font-size:0.8rem; font-weight:700; cursor:pointer;">
                            <i class="fas fa-trash"></i> Hapus
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    el.innerHTML = `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:16px;">
            <h4 style="margin:0 0 10px; font-size:0.95rem; font-weight:800; color:#1e3a8a;">
                <i class="fas fa-door-open"></i> Room Arena Tersimpan (Aktif)
            </h4>
            <div style="display:flex; flex-direction:column; gap:10px;">${cardsHtml}</div>
        </div>
    `;
};

function getArenaHistoryStorageKey() {
    const uid = window.currentUser?.uid || 'guest';
    return `menuju_asn_arena_history_v1_${uid}`;
}

window.saveArenaResultToHistory = async () => {
    if (!window.activeRoomCode || !window.currentUser) return;
    try {
        const kode = String(window.activeRoomCode);
        const snap = await getDoc(doc(db, COLLECTIONS.ROOMS, kode));
        if (!snap.exists()) return;
        const room = snap.data();
        window.latestRoomData = room;
        const sorted = sortArenaPlayersBkn(Object.values(room.players || {}));
        const myRank = sorted.findIndex(p => p.uid === window.currentUser.uid) + 1;

        const entry = {
            kode,
            nama: room.nama || `Room #${kode}`,
            paketLabel: room.paketLabel || 'Simulasi SKD',
            finishedAt: Date.now(),
            myRank: myRank || 1,
            totalPlayers: sorted.length,
            players: sorted.map(p => ({
                uid: p.uid,
                nama: p.nama,
                skor: p.skor || 0,
                skorTWK: p.skorTWK || 0,
                skorTIU: p.skorTIU || 0,
                skorTKP: p.skorTKP || 0,
                totalWaktu: p.totalWaktu || 0,
                isFinished: Boolean(p.isFinished)
            }))
        };

        const key = getArenaHistoryStorageKey();
        const cur = JSON.parse(localStorage.getItem(key) || '[]');
        const next = [entry, ...cur.filter(x => x.kode !== kode)].slice(0, 15);
        localStorage.setItem(key, JSON.stringify(next));
        window.renderArenaLeaderboardHistory();
    } catch (e) {
        console.warn('Gagal menyimpan riwayat klasemen Arena:', e);
    }
};

window.renderArenaLeaderboardHistory = () => {
    const el = document.getElementById('arenaLeaderboardArea');
    if (!el) return;
    if (!window.currentUser) {
        el.innerHTML = '';
        return;
    }

    const list = JSON.parse(localStorage.getItem(getArenaHistoryStorageKey()) || '[]');
    if (!list.length) {
        el.innerHTML = '';
        return;
    }

    const itemsHtml = list.map(item => {
        const rows = (item.players || []).map((p, idx) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-bottom:1px solid #f1f5f9; font-size:0.8rem; background:${p.uid === window.currentUser?.uid ? '#eff6ff' : '#fff'};">
                <div>
                    <strong style="color:${idx === 0 ? '#d97706' : '#475569'}; margin-right:6px;">#${idx + 1}</strong>
                    <span style="font-weight:700; color:#0f172a;">${p.nama}</span>
                    <span style="color:#64748b; font-size:0.72rem; margin-left:6px;">(TWK:${p.skorTWK} | TIU:${p.skorTIU} | TKP:${p.skorTKP})</span>
                </div>
                <strong style="color:#1e3a8a;">${p.skor}</strong>
            </div>
        `).join('');

        return `
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                    <div>
                        <strong style="color:#0f172a; font-size:0.92rem;">${item.nama}</strong>
                        <span style="font-size:0.75rem; color:#64748b; margin-left:6px;">• ${item.paketLabel}</span>
                    </div>
                    <span style="background:#fef3c7; color:#b45309; padding:3px 10px; border-radius:999px; font-size:0.74rem; font-weight:800;">
                        🏆 Peringkat #${item.myRank} dari ${item.totalPlayers}
                    </span>
                </div>
                <div style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">${rows}</div>
            </div>
        `;
    }).join('');

    el.innerHTML = `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                <h4 style="margin:0; font-size:0.95rem; font-weight:800; color:#1e3a8a;">
                    <i class="fas fa-trophy" style="color:#d97706;"></i> Riwayat Peringkat &amp; Klasemen CBT Arena
                </h4>
                <button onclick="window.switchAppView('brankas')" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:5px 11px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">
                    <i class="fas fa-vault"></i> Lihat Pembahasan di Brankas
                </button>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">${itemsHtml}</div>
        </div>
    `;
};

// ==========================================================
// 11. PEMBAHASAN MENTOR INTERAKTIF (TANPA VIDEO) & LAPOR SOAL
// ==========================================================
function escapeHtmlMentor(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatMentorTextHtml(str) {
    return escapeHtmlMentor(str)
        .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(,;:])'([^'\n]{1,60})'(?=[\s.,;:!?)]|$)/g, '$1<strong>$2</strong>')
        .replace(/(^|[\s(:;])"([^"\n]{1,120})"(?=[\s.,;:!?)]|$)/g, '$1<strong>$2</strong>');
}

function formatMentorTextWithSvg(str) {
    const raw = String(str || '');
    const parts = raw.split(/(<svg[\s\S]*?<\/svg>)/gi);
    return parts.map(part => {
        if (/^<svg[\s\S]*<\/svg>$/i.test(part) && !/<script/i.test(part) && !/\son\w+\s*=/i.test(part)) {
            return `<span style="display:inline-flex; vertical-align:middle; margin:2px 4px;">${part}</span>`;
        }
        return formatMentorTextHtml(part);
    }).join('');
}

function buildNumerikDasarHtml(q) {
    const text = `${q?.soal || ''} ${q?.pembahasan || ''}`;
    const tips = [];
    let showSpecialFractions = false;
    let showSquaresTable = false;

    const pctMatches = [...new Set((text.match(/\b\d+(?:[.,]\d+)?%/g) || []).slice(0, 3))];
    if (pctMatches.length) showSpecialFractions = true;
    pctMatches.forEach(pctStr => {
        const num = parseFloat(pctStr.replace('%', '').replace(',', '.'));
        if (Number.isNaN(num)) return;
        const dec = Number((num / 100).toFixed(4)).toString().replace('.', ',');
        if (num === 12.5) {
            tips.push(`<b>${pctStr}</b> artinya <code>12,5/100</code> = <code>125/1000</code> (bagi 125 atas-bawah) = <b>1/8</b>`);
        } else if (num === 25) {
            tips.push(`<b>25%</b> = <code>25/100</code> (bagi 25) = <b>1/4</b> atau <b>0,25</b>`);
        } else if (num === 50) {
            tips.push(`<b>50%</b> = <code>50/100</code> = <b>1/2</b> (setengahnya)`);
        } else if (num === 75) {
            tips.push(`<b>75%</b> = <code>75/100</code> (bagi 25) = <b>3/4</b>`);
        } else if (num === 37.5) {
            tips.push(`<b>37,5%</b> = <code>375/1000</code> = <b>3/8</b>`);
        } else if (num === 62.5) {
            tips.push(`<b>62,5%</b> = <code>625/1000</code> = <b>5/8</b>`);
        } else {
            tips.push(`<b>${pctStr}</b> artinya perseratus = <code>${pctStr.replace('%', '')}/100</code> = <b>${dec}</b> (geser koma 2 angka ke kiri)`);
        }
    });

    const decMatches = [...new Set((text.match(/\b0[.,]\d{1,3}\b/g) || []).slice(0, 3))];
    if (decMatches.length) showSpecialFractions = true;
    const specialDec = {
        '0,5': '1/2 (5/10 disederhanakan bagi 5)',
        '0,25': '1/4 (25/100 disederhanakan bagi 25)',
        '0,75': '3/4 (75/100 disederhanakan bagi 25)',
        '0,2': '1/5 (2/10 disederhanakan bagi 2)',
        '0,4': '2/5 (4/10 disederhanakan bagi 2)',
        '0,6': '3/5 (6/10 disederhanakan bagi 2)',
        '0,8': '4/5 (8/10 disederhanakan bagi 2)',
        '0,125': '1/8 (125/1000 disederhanakan bagi 125)',
        '0,375': '3/8 (375/1000 disederhanakan bagi 125)',
        '0,625': '5/8 (625/1000 disederhanakan bagi 125)',
        '0,875': '7/8 (875/1000 disederhanakan bagi 125)'
    };
    decMatches.forEach(dRaw => {
        const dNorm = dRaw.replace('.', ',');
        if (specialDec[dNorm]) {
            tips.push(`<b>${dNorm}</b> = <b>${specialDec[dNorm]}</b>`);
        } else {
            const digits = dNorm.split(',')[1] || '';
            const denom = Math.pow(10, digits.length);
            tips.push(`<b>${dNorm}</b> ada ${digits.length} angka di belakang koma = <code>${Number(digits)}/${denom}</code>`);
        }
    });

    const fracMulMatch = text.match(/\(?\b(\d+)\/(\d+)\)?\s*(?:dari|×|\*)\s*(\d+)\b/i);
    if (fracMulMatch) {
        showSpecialFractions = true;
        const a = Number(fracMulMatch[1]);
        const b = Number(fracMulMatch[2]);
        const n = Number(fracMulMatch[3]);
        if (b > 0 && n % b === 0) {
            const qVal = n / b;
            tips.push(`Cara mudah <b>(${a}/${b}) × ${n}</b>: bagi bawah dulu (<code>${n} ÷ ${b} = ${qVal}</code>), lalu kali atas (<code>${qVal} × ${a} = ${qVal * a}</code>)`);
        }
    }

    const pctMulMatch = text.match(/\b(\d+)%\s*(?:dari|×|\*)\s*(\d+)\b/i);
    if (pctMulMatch) {
        const p = Number(pctMulMatch[1]);
        const n = Number(pctMulMatch[2]);
        if (p === 15 && n % 10 === 0) {
            const p10 = n / 10;
            const p5 = p10 / 2;
            tips.push(`Trik tanpa kalkulator <b>15% × ${n}</b>: cari 10%-nya (<code>${n} ÷ 10 = ${p10}</code>) + 5%-nya (setengah dari ${p10} = <code>${p5}</code>) = <b>${p10 + p5}</b>`);
        } else {
            tips.push(`Cara hitung <b>${p}% × ${n}</b>: kalikan <code>(${p} × ${n}) ÷ 100</code> = <code>${p * n} ÷ 100</code> = <b>${(p * n) / 100}</b>`);
        }
    }

    // Akar kuadrat (√N)
    const sqrtMatches = [...new Set((text.match(/√\s*\d+/g) || []).map(s => Number(s.replace(/[^0-9]/g, ''))).filter(n => n > 0))].slice(0, 4);
    if (sqrtMatches.length) {
        showSquaresTable = true;
        tips.push(`<b>Arti Akar Kuadrat (√N)</b>: mencari bilangan yang jika <b>dikalikan dirinya sendiri</b> hasilnya = N.`);
        sqrtMatches.forEach(n => {
            const r = Math.round(Math.sqrt(n));
            if (r * r === n) {
                const tail = n % 10;
                const extra = n >= 100
                    ? ` (cek ekor <b>${tail}</b>: ${r}×${r} ekornya ${tail}, dan ${Math.floor(r / 10) * 10}²=${Math.pow(Math.floor(r / 10) * 10, 2)} &lt; ${n})`
                    : '';
                tips.push(`<b>√${n} = ${r}</b> karena <code>${r} × ${r} = ${n}</code>${extra}`);
            }
        });
    }

    // Pangkat & selisih kuadrat (a² - b²)
    if (/[²³]|\^[23]/.test(text)) {
        showSquaresTable = true;
        tips.push(`<b>Arti Pangkat</b>: <code>a² = a × a</code>, sedangkan <code>a³ = a × a × a</code>. Jika ada bentuk <code>a² − b²</code>, pakai jalan pintas <b>(a + b) × (a − b)</b> agar tidak perlu menghitung kuadrat besar.`);
    }

    // Operasi pecahan biasa (+, -, :)
    if (/\b\d+\/\d+\s*[+\-:]\s*\d+\/\d+/.test(text)) {
        tips.push(`<b>Operasi Pecahan</b>: untuk <code>+</code> atau <code>−</code>, samakan dulu penyebut (angka bawah) pakai KPK. Untuk pembagian (<code>÷</code>), ubah jadi kali lalu balik pecahan kedua (<code>a/b ÷ c/d = a/b × d/c</code>).`);
    }

    // Perbandingan berbalik nilai / senilai / kecepatan
    const lowerText = text.toLowerCase();
    if (lowerText.includes('pekerja') && lowerText.includes('hari')) {
        tips.push(`<b>Perbandingan Berbalik Nilai</b> (makin banyak pekerja, hari makin cepat): kalikan sejajar ➔ <code>Pekerja₁ × Hari₁ = Pekerja₂ × Hari₂</code>.`);
    } else if (lowerText.includes('kecepatan') || lowerText.includes('km/jam')) {
        tips.push(`<b>Rumus Jarak-Kecepatan-Waktu (JKW)</b>: <code>Jarak = Kecepatan × Waktu</code> | <code>Waktu = Jarak ÷ Kecepatan</code> | <code>Kecepatan = Jarak ÷ Waktu</code>.`);
    }

    if (!tips.length) return '';

    return `
        <div style="background:#ffffff; border:1px solid #bae6fd; border-radius:8px; padding:10px 12px; margin-bottom:10px;">
            <div style="font-size:0.74rem; font-weight:800; color:#0369a1; margin-bottom:6px;">
                <i class="fas fa-calculator"></i> Panduan Dasar Hitung &amp; Konversi (Dari Nol)
            </div>
            <ul style="margin:0 0 8px 16px; padding:0; font-size:0.77rem; color:#1e293b; line-height:1.5;">
                ${tips.map(t => `<li style="margin-bottom:3px;">${t}</li>`).join('')}
            </ul>
            ${showSpecialFractions ? `
                <div style="background:#f0f9ff; border:1px dashed #7dd3fc; border-radius:6px; padding:6px 9px; font-size:0.71rem; color:#0c4a6e; line-height:1.45; margin-bottom:${showSquaresTable ? '6px' : '0'};">
                    <strong>📌 Hafalan Pecahan Istimewa:</strong>
                    <code>1/2 = 0,5 = 50%</code> • <code>1/4 = 0,25 = 25%</code> • <code>3/4 = 0,75 = 75%</code> •
                    <code>1/5 = 0,2 = 20%</code> • <code>2/5 = 0,4 = 40%</code> •
                    <code>1/8 = 0,125 = 12,5%</code> • <code>3/8 = 0,375 = 37,5%</code> • <code>5/8 = 0,625 = 62,5%</code> • <code>1/3 ≈ 0,333 = 33,3%</code>
                </div>
            ` : ''}
            ${showSquaresTable ? `
                <div style="background:#f0f9ff; border:1px dashed #7dd3fc; border-radius:6px; padding:6px 9px; font-size:0.71rem; color:#0c4a6e; line-height:1.45;">
                    <strong>📌 Hafalan Kuadrat Dasar (√):</strong>
                    <code>1²=1</code> • <code>2²=4</code> • <code>3²=9</code> • <code>4²=16</code> • <code>5²=25</code> • <code>6²=36</code> • <code>7²=49</code> • <code>8²=64</code> • <code>9²=81</code> • <code>10²=100</code> •
                    <code>11²=121</code> • <code>12²=144</code> • <code>13²=169</code> • <code>14²=196</code> • <code>15²=225</code> • <code>16²=256</code> • <code>17²=289</code> • <code>18²=324</code> • <code>19²=361</code> • <code>20²=400</code>
                </div>
            ` : ''}
        </div>
    `;
}

function buildMentorVisualHtml(q) {
    if (!q) return '';
    const sub = String(q.subKategori || '').toLowerCase();

    // 1. Visualisasi Bar Poin TKP (5 -> 1)
    if (q.kategori === 'TKP' && Array.isArray(q.opsi) && q.opsi.length) {
        const sorted = [...q.opsi].sort((a, b) => Number(b.poin || 0) - Number(a.poin || 0));
        const bars = sorted.map(o => {
            const p = Number(o.poin || 0);
            const pct = Math.max(15, (p / 5) * 100);
            const color = p >= 5 ? '#16a34a' : (p === 4 ? '#2563eb' : (p === 3 ? '#d97706' : '#94a3b8'));
            return `
                <div style="display:flex; align-items:center; gap:8px; font-size:0.76rem; margin-bottom:4px;">
                    <strong style="min-width:20px; color:#0f172a;">${o.label}</strong>
                    <div style="flex:1; height:8px; background:#e2e8f0; border-radius:999px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:${color}; border-radius:999px;"></div>
                    </div>
                    <span style="min-width:46px; text-align:right; font-weight:700; color:${color};">${p} poin</span>
                </div>
            `;
        }).join('');
        return `
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; margin-bottom:10px;">
                <div style="font-size:0.74rem; font-weight:800; color:#475569; margin-bottom:6px;"><i class="fas fa-chart-bar" style="color:#16a34a;"></i> Peringkat Bobot Poin TKP (5 → 1)</div>
                ${bars}
            </div>
        `;
    }

    // 2. Visualisasi SVG Lengkungan Panah Lompat Deret Angka
    if (sub.includes('deret') && q.soal) {
        const match = q.soal.match(/(-?\d+(?:\s*,\s*-?\d+){3,})/);
        if (match) {
            const nums = match[1].split(',').map(s => Number(s.trim())).filter(n => !Number.isNaN(n)).slice(0, 7);
            if (nums.length >= 4) {
                const isSelang = sub.includes('selang');
                const stepW = 66;
                const startX = 34;
                const totalW = Math.max(320, startX * 2 + nums.length * stepW);
                const cy = 54;
                const nodes = [...nums.map(String), '?'];

                const formatOp = (a, b) => {
                    if (a !== 0 && b % a === 0 && Math.abs(b / a) >= 2 && Math.abs(b - a) > 3) {
                        return `×${b / a}`;
                    }
                    const d = b - a;
                    return d >= 0 ? `+${d}` : `${d}`;
                };

                let arcsSvg = '';
                if (isSelang && nums.length >= 4) {
                    for (let i = 0; i < nums.length - 2; i++) {
                        const x1 = startX + i * stepW;
                        const x2 = startX + (i + 2) * stepW;
                        const mx = (x1 + x2) / 2;
                        const isEven = i % 2 === 0;
                        const color = isEven ? '#2563eb' : '#d97706';
                        const ctrlY = isEven ? 8 : 100;
                        const labelY = isEven ? 20 : 97;
                        const op = formatOp(nums[i], nums[i + 2]);
                        arcsSvg += `
                            <path d="M ${x1} ${isEven ? cy - 16 : cy + 16} Q ${mx} ${ctrlY} ${x2} ${isEven ? cy - 16 : cy + 16}" fill="none" stroke="${color}" stroke-width="1.8" stroke-dasharray="3,2"/>
                            <rect x="${mx - 15}" y="${labelY - 10}" width="30" height="14" rx="7" fill="${isEven ? '#dbeafe' : '#fef3c7'}"/>
                            <text x="${mx}" y="${labelY}" text-anchor="middle" font-size="9.5" font-weight="800" fill="${color}">${op}</text>
                        `;
                    }
                } else {
                    for (let i = 0; i < nums.length - 1; i++) {
                        const x1 = startX + i * stepW;
                        const x2 = startX + (i + 1) * stepW;
                        const mx = (x1 + x2) / 2;
                        const op = formatOp(nums[i], nums[i + 1]);
                        arcsSvg += `
                            <path d="M ${x1 + 10} ${cy - 16} Q ${mx} 14 ${x2 - 10} ${cy - 16}" fill="none" stroke="#2563eb" stroke-width="1.8"/>
                            <polygon points="${x2 - 12},${cy - 19} ${x2 - 7},${cy - 14} ${x2 - 14},${cy - 12}" fill="#2563eb"/>
                            <rect x="${mx - 15}" y="12" width="30" height="15" rx="7" fill="#dbeafe"/>
                            <text x="${mx}" y="22.5" text-anchor="middle" font-size="9.5" font-weight="800" fill="#1d4ed8">${op}</text>
                        `;
                    }
                }

                const nodesSvg = nodes.map((val, idx) => {
                    const x = startX + idx * stepW;
                    const isQ = val === '?';
                    const fill = isQ ? '#dcfce7' : '#ffffff';
                    const stroke = isQ ? '#16a34a' : '#cbd5e1';
                    const textFill = isQ ? '#15803d' : '#0f172a';
                    return `
                        <rect x="${x - 19}" y="${cy - 14}" width="38" height="28" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.6" ${isQ ? 'stroke-dasharray="3,2"' : ''}/>
                        <text x="${x}" y="${cy + 4}" text-anchor="middle" font-size="11.5" font-weight="800" fill="${textFill}">${escapeHtmlMentor(val)}</text>
                    `;
                }).join('');

                return `
                    <div style="background:#ffffff; border:1px solid #dbeafe; border-radius:8px; padding:10px 12px; margin-bottom:10px; overflow-x:auto;">
                        <div style="font-size:0.74rem; font-weight:800; color:#1d4ed8; margin-bottom:4px;">
                            <i class="fas fa-project-diagram"></i> Visualisasi SVG Pola Lompatan ${isSelang ? '(Selang-Seling 2 Warna)' : 'Deret Angka'}
                        </div>
                        <svg viewBox="0 0 ${totalW} 108" style="width:100%; min-width:300px; max-height:110px; display:block;">
                            ${arcsSvg}
                            ${nodesSvg}
                        </svg>
                    </div>
                `;
            }
        }
    }

    // 3. Visualisasi Diagram Venn Rapi & Peta Premis Nyata Silogisme
    if (sub.includes('silogisme') || sub.includes('logis')) {
        const lowerSoal = String(q.soal || '').toLowerCase();
        const isSebagian = lowerSoal.includes('sebagian') || lowerSoal.includes('beberapa');
        const isSemua = lowerSoal.includes('semua');

        // Ekstrak kalimat premis & fakta nyata dari teks soal
        const cleanBody = String(q.soal || '')
            .replace(/\(S[23]-\d+\)/g, '')
            .replace(/Kesimpulan yang paling tepat adalah\.{0,3}/i, '')
            .replace(/Berdasarkan narasi tersebut,?\s*kesimpulan.*?\.{0,3}/i, '')
            .replace(/Manakah pernyataan yang paling tepat\??/i, '')
            .trim();
        const sents = cleanBody
            .split(/(?<=[.!?])\s+|\n+/)
            .map(s => s.trim())
            .filter(s => s.length > 8);

        const bestOpt = (q.opsi || []).find(o => o.benar);
        const premisCards = sents.slice(0, 3).map((s, idx) => {
            const isFact = idx === sents.slice(0, 3).length - 1 && sents.length >= 2 && (/\btidak\b|\bbukan\b|diketahui|ternyata/i.test(s) || sents.length >= 3);
            const tag = isFact ? 'Fakta Kasus' : `Premis ${idx + 1}`;
            const bg = isFact ? '#fffbeb' : '#eff6ff';
            const fg = isFact ? '#92400e' : '#1e40af';
            const bd = isFact ? '#fde68a' : '#bfdbfe';
            return `
                <div style="background:${bg}; border:1px solid ${bd}; border-radius:7px; padding:6px 10px; font-size:0.77rem; color:#1e293b; line-height:1.45;">
                    <span style="font-weight:800; color:${fg}; margin-right:5px;">${tag}:</span>${escapeHtmlMentor(s)}
                </div>
            `;
        }).join('');

        const vennSvg = isSebagian
            ? `
                <svg viewBox="0 0 220 92" style="width:190px; height:80px; flex-shrink:0;">
                    <circle cx="82" cy="46" r="32" fill="rgba(37,99,235,0.12)" stroke="#2563eb" stroke-width="1.8"/>
                    <circle cx="138" cy="46" r="32" fill="rgba(22,163,74,0.12)" stroke="#16a34a" stroke-width="1.8"/>
                    <text x="63" y="50" text-anchor="middle" font-size="11" font-weight="800" fill="#1e40af">A</text>
                    <text x="110" y="50" text-anchor="middle" font-size="10" font-weight="800" fill="#0f172a">A∩B</text>
                    <text x="157" y="50" text-anchor="middle" font-size="11" font-weight="800" fill="#166534">B</text>
                </svg>`
            : (isSemua ? `
                <svg viewBox="0 0 220 96" style="width:190px; height:84px; flex-shrink:0;">
                    <circle cx="110" cy="48" r="42" fill="rgba(22,163,74,0.10)" stroke="#16a34a" stroke-width="1.8"/>
                    <text x="110" y="21" text-anchor="middle" font-size="9.5" font-weight="800" fill="#166534">B (Himpunan Besar)</text>
                    <circle cx="110" cy="58" r="23" fill="rgba(37,99,235,0.16)" stroke="#2563eb" stroke-width="1.8"/>
                    <text x="110" y="62" text-anchor="middle" font-size="10" font-weight="800" fill="#1e40af">A ⊂ B</text>
                </svg>` : '');

        // Buat Notasi Simbolik Cepat (P -> Q, ~Q, ∴ ~P / A ⊂ B)
        let formulaHtml = '';
        if (isSemua && isSebagian) {
            formulaHtml = `
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-family:monospace; font-size:0.8rem; font-weight:800; background:#f8fafc; border:1px dashed #94a3b8; border-radius:7px; padding:7px 10px; color:#0f172a;">
                    <span style="background:#dbeafe; color:#1e40af; padding:2px 7px; border-radius:5px;">Semua A = B</span>
                    <span>+</span>
                    <span style="background:#fef3c7; color:#92400e; padding:2px 7px; border-radius:5px;">Sebagian B = C</span>
                    <span>➔</span>
                    <span style="background:#dcfce7; color:#166534; padding:2px 7px; border-radius:5px;">∴ Sebagian (coret B)</span>
                </div>`;
        } else if (isSemua) {
            formulaHtml = `
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-family:monospace; font-size:0.8rem; font-weight:800; background:#f8fafc; border:1px dashed #94a3b8; border-radius:7px; padding:7px 10px; color:#0f172a;">
                    <span style="background:#dbeafe; color:#1e40af; padding:2px 7px; border-radius:5px;">P ⊂ Q (Semua P adalah Q)</span>
                    <span>+</span>
                    <span style="background:#fef3c7; color:#92400e; padding:2px 7px; border-radius:5px;">Q ⊂ R</span>
                    <span>➔</span>
                    <span style="background:#dcfce7; color:#166534; padding:2px 7px; border-radius:5px;">∴ P ⊂ R</span>
                </div>`;
        } else {
            const hasNegFact = sents.length >= 2 && /\btidak\b|\bbukan\b/i.test(sents[sents.length - 1]);
            const is3Prem = sents.length >= 3;
            const chain = is3Prem ? 'P → Q → R' : 'P → Q';
            const factSym = hasNegFact ? (is3Prem ? '~Q / ~R (tidak)' : '~Q (tidak)') : 'P (terpenuhi)';
            const resSym = hasNegFact ? '∴ ~P (Modus Tollens)' : (is3Prem ? '∴ R (Silogisme)' : '∴ Q (Modus Ponens)');
            formulaHtml = `
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-family:monospace; font-size:0.8rem; font-weight:800; background:#f8fafc; border:1px dashed #94a3b8; border-radius:7px; padding:7px 10px; color:#0f172a;">
                    <span style="background:#dbeafe; color:#1e40af; padding:2px 7px; border-radius:5px;">${chain}</span>
                    <span>|</span>
                    <span style="background:#fef3c7; color:#92400e; padding:2px 7px; border-radius:5px;">Fakta: ${factSym}</span>
                    <span>➔</span>
                    <span style="background:#dcfce7; color:#166534; padding:2px 7px; border-radius:5px;">${resSym}</span>
                    <span style="font-family:sans-serif; font-size:0.7rem; font-weight:600; color:#64748b;">(~ = tidak/bukan, ∴ = jadi)</span>
                </div>`;
        }

        return `
            <div style="background:#ffffff; border:1px solid #dbeafe; border-radius:8px; padding:10px 12px; margin-bottom:10px;">
                <div style="font-size:0.74rem; font-weight:800; color:#1d4ed8; margin-bottom:8px;"><i class="fas fa-sitemap"></i> Peta Premis &amp; Notasi Simbolik Silogisme</div>
                <div style="margin-bottom:8px;">${formulaHtml}</div>
                <div style="display:flex; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                    ${vennSvg}
                    <div style="display:flex; flex-direction:column; gap:5px; flex:1; min-width:220px;">
                        ${premisCards}
                        ${bestOpt ? `
                            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:7px; padding:6px 10px; font-size:0.77rem; color:#166534; line-height:1.45;">
                                <span style="font-weight:800; margin-right:5px;">➔ Kesimpulan Pasti (${escapeHtmlMentor(q.kunci || bestOpt.label)}):</span>${escapeHtmlMentor(bestOpt.teks)}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // 4. Visualisasi Panduan Transformasi Figural (Rotasi / Cermin / Elemen)
    if (sub.includes('figural')) {
        const isKetidaksamaan = sub.includes('ketidaksamaan');
        const pLower = String(q.pembahasan || '').toLowerCase();
        const isRot = /rotasi|putar|searah|berlawanan|90|180|270/.test(pLower);
        const isMirror = /cermin|refleksi|pencerminan|terbalik|mirror/.test(pLower);
        const isCount = /jumlah|sisi|titik|garis|tambah|kurang|arsir/.test(pLower);
        const chipStyle = (active, bg, fg, bd) => active
            ? `background:${bg}; color:${fg}; border:2px solid ${bd}; padding:4px 9px; border-radius:6px; box-shadow:0 1px 4px rgba(0,0,0,0.08);`
            : `background:#f8fafc; color:#64748b; border:1px solid #e2e8f0; padding:4px 9px; border-radius:6px; opacity:0.8;`;
        return `
            <div style="background:#ffffff; border:1px solid #e0e7ff; border-radius:8px; padding:10px 12px; margin-bottom:10px;">
                <div style="font-size:0.74rem; font-weight:800; color:#4338ca; margin-bottom:6px;"><i class="fas fa-shapes"></i> Visualisasi Pola Transformasi Figural</div>
                <div style="display:flex; align-items:center; gap:7px; flex-wrap:wrap; font-size:0.74rem; font-weight:700;">
                    <span style="${chipStyle(isRot, '#eef2ff', '#3730a3', '#6366f1')}">↻ Rotasi (90° / 180°)</span>
                    <span style="${chipStyle(isMirror, '#ecfeff', '#0e7490', '#06b6d4')}">↔ Cermin / Refleksi</span>
                    <span style="${chipStyle(isCount || isKetidaksamaan, '#fef3c7', '#92400e', '#f59e0b')}">${isKetidaksamaan ? '≠ Cari 1 Fitur Berbeda' : '+ / − Jumlah Sisi & Titik'}</span>
                </div>
            </div>
        `;
    }

    // 5. Panduan Dasar Hitung & Konversi (Persen / Desimal / Pecahan) untuk Numerik
    if (sub.includes('numerik') || sub.includes('hitung') || sub.includes('perbandingan') || sub.includes('cerita')) {
        const numerikDasar = buildNumerikDasarHtml(q);
        if (numerikDasar) return numerikDasar;
    }

    return '';
}

function buildMentorTrikAndJebakan(q, userAns, kunciLabel, gotPoin, maxPoin) {
    const sub = String(q?.subKategori || '').toLowerCase();
    const kat = String(q?.kategori || '').toUpperCase();

    let trik = 'Baca kalimat tanya paling akhir terlebih dahulu agar fokus menangkap kata kunci sebelum menghitung atau memilih opsi.';
    let jebakan = 'Terburu-buru memilih opsi yang sekilas mirip padahal melenceng dari inti pertanyaan.';

    if (kat === 'TKP') {
        trik = 'Cari opsi yang menunjukkan sikap paling proaktif, solutif, taat SOP, dan berorientasi pelayanan publik tanpa merugikan pihak lain.';
        jebakan = 'Opsi bernilai 3–4 biasanya terlihat sopan, tetapi masih pasif (hanya menunggu atasan atau menunda solusi).';
    } else if (sub.includes('deret')) {
        trik = sub.includes('selang')
            ? 'Langsung cek lompat 1 posisi (posisi ganjil dengan ganjil, genap dengan genap) jika angka terlihat naik-turun.'
            : 'Hitung selisih 3 pasangan awal sekaligus; jika belum konstan, cek rasio (×) atau selisih tingkat kedua.';
        jebakan = 'Mengira deret 1 pola padahal selang-seling, atau tertukar tanda (+ / −) di langkah terakhir.';
    } else if (sub.includes('silogisme') || sub.includes('logis')) {
        trik = 'Aturan 10 detik: Semua + Sebagian = Sebagian; coret term tengah yang sama, jangan menambah asumsi di luar premis.';
        jebakan = 'Membalik pernyataan "Semua A adalah B" menjadi "Semua B adalah A", padahal konversnya hanya "Sebagian B adalah A".';
    } else if (sub.includes('figural')) {
        trik = 'Lacak 1 elemen kecil dulu (arah panah/titik/arsiran), lalu cek apakah berputar ↻ 90° atau dicerminkan ↔.';
        jebakan = 'Tertipu bentuk luar yang sama, padahal posisi cermin atau jumlah sudutnya berbeda 1.';
    } else if (sub.includes('hitung') || sub.includes('numerik') || sub.includes('perbandingan')) {
        trik = 'Gunakan pembulatan cerdas atau cek digit satuan/persentase pecahan istimewa (12,5% = 1/8; 33,3% = 1/3) untuk hemat waktu.';
        jebakan = 'Salah konversi satuan (persen vs desimal) atau lupa urutan operasi perkalian/pembagian sebelum penjumlahan.';
    } else if (sub.includes('sinonim') || sub.includes('antonim') || sub.includes('kosakata')) {
        trik = 'Kenali makna dasar atau kata serapannya, lalu eliminasi opsi yang maknanya berlawanan/terlalu sempit.';
        jebakan = 'Memilih kata yang sering muncul dalam satu topik padahal bukan padanan/lawan kata yang diminta.';
    } else if (sub.includes('analogi') || kat === 'TIU') {
        trik = 'Untuk analogi, buat 1 kalimat penghubung baku antara kata kiri dan kanan, lalu terapkan kalimat persis sama ke opsi.';
        jebakan = 'Terbalik arah hubungan (sebab-akibat tertukar akibat-sebab) atau memilih kata yang sebidang makna tapi beda kelas kata.';
    } else if (kat === 'TWK') {
        trik = 'Kaitkan inti kasus dengan nilai dasar Pancasila, UUD 1945, integritas ASN, atau kepentingan keutuhan NKRI.';
        jebakan = 'Memilih jawaban yang benar secara teori umum, tetapi kurang spesifik dengan konteks sila/pasal yang ditanyakan.';
    }

    const pickedOpt = userAns ? (q.opsi || []).find(o => o.label === userAns) : null;
    const isWrong = Boolean(userAns && gotPoin < maxPoin);
    const jebakanTitle = isWrong ? `⚠️ Kenapa Jawabanmu (${escapeHtmlMentor(userAns)}) Salah?` : '⚠️ Jebakan Umum Soal Ini';
    const jebakanBody = isWrong
        ? (kat === 'TKP'
            ? `Opsi <b>${escapeHtmlMentor(userAns)}</b>${pickedOpt ? ` ("${escapeHtmlMentor(pickedOpt.teks.slice(0, 65))}${pickedOpt.teks.length > 65 ? '...' : ''}")` : ''} hanya bernilai <b>+${gotPoin} poin</b>, masih kalah optimal dari opsi <b>${escapeHtmlMentor(kunciLabel)}</b> (+${maxPoin} poin). ${jebakan}`
            : `Opsi <b>${escapeHtmlMentor(userAns)}</b> bukan jawaban tepat karena termasuk pengecoh. ${jebakan}`)
        : jebakan;

    return { trik, jebakanTitle, jebakanBody };
}

window.buildInteractivePembahasanHtml = (q, userAns, uidSuffix = '0', meta = {}) => {
    const rawText = (q && q.pembahasan)
        ? String(q.pembahasan)
        : 'Bobot nilai tertinggi menunjukkan opsi paling selaras dengan indikator BKN pada subtes ini.';
    const safeId = String(uidSuffix).replace(/[^a-zA-Z0-9_-]/g, '_');

    const bestOpt = (q.opsi || []).find(o => o.benar) ||
        (q.opsi || []).reduce((best, cur) => (Number(cur.poin || 0) > Number(best?.poin || -1) ? cur : best), null);
    const kunciLabel = q.kunci || bestOpt?.label || '-';

    // Pecah pembahasan menjadi langkah-langkah logis yang jelas & langsung terbaca
    let parts = rawText
        .split(/(?:\n+|(?<=[.!?])\s+(?=[A-Z0-9(]))/)
        .map(s => s.trim())
        .filter(Boolean);
    if (parts.length === 0) parts = [rawText];
    if (parts.length === 1 && bestOpt) {
        parts = [
            parts[0],
            `Berdasarkan analisis di atas, jawaban yang paling tepat adalah opsi ${kunciLabel}: **${bestOpt.teks}**.`
        ];
    }
    if (parts.length > 4) {
        parts = [parts[0], parts[1], parts.slice(2).join(' ')];
    }

    const getStepTitle = (idx, total) => {
        if (total === 1) return 'Inti Pembahasan & Kunci';
        if (idx === 0) return 'Tangkap Kata Kunci / Diketahui';
        if (idx === total - 1) return 'Kesimpulan & Kunci Jawaban';
        return 'Penjabaran Proses / Logika';
    };

    const stepsHtml = parts.map((stepTxt, idx) => `
        <div class="mentor-step-item" data-step-idx="${idx}" style="${idx === 0 ? '' : 'display:none;'} background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:9px 11px; margin-bottom:6px; font-size:0.83rem; color:#1e293b; line-height:1.55;">
            <span style="display:inline-block; font-size:0.7rem; font-weight:800; color:#1d4ed8; background:#eff6ff; padding:2px 8px; border-radius:999px; margin-right:6px;">Langkah ${idx + 1} • ${getStepTitle(idx, parts.length)}</span>
            ${formatMentorTextWithSvg(stepTxt)}
        </div>
    `).join('');

    const hasMoreSteps = parts.length > 1;
    const visualHtml = buildMentorVisualHtml(q);
    const gotPoin = meta.gotPoin !== undefined ? Number(meta.gotPoin) : 0;
    const maxPoin = meta.maxPoin !== undefined ? Number(meta.maxPoin) : 5;
    const headerTitle = meta.headerTitle || 'Pembahasan Mentor';
    const qIdForReport = escapeHtmlMentor(q.id || safeId);
    const { trik, jebakanTitle, jebakanBody } = buildMentorTrikAndJebakan(q, userAns, kunciLabel, gotPoin, maxPoin);

    const isTiu = String(q.kategori || '').toUpperCase() === 'TIU';
    const subKatAttr = escapeHtmlMentor(q.subKategori || 'TIU');
    const cleanSpeechRaw = rawText.replace(/<svg[\s\S]*?<\/svg>/gi, 'gambar pola');
    const speechText = escapeHtmlMentor(`${cleanSpeechRaw}. Trik cepat: ${trik} Kunci jawaban terbaik adalah opsi ${kunciLabel}.`);

    window._botSoalContextMap = window._botSoalContextMap || {};
    window._botSoalContextMap[safeId] = {
        soalId: String(q.id || safeId),
        kategori: String(q.kategori || 'SKD'),
        soal: String(q.soal || '').replace(/<[^>]+>/g, ' ').trim(),
        opsiText: (q.opsi || []).map(o => `${o.label}. ${String(o.teks || '').replace(/<[^>]+>/g, ' ').trim()}`).join('\n'),
        kunci: String(kunciLabel || ''),
        userAns: String(userAns || ''),
        pembahasan: String(rawText || '').replace(/<[^>]+>/g, ' ').trim()
    };

    return `
        <div id="mentorBox_${safeId}" style="background:#f8fafc; border-left:4px solid var(--primary); padding:14px 16px; border-radius:10px; font-size:0.86rem; color:#334155;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
                <strong style="color:var(--primary); font-size:0.9rem;"><i class="fas fa-chalkboard-teacher"></i> ${headerTitle}</strong>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    ${meta.gotPoin !== undefined ? `
                        <span style="font-size:0.74rem; font-weight:800; padding:3px 9px; border-radius:999px; ${gotPoin >= maxPoin ? 'background:#dcfce7; color:#15803d;' : 'background:#fef3c7; color:#b45309;'}">
                            Pilihanmu ${userAns || '-'} (+${gotPoin} poin)
                        </span>
                    ` : ''}
                    <button type="button" data-speech="${speechText}" onclick="window.toggleBacakanPembahasan(this)" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:700; cursor:pointer;">
                        <i class="fas fa-volume-up"></i> Dengarkan
                    </button>
                    <button type="button" class="bot-inline-btn" onclick="window.bedahSoalDenganBot('${safeId}')">
                        <i class="fas fa-robot"></i> MenujuASN-BOT
                    </button>
                    <button type="button" onclick="window.bukaModalLaporSoal('${qIdForReport}')" style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; padding:4px 10px; border-radius:999px; font-size:0.74rem; font-weight:700; cursor:pointer;">
                        <i class="fas fa-flag"></i> Lapor Soal
                    </button>
                </div>
            </div>

            ${visualHtml}

            <div id="mentorSteps_${safeId}" data-revealed="1" data-total="${parts.length}">
                ${stepsHtml}
            </div>

            ${hasMoreSteps ? `
                <div id="mentorStepControls_${safeId}" style="display:flex; gap:8px; flex-wrap:wrap; margin:6px 0 10px;">
                    <button type="button" onclick="window.nextPembahasanStep('${safeId}')" style="background:var(--primary); color:#fff; border:none; padding:5px 12px; border-radius:8px; font-size:0.76rem; font-weight:700; cursor:pointer;">
                        <i class="fas fa-step-forward"></i> Lanjut Langkah (1/${parts.length})
                    </button>
                    <button type="button" onclick="window.bukaSemuaPembahasanStep('${safeId}')" style="background:#fff; color:#334155; border:1px solid #cbd5e1; padding:5px 12px; border-radius:8px; font-size:0.76rem; font-weight:700; cursor:pointer;">
                        Buka Semua
                    </button>
                </div>
            ` : ''}

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:8px; margin-top:8px;">
                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:9px 11px; font-size:0.78rem; color:#166534; line-height:1.45;">
                    <div style="font-weight:800; margin-bottom:3px;">⚡ Trik 10 Detik • Kunci: Opsi ${escapeHtmlMentor(kunciLabel)} (${q.kategori === 'TKP' ? `Poin ${maxPoin}` : 'Benar +5'})</div>
                    <div>${escapeHtmlMentor(trik)}</div>
                </div>
                <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:9px 11px; font-size:0.78rem; color:#92400e; line-height:1.45;">
                    <div style="font-weight:800; margin-bottom:3px;">${jebakanTitle}</div>
                    <div>${jebakanBody}</div>
                </div>
            </div>

            ${isTiu ? `
                <div style="margin-top:10px; display:flex; justify-content:flex-end;">
                    <button type="button" data-subkat="${subKatAttr}" data-qid="${qIdForReport}" onclick="window.ujiPolaSerupaTiu(this.dataset.qid, this.dataset.subkat)" style="background:#eef2ff; color:#3730a3; border:1px solid #c7d2fe; padding:6px 13px; border-radius:8px; font-size:0.77rem; font-weight:800; cursor:pointer;">
                        🔁 Uji Pola Serupa (Latihan 1 Soal)
                    </button>
                </div>
            ` : ''}
            <div id="botExplainWrap_${safeId}" style="display:none;" class="bot-inline-result"></div>
        </div>
    `;
};

function generateSimilarTiuQuestion(subKategori, excludeId) {
    const sub = String(subKategori || '').toLowerCase();
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

    const buildNumericOptions = (ans) => {
        const distractors = new Set([ans]);
        const offsets = [-6, -4, -3, -2, -1, 1, 2, 3, 4, 6, 8];
        for (const off of shuffle(offsets)) {
            if (distractors.size >= 5) break;
            if (ans + off >= 0) distractors.add(ans + off);
        }
        while (distractors.size < 5) distractors.add(ans + distractors.size * 5);
        const vals = shuffle([...distractors]);
        const labels = ['A', 'B', 'C', 'D', 'E'];
        const opsi = vals.map((v, i) => ({ label: labels[i], teks: String(v), benar: v === ans }));
        const kunci = opsi.find(o => o.benar).label;
        return { opsi, kunci };
    };

    if (sub.includes('selang')) {
        const a0 = rand(3, 12);
        const da = rand(3, 7);
        const b0 = rand(20, 40);
        const db = -rand(2, 5);
        const seq = [a0, b0, a0 + da, b0 + db, a0 + da * 2, b0 + db * 2];
        const ans = a0 + da * 3;
        const { opsi, kunci } = buildNumericOptions(ans);
        return {
            kategori: 'TIU',
            subKategori: subKategori || 'Numerik - Deret Selang',
            soal: `Lanjutkan pola deret selang-seling berikut:\n${seq.join(', ')}, ...`,
            opsi,
            kunci,
            pembahasan: `Pola ganjil (posisi 1, 3, 5, 7) selalu bertambah +${da} (${a0} → ${a0 + da} → ${a0 + da * 2} → ${ans}). Pola genap selalu berkurang ${db}. Jadi angka berikutnya adalah ${ans}.`
        };
    }

    if (sub.includes('deret')) {
        const start = rand(2, 10);
        const d1 = rand(2, 5);
        const inc = rand(2, 4);
        const seq = [start];
        for (let i = 0; i < 4; i++) seq.push(seq[seq.length - 1] + d1 + i * inc);
        const ans = seq[seq.length - 1] + d1 + 4 * inc;
        const { opsi, kunci } = buildNumericOptions(ans);
        return {
            kategori: 'TIU',
            subKategori: subKategori || 'Numerik - Deret Bertingkat',
            soal: `Tentukan angka selanjutnya pada deret berikut:\n${seq.join(', ')}, ...`,
            opsi,
            kunci,
            pembahasan: `Selisih antar suku naik konstan +${inc} tiap langkah (+${d1}, +${d1 + inc}, +${d1 + 2 * inc}, +${d1 + 3 * inc}, lalu +${d1 + 4 * inc}). Maka ${seq[seq.length - 1]} + ${d1 + 4 * inc} = ${ans}.`
        };
    }

    if (sub.includes('silogisme') || sub.includes('logis')) {
        const scenarios = [
            {
                soal: 'Semua peserta bimbel ASN rajin berlatih tryout.\nSebagian mahasiswa tingkat akhir adalah peserta bimbel ASN.\nSimpulan yang paling tepat adalah...',
                opsi: [
                    { label: 'A', teks: 'Semua mahasiswa tingkat akhir rajin berlatih tryout.', benar: false },
                    { label: 'B', teks: 'Sebagian mahasiswa tingkat akhir rajin berlatih tryout.', benar: true },
                    { label: 'C', teks: 'Semua yang rajin berlatih tryout adalah mahasiswa.', benar: false },
                    { label: 'D', teks: 'Tidak ada mahasiswa tingkat akhir yang ikut bimbel ASN.', benar: false },
                    { label: 'E', teks: 'Sebagian peserta bimbel ASN tidak rajin berlatih.', benar: false }
                ],
                kunci: 'B',
                pembahasan: 'Premis 1 (Semua) + Premis 2 (Sebagian) selalu menghasilkan simpulan Sebagian. Karena sebagian mahasiswa adalah peserta bimbel ASN, maka sebagian mahasiswa tingkat akhir rajin berlatih tryout.'
            },
            {
                soal: 'Semua pegawai yang berintegritas hadir tepat waktu.\nSebagian pegawai di divisi pelayanan tidak hadir tepat waktu.\nSimpulan yang paling tepat adalah...',
                opsi: [
                    { label: 'A', teks: 'Semua pegawai divisi pelayanan berintegritas.', benar: false },
                    { label: 'B', teks: 'Tidak ada pegawai divisi pelayanan yang hadir tepat waktu.', benar: false },
                    { label: 'C', teks: 'Sebagian pegawai divisi pelayanan bukan pegawai yang berintegritas.', benar: true },
                    { label: 'D', teks: 'Semua yang hadir tepat waktu adalah pegawai divisi pelayanan.', benar: false },
                    { label: 'E', teks: 'Pegawai berintegritas boleh datang terlambat.', benar: false }
                ],
                kunci: 'C',
                pembahasan: 'Dengan modus tollens: jika tidak hadir tepat waktu, maka bukan pegawai berintegritas. Karena hanya sebagian yang terlambat, simpulannya sebagian pegawai divisi pelayanan bukan pegawai yang berintegritas.'
            }
        ];
        return { kategori: 'TIU', subKategori: subKategori || 'Verbal - Silogisme', ...scenarios[rand(0, scenarios.length - 1)] };
    }

    if (sub.includes('hitung') || sub.includes('numerik') || sub.includes('perbandingan')) {
        const pctList = [20, 25, 40, 50];
        const pct = pctList[rand(0, pctList.length - 1)];
        const base = rand(4, 15) * 20;
        const extra = rand(5, 25);
        const ans = Math.round((pct / 100) * base) + extra;
        const { opsi, kunci } = buildNumericOptions(ans);
        return {
            kategori: 'TIU',
            subKategori: subKategori || 'Numerik - Hitung Cepat',
            soal: `Nilai dari ${pct}% × ${base} + ${extra} adalah...`,
            opsi,
            kunci,
            pembahasan: `${pct}% × ${base} = ${(pct / 100) * base}. Lalu ${(pct / 100) * base} + ${extra} = ${ans}.`
        };
    }

    const pool = [...(window.DATA_TIU_GRATIS || []), ...(window.DATA_SKD_CPNS || [])]
        .filter(item => item && String(item.kategori || '').toUpperCase() === 'TIU' && String(item.id || '') !== String(excludeId || ''));
    const sameSub = pool.filter(item => String(item.subKategori || '').toLowerCase() === sub);
    const candidates = sameSub.length ? sameSub : pool;
    if (candidates.length) {
        return candidates[rand(0, candidates.length - 1)];
    }
    return null;
}

window.ujiPolaSerupaTiu = (soalId, subKategori) => {
    const q = generateSimilarTiuQuestion(subKategori, soalId);
    if (!q) {
        return Swal.fire('Info', 'Belum ada variasi soal serupa untuk tipe ini.', 'info');
    }
    const btnsHtml = (q.opsi || []).map(o => `
        <button type="button" class="uji-serupa-opt" data-label="${escapeHtmlMentor(o.label)}" data-benar="${o.benar ? '1' : '0'}"
            style="width:100%; text-align:left; padding:9px 12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size:0.84rem; cursor:pointer; display:flex; gap:8px; align-items:center;">
            <strong style="min-width:22px; color:#1d4ed8;">${escapeHtmlMentor(o.label)}.</strong>
            <span style="display:inline-flex; align-items:center; flex-wrap:wrap; gap:6px;">${formatMentorTextWithSvg(o.teks)}</span>
        </button>
    `).join('');

    Swal.fire({
        title: '🔁 Uji Pola Serupa (TIU)',
        width: 600,
        html: `
            <div style="text-align:left;">
                <span style="display:inline-block; font-size:0.72rem; font-weight:800; background:#eef2ff; color:#3730a3; padding:3px 9px; border-radius:999px; margin-bottom:8px;">
                    ${escapeHtmlMentor(q.subKategori || 'Latihan Pola TIU')}
                </span>
                <div style="font-size:0.9rem; color:#0f172a; line-height:1.55; white-space:pre-line; margin-bottom:12px; background:#f8fafc; padding:10px 12px; border-radius:8px; border:1px solid #e2e8f0;">${formatMentorTextWithSvg(q.soal)}</div>
                <div id="ujiSerupaOpsiWrap" style="display:flex; flex-direction:column; gap:7px;">${btnsHtml}</div>
                <div id="ujiSerupaFeedback" style="display:none; margin-top:12px; padding:10px 12px; border-radius:8px; font-size:0.82rem; line-height:1.5;"></div>
            </div>
        `,
        showDenyButton: true,
        denyButtonText: '🔁 Soal Serupa Lagi',
        denyButtonColor: '#4f46e5',
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#334155',
        didOpen: () => {
            const wrap = document.getElementById('ujiSerupaOpsiWrap');
            const fb = document.getElementById('ujiSerupaFeedback');
            if (!wrap || !fb) return;
            wrap.querySelectorAll('.uji-serupa-opt').forEach(btn => {
                btn.addEventListener('click', () => {
                    const isBenar = btn.dataset.benar === '1';
                    wrap.querySelectorAll('.uji-serupa-opt').forEach(b => {
                        b.disabled = true;
                        if (b.dataset.benar === '1') {
                            b.style.background = '#dcfce7';
                            b.style.borderColor = '#16a34a';
                        }
                    });
                    if (!isBenar) {
                        btn.style.background = '#fee2e2';
                        btn.style.borderColor = '#dc2626';
                    }
                    fb.style.display = 'block';
                    fb.style.background = isBenar ? '#f0fdf4' : '#fffbeb';
                    fb.style.border = `1px solid ${isBenar ? '#bbf7d0' : '#fde68a'}`;
                    fb.style.color = isBenar ? '#166534' : '#92400e';
                    fb.innerHTML = `<strong>${isBenar ? '✅ Mantap! Jawabanmu Benar!' : `❌ Kurang Tepat (Kunci: ${escapeHtmlMentor(q.kunci)})`}</strong><br>${formatMentorTextWithSvg(q.pembahasan)}`;
                });
            });
        }
    }).then(res => {
        if (res.isDenied) {
            window.ujiPolaSerupaTiu(soalId, subKategori);
        }
    });
};

window.nextPembahasanStep = (safeId) => {
    const wrap = document.getElementById(`mentorSteps_${safeId}`);
    if (!wrap) return;
    const total = Number(wrap.dataset.total || 1);
    let revealed = Number(wrap.dataset.revealed || 1);
    if (revealed < total) revealed++;
    wrap.dataset.revealed = String(revealed);
    wrap.querySelectorAll('.mentor-step-item').forEach((el, idx) => {
        if (idx < revealed) el.style.display = 'block';
    });
    const ctrl = document.getElementById(`mentorStepControls_${safeId}`);
    if (ctrl) {
        if (revealed >= total) {
            ctrl.style.display = 'none';
        } else {
            const btn = ctrl.querySelector('button');
            if (btn) btn.innerHTML = `<i class="fas fa-step-forward"></i> Lanjut Langkah (${revealed}/${total})`;
        }
    }
};

window.bukaSemuaPembahasanStep = (safeId) => {
    const wrap = document.getElementById(`mentorSteps_${safeId}`);
    if (!wrap) return;
    wrap.querySelectorAll('.mentor-step-item').forEach(el => { el.style.display = 'block'; });
    const ctrl = document.getElementById(`mentorStepControls_${safeId}`);
    if (ctrl) ctrl.style.display = 'none';
};

window.toggleBacakanPembahasan = (btnEl) => {
    if (!('speechSynthesis' in window)) {
        return Swal.fire('Info', 'Browser ini belum mendukung fitur suara otomatis.', 'info');
    }
    const isSpeaking = btnEl.dataset.speaking === '1';
    window.speechSynthesis.cancel();
    document.querySelectorAll('button[data-speaking="1"]').forEach(b => {
        b.dataset.speaking = '0';
        b.innerHTML = '<i class="fas fa-volume-up"></i> Dengarkan';
    });
    if (isSpeaking) return;

    const text = btnEl.dataset.speech || '';
    if (!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'id-ID';
    utter.rate = 1.02;
    btnEl.dataset.speaking = '1';
    btnEl.innerHTML = '<i class="fas fa-stop"></i> Hentikan';
    utter.onend = () => {
        btnEl.dataset.speaking = '0';
        btnEl.innerHTML = '<i class="fas fa-volume-up"></i> Dengarkan';
    };
    utter.onerror = () => {
        btnEl.dataset.speaking = '0';
        btnEl.innerHTML = '<i class="fas fa-volume-up"></i> Dengarkan';
    };
    window.speechSynthesis.speak(utter);
};

window.bukaModalLaporSoal = async (explicitSoalId = null) => {
    if (!window.currentUser) {
        return Swal.fire('Perlu Login', 'Silakan login terlebih dahulu untuk mengirim laporan soal.', 'info');
    }
    const activeQ = (!explicitSoalId && Array.isArray(window.currentQuestions) && window.currentQuestions[window.currentIdx])
        ? window.currentQuestions[window.currentIdx]
        : null;
    const allPool = [
        ...(window.currentQuestions || []),
        ...(window.DATA_SKD_CPNS || []),
        ...(window.DATA_TIU_GRATIS || []),
        ...(window.DATA_TKP_GRATIS || [])
    ];
    const targetQ = activeQ || allPool.find(x => x && x.id === explicitSoalId) || { id: explicitSoalId || 'umum', kategori: 'SKD', soal: '' };

    const { value: formValues } = await Swal.fire({
        title: '🚩 Lapor Kesalahan Soal',
        html: `
            <div style="text-align:left; font-size:0.84rem;">
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; margin-bottom:10px; color:#475569;">
                    ID Soal: <b>${escapeHtmlMentor(targetQ.id)}</b> (${escapeHtmlMentor(targetQ.kategori || 'SKD')})
                </div>
                <label style="font-weight:700; display:block; margin-bottom:4px;">Jenis Kendala</label>
                <select id="laporJenisInput" class="swal2-select" style="width:100%; margin:0 0 10px; font-size:0.86rem;">
                    <option value="Kunci Jawaban Salah">Kunci Jawaban Salah / Kurang Tepat</option>
                    <option value="Soal atau Gambar Kurang Jelas">Soal / Gambar SVG Kurang Jelas</option>
                    <option value="Typo / Salah Ketik">Typo / Salah Ketik</option>
                    <option value="Pembahasan Kurang Jelas">Pembahasan Kurang Jelas</option>
                    <option value="Lainnya">Kendala Lainnya</option>
                </select>
                <label style="font-weight:700; display:block; margin-bottom:4px;">Detail Catatan</label>
                <textarea id="laporCatatanInput" class="swal2-textarea" placeholder="Jelaskan bagian mana yang perlu diperbaiki..." style="width:100%; margin:0; min-height:85px; font-size:0.85rem;"></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Kirim ke Admin',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#b91c1c',
        preConfirm: () => {
            const jenis = document.getElementById('laporJenisInput')?.value || 'Lainnya';
            const catatan = (document.getElementById('laporCatatanInput')?.value || '').trim();
            if (!catatan) {
                Swal.showValidationMessage('Mohon isi detail catatan singkat terlebih dahulu.');
                return false;
            }
            return { jenis, catatan };
        }
    });

    if (!formValues) return;

    try {
        const cuplikan = String(targetQ.soal || '').replace(/\s+/g, ' ').slice(0, 140);
        await addDoc(collection(db, 'laporan_soal'), {
            uid_pelapor: window.currentUser.uid,
            email: window.currentUser.email || '',
            nama_pelapor: window.currentUser.displayName || '',
            soalId: targetQ.id || '-',
            kategori: targetQ.kategori || 'SKD',
            subKategori: targetQ.subKategori || '',
            judul: `[Lapor ${targetQ.kategori || 'SKD'} • ${targetQ.id || '-'}] ${formValues.jenis}`,
            pesan: `${formValues.catatan}${cuplikan ? `\n\nCuplikan Soal: "${cuplikan}..."` : ''}`,
            status: 'pending',
            createdAt: Date.now()
        });
        Swal.fire({
            icon: 'success',
            title: 'Laporan Terkirim!',
            text: 'Terima kasih, laporanmu sudah masuk ke Command Center Admin untuk ditinjau.',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (err) {
        console.error('Gagal mengirim laporan soal:', err);
        Swal.fire('Gagal Mengirim', err.message, 'error');
    }
};


// ==========================================================
// 12. MENUJUASN-BOT (GEMINI AI + QUOTA) & PUSAT BERITA CPNS
// ==========================================================
async function callMenujuAsnBot(payload) {
    if (!window.currentUser) {
        throw new Error('Silakan login dengan akun Google terlebih dahulu.');
    }
    const idToken = await window.currentUser.getIdToken();
    const resp = await fetch('/api/menuju-asn-bot', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
        throw new Error(data.error || `Gagal menghubungi MenujuASN-BOT (HTTP ${resp.status})`);
    }
    return data;
}

function formatBotTextHtml(text) {
    return escapeHtmlMentor(String(text || ''))
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br/>');
}

window.bedahSoalDenganBot = async (safeId, followUpText = '') => {
    const ctx = window._botSoalContextMap?.[safeId];
    const box = document.getElementById(`botExplainWrap_${safeId}`);
    if (!ctx || !box) return;

    box.style.display = 'block';
    box.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <strong>MenujuASN-BOT</strong> sedang membedah soal ini...`;

    try {
        const res = await callMenujuAsnBot({
            action: 'explain',
            soalId: ctx.soalId,
            kategori: ctx.kategori,
            soal: ctx.soal,
            opsiText: ctx.opsiText,
            kunci: ctx.kunci,
            userAns: ctx.userAns,
            pembahasan: ctx.pembahasan,
            followUp: followUpText
        });
        const quotaTxt = res.limit >= 9999 ? 'Unlimited (Admin)' : `${res.used}/${res.limit} hari ini`;
        const cacheTag = res.cached ? ' • <span style="color:#059669; font-weight:700;">Cache Hemat (0 Kuota)</span>' : '';
        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                <strong style="color:#0369a1;"><i class="fas fa-robot"></i> MenujuASN-BOT</strong>
                <span style="font-size:0.72rem; color:#475569;">Kuota: <b>${quotaTxt}</b>${cacheTag}</span>
            </div>
            <div>${formatBotTextHtml(res.reply)}</div>
            <form style="display:flex; gap:6px; margin-top:10px;" onsubmit="event.preventDefault(); const inp=this.querySelector('input'); if(inp.value.trim()) window.bedahSoalDenganBot('${safeId}', inp.value.trim());">
                <input type="text" placeholder="Tanya lanjutan ke MenujuASN-BOT (misal: kenapa opsi B salah?)..." style="flex:1; padding:6px 10px; border:1px solid #bae6fd; border-radius:8px; font-size:0.78rem;" />
                <button type="submit" style="background:#0284c7; color:#fff; border:none; padding:6px 12px; border-radius:8px; font-size:0.76rem; font-weight:700; cursor:pointer;">Tanya</button>
            </form>
        `;
    } catch (err) {
        box.innerHTML = `<span style="color:#b91c1c;"><i class="fas fa-exclamation-circle"></i> ${escapeHtmlMentor(err.message)}</span>`;
    }
};

window.refreshBotAndNewsView = async () => {
    window.loadPusatBerita();
    const qExp = document.getElementById('qExplainLabel');
    const qWeak = document.getElementById('qWeaknessLabel');
    const qNews = document.getElementById('qNewsLabel');
    if (!window.currentUser) return;
    try {
        const res = await callMenujuAsnBot({ action: 'quota' });
        const fmt = (used, lim) => lim >= 9999 ? 'Unlimited (Admin)' : (lim <= 0 ? 'Terkunci' : `${Math.max(0, lim - used)}/${lim} tersisa`);
        if (qExp) qExp.textContent = fmt(res.used.explain, res.limits.explain);
        if (qWeak) qWeak.textContent = fmt(res.used.weakness, res.limits.weakness);
        if (qNews) qNews.textContent = fmt(res.used.newsSearch, res.limits.newsSearch);
    } catch (e) {
        if (qExp) qExp.textContent = 'Belum aktif';
    }
};

window.jalankanAnalisisKelemahanAI = async () => {
    const outBox = document.getElementById('botWeaknessResult');
    if (!outBox) return;
    const rawList = JSON.parse(localStorage.getItem('menuju_asn_brankas_v1') || '[]');
    if (!rawList.length) {
        outBox.style.display = 'block';
        outBox.innerHTML = 'Belum ada riwayat simulasi di Brankas Pembahasan. Kerjakan minimal 1 latihan/tryout dulu agar MenujuASN-BOT bisa membaca pola kelemahanmu.';
        return;
    }

    const recent = rawList.slice(0, 8);
    const subKatErrors = {};
    const summaryLines = recent.map((att, idx) => {
        (att.items || []).forEach(it => {
            if (!it.isCorrect) {
                const k = `${it.kategori || 'SKD'} (${it.subKategori || 'Umum'})`;
                subKatErrors[k] = (subKatErrors[k] || 0) + 1;
            }
        });
        return `${idx + 1}. ${att.title}: TWK=${att.twkScore || 0}, TIU=${att.tiuScore || 0}, TKP=${att.tkpScore || 0}, Salah=${att.wrongCount || 0}/${att.totalQuestions || 0}`;
    });
    const topWeak = Object.entries(subKatErrors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([k, v]) => `- ${k}: ${v} kali belum maksimal`)
        .join('\n');

    const statsSummary = `Riwayat ${recent.length} latihan terakhir:\n${summaryLines.join('\n')}\n\nTopik paling sering salah/belum maksimal:\n${topWeak || '- Belum terdeteksi'}`;

    outBox.style.display = 'block';
    outBox.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <strong>MenujuASN-BOT</strong> sedang menganalisis kelemahanmu...`;
    try {
        const res = await callMenujuAsnBot({ action: 'weakness', statsSummary });
        outBox.innerHTML = `<div>${formatBotTextHtml(res.reply)}</div>`;
        window.refreshBotAndNewsView();
    } catch (err) {
        outBox.innerHTML = `<span style="color:#b91c1c;"><i class="fas fa-exclamation-circle"></i> ${escapeHtmlMentor(err.message)}</span>`;
    }
};

window.tanyaInfoCpnsBot = async (e) => {
    e.preventDefault();
    const inp = document.getElementById('botNewsQuestion');
    const outBox = document.getElementById('botNewsSearchResult');
    const q = inp ? inp.value.trim() : '';
    if (!q || !outBox) return;

    outBox.style.display = 'block';
    outBox.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <strong>MenujuASN-BOT</strong> sedang mencari informasi terbaru dari Google...`;
    try {
        const res = await callMenujuAsnBot({ action: 'newsSearch', question: q });
        const sourcesHtml = (res.sources || []).length
            ? `<div class="bot-sources-list">${res.sources.map(s => `<a class="bot-source-chip" href="${escapeHtmlMentor(s.uri)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt"></i> ${escapeHtmlMentor(s.title)}</a>`).join('')}</div>`
            : '';
        outBox.innerHTML = `<div>${formatBotTextHtml(res.reply)}</div>${sourcesHtml}`;
        window.refreshBotAndNewsView();
    } catch (err) {
        outBox.innerHTML = `<span style="color:#b91c1c;"><i class="fas fa-exclamation-circle"></i> ${escapeHtmlMentor(err.message)}</span>`;
    }
};

window.loadPusatBerita = async () => {
    const userListEl = document.getElementById('pusatBeritaList');
    const adminListEl = document.getElementById('ccNewsAdminList');
    try {
        const snap = await getDocs(query(collection(db, 'cpns_news'), limit(30)));
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        items.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

        if (userListEl) {
            if (!items.length) {
                userListEl.innerHTML = '<div class="cc-empty">Belum ada berita terbaru dari Admin.</div>';
            } else {
                userListEl.innerHTML = items.map(n => `
                    <div class="news-card">
                        <div>
                            <span class="news-tag">${escapeHtmlMentor(n.tag || 'INFO CPNS')}</span>
                            <h4>${escapeHtmlMentor(n.title || 'Pengumuman CPNS')}</h4>
                            ${n.desc ? `<p>${escapeHtmlMentor(n.desc)}</p>` : ''}
                        </div>
                        <a class="btn-news-open" href="${escapeHtmlMentor(n.url)}" target="_blank" rel="noopener noreferrer">
                            Buka Berita <i class="fas fa-external-link-alt"></i>
                        </a>
                    </div>
                `).join('');
            }
        }

        if (adminListEl) {
            if (!items.length) {
                adminListEl.innerHTML = '<div class="cc-empty">Belum ada link berita yang dipublikasikan.</div>';
            } else {
                adminListEl.innerHTML = items.map(n => `
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 12px; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:8px; background:#f8fafc;">
                        <div style="min-width:0;">
                            <div style="font-weight:700; font-size:0.84rem; color:#0f172a;">[${escapeHtmlMentor(n.tag || 'INFO')}] ${escapeHtmlMentor(n.title)}</div>
                            <div style="font-size:0.75rem; color:#2563eb; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtmlMentor(n.url)}</div>
                        </div>
                        <button class="cc-btn danger" onclick="window.adminHapusBerita('${n.id}')">Hapus</button>
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        if (userListEl) userListEl.innerHTML = `<div class="cc-empty">Gagal memuat berita: ${escapeHtmlMentor(err.message)}</div>`;
    }
};

window.adminTambahBerita = async () => {
    if (!window.currentUserProfile?.isAdmin) return;
    const title = document.getElementById('ccNewsTitle')?.value.trim();
    const url = document.getElementById('ccNewsUrl')?.value.trim();
    const tag = document.getElementById('ccNewsTag')?.value.trim() || 'BKN';
    const desc = document.getElementById('ccNewsDesc')?.value.trim() || '';

    if (!title || !url || !/^https?:\/\//i.test(url)) {
        return Swal.fire('Data Belum Lengkap', 'Isi Judul Berita dan URL valid yang diawali https:// atau http://', 'warning');
    }

    try {
        await addDoc(collection(db, 'cpns_news'), {
            title,
            url,
            tag,
            desc,
            createdAtMs: Date.now(),
            authorEmail: window.currentUser?.email || ''
        });
        document.getElementById('ccNewsTitle').value = '';
        document.getElementById('ccNewsUrl').value = '';
        document.getElementById('ccNewsDesc').value = '';
        Swal.fire({ icon: 'success', title: 'Berita Dipublikasikan!', timer: 1500, showConfirmButton: false });
        window.loadPusatBerita();
    } catch (err) {
        Swal.fire('Gagal', err.message, 'error');
    }
};

window.adminHapusBerita = async (docId) => {
    if (!window.currentUserProfile?.isAdmin) return;
    try {
        await deleteDoc(doc(db, 'cpns_news', docId));
        window.loadPusatBerita();
    } catch (err) {
        Swal.fire('Gagal Menghapus', err.message, 'error');
    }
};

window.adminSimpanBotApiKey = async () => {
    if (!window.currentUserProfile?.isAdmin) return;
    const apiKey = document.getElementById('ccBotApiKeyInput')?.value.trim();
    if (!apiKey || !apiKey.startsWith('AIza')) {
        return Swal.fire('Format Key Tidak Valid', 'Masukkan Gemini API Key yang diawali AIza...', 'warning');
    }
    try {
        await setDoc(doc(db, 'cpns_settings', 'ai_config'), {
            apiKey,
            updatedAtMs: Date.now(),
            updatedBy: window.currentUser?.email || ''
        }, { merge: true });
        document.getElementById('ccBotApiKeyInput').value = '';
        Swal.fire({ icon: 'success', title: 'API Key MenujuASN-BOT Disimpan!', text: 'Tersimpan aman di server Firestore (tidak terlihat peserta).', timer: 2000, showConfirmButton: false });
    } catch (err) {
        Swal.fire('Gagal Menyimpan', err.message, 'error');
    }
};
