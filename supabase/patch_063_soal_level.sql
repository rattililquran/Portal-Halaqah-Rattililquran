-- ============================================================
--  patch_063_soal_level.sql
--  Rattililqur'an Portal — Fitur Kategori Level & Rekomendasi Pertemuan
-- ============================================================

-- 1. Tambah kolom levels array dan rekomendasi_pertemuan_ke ke tabel public.soal
ALTER TABLE public.soal 
ADD COLUMN IF NOT EXISTS levels TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS rekomendasi_pertemuan_ke INTEGER DEFAULT NULL;

-- 2. Backfill data lama/dummy agar masuk ke Level 1 dan setelah pertemuan 23
UPDATE public.soal 
SET levels = ARRAY['Level 1'], 
    rekomendasi_pertemuan_ke = 23 
WHERE levels IS NULL OR levels = '{}' OR rekomendasi_pertemuan_ke IS NULL;

-- 3. Buat index GIN pada kolom levels untuk optimasi pencarian array
CREATE INDEX IF NOT EXISTS idx_soal_levels ON public.soal USING GIN(levels);

-- 4. Berikan pesan sukses
DO $$
BEGIN
  RAISE NOTICE '✅ patch_063_soal_level.sql — Database columns and backfill for existing questions completed successfully!';
END $$;
