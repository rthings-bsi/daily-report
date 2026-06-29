// generate_presentation_v2.js
const pptxgen = require("pptxgenjs");
const fs = require('fs');
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { FaBoxOpen, FaChartLine, FaCogs, FaServer, FaRocket, FaCheckCircle, FaExclamationTriangle, FaClock, FaDatabase } = require("react-icons/fa");
const { MdDashboard, MdAutoGraph } = require("react-icons/md");

// --- ICON HELPER ---
function renderIconSvg(IconComponent, color = "#000000", size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}

async function iconToBase64Png(IconComponent, color, size = 512) {
  const svg = renderIconSvg(IconComponent, color, size);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + pngBuffer.toString("base64");
}

async function createPresentation() {
  let pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE'; // 16:9 13.3" x 7.5" - looks much more premium
  pres.author = 'Admin';
  pres.title = 'SPINDO Warehouse Daily Report System';

  // --- MODERN SaaS COLOR PALETTE (From SIARHA preferences + SPINDO Blue) ---
  const DARK_BG = "111827";     // Slate 900
  const CARD_BG = "1F2937";     // Slate 800
  const ACCENT_BLUE = "3B82F6"; // Blue 500
  const ACCENT_CYAN = "06B6D4"; // Cyan 500
  const TEXT_LIGHT = "F3F4F6";  // Gray 100
  const TEXT_MUTED = "9CA3AF";  // Gray 400
  const SUCCESS = "10B981";     // Emerald 500
  const WARNING = "F59E0B";     // Amber 500
  const DANGER = "EF4444";      // Red 500

  // Morph transition is not natively supported by PptxGenJS API directly via a simple flag for all slides, 
  // but we can set up slides to be highly visual. For morph, elements need same names across slides 
  // which is hard via API, so we focus on premium modern layout.

  // --- ICONS ---
  const iconBox = await iconToBase64Png(FaBoxOpen, "#3B82F6");
  const iconChart = await iconToBase64Png(FaChartLine, "#10B981");
  const iconGears = await iconToBase64Png(FaCogs, "#3B82F6");
  const iconServer = await iconToBase64Png(FaServer, "#06B6D4");
  const iconRocket = await iconToBase64Png(FaRocket, "#F59E0B");
  const iconCheck = await iconToBase64Png(FaCheckCircle, "#10B981");
  const iconWarn = await iconToBase64Png(FaExclamationTriangle, "#EF4444");
  const iconClock = await iconToBase64Png(FaClock, "#F59E0B");
  const iconDb = await iconToBase64Png(FaDatabase, "#06B6D4");
  const iconDash = await iconToBase64Png(MdDashboard, "#3B82F6");


  // --- MASTER SLIDES ---
  pres.defineSlideMaster({
    title: 'MODERN_DARK',
    background: { color: DARK_BG },
    objects: [
      // Decorative glowing orb effect (simulated via large soft shape)
      { rect: { x: -3, y: -3, w: 8, h: 8, fill: { color: "1E3A8A" }, options: { shadow: { type: "outer", blur: 100, offset: 0, color: "3B82F6", opacity: 0.2 } } } },
      { rect: { x: 8, y: 3, w: 10, h: 10, fill: { color: "064E3B" }, options: { shadow: { type: "outer", blur: 100, offset: 0, color: "10B981", opacity: 0.1 } } } },
    ]
  });

  // =========================================================================
  // SLIDE 1: TITLE (The Hook)
  // =========================================================================
  let slide1 = pres.addSlide({ masterName: "MODERN_DARK" });
  
  // Tagline
  slide1.addText("DIGITAL TRANSFORMATION", {
    x: 1.5, y: 2.2, w: 10.3, h: 0.5,
    fontSize: 14, fontFace: "Inter", color: ACCENT_CYAN, bold: true, charSpacing: 4
  });

  slide1.addText("SPINDO Warehouse\nDaily Report System", {
    x: 1.5, y: 2.7, w: 10.3, h: 2.0,
    fontSize: 54, fontFace: "Outfit", color: TEXT_LIGHT, bold: true, breakLine: true
  });

  slide1.addShape(pres.shapes.RECTANGLE, { x: 1.5, y: 4.8, w: 1.5, h: 0.05, fill: { color: ACCENT_BLUE } });

  slide1.addText("Dari Manual Excel Menuju Dashboard Analitik Real-time", {
    x: 1.5, y: 5.2, w: 10.3, h: 0.6,
    fontSize: 20, fontFace: "Inter", color: TEXT_MUTED
  });


  // =========================================================================
  // SLIDE 2: THE PROBLEM (Dark/Red theme)
  // =========================================================================
  let slide2 = pres.addSlide({ masterName: "MODERN_DARK" });
  
  slide2.addText("01. THE CHALLENGE", { x: 1, y: 0.8, w: 4, h: 0.3, fontSize: 12, color: DANGER, bold: true, charSpacing: 2 });
  slide2.addText("Proses Manual Menghambat Kecepatan", { x: 1, y: 1.2, w: 10, h: 0.8, fontSize: 36, fontFace: "Outfit", color: TEXT_LIGHT, bold: true });

  const problems = [
    { title: "Rentan Human Error", desc: "Perhitungan mutasi (Movement Type) dan sisa stok rawan kesalahan rumus Excel.", icon: iconWarn, color: DANGER },
    { title: "Sangat Lambat", desc: "Tarikan data mentah SAP harus dikalkulasi manual setiap hari. Menghabiskan waktu berjam-jam.", icon: iconClock, color: WARNING },
    { title: "Visibilitas Buta", desc: "Manajemen sulit melihat utilisasi tonase gudang & pergerakan barang (Fast/Slow) secara real-time.", icon: iconBox, color: TEXT_MUTED }
  ];

  problems.forEach((p, i) => {
    let xOffset = 1 + (i * 3.8);
    // Card
    slide2.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: xOffset, y: 2.8, w: 3.5, h: 3.5, fill: { color: CARD_BG }, rectRadius: 0.1 });
    // Icon
    slide2.addImage({ data: p.icon, x: xOffset + 0.4, y: 3.2, w: 0.6, h: 0.6 });
    // Text
    slide2.addText(p.title, { x: xOffset + 0.4, y: 4.2, w: 2.7, h: 0.4, fontSize: 18, color: TEXT_LIGHT, bold: true, fontFace: "Outfit" });
    slide2.addText(p.desc, { x: xOffset + 0.4, y: 4.6, w: 2.7, h: 1.2, fontSize: 14, color: TEXT_MUTED, valign: "top", breakLine: true });
  });


  // =========================================================================
  // SLIDE 3: THE SOLUTION (Blue/Green theme)
  // =========================================================================
  let slide3 = pres.addSlide({ masterName: "MODERN_DARK" });
  
  slide3.addText("02. THE SOLUTION", { x: 1, y: 0.8, w: 4, h: 0.3, fontSize: 12, color: ACCENT_BLUE, bold: true, charSpacing: 2 });
  slide3.addText("Dashboard Eksekutif Cerdas", { x: 1, y: 1.2, w: 10, h: 0.8, fontSize: 36, fontFace: "Outfit", color: TEXT_LIGHT, bold: true });

  // Big split layout
  // Left side: Text
  slide3.addText("Sistem terintegrasi yang otomatis memproses data mentah SAP menjadi wawasan strategis dalam hitungan detik.", {
    x: 1, y: 2.8, w: 5, h: 1.5, fontSize: 24, fontFace: "Inter", color: TEXT_LIGHT, breakLine: true
  });
  
  // Left features
  slide3.addImage({ data: iconCheck, x: 1, y: 4.8, w: 0.4, h: 0.4 });
  slide3.addText("1-Click Upload (Otomatis Parse Excel)", { x: 1.6, y: 4.75, w: 4.5, h: 0.5, fontSize: 16, color: TEXT_MUTED });
  
  slide3.addImage({ data: iconCheck, x: 1, y: 5.5, w: 0.4, h: 0.4 });
  slide3.addText("Kalkulasi KPI Mutasi & Tonase Instan", { x: 1.6, y: 5.45, w: 4.5, h: 0.5, fontSize: 16, color: TEXT_MUTED });

  // Right side: Visual representation
  slide3.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.8, y: 2.5, w: 5.5, h: 4, fill: { color: CARD_BG }, rectRadius: 0.05 });
  slide3.addImage({ data: iconDash, x: 9.1, y: 3.5, w: 1, h: 1 });
  slide3.addShape(pres.shapes.LINE, { x: 7.5, y: 4.8, w: 4.1, h: 0, line: { color: "374151", width: 2 } });
  slide3.addShape(pres.shapes.RECTANGLE, { x: 7.5, y: 5.2, w: 1.2, h: 0.8, fill: { color: "3B82F6", transparency: 20 } });
  slide3.addShape(pres.shapes.RECTANGLE, { x: 8.9, y: 5.2, w: 1.2, h: 0.8, fill: { color: "10B981", transparency: 20 } });
  slide3.addShape(pres.shapes.RECTANGLE, { x: 10.3, y: 5.2, w: 1.2, h: 0.8, fill: { color: "F59E0B", transparency: 20 } });


  // =========================================================================
  // SLIDE 4: KEY CAPABILITIES
  // =========================================================================
  let slide4 = pres.addSlide({ masterName: "MODERN_DARK" });
  
  slide4.addText("03. CAPABILITIES", { x: 1, y: 0.8, w: 4, h: 0.3, fontSize: 12, color: ACCENT_CYAN, bold: true, charSpacing: 2 });
  slide4.addText("Fitur Analitik Lanjutan", { x: 1, y: 1.2, w: 10, h: 0.8, fontSize: 36, fontFace: "Outfit", color: TEXT_LIGHT, bold: true });

  const featuresList = [
    { title: "Kalkulasi Cerdas MVT 311", desc: "Filter otomatis transfer internal vs eksternal antar gudang berdasarkan SLOC." },
    { title: "Kategorisasi Fast/Slow Moving", desc: "Deteksi umur material otomatis dari SAP Batch (≤1th = Fast, >1th = Slow)." },
    { title: "Real-time Capacity Analytics", desc: "Pantau utilisasi tonase 14 gudang sekaligus dengan indikator Over-capacity." },
    { title: "Drag-and-Drop Report Builder", desc: "Customisasi layout laporan secara interaktif untuk mode presentasi harian." }
  ];

  featuresList.forEach((f, i) => {
    let y = 2.8 + (i * 1.1);
    slide4.addShape(pres.shapes.RECTANGLE, { x: 1, y: y, w: 0.05, h: 0.8, fill: { color: ACCENT_CYAN } });
    slide4.addText(f.title, { x: 1.2, y: y, w: 5, h: 0.4, fontSize: 20, fontFace: "Outfit", color: TEXT_LIGHT, bold: true });
    slide4.addText(f.desc, { x: 1.2, y: y+0.4, w: 10, h: 0.4, fontSize: 16, color: TEXT_MUTED });
  });

  // Right side graphic
  slide4.addImage({ data: iconChart, x: 9.5, y: 3.5, w: 2.5, h: 2.5, transparency: 80 });


  // =========================================================================
  // SLIDE 5: TECH INNOVATION (Showing off your engineering skills)
  // =========================================================================
  let slide5 = pres.addSlide({ masterName: "MODERN_DARK" });
  
  slide5.addText("04. ENGINEERING", { x: 1, y: 0.8, w: 4, h: 0.3, fontSize: 12, color: SUCCESS, bold: true, charSpacing: 2 });
  slide5.addText("Inovasi Arsitektur Database", { x: 1, y: 1.2, w: 10, h: 0.8, fontSize: 36, fontFace: "Outfit", color: TEXT_LIGHT, bold: true });

  slide5.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 1, y: 2.5, w: 5.2, h: 4, fill: { color: CARD_BG }, rectRadius: 0.05 });
  slide5.addImage({ data: iconDb, x: 1.5, y: 3, w: 0.6, h: 0.6 });
  slide5.addText("Aggregated Storage", { x: 1.5, y: 4, w: 4, h: 0.5, fontSize: 22, fontFace: "Outfit", color: TEXT_LIGHT, bold: true });
  slide5.addText("Sistem tidak menyimpan ribuan baris data mentah per hari. Menggunakan algoritma agregasi untuk merangkum data menjadi JSON summary.", { x: 1.5, y: 4.6, w: 4.2, h: 1.5, fontSize: 15, color: TEXT_MUTED, breakLine: true });

  slide5.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.8, y: 2.5, w: 5.2, h: 4, fill: { color: CARD_BG }, rectRadius: 0.05 });
  slide5.addImage({ data: iconServer, x: 7.3, y: 3, w: 0.6, h: 0.6 });
  slide5.addText("Cost-Effective Scale", { x: 7.3, y: 4, w: 4, h: 0.5, fontSize: 22, fontFace: "Outfit", color: TEXT_LIGHT, bold: true });
  slide5.addText("Beban query database (Supabase PostgreSQL) turun hingga 80%. Infrastruktur super ringan, menghemat cost server perusahaan secara signifikan.", { x: 7.3, y: 4.6, w: 4.2, h: 1.5, fontSize: 15, color: TEXT_MUTED, breakLine: true });


  // =========================================================================
  // SLIDE 6: BUSINESS IMPACT 
  // =========================================================================
  let slide6 = pres.addSlide({ masterName: "MODERN_DARK" });
  
  slide6.addText("05. THE IMPACT", { x: 1, y: 0.8, w: 4, h: 0.3, fontSize: 12, color: WARNING, bold: true, charSpacing: 2 });
  slide6.addText("Hasil & Dampak Bisnis", { x: 1, y: 1.2, w: 10, h: 0.8, fontSize: 36, fontFace: "Outfit", color: TEXT_LIGHT, bold: true });

  slide6.addShape(pres.shapes.RECTANGLE, { x: 1, y: 2.8, w: 11.3, h: 1.8, fill: { color: CARD_BG } });
  
  // Stat 1
  slide6.addText("99%", { x: 1.5, y: 3.1, w: 3, h: 0.8, fontSize: 64, fontFace: "Outfit", color: ACCENT_BLUE, bold: true });
  slide6.addText("Efisiensi Waktu", { x: 1.5, y: 4.0, w: 3, h: 0.3, fontSize: 14, color: TEXT_LIGHT, bold: true });

  // Stat 2
  slide6.addText("100%", { x: 5.5, y: 3.1, w: 3, h: 0.8, fontSize: 64, fontFace: "Outfit", color: SUCCESS, bold: true });
  slide6.addText("Akurasi Data (No Human Error)", { x: 5.5, y: 4.0, w: 3, h: 0.3, fontSize: 14, color: TEXT_LIGHT, bold: true });

  // Stat 3
  slide6.addText("14", { x: 9.5, y: 3.1, w: 3, h: 0.8, fontSize: 64, fontFace: "Outfit", color: WARNING, bold: true });
  slide6.addText("Gudang Ter-monitor Real-time", { x: 9.5, y: 4.0, w: 3, h: 0.3, fontSize: 14, color: TEXT_LIGHT, bold: true });


  // =========================================================================
  // SLIDE 7: ROADMAP
  // =========================================================================
  let slide7 = pres.addSlide({ masterName: "MODERN_DARK" });
  
  slide7.addText("06. FUTURE", { x: 1, y: 0.8, w: 4, h: 0.3, fontSize: 12, color: ACCENT_BLUE, bold: true, charSpacing: 2 });
  slide7.addText("Roadmap Pengembangan", { x: 1, y: 1.2, w: 10, h: 0.8, fontSize: 36, fontFace: "Outfit", color: TEXT_LIGHT, bold: true });

  slide7.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 1, y: 3, w: 11.3, h: 3, fill: { color: CARD_BG }, rectRadius: 0.05 });
  slide7.addImage({ data: iconRocket, x: 1.5, y: 4, w: 1, h: 1 });

  slide7.addText("1. SAP Full Automation", { x: 3, y: 3.5, w: 8, h: 0.4, fontSize: 20, color: TEXT_LIGHT, bold: true, fontFace: "Outfit" });
  slide7.addText("Integrasi RPA (Puppeteer/VBS) agar export file dari SAP berjalan otomatis di background.", { x: 3, y: 3.9, w: 8, h: 0.4, fontSize: 15, color: TEXT_MUTED });

  slide7.addText("2. Automated PDF Reporting", { x: 3, y: 4.7, w: 8, h: 0.4, fontSize: 20, color: TEXT_LIGHT, bold: true, fontFace: "Outfit" });
  slide7.addText("Sistem otomatis mengirim email laporan harian berformat PDF ke Board of Directors.", { x: 3, y: 5.1, w: 8, h: 0.4, fontSize: 15, color: TEXT_MUTED });


  // =========================================================================
  // SAVE
  // =========================================================================
  pres.writeFile({ fileName: "Presentasi_SPINDO_Report_V2_Premium.pptx" })
    .then(fileName => {
        console.log(`Created premium presentation: ${fileName}`);
    });
}

createPresentation();
