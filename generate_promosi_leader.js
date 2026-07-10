const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();

// ==========================================
// PENGATURAN UMUM (THEME: CORPORATE MODERN)
// ==========================================
pptx.layout = "LAYOUT_16x9";
pptx.author = "Calon Leader Gudang 13";
pptx.company = "PT. Steel Pipe Industry of Indonesia (SPINDO)";
pptx.title = "Proposal Peningkatan Efisiensi Gudang 13";

// Warna Tema SPINDO (Merah, Hitam, Abu-abu, Putih)
const theme = {
    primary: "BF0A30", // SPINDO Red
    dark: "1C1C1C",
    lightGray: "F5F5F7",
    textDark: "333333",
    textLight: "FFFFFF"
};

// ==========================================
// SLIDE 1: JUDUL (COVER)
// ==========================================
const slide1 = pptx.addSlide();
slide1.background = { color: theme.dark };
// Aksen bentuk
slide1.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: "40%", h: "100%", fill: { color: theme.primary } });
// Judul
slide1.addText("DIGITALISASI\nGUDANG 13", {
    x: 0.5, y: 2.0, w: 4, h: 1.5,
    fontSize: 44, bold: true, color: theme.textLight, fontFace: "Helvetica Neue"
});
slide1.addText("Inovasi In-Out Pipa untuk Efisiensi Waktu & Penghematan Budget", {
    x: 0.5, y: 3.5, w: 4, h: 1,
    fontSize: 16, color: theme.textLight, fontFace: "Helvetica Neue"
});
// Info Kanan
slide1.addText("PT. Steel Pipe Industry of Indonesia\nPlant Karawang", {
    x: 5.0, y: 4.5, w: 4.5, h: 1,
    fontSize: 14, color: "AAAAAA", align: "right", fontFace: "Helvetica Neue"
});

// ==========================================
// SLIDE 2: MASALAH SAAT INI (PAIN POINTS)
// ==========================================
const slide2 = pptx.addSlide();
slide2.background = { color: theme.lightGray };
slide2.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: "100%", h: 0.8, fill: { color: theme.primary } });
slide2.addText("TANTANGAN OPERASIONAL SAAT INI", { x: 0.5, y: 0.15, w: 8, h: 0.5, fontSize: 24, bold: true, color: theme.textLight });

// Box Kiri (Budget)
slide2.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 1.5, w: 4.2, h: 3, fill: { color: "FFFFFF" }, line: { color: "CCCCCC", width: 1 } });
slide2.addText("1. Boros Budget Operasional", { x: 0.8, y: 1.7, w: 3.6, h: 0.4, fontSize: 18, bold: true, color: theme.primary });
slide2.addText("• Pencatatan manual masih boros kertas, tinta, dan form cetak.\n• Risiko kehilangan/kerusakan form rekap harian.\n• Susah melacak selisih stok secara cepat.", { x: 0.8, y: 2.2, w: 3.6, h: 2, fontSize: 14, color: theme.textDark, bullet: false });

// Box Kanan (Waktu)
slide2.addShape(pptx.shapes.RECTANGLE, { x: 5.3, y: 1.5, w: 4.2, h: 3, fill: { color: "FFFFFF" }, line: { color: "CCCCCC", width: 1 } });
slide2.addText("2. Alur Kerja Lambat", { x: 5.6, y: 1.7, w: 3.6, h: 0.4, fontSize: 18, bold: true, color: theme.primary });
slide2.addText("• Tarik data SAP (MB51) dan mencocokkan data gudang butuh waktu berjam-jam.\n• Koordinasi antar shift sering missed karena tulisan tangan atau form terselip.\n• Waktu kerja admin habis untuk rekapitulasi data.", { x: 5.6, y: 2.2, w: 3.6, h: 2, fontSize: 14, color: theme.textDark, bullet: false });

// ==========================================
// SLIDE 3: SOLUSI (APLIKASI DAILY REPORT)
// ==========================================
const slide3 = pptx.addSlide();
slide3.background = { color: theme.dark };
slide3.addText("SOLUSI YANG SAYA KEMBANGKAN", { x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 28, bold: true, color: theme.primary });
slide3.addText("Sistem Aplikasi Web Daily Report Terintegrasi", { x: 0.5, y: 1.2, w: 9, h: 0.5, fontSize: 18, color: "CCCCCC" });
slide3.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 2.0, w: 9, h: 2.8, fill: { color: "2B2B2B" } });
slide3.addText("FITUR UNGGULAN YANG SUDAH BERJALAN:", { x: 0.8, y: 2.2, w: 8, h: 0.5, fontSize: 16, bold: true, color: theme.textLight });
slide3.addText("1. Sinkronisasi Otomatis MB51 SAP: Cukup beberapa klik, data In-Out pipa masuk ke sistem.\n2. Laporan Digital (Paperless): Export langsung ke PDF / Excel tanpa perlu cetak.\n3. Real-Time Tracking: Kepala Regu dan Admin bisa pantau status gudang kapan saja dari HP/PC.\n4. Hak Akses Aman: Data tidak bisa dimanipulasi sembarangan (ada log setiap user).", {
    x: 0.8, y: 2.8, w: 8, h: 1.5, fontSize: 14, color: "E0E0E0"
});

// ==========================================
// SLIDE 4: VALUE PROPOSITION (BUDGET & WAKTU)
// ==========================================
const slide4 = pptx.addSlide();
slide4.background = { color: theme.lightGray };
slide4.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: "100%", h: 0.8, fill: { color: theme.primary } });
slide4.addText("DAMPAK NYATA UNTUK PERUSAHAAN", { x: 0.5, y: 0.15, w: 8, h: 0.5, fontSize: 24, bold: true, color: theme.textLight });

// Slide 4:
slide4.addShape(pptx.shapes.OVAL, { x: 1.0, y: 1.5, w: 1.5, h: 1.5, fill: { color: theme.primary } });
slide4.addText("80%", { x: 1.0, y: 1.5, w: 1.5, h: 1.5, fontSize: 32, bold: true, color: theme.textLight, align: "center" });
slide4.addText("Lebih Cepat", { x: 0.5, y: 3.2, w: 2.5, h: 0.5, fontSize: 16, bold: true, align: "center", color: theme.textDark });
slide4.addText("Proses rekap SAP MB51 dan serah terima shift harian dari jam-jaman menjadi hitungan menit.", { x: 0.2, y: 3.7, w: 3.1, h: 1, fontSize: 12, align: "center" });

// Uang
slide4.addShape(pptx.shapes.OVAL, { x: 4.25, y: 1.5, w: 1.5, h: 1.5, fill: { color: "1C1C1C" } });
slide4.addText("0", { x: 4.25, y: 1.5, w: 1.5, h: 1.5, fontSize: 32, bold: true, color: theme.textLight, align: "center" });
slide4.addText("Biaya Kertas", { x: 3.75, y: 3.2, w: 2.5, h: 0.5, fontSize: 16, bold: true, align: "center", color: theme.textDark });
slide4.addText("Pengurangan drastis pemakaian form kertas dan tinta (Paperless Warehouse).", { x: 3.45, y: 3.7, w: 3.1, h: 1, fontSize: 12, align: "center" });

// Akurasi
slide4.addShape(pptx.shapes.OVAL, { x: 7.5, y: 1.5, w: 1.5, h: 1.5, fill: { color: theme.primary } });
slide4.addText("99%", { x: 7.5, y: 1.5, w: 1.5, h: 1.5, fontSize: 32, bold: true, color: theme.textLight, align: "center" });
slide4.addText("Akurasi Data", { x: 7.0, y: 3.2, w: 2.5, h: 0.5, fontSize: 16, bold: true, align: "center", color: theme.textDark });
slide4.addText("Meminimalisir salah input material, selisih jumlah pipa, dan denda audit.", { x: 6.7, y: 3.7, w: 3.1, h: 1, fontSize: 12, align: "center" });

// ==========================================
// SLIDE 5: VISI SEBAGAI KEPALA REGU
// ==========================================
const slide5 = pptx.addSlide();
slide5.background = { color: theme.dark };
// Garis merah
slide5.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0.5, w: 0.3, h: 4.6, fill: { color: theme.primary } });

slide5.addText("TARGET SAYA JIKA DIPERCAYA MENJADI KEPALA REGU", { x: 0.8, y: 0.8, w: 8, h: 0.6, fontSize: 24, bold: true, color: theme.textLight });

slide5.addText("✔ 1. Menjadikan Gudang 13 sebagai percontohan 'Smart Warehouse' bagi plant Karawang.", { x: 0.8, y: 1.8, w: 8, h: 0.5, fontSize: 16, color: "CCCCCC" });
slide5.addText("✔ 2. Mengurangi lembur (overtime) administrasi karena data sudah otomatis sinkron setiap saat.", { x: 0.8, y: 2.5, w: 8, h: 0.5, fontSize: 16, color: "CCCCCC" });
slide5.addText("✔ 3. Membangun tim kerja yang gesit dan tidak bergantung pada cara-cara lama yang memakan waktu.", { x: 0.8, y: 3.2, w: 8, h: 0.5, fontSize: 16, color: "CCCCCC" });

slide5.addText("Kerja cerdas bukan berarti meninggalkan aturan dasar,\ntapi mempermudah operasional agar lebih efektif dan menguntungkan perusahaan.", {
    x: 0.8, y: 4.2, w: 8.5, h: 1, fontSize: 14, italic: true, color: theme.primary
});

// Generate File
const filePath = "Presentasi_Promosi_Leader_Gudang13.pptx";
pptx.writeFile({ fileName: filePath }).then(() => {
    console.log("PPTX created successfully!");
});
