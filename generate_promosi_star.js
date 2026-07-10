const pptxgen = require("pptxgenjs");
const fs = require("fs");
const pptx = new pptxgen();

pptx.layout = "LAYOUT_16x9";
const RED = "BF0A30"; // Spindo Red
const DARK = "1C1C1C";
const GRAY = "F5F5F7";
const TEXT = "333333";

// ==========================================
// 1. COVER
// ==========================================
const slide1 = pptx.addSlide();
slide1.background = { color: DARK };
slide1.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: "35%", h: "100%", fill: { color: RED } });
slide1.addText("DIGITALISASI\nGUDANG 13", { x: 0.5, y: 1.8, w: 6, h: 1.5, fontSize: 44, bold: true, color: "FFFFFF" });
slide1.addText("Optimalisasi Kinerja & Efisiensi Budget\ndengan Pendekatan Sistem Terintegrasi", { x: 0.5, y: 3.5, w: 6, h: 1, fontSize: 16, color: "E0E0E0" });
slide1.addText("Disusun oleh:\nCalon Kepala Regu Gudang 13\nPT. Steel Pipe Industry of Indonesia, Tbk", { x: 5.5, y: 4.0, w: 4, h: 1, fontSize: 14, color: "AAAAAA", align: "right" });

// ==========================================
// 2. SITUATION (STAR)
// ==========================================
const slide2 = pptx.addSlide();
slide2.background = { color: GRAY };
slide2.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: "100%", h: 0.8, fill: { color: RED } });
slide2.addText("SITUATION: KONDISI GUDANG SAAT INI", { x: 0.5, y: 0.15, w: 8, h: 0.5, fontSize: 24, bold: true, color: "FFFFFF" });

slide2.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 1.2, w: 4.2, h: 3.5, fill: { color: "FFFFFF" } });
slide2.addText("1. Proses Manual & Kertas", { x: 0.8, y: 1.4, w: 3.6, h: 0.4, fontSize: 18, bold: true, color: RED });
slide2.addText("• Ketergantungan tinggi pada form cetak untuk rekap In-Out harian.\n• Risiko data terselip atau rusak sangat besar.\n• Membengkaknya budget pengadaan ATK & Kertas setiap bulan.", { x: 0.8, y: 1.9, w: 3.6, h: 2, fontSize: 14, color: TEXT });

slide2.addShape(pptx.shapes.RECTANGLE, { x: 5.3, y: 1.2, w: 4.2, h: 3.5, fill: { color: "FFFFFF" } });
slide2.addText("2. Bottleneck Alur Kerja", { x: 5.6, y: 1.4, w: 3.6, h: 0.4, fontSize: 18, bold: true, color: RED });
slide2.addText("• Ekstraksi data SAP (MB51) dan pencocokan fisik memakan waktu berjam-jam.\n• Sinkronisasi antar shift sering tidak mulus karena miskomunikasi data manual.\n• Waktu kerja produktif habis untuk kegiatan administratif dan overtime.", { x: 5.6, y: 1.9, w: 3.6, h: 2, fontSize: 14, color: TEXT });

// ==========================================
// 3. TASK (STAR)
// ==========================================
const slide3 = pptx.addSlide();
slide3.background = { color: DARK };
slide3.addText("TASK: TARGET & TANTANGAN", { x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 28, bold: true, color: RED });
slide3.addText("Sebagai eksekutor di lapangan, saya menetapkan 3 target utama:", { x: 0.5, y: 1.1, w: 9, h: 0.4, fontSize: 16, color: "CCCCCC" });

slide3.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 1.8, w: 2.8, h: 2.5, fill: { color: "2B2B2B" }, line: { color: RED, width: 1 } });
slide3.addText("EFISIENSI WAKTU", { x: 0.5, y: 2.1, w: 2.8, h: 0.5, fontSize: 18, bold: true, color: "FFFFFF", align: "center" });
slide3.addText("Memangkas waktu rekap SAP dari hitungan jam menjadi hitungan menit.", { x: 0.7, y: 2.6, w: 2.4, h: 1.2, fontSize: 14, color: "CCCCCC", align: "center" });

slide3.addShape(pptx.shapes.RECTANGLE, { x: 3.6, y: 1.8, w: 2.8, h: 2.5, fill: { color: "2B2B2B" }, line: { color: RED, width: 1 } });
slide3.addText("ZERO BUDGET", { x: 3.6, y: 2.1, w: 2.8, h: 0.5, fontSize: 18, bold: true, color: "FFFFFF", align: "center" });
slide3.addText("Menghilangkan biaya kertas & tinta cetak form laporan (Paperless 100%).", { x: 3.8, y: 2.6, w: 2.4, h: 1.2, fontSize: 14, color: "CCCCCC", align: "center" });

slide3.addShape(pptx.shapes.RECTANGLE, { x: 6.7, y: 1.8, w: 2.8, h: 2.5, fill: { color: "2B2B2B" }, line: { color: RED, width: 1 } });
slide3.addText("AKURASI DATA", { x: 6.7, y: 2.1, w: 2.8, h: 0.5, fontSize: 18, bold: true, color: "FFFFFF", align: "center" });
slide3.addText("Menekan angka selisih stok pipa dan human error pada input data hingga 0%.", { x: 6.9, y: 2.6, w: 2.4, h: 1.2, fontSize: 14, color: "CCCCCC", align: "center" });

// ==========================================
// 4. ACTION 1 (Arsitektur Solusi)
// ==========================================
const slide4 = pptx.addSlide();
slide4.background = { color: GRAY };
slide4.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: "100%", h: 0.8, fill: { color: RED } });
slide4.addText("ACTION: INOVASI SISTEM DAILY REPORT", { x: 0.5, y: 0.15, w: 8, h: 0.5, fontSize: 24, bold: true, color: "FFFFFF" });

slide4.addText("Membangun Sistem Aplikasi Web Mandiri untuk operasional Gudang 13:", { x: 0.5, y: 1.0, w: 9, h: 0.5, fontSize: 16, color: TEXT });

// Insert Actual Architecture Diagram from Project
if (fs.existsSync("diagram.jpg")) {
    slide4.addImage({ path: "diagram.jpg", x: 0.5, y: 1.6, w: 4.5, h: 3.2, sizing: { type: "contain" } });
} else {
    slide4.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 1.6, w: 4.5, h: 3.2, fill: { color: "DDDDDD" } });
    slide4.addText("[Arsitektur Sistem]", { x: 0.5, y: 1.6, w: 4.5, h: 3.2, align: "center", color: "888888" });
}

slide4.addShape(pptx.shapes.RECTANGLE, { x: 5.3, y: 1.6, w: 4.2, h: 3.2, fill: { color: "FFFFFF" }, line: { color: RED, width: 2 } });
slide4.addText("Nilai Jual Sistem (Live):", { x: 5.5, y: 1.8, w: 3.8, h: 0.4, fontSize: 18, bold: true, color: RED });
slide4.addText("1. Terintegrasi SAP MB51: Sinkronisasi data masuk dan keluar secara otomatis.\n\n2. Dashboard Tracking: Pemantauan real-time kondisi In-Out Gudang 13 dari PC/Mobile.\n\n3. Export Excel & PDF: Laporan jadi dalam 1 klik, hemat kertas.\n\n4. Role-Based Security: Akses bertingkat (Admin, Karu, Operator).", { x: 5.5, y: 2.3, w: 3.8, h: 2, fontSize: 13, color: TEXT });

// ==========================================
// 5. ACTION 2 (Premium UI Mockup Aplikasi)
// ==========================================
const slideUI = pptx.addSlide();
slideUI.background = { color: DARK };
slideUI.addText("ACTION: TAMPILAN DASHBOARD APLIKASI", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: RED });
slideUI.addText("Aplikasi didesain secara modern (SaaS Style) untuk mempermudah operasional pengguna di lapangan.", { x: 0.5, y: 0.8, w: 9, h: 0.3, fontSize: 13, color: "CCCCCC" });

// SaaS Dashboard Mockup using Shapes
// Base Frame
slideUI.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 1.2, w: 9, h: 4, fill: { color: "F8F9FA" }, rectRadius: 0.02 });
// Sidebar
slideUI.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 1.2, w: 2, h: 4, fill: { color: "1E293B" } });
slideUI.addText("SPINDO", { x: 0.5, y: 1.4, w: 2, h: 0.4, fontSize: 18, bold: true, color: "FFFFFF", align: "center" });
slideUI.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 2.0, w: 1.8, h: 0.4, fill: { color: RED }, rectRadius: 0.1 });
slideUI.addText("Dashboard", { x: 0.8, y: 2.0, w: 1.6, h: 0.4, fontSize: 12, bold: true, color: "FFFFFF" });
slideUI.addText("Data MB51", { x: 0.8, y: 2.5, w: 1.6, h: 0.4, fontSize: 12, color: "A0AEC0" });
slideUI.addText("Laporan Harian", { x: 0.8, y: 2.9, w: 1.6, h: 0.4, fontSize: 12, color: "A0AEC0" });

// Header
slideUI.addShape(pptx.shapes.RECTANGLE, { x: 2.5, y: 1.2, w: 7, h: 0.6, fill: { color: "FFFFFF" } });
slideUI.addText("Gudang 13 - Live Tracking System", { x: 2.7, y: 1.3, w: 4, h: 0.4, fontSize: 16, bold: true, color: "1E293B" });

// Stat Cards
slideUI.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 2.7, y: 2.0, w: 2.1, h: 0.8, fill: { color: "FFFFFF" }, rectRadius: 0.1 });
slideUI.addText("Total Inbound", { x: 2.8, y: 2.1, w: 1.9, h: 0.2, fontSize: 11, color: "64748B" });
slideUI.addText("1,245 Pipa", { x: 2.8, y: 2.4, w: 1.9, h: 0.3, fontSize: 18, bold: true, color: "10B981" });

slideUI.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 5.0, y: 2.0, w: 2.1, h: 0.8, fill: { color: "FFFFFF" }, rectRadius: 0.1 });
slideUI.addText("Total Outbound", { x: 5.1, y: 2.1, w: 1.9, h: 0.2, fontSize: 11, color: "64748B" });
slideUI.addText("890 Pipa", { x: 5.1, y: 2.4, w: 1.9, h: 0.3, fontSize: 18, bold: true, color: "EF4444" });

slideUI.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 7.3, y: 2.0, w: 2.0, h: 0.8, fill: { color: "FFFFFF" }, rectRadius: 0.1 });
slideUI.addText("Sync Status", { x: 7.4, y: 2.1, w: 1.8, h: 0.2, fontSize: 11, color: "64748B" });
slideUI.addText("UP TO DATE", { x: 7.4, y: 2.4, w: 1.8, h: 0.3, fontSize: 18, bold: true, color: "3B82F6" });

// Table Mockup
slideUI.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 2.7, y: 3.0, w: 6.6, h: 2.0, fill: { color: "FFFFFF" }, rectRadius: 0.05 });
slideUI.addShape(pptx.shapes.RECTANGLE, { x: 2.7, y: 3.0, w: 6.6, h: 0.4, fill: { color: "F1F5F9" } });
slideUI.addText("TCODE", { x: 2.8, y: 3.05, w: 1, h: 0.3, fontSize: 11, bold: true, color: "475569" });
slideUI.addText("MATERIAL", { x: 4.0, y: 3.05, w: 2.5, h: 0.3, fontSize: 11, bold: true, color: "475569" });
slideUI.addText("STATUS", { x: 7.0, y: 3.05, w: 1, h: 0.3, fontSize: 11, bold: true, color: "475569" });

slideUI.addText("101", { x: 2.8, y: 3.5, w: 1, h: 0.3, fontSize: 12, color: "1E293B" });
slideUI.addText("PIPA ERW 4 INCH SCH 40", { x: 4.0, y: 3.5, w: 2.5, h: 0.3, fontSize: 12, color: "1E293B" });
slideUI.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 7.0, y: 3.5, w: 1.0, h: 0.25, fill: { color: "DCFCE7" }, rectRadius: 0.5 });
slideUI.addText("Synced", { x: 7.0, y: 3.5, w: 1.0, h: 0.25, fontSize: 10, color: "166534", align: "center", bold: true });

slideUI.addText("261", { x: 2.8, y: 4.0, w: 1, h: 0.3, fontSize: 12, color: "1E293B" });
slideUI.addText("PIPA SPIRAL 12 INCH", { x: 4.0, y: 4.0, w: 2.5, h: 0.3, fontSize: 12, color: "1E293B" });
slideUI.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 7.0, y: 4.0, w: 1.0, h: 0.25, fill: { color: "FEF2F2" }, rectRadius: 0.5 });
slideUI.addText("Pending", { x: 7.0, y: 4.0, w: 1.0, h: 0.25, fontSize: 10, color: "991B1B", align: "center", bold: true });

// ==========================================
// 6. RESULT (Metrik Efisiensi dgn Charts)
// ==========================================
const slide6 = pptx.addSlide();
slide6.background = { color: GRAY };
slide6.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: "100%", h: 0.8, fill: { color: RED } });
slide6.addText("RESULT: DAMPAK NYATA UNTUK PERUSAHAAN (NILAI JUAL)", { x: 0.5, y: 0.15, w: 9, h: 0.5, fontSize: 24, bold: true, color: "FFFFFF" });

// Bar Chart: Waktu Operasional
let dataChart = [
    { name: "Proses Manual Lintas Shift", labels: ["Tarik SAP MB51", "Cek & Rekap Harian", "Proses Serah Terima"], values: [45, 90, 30] },
    { name: "Sistem Terintegrasi Gudang 13", labels: ["Tarik SAP MB51", "Cek & Rekap Harian", "Proses Serah Terima"], values: [2, 5, 5] }
];
slide6.addChart(pptx.charts.BAR, dataChart, {
    x: 0.5, y: 1.2, w: 4.2, h: 3.5,
    barGrouping: "clustered", barDir: "col",
    showLegend: true, legendPos: "b",
    showValue: true,
    chartColors: ["666666", RED],
    title: "Efisiensi Waktu Operasional (Dalam Menit)",
    showTitle: true, titleColor: TEXT, titleFontSize: 14,
    valGridLine: { style: "none" }
});

// Doughnut Chart: Akurasi & Pengurangan Error
let dataPie = [
    { name: "Sistem Akurasi", labels: ["Otomasi & Akurat", "Potensi Human Error"], values: [99.9, 0.1] }
];
slide6.addChart(pptx.charts.DOUGHNUT, dataPie, {
    x: 5.3, y: 1.2, w: 4.0, h: 2.8,
    showLegend: true, legendPos: "r",
    showValue: true, dataLabelFormatCode: "0%", dataLabelColor: "FFFFFF",
    chartColors: [RED, "DDDDDD"],
    title: "Tingkat Akurasi Data MB51",
    showTitle: true, titleColor: TEXT, titleFontSize: 14, holeSize: 60
});

// Kesimpulan Result Text
slide6.addShape(pptx.shapes.RECTANGLE, { x: 5.3, y: 4.1, w: 4.0, h: 0.6, fill: { color: "1C1C1C" } });
slide6.addText("100% PAPERLESS = RP 0 BIAYA KERTAS/BULAN", { x: 5.3, y: 4.15, w: 4.0, h: 0.5, fontSize: 13, bold: true, color: "FFFFFF", align: "center" });

// ==========================================
// 7. CLOSING / VISI KEPALA REGU
// ==========================================
const slide7 = pptx.addSlide();
slide7.background = { color: DARK };
slide7.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0.5, w: 0.3, h: 4.6, fill: { color: RED } });
slide7.addText("TARGET SAYA JIKA DIPERCAYA MENJADI KEPALA REGU", { x: 0.8, y: 0.8, w: 8, h: 0.6, fontSize: 24, bold: true, color: "FFFFFF" });

slide7.addText("1. Implementasi Penuh Smart Warehouse Gudang 13", { x: 0.8, y: 1.8, w: 8, h: 0.4, fontSize: 18, bold: true, color: RED });
slide7.addText("Seluruh alur pencatatan dari MB51 hingga laporan shift harian diproses 100% secara digital. Akurat dan hemat biaya.", { x: 0.8, y: 2.2, w: 8, h: 0.4, fontSize: 14, color: "CCCCCC" });

slide7.addText("2. Peningkatan Produktivitas Tim (Menekan Lembur/Overtime)", { x: 0.8, y: 2.8, w: 8, h: 0.4, fontSize: 18, bold: true, color: RED });
slide7.addText("Waktu yang biasanya terbuang untuk administrasi manual dialihkan ke pengecekan fisik material dan bongkar muat.", { x: 0.8, y: 3.2, w: 8, h: 0.4, fontSize: 14, color: "CCCCCC" });

slide7.addText("3. Roll-out Skala Besar (Sistem Terpusat PT SPINDO)", { x: 0.8, y: 3.8, w: 8, h: 0.4, fontSize: 18, bold: true, color: RED });
slide7.addText("Jika sistem ini sukses di Gudang 13, dapat dengan mudah diadaptasi ke seluruh gudang Plant Karawang sebagai standarisasi operasional.", { x: 0.8, y: 4.2, w: 8, h: 0.4, fontSize: 14, color: "CCCCCC" });

pptx.writeFile({ fileName: "Presentasi_STAR_Promosi_Leader.pptx" }).then(() => {
    console.log("PPTX with STAR Method and Charts created successfully!");
});