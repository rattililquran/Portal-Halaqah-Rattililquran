-- ============================================================
--  001_schema.sql
--  Rattililqur'an Portal — Supabase PostgreSQL Schema
--  Migrasi dari Google Sheets (GAS) ke Supabase
--
--  Urutan eksekusi:
--  1. Jalankan file ini di Supabase SQL Editor
--  2. Jalankan 002_rls.sql untuk Row-Level Security
--  3. Jalankan 003_functions.sql untuk helper functions
--  4. Jalankan seed/001_seed_master.sql untuk data awal
-- ============================================================

-- ─────────────────────────────────────────────
--  EXTENSION
-- ─────────────────────────────────────────────
create extension if not exists "pgcrypto";   -- untuk gen_random_uuid() dan crypt()
create extension if not exists "pg_trgm";    -- untuk full-text search nama murid

-- ─────────────────────────────────────────────
--  ENUM TYPES
-- ─────────────────────────────────────────────
create type user_role as enum ('superadmin', 'admin', 'guru', 'murid');
create type status_umum as enum ('aktif', 'nonaktif');
create type status_kbm as enum ('draft', 'selesai');
create type status_hadir as enum ('H', 'T', 'I', 'A');
create type status_raport as enum ('draft', 'published');
create type tipe_komponen as enum ('otomatis', 'manual');
create type jenis_sesi as enum ('KBM Reguler', 'Micro Teaching', 'Lainnya');
create type window_observasi as enum ('terbuka', 'terkunci', 'selesai');

-- ============================================================
--  TABEL 1: USERS
--  Semua pengguna: admin, guru, murid
-- ============================================================
create table public.users (
  -- Primary key: ID format lama dipertahankan (RTL24180250, NISA, ADMIN-001)
  id_user       text primary key,
  -- Supabase Auth UUID — diisi otomatis saat user dibuat via Edge Function
  auth_id       uuid unique references auth.users(id) on delete set null,

  nama_lengkap  text not null,
  role          user_role not null,
  no_hp         text,
  email         text,
  alamat        text,
  tgl_daftar    date default current_date,
  status        status_umum not null default 'aktif',
  -- Password di-hash dengan bcrypt — TIDAK simpan plaintext
  password_hash text,
  catatan       text,

  -- Denormalisasi untuk kemudahan display (diupdate otomatis via trigger)
  nama_guru     text,    -- nama guru pengampu (untuk murid)
  nama_halaqah  text,    -- nama halaqah (untuk murid)

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_users_role   on public.users(role);
create index idx_users_status on public.users(status);
create index idx_users_nama   on public.users using gin(nama_lengkap gin_trgm_ops);

-- ============================================================
--  TABEL 2: LEVEL
--  Level tahsin: Level 1, Level 2, dst
-- ============================================================
create table public.level (
  id_level    text primary key,
  nama_level  text not null unique,
  deskripsi   text,
  urutan      integer not null default 0,
  status      status_umum not null default 'aktif',
  created_at  timestamptz not null default now()
);

-- ============================================================
--  TABEL 3: PERIODE
--  Semester / tahun ajaran
-- ============================================================
create table public.periode (
  id_periode      text primary key,
  nama_periode    text not null,
  tanggal_mulai   date,
  tanggal_selesai date,
  deskripsi       text,
  status          status_umum not null default 'nonaktif',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_periode_status on public.periode(status);

-- ============================================================
--  TABEL 4: HALAQAH
--  Kelas tahsin
-- ============================================================
create table public.halaqah (
  id_halaqah   text primary key,
  nama_halaqah text not null,

  -- Referensi ke guru pengampu
  id_guru      text references public.users(id_user) on delete set null,
  nama_guru    text,   -- denormalisasi untuk display

  -- Referensi ke periode aktif
  id_periode   text references public.periode(id_periode) on delete set null,

  level        text,
  jadwal_hari  text,   -- "Rabu Jumat"
  jam_mulai    time,
  jam_selesai  time,
  lokasi       text default 'Online (Zoom)',
  kurikulum    text,
  status       status_umum not null default 'aktif',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_halaqah_guru    on public.halaqah(id_guru);
create index idx_halaqah_periode on public.halaqah(id_periode);
create index idx_halaqah_status  on public.halaqah(status);

-- ============================================================
--  TABEL 5: ANGGOTA
--  Murid yang terdaftar di halaqah
-- ============================================================
create table public.anggota (
  id_anggota   text primary key default 'ANG-' || gen_random_uuid()::text,
  id_halaqah   text not null references public.halaqah(id_halaqah) on delete cascade,
  id_murid     text not null references public.users(id_user) on delete cascade,
  nama_murid   text,   -- denormalisasi

  tgl_bergabung date default current_date,
  level         text,
  target_level  text,
  total_hadir   integer not null default 0,
  status        status_umum not null default 'aktif',
  catatan_guru  text,
  is_ketua      boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Satu murid hanya bisa terdaftar sekali di satu halaqah
  unique (id_halaqah, id_murid)
);

create index idx_anggota_halaqah on public.anggota(id_halaqah);
create index idx_anggota_murid   on public.anggota(id_murid);
create index idx_anggota_ketua   on public.anggota(id_halaqah) where is_ketua = true;

-- ============================================================
--  TABEL 6: KBM_LOG
--  Log setiap sesi KBM
-- ============================================================
create table public.kbm_log (
  id_kbm            text primary key,
  id_halaqah         text not null references public.halaqah(id_halaqah) on delete cascade,
  id_guru            text references public.users(id_user) on delete set null,
  nama_guru          text,   -- denormalisasi

  tanggal_pertemuan  date not null,
  jam_mulai          time,
  jam_selesai        time,
  pertemuan_ke       integer not null default 1,
  jenis_sesi         text not null default 'KBM Reguler',

  -- Jurnal
  materi_belajar     text,   -- topik materi (dari portal guru)
  halaman_modul      text,   -- halaman/modul
  pencapaian_modul   text,   -- alias materi_belajar
  metode             text default 'Talaqqi dan Murajaah',
  catatan_umum       text,

  -- Latihan mandiri / PR
  latihan_mandiri    text,
  jenis_latihan      text,
  deadline_latihan   date,

  -- Summary
  jumlah_hadir       integer not null default 0,
  jumlah_alpa        integer not null default 0,
  status             status_kbm not null default 'draft',

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_kbm_halaqah on public.kbm_log(id_halaqah);
create index idx_kbm_guru    on public.kbm_log(id_guru);
create index idx_kbm_status  on public.kbm_log(status);
create index idx_kbm_tanggal on public.kbm_log(tanggal_pertemuan desc);

-- ============================================================
--  TABEL 7: NILAI_KBM
--  Presensi + nilai per murid per sesi
--  SINGLE SOURCE OF TRUTH — tidak ada duplikasi ke sheet per-kelas
-- ============================================================
create table public.nilai_kbm (
  id_nilai       text primary key default 'NLI-' || gen_random_uuid()::text,
  id_kbm         text not null references public.kbm_log(id_kbm) on delete cascade,
  id_halaqah     text not null references public.halaqah(id_halaqah) on delete cascade,
  id_murid       text not null references public.users(id_user) on delete cascade,

  -- Denormalisasi untuk kemudahan query
  pertemuan_ke   integer,
  tanggal        date,
  jenis_sesi     text,

  -- Presensi
  status_hadir   status_hadir not null default 'H',

  -- Penilaian (diisi saat sesi berlangsung)
  adab           text,           -- 'Baik' | 'Butuh Perhatian'
  kamera_murid   text,           -- 'kamera terbuka' | 'kamera sering tertutup' | 'kamera selalu tertutup'
  koreksi_tahsin text,
  catatan_murid  text,

  -- Legacy field
  nilai          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Satu murid hanya satu record per sesi KBM
  unique (id_kbm, id_murid)
);

create index idx_nilai_kbm_id      on public.nilai_kbm(id_kbm);
create index idx_nilai_kbm_murid   on public.nilai_kbm(id_murid);
create index idx_nilai_kbm_halaqah on public.nilai_kbm(id_halaqah);
create index idx_nilai_kbm_tanggal on public.nilai_kbm(tanggal desc);

-- ============================================================
--  TABEL 8: TEMPLATE_KOREKSI
--  Template chip koreksi tahsin yang dipakai guru
-- ============================================================
create table public.template_koreksi (
  id_template  text primary key default 'TK-' || gen_random_uuid()::text,
  kategori     text not null,
  teks         text not null,
  urutan       integer not null default 0,
  status       status_umum not null default 'aktif',
  created_at   timestamptz not null default now()
);

-- ============================================================
--  TABEL 9: PENGUMUMAN
-- ============================================================
create table public.pengumuman (
  id_pengumuman  text primary key default 'PNG-' || gen_random_uuid()::text,
  judul          text not null,
  isi            text not null,
  -- target: 'semua' | 'all' | id_halaqah
  target         text not null default 'semua',
  id_halaqah     text references public.halaqah(id_halaqah) on delete set null,
  dibuat_oleh    text references public.users(id_user) on delete set null,
  nama_pembuat   text,
  tanggal        date not null default current_date,
  status         status_umum not null default 'aktif',
  created_at     timestamptz not null default now()
);

create index idx_pengumuman_tanggal   on public.pengumuman(tanggal desc);
create index idx_pengumuman_halaqah   on public.pengumuman(id_halaqah);
create index idx_pengumuman_status    on public.pengumuman(status);

-- ============================================================
--  TABEL 10: KOMPONEN_RAPORT
--  Komponen penilaian per periode
-- ============================================================
create table public.komponen_raport (
  id_komponen    text primary key,
  id_periode     text not null references public.periode(id_periode) on delete cascade,
  nama_komponen  text not null,
  bobot          numeric(5,2) not null check (bobot >= 0 and bobot <= 100),
  tipe           tipe_komponen not null default 'otomatis',
  urutan         integer not null default 0,
  status         status_umum not null default 'aktif',
  created_at     timestamptz not null default now()
);

create index idx_komponen_periode on public.komponen_raport(id_periode);

-- ============================================================
--  TABEL 11: NILAI_MANUAL
--  Nilai komponen manual (UAS, Micro Teaching, dll)
-- ============================================================
create table public.nilai_manual (
  id_nilai_manual  text primary key default 'NMN-' || gen_random_uuid()::text,
  id_murid         text not null references public.users(id_user) on delete cascade,
  id_halaqah       text references public.halaqah(id_halaqah) on delete set null,
  id_periode       text not null references public.periode(id_periode) on delete cascade,
  id_komponen      text not null references public.komponen_raport(id_komponen) on delete cascade,
  nama_komponen    text,   -- denormalisasi
  nilai            numeric(5,2) not null check (nilai >= 0 and nilai <= 100),
  catatan          text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Satu nilai per murid per komponen per periode
  unique (id_murid, id_periode, id_komponen)
);

create index idx_nilai_manual_murid   on public.nilai_manual(id_murid);
create index idx_nilai_manual_periode on public.nilai_manual(id_periode);

-- ============================================================
--  TABEL 12: KONFIGURASI_RAPORT
--  Parameter global raport (threshold, bobot adab/kamera, dll)
-- ============================================================
create table public.konfigurasi_raport (
  key         text primary key,
  value       text not null,
  keterangan  text,
  updated_at  timestamptz not null default now()
);

-- ============================================================
--  TABEL 13: CATATAN_RAPORT
--  Catatan wali halaqah yang muncul di raport murid
-- ============================================================
create table public.catatan_raport (
  id_halaqah   text primary key references public.halaqah(id_halaqah) on delete cascade,
  nama_halaqah text,
  catatan      text not null default '',
  updated_at   timestamptz not null default now()
);

-- ============================================================
--  TABEL 14: RAPORT
--  Hasil generate raport per murid per periode
-- ============================================================
create table public.raport (
  id_raport     text primary key default 'RPT-' || gen_random_uuid()::text,
  id_murid      text not null references public.users(id_user) on delete cascade,
  id_periode    text not null references public.periode(id_periode) on delete cascade,
  id_halaqah    text references public.halaqah(id_halaqah) on delete set null,

  nilai_akhir   numeric(5,2),
  predikat      text,
  detail_json   jsonb,   -- array komponen dengan nilai masing-masing

  tanggal_cetak date default current_date,
  status        status_raport not null default 'draft',
  url_pdf       text,    -- URL Drive atau Supabase Storage

  published_by  text references public.users(id_user) on delete set null,
  published_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Satu raport per murid per periode
  unique (id_murid, id_periode)
);

create index idx_raport_murid   on public.raport(id_murid);
create index idx_raport_periode on public.raport(id_periode);
create index idx_raport_status  on public.raport(status);

-- ============================================================
--  TABEL 15: AT_TIBYAN_SESI
--  Sesi kajian At-Tibyan (kajian mingguan semua halaqah)
-- ============================================================
create table public.at_tibyan_sesi (
  id_sesi          text primary key default 'ATS-' || gen_random_uuid()::text,
  pertemuan_ke     integer not null,
  tanggal          date not null,
  id_guru          text references public.users(id_user) on delete set null,
  nama_guru        text,
  materi           text,
  total_hadir      integer not null default 0,
  total_murid      integer not null default 0,
  status           status_kbm not null default 'selesai',
  created_at       timestamptz not null default now()
);

create index idx_at_sesi_tanggal on public.at_tibyan_sesi(tanggal desc);

-- ============================================================
--  TABEL 16: AT_TIBYAN_LOG
--  Presensi murid per sesi At-Tibyan
-- ============================================================
create table public.at_tibyan_log (
  id_log       text primary key default 'ATL-' || gen_random_uuid()::text,
  id_sesi      text not null references public.at_tibyan_sesi(id_sesi) on delete cascade,
  pertemuan_ke integer,
  tanggal      date,
  id_murid     text not null references public.users(id_user) on delete cascade,
  nama_murid   text,
  id_halaqah   text references public.halaqah(id_halaqah) on delete set null,
  nama_halaqah text,
  level        text,
  status_hadir status_hadir not null default 'H',
  created_at   timestamptz not null default now(),

  unique (id_sesi, id_murid)
);

create index idx_at_log_sesi  on public.at_tibyan_log(id_sesi);
create index idx_at_log_murid on public.at_tibyan_log(id_murid);

-- ============================================================
--  TABEL 17: OBSERVASI_KBM
--  Observasi rahasia ketua kelas — hanya dilihat superadmin
-- ============================================================
create table public.observasi_kbm (
  id_observasi      text primary key default 'OBS-' || gen_random_uuid()::text,
  id_kbm            text not null references public.kbm_log(id_kbm) on delete cascade,
  id_halaqah        text references public.halaqah(id_halaqah) on delete set null,
  id_ketua          text references public.users(id_user) on delete set null,
  pertemuan_ke      integer,
  tanggal           date,

  -- Poin observasi
  kondisi_kelas     text,
  ada_latihan       text,
  ketepatan_waktu   text,
  catatan_tambahan  text,

  status            text not null default 'submitted',
  created_at        timestamptz not null default now()
);

create index idx_observasi_kbm      on public.observasi_kbm(id_kbm);
create index idx_observasi_halaqah  on public.observasi_kbm(id_halaqah);
create index idx_observasi_ketua    on public.observasi_kbm(id_ketua);

-- ============================================================
--  TABEL 18: REKAP_STATUS
--  Status rekap yang sudah dikirim ketua kelas
-- ============================================================
create table public.rekap_status (
  id_rekap      text primary key default 'RKP-' || gen_random_uuid()::text,
  id_kbm        text not null references public.kbm_log(id_kbm) on delete cascade,
  id_halaqah    text references public.halaqah(id_halaqah) on delete set null,
  id_ketua      text references public.users(id_user) on delete set null,
  pertemuan_ke  integer,
  tanggal       date,
  status        text not null default 'terkirim',
  created_at    timestamptz not null default now(),

  unique (id_kbm, id_ketua)
);

-- ============================================================
--  TABEL 19: AUDIT_LOG
--  Log aktivitas penting
-- ============================================================
create table public.audit_log (
  id_log      text primary key default 'LOG-' || gen_random_uuid()::text,
  user_id     text,
  action      text not null,
  detail      jsonb,
  ip_address  text,
  created_at  timestamptz not null default now()
);

create index idx_audit_user   on public.audit_log(user_id);
create index idx_audit_action on public.audit_log(action);
create index idx_audit_time   on public.audit_log(created_at desc);

-- ============================================================
--  TABEL 20: SPP_PEMBAYARAN
--  Status pembayaran SPP per murid
--  (sebelumnya baca dari Google Sheets external)
-- ============================================================
create table public.spp_pembayaran (
  id_spp        text primary key default 'SPP-' || gen_random_uuid()::text,
  id_murid      text not null references public.users(id_user) on delete cascade,
  bulan         text not null,         -- 'Januari', 'Februari', dst
  tahun         integer not null,
  jenis         text not null default 'SPP Pribadi',
  status        text not null default 'lunas',  -- 'lunas' | 'belum'
  nominal       numeric(12,0),
  tanggal_bayar date,
  catatan       text,
  created_at    timestamptz not null default now(),

  unique (id_murid, bulan, tahun, jenis)
);

create index idx_spp_murid on public.spp_pembayaran(id_murid);
create index idx_spp_tahun on public.spp_pembayaran(tahun, bulan);

-- ============================================================
--  TRIGGERS — updated_at otomatis
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Terapkan trigger ke semua tabel yang punya updated_at
create trigger trg_users_updated
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger trg_halaqah_updated
  before update on public.halaqah
  for each row execute function public.set_updated_at();

create trigger trg_anggota_updated
  before update on public.anggota
  for each row execute function public.set_updated_at();

create trigger trg_kbm_log_updated
  before update on public.kbm_log
  for each row execute function public.set_updated_at();

create trigger trg_nilai_kbm_updated
  before update on public.nilai_kbm
  for each row execute function public.set_updated_at();

create trigger trg_nilai_manual_updated
  before update on public.nilai_manual
  for each row execute function public.set_updated_at();

create trigger trg_raport_updated
  before update on public.raport
  for each row execute function public.set_updated_at();

create trigger trg_periode_updated
  before update on public.periode
  for each row execute function public.set_updated_at();

create trigger trg_konfigurasi_updated
  before update on public.konfigurasi_raport
  for each row execute function public.set_updated_at();

create trigger trg_catatan_raport_updated
  before update on public.catatan_raport
  for each row execute function public.set_updated_at();

-- ============================================================
--  KONFIGURASI DEFAULT RAPORT
-- ============================================================
insert into public.konfigurasi_raport (key, value, keterangan) values
  ('nama_lembaga',            'Rattililqur''an',                                  'Nama lembaga di header raport'),
  ('sub_nama_lembaga',        'Lembaga Tahsin & Tahfidz Al-Qur''an Online',       'Sub-nama di bawah logo'),
  ('kontak_lembaga',          'Website: rattililquran.github.io',                 'Kontak yang ditampilkan'),
  ('kota_terbit',             'Jakarta',                                           'Kota di bawah tanggal cetak'),
  ('ttd_nama',                'Tim Akademik',                                      'Nama penanda tangan'),
  ('ttd_jabatan',             'Koordinator Akademik Rattililqur''an',             'Jabatan penanda tangan'),
  ('pesan_penutup',           'Semoga Allah senantiasa memberkahi perjalanan belajar Al-Qur''an kamu. Tetap semangat dan istiqomah!', 'Pesan di akhir raport'),
  ('grade_mumtaz',            '90',    'Nilai minimum Mumtaz'),
  ('grade_jayyid_jiddan',     '80',    'Nilai minimum Jayyid Jiddan'),
  ('grade_jayyid',            '70',    'Nilai minimum Jayyid'),
  ('bobot_adab',              '70',    'Bobot adab dalam KBM Harian (%)'),
  ('bobot_kamera',            '30',    'Bobot kamera dalam KBM Harian (%)'),
  ('bonus_perfect_attendance','5',     'Bonus poin jika 0 Alpa sepanjang semester'),
  ('pdf_tampilkan_koreksi',   'false', 'Tampilkan kolom koreksi di tabel sesi PDF'),
  ('pdf_maks_sesi',           '40',    'Maks sesi yang ditampilkan di PDF'),
  ('spp_spreadsheet_id',      '',      'ID Google Sheets SPP eksternal (kosongkan jika pakai tabel spp_pembayaran)');

-- ============================================================
--  LEVEL DEFAULT
-- ============================================================
insert into public.level (id_level, nama_level, deskripsi, urutan) values
  ('LVL-1', 'Level 1', 'Makharijul huruf dan tajwid dasar', 1),
  ('LVL-2', 'Level 2', 'Tajwid lanjutan dan kelancaran', 2),
  ('LVL-3', 'Level 3', 'Murajaah dan tartil', 3);

-- ============================================================
--  TEMPLATE KOREKSI DEFAULT
-- ============================================================
insert into public.template_koreksi (kategori, teks, urutan) values
  ('Makhraj',     'Perbaiki makhraj huruf ain',           1),
  ('Makhraj',     'Makhraj huruf qaf kurang tegas',       2),
  ('Mad',         'Mad wajib muttashil harus 5 harakat',  3),
  ('Mad',         'Mad thabii kurang panjang',            4),
  ('Ghunnah',     'Perbaiki ghunnah pada nun bertasydid', 5),
  ('Ghunnah',     'Ghunnah mim sukun perlu diperjelas',   6),
  ('Waqaf',       'Waqaf di tempat yang salah',           7),
  ('Tartil',      'Bacaan lebih pelan dan tartil',        8),
  ('Sifat Huruf', 'Sifat huruf shad - itbaq lebih tegas',9),
  ('Ikhfa',       'Ikhfa lebih dengung',                 10);

-- Selesai! Lanjut ke 002_rls.sql
