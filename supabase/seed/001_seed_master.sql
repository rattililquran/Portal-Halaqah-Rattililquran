-- ============================================================
--  001_seed_master.sql
--  Data dummy untuk testing Portal Halaqah Rattililqur'an
--
--  Jalankan di Supabase SQL Editor setelah:
--  - 001_schema.sql ✅
--  - 002_rls.sql ✅
--
--  Password semua akun: 654321 (guru) | 123456 (murid) | admin123 (admin)
--  Hash menggunakan pgcrypto crypt() yang kompatibel dengan bcrypt
-- ============================================================

-- ─────────────────────────────────────────────
--  BERSIHKAN DATA LAMA (jika ada)
-- ─────────────────────────────────────────────
truncate public.spp_pembayaran    cascade;
truncate public.audit_log         cascade;
truncate public.rekap_status      cascade;
truncate public.observasi_kbm     cascade;
truncate public.at_tibyan_log     cascade;
truncate public.at_tibyan_sesi    cascade;
truncate public.raport            cascade;
truncate public.nilai_manual      cascade;
truncate public.catatan_raport    cascade;
truncate public.komponen_raport   cascade;
truncate public.nilai_kbm         cascade;
truncate public.kbm_log           cascade;
truncate public.anggota           cascade;
truncate public.halaqah           cascade;
truncate public.periode           cascade;
truncate public.users             cascade;

-- ─────────────────────────────────────────────
--  PERIODE
-- ─────────────────────────────────────────────
insert into public.periode (id_periode, nama_periode, tanggal_mulai, tanggal_selesai, deskripsi, status) values
  ('P2026-1', 'Semester 1 2026', '2026-01-01', '2026-06-30', 'Periode testing utama', 'aktif');

-- ─────────────────────────────────────────────
--  USERS — Admin
--  Password: admin123
-- ─────────────────────────────────────────────
insert into public.users (id_user, nama_lengkap, role, no_hp, email, status, password_hash, catatan) values
  ('ADMIN-001', 'Administrator', 'admin',
   '081111111111', 'admin@rattililquran.id', 'aktif',
   crypt('admin123', gen_salt('bf')),
   'Akun admin utama');

-- ─────────────────────────────────────────────
--  USERS — Guru
--  Password semua: 654321
-- ─────────────────────────────────────────────
insert into public.users (id_user, nama_lengkap, role, no_hp, status, password_hash) values
  ('UMAR',    'Al-Ustadz Umar Abdul Aziz',           'guru', '082316993233', 'aktif', crypt('654321', gen_salt('bf'))),
  ('NISA',    'Al-Ustadzah Annisa Rizkya Rahmawati', 'guru', '08123456789',  'aktif', crypt('654321', gen_salt('bf'))),
  ('ISMI',    'Al-Ustadzah Ismi Fitrianingsih',      'guru', '08234567890',  'aktif', crypt('654321', gen_salt('bf'))),
  ('ULUM',    'Al-Ustadzah Nurul Hidayatul Ulum',    'guru', '08345678901',  'aktif', crypt('654321', gen_salt('bf'))),
  ('ADISSA',  'Al-Ustadzah Adissa Fitria Alkautsar', 'guru', '08456789012',  'aktif', crypt('654321', gen_salt('bf'))),
  ('RAHMIZA', 'Al-Ustadzah Aulia Rahmiza',           'guru', '08567890123',  'aktif', crypt('654321', gen_salt('bf')));

-- ─────────────────────────────────────────────
--  HALAQAH
-- ─────────────────────────────────────────────
insert into public.halaqah (id_halaqah, nama_halaqah, id_guru, nama_guru, id_periode, level, jadwal_hari, jam_mulai, jam_selesai, lokasi, status) values
  ('HQ-MARYAM',   'Maryam',   'NISA',   'Al-Ustadzah Annisa Rizkya Rahmawati', 'P2026-1', 'Level 1', 'Rabu Jumat',   '15:00', '16:30', 'Online (Zoom)', 'aktif'),
  ('HQ-ASMA',     'Asma',     'ISMI',   'Al-Ustadzah Ismi Fitrianingsih',      'P2026-1', 'Level 1', 'Rabu Jumat',   '18:30', '20:00', 'Online (Zoom)', 'aktif'),
  ('HQ-RUMAYSHO', 'Rumaysho', 'ADISSA', 'Al-Ustadzah Adissa Fitria Alkautsar', 'P2026-1', 'Level 1', 'Rabu Jumat',   '19:30', '21:00', 'Online (Zoom)', 'aktif'),
  ('HQ-SAHLAH',   'Sahlah',   'ADISSA', 'Al-Ustadzah Adissa Fitria Alkautsar', 'P2026-1', 'Level 1', 'Selasa Kamis', '08:00', '09:30', 'Online (Zoom)', 'aktif'),
  ('HQ-FATIMAH',  'Fatimah',  'ADISSA', 'Al-Ustadzah Adissa Fitria Alkautsar', 'P2026-1', 'Level 1', 'Senin Rabu',   '09:00', '10:30', 'Online (Zoom)', 'aktif'),
  ('HQ-KHADIJAH', 'Khadijah', 'ULUM',   'Al-Ustadzah Nurul Hidayatul Ulum',    'P2026-1', 'Level 1', 'Senin Kamis',  '15:30', '17:00', 'Online (Zoom)', 'aktif');

-- ─────────────────────────────────────────────
--  USERS — Murid (password semua: 123456)
-- ─────────────────────────────────────────────
insert into public.users (id_user, nama_lengkap, role, no_hp, status, password_hash, nama_guru, nama_halaqah) values
  -- Halaqah Maryam (NISA)
  ('RTL24180250', 'Nur Lindatul Hidayah',    'murid', '085184624062', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Annisa Rizkya Rahmawati', 'Maryam'),
  ('RTL24180251', 'Mitha Afril Yani',         'murid', '081549171617', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Annisa Rizkya Rahmawati', 'Maryam'),
  ('RTL24180252', 'Himaya',                   'murid', '08170441080',  'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Annisa Rizkya Rahmawati', 'Maryam'),
  ('RTL24180253', 'Vidyah Nawang Sari',       'murid', '085787614715', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Annisa Rizkya Rahmawati', 'Maryam'),
  ('RTL24180254', 'Camelia Santika',          'murid', '082149624840', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Annisa Rizkya Rahmawati', 'Maryam'),
  ('RTL24180255', 'Afifah',                   'murid', '085640354396', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Annisa Rizkya Rahmawati', 'Maryam'),
  ('RTL24180257', 'Irma Istarizkizra',        'murid', '081387470744', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Annisa Rizkya Rahmawati', 'Maryam'),
  ('RTL24180258', 'Shinta Mandasari',         'murid', '081232598036', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Annisa Rizkya Rahmawati', 'Maryam'),
  ('RTL24180260', 'Uray Aurel Maylaf Islam',  'murid', '089517356889', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Annisa Rizkya Rahmawati', 'Maryam'),
  ('RTL24180261', 'Sri Ayuni',                'murid', '083827589918', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Annisa Rizkya Rahmawati', 'Maryam'),
  ('RTL24180106', 'Shinta Mandasari 2',       'murid', '081232598037', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Annisa Rizkya Rahmawati', 'Maryam'),
  -- Halaqah Asma (ISMI)
  ('RTL24180262', 'Tyas Cindi Aulia',         'murid', '085755633986', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Ismi Fitrianingsih', 'Asma'),
  ('RTL24180263', 'Aulia Manik',              'murid', '089532864658', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Ismi Fitrianingsih', 'Asma'),
  ('RTL24180264', 'Sayyidah Fatimatuz Zahro', 'murid', '082335698687', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Ismi Fitrianingsih', 'Asma'),
  ('RTL24180265', 'Annisa',                   'murid', '082259606370', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Ismi Fitrianingsih', 'Asma'),
  ('RTL24180266', 'Safana Hani Hamidah',      'murid', '081288319938', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Ismi Fitrianingsih', 'Asma'),
  -- Halaqah Khadijah (ULUM)
  ('RTL24180310', 'Sri Bulan Harahap',        'murid', '081199997735', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Nurul Hidayatul Ulum', 'Khadijah'),
  ('RTL24180311', 'Yuni Putri Pratama',       'murid', '087760447846', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Nurul Hidayatul Ulum', 'Khadijah'),
  ('RTL24180312', 'Neng Chandra',             'murid', '081225796652', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Nurul Hidayatul Ulum', 'Khadijah'),
  ('RTL24180313', 'Irma Marsitah',            'murid', '089693729507', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Nurul Hidayatul Ulum', 'Khadijah'),
  ('RTL24180314', 'Fitria Rahma',             'murid', '082382891626', 'aktif', crypt('123456', gen_salt('bf')), 'Al-Ustadzah Nurul Hidayatul Ulum', 'Khadijah');

-- ─────────────────────────────────────────────
--  ANGGOTA (daftar murid per halaqah)
-- ─────────────────────────────────────────────
insert into public.anggota (id_halaqah, id_murid, nama_murid, level, target_level, status) values
  -- Maryam
  ('HQ-MARYAM', 'RTL24180250', 'Nur Lindatul Hidayah',   'Level 1', 'Level 2', 'aktif'),
  ('HQ-MARYAM', 'RTL24180251', 'Mitha Afril Yani',        'Level 1', 'Level 2', 'aktif'),
  ('HQ-MARYAM', 'RTL24180252', 'Himaya',                  'Level 1', 'Level 2', 'aktif'),
  ('HQ-MARYAM', 'RTL24180253', 'Vidyah Nawang Sari',      'Level 1', 'Level 2', 'aktif'),
  ('HQ-MARYAM', 'RTL24180254', 'Camelia Santika',         'Level 1', 'Level 2', 'aktif'),
  ('HQ-MARYAM', 'RTL24180255', 'Afifah',                  'Level 1', 'Level 2', 'aktif'),
  ('HQ-MARYAM', 'RTL24180257', 'Irma Istarizkizra',       'Level 1', 'Level 2', 'aktif'),
  ('HQ-MARYAM', 'RTL24180258', 'Shinta Mandasari',        'Level 1', 'Level 2', 'aktif'),
  ('HQ-MARYAM', 'RTL24180260', 'Uray Aurel Maylaf Islam', 'Level 1', 'Level 2', 'aktif'),
  ('HQ-MARYAM', 'RTL24180261', 'Sri Ayuni',               'Level 1', 'Level 2', 'aktif'),
  ('HQ-MARYAM', 'RTL24180106', 'Shinta Mandasari 2',      'Level 1', 'Level 2', 'aktif'),
  -- Asma
  ('HQ-ASMA', 'RTL24180262', 'Tyas Cindi Aulia',         'Level 1', 'Level 2', 'aktif'),
  ('HQ-ASMA', 'RTL24180263', 'Aulia Manik',              'Level 1', 'Level 2', 'aktif'),
  ('HQ-ASMA', 'RTL24180264', 'Sayyidah Fatimatuz Zahro', 'Level 1', 'Level 2', 'aktif'),
  ('HQ-ASMA', 'RTL24180265', 'Annisa',                   'Level 1', 'Level 2', 'aktif'),
  ('HQ-ASMA', 'RTL24180266', 'Safana Hani Hamidah',      'Level 1', 'Level 2', 'aktif'),
  -- Khadijah
  ('HQ-KHADIJAH', 'RTL24180310', 'Sri Bulan Harahap',  'Level 1', 'Level 2', 'aktif'),
  ('HQ-KHADIJAH', 'RTL24180311', 'Yuni Putri Pratama', 'Level 1', 'Level 2', 'aktif'),
  ('HQ-KHADIJAH', 'RTL24180312', 'Neng Chandra',       'Level 1', 'Level 2', 'aktif'),
  ('HQ-KHADIJAH', 'RTL24180313', 'Irma Marsitah',      'Level 1', 'Level 2', 'aktif'),
  ('HQ-KHADIJAH', 'RTL24180314', 'Fitria Rahma',       'Level 1', 'Level 2', 'aktif');

-- Tandai ketua kelas Maryam
update public.anggota set is_ketua = true
  where id_halaqah = 'HQ-MARYAM' and id_murid = 'RTL24180253';

-- ─────────────────────────────────────────────
--  KOMPONEN RAPORT
--  Total bobot = 100%
-- ─────────────────────────────────────────────
insert into public.komponen_raport (id_komponen, id_periode, nama_komponen, bobot, tipe, urutan, status) values
  ('KMP-SEED-001', 'P2026-1', 'Nilai KBM Harian',     35, 'otomatis', 1, 'aktif'),
  ('KMP-SEED-002', 'P2026-1', 'Kehadiran',             20, 'otomatis', 2, 'aktif'),
  ('KMP-SEED-003', 'P2026-1', 'Adab',                  10, 'otomatis', 3, 'aktif'),
  ('KMP-SEED-004', 'P2026-1', 'Kehadiran At-Tibyan',    5, 'otomatis', 4, 'aktif'),
  ('KMP-SEED-005', 'P2026-1', 'Micro Teaching',        15, 'manual',   5, 'aktif'),
  ('KMP-SEED-006', 'P2026-1', 'UAS',                   15, 'manual',   6, 'aktif');

-- ─────────────────────────────────────────────
--  CATATAN RAPORT per halaqah
-- ─────────────────────────────────────────────
insert into public.catatan_raport (id_halaqah, nama_halaqah, catatan) values
  ('HQ-MARYAM',   'Maryam',   'Alhamdulillah, perjalanan belajar Al-Qur''an semester ini berjalan dengan baik. Murid-murid menunjukkan semangat dan kesungguhan. Semoga ilmu yang sudah dipelajari dapat diamalkan. Tetap semangat dan istiqomah. Barakallahu fiikum.'),
  ('HQ-ASMA',     'Asma',     'Alhamdulillah, halaqah Asma semester ini berjalan lancar. Murid menunjukkan perkembangan yang baik dalam penguasaan tajwid dasar. Semoga terus istiqomah. Barakallahu fiikum.'),
  ('HQ-KHADIJAH', 'Khadijah', 'Alhamdulillah, halaqah Khadijah semester ini penuh berkah. Kehadiran murid sangat baik dan semangat belajar terus meningkat. Barakallahu fiikum.');

-- ─────────────────────────────────────────────
--  KBM DATA — 5 sesi pertama Halaqah Maryam
--  (data lengkap 40 sesi bisa di-generate via portal)
-- ─────────────────────────────────────────────
insert into public.kbm_log (id_kbm, id_halaqah, id_guru, nama_guru, tanggal_pertemuan, jam_mulai, jam_selesai, pertemuan_ke, jenis_sesi, materi_belajar, metode, catatan_umum, jumlah_hadir, jumlah_alpa, status) values
  ('KBM-SEED-001', 'HQ-MARYAM', 'NISA', 'Al-Ustadzah Annisa Rizkya Rahmawati', '2025-10-01', '15:00', '16:30', 1,  'KBM Reguler', 'Pengenalan Makharijul Huruf',      'Talaqqi dan Murajaah', 'Alhamdulillah sesi berjalan lancar.',  9, 0, 'selesai'),
  ('KBM-SEED-002', 'HQ-MARYAM', 'NISA', 'Al-Ustadzah Annisa Rizkya Rahmawati', '2025-10-03', '15:00', '16:30', 2,  'KBM Reguler', 'Makharijul Huruf - Al-Halq',       'Talaqqi dan Murajaah', 'Alhamdulillah sesi berjalan lancar.',  10, 1, 'selesai'),
  ('KBM-SEED-003', 'HQ-MARYAM', 'NISA', 'Al-Ustadzah Annisa Rizkya Rahmawati', '2025-10-08', '15:00', '16:30', 3,  'KBM Reguler', 'Makharijul Huruf - Al-Lisan 1',    'Talaqqi dan Murajaah', 'Alhamdulillah sesi berjalan lancar.',  11, 0, 'selesai'),
  ('KBM-SEED-004', 'HQ-MARYAM', 'NISA', 'Al-Ustadzah Annisa Rizkya Rahmawati', '2025-10-10', '15:00', '16:30', 4,  'KBM Reguler', 'Makharijul Huruf - Al-Lisan 2',    'Talaqqi dan Murajaah', 'Alhamdulillah sesi berjalan lancar.',  10, 0, 'selesai'),
  ('KBM-SEED-005', 'HQ-MARYAM', 'NISA', 'Al-Ustadzah Annisa Rizkya Rahmawati', '2025-10-15', '15:00', '16:30', 5,  'KBM Reguler', 'Makharijul Huruf - Al-Syafatain',  'Talaqqi dan Murajaah', 'Alhamdulillah sesi berjalan lancar.',  9,  0, 'selesai');

-- ─────────────────────────────────────────────
--  NILAI KBM — 5 sesi pertama murid Maryam
-- ─────────────────────────────────────────────
-- Sesi 1
insert into public.nilai_kbm (id_kbm, id_halaqah, id_murid, pertemuan_ke, tanggal, jenis_sesi, status_hadir, adab, kamera_murid, koreksi_tahsin) values
  ('KBM-SEED-001','HQ-MARYAM','RTL24180250',1,'2025-10-01','KBM Reguler','H','Baik','kamera terbuka','Perbaiki ghunnah pada nun bertasydid'),
  ('KBM-SEED-001','HQ-MARYAM','RTL24180251',1,'2025-10-01','KBM Reguler','H','Baik','kamera terbuka',''),
  ('KBM-SEED-001','HQ-MARYAM','RTL24180252',1,'2025-10-01','KBM Reguler','A','','',''),
  ('KBM-SEED-001','HQ-MARYAM','RTL24180253',1,'2025-10-01','KBM Reguler','H','Baik','kamera terbuka','Mad thabii kurang panjang'),
  ('KBM-SEED-001','HQ-MARYAM','RTL24180254',1,'2025-10-01','KBM Reguler','H','Baik','kamera terbuka',''),
  ('KBM-SEED-001','HQ-MARYAM','RTL24180255',1,'2025-10-01','KBM Reguler','T','Baik','kamera terbuka','Ikhfa lebih dengung'),
  ('KBM-SEED-001','HQ-MARYAM','RTL24180257',1,'2025-10-01','KBM Reguler','H','Baik','kamera terbuka',''),
  ('KBM-SEED-001','HQ-MARYAM','RTL24180258',1,'2025-10-01','KBM Reguler','H','Baik','kamera terbuka',''),
  ('KBM-SEED-001','HQ-MARYAM','RTL24180260',1,'2025-10-01','KBM Reguler','H','Baik','kamera sering tertutup',''),
  ('KBM-SEED-001','HQ-MARYAM','RTL24180261',1,'2025-10-01','KBM Reguler','H','Baik','kamera terbuka',''),
  ('KBM-SEED-001','HQ-MARYAM','RTL24180106',1,'2025-10-01','KBM Reguler','H','Baik','kamera terbuka','');

-- Sesi 2
insert into public.nilai_kbm (id_kbm, id_halaqah, id_murid, pertemuan_ke, tanggal, jenis_sesi, status_hadir, adab, kamera_murid, koreksi_tahsin) values
  ('KBM-SEED-002','HQ-MARYAM','RTL24180250',2,'2025-10-03','KBM Reguler','H','Baik','kamera terbuka','Perhatikan makhraj huruf ain'),
  ('KBM-SEED-002','HQ-MARYAM','RTL24180251',2,'2025-10-03','KBM Reguler','H','Baik','kamera terbuka',''),
  ('KBM-SEED-002','HQ-MARYAM','RTL24180252',2,'2025-10-03','KBM Reguler','H','Baik','kamera terbuka','Bacaan lebih pelan dan tartil'),
  ('KBM-SEED-002','HQ-MARYAM','RTL24180253',2,'2025-10-03','KBM Reguler','T','Baik','kamera terbuka',''),
  ('KBM-SEED-002','HQ-MARYAM','RTL24180254',2,'2025-10-03','KBM Reguler','H','Baik','kamera terbuka',''),
  ('KBM-SEED-002','HQ-MARYAM','RTL24180255',2,'2025-10-03','KBM Reguler','H','Baik','kamera terbuka',''),
  ('KBM-SEED-002','HQ-MARYAM','RTL24180257',2,'2025-10-03','KBM Reguler','H','Baik','kamera terbuka',''),
  ('KBM-SEED-002','HQ-MARYAM','RTL24180258',2,'2025-10-03','KBM Reguler','H','Baik','kamera terbuka',''),
  ('KBM-SEED-002','HQ-MARYAM','RTL24180260',2,'2025-10-03','KBM Reguler','A','','',''),
  ('KBM-SEED-002','HQ-MARYAM','RTL24180261',2,'2025-10-03','KBM Reguler','H','Baik','kamera terbuka',''),
  ('KBM-SEED-002','HQ-MARYAM','RTL24180106',2,'2025-10-03','KBM Reguler','H','Baik','kamera terbuka','');

-- Sesi 3, 4, 5 (ringkas)
insert into public.nilai_kbm (id_kbm, id_halaqah, id_murid, pertemuan_ke, tanggal, jenis_sesi, status_hadir, adab, kamera_murid) values
  ('KBM-SEED-003','HQ-MARYAM','RTL24180250',3,'2025-10-08','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-003','HQ-MARYAM','RTL24180251',3,'2025-10-08','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-003','HQ-MARYAM','RTL24180252',3,'2025-10-08','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-003','HQ-MARYAM','RTL24180253',3,'2025-10-08','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-003','HQ-MARYAM','RTL24180254',3,'2025-10-08','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-003','HQ-MARYAM','RTL24180255',3,'2025-10-08','KBM Reguler','H','Butuh Perhatian','kamera sering tertutup'),
  ('KBM-SEED-003','HQ-MARYAM','RTL24180257',3,'2025-10-08','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-003','HQ-MARYAM','RTL24180258',3,'2025-10-08','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-003','HQ-MARYAM','RTL24180260',3,'2025-10-08','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-003','HQ-MARYAM','RTL24180261',3,'2025-10-08','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-003','HQ-MARYAM','RTL24180106',3,'2025-10-08','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-004','HQ-MARYAM','RTL24180250',4,'2025-10-10','KBM Reguler','T','Baik','kamera terbuka'),
  ('KBM-SEED-004','HQ-MARYAM','RTL24180251',4,'2025-10-10','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-004','HQ-MARYAM','RTL24180252',4,'2025-10-10','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-004','HQ-MARYAM','RTL24180253',4,'2025-10-10','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-004','HQ-MARYAM','RTL24180254',4,'2025-10-10','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-004','HQ-MARYAM','RTL24180255',4,'2025-10-10','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-004','HQ-MARYAM','RTL24180257',4,'2025-10-10','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-004','HQ-MARYAM','RTL24180258',4,'2025-10-10','KBM Reguler','I','',''),
  ('KBM-SEED-004','HQ-MARYAM','RTL24180260',4,'2025-10-10','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-004','HQ-MARYAM','RTL24180261',4,'2025-10-10','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-004','HQ-MARYAM','RTL24180106',4,'2025-10-10','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-005','HQ-MARYAM','RTL24180250',5,'2025-10-15','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-005','HQ-MARYAM','RTL24180251',5,'2025-10-15','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-005','HQ-MARYAM','RTL24180252',5,'2025-10-15','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-005','HQ-MARYAM','RTL24180253',5,'2025-10-15','KBM Reguler','A','',''),
  ('KBM-SEED-005','HQ-MARYAM','RTL24180254',5,'2025-10-15','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-005','HQ-MARYAM','RTL24180255',5,'2025-10-15','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-005','HQ-MARYAM','RTL24180257',5,'2025-10-15','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-005','HQ-MARYAM','RTL24180258',5,'2025-10-15','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-005','HQ-MARYAM','RTL24180260',5,'2025-10-15','KBM Reguler','H','Baik','kamera selalu tertutup'),
  ('KBM-SEED-005','HQ-MARYAM','RTL24180261',5,'2025-10-15','KBM Reguler','H','Baik','kamera terbuka'),
  ('KBM-SEED-005','HQ-MARYAM','RTL24180106',5,'2025-10-15','KBM Reguler','H','Baik','kamera terbuka');

-- ─────────────────────────────────────────────
--  NILAI MANUAL (UAS + Micro Teaching)
-- ─────────────────────────────────────────────
insert into public.nilai_manual (id_murid, id_halaqah, id_periode, id_komponen, nama_komponen, nilai, catatan) values
  ('RTL24180250','HQ-MARYAM','P2026-1','KMP-SEED-006','UAS',          85, 'Nilai UAS Semester 1 2026'),
  ('RTL24180250','HQ-MARYAM','P2026-1','KMP-SEED-005','Micro Teaching',80, 'Presentasi hukum tajwid'),
  ('RTL24180251','HQ-MARYAM','P2026-1','KMP-SEED-006','UAS',          92, 'Nilai UAS Semester 1 2026'),
  ('RTL24180251','HQ-MARYAM','P2026-1','KMP-SEED-005','Micro Teaching',88, 'Presentasi hukum tajwid'),
  ('RTL24180252','HQ-MARYAM','P2026-1','KMP-SEED-006','UAS',          65, 'Nilai UAS Semester 1 2026'),
  ('RTL24180252','HQ-MARYAM','P2026-1','KMP-SEED-005','Micro Teaching',60, 'Presentasi hukum tajwid'),
  ('RTL24180253','HQ-MARYAM','P2026-1','KMP-SEED-006','UAS',          78, 'Nilai UAS Semester 1 2026'),
  ('RTL24180253','HQ-MARYAM','P2026-1','KMP-SEED-005','Micro Teaching',75, 'Presentasi hukum tajwid'),
  ('RTL24180254','HQ-MARYAM','P2026-1','KMP-SEED-006','UAS',          95, 'Nilai UAS Semester 1 2026'),
  ('RTL24180254','HQ-MARYAM','P2026-1','KMP-SEED-005','Micro Teaching',92, 'Presentasi hukum tajwid'),
  ('RTL24180255','HQ-MARYAM','P2026-1','KMP-SEED-006','UAS',          82, 'Nilai UAS Semester 1 2026'),
  ('RTL24180255','HQ-MARYAM','P2026-1','KMP-SEED-005','Micro Teaching',78, 'Presentasi hukum tajwid'),
  ('RTL24180257','HQ-MARYAM','P2026-1','KMP-SEED-006','UAS',          88, 'Nilai UAS Semester 1 2026'),
  ('RTL24180257','HQ-MARYAM','P2026-1','KMP-SEED-005','Micro Teaching',84, 'Presentasi hukum tajwid'),
  ('RTL24180258','HQ-MARYAM','P2026-1','KMP-SEED-006','UAS',          86, 'Nilai UAS Semester 1 2026'),
  ('RTL24180258','HQ-MARYAM','P2026-1','KMP-SEED-005','Micro Teaching',82, 'Presentasi hukum tajwid'),
  ('RTL24180260','HQ-MARYAM','P2026-1','KMP-SEED-006','UAS',          70, 'Nilai UAS Semester 1 2026'),
  ('RTL24180260','HQ-MARYAM','P2026-1','KMP-SEED-005','Micro Teaching',65, 'Presentasi hukum tajwid'),
  ('RTL24180261','HQ-MARYAM','P2026-1','KMP-SEED-006','UAS',          90, 'Nilai UAS Semester 1 2026'),
  ('RTL24180261','HQ-MARYAM','P2026-1','KMP-SEED-005','Micro Teaching',85, 'Presentasi hukum tajwid'),
  ('RTL24180106','HQ-MARYAM','P2026-1','KMP-SEED-006','UAS',          83, 'Nilai UAS Semester 1 2026'),
  ('RTL24180106','HQ-MARYAM','P2026-1','KMP-SEED-005','Micro Teaching',80, 'Presentasi hukum tajwid');

-- ─────────────────────────────────────────────
--  PENGUMUMAN
-- ─────────────────────────────────────────────
insert into public.pengumuman (judul, isi, target, id_halaqah, dibuat_oleh, nama_pembuat, tanggal, status) values
  ('[PENTING] Jadwal UAS Semester 1 2026',
   'Assalamualaikum para murid Maryam. UAS akan dilaksanakan pada tanggal 15 Juni 2026. Harap mempersiapkan diri dengan baik. Materi: semua hukum tajwid dari pertemuan 1-12. Hadir tepat waktu ya!',
   'HQ-MARYAM', 'HQ-MARYAM', 'NISA', 'Al-Ustadzah Annisa Rizkya Rahmawati', '2026-05-28', 'aktif'),
  ('Libur Halaqah Minggu Ini',
   'Assalamualaikum. Diinformasikan bahwa halaqah minggu ini ditiadakan karena ustadzah ada keperluan mendadak. Mohon maaf atas ketidaknyamanannya.',
   'HQ-MARYAM', 'HQ-MARYAM', 'NISA', 'Al-Ustadzah Annisa Rizkya Rahmawati', '2026-06-01', 'aktif'),
  ('[INFO] Kajian At-Tibyan Pekan Depan',
   'Assalamualaikum warahmatullahi wabarakatuh. Kajian At-Tibyan akan dilaksanakan pekan depan. Tema: Waqaf dan Ibtida dalam membaca Al-Quran. Hadir ya semua!',
   'semua', null, 'UMAR', 'Al-Ustadz Umar Abdul Aziz', '2026-06-01', 'aktif');

-- ─────────────────────────────────────────────
--  VERIFIKASI — tampilkan ringkasan
-- ─────────────────────────────────────────────
select 'users'           as tabel, count(*) as jumlah from public.users
union all
select 'halaqah',        count(*) from public.halaqah
union all
select 'anggota',        count(*) from public.anggota
union all
select 'kbm_log',        count(*) from public.kbm_log
union all
select 'nilai_kbm',      count(*) from public.nilai_kbm
union all
select 'nilai_manual',   count(*) from public.nilai_manual
union all
select 'komponen_raport',count(*) from public.komponen_raport
union all
select 'pengumuman',     count(*) from public.pengumuman
order by tabel;
