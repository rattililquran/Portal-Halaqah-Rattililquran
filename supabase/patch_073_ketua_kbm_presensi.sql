-- ============================================================
--  PATCH 073 — RPC: Presensi KBM untuk Ketua Kelas
--
--  MASALAH:
--  Kolom `nama_murid` di tabel `anggota` bisa NULL untuk sebagian
--  murid (karena backfill patch_041 hanya sekali jalan dan trigger
--  tidak selalu meng-update). Ketua kelas juga tidak bisa membaca
--  tabel `users` untuk murid lain (RLS). Akibatnya, daftar
--  kehadiran di Rekap Sesi hanya menampilkan NIS, bukan nama.
--
--  PERBAIKAN:
--  Fungsi SECURITY DEFINER yang mengembalikan id_murid,
--  status_hadir, dan nama_lengkap (dari tabel users) untuk
--  sebuah sesi KBM — HANYA jika KBM tersebut milik halaqah
--  yang dipimpin oleh ketua pemanggil.
-- ============================================================

create or replace function public.ketua_get_kbm_presensi(p_id_kbm text)
returns table(id_murid text, status_hadir text, nama_murid text)
language sql stable security definer as $$
  select n.id_murid, n.status_hadir, u.nama_lengkap as nama_murid
  from public.nilai_kbm n
  join public.users u on u.id_user = n.id_murid
  join public.kbm_log k on k.id_kbm = n.id_kbm
  where n.id_kbm = p_id_kbm
    and k.id_halaqah = public.current_user_ketua_halaqah()
    and public.is_murid()
    and public.current_user_ketua_halaqah() is not null
  order by u.nama_lengkap;
$$;

revoke all on function public.ketua_get_kbm_presensi(text) from public, anon;
grant execute on function public.ketua_get_kbm_presensi(text) to authenticated;
