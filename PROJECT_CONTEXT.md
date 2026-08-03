# Project Context: System Hub (Next.js Application)

## 1. Tech Stack & Environment
- **Framework:** Next.js v16.2.12 (menggunakan **App Router**)
- **Bahasa Pemrograman:** TypeScript
- **Styling:** Tailwind CSS v4 (melalui PostCSS)
- **State Management:** React Hooks bawaan (`useState`, `useEffect`, `useRef`) 
- **Database & Authentication:** Supabase (menggunakan `@supabase/ssr` dan `@supabase/supabase-js` untuk interaksi client/server)
- **Library Tambahan:** 
  - `xlsx` untuk import/eksport data Excel
  - `html2pdf.js` untuk konversi/generate dokumen ke PDF

## 2. Project Structure
Struktur utama project sejauh ini berfokus di `app/` router dan file statis:
- `/app` - Direktori utama untuk routing aplikasi (App Router).
  - `/app/dashboard/` - Halaman khusus Admin yang terproteksi autentikasi. Berisi manajemen data utama (CRUD), filter, grid/list view, fitur import/eksport, serta bulk actions untuk alat-alat K3.
  - `/app/guest/` - Halaman guest/tamu (view-only mode) untuk melihat daftar dan status equipment tanpa harus login sebagai admin.
- `/public` - Menyimpan file aset statis.
  - `/public/form_checklist/` - Folder penting berisi berbagai *HTML template* form checklist bawaan (contoh: Fire Alarm, Fire Hydrant, Fire Extinguisher, Emergency Lamp) yang nanti digunakan sebagai template untuk mencetak form.
- **Root Configuration:** Konfigurasi standard seperti `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, dan file `.env` (menyimpan Supabase keys).

## 3. Coding Conventions
- **Server/Client Components:** Halaman yang membutuhkan interaktivitas tinggi seperti dashboard dan guest view menggunakan direktif `'use client'` di baris paling atas karena banyak melibatkan state React dan browser events.
- **Data Fetching & Auth:** Interaksi dengan Supabase di sisi client dihandle melalui `createBrowserClient` dari `@supabase/ssr`. 
- **Styling Pattern:** Penggunaan murni Tailwind CSS utility classes di dalam atribut `className`. Terdapat helper/fungsi seperti `getTypeBadgeColor` untuk mengembalikan string utility class sesuai dengan kondisi status (misal: bg-red-900 untuk alarm).
- **Structure Pattern:** Saat ini, logika bisnis, states, filter, dan UI JSX sebagian besar masih dikumpulkan dalam satu file monolithic (misal di `app/dashboard/page.tsx`).

## 4. Current Status & Business Logic
Fitur yang saat ini berjalan:
- **Authentication Flow:** User yang mengakses halaman `/dashboard` akan di-cek sesinya dengan `supabase.auth.getSession()`. Jika tidak ada sesi aktif, akan otomatis di-redirect ke halaman awal `/` (Landing Page/Login).
- **Admin Dashboard:** Berfungsi penuh mengelola data "Equipment" K3 (Kesehatan dan Keselamatan Kerja).
  - Data ditampilkan dengan paginasi (10 item per halaman).
  - Bisa melakukan filtering berdasarkan Entity, Facility, Type, dan Area.
  - Mendukung pergantian tampilan `Grid` dan `List`.
  - Form Add/Edit menggunakan pola Side/Bottom Sheet.
  - Mendukung unggah foto (Pic 1 dan Pic 2) untuk dokumentasi per peralatan.
  - Tersedia fitur Bulk Selection.
- **Guest Mode:** Memfasilitasi user non-admin (di rute `/guest/`) agar bisa memantau atau melihat form checklist hasil laporan terkini secara read-only.
- **Template Logic:** Terdapat fungsi `getFormTemplate` dan `getEquipmentIdLabel` yang membedakan URL template `.html` serta penamaan ID berdasarkan tipe alat (APAR, Hydrant, Alarm, dll).

## 5. Next To-Do
Langkah dan fitur selanjutnya yang perlu dilanjutkan/dioptimalkan:
1. **Refactoring & Component Splitting:** Memecah file monolithic `app/dashboard/page.tsx` menjadi komponen-komponen kecil (seperti `TableComponent`, `FilterBar`, `EquipmentCard`, `EditSheet`) untuk mempermudah maintainability.
2. **Implementasi PDF Generation (html2pdf):** Menyempurnakan alur pengambilan template HTML dari folder `/public/form_checklist/` untuk digenerate secara dinamis menjadi PDF dengan data equipment terkait lalu mendownload/mencetaknya.
3. **Penyempurnaan Guest View:** Memastikan UI dan interaksi pada `/app/guest/page.tsx` sudah rapi, intuitif, dan responsif untuk pengguna mobile/tablet yang sedang bertugas di lapangan.
4. **Penyempurnaan Import/Export Excel:** Melanjutkan/mengetes fungsi integrasi library `xlsx` agar Admin dapat menarik report atau mem-bulk insert data dalam bentuk spreadsheet tanpa kendala.
