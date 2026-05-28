# PRD — Sistem Daily Report Warehouse SPINDO

**Versi:** 1.0  
**Status:** Draft  
**Teknologi:** Next.js 16, Prisma (SQLite), Next-Auth v5, Tailwind CSS 4, Recharts, Lucide React

---

## 1. Ringkasan

Sistem untuk memvisualisasikan dan menganalisis laporan pergerakan material (movement) dan stok (stock) dari SAP secara harian. Aplikasi ini menggantikan proses manual berbasis Excel dengan dashboard interaktif yang menyajikan KPI, grafik, dan tabel detail.

---

## 2. Pengguna & Peran

| Peran  | Hak Akses                        |
|--------|----------------------------------|
| Admin  | Login, upload data, lihat semua laporan, hapus session |
| User   | Login, lihat dashboard & analitik (read-only ke data yang sudah di-upload) |

> **Catatan:** Saat ini hanya ada peran `admin` yang dibuat via seed/API setup. Peran `user` belum diimplementasikan penuh di middleware/UI.

---

## 3. Fitur (Fungsional)

### F-01: Autentikasi
- Login dengan username & password
- Session via JWT (Next-Auth v5 Credentials Provider)
- Proteksi route: semua halaman kecuali `/login` dan `/api/setup`
- Logout

### F-02: Upload Laporan SAP
- Upload file Excel (.xlsx / .xls) atau CSV hasil export SAP
- Parsing client-side dengan library `xlsx`
- Ekstraksi data **Movement**: posting date, tipe movement, deskripsi, work center, batch, quantity (tonase), unit quantity
- Ekstraksi data **Stock**: material, deskripsi, batch, SLoc, kategori, unit qty, weight
- Mapping kode SAP (101, 102, 261, 262, 311, 601) ke grup: **Masuk**, **Keluar**, **Transfer**
- Simpan sebagai ReportSession baru ke database

### F-03: Dashboard Utama (`/`)
- **KPI Cards:** Total Masuk, Total Keluar, Net Flow, Total Movement (tonase), Total Unit
- **Movement Chart:** Bar chart pergerakan harian + volume per tipe movement
- **Work Center Breakdown:** Donut chart + ranking work center berdasarkan tonase
- **Movement Table:** Tabel agregasi per tipe movement (searchable)
- **Stock Report:** Distribusi inventory per status dengan progress bar
- **Detailed Table:** Tabel detail semua transaksi (searchable, pagination)
- **Compact Report Mode:** Tampilan ringkas untuk print
- **History Drawer:** Daftar session laporan sebelumnya untuk navigasi cepat

### F-04: Upload Page (`/upload`)
- Drag-and-drop zone untuk upload file Excel
- Preview data sebelum simpan
- Simpan sebagai session baru
- Redirect ke dashboard dengan session terpilih

### F-05: Analytics (`/analytics`)
- Analisis kapasitas gudang berdasarkan data stok
- Stock distribution chart (bar chart per kategori)
- Movement overview chart
- Rekomendasi berbasis data (kapasitas hampir penuh, stok berlebih, dll.)

### F-06: Settings (`/settings`)
- Konfigurasi kapasitas gudang (nama + kapasitas ton)
- Disimpan di localStorage

### F-07: API
| Endpoint              | Method | Deskripsi                          |
|------------------------|--------|------------------------------------|
| `/api/auth/[...nextauth]` | GET, POST | Handler Next-Auth v5            |
| `/api/reports`         | GET    | List semua ReportSession            |
| `/api/reports`         | POST   | Buat session baru + simpan movements & stocks |
| `/api/reports/:id`     | GET    | Detail session (movements + stocks) |
| `/api/reports/:id`     | DELETE | Hapus session                      |
| `/api/reports/trend`   | GET    | Data trend 5 hari terakhir          |
| `/api/setup`           | GET    | One-time create admin user          |

---

## 4. Non-Fungsional

### NF-01: Performa
- Parsing Excel dilakukan client-side agar tidak membebani server
- Database SQLite lokal — cukup untuk penggunaan departemen/per-gudang
- Pagination di DetailedTable untuk menangani >1000 record

### NF-02: Keamanan
- Password di-hash dengan bcryptjs
- Session via JWT (Next-Auth v5)
- Proteksi route via middleware (kecuali `/login` dan `/api/setup`)

### NF-03: Tampilan
- Dark mode sebagai default
- Glassmorphism pada card dan sidebar
- Animasi dengan Framer Motion
- Responsive (sidebar collapsible)
- Print-friendly (compact report mode)

### NF-04: Data
- Data persisten di SQLite via Prisma
- Upload bersifat append — tidak ada overwrite, setiap upload = session baru
- Cascade delete session → semua movements & stocks ikut terhapus

---

## 5. Struktur Data

### ReportSession
| Field    | Tipe    | Keterangan                         |
|----------|---------|------------------------------------|
| id       | String  | CUID (primary key)                 |
| label    | String  | Label human-readable               |
| dateStr  | String  | YYYY-MM-DD                         |
| fileName | String? | Nama file asli yang di-upload      |
| createdAt| DateTime| Timestamp                          |

### Movement
| Field       | Tipe    | Keterangan                      |
|-------------|---------|----------------------------------|
| id          | String  | CUID                             |
| sessionId   | String  | FK ke ReportSession              |
| postingDate | DateTime| Tanggal posting SAP              |
| dateStr     | String  | YYYY-MM-DD                       |
| moveType    | String  | Kode movement SAP (101, 261, dll)|
| description | String  | Deskripsi movement               |
| workCenter  | String? | Work center asal/tujuan          |
| batch       | String? | Nomor batch                      |
| quantity    | Float   | Tonase (positif = masuk, negatif = keluar) |
| unitQuantity| Float   | Jumlah unit/pieces               |
| group       | String  | Masuk / Keluar / Transfer        |
| color       | String  | Hex color untuk UI               |

### Stock
| Field       | Tipe    | Keterangan                      |
|-------------|---------|----------------------------------|
| id          | String  | CUID                             |
| sessionId   | String  | FK ke ReportSession              |
| material    | String  | Nama material/status             |
| description | String  | Deskripsi                        |
| batch       | String? | Nomor batch                      |
| sloc        | String? | Storage location code            |
| category    | String? | Kategori                         |
| unitQty     | Float   | Quantity dalam pieces            |
| weight      | Float   | Berat (KG)                       |

---

## 6. Alur Pengguna (User Flow)

1. **User membuka aplikasi** → redirect ke `/login`
2. **Login** dengan username & password → redirect ke `/`
3. **Upload file SAP** via menu Upload → pilih file Excel → preview → simpan
4. **Lihat dashboard** → KPI, grafik, tabel, stock report
5. **Navigasi history** → pilih session sebelumnya dari drawer
6. **Analytics** → lihat kapasitas gudang, distribusi stok, rekomendasi
7. **Settings** → atur kapasitas gudang sesuai actual

---

## 7. Batasan & Catatan

- **Database:** SQLite — tidak cocok untuk konkurensi tinggi atau multi-user berat
- **Supabase:** Ada integrasi Supabase (client/server/middleware) tetapi belum digunakan secara aktif — auth masih pakai Next-Auth dengan Prisma
- **Peran User:** Role-based access control belum diimplementasikan penuh di middleware/UI
- **Multi-user:** Belum ada mekanisme konkurensi — setiap upload membuat session baru
- **Backup:** Tidak ada mekanisme backup/restore database bawaan

---

## 8. Rencana Pengembangan (Roadmap)

| Fase | Item                                        |
|------|---------------------------------------------|
| 1.0  | Dashboard, upload, login, CRUD session      |
| 1.1  | Analytics page, capacity settings           |
| 1.2  | Compact report mode, print styling          |
| 2.0  | Multi-user dengan role-based access (RBAC)  |
| 2.1  | Export PDF / Excel dari dashboard           |
| 2.2  | Migrasi ke PostgreSQL (Supabase)            |
| 2.3  | Notifikasi & alert (kapasitas hampir penuh) |
