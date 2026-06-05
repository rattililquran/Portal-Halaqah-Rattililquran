-- ============================================================
--  Database Index untuk Performa Query Portal Halaqah
--  Rattililqur'an — Jalankan di: Supabase Dashboard → SQL Editor
--  Diverifikasi: 2026-06-05 — cocok dengan kode aktual 3 portal
--  (index.html, guru/index.html, murid/index.html, admin/index.html,
--   supabase/supabase-client.js)
-- ============================================================
--
--  Cara kerja: index mempercepat query filter dari O(n) → O(log n)
--  Semua nama tabel telah diverifikasi dari kode sumber aktual.
--  Jalankan SELURUH script ini sekaligus di SQL Editor Supabase.
-- ============================================================

-- ── 1. nilai_kbm ────────────────────────────────────────────
-- Dipakai: murid (getRiwayat, getDashboard), guru (absensi KBM),
--          admin (getRekapAbsensi, dashboard)
-- Filter: id_murid, id_kbm, id_halaqah, status_hadir, jenis_sesi
CREATE INDEX IF NOT EXISTS idx_nilai_kbm_id_murid
  ON nilai_kbm(id_murid);

CREATE INDEX IF NOT EXISTS idx_nilai_kbm_id_kbm
  ON nilai_kbm(id_kbm);

CREATE INDEX IF NOT EXISTS idx_nilai_kbm_id_halaqah
  ON nilai_kbm(id_halaqah);

-- Komposit: rekap per murid di satu halaqah
CREATE INDEX IF NOT EXISTS idx_nilai_kbm_murid_halaqah
  ON nilai_kbm(id_murid, id_halaqah);

-- Komposit: hitung alpa per murid
CREATE INDEX IF NOT EXISTS idx_nilai_kbm_murid_status
  ON nilai_kbm(id_murid, status_hadir);

-- ── 2. kbm_log ──────────────────────────────────────────────
-- Dipakai: guru (getDraftKBM, getRiwayatKBM), admin (dashboard)
-- Filter: id_guru, id_halaqah, status, tanggal_pertemuan
CREATE INDEX IF NOT EXISTS idx_kbm_log_id_guru
  ON kbm_log(id_guru);

CREATE INDEX IF NOT EXISTS idx_kbm_log_id_halaqah
  ON kbm_log(id_halaqah);

-- Komposit: status sesi per halaqah
CREATE INDEX IF NOT EXISTS idx_kbm_log_halaqah_status
  ON kbm_log(id_halaqah, status);

-- ── 3. anggota ──────────────────────────────────────────────
-- Dipakai: semua portal — query per halaqah dan per murid
-- Filter: id_halaqah, id_murid, status
CREATE INDEX IF NOT EXISTS idx_anggota_id_halaqah
  ON anggota(id_halaqah);

CREATE INDEX IF NOT EXISTS idx_anggota_id_murid
  ON anggota(id_murid);

-- Komposit: daftar anggota aktif per halaqah (paling sering)
CREATE INDEX IF NOT EXISTS idx_anggota_halaqah_status
  ON anggota(id_halaqah, status);

-- ── 4. setoran_hafalan ──────────────────────────────────────
-- Dipakai: murid (getSetoranHafalan, getTargetHafalan),
--          guru (KBM Qiyam), admin (raport tahfidz)
-- Filter: id_murid, id_kbm
CREATE INDEX IF NOT EXISTS idx_setoran_hafalan_id_murid
  ON setoran_hafalan(id_murid);

CREATE INDEX IF NOT EXISTS idx_setoran_hafalan_id_kbm
  ON setoran_hafalan(id_kbm);

-- ── 5. spp_pembayaran ───────────────────────────────────────
-- Dipakai: murid (getSPPStatus), admin (getSPPPending, getSPPRekap)
-- Filter: id_murid, status, tahun, id_halaqah
CREATE INDEX IF NOT EXISTS idx_spp_pembayaran_id_murid
  ON spp_pembayaran(id_murid);

-- Komposit: status SPP per murid
CREATE INDEX IF NOT EXISTS idx_spp_pembayaran_murid_status
  ON spp_pembayaran(id_murid, status);

-- Admin: query pending (semua role)
CREATE INDEX IF NOT EXISTS idx_spp_pembayaran_status
  ON spp_pembayaran(status);

-- ── 6. notif_inbox ──────────────────────────────────────────
-- Dipakai: murid (getNotifInbox, markNotifRead)
-- Filter: id_user, read_at IS NULL (belum dibaca)
CREATE INDEX IF NOT EXISTS idx_notif_inbox_id_user
  ON notif_inbox(id_user);

-- Partial index: notifikasi belum dibaca (query paling sering)
-- .eq('id_user', ...).is('read_at', null)
CREATE INDEX IF NOT EXISTS idx_notif_inbox_belum_dibaca
  ON notif_inbox(id_user)
  WHERE read_at IS NULL;

-- ── 7. at_tibyan_log ────────────────────────────────────────
-- Dipakai: murid (getAtTibyanMurid), guru (At-Tibyan sesi)
-- Filter: id_murid, id_sesi, id_halaqah, status_hadir
CREATE INDEX IF NOT EXISTS idx_at_tibyan_log_id_murid
  ON at_tibyan_log(id_murid);

CREATE INDEX IF NOT EXISTS idx_at_tibyan_log_id_sesi
  ON at_tibyan_log(id_sesi);

-- ── 8. at_tibyan_sesi ───────────────────────────────────────
-- Dipakai: guru (manajemen sesi At-Tibyan)
-- Filter: id_guru, id_sesi, status
CREATE INDEX IF NOT EXISTS idx_at_tibyan_sesi_id_guru
  ON at_tibyan_sesi(id_guru);

-- ── 9. halaqah ──────────────────────────────────────────────
-- Dipakai: semua portal — filter by id_guru, status
CREATE INDEX IF NOT EXISTS idx_halaqah_id_guru
  ON halaqah(id_guru);

-- Partial: hanya halaqah aktif (query paling sering)
CREATE INDEX IF NOT EXISTS idx_halaqah_aktif
  ON halaqah(id_guru)
  WHERE status = 'aktif';

-- ── 10. raport ──────────────────────────────────────────────
-- Dipakai: murid (getRaport), guru (generateRaport), admin (getRaportList)
-- Filter: id_murid, id_periode, id_halaqah, status
CREATE INDEX IF NOT EXISTS idx_raport_id_murid
  ON raport(id_murid);

CREATE INDEX IF NOT EXISTS idx_raport_id_periode
  ON raport(id_periode);

-- Komposit: raport published per murid
CREATE INDEX IF NOT EXISTS idx_raport_murid_status
  ON raport(id_murid, status);

-- ── 11. push_subscriptions ──────────────────────────────────
-- Dipakai: push notification system
-- Filter: role, endpoint
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_role
  ON push_subscriptions(role);

-- ── 12. pengumuman ──────────────────────────────────────────
-- Dipakai: murid & guru (getPengumuman)
-- Filter: status = 'aktif', id_halaqah, target
CREATE INDEX IF NOT EXISTS idx_pengumuman_status
  ON pengumuman(status);

-- ── 13. users ───────────────────────────────────────────────
-- Dipakai: semua portal
-- Filter: role, status, id_user (PK — sudah ada index otomatis)
-- Tambah index komposit role+status untuk query murid/guru aktif
CREATE INDEX IF NOT EXISTS idx_users_role_status
  ON users(role, status);

-- ── 14. nilai_manual ────────────────────────────────────────
-- Dipakai: guru & admin (nilai komponen raport)
-- Filter: id_periode, id_halaqah
CREATE INDEX IF NOT EXISTS idx_nilai_manual_id_periode
  ON nilai_manual(id_periode);

-- ============================================================
--  VERIFIKASI — Jalankan setelah semua index dibuat
-- ============================================================
-- SELECT indexname, tablename
--   FROM pg_indexes
--   WHERE schemaname = 'public'
--     AND indexname LIKE 'idx_%'
--   ORDER BY tablename, indexname;
