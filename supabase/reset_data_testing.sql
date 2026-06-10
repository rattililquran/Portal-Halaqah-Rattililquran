-- ============================================================================
--  RESET DATA TESTING — Persiapan input data asli (300 murid, ~27 halaqah)
--  Dibuat: Juni 2026
-- ============================================================================
--
--  CARA PAKAI (WAJIB DIIKUTI URUTANNYA):
--
--  1) BACKUP DULU — JANGAN SKIP!
--     Supabase Dashboard → Project Settings → Database → "Backups"
--     atau jalankan dari terminal (butuh connection string dari dashboard):
--       pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
--         --schema=public -F c -f backup_sebelum_reset.dump
--
--  2) Jalankan seluruh isi file ini di Supabase SQL Editor.
--     Semua DELETE dibungkus BEGIN...COMMIT — kalau ada error di tengah,
--     transaksi otomatis batal (tidak ada perubahan setengah-setengah).
--
--  3) Setelah SQL ini sukses, hapus akun Auth murid & guru secara TERPISAH
--     (lihat bagian "CLEANUP SUPABASE AUTH" di paling bawah file ini) —
--     menghapus baris di public.users TIDAK menghapus akun di auth.users.
--
--  APA YANG DIHAPUS:
--    - Semua murid & guru (akun + seluruh data transaksi terkait)
--    - Semua halaqah (kelas) dummy
--    - Pengumuman & periode testing
--    - Push subscription (device), riwayat push_log, & catatan Charging milik murid/guru
--
--  APA YANG DIPERTAHANKAN (tidak disentuh):
--    - Akun ADMIN-001 dan SUPERADMIN-001 (supaya Anda tidak terkunci dari sistem)
--    - Tabel master/konfigurasi: level, materi_level, template_koreksi,
--      konfigurasi_*, assessment_items, push_config, spp_metode_bayar,
--      at_tibyan_materi
--
-- ============================================================================

begin;

-- --- 1. Data transaksional yang merujuk ke murid/guru/halaqah (anak dulu) ---
delete from public.notif_inbox;
delete from public.push_log;
delete from public.push_user_prefs
  where id_user not in ('ADMIN-001', 'SUPERADMIN-001');
delete from public.push_subscriptions
  where id_user not in ('ADMIN-001', 'SUPERADMIN-001');
delete from public.charging_notes;
delete from public.assessment_murid;

delete from public.spp_pembayaran;
delete from public.audit_log;
delete from public.rekap_status;
delete from public.observasi_kbm;

delete from public.at_tibyan_log;
delete from public.at_tibyan_sesi;

delete from public.raport;
delete from public.nilai_manual;
delete from public.catatan_raport;
delete from public.komponen_raport;

delete from public.nilai_kbm;
delete from public.kbm_log;

delete from public.setoran_hafalan;

delete from public.anggota;

-- --- 2. Halaqah (kelas) — dummy, akan diganti ~27 halaqah asli ---
delete from public.halaqah;

-- --- 3. Pengumuman & periode testing ---
delete from public.pengumuman;
delete from public.periode;

-- --- 4. Akun murid & guru (admin/superadmin DIPERTAHANKAN) ---
delete from public.users
  where role in ('murid', 'guru');

commit;

-- ============================================================================
--  VERIFIKASI SETELAH RESET — jalankan terpisah untuk mengecek hasil
-- ============================================================================
-- select role, count(*) from public.users group by role;
--   -> harus hanya tersisa: admin (1), superadmin (1)
-- select count(*) from public.halaqah;   -> harus 0
-- select count(*) from public.anggota;   -> harus 0
-- select count(*) from public.pengumuman; -> harus 0
-- select count(*) from public.periode;    -> harus 0


-- ============================================================================
--  CLEANUP SUPABASE AUTH (WAJIB — dilakukan TERPISAH dari SQL di atas)
-- ============================================================================
--
--  Menghapus baris di public.users TIDAK menghapus akun login di auth.users.
--  Kalau dibiarkan, ID lama (mis. RTL24180250, NISA, dll) tidak bisa
--  dipakai ulang untuk akun baru karena email/identitas masih terdaftar
--  di Supabase Auth.
--
--  CARA TERMUDAH — via Supabase Dashboard:
--    Authentication → Users → cari & hapus satu per satu akun murid+guru
--    (akun admin/superadmin JANGAN dihapus).
--
--  CARA CEPAT — via SQL, hapus auth.users yang TIDAK terhubung lagi ke
--  public.users (karena baris murid/guru sudah dihapus di langkah atas,
--  auth_id mereka otomatis jadi orphan):
--
--    select au.id, au.email
--    from auth.users au
--    left join public.users pu on pu.auth_id = au.id
--    where pu.id_user is null;          -- <- cek dulu daftarnya, pastikan
--                                            tidak ada admin/superadmin di sini
--
--    -- Setelah yakin daftarnya benar (hanya murid+guru lama), baru jalankan:
--    delete from auth.users au
--    where au.id in (
--      select au2.id
--      from auth.users au2
--      left join public.users pu on pu.auth_id = au2.id
--      where pu.id_user is null
--    );
--
--  CATATAN: perintah delete pada auth.users butuh privilege khusus.
--  Jika gagal lewat SQL Editor biasa, gunakan Supabase Admin API
--  (service_role key) atau hapus manual lewat Dashboard seperti di atas.
-- ============================================================================
