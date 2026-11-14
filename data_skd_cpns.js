// ==========================================================
// BANK SOAL RESMI SKD CPNS 2026 (STANDAR BKN & KEMENPAN-RB)
// Subtes: TWK (Bobot 0/5), TIU (Bobot 0/5), TKP (Bobot 1-5)
// ==========================================================
window.DATA_SKD_CPNS = [
    // -------------------------------------------------------------------------
    // 1. TES WAWASAN KEBANGSAAN (TWK) - PASSING GRADE: 65 (Minimal 13 Soal Benar)
    // -------------------------------------------------------------------------
    {
        id: "twk_01",
        kategori: "TWK",
        subKategori: "Nasionalisme",
        soal: "Sikap mengutamakan produk dalam negeri di tengah gempuran produk impor murah merupakan manifestasi nyata dari rasa cinta tanah air. Sikap ini berlandaskan pada prinsip...",
        opsi: [
            { label: "A", teks: "Chauvinisme yang menolak segala pengaruh kebudayaan asing", benar: false, poin: 0 },
            { label: "B", teks: "Nasionalisme proteksionis yang menutup pintu perdagangan bebas", benar: false, poin: 0 },
            { label: "C", teks: "Kemandirian ekonomi berbasis gotong royong dan ketahanan nasional", benar: true, poin: 5 },
            { label: "D", teks: "Sentimen kedaerahan guna melindungi produsen lokal semata", benar: false, poin: 0 },
            { label: "E", teks: "Kewajiban konstitusional yang bersifat mengikat seluruh warga negara", benar: false, poin: 0 }
        ],
        kunci: "C",
        pembahasan: "Mengutamakan produk dalam negeri mencerminkan nasionalisme ekonomi yang bertujuan memperkuat ketahanan ekonomi nasional dan mewujudkan kemandirian bangsa (Berdikari secara ekonomi sesuai Trisakti)."
    },
    {
        id: "twk_02",
        kategori: "TWK",
        subKategori: "Integritas",
        soal: "Seorang ASN di bagian pengadaan barang dan jasa menolak pemberian tiket liburan ke luar negeri dari vendor pemenang tender. Tindakan ASN tersebut paling mencerminkan penerapan nilai integritas...",
        opsi: [
            { label: "A", teks: "Akuntabilitas publik dan kejujuran", benar: false, poin: 0 },
            { label: "B", teks: "Independensi dan penolakan gratifikasi ilegal", benar: true, poin: 5 },
            { label: "C", teks: "Ketaatan hierarki kepemimpinan instansi", benar: false, poin: 0 },
            { label: "D", teks: "Solidaritas sesama korps pegawai negeri", benar: false, poin: 0 },
            { label: "E", teks: "Efisiensi pengelolaan anggaran operasional kantor", benar: false, poin: 0 }
        ],
        kunci: "B",
        pembahasan: "Pemberian fasilitas wisata oleh rekanan kepada pejabat/pegawai negeri masuk dalam kategori gratifikasi yang berpotensi menimbulkan benturan kepentingan (Pasal 12B UU Tipikor). Menolaknya adalah wujud independensi dan integritas tinggi."
    },
    {
        id: "twk_03",
        kategori: "TWK",
        subKategori: "Bela Negara",
        soal: "Di era transformasi digital, ancaman terhadap kedaulatan negara tidak hanya berbentuk agresi militer bersenjata, melainkan perang siber (cyber warfare) dan disinformasi. Bentuk bela negara yang paling relevan bagi generasi muda adalah...",
        opsi: [
            { label: "A", teks: "Wajib militer bagi seluruh warga negara produktif", benar: false, poin: 0 },
            { label: "B", teks: "Menutup seluruh akses internet dari luar negeri", benar: false, poin: 0 },
            { label: "C", teks: "Meningkatkan literasi digital dan aktif menangkal hoaks pemecah belah bangsa", benar: true, poin: 5 },
            { label: "D", teks: "Menghindari keterlibatan dalam diskusi sosial-politik di ruang maya", benar: false, poin: 0 },
            { label: "E", teks: "Membuat aplikasi pengawas aktivitas digital masyarakat secara tertutup", benar: false, poin: 0 }
        ],
        kunci: "C",
        pembahasan: "Bela negara non-fisik di era modern diwujudkan melalui kemampuan berpikir kritis, literasi digital yang kokoh, serta peran aktif menjaga kohesi sosial dan persatuan bangsa di ruang siber."
    },
    {
        id: "twk_04",
        kategori: "TWK",
        subKategori: "Pilar Negara",
        soal: "Berdasarkan Pasal 1 ayat (3) UUD NRI Tahun 1945, Indonesia adalah negara hukum (rechtsstaat). Konsekuensi logis dari prinsip supremasi hukum tersebut adalah...",
        opsi: [
            { label: "A", teks: "Presiden memiliki kewenangan tertinggi dalam menafsirkan perundang-undangan", benar: false, poin: 0 },
            { label: "B", teks: "Setiap tindakan penguasa dan warga negara wajib tunduk pada hukum yang berlaku dan adanya jaminan persamaan di hadapan hukum", benar: true, poin: 5 },
            { label: "C", teks: "Keputusan mayoritas parlemen selalu sah secara mutlak mengikat", benar: false, poin: 0 },
            { label: "D", teks: "Lembaga yudikatif berada di bawah kendali pengawasan eksekutif", benar: false, poin: 0 },
            { label: "E", teks: "Hukum adat sepenuhnya menggantikan kodifikasi hukum positif nasional", benar: false, poin: 0 }
        ],
        kunci: "B",
        pembahasan: "Ciri fundamental rechtsstaat (negara hukum) adalah supremasi hukum (supremacy of law), kepastian hukum, peradilan yang merdeka, dan perlakuan setara di depan hukum (equality before the law)."
    },
    {
        id: "twk_05",
        kategori: "TWK",
        subKategori: "Bhinneka Tunggal Ika",
        soal: "Pemberian otonomi khusus bagi beberapa daerah di Indonesia merupakan implementasi semboyan Bhinneka Tunggal Ika yang bertujuan...",
        opsi: [
            { label: "A", teks: "Mempersiapkan kemandirian daerah untuk memisahkan diri secara bertahap", benar: false, poin: 0 },
            { label: "B", teks: "Menghargai keberagaman kearifan lokal dan sejarah daerah dalam kerangka keutuhan NKRI", benar: true, poin: 5 },
            { label: "C", teks: "Mengurangi beban transfer fiskal anggaran pendapatan dan belanja negara", benar: false, poin: 0 },
            { label: "D", teks: "Menciptakan persaingan antardaerah dalam hal kekuasaan politik", benar: false, poin: 0 },
            { label: "E", teks: "Menyeragamkan seluruh sistem pemerintahan daerah sesuai ibukota", benar: false, poin: 0 }
        ],
        kunci: "B",
        pembahasan: "Otonomi khusus adalah pengakuan negara atas keanekaragaman historis, sosiologis, dan budaya daerah (Bhinneka) guna memperkuat ikatan persatuan dan keutuhan Negara Kesatuan Republik Indonesia (Tunggal Ika)."
    },

    // -------------------------------------------------------------------------
    // 2. TES INTELIGENSI UMUM (TIU) - PASSING GRADE: 80 (Minimal 16 Soal Benar)
    // -------------------------------------------------------------------------
    {
        id: "tiu_01",
        kategori: "TIU",
        subKategori: "Silogisme",
        soal: "Semua ASN wajib menandatangani pakta integritas.\nSebagian staf yang menandatangani pakta integritas ditugaskan ke wilayah 3T (Terdepan, Terluar, Tertinggal).\n\nKesimpulan yang paling tepat adalah...",
        opsi: [
            { label: "A", teks: "Semua yang ditugaskan ke wilayah 3T adalah ASN", benar: false, poin: 0 },
            { label: "B", teks: "Sebagian ASN ditugaskan ke wilayah 3T", benar: true, poin: 5 },
            { label: "C", teks: "Semua ASN ditugaskan ke wilayah 3T", benar: false, poin: 0 },
            { label: "D", teks: "Sebagian staf yang bukan ASN ditugaskan ke wilayah 3T", benar: false, poin: 0 },
            { label: "E", teks: "Tidak ada ASN yang tidak ditugaskan ke wilayah 3T", benar: false, poin: 0 }
        ],
        kunci: "B",
        pembahasan: "Premis 1: Semua ASN = Pakta Integritas (A ⊂ B). Premis 2: Sebagian Pakta Integritas = 3T. Kesimpulan: Sebagian ASN ditugaskan ke wilayah 3T."
    },
    {
        id: "tiu_02",
        kategori: "TIU",
        subKategori: "Analogi",
        soal: "HAKIM : PENGADILAN = DOKTER : ...",
        opsi: [
            { label: "A", teks: "Stetoskop", benar: false, poin: 0 },
            { label: "B", teks: "Pasien", benar: false, poin: 0 },
            { label: "C", teks: "Rumah Sakit", benar: true, poin: 5 },
            { label: "D", teks: "Obat", benar: false, poin: 0 },
            { label: "E", teks: "Diagnosis", benar: false, poin: 0 }
        ],
        kunci: "C",
        pembahasan: "Hubungan profesi dan tempat kerja utamanya. Hakim bertugas di Pengadilan; Dokter bertugas di Rumah Sakit."
    },
    {
        id: "tiu_03",
        kategori: "TIU",
        subKategori: "Hitung Cepat",
        soal: "Jika 40% dari X adalah 160, maka nilai dari 75% dari (X + 100) adalah...",
        opsi: [
            { label: "A", teks: "350", benar: false, poin: 0 },
            { label: "B", teks: "375", benar: true, poin: 5 },
            { label: "C", teks: "400", benar: false, poin: 0 },
            { label: "D", teks: "425", benar: false, poin: 0 },
            { label: "E", teks: "450", benar: false, poin: 0 }
        ],
        kunci: "B",
        pembahasan: "0.4 * X = 160 -> X = 160 / 0.4 = 400. Maka (X + 100) = 500. Nilai 75% dari 500 = 0.75 * 500 = 375."
    },
    {
        id: "tiu_04",
        kategori: "TIU",
        subKategori: "Deret Angka",
        soal: "Perhatikan deret berikut: 3, 7, 15, 31, 63, ... Angka berikutnya adalah...",
        opsi: [
            { label: "A", teks: "125", benar: false, poin: 0 },
            { label: "B", teks: "126", benar: false, poin: 0 },
            { label: "C", teks: "127", benar: true, poin: 5 },
            { label: "D", teks: "128", benar: false, poin: 0 },
            { label: "E", teks: "129", benar: false, poin: 0 }
        ],
        kunci: "C",
        pembahasan: "Pola: (n * 2) + 1. (3*2)+1 = 7; (7*2)+1 = 15; (15*2)+1 = 31; (31*2)+1 = 63; (63*2)+1 = 127. Atau pola selisih: +4, +8, +16, +32, +64 -> 63 + 64 = 127."
    },
    {
        id: "tiu_05",
        kategori: "TIU",
        subKategori: "Penalaran Analitis",
        soal: "Lima berkas (A, B, C, D, E) harus diperiksa berurutan.\n- Berkas B diperiksa sebelum A dan setelah D.\n- Berkas C diperiksa paling awal.\n- Berkas E diperiksa tepat setelah A.\n\nUrutan pemeriksaan berkas yang benar adalah...",
        opsi: [
            { label: "A", teks: "C - D - B - A - E", benar: true, poin: 5 },
            { label: "B", teks: "C - B - D - A - E", benar: false, poin: 0 },
            { label: "C", teks: "D - C - B - A - E", benar: false, poin: 0 },
            { label: "D", teks: "C - D - A - B - E", benar: false, poin: 0 },
            { label: "E", teks: "C - A - B - D - E", benar: false, poin: 0 }
        ],
        kunci: "A",
        pembahasan: "Posisi 1: C (paling awal). Urutan D, B, A (karena B setelah D dan sebelum A). E tepat setelah A. Maka urutannya: C -> D -> B -> A -> E."
    },

    // -------------------------------------------------------------------------
    // 3. TES KARAKTERISTIK PRIBADI (TKP) - PASSING GRADE: 166 (Skala Bobot Nilai 1 s.d. 5)
    // -------------------------------------------------------------------------
    {
        id: "tkp_01",
        kategori: "TKP",
        subKategori: "Pelayanan Publik",
        soal: "Saat jam pelayanan hampir selesai dan loket hendak ditutup, seorang warga lansia datang dengan terengah-engah hendak mengurus dokumen administrasi kependudukan yang sangat mendesak. Sikap Anda sebagai petugas adalah...",
        opsi: [
            { label: "A", teks: "Menutup loket tepat waktu dan meminta warga tersebut kembali besok pagi sesuai SOP jam operasional", poin: 1 },
            { label: "B", teks: "Menyarankan warga tersebut menemui atasan Anda untuk meminta izin khusus", poin: 2 },
            { label: "C", teks: "Meminta bantuan rekan kerja yang masih santai untuk melayani lansia tersebut", poin: 3 },
            { label: "D", teks: "Menyapa dengan ramah, meneliti berkasnya, dan jika lengkap menjanjikan akan diproses pertama kali besok pagi", poin: 4 },
            { label: "E", teks: "Mempersilakan duduk dengan ramah, memeriksa kelengkapan berkas, dan memprosesnya hingga tuntas dengan ikhlas meski sedikit melewati jam kerja", poin: 5 }
        ],
        kunci: "E",
        pembahasan: "Indikator Pelayanan Publik Prima: Mengutamakan empati, responsif terhadap kelompok rentan (lansia), dan tulus menyelesaikan kebutuhan masyarakat tanpa kaku terhadap batas waktu."
    },
    {
        id: "tkp_02",
        kategori: "TKP",
        subKategori: "Jejaring Kerja",
        soal: "Instansi Anda membentuk tim lintas divisi untuk menyusun laporan evaluasi reformasi birokrasi. Namun, beberapa rekan dari divisi lain terkesan pasif dan lambat merespons pesan koordinasi. Tindakan Anda adalah...",
        opsi: [
            { label: "A", teks: "Melaporkan rekan yang pasif tersebut kepada pimpinan masing-masing divisi", poin: 2 },
            { label: "B", teks: "Mengerjakan bagian mereka sendiri agar laporan selesai tepat waktu daripada menunggu", poin: 3 },
            { label: "C", teks: "Menyindir mereka di grup koordinasi agar merasa malu dan mulai bekerja", poin: 1 },
            { label: "D", teks: "Menghubungi mereka secara personal, menanyakan kendala yang dihadapi, dan menawarkan pembagian tugas yang lebih realistis dan adaptif", poin: 5 },
            { label: "E", teks: "Menyerahkan kelanjutan koordinasi kepada ketua tim yang ditunjuk", poin: 4 }
        ],
        kunci: "D",
        pembahasan: "Indikator Jejaring Kerja & Kolaborasi: Komunikasi persuasif dua arah secara asertif, membangun empati, dan berorientasi pada penyelesaian masalah bersama."
    },
    {
        id: "tkp_03",
        kategori: "TKP",
        subKategori: "Teknologi Informasi & Komunikasi (TIK)",
        soal: "Kementerian Anda mulai menerapkan sistem aplikasi arsip digital baru yang menggantikan metode manual. Anda belum pernah menggunakan aplikasi tersebut dan merasa kesulitan. Sikap Anda adalah...",
        opsi: [
            { label: "A", teks: "Tetap menggunakan cara lama yang sudah terbukti cepat sambil menunggu instruksi wajib", poin: 1 },
            { label: "B", teks: "Mempelajari manual book secara mandiri, mengikuti pelatihan dengan antusias, dan bertanya kepada tim IT atau rekan yang sudah mahir", poin: 5 },
            { label: "C", teks: "Menunggu rekan kerja lain mencoba terlebih dahulu untuk melihat apakah sistem tersebut stabil", poin: 3 },
            { label: "D", teks: "Mengeluhkan aplikasi baru tersebut karena dianggap memperlambat rutinitas kerja harian", poin: 2 },
            { label: "E", teks: "Meminta bantuan rekan kerja lain untuk menginput arsip tugas saya ke aplikasi baru tersebut", poin: 4 }
        ],
        kunci: "B",
        pembahasan: "Indikator Pemanfaatan TIK: Terbuka terhadap transformasi digital, proaktif belajar mandiri, dan cepat beradaptasi dengan teknologi baru pendukung efisiensi birokrasi."
    },
    {
        id: "tkp_04",
        kategori: "TKP",
        subKategori: "Profesionalisme",
        soal: "Anda ditugaskan menyelesaikan draf peraturan penting dengan batas waktu sore hari ini. Pada saat yang sama, sahabat karib Anda datang ke kantor meminta bantuan pribadi yang cukup menyita waktu. Sikap Anda adalah...",
        opsi: [
            { label: "A", teks: "Meninggalkan draf sejenak untuk membantu sahabat karena persahabatan adalah hal utama", poin: 1 },
            { label: "B", teks: "Menjelaskan dengan sopan bahwa Anda sedang memiliki tanggung jawab mendesak dari pimpinan, dan menawarkan untuk membantunya setelah jam kerja selesai", poin: 5 },
            { label: "C", teks: "Meminta izin kepada pimpinan untuk mengantar sahabat terlebih dahulu", poin: 2 },
            { label: "D", teks: "Menyuruh sahabat pulang tanpa penjelasan karena sedang sangat sibuk", poin: 3 },
            { label: "E", teks: "Meminta rekan kerja lain menyelesaikan draf tugas Anda agar Anda bisa membantu sahabat", poin: 4 }
        ],
        kunci: "B",
        pembahasan: "Indikator Profesionalisme: Mampu memisahkan urusan kedinasan dengan kepentingan pribadi, memprioritaskan tugas publik, namun tetap menjaga etika hubungan interpersonal."
    },
    {
        id: "tkp_05",
        kategori: "TKP",
        subKategori: "Anti Radikalisme",
        soal: "Di grup percakapan internal kantor, salah satu rekan kerja sering membagikan video ceramah bernada ujaran kebencian terhadap suku/agama tertentu dan menyudutkan konsensus dasar Pancasila. Sikap Anda adalah...",
        opsi: [
            { label: "A", teks: "Mendiamkan saja agar tidak terjadi keributan dan perselisihan di lingkungan kerja", poin: 2 },
            { label: "B", teks: "Langsung keluar dari grup kantor sebagai bentuk protes keras", poin: 1 },
            { label: "C", teks: "Menegurnya secara santun di ruang pribadi agar menjaga netralitas dan tidak menyebarkan konten provokatif di kanal kedinasan, serta melaporkannya ke atasan/unit kepatuhan jika berulang", poin: 5 },
            { label: "D", teks: "Membalas pesannya di grup dengan argumen keras dan menyerang balik secara emosional", poin: 3 },
            { label: "E", teks: "Menceritakan perilaku rekan tersebut kepada seluruh rekan kerja lainnya di jam istirahat", poin: 4 }
        ],
        kunci: "C",
        pembahasan: "Indikator Anti-Radikalisme: Tegas menolak paham intoleran/radikal, mengambil tindakan solutif yang beretika (ingatkan secara personal terlebih dahulu), dan memiliki komitmen melapor ke saluran resmi jika berlanjut demi menjaga netralitas ASN."
    }
];
