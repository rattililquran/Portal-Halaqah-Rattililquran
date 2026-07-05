# Indeks Status Patch — Rattililqur'an Portal

> Dibuat 15 Juni 2026 (merapikan patch_001–039, Opsi A).
> Tujuan: tahu mana patch yang masih jadi **sumber kebenaran** dan mana yang
> isinya sudah **tergantikan** (pasal mati) atau **usang** (diarsip).

**Ingat:** patch dijalankan manual & kumulatif di SQL Editor. DB produksi sudah
memuat hasil akumulasi semua patch ini. Indeks ini untuk maintainability &
rebuild-dari-nol, BUKAN status produksi.

Legenda:
- ✅ **AKTIF** — mengandung ≥1 objek/kolom/policy/seed yang masih jadi sumber kebenaran.
- 📦 **DIARSIP** — seluruh isi sudah mati/sekali-pakai → dipindah ke `_archive/`.
- *(pasal mati)* — sebagian statement di patch aktif sudah ditimpa patch lebih baru; patch tetap dipertahankan karena objek lainnya masih hidup.

## Tabel status

| Patch | Status | Objek/efek utama (yang masih hidup) | Pasal mati / catatan |
|---|---|---|---|
| 001 fix_rls_functions | ✅ | `get_keaktifan_alerts`, `current_user_ketua_halaqah`, policy ketua (anggota/nilai/at_log), tabel `assessment_items`/`assessment_murid` + RLS | `current_user_id/role` → ditimpa 017; `set_user_password` → 033; `ketua_read_member_contacts` → di-drop 018 |
| 002 notif_inbox | ✅ | tabel `notif_inbox` + trigger/awal RLS | policy diperketat di 004 & 020 |
| 003 cleanup_notif_inbox | ✅ | cron auto-cleanup notif_inbox | — |
| 004 fix_notif_inbox_rls | ✅ | policy per-user `notif_inbox` | — |
| 005 bug_fixes | ✅ | kolom `spp_pembayaran` (bukti_url, validated_*, dll), tabel push_config/push_user_prefs/spp_metode_bayar/at_tibyan_materi/materi_level + RLS | policy spp/push di-rework 022/023/025/033/035 |
| 006 fix_verify_password | 📦 | — | seluruhnya = `verify_user_password` STABLE-fix → tertelan 024 |
| 007 spp_metode_bayar | ✅ | seed data metode bayar (no_rekening) | sesuaikan data riil / boleh skip jika sudah diisi via portal |
| 008 fix_riwayat_sessions | ✅ | trigger sinkron nilai_kbm/kbm_log | — |
| 009 public_stats | ✅ | RPC statistik publik (bypass RLS aman) | — |
| 010 followup_ketua | ✅ | kolom followup_ketua_* | — |
| 011 spp_reminder | ✅ | seed config reminder SPP | — |
| 012 dzikir_reminders | ✅ | seed config dzikir harian | — |
| 013 level_jumlah_pertemuan | ✅ | kolom `level.jumlah_pertemuan` | — |
| 014 observasi_kbm_kolom_baru | ✅ | kolom `estimasi_menit`,`kamera_peserta` | — |
| 015 charging_notes | ✅ | tabel `charging_notes` + RLS | — |
| 016 rekap_status_catatan_ustadz | ✅ | kolom `rekap_status.catatan_ustadz` | — |
| 017 fix_jwt_privilege_escalation | ✅ | **`current_user_id/role` FINAL** (DB-only, anti-spoof) | trigger `_guard_users_self_update` → ditimpa 031→036 |
| 018 fix_ketua_contact_overexposure | ✅ | batasi kontak ketua ke no_hp | — |
| 019 login_rate_limit | ✅ | tabel `login_attempts` + RLS | — |
| 020 fix_notif_inbox_with_check | ✅ | WITH CHECK notif_inbox + anti-spoof | — |
| 021 unique_draft_kbm | ✅ | unique partial index anti race draft KBM | — |
| 022 audit_log_hardening | ✅ | tutup insert client + RPC `log_audit_action` | menghapus policy `all_insert_audit` (002) |
| 023 push_subscriptions_rls_hardening | ✅ | RLS push_subscriptions anti-spoof | — |
| 024 bendahara_real_flag | ✅ | kolom `users.is_bendahara` + **`verify_user_password` FINAL** | grant final fungsi ini di 033 |
| 025 push_user_prefs_rls_hardening | ✅ | RLS push_user_prefs anti-spoof | — |
| 026 cron_missing_triggers | ✅ | jadwal pg_cron 6 trigger | — |
| 027 mayar_payment_gateway | ✅ | kolom gateway (`metode_bayar`,`mayar_invoice_id`,`mayar_payment_link`) | drop constraint status (belum dipulihkan, lihat 035) |
| 028 fix_set_user_password_trigger | 📦 | — | `set_user_password`→033; trigger→036 |
| 029 link_halaqah_guru | 📦 | — | UPDATE data 1x; kode import sudah menangani |
| 030 debug_jwt | 📦 | — | debug + grant anon; di-drop 034 (jangan dijalankan lagi) |
| 031 fix_auth_id_link | ✅ | **`link_auth_id` FINAL** + backfill auth_id | trigger `_guard_*` → ditimpa 036 |
| 032 kelas_pengganti step1/step2 | ✅ | enum `libur` + kolom kbm_log kelas pengganti | jalankan step1 lalu step2 |
| 033 lock_auth_functions_and_spp_selfcheck | ✅ | **`set_user_password` FINAL** + grant auth fns + policy `murid_update_spp_self` | — |
| 034 audit_followups | ✅ | **`create/set_anggota_kelompok_*` FINAL**, drop `debug_jwt`, drop `guru_write_at_tibyan_materi`, **H4** set search_path semua definer | `_reconcile_targets_*` → ditimpa 039 |
| 035 fix_spp_insert_selfcheck | ✅ | policy `murid_insert_spp_self` FINAL (status=menunggu) | — |
| 036 crossportal_followups | ✅ | **`_guard_users_self_update` FINAL** (+is_bendahara), policy at_sesi/setoran/delete_target | `guru_all_at_log`+`murid_read_at_sesi` → ditimpa 037 |
| 037 fix_at_tibyan_rls_recursion | ✅ | helper anti-rekursi + policy at_tibyan FINAL | — |
| 038 spp_gateway_expiry_claim | ✅ | kolom `mayar_expired_at` + RPC `claim_spp_gateway` (M1/L1) | — |
| 039 bughunt_l2_l4 | ✅ | **`tandai_progress_target_*` & `_reconcile_targets_*` FINAL** (+lock L2), RPC `save_template_koreksi` (L4) | — |
| 040 login_auth_desync_fix | ✅ | RPC `auth_id_for_email` (service_role) — dipakai Edge Function login agar tidak salah createUser saat auth.users sudah ada tapi password basi | butuh **redeploy** `functions/login` |
| 041 backfill_nama_murid_anggota | ✅ | Backfill kolom `nama_murid` ke tabel `anggota` | — |
| 042 pindah_halaqah | ✅ | Fungsi dan trigger untuk memindahkan murid antar halaqah | — |
| 043 hard_delete_murid | ✅ | Prosedur `hard_delete_murid` untuk menghapus data murid secara bersih | — |
| 044 push_log_fail_detail | ✅ | Penambahan detail log kegagalan push notifikasi | — |
| 045 onboarding_config | ✅ | Tabel konfigurasi onboarding murid baru | — |
| 046 onboarding_only_unsubscribed | ✅ | Filter pengiriman onboarding hanya untuk user unsubscribed | — |
| 047 kbm_draft | ✅ | Dukungan draft KBM di tabel `kbm_log` | — |
| 048 kbm_selesai_pada | ✅ | Kolom `selesai_pada` di `kbm_log` untuk pelacakan durasi sesi | — |
| 049 absensi_guru | ✅ | Fitur pencatatan dan monitoring absensi kehadiran guru | — |
| 050 absensi_mulai_berlaku | ✅ | Penyesuaian tanggal aktif mulainya absensi guru | — |
| 051 bughunt_spp_fixes | ✅ | Perbaikan RLS `spp_pembayaran` dan reset bukti di gateway claim | — |
| 052 beasiswa_operasional | ✅ | Kolom `tipe_spp` di `anggota`, tabel `operasional` (ledger pengeluaran), RPC `get_infaq_bulanan` | — |
| 053 infaq_multi_payment | ✅ | Penyesuaian unique constraint untuk multi infaq, RPC `get_beasiswa_count` | — |
| 054 saran_masukan | ✅ | Tabel `saran_masukan` dengan jaminan RLS anonimitas ('Iffah) | — |
| 055 latihan_mandiri | ✅ | Dukungan PR (kolom baru di `nilai_kbm`/`kbm_log`), tabel `log_latihan_harian`, RPC latihan harian & streak | — |
| 056 qiyam_audio | ✅ | Kolom `lampiran_url` dan `audio_durasi_detik` di `setoran_hafalan` | — |
| 057 qiyam_audio_api_fix | ✅ | Perbarui RPC `get_setoran_menunggu_konfirmasi` agar me-return kolom `lampiran_url` & `audio_durasi_detik` | Diperlukan agar pemutar suara setoran mandiri Qiyam tampil di panel partner |
| 061 rattil_quiz | ✅ | 10 tabel baru Rattil Quiz (`quiz`, `soal`, `jawaban_murid`, dll), RLS policy anti-spoof, & RPC Security Definer (`jawab_soal`, `submit_quiz`, `recalculate_skor_attempt`, `review_isian_singkat`, `join_sesi_live`, `update_soal`) | — |



## Fungsi penting & "definisi final"-nya

| Fungsi | Final di | Pernah didefinisikan di |
|---|---|---|
| `current_user_id` / `current_user_role` | **017** | 002, patch_001, 017 |
| `verify_user_password` | **024** (grant di 033) | 003, 006, 024 |
| `set_user_password` | **033** | 003, patch_001, 028, 033 |
| `_guard_users_self_update` | **036** | 017, 028, 031, 036 |
| `link_auth_id` | **031** | 031 |
| `create_kelompok_partner` / `set_anggota_kelompok_partner` | **034** | 013, 034 |
| `tandai_progress_target_partner/belajar` | **039** | 020/021, 039 |
| `_reconcile_targets_partner/belajar` | **039** | 034, 039 |
| At-Tibyan policy (`guru_all_at_log`,`murid_read_at_sesi`) | **037** | 002, 036, 037 |

## Kenapa patch dengan "pasal mati" tetap dipertahankan

Karena tiap patch biasanya melakukan beberapa hal sekaligus. Contoh: patch_017
definisi `current_user_id` masih final, tapi trigger guard-nya sudah ditimpa 036.
Menghapus patch_017 akan menghilangkan definisi final `current_user_id`. Maka
hanya 4 patch yang **seluruh** isinya mati → diarsip (lihat `_archive/README.md`).
