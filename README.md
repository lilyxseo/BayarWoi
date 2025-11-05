# BayarWoi

Aplikasi pengelolaan keuangan pribadi menggunakan React + Vite dengan Supabase (Auth & Database).

## Prasyarat

- Node.js 20+
- Akun Supabase dengan project Postgres aktif

## Menjalankan Secara Lokal

1. Duplikasi file konfigurasi lingkungan:

   ```bash
   cp .env.example .env
   ```

2. Isi nilai berikut dari project Supabase Anda:

   ```env
   VITE_SUPABASE_URL=<https://YOUR-PROJECT.supabase.co>
   VITE_SUPABASE_ANON_KEY=<public-anon-key>
   ```

3. Instal dependensi dan jalankan Vite dev server:

   ```bash
   npm install
   npm run dev
   ```

4. Aplikasi tersedia di `http://localhost:5173`.

## Struktur Halaman

- `/login` – autentikasi email/password & Google OAuth.
- `/dashboard` – ringkasan saldo dan transaksi terbaru.
- `/accounts` – CRUD akun beserta arsip.
- `/transactions` – CRUD transaksi income & expense dengan filter.
- `/transfer` – fitur transfer saldo antar akun.

## Helper Supabase

Seluruh interaksi database berada pada `src/lib/db.ts` yang memanfaatkan Supabase JS v2 untuk operasi CRUD, RPC `apply_transfer`, serta helper `apply_account_balance_change`.

## Migrasi SQL Supabase

Gunakan skrip pada `supabase/migrations/0001_init.sql` untuk menyiapkan skema, indeks, RLS, dan fungsi RPC yang dibutuhkan. Jalankan lewat Supabase SQL editor atau CLI.