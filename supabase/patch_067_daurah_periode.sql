-- ============================================================
--  PATCH 067 -- Membuat Periode Daurah Al-Fatihah Juli 2026
--
--  Konteks: User meminta agar tanggal aktif daurah diset dari
--  tanggal 11-18 Juli 2026.
--
--  Solusi:
--  Membuat/memperbarui data periode khusus Daurah Juli 2026
--  dengan rentang tanggal tersebut dan status 'aktif'.
--
--  Jalankan via Supabase SQL Editor.
-- ============================================================

insert into public.periode (id_periode, nama_periode, tanggal_mulai, tanggal_selesai, deskripsi, status)
values (
  'P-DAURAH-JULI-2026', 
  'Daurah Al-Fatihah Juli 2026', 
  '2026-07-11', 
  '2026-07-18', 
  'Periode Daurah Tahsin Al-Fatihah 11-18 Juli 2026', 
  'aktif'
)
on conflict (id_periode) 
do update set 
  nama_periode = excluded.nama_periode,
  tanggal_mulai = excluded.tanggal_mulai,
  tanggal_selesai = excluded.tanggal_selesai,
  deskripsi = excluded.deskripsi,
  status = excluded.status;
