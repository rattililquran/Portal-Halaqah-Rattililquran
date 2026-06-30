-- Migration 023: Tambah Level Tahsin Al-Fatihah (8 Pertemuan) dan Indikator Penilaian
BEGIN;

-- 1. Tambah level baru ke public.level
-- Kunci: jumlah_pertemuan = 8 agar pembagi progres donat murid bernilai 8.
INSERT INTO public.level (id_level, nama_level, deskripsi, urutan, jumlah_pertemuan, status)
VALUES (
  'tahsin-alfatihah', 
  'Tahsin Al-Fatihah', 
  'Program akselerasi perbaikan bacaan Surah Al-Fatihah (8 Sesi)', 
  10, 
  8, 
  'aktif'
)
ON CONFLICT (id_level) 
DO UPDATE SET 
  nama_level = EXCLUDED.nama_level,
  jumlah_pertemuan = EXCLUDED.jumlah_pertemuan,
  status = EXCLUDED.status;

-- 2. Bersihkan item evaluasi lama jika ada untuk idempotensi
DELETE FROM public.assessment_items 
WHERE level = 'Tahsin Al-Fatihah';

-- 3. Masukkan indikator penilaian baru dengan id_item statis
INSERT INTO public.assessment_items (id_item, level, kategori, teks_latin, teks_arab, keterangan, urutan, status)
VALUES 
('f5637213-911e-4cb8-8c1b-252f84b6f101', 'Tahsin Al-Fatihah', 'Tahsin', 'Makhraj Hamzah vs A''in', 'أ / ع', 'Membedakan makhraj halqiyah Hamzah dan A''in pada kalimat A''udzubillah', 1, 'aktif'),
('f5637213-911e-4cb8-8c1b-252f84b6f102', 'Tahsin Al-Fatihah', 'Tahsin', 'Sifat Huruf Ha Tipis vs Ha Tebal', 'ح / ه', 'Merapikan pengucapan Ha (bersih mengalir) pada Alhamdulillah dan Ha (dalam) pada Bismillah', 2, 'aktif'),
('f5637213-911e-4cb8-8c1b-252f84b6f103', 'Tahsin Al-Fatihah', 'Tahsin', 'Penekanan Tasydid (Nabr)', 'النبر pada إِيَّاكَ', 'Ketepatan menghentak tasydid Ya pada Iyyaka Na''budu tanpa menahannya terlalu lama', 3, 'aktif'),
('f5637213-911e-4cb8-8c1b-252f84b6f104', 'Tahsin Al-Fatihah', 'Tahsin', 'Makhraj Shad & Tha', 'ص / ط', 'Mengucapkan huruf Shad (tebal berdesis) dan Tha (tebal tertutup) pada kata Shirathal', 4, 'aktif'),
('f5637213-911e-4cb8-8c1b-252f84b6f105', 'Tahsin Al-Fatihah', 'Tahsin', 'Idzhar Halqi dan Mim Sukun', 'إظهار', 'Kejelasan pengucapan Nun mati dan Mim mati pada lafaz An''amta Alaihim tanpa dengung/pantulan', 5, 'aktif'),
('f5637213-911e-4cb8-8c1b-252f84b6f106', 'Tahsin Al-Fatihah', 'Tahsin', 'Makhraj & Sifat Dhad', 'ض', 'Ketepatan mengucapkan Dhad sukun pada Al-Maghdlubi dan Dhad tasydid pada Adh-Dhaallin', 6, 'aktif'),
('f5637213-911e-4cb8-8c1b-252f84b6f107', 'Tahsin Al-Fatihah', 'Tahsin', 'Mad Lazim Kilmi Muthaqqal', 'المد اللازم', 'Konsistensi panjang 6 harakat pada kata Adh-Dhaallin sebelum masuk ke tasydid Lam', 7, 'aktif');

COMMIT;
