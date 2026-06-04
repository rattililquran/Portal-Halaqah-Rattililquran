---
name: project-status
description: Status terkini fitur Tahfidz Qiyam dan integrasi KBM — Juni 2026
metadata:
  type: project
---

Status per 4 Juni 2026. Semua migration SQL sudah dijalankan di Supabase.

**Why:** Fitur Tahfidz dibangun dari nol dan diintegrasikan ke portal yang sudah ada.
**How to apply:** Gunakan sebagai referensi saat melanjutkan sesi berikutnya.

## Fitur Tahfidz yang sudah live

### Halaman Standalone (sidebar guru)
- **Input Hafalan** — input retroaktif, semua murid Level Qiyam
- **Raport Tahfidz** — per periode, per murid atau semua: grafik poin bulanan, peta juz 1-30, tabel surat, cetak PDF

### Integrasi KBM 4-Step
- **Step 1**: opsi "KBM Qiyam" muncul hanya jika halaqah = Level Qiyam
- **Step 2**: presensi (tidak berubah)
- **Step 3 KBM Qiyam**: input hafalan per murid yang hadir (H/T)
  - Jenis: Ziyadah / Murajaah / Tahsin
  - Surat autocomplete 114 surat + validasi max ayat
  - Penilaian: Kelancaran + Makhraj & Tajwid + Kamera (hard-code)
  - Catatan + Target hafalan berikutnya
- **Step 4**: jurnal (tidak berubah)

### Nilai Standar (sudah diupdate di DB)
- Kelancaran: Lancar +10, Cukup +5, Perlu Perbaikan 0 (+ keterangan)
- Nilai Makhraj: Mumtaz 90, Baik 70, Cukup 50
- Kamera (hard-code): 📷 terbuka | 🟡 sering buka tutup | ❌ tertutup

### Kelola Penilaian
- Modal overlay (tombol di header halaman Input Hafalan)
- Kelancaran dan Nilai Makhraj: konfigurabel, disimpan ke Supabase
- Kamera: hard-code (tidak konfigurabel)

### Halaman Murid (Level Qiyam only)
- Sidebar: "Setoran Hafalan" — riwayat + tab Raport Tahfidz
- Level 1-4: tampil terkunci dengan pesan motivasi
- Dashboard: target hafalan dari guru muncul di kartu biru

## Database Tables (Supabase)
- `setoran_hafalan` — data setoran per murid per sesi
  - Kolom: id_kbm (link ke sesi KBM), kamera, nilai (Mumtaz/Baik/Cukup)
  - Tidak ada check constraint pada nilai dan kamera (konfigurabel)
- `konfigurasi_penilaian_hafalan` — config kelancaran, nilai, kamera per halaqah global

## Migrations yang sudah dijalankan
- 005: tabel setoran_hafalan + RLS
- 006: konfigurasi_penilaian_hafalan
- 007: update constraint jenis (Tasmi'/Sabqi → Tahsin)
- 008: kolom kamera
- 009: standarisasi nilai (A/B/C → Mumtaz/Baik/Cukup)
- 010: KBM Qiyam enum + id_kbm column

## Yang belum diimplementasi
- Integrasi raport KBM + raport Tahfidz jadi satu dokumen
- Notifikasi push untuk target hafalan
- Leaderboard/poin antar siswa Level Qiyam
