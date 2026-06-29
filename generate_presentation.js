// generate_presentation.js
const pptxgen = require("pptxgenjs");
const fs = require('fs');

async function createPresentation() {
  let pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9'; 
  pres.author = 'Admin';
  pres.title = 'SPINDO Warehouse Daily Report System';

  // --- COLORS & STYLING ---
  const PRIMARY = "1591DC"; // SPINDO Blue
  const SECONDARY = "2C5EAD"; // Darker Blue
  const ACCENT = "4BB8FA"; // Light Blue
  const WHITE = "FFFFFF";
  const TEXT_DARK = "333333";
  const TEXT_MUTED = "777777";
  const BG_COLOR = "F8F9FA"; // Very light gray background
  
  const getShadow = () => ({ type: "outer", color: "000000", blur: 4, offset: 1.5, angle: 90, opacity: 0.1 });

  // --- MASTER SLIDES ---
  pres.defineSlideMaster({
    title: 'MASTER_TITLE',
    background: { color: PRIMARY },
    objects: [
      { rect: { x: 0, y: 0, w: 10, h: 5.625, fill: { color: PRIMARY } } },
      // Decorative background element
      { rect: { x: -2, y: 3, w: 14, h: 4, fill: { color: SECONDARY, transparency: 50 }, rotate: -5 } },
    ]
  });

  pres.defineSlideMaster({
    title: 'MASTER_CONTENT',
    background: { color: BG_COLOR },
    objects: [
      // Top header bar
      { rect: { x: 0, y: 0, w: 10, h: 0.1, fill: { color: PRIMARY } } },
      // Subtle footer
      { text: { text: "SPINDO Warehouse Daily Report", options: { x: 0.5, y: 5.3, w: 4, h: 0.3, fontSize: 10, color: "A0A0A0", align: "left" } } },
      { text: { text: "2026", options: { x: 8, y: 5.3, w: 1.5, h: 0.3, fontSize: 10, color: "A0A0A0", align: "right" } } }
    ]
  });


  // =========================================================================
  // SLIDE 1: TITLE
  // =========================================================================
  let slide1 = pres.addSlide({ masterName: "MASTER_TITLE" });
  
  slide1.addText("Otomatisasi & Visualisasi\nPelaporan Harian Gudang SPINDO", {
    x: 1, y: 1.5, w: 8, h: 1.5,
    fontSize: 32, fontFace: "Arial", color: WHITE, bold: true, align: "center", breakLine: true
  });

  slide1.addText("Transformasi Digital dari Manual Excel ke Dashboard Analitik Real-time", {
    x: 1, y: 3.2, w: 8, h: 0.6,
    fontSize: 18, fontFace: "Arial", color: "E0F2FE", align: "center"
  });


  // =========================================================================
  // SLIDE 2: THE PAIN (Masalah)
  // =========================================================================
  let slide2 = pres.addSlide({ masterName: "MASTER_CONTENT" });
  
  // Title
  slide2.addText("Latar Belakang & Masalah", {
    x: 0.5, y: 0.4, w: 6, h: 0.6, fontSize: 24, fontFace: "Arial", color: SECONDARY, bold: true
  });

  // Main Card
  slide2.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.2, w: 9, h: 3.8, fill: { color: WHITE }, shadow: getShadow()
  });
  // Accent bar on card
  slide2.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.2, w: 0.1, h: 3.8, fill: { color: "EF4444" } // Red accent for problems
  });

  slide2.addText([
    { text: "Proses Manual yang Memakan Waktu", options: { bold: true, fontSize: 16, color: TEXT_DARK, breakLine: true } },
    { text: "Pelaporan harian mengandalkan tarikan data mentah SAP yang dikalkulasi manual di Excel setiap hari.", options: { fontSize: 14, color: TEXT_MUTED, breakLine: true } },
    { text: " ", options: { fontSize: 8, breakLine: true } },

    { text: "Rentan Human Error", options: { bold: true, fontSize: 16, color: TEXT_DARK, breakLine: true } },
    { text: "Perhitungan mutasi (Movement Type) dan sisa stok rawan kesalahan rumus atau keliru input.", options: { fontSize: 14, color: TEXT_MUTED, breakLine: true } },
    { text: " ", options: { fontSize: 8, breakLine: true } },

    { text: "Kurangnya Visibilitas Real-time", options: { bold: true, fontSize: 16, color: TEXT_DARK, breakLine: true } },
    { text: "Manajemen sulit memonitor utilisasi kapasitas dan pergerakan stok (Fast/Slow) secara aktual di 14 Gudang.", options: { fontSize: 14, color: TEXT_MUTED, breakLine: true } },
    { text: " ", options: { fontSize: 8, breakLine: true } },

    { text: "Data Tidak Terpusat", options: { bold: true, fontSize: 16, color: TEXT_DARK, breakLine: true } },
    { text: "Laporan tersebar di file lokal, menyulitkan pencarian data riwayat (history).", options: { fontSize: 14, color: TEXT_MUTED } }
  ], { x: 0.8, y: 1.4, w: 8.5, h: 3.4 });


  // =========================================================================
  // SLIDE 3: THE SOLUTION
  // =========================================================================
  let slide3 = pres.addSlide({ masterName: "MASTER_CONTENT" });
  
  slide3.addText("Solusi yang Dibangun", {
    x: 0.5, y: 0.4, w: 6, h: 0.6, fontSize: 24, fontFace: "Arial", color: SECONDARY, bold: true
  });

  slide3.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.2, w: 9, h: 3.8, fill: { color: WHITE }, shadow: getShadow()
  });
  slide3.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.2, w: 0.1, h: 3.8, fill: { color: "10B981" } // Green accent for solutions
  });

  slide3.addText("SPINDO Warehouse Daily Report System", {
    x: 0.8, y: 1.4, w: 8, h: 0.5, fontSize: 20, fontFace: "Arial", color: PRIMARY, bold: true
  });

  slide3.addText("Aplikasi web terintegrasi yang memproses, mengkalkulasi, dan memvisualisasikan data SAP ke dalam Dashboard Eksekutif.", {
    x: 0.8, y: 1.9, w: 8.4, h: 0.6, fontSize: 14, color: TEXT_MUTED
  });

  // Feature boxes
  slide3.addShape(pres.shapes.RECTANGLE, { x: 1, y: 2.8, w: 3.8, h: 1.5, fill: { color: "F0FDF4" }, line: { color: "A7F3D0", width: 1 } });
  slide3.addText("1-Click Upload", { x: 1.2, y: 2.9, w: 3.4, h: 0.4, fontSize: 16, bold: true, color: "065F46" });
  slide3.addText("Unggah raw Excel dari SAP, sistem otomatis mengekstrak & membersihkan data.", { x: 1.2, y: 3.4, w: 3.4, h: 0.8, fontSize: 13, color: "047857" });

  slide3.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 2.8, w: 3.8, h: 1.5, fill: { color: "EFF6FF" }, line: { color: "BFDBFE", width: 1 } });
  slide3.addText("Auto-Calculation", { x: 5.4, y: 2.9, w: 3.4, h: 0.4, fontSize: 16, bold: true, color: "1E3A8A" });
  slide3.addText("Hitung KPI mutasi in/out, transfer antar SLOC, & utilisasi tonase dalam hitungan detik.", { x: 5.4, y: 3.4, w: 3.4, h: 0.8, fontSize: 13, color: "1D4ED8" });


  // =========================================================================
  // SLIDE 4: KEY FEATURES
  // =========================================================================
  let slide4 = pres.addSlide({ masterName: "MASTER_CONTENT" });
  
  slide4.addText("Fitur Unggulan", {
    x: 0.5, y: 0.4, w: 6, h: 0.6, fontSize: 24, fontFace: "Arial", color: SECONDARY, bold: true
  });

  const features = [
    { title: "Executive Dashboard", desc: "Visualisasi KPI (Inbound, Outbound, Net Flow) & grafik tren.", y: 1.2 },
    { title: "Kalkulasi Cerdas MVT 311", desc: "Filter otomatis transfer internal vs eksternal antar 14 gudang berdasar SLOC.", y: 2.0 },
    { title: "Kategorisasi Fast & Slow", desc: "Deteksi otomatis umur Batch material (≤1th = Fast, >1th = Slow).", y: 2.8 },
    { title: "Capacity Analytics", desc: "Pantau utilisasi tonase real-time dengan indikator warning over-kapasitas.", y: 3.6 },
    { title: "Arsip & History Terpusat", desc: "Semua laporan harian tersimpan rapi dengan fitur pencarian & filter tanggal.", y: 4.4 }
  ];

  features.forEach(f => {
    slide4.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: f.y, w: 9, h: 0.7, fill: { color: WHITE }, shadow: getShadow() });
    slide4.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: f.y, w: 0.05, h: 0.7, fill: { color: PRIMARY } });
    slide4.addText(f.title, { x: 0.7, y: f.y + 0.1, w: 2.5, h: 0.5, fontSize: 14, bold: true, color: TEXT_DARK });
    slide4.addText(f.desc, { x: 3.2, y: f.y + 0.1, w: 6, h: 0.5, fontSize: 13, color: TEXT_MUTED });
  });


  // =========================================================================
  // SLIDE 5: BUSINESS IMPACT
  // =========================================================================
  let slide5 = pres.addSlide({ masterName: "MASTER_CONTENT" });
  
  slide5.addText("Dampak Bisnis", {
    x: 0.5, y: 0.4, w: 6, h: 0.6, fontSize: 24, fontFace: "Arial", color: SECONDARY, bold: true
  });

  // Create a 2x2 grid
  const impacts = [
    { title: "Efisiensi Waktu", desc: "Memangkas waktu pembuatan laporan dari jam-jaman menjadi hitungan detik. Tim fokus ke operasional.", x: 0.5, y: 1.2 },
    { title: "Akurasi 100%", desc: "Menghilangkan human error. Data dashboard mencerminkan angka asli SAP tanpa salah hitung manual.", x: 5.1, y: 1.2 },
    { title: "Data-Driven Decisions", desc: "Visibilitas 14 gudang bantu manajemen alokasi ruang penyimpanan & strategi barang Slow Moving.", x: 0.5, y: 3.2 },
    { title: "Infrastruktur Ringan", desc: "Arsitektur Data Aggregation hemat resource database server secara signifikan, cost-effective.", x: 5.1, y: 3.2 }
  ];

  impacts.forEach(imp => {
    slide5.addShape(pres.shapes.RECTANGLE, { x: imp.x, y: imp.y, w: 4.4, h: 1.8, fill: { color: WHITE }, shadow: getShadow() });
    slide5.addShape(pres.shapes.RECTANGLE, { x: imp.x, y: imp.y, w: 4.4, h: 0.4, fill: { color: PRIMARY } });
    slide5.addText(imp.title, { x: imp.x + 0.2, y: imp.y + 0.05, w: 4, h: 0.3, fontSize: 16, bold: true, color: WHITE });
    slide5.addText(imp.desc, { x: imp.x + 0.2, y: imp.y + 0.5, w: 4, h: 1.2, fontSize: 14, color: TEXT_DARK, valign: "top" });
  });


  // =========================================================================
  // SLIDE 6: TECH STACK
  // =========================================================================
  let slide6 = pres.addSlide({ masterName: "MASTER_CONTENT" });
  
  slide6.addText("Arsitektur & Teknologi Modern", {
    x: 0.5, y: 0.4, w: 8, h: 0.6, fontSize: 24, fontFace: "Arial", color: SECONDARY, bold: true
  });

  slide6.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.2, w: 9, h: 1.2, fill: { color: WHITE }, shadow: getShadow() });
  slide6.addText("Framework Modern", { x: 0.7, y: 1.3, w: 8.6, h: 0.4, fontSize: 16, bold: true, color: TEXT_DARK });
  slide6.addText("Dibangun dengan Next.js 16 (App Router) & React 19 untuk performa aplikasi single-page super cepat.", { x: 0.7, y: 1.7, w: 8.6, h: 0.6, fontSize: 14, color: TEXT_MUTED });

  slide6.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 2.6, w: 9, h: 1.2, fill: { color: WHITE }, shadow: getShadow() });
  slide6.addText("Database Optimization", { x: 0.7, y: 2.7, w: 8.6, h: 0.4, fontSize: 16, bold: true, color: TEXT_DARK });
  slide6.addText("Supabase PostgreSQL dengan arsitektur Aggregated Storage: merangkum ribuan baris data movement harian jadi 1 JSON summary (beban query turun 80%).", { x: 0.7, y: 3.1, w: 8.6, h: 0.6, fontSize: 14, color: TEXT_MUTED });

  slide6.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.0, w: 9, h: 1.2, fill: { color: WHITE }, shadow: getShadow() });
  slide6.addText("UI/UX Enterprise-Grade", { x: 0.7, y: 4.1, w: 8.6, h: 0.4, fontSize: 16, bold: true, color: TEXT_DARK });
  slide6.addText("Desain modern Tailwind CSS v4, pola Glassmorphism, & Recharts. Standar visual aplikasi Enterprise SaaS.", { x: 0.7, y: 4.5, w: 8.6, h: 0.6, fontSize: 14, color: TEXT_MUTED });


  // =========================================================================
  // SLIDE 7: ROADMAP
  // =========================================================================
  let slide7 = pres.addSlide({ masterName: "MASTER_CONTENT" });
  
  slide7.addText("Rencana Kedepan (Roadmap)", {
    x: 0.5, y: 0.4, w: 6, h: 0.6, fontSize: 24, fontFace: "Arial", color: SECONDARY, bold: true
  });

  slide7.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.2, w: 9, h: 3.8, fill: { color: WHITE }, shadow: getShadow() });

  slide7.addText([
    { text: "SAP Full Automation", options: { bold: true, fontSize: 16, color: PRIMARY, breakLine: true } },
    { text: "Menerapkan Scripting (Puppeteer/VBS) agar export file bisa berjalan sepenuhnya di background tanpa intervensi manual.", options: { fontSize: 14, color: TEXT_DARK, breakLine: true } },
    { text: " ", options: { fontSize: 10, breakLine: true } },

    { text: "Automated Export (PDF/Print)", options: { bold: true, fontSize: 16, color: PRIMARY, breakLine: true } },
    { text: "Fitur cetak 1-klik untuk diemail ke Board of Directors (engine jsPDF & html2canvas-pro sudah siap di sistem).", options: { fontSize: 14, color: TEXT_DARK, breakLine: true } },
    { text: " ", options: { fontSize: 10, breakLine: true } },

    { text: "Alerting System", options: { bold: true, fontSize: 16, color: PRIMARY, breakLine: true } },
    { text: "Notifikasi otomatis (email/dashboard) jika terdeteksi gudang mencapai utilisasi >90% atau ada anomali transfer.", options: { fontSize: 14, color: TEXT_DARK } }
  ], { x: 1, y: 1.5, w: 8, h: 3 });


  // =========================================================================
  // SAVE
  // =========================================================================
  pres.writeFile({ fileName: "Presentasi_SPINDO_Report.pptx" })
    .then(fileName => {
        console.log(`Created presentation: ${fileName}`);
    });
}

createPresentation();
