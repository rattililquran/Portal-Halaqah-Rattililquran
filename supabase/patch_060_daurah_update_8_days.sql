-- Patch 060: Perubahan Durasi Daurah Tahsin Al-Fatihah menjadi 8 Hari
UPDATE public.level 
SET 
  jumlah_pertemuan = 8,
  deskripsi = 'Program akselerasi perbaikan bacaan Surah Al-Fatihah (8 Sesi)'
WHERE id_level = 'tahsin-alfatihah' OR nama_level = 'Tahsin Al-Fatihah';
