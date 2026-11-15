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
    } else if (viewName === 'beranda') {
        if (typeof window.renderSavedExamsOnBeranda === 'function') window.renderSavedExamsOnBeranda();
        if (typeof window.renderBerandaProgressPanel === 'function') window.renderBerandaProgressPanel();
    } else if (viewName === 'brankas' && typeof window.renderBrankasPembahasan === 'function') {
        window.renderBrankasPembahasan();
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
        window.currentQuestions = rawData.filter(q => q.kategori === 'TWK');
        window.examTimeRemaining = window.currentQuestions.length * 60;
        title = 'Paket Soal TWK';
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
                <div id="instantPembahasanBox" style="display:none; margin-top:16px;"></div>
                
                <div class="exam-nav">
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
            </aside>
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
            out.push(line);
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
        const showInstant = Boolean(window.isInstantReviewMode && currentAns);
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
                    headerTitle: 'Pembahasan Mentor (1x Klik)',
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

    if (window.currentPackageMeta?.saveId && typeof window.removeSavedExamById === 'function') {
        window.removeSavedExamById(window.currentPackageMeta.saveId);
    }

    if (window.currentAppMode === 'multiplayer') {
        await syncCheckpointToFirestore(null, true);
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
        mode: window.currentAppMode === 'multiplayer' ? 'CBT Mabar' : 'CAT Mandiri',
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

    const examStage = document.getElementById('examStage');
    if (examStage) {
        examStage.style.display = 'block';
        examStage.innerHTML = `
            <div class="result-shell">
                <div class="result-top-banner">
                    <div>
                        <span class="result-eyebrow"><i class="fas fa-award"></i> LAPORAN HASIL EVALUASI CAT • MENUJU ASN</span>
                        <h2>Hasil Simulasi SKD ASN</h2>
                        <div class="result-meta-chips">
                            <span><i class="fas fa-list-ol"></i> ${qs.length} Soal</span>
                            <span><i class="fas fa-stopwatch"></i> Waktu: ${durasiText}</span>
                            <span><i class="fas fa-gamepad"></i> ${window.currentAppMode === 'multiplayer' ? 'CBT Mabar' : 'CAT Mandiri'}</span>
                        </div>
                    </div>
                    <button class="btn-dash-ghost" onclick="window.kembaliKeLobby()">
                        <i class="fas fa-arrow-left"></i> Kembali ke Dashboard
                    </button>
                </div>

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
                            <button class="btn-card primary" onclick="window.kembaliKeLobby(); window.switchAppView('brankas');">
                                <i class="fas fa-vault"></i> Buka Brankas Pembahasan
                            </button>
                            ${window.currentAppMode === 'multiplayer' ? `
                                <button class="btn-card accent" onclick="window.bukaModalKlasemenMabar()">
                                    <i class="fas fa-trophy"></i> Klasemen Live Mabar
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

window.hapusRiwayatBrankas = (attemptId) => {
    const filtered = getBrankasHistory().filter(item => item.id !== attemptId);
    setBrankasHistory(filtered);
    if (window.selectedBrankasAttemptId === attemptId) {
        window.selectedBrankasAttemptId = filtered[0]?.id || null;
    }
    window.renderBrankasPembahasan();
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
    const statAccess = document.getElementById('brankasStatAccess');
    if (statTotal) statTotal.textContent = `${history.length} Paket`;
    if (statLast) statLast.textContent = history[0] ? `${history[0].totalSkor} / ${history[0].maxSkor}` : '-';
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
                    <p style="font-size:0.93rem; color:#0f172a; line-height:1.6; margin:0 0 12px; white-space:pre-line;">${it.soal}</p>
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

    // HALAMAN UTAMA BRANKAS: FILTER PER HARI + KARTU RINGKAS
    const toDayKey = (ts) => {
        const d = new Date(ts || Date.now());
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const todayKey = toDayKey(Date.now());
    const dateFilter = window.brankasDateFilter || 'all';

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
        if (dateFilter === 'today') return key === todayKey;
        if (dateFilter === '7d') return (Date.now() - (item.finishedAt || 0)) <= (7 * 24 * 60 * 60 * 1000);
        if (dateFilter !== 'all') return key === dateFilter;
        return true;
    });

    const dayOptionsHtml = uniqueDays.map(d =>
        `<option value="${d.key}" ${dateFilter === d.key ? 'selected' : ''}>${d.label}${d.key === todayKey ? ' (Hari Ini)' : ''}</option>`
    ).join('');

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
        <div class="lobby-filter-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
            <div class="filter-chips" style="margin:0;">
                <button class="filter-chip ${dateFilter === 'all' ? 'active' : ''}" onclick="window.setBrankasDateFilter('all')">Semua Hari (${history.length})</button>
                <button class="filter-chip ${dateFilter === 'today' ? 'active' : ''}" onclick="window.setBrankasDateFilter('today')">Hari Ini</button>
                <button class="filter-chip ${dateFilter === '7d' ? 'active' : ''}" onclick="window.setBrankasDateFilter('7d')">7 Hari Terakhir</button>
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
            : `<div class="empty-state-card"><p>Tidak ada riwayat simulasi pada tanggal/rentang hari ini.</p></div>`
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
        <option value="twk">TWK (Tes Wawasan Kebangsaan)</option>
    `;
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
        const qs = rawData.filter(q => q.kategori === 'TWK');
        return { questions: qs, durationSec: qs.length * 60, label: 'TWK (Tes Wawasan Kebangsaan)' };
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
        const maxPlayers = dataRoom.maxPlayers || 2;

        if (!alreadyJoined && dataRoom.status !== 'waiting') {
            return Swal.fire('Room Sudah Dimulai / Ditutup', 'Ujian di room ini sudah berjalan sehingga peserta baru tidak dapat masuk.', 'warning');
        }

        // Validasi Batas Kapasitas Room (Terkunci otomatis saat penuh untuk siapapun)
        if (!alreadyJoined && Object.keys(existingPlayers).length >= maxPlayers) {
            return Swal.fire('Room Penuh & Terkunci!', `Kapasitas maksimal paket ${(dataRoom.tier || 'bronze').toUpperCase()} (${maxPlayers} peserta) sudah penuh.`, 'warning');
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
        const players = data.players || {};
        const playerCount = Object.keys(players).length;
        const maxPlayers = data.maxPlayers || 2;
        const isFull = playerCount >= maxPlayers;
        const isHost = data.hostUid === window.currentUser?.uid;

        // Jika Host sudah klik MULAI ARENA, otomatis masuk ke ujian dengan paket soal yang dipilih
        if (data.status === 'ujian' && !hasStartedExamClient) {
            hasStartedExamClient = true;
            window.currentAppMode = 'multiplayer';
            const paketInfo = getQuestionsForRoomPaket(data.paketKey || 'full');
            window.currentQuestions = paketInfo.questions;
            window.examTimeRemaining = paketInfo.durationSec;
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
                <div style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
                    <button onclick="navigator.clipboard.writeText('${linkInvite}'); Swal.fire('Link Disalin!', 'Kirim link ini ke teman untuk bergabung ke CBT Arena.', 'success');" style="background:#2563eb; color:white; border:none; padding:8px 16px; border-radius:20px; font-weight:700; font-size:0.8rem; cursor:pointer;">
                        <i class="fas fa-link"></i> Salin Link Room
                    </button>
                </div>

                ${inviteBoxHtml}
                
                <div style="text-align:left; font-weight:800; font-size:0.9rem; color:#1e293b; margin-bottom:12px; display:flex; justify-content:space-between;">
                    <span>Peserta Terhubung (${playerCount} / ${maxPlayers})</span>
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

// ==========================================================
// 11. PEMBAHASAN MENTOR INTERAKTIF (TANPA VIDEO) & LAPOR SOAL
// ==========================================================
function escapeHtmlMentor(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
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

    // 3. Visualisasi Diagram Venn Mini SVG & Alur Logika Silogisme
    if (sub.includes('silogisme') || sub.includes('logis')) {
        const lowerSoal = String(q.soal || '').toLowerCase();
        const isSebagian = lowerSoal.includes('sebagian') || lowerSoal.includes('beberapa');
        const vennSvg = isSebagian
            ? `
                <svg viewBox="0 0 210 78" style="width:185px; height:68px; flex-shrink:0;">
                    <circle cx="78" cy="39" r="28" fill="rgba(37,99,235,0.14)" stroke="#2563eb" stroke-width="1.8"/>
                    <circle cx="122" cy="39" r="28" fill="rgba(22,163,74,0.14)" stroke="#16a34a" stroke-width="1.8"/>
                    <text x="64" y="42" text-anchor="middle" font-size="10" font-weight="800" fill="#1e40af">A</text>
                    <text x="100" y="42" text-anchor="middle" font-size="9.5" font-weight="800" fill="#0f172a">A∩B</text>
                    <text x="136" y="42" text-anchor="middle" font-size="10" font-weight="800" fill="#166534">B</text>
                </svg>`
            : `
                <svg viewBox="0 0 210 78" style="width:185px; height:68px; flex-shrink:0;">
                    <circle cx="105" cy="39" r="33" fill="rgba(22,163,74,0.12)" stroke="#16a34a" stroke-width="1.8"/>
                    <circle cx="105" cy="43" r="21" fill="rgba(37,99,235,0.16)" stroke="#2563eb" stroke-width="1.8"/>
                    <text x="105" y="19" text-anchor="middle" font-size="9.5" font-weight="800" fill="#166534">Semua B (Himpunan Besar)</text>
                    <text x="105" y="47" text-anchor="middle" font-size="10" font-weight="800" fill="#1e40af">Semua A</text>
                </svg>`;
        return `
            <div style="background:#ffffff; border:1px solid #dbeafe; border-radius:8px; padding:10px 12px; margin-bottom:10px;">
                <div style="font-size:0.74rem; font-weight:800; color:#1d4ed8; margin-bottom:6px;"><i class="fas fa-sitemap"></i> Diagram Venn & Alur Logika Silogisme</div>
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    ${vennSvg}
                    <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap; font-size:0.75rem; font-weight:700; flex:1; min-width:200px;">
                        <span style="background:#eff6ff; color:#1e40af; padding:4px 8px; border-radius:6px;">Premis 1</span>
                        <span style="color:#64748b;">➔</span>
                        <span style="background:#fef3c7; color:#92400e; padding:4px 8px; border-radius:6px;">Premis 2 (${isSebagian ? 'Irisan' : 'Sub-himpunan'})</span>
                        <span style="color:#64748b;">➔</span>
                        <span style="background:#dcfce7; color:#166534; padding:4px 8px; border-radius:6px;">Simpulan Pasti</span>
                    </div>
                </div>
            </div>
        `;
    }

    // 4. Visualisasi Panduan Transformasi Figural (Rotasi / Cermin / Elemen)
    if (sub.includes('figural')) {
        const isKetidaksamaan = sub.includes('ketidaksamaan');
        return `
            <div style="background:#ffffff; border:1px solid #e0e7ff; border-radius:8px; padding:10px 12px; margin-bottom:10px;">
                <div style="font-size:0.74rem; font-weight:800; color:#4338ca; margin-bottom:6px;"><i class="fas fa-shapes"></i> Panduan Visual Pola Figural</div>
                <div style="display:flex; align-items:center; gap:7px; flex-wrap:wrap; font-size:0.74rem; font-weight:700;">
                    <span style="background:#eef2ff; color:#3730a3; padding:4px 9px; border-radius:6px;">↻ Rotasi (90° / 180°)</span>
                    <span style="background:#ecfeff; color:#0e7490; padding:4px 9px; border-radius:6px;">↔ Cermin / Refleksi</span>
                    <span style="background:#fef3c7; color:#92400e; padding:4px 9px; border-radius:6px;">${isKetidaksamaan ? '≠ Cari 1 Fitur Berbeda' : '+ / − Jumlah Sisi & Titik'}</span>
                </div>
            </div>
        `;
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
    } else if (sub.includes('sinonim') || sub.includes('antonim') || sub.includes('analogi') || kat === 'TIU') {
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

    // Pecah pembahasan menjadi langkah-langkah logis (max 3-4 langkah ala Papan Tulis)
    let parts = rawText
        .split(/(?:\n+|(?<=[.!?])\s+(?=[A-Z0-9(]))/)
        .map(s => s.trim())
        .filter(Boolean);
    if (parts.length === 0) parts = [rawText];
    if (parts.length > 4) {
        parts = [parts[0], parts[1], parts.slice(2).join(' ')];
    }

    const bestOpt = (q.opsi || []).find(o => o.benar) ||
        (q.opsi || []).reduce((best, cur) => (Number(cur.poin || 0) > Number(best?.poin || -1) ? cur : best), null);
    const kunciLabel = q.kunci || bestOpt?.label || '-';

    const getStepTitle = (idx, total) => {
        if (total === 1) return 'Inti Pembahasan & Kunci';
        if (idx === 0) return 'Tangkap Kata Kunci / Diketahui';
        if (idx === total - 1) return 'Kesimpulan & Kunci Jawaban';
        return 'Proses / Rumus / Logika';
    };

    const stepsHtml = parts.map((stepTxt, idx) => `
        <div class="mentor-step-item" data-step-idx="${idx}" style="${idx === 0 ? '' : 'display:none;'} background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:9px 11px; margin-bottom:6px; font-size:0.83rem; color:#1e293b; line-height:1.55;">
            <span style="display:inline-block; font-size:0.7rem; font-weight:800; color:#1d4ed8; background:#eff6ff; padding:2px 8px; border-radius:999px; margin-right:6px;">Langkah ${idx + 1} • ${getStepTitle(idx, parts.length)}</span>
            ${escapeHtmlMentor(stepTxt)}
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
    const speechText = escapeHtmlMentor(`${rawText}. Trik cepat: ${trik} Kunci jawaban terbaik adalah opsi ${kunciLabel}.`);

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
            <span>${escapeHtmlMentor(o.teks)}</span>
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
                <div style="font-size:0.9rem; color:#0f172a; line-height:1.55; white-space:pre-line; margin-bottom:12px; background:#f8fafc; padding:10px 12px; border-radius:8px; border:1px solid #e2e8f0;">${escapeHtmlMentor(q.soal)}</div>
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
                    fb.innerHTML = `<strong>${isBenar ? '✅ Mantap! Jawabanmu Benar!' : `❌ Kurang Tepat (Kunci: ${escapeHtmlMentor(q.kunci)})`}</strong><br>${escapeHtmlMentor(q.pembahasan)}`;
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
