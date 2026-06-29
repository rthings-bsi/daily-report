// generate_presentation_v3.js
const pptxgen = require("pptxgenjs");
const fs = require('fs');
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { FaCheckCircle, FaExclamationTriangle, FaChartLine } = require("react-icons/fa");

async function generateGlow(colorCenter, colorEdge) {
  const svg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="grad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${colorCenter}" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="${colorEdge}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#grad)"/>
  </svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buffer.toString("base64");
}

function renderIconSvg(IconComponent, color = "#FFFFFF", size = 256) {
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
  pres.layout = 'LAYOUT_WIDE'; 

  // COLORS - Ultra Premium Minimalist (Apple Keynote Style)
  const BG = "050505"; // Very deep black/gray
  const TEXT_PRIMARY = "FFFFFF";
  const TEXT_SECONDARY = "888888"; // Subtle gray
  const LINE_COLOR = "222222"; 
  const ACCENT_GOLD = "D4AF37"; // Elegant Gold
  const ACCENT_BLUE = "0066FF"; 
  
  // Abstract glowing auras (Cinematic lighting)
  const glowBlue = await generateGlow("#0066FF", "#000000");
  const glowRed = await generateGlow("#FF0033", "#000000");
  const glowGold = await generateGlow("#D4AF37", "#000000");

  // Icons
  const iWarn = await iconToBase64Png(FaExclamationTriangle, "#FFFFFF");

  // --- SLIDE 1: CINEMATIC TITLE ---
  let s1 = pres.addSlide();
  s1.background = { color: BG };
  s1.addImage({ data: glowBlue, x: 2, y: -1, w: 9.3, h: 9.3 }); // Centered glow
  
  s1.addText("SPINDO", {
    x: 0, y: 2.5, w: 13.3, h: 1.5,
    fontSize: 80, fontFace: "Arial", color: TEXT_PRIMARY, bold: true, align: "center", charSpacing: 10
  });
  s1.addText("WAREHOUSE DAILY REPORT SYSTEM", {
    x: 0, y: 4.0, w: 13.3, h: 0.5,
    fontSize: 18, fontFace: "Segoe UI", color: ACCENT_GOLD, align: "center", charSpacing: 8
  });
  s1.addShape(pres.shapes.LINE, { x: 5.65, y: 4.6, w: 2, h: 0, line: { color: LINE_COLOR, width: 1 } });
  s1.addText("Digital Transformation Initiative", {
    x: 0, y: 4.8, w: 13.3, h: 0.5,
    fontSize: 12, fontFace: "Segoe UI Light", color: TEXT_SECONDARY, align: "center", charSpacing: 4
  });

  // --- SLIDE 2: THE PAIN (Asymmetrical, Editorial layout) ---
  let s2 = pres.addSlide();
  s2.background = { color: BG };
  s2.addImage({ data: glowRed, x: -3, y: 0, w: 8, h: 8 }); 
  
  // Left column indicator
  s2.addText("01", { x: 1, y: 1, w: 1, h: 0.5, fontSize: 14, color: ACCENT_GOLD, bold: true });
  s2.addShape(pres.shapes.LINE, { x: 1, y: 1.5, w: 0.5, h: 0, line: { color: ACCENT_GOLD, width: 2 } });
  s2.addText("THE OLD WAY", { x: 1, y: 1.7, w: 3, h: 0.5, fontSize: 12, color: TEXT_SECONDARY, charSpacing: 4 });
  
  s2.addText("Keterbatasan\nProses Manual.", {
    x: 1, y: 2.5, w: 5, h: 2, fontSize: 44, fontFace: "Arial", color: TEXT_PRIMARY, bold: true, breakLine: true
  });

  // Right column list
  s2.addShape(pres.shapes.LINE, { x: 6, y: 1, w: 0, h: 5.5, line: { color: LINE_COLOR, width: 1 } });

  const probs = [
    { t: "Rentan Human Error", d: "Perhitungan Movement Type dan sisa stok rentan keliru input di Excel." },
    { t: "Time-Consuming", d: "Tarikan data mentah SAP memakan waktu berjam-jam setiap harinya." },
    { t: "Visibilitas Buta", d: "Manajemen sulit melihat utilisasi tonase 14 gudang secara real-time." }
  ];
  probs.forEach((p, i) => {
    let y = 1.5 + (i * 1.8);
    s2.addImage({ data: iWarn, x: 6.5, y: y+0.1, w: 0.3, h: 0.3, transparency: 50 });
    s2.addText(p.t, { x: 7, y: y, w: 5, h: 0.4, fontSize: 20, color: TEXT_PRIMARY, fontFace: "Segoe UI" });
    s2.addText(p.d, { x: 7, y: y+0.4, w: 5, h: 0.8, fontSize: 14, color: TEXT_SECONDARY, fontFace: "Segoe UI Light" });
  });

  // --- SLIDE 3: THE SOLUTION ---
  let s3 = pres.addSlide();
  s3.background = { color: BG };
  s3.addImage({ data: glowBlue, x: 7, y: -2, w: 9, h: 9 });

  s3.addText("02", { x: 1, y: 1, w: 1, h: 0.5, fontSize: 14, color: ACCENT_BLUE, bold: true });
  s3.addShape(pres.shapes.LINE, { x: 1, y: 1.5, w: 0.5, h: 0, line: { color: ACCENT_BLUE, width: 2 } });
  s3.addText("THE NEW WAY", { x: 1, y: 1.7, w: 3, h: 0.5, fontSize: 12, color: TEXT_SECONDARY, charSpacing: 4 });

  s3.addText("Satu Platform.\nSemua Wawasan.", {
    x: 1, y: 2.5, w: 5, h: 2, fontSize: 44, fontFace: "Arial", color: TEXT_PRIMARY, bold: true, breakLine: true
  });
  s3.addText("Sistem otomatis memproses data mentah SAP menjadi wawasan strategis dalam hitungan detik. 1-Click Upload, Kalkulasi Instan.", {
    x: 1, y: 4.5, w: 4.5, h: 1.5, fontSize: 16, fontFace: "Segoe UI Light", color: TEXT_SECONDARY, breakLine: true
  });

  // Abstract minimalist representation of solution
  s3.addShape(pres.shapes.RECTANGLE, { x: 7, y: 2, w: 5, h: 3.5, fill: { color: "0A0A0A" }, line: { color: LINE_COLOR, width: 1 } });
  s3.addShape(pres.shapes.RECTANGLE, { x: 7, y: 2, w: 5, h: 0.3, fill: { color: "111111" } });
  s3.addShape(pres.shapes.OVAL, { x: 7.2, y: 2.1, w: 0.1, h: 0.1, fill: { color: "333333" } });
  s3.addShape(pres.shapes.OVAL, { x: 7.4, y: 2.1, w: 0.1, h: 0.1, fill: { color: "333333" } });
  s3.addShape(pres.shapes.OVAL, { x: 7.6, y: 2.1, w: 0.1, h: 0.1, fill: { color: "333333" } });
  
  // Simulated charts inside the window
  s3.addShape(pres.shapes.RECTANGLE, { x: 7.5, y: 3, w: 1, h: 2, fill: { color: "0066FF" } });
  s3.addShape(pres.shapes.RECTANGLE, { x: 9, y: 3.8, w: 1, h: 1.2, fill: { color: "222222" } });
  s3.addShape(pres.shapes.RECTANGLE, { x: 10.5, y: 2.5, w: 1, h: 2.5, fill: { color: "444444" } });


  // --- SLIDE 4: FEATURES GRID ---
  let s4 = pres.addSlide();
  s4.background = { color: BG };

  s4.addText("03", { x: 1, y: 1, w: 1, h: 0.5, fontSize: 14, color: TEXT_PRIMARY, bold: true });
  s4.addShape(pres.shapes.LINE, { x: 1, y: 1.5, w: 0.5, h: 0, line: { color: TEXT_PRIMARY, width: 2 } });
  s4.addText("CAPABILITIES", { x: 1, y: 1.7, w: 3, h: 0.5, fontSize: 12, color: TEXT_SECONDARY, charSpacing: 4 });

  const feats = [
    { t: "Executive Dashboard", d: "Visualisasi KPI & grafik tren." },
    { t: "Kalkulasi Cerdas MVT 311", d: "Filter otomatis transfer internal/eksternal antar 14 gudang." },
    { t: "Kategorisasi Fast & Slow", d: "Deteksi umur material otomatis dari SAP Batch." },
    { t: "Capacity Analytics", d: "Pantau utilisasi tonase real-time dengan warning over-capacity." }
  ];

  feats.forEach((f, i) => {
    let x = 1 + (i % 2) * 6;
    let y = 3 + Math.floor(i / 2) * 2;
    
    s4.addShape(pres.shapes.LINE, { x: x, y: y, w: 5, h: 0, line: { color: LINE_COLOR, width: 1 } });
    s4.addText(f.t, { x: x, y: y+0.2, w: 5, h: 0.5, fontSize: 24, fontFace: "Segoe UI", color: TEXT_PRIMARY });
    s4.addText(f.d, { x: x, y: y+0.7, w: 4.5, h: 0.8, fontSize: 14, fontFace: "Segoe UI Light", color: TEXT_SECONDARY });
  });


  // --- SLIDE 5: IMPACT (Apple style big numbers) ---
  let s5 = pres.addSlide();
  s5.background = { color: BG };
  s5.addImage({ data: glowGold, x: 2.5, y: -1, w: 8, h: 8 });

  s5.addText("04", { x: 1, y: 1, w: 1, h: 0.5, fontSize: 14, color: ACCENT_GOLD, bold: true });
  s5.addShape(pres.shapes.LINE, { x: 1, y: 1.5, w: 0.5, h: 0, line: { color: ACCENT_GOLD, width: 2 } });
  s5.addText("BUSINESS IMPACT", { x: 1, y: 1.7, w: 3, h: 0.5, fontSize: 12, color: TEXT_SECONDARY, charSpacing: 4 });

  s5.addText("99%", { x: 1, y: 3, w: 4, h: 1.5, fontSize: 96, fontFace: "Arial", color: TEXT_PRIMARY, align: "center", bold: true });
  s5.addText("Efisiensi Waktu", { x: 1, y: 4.5, w: 4, h: 0.5, fontSize: 18, fontFace: "Segoe UI", color: ACCENT_GOLD, align: "center", charSpacing: 2 });

  s5.addText("100%", { x: 4.6, y: 3, w: 4, h: 1.5, fontSize: 96, fontFace: "Arial", color: TEXT_PRIMARY, align: "center", bold: true });
  s5.addText("Akurasi Data (No Error)", { x: 4.6, y: 4.5, w: 4, h: 0.5, fontSize: 18, fontFace: "Segoe UI", color: ACCENT_GOLD, align: "center", charSpacing: 2 });

  s5.addText("14", { x: 8.3, y: 3, w: 4, h: 1.5, fontSize: 96, fontFace: "Arial", color: TEXT_PRIMARY, align: "center", bold: true });
  s5.addText("Gudang Termonitor", { x: 8.3, y: 4.5, w: 4, h: 0.5, fontSize: 18, fontFace: "Segoe UI", color: ACCENT_GOLD, align: "center", charSpacing: 2 });


  // --- SLIDE 6: ENGINEERING ---
  let s6 = pres.addSlide();
  s6.background = { color: BG };

  s6.addText("05", { x: 1, y: 1, w: 1, h: 0.5, fontSize: 14, color: TEXT_PRIMARY, bold: true });
  s6.addShape(pres.shapes.LINE, { x: 1, y: 1.5, w: 0.5, h: 0, line: { color: TEXT_PRIMARY, width: 2 } });
  s6.addText("ARCHITECTURE", { x: 1, y: 1.7, w: 3, h: 0.5, fontSize: 12, color: TEXT_SECONDARY, charSpacing: 4 });

  s6.addText("Aggregated Storage & Modern Stack.", {
    x: 1, y: 2.5, w: 7, h: 1.5, fontSize: 44, fontFace: "Arial", color: TEXT_PRIMARY, bold: true, breakLine: true
  });
  
  s6.addShape(pres.shapes.LINE, { x: 1, y: 4.2, w: 5, h: 0, line: { color: LINE_COLOR, width: 1 } });
  s6.addText("Dibangun dengan Next.js 16 (App Router) & Supabase. Beban query database turun hingga 80% berkat arsitektur agregasi JSON. Infrastruktur super ringan, menghemat cost server perusahaan secara signifikan.", {
    x: 1, y: 4.5, w: 7, h: 1.5, fontSize: 16, fontFace: "Segoe UI Light", color: TEXT_SECONDARY, breakLine: true
  });

  // Abstract Tech Graphic Right
  s6.addShape(pres.shapes.RECTANGLE, { x: 9, y: 2.5, w: 3, h: 0.8, fill: { color: "0A0A0A" }, line: { color: "333333", width: 1 } });
  s6.addText("Frontend: Next.js 16", { x: 9, y: 2.5, w: 3, h: 0.8, fontSize: 14, color: TEXT_PRIMARY, align: "center" });

  s6.addShape(pres.shapes.LINE, { x: 10.5, y: 3.3, w: 0, h: 0.4, line: { color: "333333", width: 1 } });

  s6.addShape(pres.shapes.RECTANGLE, { x: 9, y: 3.7, w: 3, h: 0.8, fill: { color: "0A0A0A" }, line: { color: "333333", width: 1 } });
  s6.addText("API Aggregation Layer", { x: 9, y: 3.7, w: 3, h: 0.8, fontSize: 14, color: TEXT_PRIMARY, align: "center" });

  s6.addShape(pres.shapes.LINE, { x: 10.5, y: 4.5, w: 0, h: 0.4, line: { color: "333333", width: 1 } });

  s6.addShape(pres.shapes.RECTANGLE, { x: 9, y: 4.9, w: 3, h: 0.8, fill: { color: "0A0A0A" }, line: { color: "333333", width: 1 } });
  s6.addText("DB: Supabase PostgreSQL", { x: 9, y: 4.9, w: 3, h: 0.8, fontSize: 14, color: ACCENT_BLUE, align: "center" });


  // --- SLIDE 7: ROADMAP ---
  let s7 = pres.addSlide();
  s7.background = { color: BG };
  s7.addImage({ data: glowBlue, x: -2, y: -2, w: 6, h: 6 });

  s7.addText("06", { x: 1, y: 1, w: 1, h: 0.5, fontSize: 14, color: TEXT_PRIMARY, bold: true });
  s7.addShape(pres.shapes.LINE, { x: 1, y: 1.5, w: 0.5, h: 0, line: { color: TEXT_PRIMARY, width: 2 } });
  s7.addText("ROADMAP", { x: 1, y: 1.7, w: 3, h: 0.5, fontSize: 12, color: TEXT_SECONDARY, charSpacing: 4 });

  s7.addText("Next Steps.", {
    x: 1, y: 2.5, w: 5, h: 1, fontSize: 44, fontFace: "Arial", color: TEXT_PRIMARY, bold: true
  });

  const roadmap = [
    { num: "01", t: "SAP Full Automation", d: "Integrasi RPA (Puppeteer/VBS) agar export file berjalan otomatis di background." },
    { num: "02", t: "Automated PDF Reporting", d: "Kirim email laporan harian berformat PDF otomatis ke Board of Directors." },
    { num: "03", t: "Smart Alerting System", d: "Notifikasi pintar jika gudang mencapai utilisasi >90%." }
  ];

  roadmap.forEach((r, i) => {
    let y = 4 + (i * 1.2);
    s7.addText(r.num, { x: 1, y: y, w: 0.5, h: 0.5, fontSize: 16, fontFace: "Segoe UI", color: TEXT_SECONDARY });
    s7.addText(r.t, { x: 1.8, y: y, w: 4, h: 0.3, fontSize: 18, fontFace: "Segoe UI", color: TEXT_PRIMARY });
    s7.addText(r.d, { x: 1.8, y: y+0.3, w: 9, h: 0.5, fontSize: 14, fontFace: "Segoe UI Light", color: TEXT_SECONDARY });
    s7.addShape(pres.shapes.LINE, { x: 1, y: y+0.9, w: 11.3, h: 0, line: { color: LINE_COLOR, width: 1 } });
  });

  pres.writeFile({ fileName: "Presentasi_SPINDO_Report_V3_AppleKeynote.pptx" })
    .then(fileName => {
        console.log(`Created ultra-premium presentation: ${fileName}`);
    });
}

createPresentation();
