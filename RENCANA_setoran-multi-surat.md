# Rencana: Input Setoran Hafalan Multi-Surat (Halaqah Qiyam)

**Status:** Siap eksekusi (terverifikasi ke kode) · **Tanggal:** 2026-07-24
**File utama:** `guru/kbm-module.js` (TARGET UTAMA), `guru/hafalan-module.js`, `guru/index.html`
**Keputusan terkunci:**
- **Target = blok setoran per-murid di KBM** (2026-07-24) — 99% input via KBM, bukan
  form standalone. Retarget dari rencana awal (standalone).
- Murajaah = Opsi A (vs Ziyadah tersimpan DB saja).
- Auto-split (1b) & enhance Riwayat (1c) tetap berlaku, kini di konteks KBM.

## ⚑ Keputusan Target: KBM (bukan standalone)

Alur input mid-ngajar 99% lewat sesi **KBM Qiyam**; form Hafalan standalone hanya
sesekali. Maka fitur multi-surat menyasar **blok setoran per-murid di dalam KBM**.
Konsekuensi positif: persistensi draft/ganti-device **sudah tertangani** oleh
sistem `kbm_draft` existing (localStorage debounced + server, rekonsiliasi timestamp).

### Fakta KBM Terverifikasi (double-check kode)
- **Setoran KBM = 1 surat/murid/sesi.** `_saveHafalanKbmCache`
  (`kbm-module.js:1390-1409`) menyimpan **satu objek** per `id_murid` di
  `window._hafalanKbmCache[id_murid]`. Sumber masalah multi-surat ada di sini.
- **Finalisasi saat tutup sesi.** `kbm-module.js:1945-1973`: loop murid Qiyam
  status H/T → jika `cache.jenis && !cache._saved` → `addSetoranHafalan(id_kbm…)`
  sekali → set `cache._saved`. Multi-surat = cache jadi **array**, loop per item.
- **Ziyadah per murid tersedia:** `window._hfKbmZiyadah[id_murid]`
  (`:641-706`) — dipakai overlap/auto-split per murid, tanpa fetch tambahan.
- **Draft dua lapis sudah ada:** localStorage `hq_kbm_draft_<id_kbm>` +
  tabel server `kbm_draft(id_kbm PK, draft JSONB, …)` (`api-staff.js:694-717`),
  terisolasi dari `setoran_hafalan`/raport. Cache di-serialize ke draft ini
  (`kbm-module.js:1182,1227`) → array otomatis ikut ter-persist lintas device.
- **Tahsin KBM boleh tanpa surat/ayat** (coalesce NaN→1 di `addSetoranHafalan`);
  item Tahsin dalam array tetap didukung apa adanya.

## Latar Belakang / Masalah

Form setoran hafalan guru saat ini mengunci **1 setoran = 1 surat**
(`submitSetoranHafalan`, `hafalan-module.js:896`). Jika murid menyetor 2–3 surat
dalam satu sesi, guru harus mengisi & submit form berulang. Tiap submit me-reset
Nilai/Kelancaran ke default config, dan tidak ada gambaran total poin sesi.

**Data tidak perlu ubah skema** — tiap surat memang sudah 1 baris `setoran_hafalan`.
Ini murni perbaikan UX/alur di frontend.

## Solusi: Pola "Keranjang Setoran" (Staging List)

Pisahkan field jadi dua lapis:

- **Lapis sesi (sekali isi, berlaku semua surat):** Halaqah, Murid, Tanggal,
  Kamera, Catatan, Target.
- **Lapis item (per surat, bisa ditambah):** Surat, Ayat dari–sampai, Jenis
  (Ziyadah/Murajaah/Tahsin), Nilai, Kelancaran.

**Alur baru:**
1. Guru pilih surat → isi ayat + nilai/kelancaran + jenis → klik
   **"+ Tambah ke setoran"** (bukan langsung simpan).
2. Item masuk ke daftar kartu/chip di bawah form (bisa edit & hapus).
   Form surat ter-reset untuk surat berikutnya.
3. Preview poin **menjumlah semua item** di keranjang.
4. Tombol **"Simpan Semua (N surat)"** → kirim batch.

Alasan memilih pola keranjang (bukan render N form sekaligus): reuse penuh
autocomplete surat, `clampHafalanAyat`, dan validasi overlap yang sudah ada;
guru menambah surat on-the-fly (lebih natural daripada blok kosong berjumlah tetap).

## Fakta Terverifikasi (hasil double-check kode)

- **Jenis di form guru ini = Ziyadah / Murajaah / Tahsin** (`hafalanJenisSel`,
  `guru/index.html:4349-4352`). Ketiganya **wajib surat + ayat** di jalur ini —
  validasi `submitSetoranHafalan:918-919` tidak membedakan jenis.
- **Tahsin di jalur ini = item biasa**: butuh surat+ayat, hanya *dilewati* cek
  overlap/containment (blok `if jenis==='Ziyadah'/'Murajaah'` saja).
  ⚠️ Ini BEDA dari Tahsin di **KBM** (`hfkbm-*`) yang boleh tanpa surat/ayat dan
  pakai coalesce NaN (commit `10e58ad`, `753a30a`). KBM path **di luar cakupan**
  fitur multi-surat ini.
- **`_hafalanGuruZiyadah` murni jenis Ziyadah** — `getZiyadahMurid` sudah filter
  `.eq('jenis','Ziyadah')` dan (default) `sumber='guru'` (`api-staff.js:1494-1506`).
  Jadi interval overlap/containment hanya dibangun dari Ziyadah tersimpan milik guru.
- **Poin dihitung sistem, bukan di `addSetoranHafalan`** — payload insert tak punya
  kolom `poin` (`api-staff.js:1445-1469`). `hfUpdatePoinPreview` hanya estimasi
  klien (nilai+kelancaran+kamera+bonus subuh `getHours()<9`). Preview keranjang =
  jumlah estimasi per item (kosmetik); backend tetap otoritatif per baris.
- **Kamera = field sesi tapi menambah poin per item.** Satu nilai kamera dipakai
  semua item → sertakan di tiap item batch. Tanggal sesi → `created_at` per baris
  (`api-staff.js:1471-1472`), konsisten untuk semua item.
- **Coalesce ayat NaN→1** ada di `addSetoranHafalan` (dipakai bersama KBM). Di
  jalur guru ini ayat selalu tervalidasi terisi, jadi coalesce tak pernah aktif —
  tak perlu penanganan khusus di keranjang.

## Titik Penting (Wajib Dijaga)

1. **Overlap Ziyadah harus cek item keranjang juga, TAPI hanya item ber-jenis
   Ziyadah.** `getZiyadahIntervalsForSurat(surat)` di-augment dengan item staged
   `jenis==='Ziyadah'` & surat sama. **Jangan** masukkan item Murajaah/Tahsin ke
   interval — akan salah dianggap "sudah disetor". (Ini kekurangan draft awal.)
2. **Murajaah containment — KEPUTUSAN FINAL (2026-07-24): Opsi A.**
   Murajaah divalidasi hanya vs Ziyadah **tersimpan di DB** (`_hafalanGuruZiyadah`);
   Ziyadah yang masih di keranjang TIDAK dihitung. Sederhana, tak ada masalah
   urutan/dependensi antar item. Perilaku identik dengan sekarang.
   (Opsi B — memperhitungkan Ziyadah di keranjang — sengaja tidak dipakai;
   bisa dipertimbangkan nanti bila benar-benar diminta.)
3. **Tahsin di keranjang:** tetap wajib surat+ayat (konsisten jalur ini), tanpa
   cek overlap/containment. Tidak perlu penanganan NaN karena ayat selalu terisi.
4. **Poin preview & toast** mengikuti jumlah item: "N surat, total X poin".
5. **Reset & refresh** (Ziyadah cache, target, riwayat) dijalankan sekali
   setelah batch sukses — bukan per item.

## Rencana Bertahap

### Fase 1 — Multi-surat di blok per-murid KBM
Target: `guru/kbm-module.js` (+ markup kartu murid di `guru/index.html`).

**Perubahan model cache (inti):**
- `window._hafalanKbmCache[id_murid]`: **objek tunggal → array item** setoran
  `[{jenis,surat,juz,dari,sampai,kel,nil,kam,catatan,_saved}, …]`.
- **Target Hafalan:** 1 target per murid per sesi (bukan per setoran item). Disimpan sebagai metadata level-murid pada cache (`window._hafalanKbmTarget[id_murid]` atau wrapper `cache.target = { tgtSrt, tgtDari, tgtSmp }`).
- **Penyentuh cache yang WAJIB disesuaikan (terverifikasi):**
  - ⚠️ **`_hafKbmHasContent(o)` (`:1218`) — BUG bila tak diubah.** Ia cek
    `o.surat || o.suratD || …` (bentuk objek). Untuk array → selalu `false` →
    hydrate `_mergeFill` (`:1227`) salah timpa/pulih. Ganti jadi deteksi
    `Array.isArray(o) ? o.some(item→berisi) : …`.
  - `_saveHafalanKbmCache` (`:1390`): kumpulkan **array** dari UI daftar item
    (bukan satu set field DOM).
  - `_restoreHafalanKbmCache` (`:1413`): render **daftar** item ke UI, bukan
    mengisi satu set field. Sekaligus `updateHfKbmPoin` (`:1443`) jumlahkan
    poin dari array.
  - ⚠️ **`simpanHafalanKBM()` (`:1458-1549`) — TOUCHPOINT KELIMA.** Fungsi ini
    melakukan validasi per-murid sebelum `goToJurnal()`. Loop validasi harus meloop
    **array item setoran per murid** (cek jenis, surat, range, juz, max ayat,
    Ziyadah overlap antar-item keranjang & vs DB, Murajaah containment vs DB), serta validasi
    Target Hafalan per-murid (:1538–1547) vs Ziyadah DB + Ziyadah keranjang.
  - Finalisasi tutup-sesi (`:1950`): loop per item (lihat bawah).
- **Aman tanpa ubah (terverifikasi):** `_mergeCacheObj` (`:1167`) & `_mergeFill`
  bekerja di level map `{id_murid: value}`; nilai array tak masalah setelah
  `_hafKbmHasContent` diperbaiki. Serialisasi draft `kbm_draft` hanya JSON →
  array otomatis ter-persist.

**UI kartu murid:**
- Field surat/ayat/jenis/nilai/kelancaran existing jadi "editor item".
- Tombol **"+ Tambah surat"** per murid → validasi → push ke array murid itu →
  render daftar chip/kartu ringkas di dalam kartu murid. Item bisa hapus/edit.
- Badge jumlah surat + total ayat per murid.

**Validasi per murid (reuse logika hafalan-module):**
- Overlap Ziyadah: interval dari `_hfKbmZiyadah[id_murid]` (DB) + item **ber-jenis
  Ziyadah** yang sudah di array murid itu. JANGAN ikut Murajaah/Tahsin.
- Murajaah containment: vs `_hfKbmZiyadah[id_murid]` (DB) saja — **Opsi A**.
- Tahsin: boleh tanpa surat/ayat (perilaku KBM existing), tanpa cek overlap.

**Finalisasi (tutup sesi, `:1945-1973`):**
- Ganti `cache` objek → loop `for (item of cache) { if(item.jenis && !item._saved)
  addSetoranHafalan({…item, id_kbm}); item._saved=true }`.
- **`_saved` per item** — cegah dobel saat tutup sesi diulang.
- ⚠️ **Sinkron kamera → `nilai_kbm`**: `addSetoranHafalan` menyinkron `kamera` ke
  `nilai_kbm` per murid (`api-staff.js:1477-1486`). Dengan banyak item, tetapkan
  kamera level-murid (mis. dari item pertama / field murid) agar sinkron tak
  "last-write-wins" acak. Putuskan saat implementasi.

**Pencegahan Regresi Editability — Feature Edit KBM (`api-staff.js` & `guru/index.html`):**
- **Masalah (Temuan Kritis):** `getNilaiByKBM` (`api-staff.js:610–627`) mengambil setoran sesi tapi memakai `setoranMap[id_murid] = s` (*last-wins*) dan mengembalikan `hafalan_count`. Guard di `renderEditNilaiQiyam` (`guru/index.html:7013`) menolak edit jika `hafalan_count > 1`. Karena multi-surat membuat `hafalan_count > 1` normal, tanpa perbaikan, guru **akan terkunci dan tidak bisa mengedit nilai/setoran dari modal Edit KBM**.
- **Solusi Edit KBM:**
  1. `getNilaiByKBM` (`api-staff.js:620–627`): Kembalikan `hafalan_list: setoranListMap[r.id_murid] || []` (array semua setoran murid pada sesi tersebut), sambil mempertahankan `hafalan` (last-wins) untuk backward compatibility.
  2. `renderEditNilaiQiyam` (`guru/index.html:7000–7040`): Hapus guard `hafalan_count > 1`. Render sub-kartu per item setoran dari `n.hafalan_list` berdasar `id_setoran` (mis. `enQJenis-${h.id_setoran}`, `enQNilai-${h.id_setoran}`, dst) dengan atribut `data-en-q-setoran="${h.id_setoran}"`.
  3. `_simpanEditNilaiQiyam` (`guru/index.html:7120`): Query `querySelectorAll('#editNilaiBody [data-en-q-setoran]')` otomatis meloop dan memperbarui **seluruh baris setoran** murid tersebut tanpa hambatan.

**Verifikasi Raport Tahfidz (`guru/raport-module.js:400–487`):**
- `_rtBuildMuridRaport` meloop seluruh baris `setoran_hafalan` (`totalSetoran = setoran.length` & `totalPoin`). Multi-surat menambah baris setoran sebanding dengan surat yang disetor (perilaku akurat).
- Presensi & jumlah sesi KBM dihitung dari `nilai_kbm` (1 baris per murid per KBM log), **bukan** dari `setoran_hafalan`. Multi-surat **TIDAK menggandakan** hitungan kehadiran/sesi murid.

**Validasi tutup-sesi & poin:**
- **Qiyam TIDAK punya guard "nilai belum lengkap"** saat tutup sesi (terverifikasi:
  guard di `:1830-1845` khusus Reguler adab/kamera; Microteaching `:1847`).
  Finalize hanya menyimpan item yang `jenis`-nya terisi → tak ada guard
  objek-tunggal yang perlu diubah. (Opsional: bila ingin, tambah guard baru
  yang membaca array.)
- Preview poin per murid (`updateHfKbmPoin`) menjumlah array item ber-nilai.

**Risiko partial-fail:** loop insert per item; bila 1 gagal, item lain sudah
masuk. `_saved` per item membuat retry aman (hanya yang belum tersimpan diulang).
Fase 2 (RPC batch) menutup ini bila mengganggu.

### Fase 1-standalone (opsional, menyusul)
Bawa pola keranjang yang sama ke form Hafalan standalone
(`submitSetoranHafalan`, `_hafalanKeranjang=[]`). Prioritas rendah (~1% pakai);
di sini draft cukup localStorage.

### Fase 1b — Auto-split overlap parsial Ziyadah (di atas keranjang)

**Kasus nyata:** Ziyadah tersimpan 1–10. Pertemuan berikutnya murid membaca
8–15 — di mana **8–10 pengulangan** dan **11–15 hafalan baru**. Saat ini:
Ziyadah 8–15 ditolak (overlap 8–10); Murajaah 8–15 juga ditolak (11–15 di luar
range). Tak ada jenis tunggal yang menampung.

**Solusi (bukan melonggarkan overlap):** saat guru memasukkan **Ziyadah** yang
overlap parsial dgn Ziyadah tersimpan, tawarkan pemisahan otomatis ke jenis
yang benar, lalu masukkan sebagai 2 item keranjang:

- Bagian yang **beririsan** dgn Ziyadah tersimpan → **Murajaah** (pengulangan).
- Bagian yang **belum pernah** Ziyadah → **Ziyadah** (hafalan baru).

Contoh 1–10 existing + input Ziyadah 8–15 → **Murajaah 8–10** + **Ziyadah 11–15**.

**UI popup (spesifikasi):** ganti toast penolakan overlap (khusus jenis Ziyadah)
dengan dialog `showConfirm(msg, { html, title, okText })` — pakai opsi `html`
custom, TANPA modal baru (lebar 440px existing). Susunan isi:

1. **Header** — badge ikon `🔀` (amber), judul *"Sebagian ayat sudah pernah
   disetor"*, subjudul konteks `<Surat> · Ziyadah <aD>–<aS>`.
2. **Kalimat inti** — *"Ayat <overlap> sudah pernah menjadi Ziyadah. Pisah
   otomatis menjadi Murajaah (pengulangan) + Ziyadah (hafalan baru)?"* — angka
   overlap di-highlight.
3. **Peta Ayat** — penggaris horizontal proporsional (skala min ayat s/d max
   ayat input): band netral = ayat yang sudah Ziyadah, band **amber** = potongan
   irisan (→ Murajaah), band **emerald** = potongan sisa (→ Ziyadah baru).
   Plus legenda 3 warna. Tujuan: guru *melihat* alasan pemisahan.
4. **Daftar hasil** — kartu tiap potongan: ikon jenis + label + pill
   (PENGULANGAN / HAFALAN BARU) + range ayat. Urut sesuai ayat.
5. **Footer** — tombol utama kata-kerja jelas **"Tambahkan keduanya"**
   (`okText`), tombol **Batal** (tidak menyimpan apa pun).

**Warna:** Murajaah = amber, Ziyadah = emerald (semantik: ulang vs baru).
Selaraskan ke token portal saat implementasi bila perlu.
**Mockup referensi:** artifact `popup-ziyadah-split` (di sesi perancangan).
**Kasus banyak potongan:** judul/kalimat tetap generik ("Sebagian ayat…"),
daftar hasil menampilkan semua potongan; jika tak terpetakan → fallback tolak.

**Logika:** hitung irisan input `[aD,aS]` terhadap `getZiyadahIntervalsForSurat`
(DB, sudah ter-merge):
- Potongan irisan → item Murajaah (masing-masing sudah pasti *contained*, valid).
- Potongan sisa (gap sebelum/antara/sesudah interval) → item Ziyadah (pasti
  non-overlap, valid).
- Nilai/kelancaran/kamera diwarisi dari input form untuk semua potongan.

**Batasan aman:** untuk kasus rumit (irisan dengan banyak interval terpisah
menghasilkan >2 potongan), tetap boleh — semua potongan dimasukkan sesuai
klasifikasinya. Jika hasil ambigu / gagal dihitung, **fallback ke penolakan
lama** (tak pernah menyimpan data yang salah). Auto-split **hanya** untuk jenis
Ziyadah; Murajaah & Tahsin tak tersentuh.

**Catatan:** murni FE, tak ubah skema. Setelah split, validasi per potongan
memakai jalur yang sama (overlap Ziyadah + containment Murajaah), jadi tetap
konsisten dengan Titik Penting di atas.

### Fase 1c — Enhance tampilan Riwayat Setoran (FE-only)

**Kondisi sekarang:** `loadRiwayatHafalan` (`hafalan-module.js:1001`) & modal
`showRiwayatSetoranModal` (`:1092`) merender daftar kartu datar tanpa ringkasan
/ pengelompokan. Fungsional tapi kurang informatif; batch multi-surat (Fase 1)
akan tampil sebagai deretan kartu lepas tanpa konteks sesi.

**Enhancement (5 lapis, dari ringkas → detail):**

1. **Ringkasan (tiles):** Total setoran · Ayat Ziyadah kumulatif · Surat
   tersentuh · Setoran pekan ini.
   ⚠️ **Riwayat dipaginasi** (`getSetoranHafalanGuru` limit 15 di panel / 100 di
   modal). JANGAN agregasi dari halaman ter-load — akan salah.
   - **Total setoran** → pakai `total` (count) yang sudah dikembalikan API
     (`api-staff.js:1441`) — akurat, tanpa query tambahan.
   - **Ayat Ziyadah kumulatif & Surat tersentuh** → hitung dari `getZiyadahMurid`
     (mengembalikan SELURUH Ziyadah murid, tak dipaginasi) — bukan dari riwayat.
   - **Pekan ini** → filter `created_at` pada data; bila butuh lintas halaman,
     hitung server-side ringan atau terima cakupan halaman + label jelas.
2. **🗺️ Peta Hafalan:** progress bar cakupan ayat per surat (mis. Al-Baqarah
   15/286). Muncul saat difilter satu murid. Sumber: `getZiyadahMurid` →
   `mergeIntervals` per surat ÷ total ayat surat (`_getSuratData`). Hanya
   hitung jenis Ziyadah (jangan double-count ayat yang di-Murajaah/Tahsin).
3. **Timeline per sesi/tanggal:** kartu dikelompokkan per tanggal; header sesi
   menampilkan tag "N surat · M ayat". Batch satu sesi tampil menyatu
   (memperlihatkan hasil fitur keranjang). Grup label relatif: Hari ini /
   Kemarin / tanggal.
4. **Encoding visual:** rail kiri kartu = **jenis** (Ziyadah emerald /
   Murajaah amber / Tahsin violet); badge kotak = **nilai** (warna terpisah:
   Mumtaz indigo / Baik sky / Cukup rose) agar tak bentrok dgn warna jenis.
   Plus chip kelancaran, blok catatan, baris target — semua field existing.
5. **Filter jenis (chip):** menyaring instan di klien (toggle class), tanpa
   reload; grup sesi yang jadi kosong disembunyikan. Filter murid tetap seperti
   sekarang (`hafalanRiwayatMuridFilter`).

**Sumber data:** seluruhnya dari `getSetoranHafalanGuru` yang sudah ada
(`nilai, juz, surat, jenis, ayat_dari/sampai, nama_murid, created_at, catatan,
kelancaran, target_*`). Tidak ubah skema. Agregasi tiles & Peta Hafalan murni
di klien.
**Konsistensi:** warna/ikon jenis SAMA dgn popup Fase 1b (satu sistem visual).
**Mockup referensi:** artifact `riwayat-setoran` (di sesi perancangan).
**Terapkan di dua tempat:** panel riwayat halaman (`loadRiwayatHafalan`) dan
modal per-murid (`showRiwayatSetoranModal`) — samakan gaya.

### Fase 2 — RPC batch transaksional (opsional, saat partial-fail mengganggu)
- Buat RPC `add_setoran_hafalan_batch(items jsonb)` — insert semua dalam satu
  transaksi (all-or-nothing). CHECK ayat (`ayat_dari>=1`, `ayat_sampai NOT NULL`)
  tetap aktif per baris.
- Ganti loop FE dengan satu panggilan RPC.
- **Manual:** patch SQL dijalankan manual lokal (sesuai kebiasaan repo; patch
  gitignored).

## Estimasi & Keputusan
- **Fase 1 = multi-surat di KBM** (cache objek→array + UI kartu murid +
  finalisasi loop). Permukaan lebih besar (draft, nilai_kbm sync, tutup-sesi,
  poin) tapi draft/ganti-device sudah ditangani `kbm_draft`. FE-only.
- **Fase 1b** (auto-split overlap + popup) — di konteks kartu murid KBM,
  pakai `_hfKbmZiyadah[id_murid]`. FE-only.
- **Fase 1c** (enhance Riwayat) — FE-only, informatif; independen dari mekanisme
  simpan, bisa paralel.
- **Fase 1-standalone** — port pola ke form standalone, prioritas rendah.
- **Fase 2** (RPC batch transaksional) — bila partial-fail nyata mengganggu.
- Semua fase di atas **tanpa perubahan skema DB** (cache & draft hanya JSON).

## Checklist Uji (Fase 1 — KBM)
- [ ] 1 murid, 1 surat → tutup sesi menyimpan 1 baris (sama perilaku lama).
- [ ] 1 murid, 3 surat → tutup sesi menyimpan 3 baris; poin & riwayat benar.
- [ ] Beberapa murid masing-masing multi-surat → semua tersimpan benar per murid.
- [ ] Tutup sesi diulang → `_saved` per item cegah dobel insert.
- [ ] Refresh/ganti device saat kartu terisi → draft `kbm_draft` pulih (array utuh).
- [ ] Kamera tersinkron ke `nilai_kbm` konsisten (bukan last-write acak).
- [ ] `simpanHafalanKBM()` memvalidasi seluruh item di array murid sebelum `goToJurnal()`.
- [ ] `simpanHafalanKBM()` menolak bila ada overlap antar-item Ziyadah pada murid yang sama dalam satu sesi.
- [ ] Target Hafalan per-murid tervalidasi benar vs Ziyadah DB + Ziyadah keranjang pada `simpanHafalanKBM()`.
- [ ] Edit KBM: `getNilaiByKBM` mengembalikan `hafalan_list` tanpa membuang setoran sebelumnya.
- [ ] Edit KBM: `renderEditNilaiQiyam` merender N sub-kartu setoran per murid tanpa terkunci guard `hafalan_count > 1`.
- [ ] Edit KBM: `_simpanEditNilaiQiyam` memperbarui seluruh baris setoran murid dengan sukses.
- [ ] Regresi: Tahsin di jalur **KBM** (`hfkbm-*`) tidak tersentuh perubahan ini.

### Checklist Uji (Fase 1b — auto-split)
- [ ] Existing Ziyadah 1–10, input Ziyadah 8–15 → tawaran split → hasil
      Murajaah 8–10 + Ziyadah 11–15 di keranjang; setelah simpan, poin & riwayat benar.
- [ ] Input Ziyadah full-overlap (mis. 3–7 di dalam 1–10) → tawaran jadi Murajaah
      3–7 saja (tanpa item Ziyadah).
- [ ] Input Ziyadah non-overlap (mis. 11–15) → langsung masuk, tanpa dialog split.
- [ ] Klik "Batal" pada dialog split → tak ada item ditambahkan (perilaku aman).
- [ ] Auto-split tidak aktif untuk jenis Murajaah/Tahsin.

### Checklist Uji (Fase 1c — riwayat)
- [ ] Tiles ringkasan sesuai data (total, ayat Ziyadah kumulatif, surat, pekan ini).
- [ ] Peta Hafalan: cakupan = interval Ziyadah ter-merge ÷ total ayat surat; tak
      double-count ayat yang di-Murajaah.
- [ ] Batch satu sesi (mis. hari ini) tampil dalam satu grup dengan tag "N surat".
- [ ] Filter jenis menyaring instan; grup sesi kosong tersembunyi; filter murid tetap jalan.
- [ ] Rail jenis & badge nilai konsisten; kelancaran/catatan/target tampil bila ada.
- [ ] Tombol hapus tetap berfungsi (delete + refresh + sinkron Ziyadah cache).
- [ ] Diterapkan konsisten di panel halaman & modal per-murid.
