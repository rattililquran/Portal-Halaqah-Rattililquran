-- ============================================================
--  patch_063_soal_level.sql
--  Rattililqur'an Portal — Fitur Kategori Level & Rekomendasi Pertemuan
-- ============================================================

-- 1. Tambah kolom levels array dan rekomendasi_pertemuan_ke ke tabel public.soal
ALTER TABLE public.soal 
ADD COLUMN IF NOT EXISTS levels TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS rekomendasi_pertemuan_ke INTEGER DEFAULT NULL;

-- 2. Buat index GIN pada kolom levels untuk optimasi pencarian array
CREATE INDEX IF NOT EXISTS idx_soal_levels ON public.soal USING GIN(levels);

-- 3. Berikan pesan sukses
DO $$
BEGIN
  RAISE NOTICE '✅ patch_063_soal_level.sql — Database columns for levels and rekomendasi_pertemuan_ke have been successfully added!';
END $$;
