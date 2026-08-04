# Project Context: System Hub (Next.js Application)

## 1. Tech Stack & Environment
- **Framework:** Next.js v16.2.12 (menggunakan **App Router**)
- **Bahasa Pemrograman:** TypeScript
- **Styling:** Tailwind CSS v4 (melalui PostCSS)
- **State Management:** React Hooks bawaan (`useState`, `useEffect`, `useRef`) 
- **Database & Authentication:** Supabase (menggunakan `@supabase/ssr` dan `@supabase/supabase-js` untuk interaksi client/server). RLS and Storage Buckets actively used.
- **Library Tambahan:** 
  - `xlsx` untuk import/eksport data Excel
  - `html2pdf.js` untuk konversi/generate dokumen ke PDF

## 2. Project Structure
Struktur utama project sejauh ini berfokus di `app/` router dan file statis:
- `/app` - Direktori utama untuk routing aplikasi (App Router).
  - `/app/dashboard/` - Halaman khusus **Admin** yang terproteksi autentikasi. Berisi manajemen data utama masterlist K3.
  - `/app/dashboard/inspections/` - Halaman **Inspeksi**. Tempat mengeksekusi form checklist dan melihat log inspeksi. Diakses oleh Admin & Inspector.
  - `/app/dashboard/reports/` - Halaman **Reporting Dashboard**. Menyajikan analytics (Pass rate, kondisi aman/tidak aman).
  - `/app/dashboard/pics/` - Halaman **Manage PICs**. Tempat CRUD data personil/inspector, beserta unggah profil, foto kontak, dan tanda tangan digital.
  - `/app/guest/` - Halaman guest/tamu (view-only mode) untuk melihat daftar dan status equipment tanpa harus login.
  - `/app/components/` - Berisi komponen-komponen terpisah seperti `Sidebar`, `CameraCapture`, `InspectionForm`, dan modal-modal.
- `/public` - Menyimpan file aset statis (HTML templates checklist).

## 3. Coding Conventions
- **Server/Client Components:** Hampir seluruh antarmuka interaktif menggunakan `'use client'` karena pengelolaan state tabel, modals, dan pengunggahan file secara dinamis.
- **Data Fetching & Auth:** Interaksi dengan Supabase di sisi client dihandle melalui `createBrowserClient` dari `@supabase/ssr`.
- **Styling Pattern:** Penggunaan murni Tailwind CSS utility classes.
- **Component Splitting:** Mulai memisahkan logika ke dalam komponen yang reusable, seperti `InspectionForm` dan `CameraCapture` (meng-handle canvas, timestamping, resolusi kamera).

## 4. Current Status & Business Logic
Fitur yang saat ini berjalan:
- **Authentication & RBAC (Role-Based Access Control):** 
  - User login menggunakan email/password.
  - Terdapat tabel `profiles` yang mengatur `role` (`admin` atau `inspector`).
  - **Admin** bisa mengakses semua menu (Masterlist, Inspections, Reports, PICs).
  - **Inspector** hanya bisa mengakses fitur operasional di lapangan (Inspections & Reports). Upaya mengakses rute admin akan me-redirect mereka.
- **Admin Dashboard (Masterlist):** Berfungsi penuh mengelola data "Equipment" K3 (Kesehatan dan Keselamatan Kerja) dengan filter, search by ID/PIC, grid/list view, dan inline file uploads (dengan mekanisme otomatis menghapus file lama di bucket saat ter-replace).
- **Inspections Module:**
  - Inspector mengisi form berdasarkan tipe alat K3.
  - Wajib melampirkan **2 Foto** per inspeksi: Foto Unit Alat (live camera) dan Foto Lembar Checklist (live camera).
  - Foto dikompres otomatis (max 1280px, kualitas 0.8) dan dibubuhi *watermark timestamp* pada pojok gambar.
- **Manage PICs:** Mengelola data petugas/inspector, berikut tanda tangan digital mereka untuk lampiran pada report.
- **Reporting Dashboard:** Mengkalkulasi total safe/unsafe, *pass rate*, dan menyajikan tabel alat-alat yang butuh *immediate follow-up*.
- **Guest Mode:** Memfasilitasi user non-admin agar bisa melihat data secara read-only.

## 5. Next To-Do
Langkah dan fitur selanjutnya yang perlu dilanjutkan/dioptimalkan:
1. **Refactoring Lanjutan:** Terus memecah file monolithic (seperti masterlist `app/dashboard/page.tsx`) menjadi komponen-komponen kecil untuk maintainability jangka panjang.
2. **Implementasi PDF Generation (html2pdf):** Menyempurnakan alur pengambilan template HTML dari folder `/public/form_checklist/` untuk digenerate secara dinamis menjadi PDF dengan menyematkan data equipment, hasil form, foto live inspection, dan tanda tangan PIC digital sebelum didownload/dicetak.
3. **Penyempurnaan Import/Export Excel:** Melanjutkan fungsi integrasi library `xlsx` agar Admin dapat mem-bulk insert data K3 dalam bentuk spreadsheet tanpa kendala.
