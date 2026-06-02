-- ============================================================
--  002_rls.sql
--  Row-Level Security Policies
--  Menggantikan routeAdmin / routeGuru / routeMurid dari GAS
--
--  Konsep:
--  - auth.uid()  = UUID dari Supabase Auth (login session)
--  - current_user_id()  = id_user kita (RTL..., NISA, dll)
--  - current_user_role() = role (admin, guru, murid, superadmin)
-- ============================================================

-- ─────────────────────────────────────────────
--  HELPER FUNCTIONS
--  Dibaca dari JWT custom claims yang diset saat login
-- ─────────────────────────────────────────────

-- Ambil id_user dari JWT claim
create or replace function public.current_user_id()
returns text language sql stable security definer as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::json->>'id_user',
    (select id_user from public.users where auth_id = auth.uid() limit 1)
  );
$$;

-- Ambil role dari JWT claim
create or replace function public.current_user_role()
returns text language sql stable security definer as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::json->>'role',
    (select role::text from public.users where auth_id = auth.uid() limit 1)
  );
$$;

-- Cek apakah user adalah admin atau superadmin
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select current_user_role() in ('admin', 'superadmin');
$$;

-- Cek apakah user adalah guru
create or replace function public.is_guru()
returns boolean language sql stable security definer as $$
  select current_user_role() = 'guru';
$$;

-- Cek apakah user adalah murid
create or replace function public.is_murid()
returns boolean language sql stable security definer as $$
  select current_user_role() = 'murid';
$$;

-- Cek apakah guru memiliki halaqah tertentu
create or replace function public.guru_owns_halaqah(p_id_halaqah text)
returns boolean language sql stable security definer as $$
  select exists(
    select 1 from public.halaqah
    where id_halaqah = p_id_halaqah
      and id_guru    = current_user_id()
      and status     = 'aktif'
  );
$$;

-- Cek apakah murid terdaftar di halaqah tertentu
create or replace function public.murid_in_halaqah(p_id_halaqah text)
returns boolean language sql stable security definer as $$
  select exists(
    select 1 from public.anggota
    where id_halaqah = p_id_halaqah
      and id_murid   = current_user_id()
      and status     = 'aktif'
  );
$$;

-- ─────────────────────────────────────────────
--  AKTIFKAN RLS DI SEMUA TABEL
-- ─────────────────────────────────────────────
alter table public.users              enable row level security;
alter table public.level              enable row level security;
alter table public.periode            enable row level security;
alter table public.halaqah            enable row level security;
alter table public.anggota            enable row level security;
alter table public.kbm_log            enable row level security;
alter table public.nilai_kbm          enable row level security;
alter table public.template_koreksi   enable row level security;
alter table public.pengumuman         enable row level security;
alter table public.komponen_raport    enable row level security;
alter table public.nilai_manual       enable row level security;
alter table public.konfigurasi_raport enable row level security;
alter table public.catatan_raport     enable row level security;
alter table public.raport             enable row level security;
alter table public.at_tibyan_sesi     enable row level security;
alter table public.at_tibyan_log      enable row level security;
alter table public.observasi_kbm      enable row level security;
alter table public.rekap_status       enable row level security;
alter table public.audit_log          enable row level security;
alter table public.spp_pembayaran     enable row level security;

-- ============================================================
--  TABEL: USERS
-- ============================================================
-- Admin: lihat semua
create policy "admin_read_all_users" on public.users
  for select using (is_admin());

-- Admin: buat dan update user
create policy "admin_write_users" on public.users
  for all using (is_admin());

-- Guru: lihat profil dirinya sendiri + murid di halaqahnya
create policy "guru_read_users" on public.users
  for select using (
    is_guru() and (
      id_user = current_user_id()                        -- profil sendiri
      or id_user in (                                    -- murid di halaqahnya
        select a.id_murid from public.anggota a
        join public.halaqah h on h.id_halaqah = a.id_halaqah
        where h.id_guru = current_user_id() and a.status = 'aktif'
      )
    )
  );

-- Guru: update profil sendiri saja
create policy "guru_update_self" on public.users
  for update using (is_guru() and id_user = current_user_id());

-- Murid: lihat dan update profil sendiri saja
create policy "murid_read_self" on public.users
  for select using (is_murid() and id_user = current_user_id());

create policy "murid_update_self" on public.users
  for update using (is_murid() and id_user = current_user_id());

-- ============================================================
--  TABEL: LEVEL & PERIODE
--  Semua user boleh baca, hanya admin yang bisa ubah
-- ============================================================
create policy "all_read_level" on public.level
  for select using (auth.uid() is not null);
create policy "admin_write_level" on public.level
  for all using (is_admin());

create policy "all_read_periode" on public.periode
  for select using (auth.uid() is not null);
create policy "admin_write_periode" on public.periode
  for all using (is_admin());

-- ============================================================
--  TABEL: HALAQAH
-- ============================================================
-- Admin: semua akses
create policy "admin_all_halaqah" on public.halaqah
  for all using (is_admin());

-- Guru: lihat halaqah miliknya
create policy "guru_read_halaqah" on public.halaqah
  for select using (is_guru() and id_guru = current_user_id());

-- Murid: lihat halaqah tempat dia terdaftar
create policy "murid_read_halaqah" on public.halaqah
  for select using (
    is_murid() and murid_in_halaqah(id_halaqah)
  );

-- ============================================================
--  TABEL: ANGGOTA
-- ============================================================
create policy "admin_all_anggota" on public.anggota
  for all using (is_admin());

-- Guru: lihat anggota di halaqahnya
create policy "guru_read_anggota" on public.anggota
  for select using (is_guru() and guru_owns_halaqah(id_halaqah));

-- Guru: tambah/update murid di halaqahnya
create policy "guru_write_anggota" on public.anggota
  for all using (is_guru() and guru_owns_halaqah(id_halaqah));

-- Murid: lihat data dirinya sendiri di anggota
create policy "murid_read_anggota_self" on public.anggota
  for select using (is_murid() and id_murid = current_user_id());

-- ============================================================
--  TABEL: KBM_LOG
-- ============================================================
create policy "admin_all_kbm_log" on public.kbm_log
  for all using (is_admin());

-- Guru: full access ke sesi halaqahnya
create policy "guru_all_kbm_log" on public.kbm_log
  for all using (is_guru() and id_guru = current_user_id());

-- Murid: lihat sesi halaqah tempat dia terdaftar
create policy "murid_read_kbm_log" on public.kbm_log
  for select using (
    is_murid() and murid_in_halaqah(id_halaqah)
  );

-- ============================================================
--  TABEL: NILAI_KBM
-- ============================================================
create policy "admin_all_nilai_kbm" on public.nilai_kbm
  for all using (is_admin());

-- Guru: full access ke nilai murid di halaqahnya
create policy "guru_all_nilai_kbm" on public.nilai_kbm
  for all using (
    is_guru() and guru_owns_halaqah(id_halaqah)
  );

-- Murid: lihat nilai dirinya sendiri saja
create policy "murid_read_nilai_self" on public.nilai_kbm
  for select using (is_murid() and id_murid = current_user_id());

-- ============================================================
--  TABEL: TEMPLATE KOREKSI
--  Semua user bisa baca, admin bisa ubah
-- ============================================================
create policy "all_read_template" on public.template_koreksi
  for select using (auth.uid() is not null);
create policy "admin_write_template" on public.template_koreksi
  for all using (is_admin());

-- ============================================================
--  TABEL: PENGUMUMAN
-- ============================================================
create policy "admin_all_pengumuman" on public.pengumuman
  for all using (is_admin());

-- Guru: buat pengumuman + lihat pengumuman halaqahnya
create policy "guru_write_pengumuman" on public.pengumuman
  for insert with check (is_guru() and dibuat_oleh = current_user_id());

create policy "guru_read_pengumuman" on public.pengumuman
  for select using (
    is_guru() and (
      target in ('semua', 'all')
      or guru_owns_halaqah(id_halaqah)
    )
  );

-- Murid: lihat pengumuman yang ditujukan ke halaqahnya atau semua
create policy "murid_read_pengumuman" on public.pengumuman
  for select using (
    is_murid() and
    status = 'aktif' and (
      target in ('semua', 'all')
      or murid_in_halaqah(id_halaqah)
    )
  );

-- ============================================================
--  TABEL: KOMPONEN RAPORT & KONFIGURASI
-- ============================================================
create policy "all_read_komponen" on public.komponen_raport
  for select using (auth.uid() is not null);
create policy "admin_write_komponen" on public.komponen_raport
  for all using (is_admin());

create policy "all_read_konfigurasi" on public.konfigurasi_raport
  for select using (auth.uid() is not null);
create policy "admin_write_konfigurasi" on public.konfigurasi_raport
  for all using (is_admin());

-- ============================================================
--  TABEL: NILAI MANUAL
-- ============================================================
create policy "admin_all_nilai_manual" on public.nilai_manual
  for all using (is_admin());

-- Guru: input nilai untuk murid di halaqahnya
create policy "guru_all_nilai_manual" on public.nilai_manual
  for all using (
    is_guru() and guru_owns_halaqah(id_halaqah)
  );

-- Murid: lihat nilainya sendiri
create policy "murid_read_nilai_manual" on public.nilai_manual
  for select using (is_murid() and id_murid = current_user_id());

-- ============================================================
--  TABEL: CATATAN RAPORT
-- ============================================================
create policy "all_read_catatan_raport" on public.catatan_raport
  for select using (auth.uid() is not null);

-- Guru: update catatan halaqahnya
create policy "guru_write_catatan" on public.catatan_raport
  for all using (
    is_guru() and guru_owns_halaqah(id_halaqah)
  );

create policy "admin_write_catatan" on public.catatan_raport
  for all using (is_admin());

-- ============================================================
--  TABEL: RAPORT
-- ============================================================
create policy "admin_all_raport" on public.raport
  for all using (is_admin());

-- Guru: generate + publish raport halaqahnya
create policy "guru_all_raport" on public.raport
  for all using (
    is_guru() and guru_owns_halaqah(id_halaqah)
  );

-- Murid: lihat raport dirinya yang sudah published
create policy "murid_read_raport" on public.raport
  for select using (
    is_murid() and
    id_murid = current_user_id() and
    status = 'published'
  );

-- ============================================================
--  TABEL: AT-TIBYAN
-- ============================================================
create policy "admin_all_at_sesi" on public.at_tibyan_sesi
  for all using (is_admin());
create policy "guru_all_at_sesi" on public.at_tibyan_sesi
  for all using (is_guru());
create policy "murid_read_at_sesi" on public.at_tibyan_sesi
  for select using (is_murid());

create policy "admin_all_at_log" on public.at_tibyan_log
  for all using (is_admin());
create policy "guru_all_at_log" on public.at_tibyan_log
  for all using (is_guru());
create policy "murid_read_at_log_self" on public.at_tibyan_log
  for select using (is_murid() and id_murid = current_user_id());

-- ============================================================
--  TABEL: OBSERVASI KBM
--  Hanya superadmin + ketua kelas yang bersangkutan
-- ============================================================
create policy "superadmin_all_observasi" on public.observasi_kbm
  for all using (current_user_role() = 'superadmin');

-- Ketua kelas: buat dan lihat observasi dirinya
create policy "ketua_write_observasi" on public.observasi_kbm
  for insert with check (
    is_murid() and
    exists(
      select 1 from public.anggota
      where id_murid = current_user_id()
        and is_ketua = true
        and id_halaqah = observasi_kbm.id_halaqah
    )
  );

create policy "ketua_read_observasi" on public.observasi_kbm
  for select using (
    is_murid() and id_ketua = current_user_id()
  );

-- ============================================================
--  TABEL: REKAP STATUS (Ketua Kelas)
-- ============================================================
create policy "admin_all_rekap" on public.rekap_status
  for all using (is_admin());

create policy "ketua_rekap" on public.rekap_status
  for all using (
    is_murid() and id_ketua = current_user_id()
  );

-- ============================================================
--  TABEL: AUDIT LOG
--  Hanya superadmin yang bisa baca
-- ============================================================
create policy "superadmin_read_audit" on public.audit_log
  for select using (current_user_role() = 'superadmin');

-- Semua user authenticated bisa insert (untuk logging)
create policy "all_insert_audit" on public.audit_log
  for insert with check (auth.uid() is not null);

-- ============================================================
--  TABEL: SPP PEMBAYARAN
-- ============================================================
create policy "admin_all_spp" on public.spp_pembayaran
  for all using (is_admin());

-- Guru: lihat SPP murid di halaqahnya
create policy "guru_read_spp" on public.spp_pembayaran
  for select using (
    is_guru() and id_murid in (
      select a.id_murid from public.anggota a
      join public.halaqah h on h.id_halaqah = a.id_halaqah
      where h.id_guru = current_user_id()
    )
  );

-- Murid: lihat SPP dirinya sendiri
create policy "murid_read_spp_self" on public.spp_pembayaran
  for select using (is_murid() and id_murid = current_user_id());

-- Selesai! Lanjut ke 003_functions.sql
