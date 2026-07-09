-- ============================================================
--  PATCH 066 -- Sinkronisasi & Auto-update nama_guru di halaqah
--
--  Konteks: Saat membuat atau mengedit halaqah lewat portal admin,
--  hanya id_guru yang dikirim. Kolom denormalisasi halaqah.nama_guru
--  menjadi NULL sehingga kolom GURU di Manajemen Halaqah kosong.
--
--  Solusi:
--  1. Backfill nama_guru untuk data lama yang kosong.
--  2. Buat trigger BEFORE INSERT OR UPDATE pada tabel halaqah untuk
--     otomatis mengisi nama_guru dari tabel users.
--  3. Buat trigger AFTER UPDATE pada tabel users agar ketika nama guru
--     diubah, nama_guru di halaqah ikut ter-update.
--
--  Jalankan via Supabase SQL Editor.
-- ============================================================

-- 1. BACKFILL DATA LAMA YANG KOSONG
update public.halaqah h
set    nama_guru = u.nama_lengkap
from   public.users u
where  h.id_guru = u.id_user
  and  (h.nama_guru is null or h.nama_guru = '');

-- 2. TRIGGER PADA TABEL halaqah (SINKRONISASI SAAT INSERT/UPDATE GURU)
create or replace function public.sync_halaqah_nama_guru()
returns trigger language plpgsql security definer as $$
begin
  if new.id_guru is not null then
    new.nama_guru := (select nama_lengkap from public.users where id_user = new.id_guru);
  else
    new.nama_guru := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_halaqah_nama_guru on public.halaqah;
create trigger trg_sync_halaqah_nama_guru
  before insert or update of id_guru on public.halaqah
  for each row execute function public.sync_halaqah_nama_guru();

-- 3. TRIGGER PADA TABEL users (PROPAGASI PERUBAHAN NAMA GURU)
create or replace function public.sync_users_nama_guru_to_halaqah()
returns trigger language plpgsql security definer as $$
begin
  if old.nama_lengkap is distinct from new.nama_lengkap and new.role = 'guru' then
    update public.halaqah
    set    nama_guru = new.nama_lengkap
    where  id_guru = new.id_user;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_users_nama_guru_to_halaqah on public.users;
create trigger trg_sync_users_nama_guru_to_halaqah
  after update of nama_lengkap on public.users
  for each row execute function public.sync_users_nama_guru_to_halaqah();
