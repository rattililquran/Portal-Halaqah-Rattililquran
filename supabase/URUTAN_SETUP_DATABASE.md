# Urutan Setup Database — Rattililqur'an Portal

> Dibuat sebagai bagian dari Laporan Bug Hunt 7 Juni 2026 (lihat
> `Panduan dan Penjelasan/laporan_bug_juni2026.md`, temuan #5).
>
> **Masalah yang diatasi:** beberapa tabel (mis. `charging_notes`,
> `push_config`, `assessment_items`, `spp_metode_bayar`, dll) hanya
> dibuat lewat file `patch_*.sql` (lokal, gitignored), TIDAK ada di
> `migrations/001-010`. Jika database production pernah dibangun ulang
> hanya dari folder `migrations/`, tabel-tabel itu tidak akan ada —
> setiap insert/update/delete ke sana akan gagal dengan error
> "relation does not exist" atau "row violates row-level security policy".
>
> Dokumen ini adalah checklist urutan yang HARUS diikuti agar skema
> production & lokal selalu bisa dibangun ulang secara konsisten dari nol.

## Cara pakai

Jalankan file-file berikut **secara berurutan** di Supabase Dashboard →
SQL Editor → New Query (satu file = satu eksekusi, tunggu sampai sukses
sebelum lanjut ke file berikutnya).

### 1. Migrasi inti (folder `migrations/`)

```
001_schema.sql
002_rls.sql
003_functions.sql
005_setoran_hafalan.sql
006_konfigurasi_penilaian.sql
007_update_jenis_setoran.sql
008_tambah_kamera_hafalan.sql
009_update_penilaian_standar.sql
010_kbm_qiyam.sql
push_notifications.sql
```

(Catatan: tidak ada `004_*.sql` — penomoran memang melompat dari 003 ke 005.)

### 2. Patch tambahan (folder root `supabase/`, urut nomor)

```
patch_001_fix_rls_functions.sql
patch_002_notif_inbox.sql
patch_003_cleanup_notif_inbox.sql
patch_004_fix_notif_inbox_rls.sql
patch_005_bug_fixes.sql              ← membuat: assessment_items, assessment_murid,
                                         push_config, push_user_prefs, spp_metode_bayar,
                                         at_tibyan_materi, materi_level + RLS-nya
patch_006_fix_verify_password.sql
patch_007_spp_metode_bayar.sql        ← isi data awal metode bayar (lihat catatan di bawah)
patch_008_fix_riwayat_sessions.sql
patch_009_public_stats.sql
patch_010_followup_ketua.sql
patch_011_spp_reminder.sql
patch_012_dzikir_reminders.sql
patch_013_level_jumlah_pertemuan.sql
patch_014_observasi_kbm_kolom_baru.sql
patch_015_charging_notes.sql           ← membuat tabel charging_notes + RLS
patch_016_rekap_status_catatan_ustadz.sql ← tambah kolom catatan_ustadz ke rekap_status
```

## Catatan keamanan re-run

- Hampir semua patch memakai pola idempoten (`CREATE TABLE IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` sebelum `CREATE POLICY`)
  sehingga **aman dijalankan ulang** bila ragu apakah sudah pernah dieksekusi.
- **`patch_007_spp_metode_bayar.sql`** mengandung `INSERT` data contoh
  (rekening BCA & BSI) — file ini sudah diperbaiki agar memakai nama kolom
  yang benar (`no_rekening`, bukan `nomor`/`jenis` yang tidak ada di skema).
  Sesuaikan data rekening dengan data riil sebelum dijalankan di production,
  atau lewati file ini jika metode bayar sudah diisi manual lewat portal admin.
- Setiap kali menambah file `patch_XXX_*.sql` baru, **tambahkan namanya ke
  daftar di atas** (sesuai urutan nomor) supaya checklist ini tetap akurat.

## Mengapa tidak digabung jadi satu migrasi besar?

Patch-patch ini sengaja dipisah per fitur/bugfix dan bersifat lokal
(gitignored — lihat `.gitignore` baris 44 & 47) karena dijalankan manual
satu per satu di Supabase SQL Editor saat fitur terkait di-deploy. Menyatukan
semuanya ke satu file migrasi besar berisiko sulit di-maintain dan sulit
dilacak file mana yang berkorespondensi dengan fitur/bug mana. Checklist
urutan ini adalah cara teraman untuk memastikan rebuild dari nol tetap
konsisten tanpa mengubah cara kerja yang sudah berjalan.
