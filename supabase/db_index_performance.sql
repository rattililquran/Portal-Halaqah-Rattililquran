-- ============================================================
--  Database Index untuk Performa Query Portal Halaqah
--  Rattililqur'an — Jalankan di: Supabase Dashboard → SQL Editor
--  Dibuat: 2026-06-05
-- ============================================================
--
--  Kenapa index ini penting?
--  Seiring data bertambah (ribuan baris kehadiran, SPP, notifikasi),
--  query tanpa index akan melakukan Sequential Scan yang lambat di PostgreSQL.
--  Index ini mempercepat query per-murid dari O(n) → O(log n).
-- ============================================================

-- Index untuk performa penarikan riwayat KBM per murid
CREATE INDEX IF NOT EXISTS idx_kehadiran_id_murid
  ON kehadiran(id_murid);

-- Index komposit: riwayat KBM berurutan (murid + tanggal terbaru)
CREATE INDEX IF NOT EXISTS idx_kehadiran_murid_tgl
  ON kehadiran(id_murid, created_at DESC);

-- Index untuk validasi SPP pending & riwayat pembayaran murid
CREATE INDEX IF NOT EXISTS idx_spp_konfirmasi_id_murid
  ON spp_konfirmasi(id_murid);

-- Index untuk inbox notifikasi PWA per user
CREATE INDEX IF NOT EXISTS idx_notif_inbox_id_user
  ON notif_inbox(id_user);

-- Index untuk notifikasi yang belum dibaca (query umum)
CREATE INDEX IF NOT EXISTS idx_notif_inbox_dibaca
  ON notif_inbox(id_user, dibaca)
  WHERE dibaca = false;

-- Index untuk pengerjaan PR / latihan mandiri per murid
CREATE INDEX IF NOT EXISTS idx_latihan_mandiri_id_murid
  ON latihan_mandiri(id_murid);

-- ============================================================
--  VERIFIKASI — Jalankan ini setelah index dibuat
--  untuk memastikan index aktif
-- ============================================================
-- SELECT indexname, tablename FROM pg_indexes
--   WHERE schemaname = 'public'
--   ORDER BY tablename, indexname;
