-- Patch 059: Tambahkan kolom status_guru untuk verifikasi/penilaian guru pada self-assessment
alter table public.assessment_murid
  add column if not exists status_guru text check (status_guru in ('paham', 'ragu', 'belum'));

-- Longgarkan status (penilaian mandid murid) agar boleh null jika dinilai guru duluan
alter table public.assessment_murid
  alter column status drop not null;

-- Kebijakan RLS agar Guru dapat menginput (INSERT) dan memperbarui (UPDATE) nilai verifikasi
drop policy if exists "guru_update_asmt_murid" on public.assessment_murid;
create policy "guru_update_asmt_murid" on public.assessment_murid
  for update
  using (
    is_guru() and id_murid in (
      select a.id_murid from public.anggota a
      join public.halaqah h on h.id_halaqah = a.id_halaqah
      where h.id_guru = current_user_id() and a.status = 'aktif'
    )
  );

drop policy if exists "guru_insert_asmt_murid" on public.assessment_murid;
create policy "guru_insert_asmt_murid" on public.assessment_murid
  for insert
  with check (
    is_guru() and id_murid in (
      select a.id_murid from public.anggota a
      join public.halaqah h on h.id_halaqah = a.id_halaqah
      where h.id_guru = current_user_id() and a.status = 'aktif'
    )
  );
