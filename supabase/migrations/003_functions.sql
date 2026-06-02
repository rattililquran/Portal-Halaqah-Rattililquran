-- ============================================================
--  003_functions.sql
--  Helper PostgreSQL functions untuk Edge Functions
--  Jalankan di SQL Editor setelah 001 dan 002
-- ============================================================

-- ─────────────────────────────────────────────
--  verify_user_password
--  Dipanggil oleh Edge Function login
--  Verifikasi id_user + password sekaligus di DB
--  Return: row users jika valid, kosong jika salah
-- ─────────────────────────────────────────────
create or replace function public.verify_user_password(
  p_id_user  text,
  p_password text
)
returns table (
  id_user      text,
  nama_lengkap text,
  role         text,
  status       text
)
language sql
security definer   -- jalankan sebagai owner, bukan caller
stable
as $$
  select
    id_user,
    nama_lengkap,
    role::text,
    status::text
  from public.users
  where
    id_user       = upper(trim(p_id_user))
    and password_hash = crypt(p_password, password_hash)
    and status    = 'aktif'
  limit 1;
$$;

-- ─────────────────────────────────────────────
--  get_keaktifan_alerts (dipanggil GuruAPI.getKeaktifanAlerts)
--  Hitung murid kritis/peringatan per halaqah guru
-- ─────────────────────────────────────────────
create or replace function public.get_keaktifan_alerts(p_id_guru text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  with halaqah_guru as (
    select id_halaqah from public.halaqah
    where id_guru = p_id_guru and status = 'aktif'
  ),
  murid_stats as (
    select
      a.id_murid,
      a.nama_murid,
      a.id_halaqah,
      count(*) filter (where n.status_hadir = 'A') as alpa,
      count(*) filter (where n.status_hadir = 'T') as terlambat,
      count(*) filter (where n.kamera_murid ilike '%selalu%' or n.kamera_murid ilike '%sering%') as kamera_buruk,
      count(*) as total_sesi
    from public.anggota a
    join halaqah_guru h on h.id_halaqah = a.id_halaqah
    left join public.nilai_kbm n on n.id_murid = a.id_murid and n.id_halaqah = a.id_halaqah
    where a.status = 'aktif'
    group by a.id_murid, a.nama_murid, a.id_halaqah
  ),
  classified as (
    select *,
      case
        when alpa >= 2 then 'kritis'
        when alpa = 1 or terlambat >= 2 or kamera_buruk >= 2 then 'peringatan'
        else 'normal'
      end as status_keaktifan
    from murid_stats
  )
  select jsonb_build_object(
    'alerts', coalesce(jsonb_agg(
      jsonb_build_object(
        'id_murid',   id_murid,
        'nama',       nama_murid,
        'id_halaqah', id_halaqah,
        'status',     status_keaktifan,
        'alpa',       alpa,
        'terlambat',  terlambat,
        'total_sesi', total_sesi
      ) order by status_keaktifan, alpa desc
    ) filter (where status_keaktifan != 'normal'), '[]'::jsonb),
    'summary', jsonb_build_object(
      'kritis',     count(*) filter (where status_keaktifan = 'kritis'),
      'peringatan', count(*) filter (where status_keaktifan = 'peringatan'),
      'normal',     count(*) filter (where status_keaktifan = 'normal')
    )
  ) into v_result
  from classified;

  return v_result;
end;
$$;

-- ─────────────────────────────────────────────
--  set_user_password
--  Dipanggil oleh Edge Function reset-password
--  Update password_hash dengan bcrypt baru
-- ─────────────────────────────────────────────
create or replace function public.set_user_password(
  p_id_user  text,
  p_password text
)
returns void
language sql
security definer
as $$
  update public.users
  set password_hash = crypt(p_password, gen_salt('bf'))
  where id_user = upper(trim(p_id_user));
$$;

-- Test verify_user_password (password guru = 654321)
-- Harusnya return 1 row:
-- select * from public.verify_user_password('NISA', '654321');
