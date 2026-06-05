-- ============================================================
--  Database Index untuk Performa Query Portal Halaqah
--  Rattililqur'an — Jalankan di: Supabase Dashboard → SQL Editor
--  Dibuat: 2026-06-05 | Update: nama tabel disesuaikan kode aktual
-- ============================================================
--
--  Kenapa index ini penting?
--  Seiring data bertambah (ribuan baris KBM, SPP, notifikasi),
--  query tanpa index melakukan Sequential Scan yang lambat.
--  Index mempercepat query per-murid dari O(n) → O(log n).
-- ============================================================

-- ── nilai_kbm (absen + nilai per sesi KBM) ─────────────────
-- Sering difilter: .eq('id_murid', ...) dan .eq('id_kbm', ...)
CREATE INDEX IF NOT EXISTS idx_nilai_kbm_id_murid
  ON nilai_kbm(id_murid);

CREATE INDEX IF NOT EXISTS idx_nilai_kbm_id_kbm
  ON nilai_kbm(id_kbm);

-- Komposit: query absensi per murid per halaqah
CREATE INDEX IF NOT EXISTS idx_nilai_kbm_murid_halaqah
  ON nilai_kbm(id_murid, id_halaqah);

-- Filter status_hadir (H/A/I/S) — sering dipakai untuk rekap
CREATE INDEX IF NOT EXISTS idx_nilai_kbm_status_hadir
  ON nilai_kbm(id_murid, status_hadir);

-- ── kbm_log (log sesi KBM per guru) ────────────────────────
-- Sering difilter: .eq('id_guru', ...) dan .eq('id_halaqah', ...)
CREATE INDEX IF NOT EXISTS idx_kbm_log_id_guru
  ON kbm_log(id_guru);

CREATE INDEX IF NOT EXISTS idx_kbm_log_id_halaqah
  ON kbm_log(id_halaqah);

-- ── anggota (keanggotaan murid di halaqah) ──────────────────
CREATE INDEX IF NOT EXISTS idx_anggota_id_halaqah
  ON anggota(id_halaqah);

CREATE INDEX IF NOT EXISTS idx_anggota_id_murid
  ON anggota(id_murid);

-- ── setoran_hafalan (PR / setoran hafalan murid) ────────────
CREATE INDEX IF NOT EXISTS idx_setoran_hafalan_id_murid
  ON setoran_hafalan(id_murid);

CREATE INDEX IF NOT EXISTS idx_setoran_hafalan_id_kbm
  ON setoran_hafalan(id_kbm);

-- ── spp_pembayaran (riwayat & status SPP) ──────────────────
-- Sering difilter: .eq('id_murid', ...) dan .eq('status', ...)
CREATE INDEX IF NOT EXISTS idx_spp_pembayaran_id_murid
  ON spp_pembayaran(id_murid);

CREATE INDEX IF NOT EXISTS idx_spp_pembayaran_status
  ON spp_pembayaran(id_murid, status);

-- ── notif_inbox (push notification inbox) ──────────────────
-- Kolom: id_user, read_at (NULL = belum dibaca)
CREATE INDEX IF NOT EXISTS idx_notif_inbox_id_user
  ON notif_inbox(id_user);

-- Index partial: notifikasi belum dibaca (read_at IS NULL)
-- Ini adalah query paling sering: .eq('id_user',...).is('read_at', null)
CREATE INDEX IF NOT EXISTS idx_notif_inbox_belum_dibaca
  ON notif_inbox(id_user)
  WHERE read_at IS NULL;

-- ── at_tibyan_log (absen sesi At-Tibyan) ───────────────────
CREATE INDEX IF NOT EXISTS idx_at_tibyan_log_id_murid
  ON at_tibyan_log(id_murid);

-- ============================================================
--  VERIFIKASI — Jalankan ini setelah index dibuat
-- ============================================================
-- SELECT indexname, tablename
--   FROM pg_indexes
--   WHERE schemaname = 'public'
--     AND indexname LIKE 'idx_%'
--   ORDER BY tablename, indexname;
