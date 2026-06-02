-- ============================================================
--  002_seed_superadmin.sql
--  Tambah akun superadmin
--  Password: superadmin123
--  Jalankan di SQL Editor setelah 001_seed_master.sql
-- ============================================================

insert into public.users (id_user, nama_lengkap, role, no_hp, email, status, password_hash, catatan)
values (
  'SUPERADMIN-001',
  'Super Administrator',
  'superadmin',
  '081111111112',
  'superadmin@rattililquran.id',
  'aktif',
  crypt('superadmin123', gen_salt('bf')),
  'Akun superadmin — akses penuh termasuk Observasi Guru dan Audit Log'
)
on conflict (id_user) do update
  set role          = 'superadmin',
      password_hash = crypt('superadmin123', gen_salt('bf')),
      updated_at    = now();

-- Verifikasi
select id_user, nama_lengkap, role, status from public.users where role in ('admin','superadmin') order by role;
