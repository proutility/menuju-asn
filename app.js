// ==========================================================
// MENUJU ASN - CBT SKD CPNS 2026 MAIN CONTROLLER
// PWA & Hybrid Hemat-Database Multiplayer Engine (BKN Standard)
// ==========================================================
import { 
    auth, provider, db, ADMIN_EMAILS, COLLECTIONS,
    signInWithPopup, signOut, onAuthStateChanged,
    collection, addDoc, getDocs, deleteDoc, query, where, limit,
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
    const isAdminEmail = ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email);
    let localBio = {};
    try {
        localBio = JSON.parse(localStorage.getItem(`menuju_asn_user_bio_${user.uid}`) || '{}') || {};
    } catch (_) {}

    try {
        const uSnap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
        if (uSnap.exists()) {
            const d = uSnap.data();
            window.currentUserProfile = {
                tier: isAdminEmail ? 'admin' : (d.tier || 'free'),
                isPaid: isAdminEmail ? true : (d.isPaid === true),
                isAdmin: isAdminEmail,
                nama: d.nama || localBio.nama || user.displayName || 'Pejuang ASN',
                tanggalLahir: d.tanggalLahir || localBio.tanggalLahir || '',
                tujuanInstansi: d.tujuanInstansi || localBio.tujuanInstansi || '',
                tujuanJabatan: d.tujuanJabatan || localBio.tujuanJabatan || ''
            };
        } else {
            if (!isAdminEmail) {
                await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
                    uid: user.uid,
                    email: email,
                    nama: user.displayName || 'Pejuang ASN',
                    tier: 'free',
                    isPaid: false,
                    createdAt: Date.now()
                }, { merge: true }).catch(() => {});
            }
            window.currentUserProfile = {
                tier: isAdminEmail ? 'admin' : 'free',
                isPaid: isAdminEmail,
                isAdmin: isAdminEmail,
                nama: localBio.nama || user.displayName || 'Pejuang ASN',
                tanggalLahir: localBio.tanggalLahir || '',
                tujuanInstansi: localBio.tujuanInstansi || '',
                tujuanJabatan: localBio.tujuanJabatan || ''
            };
        }
    } catch (e) {
        console.warn("Gagal load profil user:", e);
        window.currentUserProfile = {
            tier: isAdminEmail ? 'admin' : 'free',
            isPaid: isAdminEmail,
            isAdmin: isAdminEmail,
            nama: localBio.nama || user.displayName || 'Pejuang ASN',
            tanggalLahir: localBio.tanggalLahir || '',
            tujuanInstansi: localBio.tujuanInstansi || '',
            tujuanJabatan: localBio.tujuanJabatan || ''
        };
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
        const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
        const customName = (prof.nama || user.displayName || 'Pejuang ASN').trim();
        const firstName = customName.split(' ')[0] || 'Pejuang ASN';
        const tierText = prof.isAdmin ? 'ADMIN' : String(prof.tier || 'free').toUpperCase();

        if (btnAuth) btnAuth.style.display = 'none';
        if (userProfileEl) {
            const tierStyleMap = {
                ADMIN: 'background:linear-gradient(135deg,#fde047 0%,#f59e0b 100%); color:#0f172a; border:1px solid #fbbf24;',
                GOLD: 'background:linear-gradient(135deg,#fef08a 0%,#eab308 100%); color:#713f12; border:1px solid #facc15;',
                SILVER: 'background:linear-gradient(135deg,#f1f5f9 0%,#cbd5e1 100%); color:#0f172a; border:1px solid #e2e8f0;',
                BRONZE: 'background:linear-gradient(135deg,#cd7f32 0%,#8c4a16 100%); color:#ffffff; border:1px solid #d99b66;',
                SATUAN: 'background:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%); color:#ffffff; border:1px solid #60a5fa;',
                FREE: 'background:rgba(255,255,255,0.18); color:#cbd5e1;'
            };
            const badgeStyle = tierStyleMap[tierText] || (prof.isPaid ? tierStyleMap.BRONZE : tierStyleMap.FREE);
            const tierBadge = `<span style="${badgeStyle} font-size:0.64rem; font-weight:800; padding:2px 8px; border-radius:999px; letter-spacing:0.3px;">${tierText}</span>`;

            userProfileEl.style.display = 'flex';
            userProfileEl.innerHTML = `
                <button type="button" class="nav-profile-chip" onclick="window.bukaModalProfilPeserta()" title="Profil Akun">
                    <img class="nav-profile-avatar" src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(customName)}" alt="Avatar" />
                    <div class="nav-profile-info">
                        <div class="nav-profile-top">
                            <span class="nav-profile-name">${firstName}</span>
                            ${tierBadge}
                        </div>
                    </div>
                </button>
                <button type="button" class="btn-logout-modern" onclick="window.eksekusiLogout()" title="Keluar dari Akun">
                    <i class="fas fa-power-off"></i>
                    <span>Keluar</span>
                </button>
            `;
        }
        const footerTopInfo = document.getElementById('asnFooterTopInfo');
        if (footerTopInfo) footerTopInfo.style.display = 'none';
        if (dashUserName) dashUserName.textContent = customName;
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
        if (typeof window.renderTryoutPaketCards === 'function') {
            window.renderTryoutPaketCards();
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
        const footerTopInfo = document.getElementById('asnFooterTopInfo');
        if (footerTopInfo) footerTopInfo.style.display = '';
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

window.bukaModalProfilPeserta = async () => {
    const user = window.currentUser;
    if (!user) return;
    const prof = window.currentUserProfile || {};
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const { value: formValues } = await Swal.fire({
        title: '👤 Profil & Target Formasi ASN',
        html: `
            <div style="text-align:left; font-size:0.84rem; color:#334155;">
                <p style="margin:0 0 12px; font-size:0.78rem; color:#64748b;">
                    Lengkapi data singkat &amp; target formasi impianmu agar progres latihan dan evaluasi MenujuASN-Bot makin relevan.
                </p>
                <div style="margin-bottom:10px;">
                    <label style="display:block; font-weight:700; margin-bottom:4px; color:#0f172a;">Nama Lengkap / Panggilan</label>
                    <input id="swalProfNama" type="text" value="${esc(prof.nama || user.displayName || '')}" placeholder="Contoh: Budi Santoso" style="width:100%; padding:9px 11px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.85rem; box-sizing:border-box;" />
                </div>
                <div style="margin-bottom:10px;">
                    <label style="display:block; font-weight:700; margin-bottom:4px; color:#0f172a;">Tanggal Lahir</label>
                    <input id="swalProfTglLahir" type="date" value="${esc(prof.tanggalLahir || '')}" style="width:100%; padding:9px 11px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.85rem; box-sizing:border-box;" />
                </div>
                <div style="margin-bottom:10px;">
                    <label style="display:block; font-weight:700; margin-bottom:4px; color:#0f172a;">Tujuan Instansi yang Dilamar</label>
                    <input id="swalProfInstansi" type="text" value="${esc(prof.tujuanInstansi || '')}" placeholder="Contoh: Kementerian Keuangan / Kejaksaan RI / Pemprov" style="width:100%; padding:9px 11px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.85rem; box-sizing:border-box;" />
                </div>
                <div style="margin-bottom:4px;">
                    <label style="display:block; font-weight:700; margin-bottom:4px; color:#0f172a;">Jabatan / Formasi yang Dilamar</label>
                    <input id="swalProfJabatan" type="text" value="${esc(prof.tujuanJabatan || '')}" placeholder="Contoh: Auditor Ahli Pertama / Analis Hukum" style="width:100%; padding:9px 11px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.85rem; box-sizing:border-box;" />
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan Profil',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#1e3a8a',
        preConfirm: () => ({
            nama: (document.getElementById('swalProfNama')?.value || '').trim() || user.displayName || 'Pejuang ASN',
            tanggalLahir: (document.getElementById('swalProfTglLahir')?.value || '').trim(),
            tujuanInstansi: (document.getElementById('swalProfInstansi')?.value || '').trim(),
            tujuanJabatan: (document.getElementById('swalProfJabatan')?.value || '').trim()
        })
    });

    if (!formValues) return;

    window.currentUserProfile = {
        ...(window.currentUserProfile || {}),
        ...formValues
    };
    try {
        localStorage.setItem(`menuju_asn_user_bio_${user.uid}`, JSON.stringify(formValues));
    } catch (_) {}
    try {
        await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
            ...formValues,
            updatedAt: Date.now()
        }, { merge: true });
    } catch (_) {}

    updateAuthUI(user);
    Swal.fire({
        icon: 'success',
        title: 'Profil Tersimpan!',
        text: 'Data diri & target formasi berhasil diperbarui.',
        timer: 1400,
        showConfirmButton: false
    });
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

    if (typeof window.applySidebarCollapse === 'function') {
        if (viewName === 'persiapan') {
            window.applySidebarCollapse(true);
        } else {
            let userPref = false;
            try { userPref = localStorage.getItem('menuju_asn_sidebar_collapsed') === '1'; } catch (_) {}
            window.applySidebarCollapse(userPref);
        }
    }

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
    } else if (viewName === 'studi') {
        if (typeof window.syncPusatStudiButtons === 'function') window.syncPusatStudiButtons();
    } else if (viewName === 'diskusi') {
        if (typeof window.loadRiwayatPengaduanSaya === 'function') window.loadRiwayatPengaduanSaya();
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
    if (tabName === 'banksoal' && typeof window.initAdminBankSoal === 'function') {
        window.initAdminBankSoal();
    }
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
                                ${rep.soalId ? `<button class="cc-btn primary" onclick="window.bukaSoalDiAdminEditor('${rep.soalId}')"><i class="fas fa-edit"></i> Review &amp; Edit (${rep.soalId})</button>` : ''}
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
        if (typeof window.initAdminBankSoal === 'function') {
            window.initAdminBankSoal();
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

    const allUsers = window.ccCachedUsers || [];

    // Sajikan ringkasan sebaran Target Instansi & Jabatan peserta di Command Center
    const summaryBox = document.getElementById('ccInstansiSummaryBox');
    if (summaryBox) {
        const instansiCounts = {};
        let filledCount = 0;
        allUsers.forEach(u => {
            const inst = String(u.tujuanInstansi || '').trim();
            if (inst) {
                filledCount++;
                instansiCounts[inst] = (instansiCounts[inst] || 0) + 1;
            }
        });
        const topInstansi = Object.entries(instansiCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        const chipsHtml = topInstansi.length
            ? topInstansi.map(([instName, cnt]) => `
                <button type="button" onclick="const inp=document.getElementById('ccSearchUser'); if(inp){inp.value='${instName.replace(/'/g, "\\'")}'; window.filterCommandUsers();}"
                    style="display:inline-flex; align-items:center; gap:6px; background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; padding:5px 11px; border-radius:999px; font-size:0.76rem; font-weight:700; cursor:pointer;">
                    <i class="fas fa-building"></i> ${instName}
                    <span style="background:#1d4ed8; color:#fff; padding:1px 7px; border-radius:999px; font-size:0.68rem;">${cnt}</span>
                </button>
            `).join('')
            : '<span style="font-size:0.78rem; color:#64748b;">Belum ada peserta yang mengisi target instansi (peserta dapat mengisi dengan klik profil di kanan atas).</span>';

        summaryBox.innerHTML = `
            <div style="background:linear-gradient(165deg, #ffffff 0%, #f4f8ff 100%); border:1px solid #dbeafe; border-radius:14px; padding:14px 16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                    <strong style="font-size:0.86rem; color:#1e3a8a;"><i class="fas fa-chart-pie"></i> Data Sebaran Target Instansi &amp; Formasi Peserta</strong>
                    <span style="font-size:0.75rem; font-weight:700; color:#475569; background:#e0f2fe; padding:3px 10px; border-radius:999px;">
                        ${filledCount} dari ${allUsers.length} Peserta Sudah Mengisi Target
                    </span>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:7px;">
                    ${chipsHtml}
                </div>
            </div>
        `;
    }

    const filtered = allUsers.filter(u => {
        const matchText =
            (u.nama || '').toLowerCase().includes(qText) ||
            (u.email || '').toLowerCase().includes(qText) ||
            (u.tujuanInstansi || '').toLowerCase().includes(qText) ||
            (u.tujuanJabatan || '').toLowerCase().includes(qText);
        const userTier = (u.tier || 'free').toLowerCase();
        const matchTier = qTier === 'all' || userTier === qTier;
        return matchText && matchTier;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="cc-empty">Tidak ada peserta yang cocok dengan filter.</td></tr>';
        return;
    }

    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    tbody.innerHTML = filtered.map(u => {
        const tier = (u.tier || 'free').toLowerCase();
        const blocked = !!u.isBlocked;
        const instansi = (u.tujuanInstansi || '').trim();
        const jabatan = (u.tujuanJabatan || '').trim();
        const tglLahir = (u.tanggalLahir || '').trim();
        const instansiCellHtml = (instansi || jabatan || tglLahir)
            ? `
                ${instansi ? `<div style="font-weight:800; color:#1e3a8a; font-size:0.82rem;"><i class="fas fa-landmark" style="color:#2563eb;"></i> ${esc(instansi)}</div>` : ''}
                ${jabatan ? `<div style="font-size:0.76rem; color:#334155; font-weight:600;">🎯 ${esc(jabatan)}</div>` : ''}
                ${tglLahir ? `<div style="font-size:0.71rem; color:#64748b;"><i class="far fa-calendar-alt"></i> Lahir: ${esc(tglLahir)}</div>` : ''}
            `
            : `<span style="color:#94a3b8; font-size:0.76rem; font-style:italic;">Belum diisi</span>`;

        return `
            <tr>
                <td>
                    <strong>${esc(u.nama || 'Pejuang ASN')}</strong><br>
                    <small style="color:#64748b;">${esc(u.email || '-')}</small>
                </td>
                <td>${instansiCellHtml}</td>
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

window.kirimPengaduanPeserta = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!window.currentUser) {
        return Swal.fire('Perlu Login', 'Silakan login dengan akun Google terlebih dahulu untuk mengirim pengaduan.', 'info');
    }

    const kat = (document.getElementById('pengaduanKategoriSelect')?.value || 'Informasi Umum & Saran').trim();
    const subjek = (document.getElementById('pengaduanSubjekInput')?.value || '').trim();
    const pesan = (document.getElementById('pengaduanPesanInput')?.value || '').trim();

    if (!pesan) {
        return Swal.fire('Data Belum Lengkap', 'Mohon tuliskan detail pengaduan atau pertanyaan Anda.', 'warning');
    }

    const btn = document.getElementById('btnKirimPengaduan');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';
    }

    try {
        const judul = subjek ? `[${kat}] ${subjek}` : `[${kat}]`;
        await addDoc(collection(db, 'laporan_soal'), {
            uid_pelapor: window.currentUser.uid,
            email: window.currentUser.email || '',
            nama_pelapor: window.currentUserProfile?.nama || window.currentUser.displayName || 'Pejuang ASN',
            kategori: kat,
            judul,
            pesan,
            status: 'pending',
            createdAt: Date.now()
        });
        const subjInp = document.getElementById('pengaduanSubjekInput');
        const msgInp = document.getElementById('pengaduanPesanInput');
        if (subjInp) subjInp.value = '';
        if (msgInp) msgInp.value = '';
        Swal.fire({
            icon: 'success',
            title: 'Pengaduan Terkirim!',
            text: 'Laporan Anda sudah masuk ke Command Center Admin dan akan segera ditindaklanjuti.',
            timer: 1900,
            showConfirmButton: false
        });
        window.loadRiwayatPengaduanSaya();
    } catch (err) {
        console.error('Gagal mengirim pengaduan:', err);
        Swal.fire('Gagal Mengirim', err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim ke Admin';
        }
    }
};

window.loadRiwayatPengaduanSaya = async () => {
    const box = document.getElementById('riwayatPengaduanSayaBox');
    if (!box) return;
    if (!window.currentUser) {
        box.innerHTML = '<div class="cc-empty">Silakan login untuk melihat riwayat pengaduan Anda.</div>';
        return;
    }

    box.innerHTML = '<div class="cc-empty"><i class="fas fa-spinner fa-spin"></i> Memuat riwayat pengaduan...</div>';
    try {
        const qSnap = await getDocs(query(collection(db, 'laporan_soal'), where('uid_pelapor', '==', window.currentUser.uid), limit(25)));
        const list = [];
        qSnap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

        if (!list.length) {
            box.innerHTML = '<div class="cc-empty">Belum ada pengaduan yang Anda kirimkan.</div>';
            return;
        }

        const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        box.innerHTML = list.map(rep => {
            const st = String(rep.status || 'pending').toLowerCase();
            const isDone = st === 'selesai';
            const tgl = rep.createdAt ? new Date(rep.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
            return `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px;">
                        <strong style="font-size:0.81rem; color:#0f172a;">${esc(rep.judul || 'Pengaduan Peserta')}</strong>
                        <span style="font-size:0.68rem; font-weight:800; padding:2px 8px; border-radius:999px; ${isDone ? 'background:#dcfce7;color:#15803d;' : 'background:#fef3c7;color:#b45309;'}">${isDone ? 'SELESAI' : 'PROSES'}</span>
                    </div>
                    <p style="margin:0 0 4px; font-size:0.78rem; color:#475569; white-space:pre-line;">${esc(rep.pesan || '-')}</p>
                    <small style="font-size:0.7rem; color:#94a3b8;">Dikirim: ${tgl}</small>
                </div>
            `;
        }).join('');
    } catch (err) {
        box.innerHTML = `<div class="cc-empty" style="color:#b91c1c;">Gagal memuat riwayat: ${err.message}</div>`;
    }
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

function hasSubtesPaketAccess(prof, subtes, paketNo) {
    if (!prof) return false;
    if (prof.isAdmin) return true;
    if (!prof.isPaid) return false;
    const t = String(prof.tier || 'free').toLowerCase();
    if (t === 'gold' || t === 'admin') return true;
    if (t === 'silver') return paketNo <= 45;
    if (t === 'bronze') return paketNo <= 17;
    if (t === 'satuan') return paketNo <= 5;
    return true;
}

function getSubtesTierMeta(paketNo) {
    if (paketNo > 45) return { key: 'gold', label: 'Gold', badgeCls: 'tier-gold', btnCls: 'tier-btn-gold' };
    if (paketNo > 17) return { key: 'silver', label: 'Silver', badgeCls: 'tier-silver', btnCls: 'tier-btn-silver' };
    return { key: 'bronze', label: 'Bronze', badgeCls: 'tier-bronze', btnCls: 'tier-btn-bronze' };
}

function getLockedSubtesLabel(subtesUpper, paketNo) {
    return getSubtesTierMeta(paketNo).label;
}

function hasTryoutPaketAccess(prof, toNo) {
    if (Number(toNo) === 0) return true;
    if (!prof) return false;
    if (prof.isAdmin) return true;
    if (!prof.isPaid) return false;
    const t = String(prof.tier || 'free').toLowerCase();
    if (t === 'gold' || t === 'admin') return true;
    if (t === 'silver') return Number(toNo) <= 3;
    if (t === 'bronze') return Number(toNo) <= 1;
    if (t === 'satuan') return Number(toNo) <= 1;
    return false;
}

window.renderTryoutPaketCards = () => {
    const grid = document.getElementById('tryoutSoalGrid');
    if (!grid) return;

    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    const configs = [
        { no: 0, tierAttr: 'free', badgeLeft: 'GRATIS • SEMUA AKUN', badgeRight: 'TRYOUT GRATIS', icon: 'fa-laptop-code', iconColor: 'blue', title: 'Tryout Gratis (Simulasi SKD)', sub: '110 Soal Pilihan • 100 Menit • TWK + TIU + TKP', desc: 'Simulasi Akbar SKD gratis untuk semua akun (30 TWK, 35 TIU, 45 TKP) lengkap dengan evaluasi Passing Grade BKN.', minTierLabel: 'Gratis Semua Akun', buyers: '999+' },
        { no: 1, tierAttr: 'paid', badgeLeft: 'BRONZE • SILVER • GOLD', badgeRight: 'TO AKBAR 1', icon: 'fa-fire', iconColor: 'gold', title: 'TO Akbar #1 — SKD HOTS 2026', sub: '110 Soal • 100 Menit • Standar BKN', desc: 'Tryout Akbar ke-1 dengan kombinasi soal HOTS TWK, TIU, dan TKP berbobot 1–5 + analisis Brankas Pembahasan.', minTierLabel: 'Paket Bronze', buyers: '620+' },
        { no: 2, tierAttr: 'paid', badgeLeft: 'SILVER • GOLD', badgeRight: 'TO AKBAR 2', icon: 'fa-bolt', iconColor: 'gold', title: 'TO Akbar #2 — SKD Prediksi 2026', sub: '110 Soal • 100 Menit • Format FR 2026', desc: 'Tryout Akbar ke-2 mencakup soal penalaran kasuistis, numerik tabel/matriks, serta evaluasi nilai subtes otomatis.', minTierLabel: 'Paket Silver', buyers: '510+' },
        { no: 3, tierAttr: 'paid', badgeLeft: 'SILVER • GOLD', badgeRight: 'TO AKBAR 3', icon: 'fa-award', iconColor: 'gold', title: 'TO Akbar #3 — SKD Intensif 2026', sub: '110 Soal • 100 Menit • Batch FR 2026', desc: 'Tryout Akbar ke-3 dengan tingkat kesulitan HOTS lanjutan, soal Kecukupan Data TIU & studi kasus TKP Anti-Radikalisme.', minTierLabel: 'Paket Silver', buyers: '475+' },
        { no: 4, tierAttr: 'paid', badgeLeft: 'KHUSUS GOLD', badgeRight: 'TO AKBAR 4', icon: 'fa-crown', iconColor: 'gold', title: 'TO Akbar #4 — SKD Sultan All-In', sub: '110 Soal • 100 Menit • Eksklusif Gold', desc: 'Tryout Akbar ke-4 eksklusif Paket Gold dengan komposisi soal Batch 2 FR 2026 (Figural 9 Kotak, Matriks & HOTS).', minTierLabel: 'Paket Gold', buyers: '390+' },
        { no: 5, tierAttr: 'paid', badgeLeft: 'KHUSUS GOLD', badgeRight: 'TO AKBAR 5', icon: 'fa-trophy', iconColor: 'gold', title: 'TO Akbar #5 — Grand Final SKD 2027', sub: '110 Soal • 100 Menit • Eksklusif Gold', desc: 'Tryout Akbar pamungkas ke-5 khusus Gold untuk menguji kesiapan penuh menembus Passing Grade & SKB CASN 2027.', minTierLabel: 'Paket Gold', buyers: '365+' }
    ];

    grid.innerHTML = configs.map(c => {
        const unlocked = hasTryoutPaketAccess(prof, c.no);
        const isFree = c.no === 0;
        const badgeAccessCls = isFree ? 'free' : (c.no >= 4 ? 'gold-badge' : 'paid');
        const cardCls = `card-mode packet-card ${isFree ? 'free' : 'paid'}${c.no >= 4 ? ' gold-border' : ''}`;
        const ctaHtml = unlocked
            ? `<button class="btn-card ${isFree ? 'free-cta' : 'paid-cta'}" onclick="window.mulaiSingleplayer('${isFree ? 'to_gratis' : 'to_akbar'}', ${c.no})"><i class="fas fa-play"></i> Mulai Tryout</button>`
            : `<button class="btn-card paid-cta" onclick="window.bukaModalUpgrade('${c.title}', '${c.minTierLabel}')"><i class="fas fa-lock"></i> ${c.no === 1 ? 'Bronze' : (c.no <= 3 ? 'Silver' : 'Gold')}</button>`;

        return `
            <div class="${cardCls}" data-tier="${c.tierAttr}">
                <div>
                    <div class="packet-badges">
                        <span class="badge-access ${badgeAccessCls}"><i class="fas ${unlocked ? 'fa-unlock' : 'fa-lock'}"></i> ${c.badgeLeft}</span>
                        <span class="badge-cat">${c.badgeRight}</span>
                        <span class="pkg-buyer-pill" style="margin-left:auto;" title="Peserta telah mengerjakan"><i class="fas fa-user-check"></i> ${c.buyers}</span>
                    </div>
                    <div class="card-mode-header">
                        <div class="mode-icon ${c.iconColor}"><i class="fas ${c.icon}"></i></div>
                        <div>
                            <h3>${c.title}</h3>
                            <span style="font-size:0.75rem; color:${isFree ? '#2563eb' : '#b45309'}; font-weight:700;">${c.sub}</span>
                        </div>
                    </div>
                    <p>${c.desc}</p>
                </div>
                ${ctaHtml}
            </div>
        `;
    }).join('');
};

function renderSubtes90PaketCards(subtes) {
    const grid = document.getElementById('paketSoalGrid');
    if (!grid) return;

    const cardClass = `${subtes}-40-card`;
    grid.querySelectorAll(`.${cardClass}`).forEach(el => el.remove());

    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    const fragment = document.createDocumentFragment();
    const upper = subtes.toUpperCase();

    for (let i = 1; i <= 90; i++) {
        const isBatch2 = i > 40;
        const hasAccess = hasSubtesPaketAccess(prof, subtes, i);
        const tierMeta = getSubtesTierMeta(i);
        const card = document.createElement('div');
        card.className = `card-mode packet-card paid ${cardClass}`;
        card.setAttribute('data-tier', 'paid');
        card.setAttribute('data-cat', 'subtes');
        card.setAttribute('data-subtes', subtes);

        const ctaHtml = hasAccess
            ? `<button class="btn-card ${tierMeta.btnCls}" onclick="window.mulaiSingleplayer('${subtes}', ${i})"><i class="fas fa-play"></i> Mulai Latihan</button>`
            : `<button class="btn-card ${tierMeta.btnCls}" onclick="window.bukaModalUpgrade('${upper} Paket #${i}${isBatch2 ? ' (FR 2026)' : ''}', 'Paket ${tierMeta.label}')"><i class="fas fa-lock"></i> ${tierMeta.label}</button>`;

        let iconHtml = '';
        let subLine = '';
        let descHtml = '';
        let frBadge = '';

        if (subtes === 'twk') {
            iconHtml = '<div class="mode-icon blue"><i class="fas fa-landmark"></i></div>';
            subLine = '<span style="font-size:0.75rem; color:#1d4ed8; font-weight:700;">30 Soal • 30 Menit • 5 Pilar TWK</span>';
            descHtml = `Simulasi TWK 30 soal lengkap (Nasionalisme, Integritas, Bela Negara, Pilar Negara, Bahasa Indonesia • Paket ${i} dari 90).`;
            frBadge = isBatch2 ? ' <span style="font-size:0.65rem;background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:999px;vertical-align:middle;">FR 2026</span>' : '';
        } else if (subtes === 'tiu') {
            iconHtml = '<div class="mode-icon gold"><i class="fas fa-brain"></i></div>';
            subLine = `<span style="font-size:0.75rem; color:#b45309; font-weight:700;">35 Soal • 35 Menit • ${isBatch2 ? 'Kecukupan Data &amp; Matriks' : 'Mode Lama &amp; Baru'}</span>`;
            descHtml = isBatch2
                ? `Format TIU SKD FR 2026: Kecukupan Data, Matriks Deret, Tabel Kombinasi, Argumen &amp; Figural 9 Kotak (Paket ${i} dari 90).`
                : `Simulasi TIU 35 soal seimbang (12 Verbal, 16 Numerik, 7 Figural SVG • Paket ${i} dari 90).`;
            frBadge = isBatch2 ? ' <span style="font-size:0.65rem;background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:999px;vertical-align:middle;">FR 2026</span>' : '';
        } else {
            iconHtml = '<div class="mode-icon green"><i class="fas fa-user-check"></i></div>';
            subLine = '<span style="font-size:0.75rem; color:#059669; font-weight:700;">45 Soal • 45 Menit • 6 Topik Seimbang</span>';
            descHtml = `Simulasi TKP 45 soal seimbang semua aspek (Paket ${i} dari 90 • Bank Soal TKP).`;
            frBadge = isBatch2 ? ' <span style="font-size:0.65rem;background:#dcfce7;color:#15803d;padding:2px 6px;border-radius:999px;vertical-align:middle;">FR 2026</span>' : '';
        }

        const buyerCount = subtes === 'twk' ? (135 + ((i * 17) % 240)) : (subtes === 'tiu' ? (160 + ((i * 23) % 280)) : (145 + ((i * 19) % 250)));

        card.innerHTML = `
            <div>
                <div class="packet-badges">
                    <span class="badge-crown-only ${tierMeta.badgeCls}" title="Paket ${tierMeta.label}"><i class="fas fa-crown"></i></span>
                    <span class="badge-cat">${upper} • PAKET ${i}</span>
                    <span class="pkg-buyer-pill" style="margin-left:auto;" title="Peserta telah mengerjakan"><i class="fas fa-user-check"></i> ${buyerCount}+</span>
                </div>
                <div class="card-mode-header">
                    ${iconHtml}
                    <div>
                        <h3>${upper} Paket #${i}${frBadge}</h3>
                        ${subLine}
                    </div>
                </div>
                <p>${descHtml}</p>
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
}

window.renderTwk40PaketCards = () => renderSubtes90PaketCards('twk');
window.renderTiu40PaketCards = () => renderSubtes90PaketCards('tiu');
window.renderTkp40PaketCards = () => renderSubtes90PaketCards('tkp');

document.addEventListener('DOMContentLoaded', () => {
    window.renderTwk40PaketCards();
    window.renderTiu40PaketCards();
    window.renderTkp40PaketCards();
    if (typeof window.renderTryoutPaketCards === 'function') {
        window.renderTryoutPaketCards();
    }
    if (typeof window.initSidebarCollapse === 'function') {
        window.initSidebarCollapse();
    }
    if (typeof window.loadQuestionOverridesFromCloud === 'function') {
        window.loadQuestionOverridesFromCloud();
    }
    if (typeof window.renderPreviewLandingSubtes === 'function') {
        window.renderPreviewLandingSubtes('twk');
    }
    if (typeof window.renderSavedExamsOnBeranda === 'function') {
        window.renderSavedExamsOnBeranda();
    }
});

// ==========================================================
// SIDEBAR MENU UTAMA: MINIMIZE / EXPAND (TERSIMPAN DI BROWSER)
// ==========================================================
window.applySidebarCollapse = (collapsed) => {
    const shell = document.getElementById('lobbySection');
    const btn = document.getElementById('sidebarCollapseBtn');
    if (!shell) return;
    shell.classList.toggle('sidebar-collapsed', Boolean(collapsed));
    if (btn) {
        const label = collapsed ? 'Perlebar Menu' : 'Minimize Menu';
        btn.title = label;
        btn.setAttribute('aria-label', label);
    }
};

window.toggleSidebarCollapse = () => {
    const shell = document.getElementById('lobbySection');
    if (!shell) return;
    const willCollapse = !shell.classList.contains('sidebar-collapsed');
    window.applySidebarCollapse(willCollapse);
    try { localStorage.setItem('menuju_asn_sidebar_collapsed', willCollapse ? '1' : '0'); } catch (_) {}
};

window.initSidebarCollapse = () => {
    // Tooltip nama menu saat mode minimize (hover ikon)
    document.querySelectorAll('#appSidebar .sidebar-item').forEach(item => {
        const labelEl = item.querySelector('span:not(.sidebar-badge)');
        if (labelEl && !item.title) item.title = labelEl.textContent.trim();
    });
    let saved = false;
    try { saved = localStorage.getItem('menuju_asn_sidebar_collapsed') === '1'; } catch (_) {}
    window.applySidebarCollapse(saved);
};

// ==========================================================
// ADMIN COMMAND CENTER: QUALITY CONTROL REVIEW & EDIT SOAL
// ==========================================================
window.adminQuestionOverrides = {};
window.adminQuestionOriginals = {};
window.ccCurrentPaketKey = 'twk_1';
window.ccCurrentPaketQuestions = [];
window.ccCurrentSoalIdx = 0;

function getAllQuestionPoolsList() {
    return [
        window.DATA_SKD_CPNS || [],
        window.DATA_TIU_BATCH2 || [],
        window.DATA_TWK_GRATIS || [],
        window.DATA_TIU_GRATIS || [],
        window.DATA_TKP_GRATIS || []
    ];
}

function findQuestionByIdAcrossPools(qId) {
    const target = String(qId || '').trim();
    if (!target) return null;
    for (const pool of getAllQuestionPoolsList()) {
        const found = pool.find(q => q && q.id === target);
        if (found) return found;
    }
    return null;
}

function applyQuestionOverrideInMemory(qId, overrideData) {
    if (!qId || !overrideData) return;
    for (const pool of getAllQuestionPoolsList()) {
        const q = pool.find(item => item && item.id === qId);
        if (q) {
            if (!window.adminQuestionOriginals[qId]) {
                window.adminQuestionOriginals[qId] = JSON.parse(JSON.stringify(q));
            }
            if (typeof overrideData.subKategori === 'string') q.subKategori = overrideData.subKategori;
            if (typeof overrideData.soal === 'string') q.soal = overrideData.soal;
            if (typeof overrideData.gambar === 'string') q.gambar = overrideData.gambar;
            if (typeof overrideData.pembahasan === 'string') q.pembahasan = overrideData.pembahasan;
            if (Array.isArray(overrideData.opsi) && overrideData.opsi.length > 0) {
                q.opsi = overrideData.opsi.map(o => ({ ...o }));
            }
            q._isOverridden = true;
        }
    }
}

window.loadQuestionOverridesFromCloud = async () => {
    try {
        const cached = localStorage.getItem('menuju_asn_q_overrides_v1');
        if (cached) {
            const parsed = JSON.parse(cached);
            Object.entries(parsed).forEach(([qId, data]) => {
                window.adminQuestionOverrides[qId] = data;
                applyQuestionOverrideInMemory(qId, data);
            });
        }
    } catch (_) {}

    try {
        const snap = await getDocs(collection(db, COLLECTIONS.PACKAGES));
        snap.forEach(d => {
            if (d.id.startsWith('q_override_')) {
                const data = d.data();
                const qId = data.soalId || d.id.replace(/^q_override_/, '');
                window.adminQuestionOverrides[qId] = data;
                applyQuestionOverrideInMemory(qId, data);
            }
        });
        try {
            localStorage.setItem('menuju_asn_q_overrides_v1', JSON.stringify(window.adminQuestionOverrides));
        } catch (_) {}
        const badge = document.getElementById('ccBankOverrideBadge');
        if (badge) {
            badge.textContent = `${Object.keys(window.adminQuestionOverrides).length} Soal Diedit Live`;
        }
    } catch (e) {
        console.warn('Gagal memuat override soal:', e);
    }
};

function getQuestionsForAdminPaketKey(paketKey) {
    const rawData = window.DATA_SKD_CPNS || [];
    const key = String(paketKey || 'twk_1');

    if (key === 'overridden') {
        const ids = Object.keys(window.adminQuestionOverrides || {});
        return ids.map(id => findQuestionByIdAcrossPools(id)).filter(Boolean);
    }
    if (key.startsWith('twk_gratis_')) {
        const no = Math.max(1, Math.min(3, Number(key.split('_')[2]) || 1));
        return (window.DATA_TWK_GRATIS || []).slice((no - 1) * 30, no * 30);
    }
    if (key.startsWith('tiu_gratis_')) {
        const no = Math.max(1, Math.min(3, Number(key.split('_')[2]) || 1));
        return (window.DATA_TIU_GRATIS || []).slice((no - 1) * 35, no * 35);
    }
    if (key.startsWith('tkp_gratis_')) {
        const no = Math.max(1, Math.min(3, Number(key.split('_')[2]) || 1));
        return (window.DATA_TKP_GRATIS || []).slice((no - 1) * 45, no * 45);
    }
    if (key.startsWith('twk_')) {
        const no = Math.max(1, Math.min(90, Number(key.split('_')[1]) || 1));
        const allPaidTwk = rawData.filter(q => q.kategori === 'TWK' && /^twk_\d{4}$/.test(q.id));
        return no <= 40
            ? allPaidTwk.slice((no - 1) * 30, no * 30)
            : (window.DATA_TWK_BATCH2 || []).slice((no - 41) * 30, (no - 40) * 30);
    }
    if (key.startsWith('tiu_')) {
        const no = Math.max(1, Math.min(90, Number(key.split('_')[1]) || 1));
        return no <= 40
            ? rawData.filter(q => q.kategori === 'TIU' && /^tiu_\d{4}$/.test(q.id)).slice((no - 1) * 35, no * 35)
            : (window.DATA_TIU_BATCH2 || []).slice((no - 41) * 35, (no - 40) * 35);
    }
    if (key.startsWith('tkp_')) {
        const no = Math.max(1, Math.min(90, Number(key.split('_')[1]) || 1));
        const allTkp = rawData.filter(q => q.kategori === 'TKP');
        const packages = buildBalancedTkpPackages(allTkp, 40, 45);
        return no <= 40
            ? (packages[no - 1] || [])
            : (window.DATA_TKP_BATCH2 || []).slice((no - 41) * 45, (no - 40) * 45);
    }
    return [];
}

window.initAdminBankSoal = () => {
    const paketSel = document.getElementById('ccBankPaketSelect');
    if (!paketSel) return;

    const badge = document.getElementById('ccBankOverrideBadge');
    const overrideCount = Object.keys(window.adminQuestionOverrides || {}).length;
    if (badge) badge.textContent = `${overrideCount} Soal Diedit Live`;

    if (!paketSel.options.length) {
        let html = `<optgroup label="Daftar Khusus">`;
        html += `<option value="overridden">✨ Soal yang Pernah Diedit Live</option>`;
        html += `</optgroup><optgroup label="Paket Gratis (9 Paket)">`;
        for (let i = 1; i <= 3; i++) html += `<option value="twk_gratis_${i}">TWK Gratis — Paket ${i} (30 Soal)</option>`;
        for (let i = 1; i <= 3; i++) html += `<option value="tiu_gratis_${i}">TIU Gratis — Paket ${i} (35 Soal)</option>`;
        for (let i = 1; i <= 3; i++) html += `<option value="tkp_gratis_${i}">TKP Gratis — Paket ${i} (45 Soal)</option>`;
        html += `</optgroup><optgroup label="TWK Berbayar (Paket 1 - 90)">`;
        for (let i = 1; i <= 90; i++) html += `<option value="twk_${i}">TWK Paket #${i}${i > 40 ? ' (2026 Baru)' : ''} (30 Soal)</option>`;
        html += `</optgroup><optgroup label="TIU Berbayar (Paket 1 - 90)">`;
        for (let i = 1; i <= 90; i++) html += `<option value="tiu_${i}">TIU Paket #${i}${i > 40 ? ' (2026 Baru)' : ''} (35 Soal)</option>`;
        html += `</optgroup><optgroup label="TKP Berbayar (Paket 1 - 90)">`;
        for (let i = 1; i <= 90; i++) html += `<option value="tkp_${i}">TKP Paket #${i}${i > 40 ? ' (2026 Baru)' : ''} (45 Soal)</option>`;
        html += `</optgroup>`;
        paketSel.innerHTML = html;
        paketSel.value = window.ccCurrentPaketKey || 'twk_1';
    }

    window.onChangeAdminBankPaket(paketSel.value, window.ccCurrentSoalIdx || 0);
};

window.onChangeAdminBankPaket = (paketKey, targetIdx = 0) => {
    window.ccCurrentPaketKey = paketKey || 'twk_1';
    const qs = getQuestionsForAdminPaketKey(window.ccCurrentPaketKey);
    window.ccCurrentPaketQuestions = qs;
    window.ccCurrentSoalIdx = Math.max(0, Math.min(qs.length - 1, Number(targetIdx) || 0));

    const soalSel = document.getElementById('ccBankSoalSelect');
    if (soalSel) {
        if (qs.length === 0) {
            soalSel.innerHTML = `<option value="0">-- Tidak ada soal di paket ini --</option>`;
        } else {
            soalSel.innerHTML = qs.map((q, idx) => {
                const snippet = String(q.soal || '').replace(/<svg[\s\S]*?<\/svg>/gi, '[SVG]').replace(/\s+/g, ' ').slice(0, 52);
                const editedMark = window.adminQuestionOverrides?.[q.id] ? '✏️ ' : '';
                return `<option value="${idx}" ${idx === window.ccCurrentSoalIdx ? 'selected' : ''}>#${idx + 1} • ${editedMark}[${q.id}] ${q.subKategori || q.kategori} — ${snippet}...</option>`;
            }).join('');
        }
    }
    window.renderAdminBankSoalWorkspace();
};

window.onChangeAdminBankSoal = (idxVal) => {
    const qs = window.ccCurrentPaketQuestions || [];
    window.ccCurrentSoalIdx = Math.max(0, Math.min(qs.length - 1, Number(idxVal) || 0));
    window.renderAdminBankSoalWorkspace();
};

window.navAdminBankSoal = (delta) => {
    const qs = window.ccCurrentPaketQuestions || [];
    if (!qs.length) return;
    const next = Math.max(0, Math.min(qs.length - 1, (window.ccCurrentSoalIdx || 0) + Number(delta || 0)));
    window.ccCurrentSoalIdx = next;
    const soalSel = document.getElementById('ccBankSoalSelect');
    if (soalSel) soalSel.value = String(next);
    window.renderAdminBankSoalWorkspace();
};

window.cariAdminBankSoal = () => {
    const rawQuery = (document.getElementById('ccBankSearchInput')?.value || '').trim().toLowerCase();
    if (!rawQuery) return;

    const allKeys = [
        ...Array.from({ length: 3 }, (_, i) => `twk_gratis_${i + 1}`),
        ...Array.from({ length: 3 }, (_, i) => `tiu_gratis_${i + 1}`),
        ...Array.from({ length: 3 }, (_, i) => `tkp_gratis_${i + 1}`),
        ...Array.from({ length: 90 }, (_, i) => `twk_${i + 1}`),
        ...Array.from({ length: 90 }, (_, i) => `tiu_${i + 1}`),
        ...Array.from({ length: 90 }, (_, i) => `tkp_${i + 1}`)
    ];

    for (const pk of allKeys) {
        const list = getQuestionsForAdminPaketKey(pk);
        const foundIdx = list.findIndex(q =>
            String(q.id || '').toLowerCase() === rawQuery ||
            String(q.id || '').toLowerCase().includes(rawQuery) ||
            String(q.soal || '').toLowerCase().includes(rawQuery) ||
            String(q.subKategori || '').toLowerCase().includes(rawQuery)
        );
        if (foundIdx !== -1) {
            const paketSel = document.getElementById('ccBankPaketSelect');
            if (paketSel) paketSel.value = pk;
            window.onChangeAdminBankPaket(pk, foundIdx);
            return;
        }
    }
    Swal.fire('Tidak Ditemukan', `Tidak ada soal dengan ID atau kata kunci "${rawQuery}".`, 'info');
};

window.bukaSoalDiAdminEditor = (soalId) => {
    window.switchCommandTab('banksoal');
    const inp = document.getElementById('ccBankSearchInput');
    if (inp) inp.value = soalId;
    window.cariAdminBankSoal();
};

window.renderAdminBankSoalWorkspace = () => {
    const box = document.getElementById('ccBankWorkspace');
    const posEl = document.getElementById('ccBankPosInfo');
    if (!box) return;

    const qs = window.ccCurrentPaketQuestions || [];
    if (!qs.length) {
        if (posEl) posEl.textContent = '0 Soal';
        box.innerHTML = `<div class="cc-settings-card" style="text-align:center; color:#64748b;">Tidak ada soal pada paket ini (atau sedang dipersiapkan).</div>`;
        return;
    }

    const idx = window.ccCurrentSoalIdx || 0;
    const q = qs[idx];
    if (!q) return;

    const isEdited = Boolean(window.adminQuestionOverrides?.[q.id]);
    if (posEl) {
        posEl.innerHTML = `Soal <b>${idx + 1}</b> dari <b>${qs.length}</b> • ID: <code>${q.id}</code> ${isEdited ? '<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:999px;margin-left:6px;">Sudah Diedit Live</span>' : ''}`;
    }

    const escapeAttr = (str) => String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escapeTextarea = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const formattedQuestion = formatQuestionTextHtml(q.soal).replace(/\n/g, '<br>');
    const gambarPreview = q.gambar
        ? `<div style="margin-top:12px; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; overflow-x:auto;">${q.gambar}</div>`
        : '';

    const maxPoin = (q.opsi || []).reduce((mx, o) => Math.max(mx, Number(o.poin || (o.benar ? 5 : 0))), 0) || 5;
    const bestOpt = (q.opsi || []).find(o => q.kategori === 'TKP' ? Number(o.poin || 0) >= maxPoin : Boolean(o.benar)) || (q.opsi || [])[0];

    const previewOptionsHtml = (q.opsi || []).map(opt => {
        const isBest = q.kategori === 'TKP' ? Number(opt.poin || 0) >= maxPoin : Boolean(opt.benar);
        const badge = q.kategori === 'TKP'
            ? `<span style="margin-left:auto; font-size:0.75rem; font-weight:800; color:${isBest ? '#15803d' : '#475569'};">Poin ${opt.poin || 0}</span>`
            : (opt.benar ? `<span style="margin-left:auto; font-size:0.75rem; font-weight:800; color:#15803d;">✓ Kunci Benar</span>` : '');
        return `
            <div class="option-item" style="${isBest ? 'border-color:#16a34a; background:#f0fdf4;' : ''} cursor:default;">
                <div class="option-circle" style="${isBest ? 'background:#16a34a; color:#fff; border-color:#16a34a;' : ''}">${opt.label}</div>
                <div class="option-label">${opt.teks}</div>
                ${badge}
            </div>
        `;
    }).join('');

    const previewPembahasanHtml = typeof window.buildInteractivePembahasanHtml === 'function'
        ? window.buildInteractivePembahasanHtml(q, bestOpt?.label || 'A', `admin_qc_${q.id}`, {
            headerTitle: 'Preview Pembahasan Mentor',
            gotPoin: maxPoin,
            maxPoin
        })
        : `<div style="padding:12px; background:#f8fafc; border-radius:10px;">${formatStructuredPembahasan(q.pembahasan || '-')}</div>`;

    const editOptionsInputsHtml = (q.opsi || []).map((opt, oIdx) => {
        const rightControl = q.kategori === 'TKP'
            ? `<label style="display:flex; align-items:center; gap:5px; font-size:0.76rem; font-weight:800; color:#0f172a; white-space:nowrap;">
                Poin:
                <input type="number" id="ccEditOptPoin_${oIdx}" min="1" max="5" value="${Number(opt.poin || 1)}" style="width:54px; padding:5px 7px; border:1px solid #cbd5e1; border-radius:6px; font-weight:800;" />
               </label>`
            : `<label style="display:flex; align-items:center; gap:5px; font-size:0.76rem; font-weight:800; color:#15803d; cursor:pointer; white-space:nowrap;">
                <input type="radio" name="ccEditKunciRadio" value="${opt.label}" ${opt.benar ? 'checked' : ''} />
                Kunci
               </label>`;
        return `
            <div style="display:flex; gap:8px; align-items:flex-start; margin-bottom:8px; background:#f8fafc; padding:8px 10px; border-radius:8px; border:1px solid #e2e8f0;">
                <span style="font-weight:900; font-size:0.84rem; color:#1e3a8a; padding-top:6px; min-width:20px;">${opt.label}.</span>
                <textarea id="ccEditOptTeks_${oIdx}" rows="2" style="flex:1; padding:6px 9px; border:1px solid #cbd5e1; border-radius:7px; font-size:0.82rem; font-family:inherit;">${escapeTextarea(opt.teks)}</textarea>
                ${rightControl}
            </div>
        `;
    }).join('');

    box.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:16px; align-items:start;">
            <!-- KOLOM KIRI: LIVE PREVIEW PESERTA -->
            <div class="cc-settings-card" style="margin:0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span class="badge-subtes ${(q.kategori || 'twk').toLowerCase()}">${q.kategori} • ${q.subKategori || '-'}</span>
                    <span style="font-size:0.75rem; font-weight:800; color:#64748b;"><i class="fas fa-eye"></i> Tampilan Live Peserta</span>
                </div>
                <div class="question-text" style="font-size:0.95rem; margin-bottom:14px;">
                    ${formattedQuestion}
                    ${gambarPreview}
                </div>
                <div class="options-list" style="margin-bottom:14px;">
                    ${previewOptionsHtml}
                </div>
                ${previewPembahasanHtml}
            </div>

            <!-- KOLOM KANAN: FORM EDIT SOAL & KUNCI -->
            <div class="cc-settings-card" style="margin:0;">
                <h3 style="margin:0 0 10px; font-size:0.98rem; color:#1e3a8a;"><i class="fas fa-pen-to-square"></i> Edit Butir Soal (${q.id})</h3>
                <div class="cc-form-group">
                    <label for="ccEditSubKat">Sub-Kategori / Topik</label>
                    <input type="text" id="ccEditSubKat" value="${escapeAttr(q.subKategori || '')}" />
                </div>
                <div class="cc-form-group">
                    <label for="ccEditSoalText">Teks Soal (Mendukung **Bold**, Tabel Baris/Pipe, dan &lt;svg&gt;)</label>
                    <textarea id="ccEditSoalText" rows="6" style="width:100%; padding:9px 11px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.84rem; font-family:inherit; line-height:1.5;">${escapeTextarea(q.soal)}</textarea>
                </div>
                <div class="cc-form-group">
                    <label for="ccEditGambar">Kode SVG / Gambar Tambahan (Opsional, di luar teks soal)</label>
                    <textarea id="ccEditGambar" rows="2" placeholder="Kosongkan jika tidak ada gambar terpisah..." style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.8rem; font-family:monospace;">${escapeTextarea(q.gambar || '')}</textarea>
                </div>
                <div class="cc-form-group">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
                        <label style="margin:0;">Opsi Jawaban A–E &amp; ${q.kategori === 'TKP' ? 'Bobot Poin (1–5)' : 'Kunci Jawaban Benar'}</label>
                        <button type="button" id="btnHomogenizeAi" class="bot-inline-btn" onclick="window.homogenisasiOpsiSalahAI('${q.id}')" title="Menulis ulang HANYA opsi yang salah agar panjang &amp; gaya bahasanya setara dengan kunci benar">
                            <i class="fas fa-wand-magic-sparkles"></i> Homogenkan Opsi Salah (AI)
                        </button>
                    </div>
                    ${editOptionsInputsHtml}
                </div>
                <div class="cc-form-group">
                    <label for="ccEditPembahasan">Teks Pembahasan Mentor</label>
                    <textarea id="ccEditPembahasan" rows="4" style="width:100%; padding:9px 11px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.84rem; font-family:inherit; line-height:1.5;">${escapeTextarea(q.pembahasan || '')}</textarea>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
                    <button type="button" class="btn-dash-gold" onclick="window.simpanEditSoalAdmin('${q.id}')">
                        <i class="fas fa-save"></i> Simpan &amp; Terapkan Live
                    </button>
                    ${isEdited ? `
                        <button type="button" class="cc-btn danger" onclick="window.resetOverrideSoalAdmin('${q.id}')" style="padding:9px 14px;">
                            <i class="fas fa-undo"></i> Reset ke Soal Asli
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
};

window.homogenisasiOpsiSalahAI = async (qId) => {
    const q = findQuestionByIdAcrossPools(qId);
    if (!q) return;

    const btn = document.getElementById('btnHomogenizeAi');
    const subKategori = (document.getElementById('ccEditSubKat')?.value || q.subKategori || '').trim();
    const soal = (document.getElementById('ccEditSoalText')?.value || q.soal || '').trim();
    const selectedRadio = document.querySelector('input[name="ccEditKunciRadio"]:checked')?.value || 'A';

    const currentOpsi = (q.opsi || []).map((opt, oIdx) => {
        const teks = (document.getElementById(`ccEditOptTeks_${oIdx}`)?.value ?? opt.teks ?? '').trim();
        if (q.kategori === 'TKP') {
            const poin = Math.max(1, Math.min(5, Number(document.getElementById(`ccEditOptPoin_${oIdx}`)?.value || opt.poin || 1)));
            return { label: opt.label, teks, poin };
        }
        const benar = opt.label === selectedRadio;
        return { label: opt.label, teks, benar, poin: benar ? 5 : 0 };
    });

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Menghomogenkan Opsi Salah...`;
    }

    try {
        const res = await callMenujuAsnBot({
            action: 'homogenize',
            kategori: q.kategori,
            subKategori,
            soal,
            opsi: currentOpsi
        });
        const map = res.homogenized || {};
        let updatedCount = 0;
        (q.opsi || []).forEach((opt, oIdx) => {
            if (map[opt.label]) {
                const ta = document.getElementById(`ccEditOptTeks_${oIdx}`);
                if (ta) {
                    ta.value = map[opt.label];
                    ta.style.borderColor = '#0284c7';
                    ta.style.background = '#f0f9ff';
                    updatedCount++;
                }
            }
        });
        Swal.fire({
            icon: 'success',
            title: `${updatedCount} Opsi Salah Dihomogenkan!`,
            html: `Opsi kunci (<b>${escapeHtmlMentor((res.lockedLabels || []).join(', '))}</b>) tetap dikunci dan tidak diubah.<br><br><span style="font-size:0.82rem; color:#475569;">Silakan cek hasilnya di form, lalu klik <b>Simpan &amp; Terapkan Live</b> jika sudah cocok.</span>`,
            confirmButtonColor: '#1e3a8a'
        });
    } catch (err) {
        Swal.fire('Gagal Homogenisasi AI', err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-wand-magic-sparkles"></i> Homogenkan Opsi Salah (AI)`;
        }
    }
};

window.simpanEditSoalAdmin = async (qId) => {
    const q = findQuestionByIdAcrossPools(qId);
    if (!q) return;

    const subKategori = (document.getElementById('ccEditSubKat')?.value || '').trim();
    const soal = document.getElementById('ccEditSoalText')?.value || '';
    const gambar = (document.getElementById('ccEditGambar')?.value || '').trim();
    const pembahasan = document.getElementById('ccEditPembahasan')?.value || '';
    const selectedRadio = document.querySelector('input[name="ccEditKunciRadio"]:checked')?.value || 'A';

    const newOpsi = (q.opsi || []).map((opt, oIdx) => {
        const teks = document.getElementById(`ccEditOptTeks_${oIdx}`)?.value ?? opt.teks;
        if (q.kategori === 'TKP') {
            const poin = Math.max(1, Math.min(5, Number(document.getElementById(`ccEditOptPoin_${oIdx}`)?.value || opt.poin || 1)));
            return { label: opt.label, teks, poin };
        }
        const benar = opt.label === selectedRadio;
        return { label: opt.label, teks, benar, poin: benar ? 5 : 0 };
    });

    const overridePayload = {
        soalId: qId,
        kategori: q.kategori,
        subKategori,
        soal,
        gambar,
        opsi: newOpsi,
        pembahasan,
        updatedAt: Date.now(),
        updatedBy: window.currentUser?.email || 'admin'
    };

    try {
        await setDoc(doc(db, COLLECTIONS.PACKAGES, `q_override_${qId}`), overridePayload);
        window.adminQuestionOverrides[qId] = overridePayload;
        applyQuestionOverrideInMemory(qId, overridePayload);
        try {
            localStorage.setItem('menuju_asn_q_overrides_v1', JSON.stringify(window.adminQuestionOverrides));
        } catch (_) {}

        const badge = document.getElementById('ccBankOverrideBadge');
        if (badge) badge.textContent = `${Object.keys(window.adminQuestionOverrides).length} Soal Diedit Live`;

        window.onChangeAdminBankPaket(window.ccCurrentPaketKey, window.ccCurrentSoalIdx);
        Swal.fire({
            icon: 'success',
            title: 'Soal Diperbarui Live!',
            text: `Perubahan pada soal ${qId} sudah tersimpan di Cloud dan langsung tampil di seluruh akun peserta.`,
            timer: 1800,
            showConfirmButton: false
        });
    } catch (e) {
        Swal.fire('Gagal Menyimpan', e.message, 'error');
    }
};

window.resetOverrideSoalAdmin = async (qId) => {
    const orig = window.adminQuestionOriginals?.[qId];
    try {
        await deleteDoc(doc(db, COLLECTIONS.PACKAGES, `q_override_${qId}`));
        delete window.adminQuestionOverrides[qId];
        if (orig) {
            applyQuestionOverrideInMemory(qId, orig);
        }
        try {
            localStorage.setItem('menuju_asn_q_overrides_v1', JSON.stringify(window.adminQuestionOverrides));
        } catch (_) {}
        const badge = document.getElementById('ccBankOverrideBadge');
        if (badge) badge.textContent = `${Object.keys(window.adminQuestionOverrides).length} Soal Diedit Live`;
        window.onChangeAdminBankPaket(window.ccCurrentPaketKey, window.ccCurrentSoalIdx);
        Swal.fire({ icon: 'success', title: 'Direset ke Soal Asli', timer: 1300, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Gagal Reset', e.message, 'error');
    }
};

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
        else if (oc.includes('Pusat Studi') || oc.includes('bukaMateriPusatStudi')) label = 'Admin Bypass: Buka Tips & Trik';
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

    const fiturLower = String(namaFitur || '').toLowerCase();
    const isPusatStudi = fiturLower.includes('pusat studi');
    const isTryout = /to akbar|tryout/i.test(fiturLower);
    const isBannerSatuan = fiturLower === 'paket satuan';
    const satuanLabel = isTryout ? 'Rp 24.999 / TO' : (isBannerSatuan ? 'Mulai Rp 9.999' : 'Rp 9.999 / Paket');
    const satuanDesc = isTryout
        ? '<b>Rp 24.999 per Tryout Akbar</b>'
        : (isBannerSatuan
            ? '<b>Rp 9.999 / Paket Latihan</b> atau <b>Rp 24.999 / Tryout Akbar</b>'
            : '<b>Rp 9.999 per Paket Latihan</b>');

    const bodyHtml = isPusatStudi
        ? `
            <p style="font-size:0.92rem; color:#334155; margin-bottom:12px;">
                Fitur <b>Pusat Studi ASN</b> tersedia eksklusif murni untuk <b>Paket Gold</b>.
            </p>
            <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:11px; padding:11px 13px; font-size:0.82rem; color:#92400e; line-height:1.5; text-align:left;">
                👑 Upgrade ke <b>Paket Gold (Rp 99.999)</b> untuk membuka seluruh modul materi, trik cepat TWK/TIU/TKP, 270 paket latihan, &amp; 5× Tryout Akbar.
            </div>
        `
        : `
            <p style="font-size:0.92rem; color:#334155; margin-bottom:12px;">
                Akses ini tersedia khusus untuk <b>${infoHarga}</b>.
            </p>
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:11px; padding:11px 13px; font-size:0.82rem; color:#475569; line-height:1.5; text-align:left;">
                <div style="margin-bottom:4px;">👑 <b>Paket Langganan:</b> Upgrade ke <b>${infoHarga}</b> untuk buka banyak paket sekaligus.</div>
                <div>💳 <b>Opsi Eceran:</b> Tidak ingin langganan? Tersedia beli satuan ${satuanDesc}.</div>
            </div>
        `;

    Swal.fire({
        title: `🔒 ${namaFitur}`,
        html: bodyHtml,
        icon: 'info',
        showDenyButton: !isPusatStudi,
        showCancelButton: true,
        confirmButtonText: isPusatStudi ? '👑 Lihat Paket Gold' : '👑 Lihat Paket',
        denyButtonText: `💳 Beli ${satuanLabel}`,
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#1e3a8a',
        denyButtonColor: '#d97706'
    }).then(res => {
        if (res.isConfirmed) {
            if (typeof window.switchAppView === 'function') window.switchAppView('upgrade');
        } else if (res.isDenied && !isPusatStudi) {
            Swal.fire({
                icon: 'info',
                title: `💳 Pembelian Satuan ${satuanLabel}`,
                html: `
                    <p style="font-size:0.88rem; color:#334155; margin-bottom:10px;">
                        Fitur pembayaran eceran otomatis ${satuanDesc} via <b>Xendit</b> (QRIS, E-Wallet &amp; Virtual Account) sedang dalam tahap integrasi akhir dan akan segera aktif!
                    </p>
                    <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:10px; font-size:0.8rem; color:#92400e;">
                        💡 Sementara menunggu rilis Xendit, kamu juga bisa memilih paket <b>Bronze / Silver / Gold</b> atau hubungi Admin.
                    </div>
                `,
                confirmButtonText: 'Siap, Mengerti',
                confirmButtonColor: '#1e3a8a'
            });
        }
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

window.mulaiSingleplayer = (tipe, paketNo = null, forceMode = null) => {
    window.isInstantReviewMode = false;
    let rawData = window.DATA_SKD_CPNS || [];
    let title = 'Latihan Soal SKD';
    let saveId = tipe;

    if (tipe === 'twk') {
        const allPaidTwk = rawData.filter(q => q.kategori === 'TWK' && /^twk_\d{4}$/.test(q.id));
        if (paketNo) {
            const no = Math.max(1, Math.min(90, Number(paketNo) || 1));
            if (no <= 40) {
                window.currentQuestions = allPaidTwk.slice((no - 1) * 30, no * 30);
                title = `TWK Paket #${no}`;
            } else {
                const batch2Twk = window.DATA_TWK_BATCH2 || [];
                window.currentQuestions = batch2Twk.slice((no - 41) * 30, (no - 40) * 30);
                title = `TWK Paket #${no} (2026 Baru)`;
            }
            window.examTimeRemaining = window.currentQuestions.length * 60; // 30 Menit
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
        const no = Math.max(1, Math.min(90, Number(paketNo) || 1));
        if (no <= 40) {
            const allPaidTiu = rawData.filter(q => q.kategori === 'TIU' && /^tiu_\d{4}$/.test(q.id));
            window.currentQuestions = allPaidTiu.slice((no - 1) * 35, no * 35);
            title = `TIU Paket #${no}`;
        } else {
            const batch2Tiu = window.DATA_TIU_BATCH2 || [];
            window.currentQuestions = batch2Tiu.slice((no - 41) * 35, (no - 40) * 35);
            title = `TIU Paket #${no} (2026 Baru)`;
        }
        window.examTimeRemaining = window.currentQuestions.length * 60; // 35 Menit
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
            const no = Math.max(1, Math.min(90, Number(paketNo) || 1));
            if (no <= 40) {
                const packages = buildBalancedTkpPackages(allTkp, 40, 45);
                window.currentQuestions = packages[no - 1] || [];
                title = `TKP Paket #${no}`;
            } else {
                const batch2Tkp = window.DATA_TKP_BATCH2 || [];
                window.currentQuestions = batch2Tkp.slice((no - 41) * 45, (no - 40) * 45);
                title = `TKP Paket #${no} (2026 Baru)`;
            }
            window.examTimeRemaining = window.currentQuestions.length * 60; // 45 Menit
            saveId = `tkp_${no}`;
        } else {
            const packages = buildBalancedTkpPackages(allTkp, 40, 45);
            window.currentQuestions = packages[0] || allTkp.slice(0, 45);
            window.examTimeRemaining = window.currentQuestions.length * 60;
            title = 'TKP Paket #1';
            saveId = 'tkp_1';
        }
    } else if (tipe === 'to_gratis') {
        const toPool = window.DATA_TRYOUT_AKBAR || [];
        window.currentQuestions = toPool.filter(q => q.paketTo === 0);
        window.examTimeRemaining = 100 * 60;
        title = 'Tryout Gratis (Simulasi SKD 110 Soal)';
        saveId = 'to_gratis_0';
    } else if (tipe === 'to_akbar') {
        const no = Math.max(1, Math.min(5, Number(paketNo) || 1));
        const toPool = window.DATA_TRYOUT_AKBAR || [];
        window.currentQuestions = toPool.filter(q => q.paketTo === no);
        window.examTimeRemaining = 100 * 60;
        title = `TO Akbar #${no} (Simulasi SKD 2026)`;
        saveId = `to_akbar_${no}`;
    } else {
        const twk1 = rawData.filter(q => q.kategori === 'TWK' && /^twk_\d{4}$/.test(q.id)).slice(0, 30);
        const tiu1 = rawData.filter(q => q.kategori === 'TIU' && /^tiu_\d{4}$/.test(q.id)).slice(0, 35);
        const tkp1 = buildBalancedTkpPackages(rawData.filter(q => q.kategori === 'TKP'), 40, 45)[0] || [];
        window.currentQuestions = [...twk1, ...tiu1, ...tkp1];
        window.examTimeRemaining = 100 * 60;
        title = 'Simulasi SKD Lengkap';
    }

    if (window.currentQuestions.length === 0) {
        return Swal.fire('Informasi', 'Paket soal sedang dipersiapkan.', 'info');
    }

    window.currentPackageMeta = {
        saveId,
        tipe,
        paketNo: paketNo ? Number(paketNo) : 1,
        title,
        totalDurationSeconds: window.examTimeRemaining
    };
    window.currentAppMode = 'singleplayer';

    // Jika belum memilih mode dari Lobi Persiapan, arahkan ke halaman Persiapan terlebih dahulu
    if (!forceMode) {
        return window.bukaLobbyPersiapanPaket();
    }

    window.isInstantReviewMode = (forceMode === 'drill');
    if (forceMode === 'drill' && window.currentPackageMeta) {
        window.currentPackageMeta.title = `${title} • Mode Drill`;
    }
    startExamSessionUI();
};

window.selectedPersiapanMode = 'fokus'; // 'fokus' | 'drill'
window.persiapanOriginView = 'cat';

window.bukaLobbyPersiapanPaket = () => {
    const container = document.getElementById('persiapanPaketContainer');
    const meta = window.currentPackageMeta || {};
    const qs = window.currentQuestions || [];
    if (!container || !qs.length) {
        return startExamSessionUI();
    }

    // Catat view asal agar tombol kembali tepat sasaran
    const activeViewEl = document.querySelector('.app-view.active');
    if (activeViewEl && activeViewEl.id && activeViewEl.id !== 'view-persiapan') {
        window.persiapanOriginView = activeViewEl.id.replace(/^view-/, '');
    }
    window.selectedPersiapanMode = 'fokus';

    const tipe = String(meta.tipe || 'twk').toLowerCase();
    const isFree = tipe.includes('gratis');
    const paketNo = meta.paketNo || 1;
    const isBatch2 = Number(paketNo) > 40;
    const totalSoal = qs.length;
    const durasiMenit = Math.round((meta.totalDurationSeconds || totalSoal * 60) / 60);

    let subtesKey = 'full';
    if (tipe.startsWith('twk')) subtesKey = 'twk';
    else if (tipe.startsWith('tiu')) subtesKey = 'tiu';
    else if (tipe.startsWith('tkp')) subtesKey = 'tkp';

    const SPEC_MAP = {
        twk: {
            tag: isFree ? '[GRATIS]' : (isBatch2 ? '[BATCH 2026 BARU]' : '[PAKET BERBAYAR]'),
            flyerKicker: 'SIMULASI SUBTES CAT BKN',
            flyerTitle: 'LATIHAN TWK',
            flyerIcon: 'fa-landmark',
            themeClass: 'theme-twk',
            pgValue: 'Minimal 65 Poin',
            pgSub: 'Ambang Batas Resmi TWK BKN',
            maxValue: `${totalSoal * 5} Poin`,
            maxSub: 'Benar +5 • Salah / Kosong 0',
            desc: `Paket latihan Tes Wawasan Kebangsaan (TWK) berstandar CAT BKN yang dirancang untuk menguji penguasaan nasionalisme, integritas, bela negara, pilar kebangsaan, serta kemampuan berbahasa Indonesia melalui studi kasus penalaran HOTS.`,
            defaultTopics: ['Nasionalisme', 'Integritas ASN', 'Bela Negara', 'Pilar Negara (Pancasila & UUD 1945)', 'Bahasa Indonesia']
        },
        tiu: {
            tag: isFree ? '[GRATIS]' : (isBatch2 ? '[BATCH 2026 BARU]' : '[PAKET BERBAYAR]'),
            flyerKicker: 'SIMULASI SUBTES CAT BKN',
            flyerTitle: 'LATIHAN TIU',
            flyerIcon: 'fa-brain',
            themeClass: 'theme-tiu',
            pgValue: 'Minimal 80 Poin',
            pgSub: 'Ambang Batas Resmi TIU BKN',
            maxValue: `${totalSoal * 5} Poin`,
            maxSub: 'Benar +5 • Salah / Kosong 0',
            desc: `Paket latihan Tes Inteligensi Umum (TIU) untuk mengukur kecerdasan verbal (analogi, silogisme, analitis), numerik (berhitung cepat, deret, matriks, perbandingan, tabel), serta penalaran figural 9 kotak & ketidaksamaan gambar SVG.`,
            defaultTopics: ['Verbal Analogi & Silogisme', 'Verbal Analitis', 'Numerik Berhitung & Deret', 'Perbandingan & Soal Cerita', 'Figural SVG & Matriks']
        },
        tkp: {
            tag: isFree ? '[GRATIS]' : (isBatch2 ? '[BATCH 2026 BARU]' : '[PAKET BERBAYAR]'),
            flyerKicker: 'SIMULASI SUBTES CAT BKN',
            flyerTitle: 'LATIHAN TKP',
            flyerIcon: 'fa-user-check',
            themeClass: 'theme-tkp',
            pgValue: 'Minimal 166 Poin',
            pgSub: 'Ambang Batas Resmi TKP BKN',
            maxValue: `${totalSoal * 5} Poin`,
            maxSub: 'Bobot Bertingkat 1 s.d. 5 Poin',
            desc: `Paket latihan Tes Karakteristik Pribadi (TKP) yang mengukur kematangan perilaku ASN pada 6 aspek pelayanan publik, jejaring kerja, sosial budaya, teknologi informasi (TIK), profesionalisme, dan anti-radikalisme.`,
            defaultTopics: ['Pelayanan Publik', 'Jejaring Kerja', 'Sosial Budaya', 'Teknologi Informasi (TIK)', 'Profesionalisme', 'Anti-Radikalisme']
        },
        full: {
            tag: '[TRY OUT AKBAR SKD]',
            flyerKicker: 'TRY OUT NASIONAL CAT BKN',
            flyerTitle: 'TRY OUT SKD',
            flyerIcon: 'fa-trophy',
            themeClass: 'theme-full',
            pgValue: 'TWK 65 • TIU 80 • TKP 166',
            pgSub: 'Standar Passing Grade KemenPAN-RB',
            maxValue: '550 Poin',
            maxSub: 'TWK 150 + TIU 175 + TKP 225',
            desc: `Tryout SKD CPNS terintegrasi untuk mengukur kesiapan menghadapi seleksi CASN sesungguhnya. Mencakup gabungan soal TWK, TIU, dan TKP dengan evaluasi Passing Grade otomatis dan analisis kelemahan AI.`,
            defaultTopics: ['TWK (30 Soal • Min 65)', 'TIU (35 Soal • Min 80)', 'TKP (45 Soal • Min 166)']
        }
    };

    const spec = SPEC_MAP[subtesKey] || SPEC_MAP.twk;

    // Hitung sebaran sub-kategori nyata dari daftar soal di paket ini
    const topicMap = {};
    qs.forEach(q => {
        const label = (q.subKategori || q.kategori || 'Materi Inti').trim();
        topicMap[label] = (topicMap[label] || 0) + 1;
    });
    const topicEntries = Object.entries(topicMap);
    const topicsHtml = topicEntries.length > 0
        ? topicEntries.map(([tName, cnt]) => `<span class="persiapan-topic-pill"><i class="fas fa-check-circle" style="color:#2563eb;"></i> ${tName} (${cnt} soal)</span>`).join('')
        : spec.defaultTopics.map(tName => `<span class="persiapan-topic-pill"><i class="fas fa-check-circle" style="color:#2563eb;"></i> ${tName}</span>`).join('');

    container.innerHTML = `
        <div class="persiapan-top-bar">
            <div class="persiapan-top-left">
                <div class="persiapan-top-icon"><i class="fas fa-clipboard-list"></i></div>
                <div>
                    <h3>Persiapan Latihan &amp; Ujian</h3>
                    <span>Baca rincian materi, ambang batas, &amp; pilih mode pengerjaan sebelum mulai</span>
                </div>
            </div>
            <button type="button" class="persiapan-back-btn" onclick="window.switchAppView(window.persiapanOriginView || 'cat')">
                <i class="fas fa-arrow-left"></i> Kembali ke Daftar Paket
            </button>
        </div>

        <div class="persiapan-lobby-card">
            <!-- KOLOM KIRI: RINCIAN MATERI, PASSING GRADE & PILIHAN MODE -->
            <div class="persiapan-info-col">
                <h2>${spec.tag} ${String(meta.title || 'PAKET LATIHAN SKD').toUpperCase()}</h2>
                <p class="persiapan-lead">${spec.desc}</p>

                <!-- 3 KOTAK SPESIFIKASI UTAMA: SOAL & WAKTU, PASSING GRADE, NILAI MAKSIMAL -->
                <div class="persiapan-spec-grid">
                    <div class="persiapan-spec-box">
                        <div class="persiapan-spec-label"><i class="fas fa-clock" style="color:#2563eb;"></i> Jumlah &amp; Durasi</div>
                        <div class="persiapan-spec-val">${totalSoal} Soal • ${durasiMenit} Menit</div>
                        <div class="persiapan-spec-sub">Standar Timer CAT BKN</div>
                    </div>
                    <div class="persiapan-spec-box">
                        <div class="persiapan-spec-label"><i class="fas fa-bullseye" style="color:#16a34a;"></i> Passing Grade</div>
                        <div class="persiapan-spec-val" style="color:#15803d;">${spec.pgValue}</div>
                        <div class="persiapan-spec-sub">${spec.pgSub}</div>
                    </div>
                    <div class="persiapan-spec-box">
                        <div class="persiapan-spec-label"><i class="fas fa-star" style="color:#d97706;"></i> Nilai Maksimal</div>
                        <div class="persiapan-spec-val" style="color:#b45309;">${spec.maxValue}</div>
                        <div class="persiapan-spec-sub">${spec.maxSub}</div>
                    </div>
                </div>

                <!-- KOMPOSISI MATERI DI DALAM PAKET -->
                <div class="persiapan-section-box">
                    <div class="persiapan-section-title">
                        <i class="fas fa-layer-group" style="color:#2563eb;"></i> Cakupan Materi &amp; Kisi-Kisi Paket Ini
                    </div>
                    <div class="persiapan-topic-tags">
                        ${topicsHtml}
                    </div>
                </div>

                <!-- FASILITAS LATIHAN -->
                <div class="persiapan-section-box" style="margin-bottom:16px;">
                    <div class="persiapan-section-title">
                        <i class="fas fa-thumbtack" style="color:#e11d48;"></i> Fasilitas &amp; Evaluasi
                    </div>
                    <ul class="persiapan-facility-list">
                        <li>Mengakses <strong>Pembahasan Mentor Interaktif</strong> beserta visualisasi konsep &amp; rumus cepat.</li>
                        <li>Mendapatkan skor akhir, evaluasi kelulusan <strong>Passing Grade BKN</strong>, &amp; grafik tren otomatis di <strong>Brankas Pembahasan</strong>.</li>
                        <li>Tersedia fitur <strong>Ulangi Soal Salah (Remedial)</strong> di Brankas &amp; bedah soal bersama <strong>MenujuASN-Bot AI</strong>.</li>
                        <li>Progres dapat disimpan kapan saja melalui tombol <strong>Simpan &amp; Kembali</strong>.</li>
                    </ul>
                </div>

                <!-- PILIHAN MODE PENGERJAAN (FOKUS CAT VS DRILL LANGSUNG PEMBAHASAN) -->
                <div class="persiapan-mode-title">
                    <i class="fas fa-sliders-h" style="color:#1e3a8a;"></i> Pilih Mode Pengerjaan:
                </div>
                <div class="persiapan-mode-grid">
                    <div id="modeCardFokus" class="persiapan-mode-card active" onclick="window.pilihModePersiapan('fokus')">
                        <div class="persiapan-mode-head">
                            <strong><i class="fas fa-stopwatch" style="color:#2563eb;"></i> Mode Fokus CAT</strong>
                            <span class="persiapan-mode-check"><i class="fas fa-check"></i></span>
                        </div>
                        <p>Simulasi fokus sesuai ujian CAT BKN sesungguhnya. Kunci jawaban &amp; pembahasan dibuka setelah selesai.</p>
                    </div>
                    <div id="modeCardDrill" class="persiapan-mode-card drill-mode" onclick="window.pilihModePersiapan('drill')">
                        <div class="persiapan-mode-head">
                            <strong><i class="fas fa-bolt" style="color:#d97706;"></i> Mode Drill (Pembahasan Langsung)</strong>
                            <span class="persiapan-mode-check"><i class="fas fa-check"></i></span>
                        </div>
                        <p>Begitu klik opsi jawaban A–E, langsung muncul kunci Benar/Salah, bobot TKP 1–5, &amp; pembahasan seketika!</p>
                    </div>
                </div>
            </div>

            <!-- KOLOM KANAN: FLYER GRAFIS MODERN & TOMBOL MULAI -->
            <div class="persiapan-flyer-col">
                <div class="persiapan-flyer-card ${spec.themeClass}">
                    <div class="persiapan-flyer-top">
                        <div class="persiapan-flyer-brand">
                            <div class="persiapan-flyer-logo">
                                <img src="logo%20menuju%20asn.png" alt="Logo Menuju ASN">
                            </div>
                            <span>MENUJU ASN</span>
                        </div>
                        <span class="persiapan-flyer-badge"><i class="fas fa-shield-alt"></i> CAT BKN 2027</span>
                    </div>

                    <div class="persiapan-flyer-body">
                        <div>
                            <div class="persiapan-flyer-kicker">${spec.flyerKicker}</div>
                            <div class="persiapan-flyer-title">${spec.flyerTitle}</div>
                            <div class="persiapan-flyer-num-row">
                                <span class="persiapan-flyer-num">#${paketNo}</span>
                                <div class="persiapan-flyer-tagline">
                                    Satu langkah<br>lebih dekat dengan <strong>NIP 2027</strong>
                                </div>
                            </div>
                        </div>
                        <div class="persiapan-flyer-art">
                            <i class="fas ${spec.flyerIcon}"></i>
                        </div>
                    </div>

                    <div class="persiapan-flyer-foot">
                        <span><i class="fas fa-list-check"></i> ${totalSoal} Butir Soal</span>
                        <span><i class="fas fa-hourglass-half"></i> ${durasiMenit} Menit</span>
                        <span><i class="fas fa-trophy"></i> Max ${spec.maxValue}</span>
                    </div>
                </div>

                <button type="button" id="btnMulaiDariLobby" class="btn-persiapan-start" onclick="window.eksekusiMulaiDariLobby()">
                    <i class="fas fa-play-circle"></i> Mulai Ujian (Mode Fokus CAT)
                </button>
            </div>
        </div>
    `;

    window.switchAppView('persiapan');
};

window.pilihModePersiapan = (mode) => {
    window.selectedPersiapanMode = mode === 'drill' ? 'drill' : 'fokus';
    const fCard = document.getElementById('modeCardFokus');
    const dCard = document.getElementById('modeCardDrill');
    const btn = document.getElementById('btnMulaiDariLobby');

    if (fCard) fCard.classList.toggle('active', window.selectedPersiapanMode === 'fokus');
    if (dCard) dCard.classList.toggle('active', window.selectedPersiapanMode === 'drill');
    if (btn) {
        if (window.selectedPersiapanMode === 'drill') {
            btn.innerHTML = `<i class="fas fa-bolt"></i> Mulai Mode Drill (Langsung Pembahasan)`;
        } else {
            btn.innerHTML = `<i class="fas fa-play-circle"></i> Mulai Ujian (Mode Fokus CAT)`;
        }
    }
};

window.eksekusiMulaiDariLobby = () => {
    const mode = window.selectedPersiapanMode || 'fokus';
    window.isInstantReviewMode = (mode === 'drill');
    if (window.currentPackageMeta) {
        const baseTitle = String(window.currentPackageMeta.title || 'Latihan SKD').replace(/\s*•\s*Mode Drill$/i, '');
        window.currentPackageMeta.title = mode === 'drill' ? `${baseTitle} • Mode Drill` : baseTitle;
    }
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
                ${window.currentAppMode === 'multiplayer' ? `
                    <button onclick="window.bukaModalKlasemenMabar()" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:6px 12px; border-radius:20px; font-weight:700; font-size:0.78rem; cursor:pointer;">
                        <i class="fas fa-trophy" style="color:#d97706;"></i> Klasemen
                    </button>
                ` : ''}
                <div class="exam-timer" id="examTimerDisplay">
                    <i class="fas fa-stopwatch"></i> 45:00
                </div>
                ${window.currentAppMode === 'singleplayer' ? `
                    <button onclick="window.simpanDanKembaliKeBeranda()" style="background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; padding:6px 12px; border-radius:20px; font-weight:700; font-size:0.78rem; cursor:pointer;">
                        <i class="fas fa-bookmark"></i> Simpan &amp; Kembali
                    </button>
                ` : ''}
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
                        <span class="exam-legend-item"><span class="exam-legend-dot answered"></span> ${window.isInstantReviewMode ? 'Benar' : 'Dijawab'}</span>
                        ${window.isInstantReviewMode ? '<span class="exam-legend-item"><span class="exam-legend-dot wrong"></span> Salah</span>' : ''}
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
    const svgBlocks = [];
    const withPlaceholders = String(rawText || '').replace(/<svg\b[\s\S]*?<\/svg>/gi, (match) => {
        const idx = svgBlocks.length;
        svgBlocks.push(match.replace(/\r?\n/g, ' '));
        return `\n__SOAL_SVG_BLOCK_${idx}__\n`;
    });

    const safe = withPlaceholders
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const lines = safe.split(/\r?\n/);
    const rowRegex = /^(?:Baris\s*(\d+)\s*:\s*)?\[([^\]]+)\]$/i;
    const pipeRowRegex = /^\|(.+)\|$/;
    const pipeSepRegex = /^\|[\s:|-]+\|$/;

    const out = [];
    let tableRows = [];
    let pipeRows = [];

    const flushTable = () => {
        if (tableRows.length === 0) return;
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
                const displayVal = c === '' ? '?' : c;
                const isQ = displayVal === '?';
                return `<td class="${isQ ? 'qmark-cell' : ''}">${displayVal}</td>`;
            }).join('');
            return `<tr>${hasLabel ? `<td style="background:#f8fafc; color:#475569; font-size:0.82rem;">${r.label}</td>` : ''}${cellsHtml}</tr>`;
        }).join('');

        out.push(`<div class="soal-data-table-wrap"><table class="soal-data-table"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`);
        tableRows = [];
    };

    const flushPipeTable = () => {
        if (pipeRows.length === 0) return;
        const dataRows = pipeRows.filter(r => !r.isSep);
        if (dataRows.length < 2) {
            pipeRows.forEach(r => out.push(r.raw));
            pipeRows = [];
            return;
        }
        const [headRow, ...restRows] = dataRows;
        const headerCells = headRow.cells.map(c => `<th>${c || '&nbsp;'}</th>`).join('');
        const bodyRows = restRows.map(r => {
            const cellsHtml = r.cells.map(c => {
                const displayVal = c === '' ? '?' : c;
                const isQ = displayVal === '?';
                return `<td class="${isQ ? 'qmark-cell' : ''}">${displayVal}</td>`;
            }).join('');
            return `<tr>${cellsHtml}</tr>`;
        }).join('');

        out.push(`<div class="soal-data-table-wrap"><table class="soal-data-table"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`);
        pipeRows = [];
    };

    lines.forEach(line => {
        const trimmed = line.trim();
        const m = trimmed.match(rowRegex);
        if (m) {
            flushPipeTable();
            const sep = m[2].includes('|') ? '|' : ',';
            const cells = m[2].split(sep).map(s => s.trim());
            tableRows.push({
                raw: line,
                label: m[1] ? `Baris ${m[1]}` : '',
                cells
            });
            return;
        }
        const pm = trimmed.match(pipeRowRegex);
        if (pm) {
            flushTable();
            const isSep = pipeSepRegex.test(trimmed);
            const cells = pm[1].split('|').map(s => s.trim());
            pipeRows.push({ raw: line, isSep, cells });
            return;
        }

        flushTable();
        flushPipeTable();
        if (trimmed || out.length > 0) {
            out.push(line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'));
        }
    });
    flushTable();
    flushPipeTable();

    let result = out.join('\n').replace(/^\n+|\n+$/g, '');
    svgBlocks.forEach((svg, idx) => {
        result = result.replace(
            `__SOAL_SVG_BLOCK_${idx}__`,
            `<div class="soal-svg-wrap" style="margin:10px 0; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; overflow-x:auto; max-width:100%;">${svg}</div>`
        );
    });
    return result;
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

            const lockStyle = showInstant ? 'cursor:default;' : '';
            return `
                <div class="option-item ${isSel ? 'selected' : ''}" style="${lockStyle}${inlineStyle}" onclick="window.pilihJawaban('${q.id}', '${opt.label}', ${opt.poin || 0})">
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
        if (isRagu) {
            statusClass = 'ragu';
        } else if (isAnswered) {
            if (window.isInstantReviewMode) {
                const pickedOpt = (item.opsi || []).find(o => o.label === answers[item.id]);
                const maxPoin = (item.opsi || []).reduce((mx, o) => Math.max(mx, Number(o.poin || (o.benar ? 5 : 0))), 0) || 5;
                const isCorrect = item.kategori === 'TKP'
                    ? Number(pickedOpt?.poin || 0) >= maxPoin
                    : Boolean(pickedOpt?.benar);
                statusClass = isCorrect ? 'answered' : 'wrong';
            } else {
                statusClass = 'answered';
            }
        }

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
    if ((window.currentAppMode === 'multiplayer' || window.isInstantReviewMode) && window.userAnswers[qId]) {
        return; // Kunci jawaban setelah memilih di Live CBT Arena & Mode Drill agar tidak bisa diubah lagi
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
            'Paket Satuan (Rp 9.999) / Bronze (Rp 49.999) / Silver (Rp 74.999) / Gold (Rp 99.999)'
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
    const canRemedial = Boolean(prof.isAdmin || prof.isPaid);

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
    const canRemedial = Boolean(prof.isAdmin || prof.isPaid);
    if (!canRemedial) {
        return window.bukaModalUpgrade('Ulangi Soal Salah di Brankas', 'Paket Bronze / Silver / Gold');
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
        tipe: attempt.tipe || 'twk',
        paketNo: attempt.paketNo || 1,
        title: `Remedial: ${attempt.title}`,
        totalDurationSeconds: window.examTimeRemaining
    };
    window.bukaLobbyPersiapanPaket();
};

window.renderBrankasPembahasan = () => {
    const area = document.getElementById('brankasContentArea');
    if (!area) return;

    const history = getBrankasHistory();
    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    const tier = String(prof.tier || 'free').toLowerCase();
    const canReview = Boolean(prof.isPaid || prof.isAdmin);
    const canRemedial = Boolean(prof.isPaid || prof.isAdmin);

    const statTotal = document.getElementById('brankasStatTotal');
    const statLast = document.getElementById('brankasStatLast');
    const statLastLabel = document.getElementById('brankasStatLastLabel');
    const statAccess = document.getElementById('brankasStatAccess');
    if (statTotal) statTotal.textContent = `${history.length} Paket`;
    if (statLast && history.length === 0) statLast.textContent = '-';
    if (statLastLabel && history.length === 0) statLastLabel.textContent = 'Skor Rata-Rata';
    if (statAccess) {
        if (prof.isAdmin) statAccess.textContent = 'ADMIN (Full + Remedial)';
        else if (canReview) statAccess.textContent = `${tier.toUpperCase()} (Review + Ulangi Soal)`;
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

const LANDING_PREVIEW_SAMPLES = {
    twk: {
        key: 'twk',
        num: 1,
        badgeClass: 'twk',
        badgeText: 'TWK • NASIONALISME & KEDAULATAN DATA',
        timer: '28:45',
        kategori: 'TWK',
        subKategori: 'Nasionalisme',
        soal: 'Sebuah instansi pemerintah daerah berencana mengadopsi sistem arsip kependudukan berbasis cloud. Vendor asing menawarkan harga 18% lebih murah, sedangkan konsorsium teknologi dalam negeri menawarkan platform yang telah tersertifikasi keamanan siber BSSN dengan selisih biaya tipis. Sebagai Pejabat Pembuat Komitmen, keputusan yang paling mencerminkan nasionalisme dan bela negara adalah...',
        kunci: 'D',
        opsi: [
            { label: 'A', teks: 'Memilih vendor asing semata-mata demi efisiensi anggaran jangka pendek tanpa audit keamanan.', benar: false, poin: 0 },
            { label: 'B', teks: 'Menunda digitalisasi arsip dan kembali menggunakan pencatatan manual di atas kertas.', benar: false, poin: 0 },
            { label: 'C', teks: 'Membagi data kependudukan secara acak antara vendor asing dan vendor lokal agar adil.', benar: false, poin: 0 },
            { label: 'D', teks: 'Memilih platform dalam negeri tersertifikasi BSSN guna menjaga kedaulatan data warga sekaligus mendukung kemandirian industri teknologi nasional.', benar: true, poin: 5 },
            { label: 'E', teks: 'Meminta vendor asing menyalin sistem konsorsium lokal agar harganya tetap lebih murah.', benar: false, poin: 0 }
        ],
        pembahasan: 'Langkah tepat sesuai nilai Nasionalisme & Bela Negara adalah mengutamakan kemandirian ekonomi/teknologi dalam negeri dan menjaga kedaulatan data strategis negara (tersertifikasi BSSN), bukan sekadar mengejar selisih harga sesaat yang berisiko terhadap keamanan informasi nasional.'
    },
    tiu: {
        key: 'tiu',
        num: 2,
        badgeClass: 'tiu',
        badgeText: 'TIU • NUMERIK DERET ANGKA',
        timer: '33:12',
        kategori: 'TIU',
        subKategori: 'Deret Angka',
        soal: 'Perhatikan barisan bilangan berikut:\n4, 7, 13, 25, 49, ...\nBilangan yang paling tepat untuk melengkapi titik-titik pada deret tersebut adalah...',
        kunci: 'C',
        opsi: [
            { label: 'A', teks: '73', benar: false, poin: 0 },
            { label: 'B', teks: '85', benar: false, poin: 0 },
            { label: 'C', teks: '97', benar: true, poin: 5 },
            { label: 'D', teks: '99', benar: false, poin: 0 },
            { label: 'E', teks: '101', benar: false, poin: 0 }
        ],
        pembahasan: 'Perhatikan selisih antarsuku yang selalu dikalikan 2 pada setiap lompatan: 4 ke 7 (+3), 7 ke 13 (+6), 13 ke 25 (+12), 25 ke 49 (+24). Maka lompatan selanjutnya adalah +24 × 2 = +48, sehingga 49 + 48 = 97.'
    },
    tkp: {
        key: 'tkp',
        num: 3,
        badgeClass: 'tkp',
        badgeText: 'TKP • PELAYANAN PUBLIK',
        timer: '42:18',
        kategori: 'TKP',
        subKategori: 'Pelayanan Publik',
        soal: 'Anda bertugas di loket Pelayanan Terpadu. Seorang lansia datang dari desa jauh membawa berkas yang kurang lengkap menjelang jam tutup layanan. Langkah terbaik Anda adalah...',
        kunci: 'D',
        opsi: [
            { label: 'A', teks: 'Menolak berkas secara sopan dan memintanya kembali besok pagi saat loket baru dibuka.', poin: 2 },
            { label: 'B', teks: 'Menerima dan mencatat kekurangan berkasnya agar ia tahu syarat apa saja yang perlu dilengkapi.', poin: 4 },
            { label: 'C', teks: 'Tetap memproses permohonan tersebut agar pemohon tidak kecewa meski berkasnya belum lengkap.', poin: 1 },
            { label: 'D', teks: 'Melayani dengan ramah, mengecek kekurangan berkasnya, lalu memandu solusi prioritas sesuai SOP.', poin: 5 },
            { label: 'E', teks: 'Menjelaskan daftar syarat resmi di papan informasi dan mengarahkannya ke bagian pengaduan umum.', poin: 3 }
        ],
        pembahasan: 'Dalam aspek Pelayanan Publik TKP, skor tertinggi (Poin 5) selalu memadukan sikap ramah-empatik kepada kelompok rentan/lansia, membantu memeriksa kekurangan secara solutif, namun tetap patuh pada koridor SOP yang berlaku.'
    }
};

window.activePreviewLandingSubtes = 'twk';
window.previewLandingAnswered = {};

window.switchPreviewLandingSubtes = (sub) => {
    window.activePreviewLandingSubtes = LANDING_PREVIEW_SAMPLES[sub] ? sub : 'twk';
    window.renderPreviewLandingSubtes();
};

window.renderPreviewLandingSubtes = () => {
    const sub = window.activePreviewLandingSubtes || 'twk';
    const q = LANDING_PREVIEW_SAMPLES[sub] || LANDING_PREVIEW_SAMPLES.twk;
    const mainEl = document.getElementById('landingPreviewMain');
    if (!mainEl) return;

    document.querySelectorAll('#landingPreviewTabs .preview-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-sub') === sub);
    });

    const counterEl = document.getElementById('previewNavCounter');
    if (counterEl) counterEl.textContent = `${q.kategori} • ${q.num}/3`;

    const numGrid = document.getElementById('landingPreviewNumGrid');
    if (numGrid) {
        const order = ['twk', 'tiu', 'tkp'];
        numGrid.innerHTML = order.map((k, idx) => {
            const isCur = k === sub;
            const isAns = Boolean(window.previewLandingAnswered[k]);
            const cls = isCur ? 'current' : (isAns ? 'answered' : '');
            return `<button type="button" class="pnum ${cls}" onclick="window.switchPreviewLandingSubtes('${k}')" title="Soal ${k.toUpperCase()}">${idx + 1}</button>`;
        }).join('');
    }

    const pickedLabel = window.previewLandingAnswered[sub] || null;
    const optsHtml = q.opsi.map(opt => {
        let extraCls = '';
        if (pickedLabel) {
            if (q.kategori === 'TKP') {
                if (opt.poin >= 5) extraCls = 'best';
                else if (opt.label === pickedLabel) extraCls = 'mid';
            } else {
                if (opt.benar) extraCls = 'best';
                else if (opt.label === pickedLabel && !opt.benar) extraCls = 'wrong';
            }
        }
        const poinBadge = pickedLabel
            ? (q.kategori === 'TKP'
                ? `<span style="margin-left:auto; font-size:0.72rem; font-weight:800; color:${opt.poin >= 5 ? '#15803d' : '#64748b'};">+${opt.poin}</span>`
                : (opt.benar ? `<span style="margin-left:auto; font-size:0.72rem; font-weight:800; color:#15803d;"><i class="fas fa-check"></i> Kunci</span>` : ''))
            : '';

        return `
            <button type="button" class="preview-opt-btn ${extraCls}" onclick="window.pilihPreviewLanding('${sub}', '${opt.label}')">
                <span class="preview-opt-label">${opt.label}</span>
                <span style="flex:1;">${opt.teks}</span>
                ${poinBadge}
            </button>
        `;
    }).join('');

    let feedbackHtml = '';
    if (pickedLabel) {
        const pickedOpt = q.opsi.find(o => o.label === pickedLabel) || q.opsi[0];
        const gotPoin = q.kategori === 'TKP' ? Number(pickedOpt.poin || 0) : (pickedOpt.benar ? 5 : 0);
        const visualSvgHtml = (typeof buildMentorVisualHtml === 'function')
            ? buildMentorVisualHtml(q)
            : '';
        const statusBanner = q.kategori === 'TKP'
            ? `<div style="font-weight:800; margin-bottom:8px; color:${gotPoin >= 5 ? '#15803d' : '#b45309'};">Skor Opsi ${pickedLabel}: +${gotPoin} Poin (Maksimal 5 Poin • Opsi Terbaik: ${q.kunci})</div>`
            : `<div style="font-weight:800; margin-bottom:8px; color:${pickedOpt.benar ? '#15803d' : '#b91c1c'};">${pickedOpt.benar ? `✅ Tepat! Jawabanmu ${pickedLabel} Benar (+5 Poin)` : `❌ Kurang Tepat (Jawabanmu ${pickedLabel}) — Kunci Benar: ${q.kunci}`}</div>`;

        feedbackHtml = `
            <div id="landingPreviewFeedback" class="preview-feedback-box" style="display:block; border-left-color:${gotPoin >= 5 ? '#16a34a' : '#f59e0b'}; background:${gotPoin >= 5 ? '#f0fdf4' : '#fffbeb'}; color:#1e293b;">
                ${statusBanner}
                ${visualSvgHtml}
                <div style="font-size:0.83rem; line-height:1.6; color:#334155;">
                    <strong style="color:#1e3a8a;"><i class="fas fa-chalkboard-teacher"></i> Pembahasan Mentor:</strong><br>
                    ${formatStructuredPembahasan(q.pembahasan)}
                </div>
            </div>
        `;
    } else {
        feedbackHtml = `<div id="landingPreviewFeedback" class="preview-feedback-box" style="display:none;"></div>`;
    }

    mainEl.innerHTML = `
        <div class="preview-cat-topbar">
            <span class="badge-subtes ${q.badgeClass}">${q.badgeText}</span>
            <span class="preview-timer-pill"><i class="fas fa-stopwatch"></i> ${q.timer}</span>
        </div>
        <p class="preview-q-text" style="white-space:pre-line;">${q.soal}</p>
        <div class="preview-options" id="landingPreviewOptions">
            ${optsHtml}
        </div>
        ${feedbackHtml}
    `;
};

window.pilihPreviewLanding = (sub, label) => {
    const key = LANDING_PREVIEW_SAMPLES[sub] ? sub : (window.activePreviewLandingSubtes || 'twk');
    window.previewLandingAnswered[key] = label;
    window.renderPreviewLandingSubtes();
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
    for (let i = 1; i <= 90; i++) {
        html += `<option value="twk_${i}">TWK Paket #${i}${i > 40 ? ' [2026 Baru]' : ''} (30 Soal)</option>`;
    }
    for (let i = 1; i <= 90; i++) {
        html += `<option value="tiu_${i}">TIU Paket #${i}${i > 40 ? ' [2026 Baru]' : ''} (35 Soal)</option>`;
    }
    for (let i = 1; i <= 90; i++) {
        html += `<option value="tkp_${i}">TKP Paket #${i}${i > 40 ? ' [2026 Baru]' : ''} (45 Soal)</option>`;
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
        const no = Math.max(1, Math.min(90, Number(key.split('_')[1]) || 1));
        const allPaidTwk = rawData.filter(q => q.kategori === 'TWK' && /^twk_\d{4}$/.test(q.id));
        const qs = no <= 40
            ? allPaidTwk.slice((no - 1) * 30, no * 30)
            : (window.DATA_TWK_BATCH2 || []).slice((no - 41) * 30, (no - 40) * 30);
        return { questions: qs, durationSec: qs.length * 60, label: `TWK Paket #${no}${no > 40 ? ' (2026 Baru)' : ''}` };
    }
    if (key.startsWith('tiu_')) {
        const no = Math.max(1, Math.min(90, Number(key.split('_')[1]) || 1));
        const qs = no <= 40
            ? rawData.filter(q => q.kategori === 'TIU' && /^tiu_\d{4}$/.test(q.id)).slice((no - 1) * 35, no * 35)
            : (window.DATA_TIU_BATCH2 || []).slice((no - 41) * 35, (no - 40) * 35);
        return { questions: qs, durationSec: qs.length * 60, label: `TIU Paket #${no}${no > 40 ? ' (2026 Baru)' : ''}` };
    }
    if (key.startsWith('tkp_')) {
        const no = Math.max(1, Math.min(90, Number(key.split('_')[1]) || 1));
        const allTkp = rawData.filter(q => q.kategori === 'TKP');
        const packages = buildBalancedTkpPackages(allTkp, 40, 45);
        const qs = no <= 40
            ? (packages[no - 1] || [])
            : (window.DATA_TKP_BATCH2 || []).slice((no - 41) * 45, (no - 40) * 45);
        return { questions: qs, durationSec: qs.length * 60, label: `TKP Paket #${no}${no > 40 ? ' (2026 Baru)' : ''}` };
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
    const soalLow = String(q?.soal || '').toLowerCase();

    let trik = 'Baca kalimat tanya paling akhir terlebih dahulu agar fokus menangkap kata kunci sebelum menghitung atau memilih opsi.';
    let jebakan = 'Terburu-buru memilih opsi yang sekilas mirip padahal melenceng dari inti pertanyaan.';

    if (kat === 'TKP') {
        if (sub.includes('pelayanan')) {
            trik = 'Pilih opsi yang langsung memberi solusi tuntas, ramah, inklusif, dan tetap sesuai SOP tanpa melempar tanggung jawab ke warga.';
            jebakan = 'Opsi bernilai 3–4 biasanya sopan, tetapi hanya menyuruh warga menunggu, mengisi formulir lagi, atau melempar ke petugas lain.';
        } else if (sub.includes('jejaring')) {
            trik = 'Prioritaskan inisiatif menyatukan pihak terkait, berbagi peran secara adil, dan menjaga komunikasi terbuka demi target bersama.';
            jebakan = 'Opsi bernilai 3–4 cenderung bekerja sendiri-sendiri atau menunggu arahan atasan tanpa berkoordinasi aktif.';
        } else if (sub.includes('sosial')) {
            trik = 'Utamakan sikap menghargai keragaman budaya/keyakinan, dialogis, empatik, dan anti-diskriminasi.';
            jebakan = 'Opsi bernilai rendah biasanya memaksakan kebiasaan mayoritas atau memilih menghindar dari interaksi lintas kelompok.';
        } else if (sub.includes('tik')) {
            trik = 'Pilih solusi teknologi yang aman (jaga privasi/data, hindari phishing), efisien, dan membantu tim ikut beradaptasi.';
            jebakan = 'Opsi yang memakai cara manual terus-menerus atau mengabaikan keamanan data/tautan akan bernilai rendah.';
        } else if (sub.includes('radikal')) {
            trik = 'Tegas menolak intoleransi dan kekerasan, tetap santun/sejuk dalam dialog, serta menempuh pelaporan ke pembina/aparat resmi.';
            jebakan = 'Sikap apatis ("diam saja biar aman") atau main hakim sendiri justru mendapat poin rendah.';
        } else {
            trik = 'Tunjukkan tanggung jawab penuh, manajemen prioritas yang adil, jujur pada data, dan perbaikan sistemik atas kendala kerja.';
            jebakan = 'Opsi bernilai 3–4 terlihat hati-hati, tetapi pasif menunda keputusan atau membebankan tugas ke staf lain.';
        }
    } else if (sub.includes('kecukupan data')) {
        trik = 'Uji (1) saja secara terpisah, lalu (2) saja secara terpisah. Jangan gabungkan keduanya sebelum memastikan masing-masing gagal memberi 1 nilai tunggal!';
        jebakan = 'Langsung menggabungkan (1) dan (2) padahal salah satunya sudah cukup, atau mengira 2 persamaan kelipatan memberi solusi unik.';
    } else if (sub.includes('matriks')) {
        trik = 'Cek selisih baris (→) dan kolom (↓) dulu; jika kolom kanan melonjak acak, cari rumus operasi per baris seperti (K1 × K2) + k atau (K1 + K2) × k.';
        jebakan = 'Salah arah membaca (baris vs kolom), atau lupa menambahkan/mengalikan konstanta penyesuai di baris terakhir.';
    } else if (sub.includes('perkalian setara') || sub.includes('pembagian setara')) {
        trik = 'Perkalian setara: satu sisi dibagi k, sisi lain dikali k. Pembagian setara: pembilang dan penyebut dikali/dibagi angka yang sama.';
        jebakan = 'Mengalikan hanya satu sisi atau membagi satu sisi sambil mengalikan sisi lain pada operasi pembagian.';
    } else if (sub.includes('tabel')) {
        trik = 'Fokus hanya pada baris/kolom dan bobot yang ditanyakan soal, lalu coret data pengalih yang tidak diperlukan.';
        jebakan = 'Tertukar baris kandidat atau salah menjumlahkan persentase bobot antar-komponen.';
    } else if (sub.includes('deret')) {
        trik = sub.includes('selang')
            ? 'Langsung cek lompat 1 posisi (ganjil dengan ganjil, genap dengan genap) jika angka terlihat naik-turun.'
            : 'Hitung selisih 3 pasangan awal sekaligus; jika belum konstan, cek rasio (×) atau selisih tingkat kedua.';
        jebakan = 'Mengira deret 1 pola padahal selang-seling, atau tertukar tanda (+ / −) di langkah terakhir.';
    } else if (sub.includes('silogisme') || sub.includes('logis')) {
        trik = 'Aturan 10 detik: Semua + Sebagian = Sebagian; coret term tengah yang sama, jangan menambah asumsi di luar premis.';
        jebakan = 'Membalik pernyataan "Semua A adalah B" menjadi "Semua B adalah A", padahal konversnya hanya "Sebagian B adalah A".';
    } else if (sub.includes('argumen')) {
        trik = 'Temukan hubungan sebab → akibat pada klaim: penguat menyingkirkan faktor lain, pelemah menunjukkan faktor alternatif atau data tandingan.';
        jebakan = 'Memilih pernyataan yang masih satu topik, padahal tidak memengaruhi hubungan sebab-akibat yang diklaim.';
    } else if (sub.includes('analitis')) {
        trik = 'Tulis syarat yang pasti/mutlak lebih dulu (posisi ujung atau hari tetap), baru susun syarat berurutan dan larangan.';
        jebakan = 'Mengabaikan satu syarat negatif ("tidak bersebelahan" / "bukan hari Sabtu") saat menyusun urutan.';
    } else if (sub.includes('figural')) {
        trik = 'Lacak 1 elemen kecil dulu (jumlah sisi, titik, arsiran), lalu cek apakah berputar ↻ 45°/90° atau bergeser siklik tiap baris/kolom.';
        jebakan = 'Tertipu bentuk luar yang sama, padahal jumlah titik, arsiran, atau arah rotasinya meleset satu langkah.';
    } else if (sub.includes('hitung') || sub.includes('numerik') || sub.includes('perbandingan') || sub.includes('cerita')) {
        trik = 'Gunakan pembulatan cerdas atau pecahan istimewa (12,5% = 1/8; 25% = 1/4); untuk perbandingan pekerja, pakai beban = orang × hari.';
        jebakan = 'Menjawab jumlah total pekerja padahal yang ditanyakan adalah pekerja tambahan, atau salah konversi persen.';
    } else if (sub.includes('sinonim') || sub.includes('antonim') || sub.includes('kosakata')) {
        trik = 'Kenali makna dasar atau kata serapannya, lalu eliminasi opsi yang maknanya berlawanan/terlalu sempit.';
        jebakan = 'Memilih kata yang sering muncul dalam satu topik padahal bukan padanan/lawan kata yang diminta.';
    } else if (sub.includes('analogi') || kat === 'TIU') {
        trik = 'Buat 1 kalimat penghubung baku antara kata kiri dan kanan, lalu terapkan kalimat persis sama ke pasangan opsi.';
        jebakan = 'Terbalik arah hubungan (sebab-akibat tertukar akibat-sebab) atau memilih pasangan yang sebidang makna tapi beda relasi.';
    } else if (sub.includes('bahasa')) {
        if (soalLow.includes('gelar')) {
            trik = 'Cek 3 aturan wajib gelar EYD V: singkatan pakai titik (Dr., S.H., M.H.), nama & gelar belakang dipisah koma, dan antargelar dipisah koma.';
            jebakan = 'Lupa koma antara nama dan gelar belakang, menulis DR. semua kapital, atau menghilangkan titik di akhir singkatan gelar.';
        } else if (soalLow.includes('konjungsi') || soalLow.includes('penghubung')) {
            trik = 'Bedakan konjungsi antarkalimat (Namun, Oleh karena itu — hanya di awal kalimat baru) vs intrakalimat (tetapi, sedangkan, melainkan — di tengah kalimat).';
            jebakan = 'Memakai "namun" atau "namun demikian" di tengah kalimat, atau memasang konjungsi ganda seperti "meskipun ... namun".';
        } else if (soalLow.includes('kapital') || soalLow.includes('miring')) {
            trik = 'Jabatan + nama instansi/orang = kapital; nama buku/majalah = miring; kata tugas (di, ke, dari, dan, yang) di tengah judul = huruf kecil.';
            jebakan = 'Mengapitalkan kata tugas di tengah judul atau mengapitalkan nama jenis (seperti jeruk bali / gula jawa).';
        } else if (soalLow.includes('baku') || soalLow.includes('serapan') || soalLow.includes('imbuhan')) {
            trik = 'Cari 1 kata tidak baku saja untuk langsung mencoret opsi (ingat: apotek, praktik, jadwal, risiko, ekstrem, memengaruhi, menyukseskan).';
            jebakan = 'Terkecoh kata populer yang sering dipakai lisan padahal salah di KBBI (apotik, praktek, resiko, merubah, mensukseskan).';
        } else if (soalLow.includes('koma') || soalLow.includes('tanda') || soalLow.includes('partikel') || soalLow.includes('depan')) {
            trik = 'Anak kalimat di depan induk wajib koma; preposisi tempat (di kantor, ke luar) dipisah, sedangkan imbuhan (dikeluarkan) disambung.';
            jebakan = 'Memasang koma sebelum konjungsi di tengah kalimat (..., meskipun / ..., jika) atau menyambung kata depan "di/ke".';
        } else {
            trik = 'Uji tiap opsi terhadap 3 kaidah inti EYD V: subjek tidak diawali preposisi (Bagi/Dalam), kata baku KBBI, dan bebas pleonasme (agar supaya, para ... sekalian).';
            jebakan = 'Memilih kalimat yang terdengar sopan atau formal secara lisan, padahal kehilangan subjek atau boros kata.';
        }
    } else if (kat === 'TWK') {
        if (sub.includes('nasionalisme')) {
            trik = 'Pilih sikap yang mengutamakan kepentingan bangsa, kemandirian produk/ekonomi lokal, serta persatuan tanpa bersikap diskriminatif.';
            jebakan = 'Opsi yang terkesan menjaga efisiensi sesaat tetapi mengorbankan produk rakyat, kedaulatan, atau persatuan daerah.';
        } else if (sub.includes('integritas')) {
            trik = 'Pilih tindakan yang menolak suap/gratifikasi/manipulasi sekecil apa pun, jujur pada data, dan menempuh jalur pelaporan resmi.';
            jebakan = 'Opsi "jalan tengah" seperti menerima lalu disumbangkan atau menutupi kesalahan demi menjaga nama baik unit tetap salah.';
        } else if (sub.includes('bela negara')) {
            trik = 'Kaitkan masalah dengan ketahanan bangsa (keamanan siber, hoaks/deepfake, lingkungan, pangan, perbatasan) dan peran aktif sesuai kewenangan.';
            jebakan = 'Memilih tindakan pasif menunggu pusat atau tindakan main hakim sendiri di luar prosedur resmi.';
        } else {
            trik = 'Identifikasi pilar yang diuji: Sila Pancasila (1–5), kewenangan lembaga UUD 1945 (MK/MA/DPR/DPD/BPK), atau prinsip Bhinneka Tunggal Ika & NKRI.';
            jebakan = 'Tertukar kewenangan antarlembaga negara atau memilih jawaban yang benar secara umum namun meleset dari sila/pasal yang ditanya.';
        }
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
    // Format terstruktur "Judul:: isi" per baris -> judul langkah kustom, semua langkah dipertahankan
    const customTitles = [];
    const isStructured = /^[^\n:]{2,40}::/m.test(rawText);
    if (isStructured) {
        parts = rawText.split(/\n+/).map(s => s.trim()).filter(Boolean).map(line => {
            const mm = line.match(/^([^:]{2,40})::\s*([\s\S]*)$/);
            customTitles.push(mm ? mm[1].trim() : null);
            return mm ? mm[2] : line;
        });
    }
    if (!isStructured && parts.length > 4) {
        parts = [parts[0], parts[1], parts.slice(2).join(' ')];
    }

    const getStepTitle = (idx, total) => {
        if (customTitles[idx]) return escapeHtmlMentor(customTitles[idx]);
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
    const cleanSpeechRaw = rawText.replace(/<svg[\s\S]*?<\/svg>/gi, 'gambar pola').replace(/::/g, ':').replace(/\n+/g, '. ');
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
                    fb.innerHTML = `<strong>${isBenar ? '✅ Mantap! Jawabanmu Benar!' : `❌ Kurang Tepat (Kunci: ${escapeHtmlMentor(q.kunci)})`}</strong><br>${formatMentorTextWithSvg(String(q.pembahasan || '').replace(/^([^\n:]{2,40})::\s*/gm, '$1: '))}`;
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
// 12. MENUJUASN-BOT (GEMINI AI + QUOTA) & PUSAT BERITA CASN
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
    let cleaned = String(text || '')
        .replace(/\\rightarrow|\\to/g, '→')
        .replace(/\\leftarrow/g, '←')
        .replace(/\\dots|\\ldots|\\cdots/g, '...')
        .replace(/\\times/g, '×')
        .replace(/\\div/g, '÷')
        .replace(/\\pm/g, '±')
        .replace(/\\leq?/g, '≤')
        .replace(/\\geq?/g, '≥')
        .replace(/\\neq/g, '≠')
        .replace(/\\approx/g, '≈')
        .replace(/\\therefore/g, '∴')
        .replace(/\\subset/g, '⊂')
        .replace(/\\neg/g, '~')
        .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
        .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
        .replace(/\\(?:text|textbf|mathrm)\{([^{}]+)\}/g, '$1')
        .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
        .replace(/\$([^$\n]+?)\$/g, '$1')
        .replace(/\\\(|\\\)|\\\[|\\\]/g, '');

    return escapeHtmlMentor(cleaned)
        .replace(/^###\s+(.+)$/gm, '<div style="font-weight:800; color:#0f172a; margin:10px 0 4px;">$1</div>')
        .replace(/^##\s+(.+)$/gm, '<div style="font-weight:800; font-size:0.95rem; color:#0f172a; margin:10px 0 4px;">$1</div>')
        .replace(/^\*\s+/gm, '• ')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
        .replace(/\n/g, '<br/>');
}

window._botQuotaState = null;

window.konfirmasiPakaiTokenBot = async (namaFitur = 'Tanya MenujuASN-BOT') => {
    if (!window.currentUser) {
        Swal.fire('Perlu Login', 'Silakan login dengan akun Google terlebih dahulu.', 'info');
        return false;
    }
    try {
        if (!window._botQuotaState) {
            const q = await callMenujuAsnBot({ action: 'quota' });
            window._botQuotaState = q;
        }
    } catch (e) {
        // lanjutkan, server tetap akan memvalidasi
    }

    const prof = window.currentUserProfile || { tier: 'free', isPaid: false, isAdmin: false };
    const tier = prof.isAdmin ? 'admin' : (prof.isPaid ? String(prof.tier || 'bronze').toLowerCase() : 'free');
    const defaultLim = tier === 'admin' ? 9999 : (tier === 'gold' ? 30 : (tier === 'silver' ? 20 : (tier === 'bronze' ? 10 : 0)));
    const totalLimit = window._botQuotaState?.totalLimit ?? defaultLim;
    const totalUsed = window._botQuotaState?.totalUsed ?? 0;
    const remaining = Math.max(0, totalLimit - totalUsed);

    if (tier !== 'admin' && totalLimit <= 0) {
        window.bukaModalUpgrade(namaFitur, 'Bronze (10 Token/hari) • Silver (20 Token/hari) • Gold (30 Token/hari)');
        return false;
    }

    if (tier !== 'admin' && remaining <= 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Token Harian Habis',
            html: `Jatah token <b>MenujuASN-BOT</b> paket <b>${tier.toUpperCase()}</b> hari ini (<b>${totalLimit} token/hari</b>) sudah terpakai semua.<br><br><span style="font-size:0.82rem; color:#64748b;">Kuota di-reset otomatis pukul 00.00 WIB.</span>`,
            confirmButtonColor: '#1e3a8a'
        });
        return false;
    }

    const sisaBadge = tier === 'admin'
        ? `<span style="color:#059669; font-weight:800;">Unlimited (Admin)</span>`
        : `<span style="color:#1d4ed8; font-weight:800;">${remaining} dari ${totalLimit} Token</span>`;

    const ask = await Swal.fire({
        title: '🤖 Pakai Token MenujuASN-BOT?',
        html: `
            <div style="text-align:left; font-size:0.86rem; line-height:1.55; color:#334155;">
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; margin-bottom:10px;">
                    <div>Fitur: <b>${escapeHtmlMentor(namaFitur)}</b></div>
                    <div>Paket Aktif: <b>${tier.toUpperCase()}</b></div>
                    <div>Sisa Token Hari Ini: ${sisaBadge}</div>
                </div>
                <div style="font-size:0.78rem; color:#64748b;">
                    • Setiap pertanyaan memakai <b>1 token</b>.<br/>
                    • Batas harian: <b>Bronze 10</b> • <b>Silver 20</b> • <b>Gold 30</b> token/hari (reset 00.00 WIB).
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Ya, Lanjut Tanya (-1 Token)',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#1e3a8a'
    });

    return Boolean(ask.isConfirmed);
};

window.bedahSoalDenganBot = async (safeId, followUpText = '') => {
    const ctx = window._botSoalContextMap?.[safeId];
    const box = document.getElementById(`botExplainWrap_${safeId}`);
    if (!ctx || !box) return;

    const okToken = await window.konfirmasiPakaiTokenBot(followUpText ? 'Tanya Lanjutan Soal' : 'Bedah Soal dengan AI');
    if (!okToken) return;

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
        if (res.totalLimit !== undefined) {
            window._botQuotaState = {
                totalUsed: res.totalUsed ?? res.used ?? 0,
                totalLimit: res.totalLimit ?? res.limit ?? 0
            };
        }
        const rem = Math.max(0, (res.totalLimit || res.limit || 0) - (res.totalUsed ?? res.used ?? 0));
        const quotaTxt = (res.totalLimit || res.limit) >= 9999 ? 'Unlimited (Admin)' : `Sisa ${rem}/${res.totalLimit || res.limit} token hari ini`;
        const cacheTag = res.cached ? ' • <span style="color:#059669; font-weight:700;">Cache Hemat (0 Token)</span>' : '';
        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                <strong style="color:#0369a1;"><i class="fas fa-robot"></i> MenujuASN-BOT</strong>
                <span style="font-size:0.72rem; color:#475569;"><b>${quotaTxt}</b>${cacheTag}</span>
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
    window.renderBotDrillPanel(Boolean(window._botAiAnalyzed));
    const qExp = document.getElementById('qExplainLabel');
    const qWeak = document.getElementById('qWeaknessLabel');
    if (!window.currentUser) return;
    try {
        const res = await callMenujuAsnBot({ action: 'quota' });
        window._botQuotaState = res;
        const totLim = res.totalLimit ?? res.limits?.total ?? 0;
        const totUsed = res.totalUsed ?? 0;
        const fmt = (used, lim) => lim >= 9999 ? 'Unlimited (Admin)' : (lim <= 0 ? 'Terkunci (Free)' : `${Math.max(0, lim - used)} / ${lim} Token`);
        if (qExp) qExp.textContent = fmt(totUsed, totLim);
        if (qWeak) qWeak.textContent = 'Bronze 10 • Silver 20 • Gold 30';
    } catch (e) {
        if (qExp) qExp.textContent = 'Belum aktif';
    }
};

function collectWeakQuestionsFromBrankas() {
    const history = getBrankasHistory().slice(0, 10);
    const seenIds = new Set();
    const weakList = [];
    history.forEach(att => {
        (att.items || []).forEach(it => {
            if (!it || !it.id || seenIds.has(it.id)) return;
            if (it.userAns && !it.isCorrect) {
                seenIds.add(it.id);
                weakList.push({
                    id: it.id,
                    kategori: it.kategori || 'SKD',
                    subKategori: it.subKategori || 'Umum',
                    soal: it.soal || '',
                    opsi: it.opsi || [],
                    pembahasan: it.pembahasan || '',
                    gambar: it.gambar || ''
                });
            }
        });
    });
    return weakList;
}

window._botDrillFilterCat = 'ALL';
window.setBotDrillFilter = (cat) => {
    window._botDrillFilterCat = cat;
    window.renderBotDrillPanel(Boolean(window._botAiAnalyzed));
};

window.renderBotDrillPanel = (aiReady = false) => {
    const box = document.getElementById('botDrillRecommendBox');
    if (!box) return;
    const allWeak = collectWeakQuestionsFromBrankas();
    if (!allWeak.length) {
        box.innerHTML = `<div class="bot-drill-summary">Belum ada soal yang salah/belum maksimal dari soal yang sudah kamu jawab di Brankas. Kerjakan simulasi dulu atau pertahankan akurasimu!</div>`;
        return;
    }

    const counts = { ALL: allWeak.length, TWK: 0, TIU: 0, TKP: 0 };
    const topicCounts = {};
    allWeak.forEach(q => {
        const kat = String(q.kategori || '').toUpperCase();
        if (counts[kat] !== undefined) counts[kat] += 1;
        const tk = `${kat} • ${q.subKategori || 'Umum'}`;
        topicCounts[tk] = (topicCounts[tk] || 0) + 1;
    });

    const activeCat = (window._botDrillFilterCat && (window._botDrillFilterCat === 'ALL' || counts[window._botDrillFilterCat] > 0))
        ? window._botDrillFilterCat
        : 'ALL';
    window._botDrillFilterCat = activeCat;

    const filteredCount = activeCat === 'ALL' ? allWeak.length : (counts[activeCat] || 0);
    const topTopics = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k, v]) => `<b>${escapeHtmlMentor(k)}</b> (${v})`)
        .join(', ');

    const cats = ['ALL', 'TWK', 'TIU', 'TKP'].filter(c => c === 'ALL' || counts[c] > 0);
    const chipsHtml = cats.map(c => {
        const label = c === 'ALL' ? `Semua (${counts.ALL})` : `${c} (${counts[c]})`;
        return `<button type="button" class="bot-drill-chip ${activeCat === c ? 'active' : ''}" onclick="window.setBotDrillFilter('${c}')">${label}</button>`;
    }).join('');

    box.innerHTML = `
        ${aiReady ? `<div class="bot-drill-badge"><i class="fas fa-bolt"></i> Paket Ulang Rekomendasi AI Siap!</div>` : ''}
        <div class="bot-drill-summary">
            Ditemukan <b>${allWeak.length} soal</b> dari Brankas yang jawabannya masih salah / belum poin maksimal.<br/>
            <span style="font-size:0.78rem; color:#475569;">Fokus topik: ${topTopics}</span>
        </div>
        <div class="bot-drill-chips">${chipsHtml}</div>
        <div class="bot-drill-actions">
            <button type="button" class="btn-card primary" onclick="window.mulaiLatihanUlangBot('cat')">
                <i class="fas fa-stopwatch"></i> Mode CAT (${filteredCount} Soal)
            </button>
            <button type="button" class="btn-card paid-cta" onclick="window.mulaiLatihanUlangBot('drill')">
                <i class="fas fa-bolt"></i> Mode Drill (Langsung Jawaban)
            </button>
        </div>
    `;
};

window.mulaiLatihanUlangBot = (mode = 'drill') => {
    const allWeak = collectWeakQuestionsFromBrankas();
    const cat = window._botDrillFilterCat || 'ALL';
    const selected = cat === 'ALL'
        ? allWeak
        : allWeak.filter(q => String(q.kategori || '').toUpperCase() === cat);

    if (!selected.length) {
        return Swal.fire('Belum Ada Soal', 'Tidak ada soal lemah pada kategori yang dipilih.', 'info');
    }

    window.currentQuestions = selected.map(q => ({
        id: q.id,
        kategori: q.kategori,
        subKategori: q.subKategori,
        soal: q.soal,
        opsi: q.opsi,
        pembahasan: q.pembahasan,
        gambar: q.gambar || ''
    }));
    window.examTimeRemaining = window.currentQuestions.length * 60;
    window.currentAppMode = 'singleplayer';
    window.currentPackageMeta = {
        saveId: `bot_ulang_${cat}_${Date.now()}`,
        tipe: 'remedial',
        paketNo: null,
        title: mode === 'drill'
            ? `Drill Rekomendasi BOT (${cat})`
            : `CAT Ulang Rekomendasi BOT (${cat})`,
        totalDurationSeconds: window.examTimeRemaining
    };
    startExamSessionUI();
    window.isInstantReviewMode = (mode === 'drill');
    if (mode === 'drill') {
        renderSoalSekarang();
    }
};

window.jalankanAnalisisKelemahanAI = async () => {
    const outBox = document.getElementById('botWeaknessResult');
    if (!outBox) return;
    const rawList = getBrankasHistory();
    if (!rawList.length) {
        outBox.style.display = 'block';
        outBox.innerHTML = 'Belum ada riwayat simulasi di Brankas Pembahasan. Kerjakan minimal 1 latihan/tryout dulu agar MenujuASN-BOT bisa membaca pola kelemahanmu.';
        return;
    }

    const okToken = await window.konfirmasiPakaiTokenBot('Crosscheck Kelemahan Strategis');
    if (!okToken) return;

    const recent = rawList.slice(0, 8);
    const subKatErrors = {};
    const katTotals = { TWK: { got: 0, max: 0 }, TIU: { got: 0, max: 0 }, TKP: { got: 0, max: 0 } };
    const summaryLines = recent.map((att, idx) => {
        (att.items || []).forEach(it => {
            if (!it.userAns) return;
            const kat = String(it.kategori || '').toUpperCase();
            if (katTotals[kat]) {
                katTotals[kat].got += Number(it.userPoin || 0);
                katTotals[kat].max += Number(it.maxPoin || 5);
            }
            if (!it.isCorrect) {
                const k = `${it.kategori || 'SKD'} (${it.subKategori || 'Umum'})`;
                subKatErrors[k] = (subKatErrors[k] || 0) + 1;
            }
        });
        const twk = Number(att.skorTWK ?? att.twkScore ?? 0);
        const tiu = Number(att.skorTIU ?? att.tiuScore ?? 0);
        const tkp = Number(att.skorTKP ?? att.tkpScore ?? 0);
        const tot = Number(att.totalSkor ?? (twk + tiu + tkp));
        const maxS = Number(att.maxSkor ?? ((att.totalQuestions || 0) * 5));
        const ans = Number(att.answeredCount ?? 0);
        const totQ = Number(att.totalQuestions || 0);
        const ansWrong = (att.items || []).filter(it => it.userAns && !it.isCorrect).length;
        return `${idx + 1}. ${att.title}: Skor=${tot}/${maxS} (TWK=${twk}, TIU=${tiu}, TKP=${tkp}), Dijawab=${ans}/${totQ}, Belum Maksimal=${ansWrong}/${ans || totQ}`;
    });
    const akurasiKat = Object.entries(katTotals)
        .filter(([, v]) => v.max > 0)
        .map(([k, v]) => `- ${k}: ${v.got}/${v.max} poin (${Math.round((v.got / v.max) * 100)}%)`)
        .join('\n');
    const topWeak = Object.entries(subKatErrors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([k, v]) => `- ${k}: ${v} soal belum maksimal`)
        .join('\n');

    const statsSummary = `Riwayat ${recent.length} latihan terakhir:\n${summaryLines.join('\n')}\n\nCapaian poin per kategori dari soal yang dikerjakan:\n${akurasiKat || '- Belum ada'}\n\nTopik paling sering salah/belum maksimal:\n${topWeak || '- Belum terdeteksi'}`;

    outBox.style.display = 'block';
    outBox.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <strong>MenujuASN-BOT</strong> sedang menganalisis kelemahanmu...`;
    try {
        const res = await callMenujuAsnBot({ action: 'weakness', statsSummary });
        window._botAiAnalyzed = true;
        outBox.innerHTML = `<div>${formatBotTextHtml(res.reply)}</div>`;
        window.refreshBotAndNewsView();
    } catch (err) {
        outBox.innerHTML = `<span style="color:#b91c1c;"><i class="fas fa-exclamation-circle"></i> ${escapeHtmlMentor(err.message)}</span>`;
    }
};

const DEFAULT_CURATED_NEWS = [
    {
        id: 'curated-menpan-pppk-cpns-2026',
        tag: 'KEMENPAN-RB',
        dateLabel: '06 Nov 2026',
        title: 'Pemerintah dan DPR Sepakati Pengangkatan PPPK Paruh Waktu Menjadi Penuh Waktu, Rekrutmen CPNS Dibuka 2026',
        desc: 'Pemerintah dan Komisi II DPR RI menyepakati peningkatan status seluruh PPPK Paruh Waktu lintas profesi menjadi Penuh Waktu secara bertahap, serta pembukaan rekrutmen CPNS 2026.',
        url: 'https://menpan.go.id/posts/pemerintah-dan-dpr-sepakati-pengangkatan-pppk-paruh-waktu-menjadi-penuh-waktu-rekrutmen-cpns-dibuka-tahun-2026',
        imageUrl: 'https://menpan.go.id/media/2026/11/07/20261106-rapat-koordinasi-tindak-lanjut-pembahasan-status-pppk-dan-pppk-paruh-waktu-lintas-profesi.webp',
        fallbackImage: 'assets/news/news-menpan.svg',
        createdAtMs: 1794000000000
    },
    {
        id: 'curated-cnbc-sscasn-2026',
        tag: 'CNBC INDONESIA',
        dateLabel: '14 Nov 2026',
        title: 'Pengumuman! Pembuatan Akun Dibuka, Daftar CPNS Mulai 23 November 2026',
        desc: 'BKN membuka portal registrasi akun SSCASN lebih awal menjelang pendaftaran formasi CPNS yang direncanakan mulai pekan keempat November 2026 dengan kuota hingga 158.000 formasi.',
        url: 'https://www.cnbcindonesia.com/news/20261114122411-4-785216/pengumuman-pembuatan-akun-dibuka-daftar-cpns-mulai-23-november-2026',
        imageUrl: 'assets/news/news-sscasn.svg',
        fallbackImage: 'assets/news/news-sscasn.svg',
        createdAtMs: 1794650000000
    },
    {
        id: 'curated-kompas-akun-sscasn-2026',
        tag: 'KOMPAS.COM',
        dateLabel: '15 Nov 2026',
        title: 'Akun SSCASN CPNS 2026 Mulai Dibuka, Ini Link dan Cara Daftarnya',
        desc: 'Portal resmi sscasn.bkn.go.id sudah dapat diakses untuk membuat akun CASN/CPNS 2026. Siapkan NIK KTP, Kartu Keluarga, swafoto, serta ijazah sebelum pendaftaran formasi dibuka.',
        url: 'https://www.kompas.com/tren/read/2026/11/15/113000865/akun-sscasn-cpns-2026-mulai-dibuka-ini-link-dan-cara-daftarnya',
        imageUrl: 'assets/news/news-akun-cpns.svg',
        fallbackImage: 'assets/news/news-akun-cpns.svg',
        createdAtMs: 1794730000000
    },
    {
        id: 'curated-antara-pppk-2027',
        tag: 'ANTARA NEWS',
        dateLabel: '06 Nov 2026',
        title: 'Pemerintah Angkat PPPK Paruh Waktu Jadi Penuh Waktu per 1 Januari 2027',
        desc: 'Perubahan status PPPK Paruh Waktu menjadi Penuh Waktu mulai berlaku efektif 1 Januari 2027 secara bertahap sesuai regulasi turunan, validasi data BKN, dan kesiapan anggaran.',
        url: 'https://www.antaranews.com/berita/5836295/pemerintah-angkat-pppk-paruh-waktu-jadi-penuh-waktu-per-1-januari-2027',
        imageUrl: 'assets/news/news-pppk.svg',
        fallbackImage: 'assets/news/news-pppk.svg',
        createdAtMs: 1793950000000
    },
    {
        id: 'curated-detik-pppk-cpns-2027',
        tag: 'DETIKCOM',
        dateLabel: '07 Nov 2026',
        title: 'Pemerintah Perbolehkan PPPK Ikut Seleksi CPNS 2027',
        desc: 'PPPK Penuh Waktu resmi diizinkan mengikuti seleksi CPNS 2027 secara kompetitif. Jika belum lolos, status kepegawaian PPPK tetap aman dan tidak gugur.',
        url: 'https://www.detik.com/sumut/berita/d-8741601/pemerintah-perbolehkan-pppk-ikut-seleksi-cpns-2027',
        imageUrl: 'assets/news/news-pppk-cpns.svg',
        fallbackImage: 'assets/news/news-pppk-cpns.svg',
        createdAtMs: 1794050000000
    },
    {
        id: 'curated-bisnis-syarat-pppk-2027',
        tag: 'BISNIS.COM',
        dateLabel: '07 Nov 2026',
        title: 'PPPK Bisa Daftar CPNS 2027, Pemerintah Kaji Syarat Khusus Tiap Profesi',
        desc: 'KemenPAN-RB bersama BKN tengah mengkaji syarat afirmasi bagi PPPK yang mendaftar CPNS 2027, termasuk relaksasi batas usia di atas 35 tahun dan konversi masa kerja.',
        url: 'https://kabar24.bisnis.com/read/20261107/15/2019246/pppk-bisa-daftar-cpns-2027-pemerintah-kaji-syarat-khusus-tiap-profesi',
        imageUrl: 'assets/news/news-afirmasi.svg',
        fallbackImage: 'assets/news/news-afirmasi.svg',
        createdAtMs: 1794040000000
    }
];

function renderNewsCardHtml(n) {
    const fallbackImg = escapeHtmlMentor(n.fallbackImage || 'assets/news/news-menpan.svg');
    const imgSrc = escapeHtmlMentor(n.imageUrl || fallbackImg);
    const dateText = n.dateLabel
        ? escapeHtmlMentor(n.dateLabel)
        : (n.createdAtMs ? new Date(n.createdAtMs).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Info Terbaru');

    return `
        <article class="news-card">
            <div class="news-thumb-wrap">
                <img class="news-thumb" src="${imgSrc}" alt="${escapeHtmlMentor(n.title || 'Berita CASN')}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImg}';" />
            </div>
            <div class="news-body">
                <div>
                    <div class="news-meta-row">
                        <span class="news-tag">${escapeHtmlMentor(n.tag || 'INFO CASN')}</span>
                        <span class="news-date"><i class="far fa-calendar-alt"></i> ${dateText}</span>
                    </div>
                    <h4>${escapeHtmlMentor(n.title || 'Pengumuman CASN')}</h4>
                    ${n.desc ? `<p>${escapeHtmlMentor(n.desc)}</p>` : ''}
                </div>
                <a class="btn-news-open" href="${escapeHtmlMentor(n.url)}" target="_blank" rel="noopener noreferrer">
                    Selengkapnya <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        </article>
    `;
}

window.loadPusatBerita = async () => {
    const userListEl = document.getElementById('pusatBeritaList');
    const adminListEl = document.getElementById('ccNewsAdminList');
    let adminItems = [];
    try {
        const snap = await getDocs(query(collection(db, 'cpns_news'), limit(30)));
        snap.forEach(d => adminItems.push({ id: d.id, ...d.data() }));
        adminItems.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
    } catch (err) {
        console.warn('Gagal mengambil berita Firestore, menampilkan berita kurasi default:', err?.message);
    }

    const adminUrls = new Set(adminItems.map(item => (item.url || '').trim()));
    const mergedItems = [
        ...adminItems,
        ...DEFAULT_CURATED_NEWS.filter(item => !adminUrls.has(item.url))
    ].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

    if (userListEl) {
        if (!mergedItems.length) {
            userListEl.innerHTML = '<div class="cc-empty">Belum ada berita terbaru dari Admin.</div>';
        } else {
            userListEl.innerHTML = mergedItems.map(renderNewsCardHtml).join('');
        }
    }

    if (adminListEl) {
        if (!adminItems.length) {
            adminListEl.innerHTML = '<div class="cc-empty">Belum ada link berita tambahan dari Admin (6 berita kurasi terbaru otomatis aktif untuk peserta).</div>';
        } else {
            adminListEl.innerHTML = adminItems.map(n => `
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
};

window.adminTambahBerita = async () => {
    if (!window.currentUserProfile?.isAdmin) return;
    const title = document.getElementById('ccNewsTitle')?.value.trim();
    const url = document.getElementById('ccNewsUrl')?.value.trim();
    const tag = document.getElementById('ccNewsTag')?.value.trim() || 'BKN';
    const imageUrl = document.getElementById('ccNewsImage')?.value.trim() || '';
    const desc = document.getElementById('ccNewsDesc')?.value.trim() || '';

    if (!title || !url || !/^https?:\/\//i.test(url)) {
        return Swal.fire('Data Belum Lengkap', 'Isi Judul Berita dan URL valid yang diawali https:// atau http://', 'warning');
    }
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
        return Swal.fire('URL Foto Tidak Valid', 'URL Foto Berita harus diawali https:// atau http:// (atau kosongkan).', 'warning');
    }

    try {
        await addDoc(collection(db, 'cpns_news'), {
            title,
            url,
            tag,
            imageUrl,
            desc,
            createdAtMs: Date.now(),
            authorEmail: window.currentUser?.email || ''
        });
        document.getElementById('ccNewsTitle').value = '';
        document.getElementById('ccNewsUrl').value = '';
        if (document.getElementById('ccNewsImage')) document.getElementById('ccNewsImage').value = '';
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

// ==========================================================
// PUSAT STUDI ASN - HALAMAN TIPS & TRIK + MODE PELATIHAN INTERAKTIF
// ==========================================================
const PUSAT_STUDI_DATA = {
    twk: {
        title: 'Modul & Tips Trik TWK (Tes Wawasan Kebangsaan)',
        subtitle: 'Kisi-kisi resmi BKN • Passing Grade 65 • Saripati Bank Soal Part 1 & Part 2 + Tabel Praktis UUD 1945.',
        bannerClass: 'navy',
        topics: [
            {
                id: 'twk-nasionalisme',
                badge: 'BAB 1 • NASIONALISME',
                title: 'Trik Membedakan Nasionalisme Adaptif vs Chauvinisme',
                summary: 'Soal TWK Part 1 & 2 sering menguji studi kasus benturan budaya lokal, teknologi modern, atau produk asing.',
                points: [
                    'Pilih jawaban yang merangkul kemajuan zaman sambil menjaga jati diri/budaya lokal (adaptif, bukan anti-asing secara membabi buta).',
                    'Hindari opsi yang bersikap sempit, memaksa kehendak, atau mengucilkan kelompok tertentu.',
                    'Dalam kasus ASN di daerah, selalu utamakan persatuan NKRI di atas kepentingan golongan/daerah sendiri.'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Patriotisme vs Nasionalisme</strong>
                            Nasionalisme = <b>Kesetiaan & cinta bangsa</b> (identitas bersama).<br>
                            Patriotisme = <b>Kerelaan berkorban nyata</b> demi tanah air.
                        </div>
                        <div class="studi-formula-card">
                            <strong>3 Paham Jebakan (Hindari!)</strong>
                            • <b>Chauvinisme:</b> Mengagung-agungkan bangsa sendiri & merendahkan bangsa lain.<br>
                            • <b>Etnosentrisme:</b> Menganggap budaya suku sendiri paling superior.<br>
                            • <b>Primordialisme:</b> Ikatan bawaan berlebihan yang menghambat integrasi.
                        </div>
                    </div>
                `,
                goodKeywords: 'Kolaborasi tradisi & inovasi, jati diri bangsa, persatuan lintas suku/budaya, cinta produk dalam negeri secara sehat.',
                trapKeywords: 'Menutup diri total dari modernisasi, menganggap budaya sendiri paling unggul (chauvinisme), membatalkan kegiatan tanpa dialog.',
                exampleQ: 'Sebuah komunitas pemuda berencana mengganti seni tradisional pada festival tahunan dengan budaya populer luar negeri seluruhnya. Langkah pembinaan nasionalisme yang tepat adalah...',
                exampleAns: '<b>Kunci: Mengajak komunitas memadukan kreativitas modern dengan warisan budaya lokal agar diminati generasi muda.</b><br><i>Trik:</i> Nasionalisme budaya tidak menolak modernitas, melainkan menjaga akar lokal tetap hidup dan relevan.',
                quiz: [
                    {
                        q: 'Sebuah komunitas pemuda di daerah wisata berencana mengganti seluruh pertunjukan seni tradisional pada festival tahunan dengan konser budaya populer luar negeri agar lebih viral. Sebagai ASN Dinas Kebudayaan, langkah pembinaan nasionalisme yang paling tepat adalah...',
                        options: [
                            'Melarang tegas penyelenggaraan festival tersebut karena merusak moral generasi muda.',
                            'Membiarkan saja karena selera masyarakat terus berubah mengikuti globalisasi.',
                            'Mengajak komunitas berkolaborasi memadukan kemasan kreatif modern dengan akar seni tradisi lokal agar tetap relevan dan membanggakan.',
                            'Mewajibkan seluruh penonton dan panitia menghafal sejarah kesenian daerah sebelum acara dimulai.',
                            'Mengalihkan seluruh anggaran festival untuk pembangunan fisik kantor dinas.'
                        ],
                        ans: 2,
                        explain: '<b>Skor Penuh (Opsi C):</b> Nasionalisme di era global bersifat <b>adaptif & terbuka</b>—memanfaatkan kreativitas modern untuk mengangkat harkat budaya lokal tanpa sikap tertutup (xenofobia) maupun kehilangan jati diri.'
                    }
                ]
            },
            {
                id: 'twk-integritas',
                badge: 'BAB 2 • INTEGRITAS ASN',
                title: 'Kunci Mutlak Soal Integritas & Anti-Korupsi (Jumat Bersepeda KK)',
                summary: 'Integritas diukur dari keselarasan antara hati, ucapan, dan tindakan nyata sesuai aturan hukum/SOP meski tanpa pengawasan.',
                points: [
                    'Hafalkan 9 Nilai Anti-Korupsi KPK dengan jembatan keledai: "JUMAT BERSEPEDA KK" (Jujur, Mandiri, Tanggung Jawab, Berani, Sederhana, Peduli, Disiplin, Adil, Kerja Keras).',
                    'Tolak tegas segala bentuk gratifikasi, suap, atau fasilitas khusus—sekecil apa pun nilainya dan meski dibungkus alasan "tanda terima kasih / silaturahmi".',
                    'Jika menemukan pelanggaran rekan/atasan, pilih opsi klarifikasi/lapor lewat jalur resmi (WBS/Inspektorat/UPG), bukan ikut menutupi atau memviralkan di medsos.'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Jembatan Keledai 9 Nilai Integritas KPK</strong>
                            <span class="studi-formula-code">JUMAT BERSEPEDA KK</span><br>
                            • <b>Inti (3):</b> Jujur, Disiplin, Tanggung Jawab<br>
                            • <b>Etos Kerja (3):</b> Mandiri, Kerja Keras, Sederhana<br>
                            • <b>Sikap (3):</b> Berani, Peduli, Adil
                        </div>
                        <div class="studi-formula-card">
                            <strong>Rumus Cepat Soal Konflik Kepentingan</strong>
                            Ada Hadiah/Bingkisan Rekanan? → <b>Tolak Sopan + Lapor UPG/KPK</b>.<br>
                            Keluarga Minta "Jalur Dalam"? → <b>Tolak Tegas + Arahkan Prosedur Resmi</b>.
                        </div>
                    </div>
                `,
                goodKeywords: 'Transparan, akuntabel, tolak gratifikasi, patuh SOP, lapor jalur resmi (UPG/WBS), pisahkan aset dinas vs pribadi.',
                trapKeywords: 'Menerima demi menghargai pemberi, mendiamkan pelanggaran demi solidaritas korps semu, memakai fasilitas dinas untuk keluarga.',
                exampleQ: 'Seorang rekanan proyek memberikan bingkisan ke rumah Anda setelah kontrak selesai dengan alasan silaturahmi. Sikap berintegritas adalah...',
                exampleAns: '<b>Kunci: Menolak dengan sopan dan melaporkan potensi gratifikasi kepada UPG/atasan sesuai ketentuan KPK.</b><br><i>Trik:</i> Pada soal integritas, tidak ada toleransi "nilai kecil" jika berkaitan dengan jabatan/rekanan.',
                quiz: [
                    {
                        q: 'Setelah proses pengadaan barang di instansi Anda selesai sesuai prosedur, pihak vendor mengirimkan parsel berisi voucher belanja ke rumah Anda sebagai ungkapan terima kasih. Sikap yang mencerminkan integritas ASN adalah...',
                        options: [
                            'Menerima parsel tersebut karena proyek sudah selesai sehingga tidak memengaruhi keputusan.',
                            'Menerima lalu membagikan voucher tersebut kepada petugas kebersihan kantor agar bermanfaat.',
                            'Menolak secara sopan pemberian tersebut dan melaporkan kejadian itu ke Unit Pengendalian Gratifikasi (UPG) instansi.',
                            'Menyimpan parsel tersebut tanpa memberi tahu siapa pun agar tidak menimbulkan kegaduhan.',
                            'Meminta vendor mengganti parsel dengan sumbangan uang tunai untuk acara rekreasi divisi.'
                        ],
                        ans: 2,
                        explain: '<b>Skor Penuh (Opsi C):</b> Setiap pemberian yang berhubungan dengan jabatan/rekanan termasuk <b>gratifikasi</b>. Kunci mutlaknya: <b>Tolak dengan sopan + Lapor ke UPG/KPK</b> (tidak boleh diterima walau untuk disumbangkan sendiri).'
                    }
                ]
            },
            {
                id: 'twk-bela-negara',
                badge: 'BAB 3 • BELA NEGARA',
                title: '5 Nilai Dasar Bela Negara & Pasal 27 Ayat (3) vs Pasal 30 Ayat (1)',
                summary: 'Bela negara di SKD modern menguji kontribusi nyata sesuai profesi, literasi digital, serta pembedaan pasal UUD 1945.',
                points: [
                    'Ingat 5 Nilai Dasar Bela Negara: (1) Cinta Tanah Air, (2) Sadar Berbangsa & Bernegara, (3) Setia pada Pancasila sebagai Ideologi, (4) Rela Berkorban untuk Bangsa & Negara, (5) Kemampuan Awal Bela Negara.',
                    'Jangan tertukar pasal! Pasal 27 ayat (3) = Hak & kewajiban warga dalam "upaya pembelaan negara"; Pasal 30 ayat (1) = Usaha "pertahanan dan keamanan negara" (TNI komponen utama, Polri kekuatan pendukung).',
                    'Di ruang digital, memeriksa fakta sebelum menyebarkan berita (anti-hoaks SARA) adalah wujud nyata Bela Negara non-fisik.'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Pembeda Kilat Pasal Bela Negara vs Hankam</strong>
                            • <span class="studi-formula-code">Pasal 27 ayat (3)</span> → Kata kunci: <b>"Upaya Pembelaan Negara"</b> (Bab X Warga Negara).<br>
                            • <span class="studi-formula-code">Pasal 30 ayat (1)</span> → Kata kunci: <b>"Pertahanan & Keamanan Negara"</b> (Bab XII Hankam, Sishankamrata).
                        </div>
                        <div class="studi-formula-card">
                            <strong>Kemampuan Awal Bela Negara</strong>
                            • <b>Fisik:</b> Menjaga kesehatan, kebugaran, olahraga rutin.<br>
                            • <b>Non-Fisik (Psikis):</b> Disiplin, ulet, tahan uji, melek literasi digital.
                        </div>
                    </div>
                `,
                goodKeywords: 'Verifikasi fakta anti-hoaks, pengabdian sesuai profesi, cinta produk lokal, Pasal 27 ayat (3) = Bela Negara.',
                trapKeywords: 'Menganggap bela negara hanya angkat senjata/tugas TNI-Polri, tertukar Pasal 27 ayat (3) dengan Pasal 30 ayat (1).',
                exampleQ: 'Anda menerima pesan berantai di grup kerja yang memprovokasi isu SARA tanpa sumber jelas menjelang pemilu. Tindakan bela negara yang tepat adalah...',
                exampleAns: '<b>Kunci: Tidak meneruskan pesan, memverifikasi kebenarannya lewat kanal resmi, dan mengedukasi grup agar tetap kondusif.</b>',
                quiz: [
                    {
                        q: 'Seorang dokter ASN bersedia ditempatkan di puskesmas wilayah kepulauan terluar (3T) dengan keterbatasan fasilitas demi menekan angka stunting warga setempat, meskipun ia mendapat tawaran gaji besar di rumah sakit swasta ibu kota. Nilai dasar Bela Negara yang paling menonjol adalah...',
                        options: [
                            'Kemampuan awal bela negara secara fisik dan militer.',
                            'Rela berkorban untuk bangsa dan negara melalui pengabdian profesi.',
                            'Kewajiban pertahanan keamanan negara sesuai Pasal 30 ayat (2) UUD 1945.',
                            'Sikap chauvinisme dalam mempertahankan wilayah perbatasan.',
                            'Kepatuhan pasif demi menghindari sanksi disiplin kepegawaian.'
                        ],
                        ans: 1,
                        explain: '<b>Skor Penuh (Opsi B):</b> Mengutamakan kepentingan masyarakat/bangsa di wilayah 3T di atas kenyamanan dan keuntungan finansial pribadi merupakan indikator utama <b>Rela Berkorban untuk Bangsa dan Negara</b>.'
                    }
                ]
            },
            {
                id: 'twk-pilar-pancasila',
                badge: 'BAB 4 • PANCASILA & TOKOH PERUMUS',
                title: 'Bedah Tajam Sila 1–5 & Rumusan Tokoh Pendiri Bangsa (Yamin, Soepomo, Soekarno)',
                summary: 'Banyak peserta terkecoh antara Sila ke-2 vs Sila ke-5, serta urutan usulan dasar negara pada Sidang BPUPKI I (29 Mei – 1 Juni 1945).',
                points: [
                    'Jembatan Keledai Tokoh BPUPKI I: "Y-S-S" (29 Mei = Moh. Yamin, 31 Mei = Soepomo dengan konsep Negara Integralistik, 1 Juni = Ir. Soekarno dengan istilah Pancasila, Trisila, Ekasila/Gotong Royong).',
                    'Pembeda Sila ke-2 vs Sila ke-5: Sila ke-2 fokus pada "Martabat Kemanusiaan, Empati Personal, & Kesetaraan Derajat Manusia"; Sila ke-5 fokus pada "Keadilan Sosial, Pemerataan Fasilitas Publik, Hak-Kewajiban, & Hidup Hemat/Tidak Boros".',
                    'Pembeda Sila ke-3 vs Sila ke-1: Toleransi antarumat beragama agar bebas beribadah = Sila ke-1; Kerukunan lintas suku/budaya demi keutuhan NKRI = Sila ke-3.'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Rumus Kilat Bedah Sila Pancasila</strong>
                            • <b>Sila 1:</b> Ibadah, keyakinan, toleransi agama.<br>
                            • <b>Sila 2:</b> Empati kemanusiaan, bencana, anti-perundungan, HAM personal.<br>
                            • <b>Sila 3:</b> Persatuan, rela berkorban, bangga produk RI.<br>
                            • <b>Sila 4:</b> Musyawarah, demokrasi, tidak paksakan kehendak.<br>
                            • <b>Sila 5:</b> Pemerataan pembangunan, adil hukum/ekonomi, menghargai karya orang lain.
                        </div>
                        <div class="studi-formula-card">
                            <strong>Kode Garuda Pancasila (17-8-19-45)</strong>
                            • <b>17</b> helai bulu sayap (Tanggal)<br>
                            • <b>8</b> helai bulu ekor (Bulan Agustus)<br>
                            • <b>19</b> helai bulu pangkal ekor + <b>45</b> helai bulu leher (Tahun 1945).
                        </div>
                    </div>
                `,
                goodKeywords: 'Musyawarah mufakat (Sila 4), kemanusiaan/empati (Sila 2), pemerataan fasilitas publik & menghargai karya (Sila 5).',
                trapKeywords: 'Menjawab Sila 2 untuk kasus pemerataan pembangunan jalan/subsidi (seharusnya Sila 5), atau menjawab Sila 3 untuk kasus ibadah agama.',
                exampleQ: 'Pemerintah membangun akses jalan dan puskesmas yang setara di wilayah 3T agar masyarakat terpencil mendapat layanan kesehatan layak. Hal ini mencerminkan sila ke...',
                exampleAns: '<b>Kunci: Sila ke-5 (Keadilan Sosial bagi Seluruh Rakyat Indonesia) dan amanat Pasal 34 UUD 1945.</b>',
                quiz: [
                    {
                        q: 'Seorang kreator konten selalu mencantumkan sumber asli dan membayar lisensi resmi saat menggunakan karya musik musisi lokal, serta menolak menggunakan barang bajakan. Tindakan tersebut merupakan pengamalan Pancasila khususnya...',
                        options: [
                            'Sila ke-1 karena berkaitan dengan kejujuran spiritual.',
                            'Sila ke-2 karena menolong sesama manusia yang sedang kesulitan.',
                            'Sila ke-3 karena mencintai produk dalam negeri.',
                            'Sila ke-4 karena menghargai kesepakatan musyawarah.',
                            'Sila ke-5 karena menghargai hasil karya orang lain yang bermanfaat bagi kemajuan dan kesejahteraan bersama.'
                        ],
                        ans: 4,
                        explain: '<b>Skor Penuh (Opsi E):</b> Butir resmi pengamalan <b>Sila ke-5</b> mencakup: <i>"Menghargai hasil karya orang lain yang bermanfaat bagi kemajuan dan kesejahteraan bersama"</i> serta menjaga keseimbangan antara hak dan kewajiban.'
                    }
                ]
            },
            {
                id: 'twk-uud-amandemen',
                badge: 'BAB 5 • TABEL PRAKTIS UUD 1945',
                title: 'Trik Hafalan Pasal UUD 1945, Hak Presiden (MA vs DPR) & Kode Bintang Amandemen',
                summary: 'Disarikan langsung dari Modul Tabel Praktis UUD 1945 & Hafalan Amandemen I–IV: kuasai kewenangan Presiden dan kuorum sidang!',
                points: [
                    'Trik "MA-GA-RE" vs "DPR-A-A": Presiden memberi Grasi & Rehabilitasi dengan memperhatikan pertimbangan MA (Mahkamah Agung — urusan hukum/pengadilan); sedangkan Amnesti & Abolisi memperhatikan pertimbangan DPR (Pasal 14 ayat 1 & 2).',
                    'Duta & Konsul (Pasal 13): Mengangkat Duta & menerima Duta negara lain wajib memperhatikan pertimbangan DPR.',
                    'Kode Tahun Amandemen I–IV: Amandemen I (19 Okt 1999 - fokus batasi kekuasaan Presiden), Amandemen II (18 Agu 2000 - fokus Pemda & HAM Pasal 28A–28J), Amandemen III (9 Nov 2001 - fokus MK, KY, DPD, Pilpres langsung), Amandemen IV (10 Agu 2002 - fokus penghapusan DPA, Pendidikan 20%, Ekonomi).'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Rumus Kilat Pasal 14 (Presiden: MA vs DPR)</strong>
                            • <span class="studi-formula-code">Grasi & Rehabilitasi → MA</span> (Ingat: <b>Gara-Gara MA</b>)<br>
                            • <span class="studi-formula-code">Amnesti & Abolisi → DPR</span> (Ingat: <b>AA DPR</b>)
                        </div>
                        <div class="studi-formula-card">
                            <strong>Kuorum Keramat MPR (Pasal 7B vs Pasal 37)</strong>
                            • <b>Pemakzulan Presiden (Ps. 7B):</b> Usul DPR (hadir 2/3, setuju 2/3) → Uji MK → Sidang MPR (hadir <b>3/4</b>, setuju <b>2/3</b>).<br>
                            • <b>Ubah UUD 1945 (Ps. 37):</b> Usul <b>1/3</b> anggota MPR → Hadir <b>2/3</b> → Setuju <b>50% + 1</b> seluruh anggota MPR. (Khusus bentuk NKRI tidak dapat diubah!).
                        </div>
                    </div>
                `,
                goodKeywords: 'Grasi-Rehabilitasi = MA, Amnesti-Abolisi = DPR, HAM 28A-28J = Amandemen II (2000), MK & DPD = Amandemen III (2001).',
                trapKeywords: 'Tertukar pertimbangan MA dan DPR pada Pasal 14, atau tertukar kuorum Pasal 7B (3/4 hadir) dengan Pasal 37 (2/3 hadir).',
                exampleQ: 'Dalam memberikan amnesti dan abolisi, Presiden Republik Indonesia harus memperhatikan pertimbangan dari...',
                exampleAns: '<b>Kunci: Dewan Perwakilan Rakyat (DPR) — sesuai Pasal 14 ayat (2) UUD 1945.</b><br><i>Trik:</i> Ingat rumus <b>AA DPR</b> (Amnesti & Abolisi = DPR), sedangkan <b>Grasi & Rehabilitasi = MA</b>.',
                quiz: [
                    {
                        q: 'Berdasarkan Pasal 14 UUD 1945 hasil amandemen, Presiden berwenang memberikan grasi, rehabilitasi, amnesti, dan abolisi. Pasangan wewenang dan lembaga pemberi pertimbangan yang tepat di bawah ini adalah...',
                        options: [
                            'Grasi dan Amnesti dengan memperhatikan pertimbangan Mahkamah Agung (MA).',
                            'Grasi dan Rehabilitasi dengan memperhatikan pertimbangan Mahkamah Agung (MA).',
                            'Rehabilitasi dan Abolisi dengan memperhatikan pertimbangan DPR.',
                            'Amnesti dan Abolisi dengan memperhatikan pertimbangan Mahkamah Konstitusi (MK).',
                            'Seluruhnya wajib mendapat persetujuan Majelis Permusyawaratan Rakyat (MPR).'
                        ],
                        ans: 1,
                        explain: '<b>Skor Penuh (Opsi B):</b> Sesuai <b>Pasal 14 ayat (1) UUD 1945</b>, Presiden memberi <b>Grasi dan Rehabilitasi</b> dengan memperhatikan pertimbangan <b>Mahkamah Agung (MA)</b>. Sedangkan ayat (2) menyebutkan <b>Amnesti dan Abolisi</b> memperhatikan pertimbangan <b>DPR</b>.'
                    }
                ]
            },
            {
                id: 'twk-sejarah-konstitusi',
                badge: 'BAB 6 • SEJARAH & DIPLOMASI RI',
                title: 'Peta Cepat Pergerakan Nasional, Perundingan Diplomasi & Periode Konstitusi',
                summary: 'Rangkuman padat dari Ringkasan Materi TWK: organisasi pergerakan (1908–1928), perundingan kemerdekaan, dan dinamika UUD.',
                points: [
                    '5 Tonggak Pergerakan Nasional: Budi Utomo (20 Mei 1908 - pendidikan/kebudayaan, pelopor kebangkitan), Sarekat Islam (ekonomi dagang & kerakyatan), Indische Partij (Tiga Serangkai: organisasi politik murni pertama yang menuntut Hindia merdeka), Perhimpunan Indonesia (manifesto politik di Belanda), Sumpah Pemuda (28 Okt 1928).',
                    'Urutan Diplomasi Mempertahankan Kemerdekaan ("LI-REN-RO-KMB"): Linggarjati (pengakuan de facto Jawa, Sumatera, Madura) → Renville (Kapal USS Renville, Komisi Tiga Negara/KTN, garis Van Mook) → Roem-Royen (pengembalian pemerintahan ke Yogyakarta) → KMB (27 Des 1949, pengakuan kedaulatan RIS kecuali Irian Barat).',
                    'Urutan Konstitusi RI: UUD 1945 (1945–1949) → Konstitusi RIS (1949–1950, bentuk serikat) → UUDS 1950 (1950–1959, demokrasi parlementer) → Dekrit Presiden 5 Juli 1959 (kembali ke UUD 1945).'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Urutan 4 Perundingan Diplomasi</strong>
                            <span class="studi-formula-code">LI - REN - RO - KMB</span><br>
                            1. <b>Linggarjati (1946):</b> De facto Jawa, Sumatera, Madura.<br>
                            2. <b>Renville (1948):</b> Diwakili KTN (Australia, Belgia, AS).<br>
                            3. <b>Roem-Royen (1949):</b> Ibu kota kembali ke Jogja.<br>
                            4. <b>KMB (1949):</b> Belanda akui kedaulatan RIS.
                        </div>
                        <div class="studi-formula-card">
                            <strong>Isi Dekrit Presiden 5 Juli 1959</strong>
                            1. Bubarkan Konstituante.<br>
                            2. Berlakunya kembali UUD 1945 & tidak berlakunya UUDS 1950.<br>
                            3. Pembentukan MPRS dan DPAS.
                        </div>
                    </div>
                `,
                goodKeywords: 'Budi Utomo (awal kebangkitan organisasi modern), Indische Partij (politik murni pertama), LI-REN-RO-KMB.',
                trapKeywords: 'Tertukar hasil Linggarjati dengan Renville, atau tertukar negara anggota KTN (Indonesia menunjuk Australia, Belanda menunjuk Belgia, keduanya menunjuk AS).',
                exampleQ: 'Perundingan yang menghasilkan kesepakatan pengembalian pemerintahan Republik Indonesia ke Yogyakarta serta rencana penyelenggaraan Konferensi Meja Bundar adalah...',
                exampleAns: '<b>Kunci: Perundingan Roem-Royen (7 Mei 1949).</b>',
                quiz: [
                    {
                        q: 'Dalam perjuangan diplomasi mempertahankan kemerdekaan Indonesia, dibentuk Komisi Tiga Negara (KTN) oleh PBB untuk memfasilitasi Perundingan Renville. Negara yang dipilih langsung oleh Indonesia untuk mewakili kepentingannya dalam KTN adalah...',
                        options: [
                            'Belgia',
                            'Amerika Serikat',
                            'Australia',
                            'Inggris',
                            'India'
                        ],
                        ans: 2,
                        explain: '<b>Skor Penuh (Opsi C):</b> Dalam KTN (Komisi Tiga Negara): <b>Indonesia memilih Australia</b> (diwakili Richard Kirby), <b>Belanda memilih Belgia</b> (Paul van Zeeland), dan keduanya memilih <b>Amerika Serikat</b> (Frank Porter Graham) sebagai pihak ketiga.'
                    }
                ]
            },
            {
                id: 'twk-bahasa',
                badge: 'BAB 7 • BAHASA INDONESIA',
                title: 'Trik Cepat Kalimat Efektif, EYD V, Kata Baku & Gagasan Utama',
                summary: 'Jangan baca seluruh teks panjang berulang kali—baca kalimat pertanyaan dulu, lalu bidik kalimat pertama/terakhir paragraf.',
                points: [
                    'Kalimat efektif wajib punya Subjek (S) dan Predikat (P) yang jelas; HINDARI kata depan/preposisi ("di", "pada", "bagi", "dalam", "kepada", "untuk") tepat di depan Subjek karena membuat kalimat kehilangan subjek!',
                    'Waspadai pleonasme (pemborosan kata): "para hadirin sekalian", "saling bantu-membantu", "agar supaya", "demi untuk", "sangat ... sekali".',
                    'Aturan Huruf Kapital Geografi (EYD V): Kapital jika diikuti nama diri ("Sungai Musi", "Pulau Bali"); huruf kecil jika tidak diikuti nama diri ("berenang di sungai") atau menunjukkan jenis/spesies ("jeruk bali", "kunci inggris", "gula jawa").'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>12 Kata Baku Langganan SKD</strong>
                            ✅ <b>Risiko</b> (bukan resiko) • ✅ <b>Analisis</b> (bukan analisa)<br>
                            ✅ <b>Praktik</b> (bukan praktek) • ✅ <b>Apotek</b> (bukan apotik)<br>
                            ✅ <b>Hierarki</b> (bukan hirarki) • ✅ <b>Karier</b> (bukan karir)<br>
                            ✅ <b>Cendekiawan</b> • ✅ <b>Antre</b> • ✅ <b>Izin</b> • ✅ <b>Narasumber</b>
                        </div>
                        <div class="studi-formula-card">
                            <strong>Rumus 5 Detik Cek Kalimat Efektif</strong>
                            1. Awal kalimat ada <i>Bagi / Dalam / Pada / Di</i> tanpa koma sebelum predikat? → <b>Coret (Tidak bersubjek)!</b><br>
                            2. Ada kata ganda <i>para ...-an / saling ...-an</i>? → <b>Coret (Pleonasme)!</b>
                        </div>
                    </div>
                `,
                goodKeywords: 'Struktur S-P jelas, hemat kata, kata baku KBBI (risiko, analisis, sistem, apotek, praktik, karier).',
                trapKeywords: 'Subjek didahului preposisi ("Bagi peserta harap..."), bentuk tidak baku ("resiko", "analisa", "apotik", "praktek").',
                exampleQ: 'Manakah kalimat yang paling efektif sesuai kaidah Bahasa Indonesia?',
                exampleAns: '<b>Kunci: "Para peserta ujian wajib membawa kartu identitas asli."</b>',
                quiz: [
                    {
                        q: 'Manakah di antara kalimat berikut yang merupakan kalimat efektif dan sesuai dengan kaidah EYD V?',
                        options: [
                            'Bagi seluruh peserta seleksi CPNS diharapkan hadir tiga puluh menit sebelum ujian dimulai.',
                            'Dalam rapat koordinasi tersebut membahas analisa resiko pelaksanaan program tahun depan.',
                            'Para hadirin sekalian dimohon berdiri untuk menyanyikan lagu kebangsaan.',
                            'Panitia mengimbau peserta seleksi agar memeriksa kembali kelengkapan dokumen persyaratan.',
                            'Para pegawai saling bantu-membantu menyelesaikan laporan tahunan di kantor.'
                        ],
                        ans: 3,
                        explain: '<b>Skor Penuh (Opsi D):</b> Opsi D memiliki <b>Subjek (Panitia)</b>, <b>Predikat (mengimbau)</b>, <b>Objek (peserta seleksi)</b>, dan kata baku (<b>mengimbau</b>). Opsi A & B salah karena diawali preposisi (<i>Bagi / Dalam</i>) sehingga kehilangan subjek; Opsi C & E salah karena pemborosan kata (pleonasme).'
                    }
                ]
            }
        ]
    },
    tiu: {
        title: 'Trik Cepat & Rumus Serba Cepat TIU (Tes Inteligensi Umum)',
        subtitle: 'Kisi-kisi resmi BKN • Passing Grade 80 • Disarikan dari Modul Rumus Serba Cepat TIU & Silogisme Analitik.',
        bannerClass: 'gold',
        topics: [
            {
                id: 'tiu-analogi',
                badge: 'BAB 1 • VERBAL ANALOGI',
                title: 'Teknik "Kalimat Jembatan Spesifik" untuk Analogi & Hubungan Kalimat',
                summary: 'Jangan sekadar menebak kata yang mirip temanya—buat 1 kalimat penghubung yang mengikat dan uji arahnya (Kiri → Kanan).',
                points: [
                    'Buat kalimat jembatan spesifik, misal: "[KIRI] menggunakan [KANAN] sebagai alat kerja utamanya".',
                    'Pastikan arah hubungan dan kelas kata (kata benda : kata benda / kata sifat : kata benda) sama persis! Jangan terbalik antara "Sebab : Akibat" dan "Akibat : Sebab".',
                    'Format terbaru BKN sering menanyakan: "Hubungan objek pada kalimat X setara dengan..." — gunakan rumus jembatan yang sama persis!'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>3 Langkah Anti-Meleset Analogi</strong>
                            1. Tentukan <b>Kelas Kata</b> (Benda/Kerja/Sifat).<br>
                            2. Buat <b>Kalimat Jembatan</b> pendek.<br>
                            3. Cek <b>Arah Panah (A → B)</b> jangan terbalik!
                        </div>
                        <div class="studi-formula-card">
                            <strong>Pola Relasi Paling Sering Keluar</strong>
                            • Profesi : Alat Kerja (Dokter : Stetoskop)<br>
                            • Bagian : Keseluruhan (Jari : Tangan)<br>
                            • Urutan Intensitas (Hangat : Panas = Gerimis : Hujan Lebat)
                        </div>
                    </div>
                `,
                goodKeywords: 'Kalimat jembatan identik, arah kiri→kanan konsisten, jenis kelas kata sejajar.',
                trapKeywords: 'Arah hubungan terbalik (B→A), hanya mengandalkan kemiripan tema tanpa relasi logis yang sama.',
                exampleQ: 'DOKTER : STETOSKOP = ... : ...',
                exampleAns: '<b>Kunci: HAKIM : PALU</b><br><i>Trik:</i> Jembatan = "Alat kerja khas profesi". Dokter memakai stetoskop; Hakim memakai palu.',
                quiz: [
                    {
                        q: 'Hubungan objek pada kalimat "Pelukis menggunakan kuas untuk menghasilkan lukisan di atas kanvas" setara dengan hubungan objek pada kalimat...',
                        options: [
                            'Petani menjual hasil panen padi kepada pedagang di pasar induk.',
                            'Penjahit menggunakan jarum untuk membuat pakaian dari kain.',
                            'Sopir mengemudikan bus antarkota di jalan tol pada malam hari.',
                            'Penyanyi menghafal lirik lagu sebelum tampil di atas panggung.',
                            'Koki membeli sayuran segar dan bumbu dapur di pasar tradisional.'
                        ],
                        ans: 1,
                        explain: '<b>Skor Penuh (Opsi B):</b> Pola struktur objeknya identik: <b>[Profesi: Pelukis/Penjahit]</b> menggunakan <b>[Alat: kuas/jarum]</b> untuk menghasilkan <b>[Karya: lukisan/pakaian]</b> dari <b>[Media/Bahan: kanvas/kain]</b>.'
                    }
                ]
            },
            {
                id: 'tiu-silogisme',
                badge: 'BAB 2 • SILOGISME & EKUIVALENSI',
                title: '3 Hukum Emas Silogisme, Modus Tollens & Ekuivalensi Implikasi',
                summary: 'Disarikan dari Modul Penalaran Silogisme: gunakan rumus aljabar logika murni—jangan terpengaruh opini di luar premis!',
                points: [
                    'Modus Ponens: (P → Q) dan P, maka kesimpulan pasti Q. Modus Tollens: (P → Q) dan ~Q, maka kesimpulan pasti ~P.',
                    'Silogisme Hipotetis (Coret Suku Tengah): (P → Q) dan (Q → R), coret Q sehingga kesimpulan = P → R (atau kontraposisinya: ~R → ~P).',
                    'Ekuivalensi Implikasi (Sangat Sering Keluar!): "Jika P maka Q" (P → Q) bernilai SAMA DENGAN "Jika tidak Q maka tidak P" (~Q → ~P) dan "Tidak P atau Q" (~P ∨ Q).',
                    '3 Hukum Kuantor: (1) Semua + Semua = Semua; (2) Semua + Sebagian = Sebagian; (3) Ada 1 premis Negatif ("Tidak") = Kesimpulan wajib Negatif ("Tidak").'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Rumus Sakti Logika Implikasi (P → Q)</strong>
                            • <b>Kontraposisi (Setara/Sah):</b> <span class="studi-formula-code">P → Q  ≡  ~Q → ~P</span><br>
                            • <b>Ubah "Jika-Maka" ke "Atau":</b> <span class="studi-formula-code">P → Q  ≡  ~P ∨ Q</span><br>
                            • <b>Ingkaran/Negasi (P → Q):</b> <span class="studi-formula-code">P ∧ ~Q</span> (P terjadi TETAPI tidak Q)
                        </div>
                        <div class="studi-formula-card">
                            <strong>Tabel Cepat Kuantor (Semua vs Sebagian)</strong>
                            • Semua (+) & Semua (+) → <b>Semua (+)</b><br>
                            • Semua (+) & Sebagian (+) → <b>Sebagian (+)</b><br>
                            • Semua (-) & Sebagian (+) → <b>Sebagian (-)</b>
                        </div>
                    </div>
                `,
                goodKeywords: 'Cek P→Q ≡ ~Q→~P, ubah ke ~P ∨ Q, serta aturan "Semua + Sebagian = Sebagian".',
                trapKeywords: 'Membalik P→Q menjadi Q→P (Konvers = SALAH!) atau ~P→~Q (Invers = SALAH!).',
                exampleQ: 'Semua pegawai yang mengikuti diklat mendapat sertifikat. Sebagian pegawai di bagian keuangan tidak mendapat sertifikat. Kesimpulannya adalah...',
                exampleAns: '<b>Kunci: Sebagian pegawai di bagian keuangan tidak mengikuti diklat.</b>',
                quiz: [
                    {
                        q: 'Premis 1: Jika anggaran disetujui tepat waktu, maka proyek jembatan dimulai bulan ini.\nPremis 2: Jika proyek jembatan dimulai bulan ini, maka distribusi logistik warga menjadi lancar.\nManakah pernyataan di bawah ini yang PASTI BENAR (ekuivalen dengan kesimpulan)?',
                        options: [
                            'Jika distribusi logistik warga lancar, maka anggaran pasti disetujui tepat waktu.',
                            'Jika anggaran tidak disetujui tepat waktu, maka distribusi logistik warga tidak lancar.',
                            'Jika distribusi logistik warga tidak lancar, maka anggaran tidak disetujui tepat waktu.',
                            'Anggaran disetujui tepat waktu tetapi distribusi logistik warga belum tentu lancar.',
                            'Proyek jembatan dimulai bulan ini meskipun anggaran belum disetujui.'
                        ],
                        ans: 2,
                        explain: '<b>Skor Penuh (Opsi C):</b> Dari Silogisme: <b>P → Q</b> dan <b>Q → R</b> menghasilkan <b>P → R</b> (<i>Jika anggaran disetujui tepat waktu, maka distribusi logistik lancar</i>). Karena P → R tidak ada di opsi, gunakan <b>Kontraposisi (~R → ~P)</b>: <i>"Jika distribusi logistik warga tidak lancar (~R), maka anggaran tidak disetujui tepat waktu (~P)"</i>.'
                    }
                ]
            },
            {
                id: 'tiu-hitung-cepat',
                badge: 'BAB 3 • RUMUS SERBA CEPAT ALJABAR',
                title: 'Rumus 5 Detik Aljabar, Akar Berulang Tak Hingga & Diskon Ganda',
                summary: 'Disarikan langsung dari Modul "70 Rumus Serba Cepat TIU": kerjakan soal hitungan rumit tanpa cakaran panjang!',
                points: [
                    'Selisih Kuadrat (x² - y²): Jangan dikuadratkan manual! Gunakan rumus (x + y)(x - y). Contoh: 2025² - 2024² = (2025 + 2024)(2025 - 2024) = 4049 × 1 = 4049!',
                    'Akar Berulang Tak Hingga: Jika √(a + √(a + √(a + ...))) di mana a = n × (n + 1) (dua bilangan berurutan): tanda TAMBAH (+) ambil angka BESAR (n + 1); tanda KURANG (-) ambil angka KECIL (n).',
                    'Diskon Ganda (Bertingkat) a% + b%: Jangan dijumlahkan langsung! Gunakan rumus: Diskon Total = (a + b) - (a × b / 100).'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Rumus Akar Tak Hingga (Faktor Berurutan)</strong>
                            Cari 2 angka berurutan yang dikalikan = angka di dalam akar:<br>
                            • <span class="studi-formula-code">√(42 + √(42 + ...)) = 7</span> (6×7, tanda <b>+</b> ambil yg <b>besar = 7</b>)<br>
                            • <span class="studi-formula-code">√(42 - √(42 - ...)) = 6</span> (6×7, tanda <b>-</b> ambil yg <b>kecil = 6</b>)<br>
                            • <span class="studi-formula-code">√(7√(7√(7...))) = 7</span> (perkalian langsung = angka itu sendiri)
                        </div>
                        <div class="studi-formula-card">
                            <strong>Rumus Diskon Ganda & Pecahan Cepat</strong>
                            • <b>Diskon 50% + 20%:</b> <span class="studi-formula-code">(50+20) - (50×20/100) = 60%</span><br>
                            • <b>Hafalan Pecahan:</b> 1/8 = 12,5% • 3/8 = 37,5% • 5/8 = 62,5% • 7/8 = 87,5% • 1/6 = 16,67%.
                        </div>
                    </div>
                `,
                goodKeywords: 'Selisih kuadrat (a+b)(a-b), akar berulang faktor berurutan, pecahan istimewa per-delapan.',
                trapKeywords: 'Menjumlahkan diskon 50% + 20% menjadi 70% (salah besar! yang benar 60%), atau menghitung kuadrat 3 digit secara manual.',
                exampleQ: 'Berapakah nilai dari √(56 + √(56 + √(56 + ...))) ?',
                exampleAns: '<b>Kunci: 8</b><br><i>Trik 3 Detik:</i> 56 adalah hasil kali 2 bilangan berurutan <b>7 × 8</b>. Karena tandanya <b>+ (tambah)</b>, langsung pilih angka yang <b>besar = 8</b>!',
                quiz: [
                    {
                        q: 'Nilai dari √(72 + √(72 + √(72 + ...))) dikurangi dengan √(20 - √(20 - √(20 - ...))) adalah...',
                        options: [
                            '3',
                            '4',
                            '5',
                            '6',
                            '13'
                        ],
                        ans: 2,
                        explain: '<b>Skor Penuh (Opsi C = 5):</b> Gunakan <b>Rumus Cepat Akar Berulang</b>:<br>1) 72 = <b>8 × 9</b> (tanda <b>+</b> ambil yang besar = <b>9</b>).<br>2) 20 = <b>4 × 5</b> (tanda <b>-</b> ambil yang kecil = <b>4</b>).<br>Maka 9 - 4 = <b>5</b> (Selesai dalam 5 detik!).'
                    }
                ]
            },
            {
                id: 'tiu-deret',
                badge: 'BAB 4 • NUMERIK DERET & BARISAN',
                title: 'Metode 3 Lapis Deret Angka & Rumus Kilat Turunan Deret Aritmetika (Sn → Un)',
                summary: 'Bongkar pola deret kurang dari 20 detik + trik rahasia mengubah rumus jumlah suku (Sn) menjadi suku ke-n (Un) lewat turunan!',
                points: [
                    'Lapis 1 (Berurutan): Cek selisih (+ / -) atau rasio (× / ÷) antarsuku berdekatan.',
                    'Lapis 2 (Bertingkat): Jika selisih lapis 1 belum tetap, cek selisih tingkat ke-2 (contoh: +2, +4, +6, +8, +10).',
                    'Lapis 3 (Lompat Ganjil-Genap / Fibonacci): Jika deret panjang (≥ 7 angka) dan naik-turun, pasti pola lompat 1 atau 2 suku!',
                    'Rumus Rahasia Modul TIU (Sn ke Un): Jika diketahui jumlah n suku pertama Sn = pn² + qn, maka rumus Un adalah: Turunkan pangkatnya (2pn + q) lalu kurangi koefisien n² (p) → Un = 2pn + (q - p)!'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Rumus Kilat Sn → Un (Tanpa Rumus Panjang!)</strong>
                            Diketahui: <span class="studi-formula-code">Sn = 2n² + 4n</span>. Cari Un dan beda (b)?<br>
                            • <b>Beda (b)</b> = 2 × koefisien n² = 2 × 2 = <b>4</b>.<br>
                            • <b>Un</b> = Turunan Sn dikurangi koefisien n² = (4n + 4) - 2 = <b>4n + 2</b>.
                        </div>
                        <div class="studi-formula-card">
                            <strong>Pola Angka Istimewa Wajib Kenal</strong>
                            • <b>Kuadrat:</b> 1, 4, 9, 16, 25, 36, 49, 64, 81, 100<br>
                            • <b>Kubik:</b> 1, 8, 27, 64, 125, 216<br>
                            • <b>Prima:</b> 2, 3, 5, 7, 11, 13, 17, 19, 23, 29
                        </div>
                    </div>
                `,
                goodKeywords: 'Selisih tingkat 1 & 2, pola lompat ganjil-genap, b = 2p pada rumus Sn = pn² + qn.',
                trapKeywords: 'Terjebak menghitung satu-satu pada deret panjang padahal polanya lompat suku ganjil dan suku genap.',
                exampleQ: 'Tentukan angka berikutnya pada deret: 3, 5, 9, 15, 23, ...',
                exampleAns: '<b>Kunci: 33</b> (Selisih bertingkat: +2, +4, +6, +8, berikutnya +10 → 23 + 10 = 33).',
                quiz: [
                    {
                        q: 'Perhatikan deret angka berikut: 4, 10, 8, 15, 16, 20, 32, 25, ... , ... Dua angka berikutnya secara berturut-turut adalah...',
                        options: [
                            '48 dan 30',
                            '64 dan 30',
                            '64 dan 35',
                            '40 dan 64',
                            '56 dan 30'
                        ],
                        ans: 1,
                        explain: '<b>Skor Penuh (Opsi B: 64 dan 30):</b> Deret panjang naik-turun = gunakan <b>Pola Lompat Ganjil-Genap</b>:<br>• <b>Suku Ganjil:</b> 4 → 8 → 16 → 32 → dikali 2 terus = <b>64</b>.<br>• <b>Suku Genap:</b> 10 → 15 → 20 → 25 → ditambah 5 terus = <b>30</b>.'
                    }
                ]
            },
            {
                id: 'tiu-perbandingan-proyek',
                badge: 'BAB 5 • PROYEK TERHENTI & KERJA BERSAMA',
                title: 'Rumus 10 Detik Proyek Terhenti, Kerja Bersama & Perbandingan rata-rata Silang',
                summary: 'Tiga tipe soal cerita paling sering keluar di TIU BKN yang bisa diselesaikan hanya dengan 1 baris rumus cepat!',
                points: [
                    'Tambahan Pekerja Proyek Terhenti: Jangan hitung total volume kerja! Gunakan rumus: Tambahan Pekerja = (Pekerja Awal × Hari Libur/Berhenti) ÷ Sisa Hari Kerja Efektif.',
                    'Waktu Kerja Bersama 2 Orang/Mesin (A dan B): t_gabungan = (A × B) ÷ (A + B).',
                    'Perbandingan Jumlah Orang dari Rata-Rata Gabungan (Trik Silang): Rasio Grup A : Grup B = |Rata-rata B - Rata-rata Gabungan| : |Rata-rata A - Rata-rata Gabungan|.'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>1. Rumus Tambahan Pekerja (Proyek Terhenti)</strong>
                            <span class="studi-formula-code">ΔP = (P_awal × Hari Berhenti) / Sisa Hari</span><br>
                            <i>Contoh:</i> 25 pekerja, target 32 hari. Kerja 20 hari, stop 4 hari.<br>
                            Sisa hari = 32 - 20 - 4 = 8 hari.<br>
                            ΔP = (25 × 4) / 8 = <b>12,5 (13 pekerja)</b>.
                        </div>
                        <div class="studi-formula-card">
                            <strong>2. Rumus Kerja Bersama & Rata-Rata Silang</strong>
                            • <b>Kerja Bersama:</b> <span class="studi-formula-code">t = (A × B) / (A + B)</span><br>
                            <i>Contoh:</i> A = 6 jam, B = 3 jam → (6×3)/(6+3) = <b>2 jam</b>.<br>
                            • <b>Rasio Rata-Rata:</b> Selisihkan silang terhadap nilai rata-rata gabungan!
                        </div>
                    </div>
                `,
                goodKeywords: 'ΔP = (P × Libur) / Sisa Hari, Kerja bersama = (A×B)/(A+B), Berbalik nilai = kali sejajar.',
                trapKeywords: 'Lupa mengurangi jumlah hari berhenti saat menghitung "Sisa Hari Kerja", atau tidak membaca kata "tambahan pekerja" vs "total pekerja".',
                exampleQ: 'Sebuah proyek direncanakan selesai dalam 40 hari oleh 18 pekerja. Setelah berjalan 15 hari, proyek terhenti selama 5 hari. Agar selesai tepat waktu, berapa pekerja tambahan yang diperlukan?',
                exampleAns: '<b>Kunci: 4,5 → dibulatkan 5 pekerja (atau jika 20 pekerja awal: (20 × 5) / 20 = 5 pekerja).</b>',
                quiz: [
                    {
                        q: 'Sebuah proyek renovasi gedung direncanakan selesai dalam 30 hari oleh 16 orang pekerja. Setelah dikerjakan selama 12 hari, pekerjaan dihentikan selama 6 hari karena kendala cuaca. Agar proyek tetap selesai tepat waktu, berapa jumlah pekerja TAMBAHAN yang harus direkrut?',
                        options: [
                            '6 orang pekerja',
                            '8 orang pekerja',
                            '10 orang pekerja',
                            '24 orang pekerja',
                            '12 orang pekerja'
                        ],
                        ans: 1,
                        explain: '<b>Skor Penuh (Opsi B = 8 orang):</b> Gunakan <b>Rumus Cepat Proyek Terhenti</b>:<br>• Sisa hari kerja efektif = 30 - 12 - 6 = <b>12 hari</b>.<br>• Tambahan Pekerja = <b>(Pekerja Awal × Hari Berhenti) ÷ Sisa Hari</b> = (16 × 6) ÷ 12 = 96 ÷ 12 = <b>8 orang pekerja tambahan</b>!'
                    }
                ]
            },
            {
                id: 'tiu-kecepatan-jarak',
                badge: 'BAB 6 • SUSUL-MENYUSUL & BERPAPASAN',
                title: 'Rumus Kilat Jarak-Kecepatan (Jokowi), Waktu Berpapasan & Waktu Menyusul',
                summary: 'Kuasai segitiga J-K-W, waktu berpapasan dari arah berlawanan, waktu menyusul, dan panjang lintasan bola memantul.',
                points: [
                    'Berpapasan (Berangkat Waktu Sama): Waktu Papasan = Jarak Total ÷ (V1 + V2). Jika waktu berangkat beda, kurangi dulu Jarak Total dengan jarak yang sudah ditempuh orang pertama!',
                    'Susul-Menyusul (Arah Sama): Waktu Menyusul = Selisih Jarak Awal ÷ (V_cepat - V_lambat).',
                    'Rumus Panjang Lintasan Bola Memantul (Jatuh dari tinggi h dengan rasio pantulan a/b): Lintasan Total = h × (b + a) ÷ (b - a).'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Rumus Berpapasan vs Menyusul</strong>
                            • <b>Berpapasan (Jumlahkan V):</b> <span class="studi-formula-code">t = Jarak / (V₁ + V₂)</span><br>
                            • <b>Menyusul (Kurangkan V):</b> <span class="studi-formula-code">t = Selisih Jarak / (V₂ - V₁)</span>
                        </div>
                        <div class="studi-formula-card">
                            <strong>Rumus Kilat Bola Memantul Sampai Berhenti</strong>
                            Jatuh dari tinggi <b>h</b>, memantul <b>a/b</b> kali tinggi sebelumnya:<br>
                            <span class="studi-formula-code">Total Lintasan = h × (b + a) / (b - a)</span><br>
                            <i>Contoh:</i> Tinggi 10 m, pantul 3/5 → 10 × (5+3)/(5-3) = 10 × 8/2 = <b>40 m</b>!
                        </div>
                    </div>
                `,
                goodKeywords: 'Papasan = bagi (V1 + V2), Menyusul = bagi (V2 - V1), Bola pantul = h × (b+a)/(b-a).',
                trapKeywords: 'Menjumlahkan kecepatan pada soal susul-menyusul (seharusnya dikurangi karena searah).',
                exampleQ: 'Sebuah bola dijatuhkan dari ketinggian 12 meter dan setiap kali memantul mencapai 2/3 dari tinggi sebelumnya. Berapa total panjang lintasan bola sampai berhenti?',
                exampleAns: '<b>Kunci: 60 meter</b><br><i>Trik 5 Detik:</i> h × (b + a)/(b - a) = 12 × (3 + 2)/(3 - 1) = 12 × 5/1 = <b>60 meter</b>!',
                quiz: [
                    {
                        q: 'Kota A dan Kota B berjarak 240 km. Raka berangkat dari Kota A menuju Kota B pukul 07.00 dengan kecepatan 55 km/jam. Pada waktu yang sama (pukul 07.00), Dinda berangkat dari Kota B menuju Kota A dengan kecepatan 65 km/jam. Pada pukul berapakah mereka akan berpapasan di jalan?',
                        options: [
                            'Pukul 08.30',
                            'Pukul 09.00',
                            'Pukul 09.15',
                            'Pukul 09.30',
                            'Pukul 10.00'
                        ],
                        ans: 1,
                        explain: '<b>Skor Penuh (Opsi B = Pukul 09.00):</b> Karena berangkat pada jam yang sama dari arah berlawanan, gunakan rumus <b>Waktu Berpapasan</b>:<br>t = Jarak ÷ (V₁ + V₂) = 240 ÷ (55 + 65) = 240 ÷ 120 = <b>2 jam</b>.<br>Berangkat pukul 07.00 + 2 jam = <b>Pukul 09.00</b>.'
                    }
                ]
            },
            {
                id: 'tiu-analitis-figural',
                badge: 'BAB 7 • ANALITIK TABEL & FIGURAL',
                title: 'Metode Matriks Penalaran Analitik & Kunci 1 Elemen Rotasi Figural',
                summary: 'Disarikan dari Modul Penalaran Analitik: jangan pernah menghafal urutan posisi di kepala—buat coretan slot atau matriks!',
                points: [
                    'Urutan Linier (Antrean / Peringkat / Jadwal): Buat garis slot _ _ _ _ _ lalu isi dari syarat yang PASTI (misal: "C berada di urutan ke-3") dan syarat BLOK ("A selalu berdampingan dengan B" → tulis [AB]).',
                    'Meja Bundar (Siklis): Tetapkan 1 orang sebagai patokan tetap di posisi jam 6, lalu petakan kiri/kanan/hadap-hadapan.',
                    'Figural (Serial / Analogi / Ketaksamaan): Jangan lihat seluruh gambar! Bidik 1 elemen kecil (misal jarum/titik hitam), lacak rotasinya (45° atau 90° searah/berlawanan jarum jam) dan perubahan warna (hitam ↔ putih).'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Kamus Kode Cepat Analitik</strong>
                            • "A tepat sebelum B" → Tulis blok <b>[AB]</b><br>
                            • "A lebih tinggi dari B" → Tulis <b>A > B</b><br>
                            • "Jika A terpilih, maka B terpilih" → Gunakan <b>P → Q</b> untuk langsung mencoret opsi yang melanggar!
                        </div>
                        <div class="studi-formula-card">
                            <strong>Checklist 10 Detik Figural</strong>
                            1. <b>Rotasi:</b> Searah (CW) atau Berlawanan (CCW) 45° / 90°?<br>
                            2. <b>Jumlah Unsur:</b> Hitung jumlah garis/titik/sisi (+1 atau ganjil/genap).<br>
                            3. <b>Inversi Warna:</b> Hitam jadi putih / sebaliknya.
                        </div>
                    </div>
                `,
                goodKeywords: 'Eliminasi opsi langsung per kalimat syarat, kunci 1 elemen mencolok pada Figural.',
                trapKeywords: 'Membaca ulang seluruh paragraf analitik berkali-kali tanpa langsung mencoret opsi A–E yang melanggar syarat.',
                exampleQ: 'Pada deret gambar, sebuah segitiga berputar 90° searah jarum jam di setiap langkah sambil titik hitam berpindah 1 sudut. Bagaimana cara cepat memilih opsi?',
                exampleAns: '<b>Trik:</b> Cek posisi titik hitam terlebih dahulu pada langkah ke-4—biasanya langsung mengeliminasi 3 dari 5 opsi dalam 5 detik!',
                quiz: [
                    {
                        q: 'Lima orang peserta diklat (Aldi, Bela, Cici, Dodi, dan Eka) duduk berderet pada 5 kursi dari kiri ke kanan (kursi 1 sampai 5).\n• Cici duduk tepat di tengah (kursi nomor 3).\n• Aldi duduk tepat di sebelah kiri Bela (blok [AB]).\n• Eka tidak bersedia duduk di kursi paling ujung kanan (nomor 5).\nSiapakah yang pasti duduk di kursi nomor 5 (paling kanan)?',
                        options: [
                            'Aldi',
                            'Bela',
                            'Cici',
                            'Dodi',
                            'Eka'
                        ],
                        ans: 3,
                        explain: '<b>Skor Penuh (Opsi D = Dodi):</b> Mari susun 5 slot: <code>[1] [2] [3: Cici] [4] [5]</code>.<br>• Karena <b>[Aldi-Bela]</b> harus berdampingan (2 kursi bersebelahan), mereka hanya muat di kursi <code>[1-2]</code> atau <code>[4-5]</code>.<br>• Jika [Aldi-Bela] di <code>[4-5]</code>, maka Eka & Dodi di <code>[1-2]</code> (tapi Eka tidak mungkin di 5). Tunggu: jika [Aldi-Bela] di <code>[1-2]</code>, maka sisa kursi <code>[4]</code> dan <code>[5]</code> diisi oleh Eka dan Dodi. Karena <b>Eka tidak mau di kursi 5</b>, maka Eka di kursi 4 dan <b>kursi 5 diisi Dodi</b>!'
                    }
                ]
            }
        ]
    },
    tkp: {
        title: 'Strategi Skor 5 Semua Aspek TKP (Tes Karakteristik Pribadi)',
        subtitle: 'Kisi-kisi resmi BKN • Skala Bobot 1–5 • Passing Grade 166 • Saripati Modul Singkat TKP & SKB Anti-Radikalisme.',
        bannerClass: 'green',
        topics: [
            {
                id: 'tkp-pelayanan',
                badge: 'BAB 1 • PELAYANAN PUBLIK',
                title: 'Prinsip Emas Pelayanan Publik: Sigap, Ramah, Solutif & Patuh SOP',
                summary: 'Di soal pelayanan publik, kepuasan & keselamatan warga adalah prioritas utama, namun prosedur hukum (SOP) tidak boleh dilanggar.',
                points: [
                    'Kata kunci masalah: Ada unsur pelayanan masyarakat/klien/pasien/pemohon di soal.',
                    'Pilih tindakan yang langsung menolong/menenangkan warga dengan ramah sambil memberi solusi konkret sesuai aturan (SOP).',
                    'Jika ada rekan kerja bersikap kasar/keliru di loket, selamatkan layanan pemohon terlebih dahulu, baru ingatkan rekan secara pribadi (bukan menegur di depan umum).'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Formula Skor 5 Pelayanan Publik</strong>
                            <span class="studi-formula-code">Ramah + Solutif Saat Itu Juga + Sesuai SOP</span><br>
                            • Kondisi darurat medis/nyawa? → <b>Dahulukan keselamatan jiwa sambil urus administrasi paralel!</b>
                        </div>
                        <div class="studi-formula-card">
                            <strong>Ciri Opsi Skor 1–2 (Wajib Hindari!)</strong>
                            • Menolak mentah-mentah tanpa menjelaskan solusi.<br>
                            • Melempar warga ke bagian lain tanpa memandu.<br>
                            • Melanggar aturan demi kasihan/kedekatan pribadi.
                        </div>
                    </div>
                `,
                goodKeywords: 'Ramah, sigap membantu, memandu solusi prioritas sesuai SOP, menjaga citra instansi.',
                trapKeywords: 'Menolak mentah-mentah tanpa solusi, memproses berkas yang melanggar aturan, menegur rekan di depan warga.',
                exampleQ: 'Rekan kerja di loket sebelah berbicara dengan nada tinggi kepada pemohon yang menanyakan ulang berkasnya berkali-kali. Sikap Anda yang paling tepat adalah...',
                exampleAns: '<b>Skor 5: Mengambil alih komunikasi dengan ramah untuk menenangkan pemohon dan memproses kebutuhannya, lalu mengingatkan rekan secara pribadi setelah antrean reda.</b>',
                quiz: [
                    {
                        q: 'Lima menit menjelang jam istirahat siang, seorang warga lansia datang dengan napas tersengal-sengal membawa berkas permohonan yang ternyata masih kurang satu fotokopi dokumen pendukung. Sikap Anda sebagai petugas pelayanan adalah...',
                        options: [
                            'Meminta lansia tersebut pulang dulu dan kembali lagi besok pagi dengan berkas lengkap.',
                            'Menutup loket tepat waktu karena jam istirahat adalah hak pegawai.',
                            'Melayani dengan ramah, mempersilakan duduk, memeriksa seluruh berkas lainnya agar tidak ada yang terlewat lagi, dan membantu memfotokopikan kekurangan satu lembar tersebut di kantor sesuai prosedur.',
                            'Langsung meloloskan permohonannya tanpa dokumen lengkap karena merasa kasihan.',
                            'Menyuruh satpam kantor mengurus keperluan lansia tersebut.'
                        ],
                        ans: 2,
                        explain: '<b>Skor 5 (Opsi C):</b> Menggabungkan <b>empati/keramahan pelayanan publik</b> (mempersilakan duduk & membantu kendala teknis lansia) sekaligus <b>tetap patuh SOP</b> (kelengkapan berkas tetap terpenuhi tanpa melanggar aturan).'
                    }
                ]
            },
            {
                id: 'tkp-jejaring',
                badge: 'BAB 2 • JEJARING KERJA',
                title: 'Kunci Jejaring Kerja: Kolaborasi Aktif, Sinergi & Komunikasi Asertif',
                summary: 'Menguji kemampuan membangun hubungan kerja lintas tim, berbagi informasi secara adil, dan menyelesaikan konflik secara dewasa.',
                points: [
                    'Pilih opsi yang membuka ruang koordinasi, diskusi konstruktif, dan kolaborasi tanpa ego sektoral.',
                    'Jika ada rekan baru atau tim yang mengalami kendala, rangkul dan ajak berdiskusi mencari jalan keluar bersama.',
                    'Saat terjadi kesalahpahaman antar-rekan, utamakan tabayyun/klarifikasi langsung secara santun dan fokus pada tujuan organisasi.'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Rumus Skor 5 Jejaring Kerja</strong>
                            <span class="studi-formula-code">Koordinasi Aktif + Kolaborasi Tim + Fokus Target Bersama</span>
                        </div>
                        <div class="studi-formula-card">
                            <strong>Jebakan Opsi Skor Rendah</strong>
                            • "Mengerjakan sendiri karena tidak percaya tim"<br>
                            • "Menolak membantu divisi lain karena bukan tupoksi"<br>
                            • "Menjaga jarak dengan rekan yang berbeda pendapat"
                        </div>
                    </div>
                `,
                goodKeywords: 'Koordinasi aktif, sinergi lintas divisi, berbagi pengetahuan, musyawarah cari solusi bersama.',
                trapKeywords: 'Bekerja sendiri-sendiri (individualis), ego sektoral, menyalahkan tim lain saat ada masalah.',
                exampleQ: 'Divisi lain meminta data pendukung yang sebenarnya bukan tugas pokok harian Anda, sementara tenggat laporan mereka mendesak. Sikap Anda...',
                exampleAns: '<b>Skor 5: Berkoordinasi cepat untuk membantu menyediakan data yang diperlukan sepanjang sesuai kewenangan, tanpa mengabaikan tugas utama Anda.</b>',
                quiz: [
                    {
                        q: 'Anda ditunjuk memimpin tim lintas divisi yang anggotanya belum saling mengenal dan tampak canggung sehingga diskusi awal berjalan pasif. Langkah paling efektif untuk membangun jejaring kerja adalah...',
                        options: [
                            'Membagi tugas secara sepihak lewat pesan singkat agar rapat cepat selesai.',
                            'Mengerjakan sebagian besar tugas strategis sendirian agar hasilnya terjamin.',
                            'Mencairkan suasana dengan perkenalan singkat, memetakan keahlian tiap anggota, dan membangun kesepakatan alur komunikasi terbuka demi mencapai target tim.',
                            'Melaporkan kepada atasan bahwa anggota tim tidak kooperatif dan meminta pergantian personel.',
                            'Menunggu anggota tim berinisiatif berbicara sendiri tanpa perlu diarahkan.'
                        ],
                        ans: 2,
                        explain: '<b>Skor 5 (Opsi C):</b> Menunjukkan <b>inisiatif kolaboratif</b>, komunikasi efektif, serta kemampuan merangkul potensi setiap anggota untuk bersinergi.'
                    }
                ]
            },
            {
                id: 'tkp-sosbud',
                badge: 'BAB 3 • SOSIAL BUDAYA',
                title: 'Sosial Budaya: Adaptif, Empati & Menghormati Kearifan Lokal',
                summary: 'Menguji kesiapan ASN menjadi perekat bangsa di tengah kemajemukan adat, budaya, bahasa, dan kebiasaan masyarakat.',
                points: [
                    'Kata kunci soal: Terdapat unsur perbedaan latar belakang budaya, adat istiadat, kebiasaan warga, atau lingkungan baru.',
                    'Pilih sikap yang terbuka, mau beradaptasi, menghormati kearifan lokal, dan mengedepankan dialog santun.',
                    'Jika ada kebiasaan warga yang kurang sejalan dengan program kesehatan/pemerintah, gunakan pendekatan persuasif bersama tokoh adat/masyarakat setempat.'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Rumus Skor 5 Sosial Budaya</strong>
                            <span class="studi-formula-code">Hormati Adat Lokal + Cepat Beradaptasi + Dialog Persuasif</span>
                        </div>
                        <div class="studi-formula-card">
                            <strong>Prinsip Perekat Bangsa (UU ASN)</strong>
                            ASN wajib bersikap netral, inklusif, tidak diskriminatif, dan mampu membaur di wilayah penugasan mana pun.
                        </div>
                    </div>
                `,
                goodKeywords: 'Menghargai keberagaman, adaptif di lingkungan baru, merangkul tokoh lokal secara persuasif.',
                trapKeywords: 'Menarik diri dari warga, menganggap tradisi lokal kuno/menghambat, memaksakan budaya daerah asal.',
                exampleQ: 'Anda ditugaskan di daerah terpencil yang memiliki tradisi musyawarah adat sebelum program pemerintah dijalankan. Langkah Anda adalah...',
                exampleAns: '<b>Skor 5: Menghormati dan mengikuti forum musyawarah adat setempat untuk menjelaskan manfaat program pemerintah secara persuasif.</b>',
                quiz: [
                    {
                        q: 'Saat Anda baru dipindahtugaskan ke daerah lain, rekan-rekan di kantor sering bercakap-cakap menggunakan bahasa daerah setempat saat jam istirahat sehingga Anda kesulitan memahami pembicaraan mereka. Sikap Anda adalah...',
                        options: [
                            'Menegur mereka dengan keras karena di lingkungan kantor wajib menggunakan Bahasa Indonesia setiap detik.',
                            'Menyendiri di meja kerja sambil bermain ponsel karena merasa dikucilkan.',
                            'Mengajukan permohonan mutasi kembali ke daerah asal secepat mungkin.',
                            'Tetap membaur dengan ramah sambil sedikit demi sedikit mempelajari kosakata bahasa dan budaya daerah setempat untuk mempererat keakraban.',
                            'Hanya mau bergaul dengan pegawai yang berasal dari suku yang sama dengan Anda.'
                        ],
                        ans: 3,
                        explain: '<b>Skor 5 (Opsi D):</b> Menunjukkan <b>kemampuan adaptasi sosial budaya yang tinggi</b>, sikap terbuka, dan kemauan membaur secara positif di lingkungan baru.'
                    }
                ]
            },
            {
                id: 'tkp-tik',
                badge: 'BAB 4 • TEKNOLOGI INFORMASI (TIK)',
                title: 'Aspek TIK: Transformasi Digital, Edukasi Rekan & Keamanan Siber',
                summary: 'Disarikan dari Modul TKP: pilih jawaban yang proaktif mengadopsi teknologi untuk efisiensi kerja, membantu rekan, dan menjaga keamanan data.',
                points: [
                    'Selalu pilih opsi yang antusias mempelajari aplikasi/sistem digital baru dan menggunakannya untuk meningkatkan kinerja instansi.',
                    'Jika rekan senior kesulitan memakai sistem baru: pelajari hingga mahir lalu BANTU MENGAJARI dengan sabar (jangan mengejek dan jangan mengambil alih pekerjaannya selamanya).',
                    'Waspadai keamanan informasi: jangan gunakan jaringan publik tidak aman untuk data rahasia, jangan bagikan akun/OTP, dan selalu back-up data penting.'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Rumus Skor 5 Aspek TIK</strong>
                            <span class="studi-formula-code">Cepat Belajar Aplikasi + Edukasi Rekan + Jaga Keamanan Data</span>
                        </div>
                        <div class="studi-formula-card">
                            <strong>Kasus Klasik dari Modul TKP</strong>
                            Sistem kantor error saat pelayanan? → <b>Segera lapor tim IT, informasikan ke warga dengan sopan, & siapkan pencatatan cadangan sesuai SOP!</b>
                        </div>
                    </div>
                `,
                goodKeywords: 'Adaptif teknologi, edukasi rekan secara sabar, keamanan siber, inovasi digital untuk efisiensi.',
                trapKeywords: 'Menolak aplikasi baru karena rumit, kembali ke cara manual tanpa izin, membagikan password akun dinas.',
                exampleQ: 'Kantor menerapkan aplikasi persuratan digital baru dan beberapa rekan senior kesulitan mengoperasikannya. Sikap Anda...',
                exampleAns: '<b>Skor 5: Mempelajari alur aplikasi hingga mahir lalu meluangkan waktu mendampingi rekan senior agar seluruh tim dapat bekerja lebih cepat.</b>',
                quiz: [
                    {
                        q: 'Instansi Anda baru saja meluncurkan sistem pelaporan kinerja berbasis cloud untuk menggantikan laporan kertas manual. Sebagian rekan kerja mengeluh karena belum terbiasa dengan tampilan sistem baru tersebut. Sikap Anda adalah...',
                        options: [
                            'Ikut mengeluh dan mengusulkan agar kantor kembali menggunakan cara manual saja.',
                            'Mempelajari fitur sistem baru tersebut secara mendalam, menggunakannya secara konsisten, dan berinisiatif membuat panduan singkat untuk membantu rekan-rekan yang kesulitan.',
                            'Menggunakan sistem baru hanya untuk diri sendiri dan membiarkan rekan lain mencari tahu sendiri.',
                            'Meminta staf magang mengerjakan seluruh laporan digital milik Anda.',
                            'Menunda pengisian laporan sampai ada pelatihan tatap muka bulan depan.'
                        ],
                        ans: 1,
                        explain: '<b>Skor 5 (Opsi B):</b> Menggabungkan <b>literasi digital proaktif</b> (mempelajari & menerapkan sistem baru) dengan <b>kolaborasi tim</b> (membantu rekan beradaptasi).'
                    }
                ]
            },
            {
                id: 'tkp-profesionalisme',
                badge: 'BAB 5 • PROFESIONALISME',
                title: 'Profesionalisme: Fokus Tugas, Skala Prioritas & Tahan Tekanan',
                summary: 'Profesionalisme menguji komitmen menyelesaikan tanggung jawab dengan kualitas terbaik meskipun ada gangguan pribadi atau tekanan waktu.',
                points: [
                    'Kata kunci soal: Ada gangguan terhadap pekerjaan, benturan kepentingan pribadi vs tugas dinas, atau tenggat waktu mendadak.',
                    'Tetap fokus pada pekerjaan apa pun gangguannya; jika ada dua tugas penting bersamaan, susun skala prioritas dan komunikasikan secara profesional.',
                    'Jika melakukan kekeliruan kerja, jangan menyalahkan orang lain—akui secara jujur, segera perbaiki, dan jadikan bahan evaluasi.'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Rumus Skor 5 Profesionalisme</strong>
                            <span class="studi-formula-code">Tanggung Jawab Tuntas + Skala Prioritas + Pisahkan Urusan Pribadi</span>
                        </div>
                        <div class="studi-formula-card">
                            <strong>Studi Kasus Modul TKP (Kenaikan Jabatan)</strong>
                            Tidak terpilih promosi jabatan? → <b>Menerima keputusan secara dewasa, mengevaluasi kekurangan diri, dan meningkatkan kinerja!</b>
                        </div>
                    </div>
                `,
                goodKeywords: 'Skala prioritas, tanggung jawab penuh, tepat waktu, tenang di bawah tekanan, evaluasi diri.',
                trapKeywords: 'Mencampur urusan pribadi di jam kerja, mengeluh/menyalahkan rekan, menunda revisi.',
                exampleQ: 'Menjelang jam pulang kantor, atasan meminta revisi laporan penting yang harus diserahkan besok pagi. Sikap Anda...',
                exampleAns: '<b>Skor 5: Memetakan bagian yang perlu direvisi dan menyelesaikannya dengan cermat agar laporan siap tepat waktu besok pagi.</b>',
                quiz: [
                    {
                        q: 'Anda telah bekerja keras selama setahun terakhir dan berharap mendapatkan promosi jabatan yang kosong, namun pimpinan akhirnya memilih rekan kerja lain yang dinilai lebih memenuhi kualifikasi. Sikap profesional Anda adalah...',
                        options: [
                            'Menurunkan semangat kerja karena merasa kurang dihargai oleh pimpinan.',
                            'Mengajukan protes terbuka di grup pesan kantor dan mempertanyakan keadilan pimpinan.',
                            'Menerima keputusan tersebut dengan lapang dada, mengucapkan selamat kepada rekan yang terpilih, serta mengevaluasi diri untuk meningkatkan kompetensi ke depannya.',
                            'Menolak bekerja sama dengan rekan yang baru dipromosikan tersebut.',
                            'Segera mencari alasan izin sakit selama beberapa hari untuk menenangkan diri.'
                        ],
                        ans: 2,
                        explain: '<b>Skor 5 (Opsi C):</b> Sesuai pembahasan Modul TKP, ASN profesional memiliki <b>kematangan emosi</b>, menghormati keputusan organisasi, mendukung rekan kerja, dan fokus pada <b>evaluasi serta pengembangan diri</b>.'
                    }
                ]
            },
            {
                id: 'tkp-antiradikalisme',
                badge: 'BAB 6 • ANTI-RADIKALISME (SKB 10 MENTERI)',
                title: 'Anti-Radikalisme: 11 Pelanggaran ASN & Prosedur Penanganan Tegas-Santun',
                summary: 'Disarikan langsung dari Modul Singkat TKP (SKB 10 Menteri/Lembaga): kenali 11 bentuk pelanggaran radikalisme ASN dan pilih langkah resmi!',
                points: [
                    'Ingat 3 Ciri Inti Radikalisme: (1) Anti-Pancasila, (2) Anti-Kebhinekaan/Intoleran, (3) Anti-NKRI & UUD 1945.',
                    'Waspadai aktivitas medsos ASN! Berdasarkan SKB 10 Menteri, me-like, me-retweet, berkomentar mendukung, atau menyebarkan konten ujaran kebencian SARA / anti-Pancasila termasuk pelanggaran disiplin berat.',
                    'Rumus Bertindak: Jangan apatis ("diam saja"), jangan ikut terprovokasi, dan jangan main hakim sendiri! Pilih opsi: Verifikasi fakta + Ingatkan secara santun + Lapor ke atasan/kanal resmi (portal aduan ASN).'
                ],
                cheatSheet: `
                    <div class="studi-formula-grid">
                        <div class="studi-formula-card">
                            <strong>Ringkasan 11 Pelanggaran Radikalisme ASN (SKB)</strong>
                            1. Sebar opini/konten kebencian Pancasila, UUD 45, NKRI & Pemerintah.<br>
                            2. Sebar konten menyesatkan/SARA & merendahkan simbol negara.<br>
                            3. <b>Like, love, retweet, atau share</b> konten radikalisme di medsos!<br>
                            4. Ikut organisasi terlarang atau mendanai kegiatan intoleran.
                        </div>
                        <div class="studi-formula-card">
                            <strong>Rumus Skor 5 Soal Anti-Radikalisme</strong>
                            <span class="studi-formula-code">Pegang Teguh Pancasila + Klarifikasi Tenang + Lapor Pihak Berwenang</span>
                        </div>
                    </div>
                `,
                goodKeywords: 'Setia Pancasila & NKRI, tolak intoleransi, saring konten medsos, lapor atasan/pejabat berwenang.',
                trapKeywords: 'Diam karena menganggap itu hak privasi rekan, ikut memberi tanda suka (like) pada unggahan radikal, main hakim sendiri.',
                exampleQ: 'Anda melihat rekan kerja rutin membagikan tautan berisi ajakan menolak dasar negara dan merendahkan pemeluk agama lain di grup internal kantor. Sikap Anda...',
                exampleAns: '<b>Skor 5: Menegur/mengingatkan dengan santun bahwa tindakan tersebut melanggar etika ASN, serta melaporkan temuan tersebut kepada atasan atau bagian pembinaan kepegawaian.</b>',
                quiz: [
                    {
                        q: 'Saat berselancar di media sosial, Anda melihat akun milik seorang rekan ASN di kantor Anda mengunggah tulisan yang menghina lambang negara serta mengajak pengikutnya menolak ideologi Pancasila. Berdasarkan prinsip Anti-Radikalisme ASN, langkah paling tepat adalah...',
                        options: [
                            'Menekan tombol suka (like) sebagai bentuk pertemanan tanpa bermaksud mendukung isinya.',
                            'Mengabaikannya karena aktivitas media sosial di luar jam kerja adalah urusan pribadi masing-masing.',
                            'Membalas unggahan tersebut dengan makian kasar di kolom komentar publik.',
                            'Mengingatkan rekan tersebut secara pribadi mengenai kode etik ASN dan melaporkan bukti tangkapan layar melalui kanal pengaduan resmi/atasan berwenang.',
                            'Membagikan ulang unggahan tersebut ke grup keluarga agar menjadi bahan perbincangan.'
                        ],
                        ans: 3,
                        explain: '<b>Skor 5 (Opsi D):</b> Sesuai <b>SKB Penanganan Radikalisme ASN</b>, bahkan sekadar memberi <i>like/share</i> (Opsi A & E) termasuk pelanggaran! Sikap terbaik adalah <b>tidak ikut menyebarkan, mengingatkan secara santun, dan melaporkan bukti ke pejabat berwenang/kanal resmi</b>.'
                    }
                ]
            }
        ]
    }
};

function getStudiDoneMap() {
    try {
        return JSON.parse(localStorage.getItem('menuju_asn_studi_done_v1') || '{}');
    } catch {
        return {};
    }
}

function saveStudiDoneMap(map) {
    try {
        localStorage.setItem('menuju_asn_studi_done_v1', JSON.stringify(map));
    } catch {}
}

window.currentStudiSubtes = 'twk';
window.currentStudiMode = 'training'; // 'training' (Mode Pelatihan Interaktif) | 'list' (Semua Ringkasan)
window.currentStudiBabIndex = 0;
window.currentStudiStep = 1; // 1: Pahami Konsep & Rumus, 2: Kata Kunci & Jebakan, 3: Uji Paham (Coba Soal)
window.currentStudiQuizAnswers = {}; // { [babId_qIdx]: selectedOptionIndex }

window.syncPusatStudiButtons = () => {
    const isGoldOrAdmin = Boolean(
        window.currentUserProfile?.isAdmin ||
        String(window.currentUserProfile?.tier || '').toLowerCase() === 'gold'
    );
    document.querySelectorAll('.btn-studi-open').forEach(btn => {
        if (isGoldOrAdmin) {
            btn.classList.remove('locked-free');
            btn.innerHTML = `<i class="fas fa-graduation-cap"></i> Mulai Pelatihan &amp; Trik`;
        } else {
            btn.classList.add('locked-free');
            btn.innerHTML = `<i class="fas fa-lock"></i> Buka Materi Gold`;
        }
    });
};

window.bukaMateriPusatStudi = (subtes) => {
    const key = ['twk', 'tiu', 'tkp'].includes(String(subtes).toLowerCase())
        ? String(subtes).toLowerCase()
        : 'twk';

    const isGoldOrAdmin = Boolean(
        window.currentUserProfile?.isAdmin ||
        String(window.currentUserProfile?.tier || '').toLowerCase() === 'gold'
    );

    if (!isGoldOrAdmin) {
        return window.bukaModalUpgrade(`Pusat Studi ASN - Modul ${key.toUpperCase()}`, 'Paket Gold (Rp 99.999)');
    }

    const isSubtesChanged = window.currentStudiSubtes !== key;
    window.currentStudiSubtes = key;

    if (isSubtesChanged) {
        // Pilih bab pertama yang belum selesai, atau bab 0 jika semua selesai
        const mod = PUSAT_STUDI_DATA[key] || PUSAT_STUDI_DATA.twk;
        const doneMap = getStudiDoneMap();
        const firstIncompleteIdx = mod.topics.findIndex(t => !doneMap[t.id]);
        window.currentStudiBabIndex = firstIncompleteIdx >= 0 ? firstIncompleteIdx : 0;
        window.currentStudiStep = 1;
    }

    const searchInput = document.getElementById('studiSearchInput');
    if (searchInput) searchInput.value = '';

    window.renderHalamanPusatStudi(key, '');
    window.switchAppView('studi-detail');
};

window.setStudiViewMode = (mode) => {
    window.currentStudiMode = mode === 'list' ? 'list' : 'training';
    document.querySelectorAll('.studi-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mode') === window.currentStudiMode);
    });
    const searchWrap = document.getElementById('studiSearchBarWrap');
    if (searchWrap) {
        searchWrap.style.display = window.currentStudiMode === 'list' ? 'flex' : 'none';
    }
    const q = document.getElementById('studiSearchInput')?.value.trim().toLowerCase() || '';
    window.renderHalamanPusatStudi(window.currentStudiSubtes || 'twk', q);
};

window.selectStudiBab = (subtes, babIdx) => {
    window.currentStudiSubtes = subtes;
    window.currentStudiBabIndex = Number(babIdx) || 0;
    window.currentStudiStep = 1;
    window.renderHalamanPusatStudi(subtes, '');
};

window.goToStudiStep = (stepNum) => {
    const target = Math.max(1, Math.min(3, Number(stepNum) || 1));
    window.currentStudiStep = target;
    window.renderHalamanPusatStudi(window.currentStudiSubtes || 'twk', '');
};

window.nextStudiStep = () => {
    if (window.currentStudiStep < 3) {
        window.currentStudiStep += 1;
        window.renderHalamanPusatStudi(window.currentStudiSubtes || 'twk', '');
    }
};

window.prevStudiStep = () => {
    if (window.currentStudiStep > 1) {
        window.currentStudiStep -= 1;
        window.renderHalamanPusatStudi(window.currentStudiSubtes || 'twk', '');
    }
};

window.jawabKuisPusatStudi = (babId, qIdx, optIdx, correctIdx) => {
    const key = `${babId}_${qIdx}`;
    window.currentStudiQuizAnswers[key] = Number(optIdx);

    // Jika jawaban benar, otomatis tandai Bab ini Lulus / Selesai!
    if (Number(optIdx) === Number(correctIdx)) {
        const doneMap = getStudiDoneMap();
        if (!doneMap[babId]) {
            doneMap[babId] = true;
            saveStudiDoneMap(doneMap);
        }
    }

    window.renderHalamanPusatStudi(window.currentStudiSubtes || 'twk', '');
};

window.lanjutBabBerikutnyaStudi = () => {
    const subtes = window.currentStudiSubtes || 'twk';
    const mod = PUSAT_STUDI_DATA[subtes] || PUSAT_STUDI_DATA.twk;
    const currentTopic = mod.topics[window.currentStudiBabIndex];

    // Pastikan bab saat ini ditandai selesai saat klik Lanjut Bab Berikutnya
    if (currentTopic) {
        const doneMap = getStudiDoneMap();
        doneMap[currentTopic.id] = true;
        saveStudiDoneMap(doneMap);
    }

    if (window.currentStudiBabIndex < mod.topics.length - 1) {
        window.currentStudiBabIndex += 1;
        window.currentStudiStep = 1;
        window.renderHalamanPusatStudi(subtes, '');
    } else {
        // Jika sudah di bab terakhir, beri umpan balik atau pindah subtes berikutnya
        const nextSubtesOrder = { twk: 'tiu', tiu: 'tkp', tkp: 'twk' };
        const nextSub = nextSubtesOrder[subtes] || 'twk';
        window.bukaMateriPusatStudi(nextSub);
    }
};

window.filterMateriPusatStudi = () => {
    const q = document.getElementById('studiSearchInput')?.value.trim().toLowerCase() || '';
    window.renderHalamanPusatStudi(window.currentStudiSubtes || 'twk', q);
};

window.toggleContohStudi = (btn) => {
    const box = btn?.closest('.studi-example-box')?.querySelector('.studi-example-ans');
    if (!box) return;
    const isHidden = box.style.display === 'none' || !box.style.display;
    box.style.display = isHidden ? 'block' : 'none';
    btn.innerHTML = isHidden
        ? '<i class="fas fa-eye-slash"></i> Sembunyikan Trik &amp; Jawaban'
        : '<i class="fas fa-lightbulb"></i> Lihat Trik &amp; Jawaban';
};

window.toggleBabSelesaiStudi = (subtes, babId) => {
    const doneMap = getStudiDoneMap();
    doneMap[babId] = !doneMap[babId];
    saveStudiDoneMap(doneMap);
    const q = document.getElementById('studiSearchInput')?.value.trim().toLowerCase() || '';
    window.renderHalamanPusatStudi(subtes, q);
};

window.renderHalamanPusatStudi = (subtes, queryText = '') => {
    const mod = PUSAT_STUDI_DATA[subtes] || PUSAT_STUDI_DATA.twk;
    const bannerEl = document.getElementById('studiDetailBanner');
    const titleEl = document.getElementById('studiDetailTitle');
    const subEl = document.getElementById('studiDetailSubtitle');
    const progEl = document.getElementById('studiProgressPill');
    const progBarEl = document.getElementById('studiProgressBarFill');
    const listEl = document.getElementById('studiDetailContent');
    const searchWrap = document.getElementById('studiSearchBarWrap');

    if (bannerEl) {
        bannerEl.className = `view-banner ${mod.bannerClass || 'navy'}`;
    }
    if (titleEl) {
        titleEl.innerHTML = `<i class="fas fa-graduation-cap"></i> ${escapeHtmlMentor(mod.title)}`;
    }
    if (subEl) {
        subEl.textContent = mod.subtitle;
    }

    document.querySelectorAll('.studi-pill').forEach(pill => {
        pill.classList.toggle('active', pill.getAttribute('data-subtes') === subtes);
    });
    document.querySelectorAll('.studi-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mode') === window.currentStudiMode);
    });
    if (searchWrap) {
        searchWrap.style.display = window.currentStudiMode === 'list' ? 'flex' : 'none';
    }

    const doneMap = getStudiDoneMap();
    const totalBab = mod.topics.length;
    const doneCount = mod.topics.filter(t => doneMap[t.id]).length;
    const pct = totalBab > 0 ? Math.round((doneCount / totalBab) * 100) : 0;

    if (progEl) {
        progEl.textContent = `${doneCount} / ${totalBab} Bab Lulus (${pct}%)`;
    }
    if (progBarEl) {
        progBarEl.style.width = `${pct}%`;
    }

    if (!listEl) return;

    // ==========================================================
    // MODE 1: MODE PELATIHAN INTERAKTIF (STEP-BY-STEP DRIVER ACADEMY)
    // ==========================================================
    if (window.currentStudiMode !== 'list') {
        const safeBabIdx = Math.max(0, Math.min(mod.topics.length - 1, window.currentStudiBabIndex || 0));
        window.currentStudiBabIndex = safeBabIdx;
        const topic = mod.topics[safeBabIdx];
        const isBabDone = Boolean(doneMap[topic.id]);
        const step = window.currentStudiStep || 1;

        const roadmapHtml = mod.topics.map((item, idx) => {
            const itemDone = Boolean(doneMap[item.id]);
            const isActive = idx === safeBabIdx;
            const shortTitle = item.title.length > 28 ? `${item.title.slice(0, 28)}...` : item.title;
            return `
                <button type="button"
                    class="studi-bab-chip ${isActive ? 'active' : ''} ${itemDone ? 'done' : ''}"
                    onclick="window.selectStudiBab('${subtes}', ${idx})"
                    title="${escapeHtmlMentor(item.title)}">
                    <span class="chip-num">${itemDone ? '<i class="fas fa-check"></i>' : idx + 1}</span>
                    <span class="chip-label">Bab ${idx + 1}: ${escapeHtmlMentor(shortTitle)}</span>
                </button>
            `;
        }).join('');

        let stageBodyHtml = '';
        let footerRightBtnHtml = '';

        if (step === 1) {
            stageBodyHtml = `
                <div class="studi-stage-body" key="step-1">
                    <div class="studi-stage-kicker">
                        <i class="fas fa-book-reader"></i> Tahap 1 dari 3 • Pahami Konsep &amp; Rumus Cepat
                    </div>
                    <p class="studi-lead-summary">${escapeHtmlMentor(topic.summary)}</p>
                    <div class="studi-animated-points">
                        ${topic.points.map((p, i) => `
                            <div class="studi-point-item" style="animation-delay: ${i * 0.08}s">
                                <span class="studi-point-num">${i + 1}</span>
                                <div class="studi-point-text">${escapeHtmlMentor(p)}</div>
                            </div>
                        `).join('')}
                    </div>
                    ${topic.cheatSheet ? `
                        <div class="studi-cheatsheet-box">
                            <div class="studi-cheatsheet-title">
                                <i class="fas fa-bolt"></i> Kotak Rumus Serba Cepat &amp; Jembatan Keledai
                            </div>
                            <div class="studi-cheatsheet-content">
                                ${topic.cheatSheet}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
            footerRightBtnHtml = `
                <button type="button" class="btn-studi-step-next" onclick="window.nextStudiStep()">
                    Saya Sudah Paham, Lanjut ke Kata Kunci &amp; Jebakan <i class="fas fa-arrow-right"></i>
                </button>
            `;
        } else if (step === 2) {
            stageBodyHtml = `
                <div class="studi-stage-body" key="step-2">
                    <div class="studi-stage-kicker">
                        <i class="fas fa-crosshairs"></i> Tahap 2 dari 3 • Radar Kata Kunci vs Jebakan Soal
                    </div>
                    <div class="studi-radar-grid">
                        <div class="studi-radar-card good" style="animation-delay: 0.04s">
                            <div class="studi-radar-head">
                                <i class="fas fa-check-circle"></i> Kata Kunci Skor Tinggi (Pilih Ini!)
                            </div>
                            <div>${escapeHtmlMentor(topic.goodKeywords)}</div>
                        </div>
                        <div class="studi-radar-card trap" style="animation-delay: 0.12s">
                            <div class="studi-radar-head">
                                <i class="fas fa-exclamation-triangle"></i> Jebakan Umum Peserta (Hindari!)
                            </div>
                            <div>${escapeHtmlMentor(topic.trapKeywords)}</div>
                        </div>
                    </div>
                    <div class="studi-example-box">
                        <div class="studi-example-label"><i class="fas fa-lightbulb"></i> Pemanasan: Bedah Cepat Kasus</div>
                        <p class="studi-example-q">${escapeHtmlMentor(topic.exampleQ)}</p>
                        <div class="studi-example-ans" style="display:block;">
                            ${topic.exampleAns}
                        </div>
                    </div>
                </div>
            `;
            footerRightBtnHtml = `
                <button type="button" class="btn-studi-step-next" onclick="window.nextStudiStep()">
                    Sudah Paham! Lanjut Coba Kerjakan Soal <i class="fas fa-play-circle"></i>
                </button>
            `;
        } else {
            const quizzes = Array.isArray(topic.quiz) && topic.quiz.length ? topic.quiz : [];
            const letters = ['A', 'B', 'C', 'D', 'E'];

            const quizCardsHtml = quizzes.map((qObj, qIdx) => {
                const ansKey = `${topic.id}_${qIdx}`;
                const userSelected = window.currentStudiQuizAnswers[ansKey];
                const hasAnswered = typeof userSelected === 'number';
                const isCorrect = hasAnswered && userSelected === qObj.ans;

                const optsHtml = qObj.options.map((optText, optIdx) => {
                    let stateClass = '';
                    if (hasAnswered) {
                        if (optIdx === userSelected && isCorrect) stateClass = 'selected-correct';
                        else if (optIdx === userSelected && !isCorrect) stateClass = 'selected-wrong';
                        else if (optIdx === qObj.ans) stateClass = 'reveal-correct';
                    }
                    return `
                        <button type="button"
                            class="studi-quiz-opt ${stateClass}"
                            onclick="window.jawabKuisPusatStudi('${topic.id}', ${qIdx}, ${optIdx}, ${qObj.ans})">
                            <span class="opt-letter">${letters[optIdx] || optIdx + 1}</span>
                            <span>${escapeHtmlMentor(optText)}</span>
                        </button>
                    `;
                }).join('');

                const feedbackHtml = hasAnswered ? `
                    <div class="studi-quiz-feedback ${isCorrect ? 'correct' : 'wrong'}">
                        <strong>
                            <i class="fas ${isCorrect ? 'fa-trophy' : 'fa-info-circle'}"></i>
                            ${isCorrect
                                ? 'Mantap! Jawaban Anda Tepat (Bab Otomatis Lulus ✓)'
                                : `Kurang Tepat — Pilihan Terbaik adalah Opsi ${letters[qObj.ans]}`}
                        </strong>
                        <div style="margin-top:6px;">${qObj.explain}</div>
                    </div>
                ` : '';

                return `
                    <div class="studi-quiz-card">
                        <div class="studi-quiz-meta">
                            <span class="studi-quiz-tag"><i class="fas fa-gamepad"></i> Simulasi Uji Paham Bab ${safeBabIdx + 1}</span>
                            <span style="font-size:0.78rem; color:#64748b; font-weight:700;">Klik salah satu opsi A–E untuk menguji pemahamanmu</span>
                        </div>
                        <p class="studi-quiz-question" style="white-space:pre-line;">${escapeHtmlMentor(qObj.q)}</p>
                        <div class="studi-quiz-options">
                            ${optsHtml}
                        </div>
                        ${feedbackHtml}
                    </div>
                `;
            }).join('');

            const isLastBab = safeBabIdx >= mod.topics.length - 1;
            stageBodyHtml = `
                <div class="studi-stage-body" key="step-3">
                    <div class="studi-stage-kicker">
                        <i class="fas fa-award"></i> Tahap 3 dari 3 • Uji Pemahaman (Praktik Langsung)
                    </div>
                    ${quizCardsHtml}
                </div>
            `;
            footerRightBtnHtml = `
                <button type="button" class="btn-studi-step-next success-next" onclick="window.lanjutBabBerikutnyaStudi()">
                    ${isLastBab
                        ? 'Selesaikan Subtes &amp; Lanjut Modul Berikutnya <i class="fas fa-rocket"></i>'
                        : `Lulus Bab ${safeBabIdx + 1} &amp; Lanjut ke Bab ${safeBabIdx + 2} <i class="fas fa-arrow-right"></i>`}
                </button>
            `;
        }

        listEl.innerHTML = `
            <div class="studi-training-wrapper">
                <div class="studi-roadmap-card">
                    <div class="studi-roadmap-header">
                        <span><i class="fas fa-map-signs"></i> Peta Kurikulum Pelatihan (${mod.topics.length} Bab)</span>
                        <span>Klik Bab untuk berpindah modul</span>
                    </div>
                    <div class="studi-roadmap-track">
                        ${roadmapHtml}
                    </div>
                </div>

                <div class="studi-trainer-shell">
                    <div class="studi-trainer-top">
                        <div class="studi-trainer-title-row">
                            <div>
                                <span class="studi-tip-badge">${escapeHtmlMentor(topic.badge)}</span>
                                <h3>${escapeHtmlMentor(topic.title)}</h3>
                            </div>
                            <button type="button" class="btn-studi-done ${isBabDone ? 'done' : ''}" onclick="window.toggleBabSelesaiStudi('${subtes}', '${topic.id}')">
                                <i class="fas ${isBabDone ? 'fa-check-circle' : 'fa-circle'}"></i>
                                ${isBabDone ? 'Bab Lulus ✓' : 'Tandai Lulus'}
                            </button>
                        </div>

                        <div class="studi-stepper">
                            <button type="button"
                                class="studi-step-pill ${step === 1 ? 'current' : step > 1 ? 'passed' : ''}"
                                onclick="window.goToStudiStep(1)">
                                <span class="step-circle">${step > 1 ? '<i class="fas fa-check"></i>' : '1'}</span>
                                <span>1. Pahami Konsep &amp; Rumus</span>
                            </button>
                            <button type="button"
                                class="studi-step-pill ${step === 2 ? 'current' : step > 2 ? 'passed' : ''}"
                                onclick="window.goToStudiStep(2)">
                                <span class="step-circle">${step > 2 ? '<i class="fas fa-check"></i>' : '2'}</span>
                                <span>2. Kata Kunci &amp; Jebakan</span>
                            </button>
                            <button type="button"
                                class="studi-step-pill ${step === 3 ? 'current' : isBabDone ? 'passed' : ''}"
                                onclick="window.goToStudiStep(3)">
                                <span class="step-circle">${isBabDone && step !== 3 ? '<i class="fas fa-check"></i>' : '3'}</span>
                                <span>3. Uji Paham (Coba Soal)</span>
                            </button>
                        </div>
                    </div>

                    ${stageBodyHtml}

                    <div class="studi-trainer-footer">
                        <button type="button"
                            class="btn-studi-step-prev"
                            onclick="window.prevStudiStep()"
                            ${step <= 1 ? 'disabled' : ''}>
                            <i class="fas fa-arrow-left"></i> Tahap Sebelumnya
                        </button>
                        ${footerRightBtnHtml}
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // ==========================================================
    // MODE 2: SEMUA RINGKASAN (LIST PENCARIAN LENGKAP)
    // ==========================================================
    const filtered = mod.topics.filter(t => {
        if (!queryText) return true;
        const hay = `${t.badge} ${t.title} ${t.summary} ${t.points.join(' ')} ${t.goodKeywords} ${t.trapKeywords} ${t.exampleQ}`.toLowerCase();
        return hay.includes(queryText);
    });

    if (!filtered.length) {
        listEl.innerHTML = '<div class="cc-empty">Topik tips &amp; trik tidak ditemukan untuk kata kunci tersebut.</div>';
        return;
    }

    listEl.innerHTML = `<div class="studi-tips-list">` + filtered.map((t, idx) => {
        const isDone = Boolean(doneMap[t.id]);
        const realBabIdx = mod.topics.findIndex(item => item.id === t.id);
        return `
            <article class="studi-tip-card ${isDone ? 'is-done' : ''}">
                <div class="studi-tip-head">
                    <div>
                        <span class="studi-tip-badge">${escapeHtmlMentor(t.badge)}</span>
                        <h3>${escapeHtmlMentor(t.title)}</h3>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button type="button" class="btn-studi-toggle" onclick="window.setStudiViewMode('training'); window.selectStudiBab('${subtes}', ${realBabIdx >= 0 ? realBabIdx : idx});">
                            <i class="fas fa-route"></i> Latihan Step-by-Step
                        </button>
                        <button type="button" class="btn-studi-done ${isDone ? 'done' : ''}" onclick="window.toggleBabSelesaiStudi('${subtes}', '${t.id}')">
                            <i class="fas ${isDone ? 'fa-check-circle' : 'fa-circle'}"></i>
                            ${isDone ? 'Bab Lulus ✓' : 'Tandai Selesai'}
                        </button>
                    </div>
                </div>
                <p class="studi-tip-summary">${escapeHtmlMentor(t.summary)}</p>
                <ul class="studi-tip-points">
                    ${t.points.map(p => `<li>${escapeHtmlMentor(p)}</li>`).join('')}
                </ul>
                ${t.cheatSheet ? `
                    <div class="studi-cheatsheet-box">
                        <div class="studi-cheatsheet-title"><i class="fas fa-bolt"></i> Kotak Rumus Cepat &amp; Tabel Praktis</div>
                        <div class="studi-cheatsheet-content">${t.cheatSheet}</div>
                    </div>
                ` : ''}
                <div class="studi-keywords-grid">
                    <div class="studi-kw-box good">
                        <strong><i class="fas fa-check-circle"></i> Kata Kunci Skor Tinggi:</strong><br>
                        ${escapeHtmlMentor(t.goodKeywords)}
                    </div>
                    <div class="studi-kw-box trap">
                        <strong><i class="fas fa-exclamation-triangle"></i> Jebakan Umum:</strong><br>
                        ${escapeHtmlMentor(t.trapKeywords)}
                    </div>
                </div>
                <div class="studi-example-box">
                    <div class="studi-example-label"><i class="fas fa-bolt"></i> Contoh Kasus Bank Soal</div>
                    <p class="studi-example-q">${escapeHtmlMentor(t.exampleQ)}</p>
                    <button type="button" class="btn-studi-toggle" onclick="window.toggleContohStudi(this)">
                        <i class="fas fa-lightbulb"></i> Lihat Trik &amp; Jawaban
                    </button>
                    <div class="studi-example-ans" style="display:none;">
                        ${t.exampleAns}
                    </div>
                </div>
            </article>
        `;
    }).join('') + `</div>`;
};

// Pembahasan terstruktur ("Judul:: isi" per baris) -> HTML ringkas untuk tampilan non-mentor
function formatStructuredPembahasan(text) {
    const raw = String(text == null ? '' : text);
    if (!/^[^\n:]{2,40}::/m.test(raw)) return raw;
    return raw
        .replace(/^([^\n:]{2,40})::\s*/gm, '<b>$1:</b> ')
        .replace(/\n+/g, '<br>');
}
