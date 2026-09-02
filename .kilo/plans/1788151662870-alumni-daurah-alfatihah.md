# Plan: Mekanisme Alumni Murid (Semua Level & Sesi)

## Konteks & Masalah

Tabel `users` hanya punya `status enum('aktif','nonaktif')`. Tidak ada cara membedakan murid aktif vs alumni, sehingga hitungan murid di portal mencapai 444+ padahal yang aktif jauh lebih sedikit. Tidak ada mekanisme wisuda bulk — admin harus nonaktifkan satu per satu.

## Keputusan Desain

| Keputusan | Pilihan |
|---|---|
| Siapa yang diwisuda | Admin menentukan sendiri — tidak ada aturan otomatis |
| Scope wisuda | Semua level dan semua halaqah |
| Status login alumni | Tetap `status='aktif'` — alumni masih bisa login dan lihat riwayat belajar |
| Penanda alumni | Kolom baru `tipe_murid text NOT NULL DEFAULT 'reguler' CHECK (tipe_murid IN ('reguler','alumni'))` di `users` |
| Tanggal wisuda | Kolom baru `tgl_lulus date` (nullable) di `users` |
| Mekanisme bulk | Tombol "Wisuda Semua" per baris halaqah di tabel Halaqah — berlaku semua level |
| Hitungan murid aktif | Filter `tipe_murid = 'reguler'` di UI — alumni tidak dihitung |
| Audit trail | `_logAudit('wisuda_halaqah_bulk', {...})` dari JS setelah RPC berhasil |
| Alumni di dropdown tambah anggota | Disembunyikan — harus diubah ke `'reguler'` dulu via modal edit user |

## Temuan Teknis dari Kode

- **Admin portal** memuat `api-staff.js` (`index.html:4319`) — bukan `supabase-client.js`. Hanya `api-staff.js` yang perlu diubah.
- **`_logAudit`** ada di `supabase-core.js:166`, memanggil RPC `log_audit_action` — audit dilakukan dari JS, **bukan** dari dalam SQL function.
- **Pola RPC** yang dipakai di repo: `SECURITY DEFINER` + `revoke all from public, anon` + `grant execute to authenticated` (lihat `patch_043`, `patch_085`). Validasi role dilakukan di JS sebelum memanggil RPC.
- **`openModalAnggota`** ada di `index.html:5336-5342` — filter murid di baris 5338. Ini satu-satunya tempat di codebase yang memfilter murid untuk dropdown tambah anggota.
- **Modal edit user** ada di `index.html:3930-3966`. Field yang ada: `usrNama`, `usrRole`, `usrHp`, `usrEmail`, `usrAlamat`, `usrStatus` (baris 3956), `usrCatatan` (baris 3958), `usrIsBendahara`. Field `tipe_murid` belum ada — ditambah di antara `usrStatus` dan `usrCatatan`.
- **`editUser`** di `murid-module.js:319` membaca field dari `allUsers` dan mengisi modal — perlu tambah baris untuk `usrTipeMurid`.
- **`saveUser`** di `murid-module.js:342` membangun objek `data` — perlu tambah `tipe_murid`. Aman dikirim saat create juga karena kolom punya `DEFAULT 'reguler'`.
- **`filterUsersTable`** di `murid-module.js` memanggil `renderUsersTable(currentUserTab)` — filter baru cukup ditambah di `renderUsersTable`.
- **`userCountBadge`** (`murid-module.js:262-263`) menampilkan `filtered.length + ' dari ' + total`. Variabel `total` dihitung tanpa filter `tipe_murid` — setelah patch, `total` akan tetap mencakup alumni. Ini **by design**: badge menunjukkan "X dari Y pengguna" di mana Y adalah total role, bukan hanya yang reguler. Tidak ada perubahan diperlukan di sini.
- **`_abgIhsanData`** (`index.html:6213`) menggunakan `data.murid_by_halaqah` dari server (`_abgData`), bukan `allUsers` — perhitungan ihsan guru tidak terpengaruh oleh kolom `tipe_murid` baru. Tidak ada regresi di sini.
- **Dropdown filter** `userTipeMuridFilter` harus disisipkan setelah penutup `</select>` baris 1593 dan sebelum `<span id="userCountBadge">` baris 1597 — posisi ini konsisten dengan layout filter bar yang ada.

---

## Task List

### Task 1 — `supabase/patch_100_alumni.sql` (FILE BARU)

```sql
-- ============================================================
--  PATCH 100 — Mekanisme Alumni Murid
--
--  Tambah kolom tipe_murid & tgl_lulus ke tabel users.
--  Buat RPC bulk_wisuda_halaqah untuk wisuda bulk per halaqah.
--  Pola: identik dengan hard_delete_murid (patch_043).
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tipe_murid text NOT NULL DEFAULT 'reguler'
    CHECK (tipe_murid IN ('reguler', 'alumni'));

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tgl_lulus date;

create or replace function public.bulk_wisuda_halaqah(p_id_halaqah text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jumlah integer;
begin
  update public.users
  set tipe_murid = 'alumni',
      tgl_lulus  = current_date
  where role = 'murid'
    and id_user in (
      select id_murid from public.anggota
      where id_halaqah = p_id_halaqah
    );

  get diagnostics v_jumlah = row_count;
  return v_jumlah;
end;
$$;

revoke all on function public.bulk_wisuda_halaqah(text) from public, anon;
grant execute on function public.bulk_wisuda_halaqah(text) to authenticated;

-- ============================================================
--  BACKLOG: Query manual untuk data historis.
--  Jalankan SELECT dulu untuk preview, lalu UPDATE jika yakin.
--  Contoh untuk murid daurah Al-Fatihah:
--
-- SELECT COUNT(*) FROM public.users WHERE role='murid'
--   AND id_user IN (
--     SELECT DISTINCT a.id_murid FROM public.anggota a
--     JOIN public.halaqah h ON h.id_halaqah=a.id_halaqah
--     WHERE h.level='Tahsin Al-Fatihah'
--   );
--
-- UPDATE public.users SET tipe_murid='alumni', tgl_lulus=CURRENT_DATE
-- WHERE role='murid'
--   AND id_user IN (
--     SELECT DISTINCT a.id_murid FROM public.anggota a
--     JOIN public.halaqah h ON h.id_halaqah=a.id_halaqah
--     WHERE h.level='Tahsin Al-Fatihah'
--   );
-- ============================================================
```

**Validasi:**
```sql
SELECT column_name, column_default FROM information_schema.columns
WHERE table_name='users' AND column_name IN ('tipe_murid','tgl_lulus');
-- Harus return 2 baris

SELECT proname FROM pg_proc WHERE proname='bulk_wisuda_halaqah';
-- Harus return 1 baris
```

---

### Task 2 — `supabase/api-staff.js` (EDIT)

Tambah fungsi `bulkWisudaHalaqah` setelah `deleteUser` di baris 3718. Panggil `_logAudit` setelah RPC berhasil, persis pola `hardDeleteMurid` (baris 3724):

```js
bulkWisudaHalaqah: async function(id_halaqah, nama_halaqah) {
  var { data, error } = await _sb.rpc('bulk_wisuda_halaqah', {
    p_id_halaqah: id_halaqah
  });
  _check(error, 'bulkWisudaHalaqah');
  _logAudit('wisuda_halaqah_bulk', { id_halaqah: id_halaqah, nama_halaqah: nama_halaqah, jumlah: data });
  return { status: 'ok', jumlah: data };
},
```

---

### Task 3 — `admin/murid-module.js` (EDIT)

**3a. Tambah tombol di `renderHalaqahTable` (baris ~862, di dalam blok `'<td style="display:flex;gap:5px">'`):**

Tambahkan setelah tombol edit dan sebelum tombol hapus, hanya untuk role `admin`/`superadmin`:

```js
+ ((currentUser && (currentUser.role==='admin'||currentUser.role==='superadmin'))
    ? ' <button class="btn btn-sm"'
      + ' style="background:rgba(5,150,105,.12);color:#065f46;border:1px solid rgba(5,150,105,.3);font-size:10.5px;padding:3px 8px"'
      + ' onclick="wisudaSemuaHalaqah(\'' + esc(h.id_halaqah) + '\',\'' + escJs(h.nama_halaqah) + '\',' + (h.total_murid||0) + ')"'
      + ' title="Jadikan semua anggota alumni">Wisuda</button>'
    : '')
```

**3b. Tambah fungsi `wisudaSemuaHalaqah`** (letakkan di dekat `hapusHalaqah`):

```js
async function wisudaSemuaHalaqah(id_halaqah, nama_halaqah, total_murid) {
  if (!confirm(
    'Wisuda semua murid dari halaqah "' + nama_halaqah + '"?\n\n'
    + '(' + total_murid + ' murid akan ditandai sebagai alumni)\n\n'
    + 'Yang terjadi:\n'
    + '- Murid masih bisa login dan lihat riwayat belajar\n'
    + '- Murid tidak dihitung sebagai murid aktif\n'
    + '- Murid tidak muncul di dropdown tambah anggota halaqah baru\n'
    + '- Berlaku GLOBAL jika murid terdaftar di halaqah lain\n\n'
    + 'Bisa dibalik: edit data murid, ubah tipe kembali ke Reguler.\n\nLanjutkan?'
  )) return;
  showLoad('Mewisuda murid...');
  try {
    var r = await window.HQ.AdminAPI.bulkWisudaHalaqah(id_halaqah, nama_halaqah);
    toast(r.jumlah + ' murid diwisuda dari "' + nama_halaqah + '"', 'ok');
    await loadMasterData();
    renderHalaqahTable();
  } catch(e) { toast(friendlyError(e), 'err'); }
  finally { hideLoad(); }
}
```

**3c. Tambah pembacaan filter `tipe_murid` di `renderUsersTable` (baris 179):**

Tambah baris baru setelah deklarasi `halaqahF`:
```js
var tipeMuridF = document.getElementById('userTipeMuridFilter')
  ? document.getElementById('userTipeMuridFilter').value : '';
```

Tambah kondisi filter di blok filter (baris ~194, setelah `if (statusF ...)`):
```js
if (tipeMuridF && (u.tipe_murid||'reguler') !== tipeMuridF) return false;
```

**3d. Tambah badge alumni di baris render murid** — di kolom status (di dekat baris 234 mana `btnDel` dibangun), tampilkan badge jika `tipe_murid === 'alumni'`:

Di dalam `tbody.innerHTML = filtered.map(function(u) { ... })`, di sel status murid tambahkan:
```js
+ ((u.tipe_murid||'reguler')==='alumni'
    ? ' <span class="badge" style="background:#d1fae5;color:#065f46;font-size:10px">Alumni</span>'
    : '')
```

**3e. Tambah reset filter di `switchUserTab` (baris 124):**
```js
var tipeMuridEl = document.getElementById('userTipeMuridFilter');
if (tipeMuridEl) tipeMuridEl.value = '';
```

**3f. Tambah `tipe_murid` ke `saveUser` (baris ~353, dalam objek `data`):**
```js
tipe_murid  : document.getElementById('usrTipeMurid') ? document.getElementById('usrTipeMurid').value : 'reguler',
```

**3g. Tambah `tipe_murid` ke `editUser` (baris ~329, setelah `usrStatus`):**
```js
if (document.getElementById('usrTipeMurid'))
  document.getElementById('usrTipeMurid').value = u.tipe_murid || 'reguler';
```

**3h. Export ke `window` (blok export akhir ~baris 1002):**
```js
window.wisudaSemuaHalaqah = wisudaSemuaHalaqah;
```

---

### Task 4 — `admin/index.html` (EDIT)

**4a. Tambah dropdown `userTipeMuridFilter` di filter bar tab murid (setelah baris 1592):**

```html
<select class="fc" id="userTipeMuridFilter" onchange="filterUsersTable()" style="max-width:160px">
  <option value="">— Semua Tipe —</option>
  <option value="reguler">Aktif (Reguler)</option>
  <option value="alumni">Alumni</option>
</select>
```

**4b. Tambah field `usrTipeMurid` di modal user (setelah baris 3957, setelah `</div>` penutup field Status):**

```html
<div class="fg" id="usrTipeMuridWrap">
  <label>Tipe Murid</label>
  <select class="fc" id="usrTipeMurid">
    <option value="reguler">Reguler (Aktif)</option>
    <option value="alumni">Alumni</option>
  </select>
</div>
```

> Catatan: field ini hanya bermakna untuk role `murid`. Tidak perlu disembunyikan untuk role lain — jika admin menyimpan `tipe_murid` untuk user non-murid, kolom tetap tersimpan tapi tidak berpengaruh karena semua filter sudah dicek dengan `u.role==='murid'`.

**4c. Fix filter dropdown tambah anggota di `openModalAnggota` (baris 5338):**

Ubah dari:
```js
const muridList = allUsers.filter(u=>u.role==='murid'&&u.status==='aktif');
```
Menjadi:
```js
const muridList = allUsers.filter(u=>u.role==='murid'&&u.status==='aktif'&&(u.tipe_murid||'reguler')==='reguler');
```

---

### Task 5 — Wisuda Satu Murid dari Tabel Anggota

**Lokasi:** `index.html:5310-5329` (fungsi `renderAnggotaTable`, blok tombol aksi tiap baris)

**Tidak butuh RPC baru** — cukup gunakan `updateUser` yang sudah ada di `api-staff.js:3717`.

**5a. Tambah tombol "Wisuda" / "Aktifkan" per baris di `renderAnggotaTable` (`index.html:5324-5328`):**

`renderAnggotaTable` menggunakan **template literal** (backtick). Data baris `a` berasal dari tabel `anggota` yang tidak memiliki `tipe_murid` — kolom itu ada di tabel `users`. Untuk membaca `tipe_murid`, gunakan `allUsers.find(u=>u.id_user===a.id_murid)` yang sudah tersedia sebagai variabel global.

Pola yang ada: tombol superadmin `toggleKetua` diletakkan antara tombol `↪️ Pindah` (baris 5324) dan tombol `🗑` Hapus (baris 5328) dengan ternary expression. Tombol Wisuda/Aktifkan disisipkan di antara tombol Ketua dan tombol Hapus, mengikuti pola yang sama:

```js
${(currentUser && (currentUser.role==='admin'||currentUser.role==='superadmin'))
  ? (((allUsers||[]).find(u=>u.id_user===a.id_murid)||{}).tipe_murid||'reguler')==='alumni'
    ? `<button class="btn btn-sm" style="background:rgba(234,179,8,.12);color:#854d0e;border:1px solid rgba(234,179,8,.3);font-size:10.5px;padding:3px 8px"
        onclick="toggleWisudaMurid('${esc(a.id_murid)}','${escJs(a.nama_murid)}','reguler')"
        title="Aktifkan kembali sebagai murid reguler">Aktifkan</button>`
    : `<button class="btn btn-sm" style="background:rgba(5,150,105,.12);color:#065f46;border:1px solid rgba(5,150,105,.3);font-size:10.5px;padding:3px 8px"
        onclick="toggleWisudaMurid('${esc(a.id_murid)}','${escJs(a.nama_murid)}','alumni')"
        title="Jadikan alumni">Wisuda</button>`
  : ''}
```

Sisipkan setelah baris 5327 (penutup ternary `toggleKetua`) dan sebelum baris 5328 (tombol `🗑`).

> `colspan="8"` di baris 5330 tidak berubah — tombol baru masuk ke dalam `<td>` aksi yang sudah ada, bukan kolom baru.

**5b. Tambah fungsi `toggleWisudaMurid` di `index.html` (di area script, dekat `hapusAnggota`):**

```js
async function toggleWisudaMurid(id_murid, nama_murid, tipe_baru) {
  if (!confirm(
    (tipe_baru==='alumni'
      ? 'Wisuda "' + nama_murid + '"?\n\n'
        + '- Murid masih bisa login dan lihat riwayat belajar\n'
        + '- Tidak dihitung sebagai murid aktif\n'
        + '- Berlaku GLOBAL (semua halaqah)\n\n'
        + 'Bisa dibalik dengan tombol Aktifkan.'
      : 'Aktifkan kembali "' + nama_murid + '" sebagai murid reguler?')
    + '\n\nLanjutkan?'
  )) return;
  showLoad('Memproses...');
  try {
    const today = new Date().toISOString().slice(0,10);
    await window.HQ.AdminAPI.updateUser({
      id_user    : id_murid,
      tipe_murid : tipe_baru,
      tgl_lulus  : tipe_baru === 'alumni' ? today : null
    });
    toast('"' + nama_murid + '" ' + (tipe_baru==='alumni' ? 'diwisuda' : 'diaktifkan kembali'), 'ok');
    await loadMasterData();
    renderAnggotaTable();
  } catch(e) { toast(friendlyError(e), 'err'); }
  finally { hideLoad(); }
}
```

> Catatan: `updateUser` sudah memanggil `_logAudit('update_user_role_status', ...)` saat kolom `status` berubah. Untuk `tipe_murid`, audit sudah tercakup karena `updateUser` di `api-staff.js:3717` men-trigger `_logAudit` jika `'status' in u` — perlu tambah kondisi `|| 'tipe_murid' in u` di baris tersebut agar audit juga tercatat saat hanya `tipe_murid` yang berubah.

**5c. Update kondisi audit di `api-staff.js:3717`:**

Ubah kondisi `if('role' in u || 'status' in u || 'is_musyrif' in u)` menjadi:
```js
if('role' in u || 'status' in u || 'is_musyrif' in u || 'tipe_murid' in u)
```

---

## Urutan Eksekusi

1. Jalankan `patch_100_alumni.sql` di Supabase SQL Editor — validasi dengan query di atas
2. Edit `api-staff.js` — tambah `bulkWisudaHalaqah` (Task 2) + update kondisi audit (Task 5c)
3. Edit `murid-module.js` — semua perubahan Task 3 (a–h)
4. Edit `index.html` — semua perubahan Task 4 (a–c) + tombol per-murid dan fungsi `toggleWisudaMurid` (Task 5a–5b)
5. Opsional: jalankan query backlog manual di SQL Editor untuk data historis

---

## Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Murid aktif di 2 halaqah, diwisuda dari salah satu | Pesan konfirmasi eksplisit menyebut "Berlaku GLOBAL" |
| `tipe_murid` NULL pada baris lama sebelum patch | `DEFAULT 'reguler'` di kolom; JS pakai `(u.tipe_murid\|\|'reguler')` untuk defensive read |
| Admin tidak bisa re-aktifkan alumni tanpa SQL | Task 4b menambah field `usrTipeMurid` ke modal edit user |
| RPC bisa dipanggil user biasa | `SECURITY DEFINER` + cek role di JS (`currentUser.role === 'admin'\|\|'superadmin'`) |
| Kolom `tipe_murid` dikirim saat `createUser` non-murid | Tidak berbahaya — field punya default, dan filter UI sudah guard dengan `u.role==='murid'` |

---

## File yang Diubah

| File | Jenis | Detail |
|---|---|---|
| `supabase/patch_100_alumni.sql` | BARU | ALTER TABLE (2 kolom), CREATE FUNCTION `bulk_wisuda_halaqah`, REVOKE/GRANT, komentar backlog |
| `supabase/api-staff.js` | EDIT | (Task 2) Tambah `bulkWisudaHalaqah` setelah baris 3718; (Task 5c) tambah `\|\| 'tipe_murid' in u` ke kondisi audit di baris 3717 |
| `admin/murid-module.js` | EDIT | (3a) Tombol "Wisuda" di `renderHalaqahTable`; (3b) fungsi `wisudaSemuaHalaqah`; (3c) filter `tipe_murid` di `renderUsersTable`; (3d) badge alumni di baris murid; (3e) reset filter di `switchUserTab` baris 124; (3f) field `tipe_murid` di `saveUser`; (3g) field `tipe_murid` di `editUser`; (3h) export `wisudaSemuaHalaqah` ke `window` |
| `admin/index.html` | EDIT | (4a) Dropdown `userTipeMuridFilter` setelah baris 1593; (4b) field `usrTipeMurid` di modal user setelah baris 3957; (4c) fix filter dropdown tambah anggota baris 5338; (5a) tombol Wisuda/Aktifkan di `renderAnggotaTable` antara baris 5327-5328; (5b) fungsi `toggleWisudaMurid` di area script dekat `hapusAnggota` |
