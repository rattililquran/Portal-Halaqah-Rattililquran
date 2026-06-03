// ============================================================
//  VAPID Key Generator — Rattililqur'an
//  Jalankan SEKALI saja: node generate-vapid-keys.js
//  Simpan output-nya di Supabase Secrets!
// ============================================================

// Membutuhkan: npm install web-push
// Jalankan: node supabase/generate-vapid-keys.js

try {
  const webpush = require('web-push');
  const keys    = webpush.generateVAPIDKeys();

  console.log('\n✅ VAPID Keys berhasil di-generate!\n');
  console.log('════════════════════════════════════════════');
  console.log('VAPID_PUBLIC_KEY  (simpan di kode frontend):');
  console.log(keys.publicKey);
  console.log('────────────────────────────────────────────');
  console.log('VAPID_PRIVATE_KEY (simpan di Supabase Secrets):');
  console.log(keys.privateKey);
  console.log('════════════════════════════════════════════');
  console.log('\n📋 Langkah selanjutnya:');
  console.log('1. Buka Supabase Dashboard → Edge Functions → Secrets');
  console.log('2. Tambah secret: VAPID_PUBLIC_KEY  = (nilai di atas)');
  console.log('3. Tambah secret: VAPID_PRIVATE_KEY = (nilai di atas)');
  console.log('4. Tambah secret: VAPID_SUBJECT     = mailto:admin@rattililquran.com');
  console.log('5. Ganti VAPID_PUBLIC_KEY di supabase/supabase-client.js');
  console.log('   cari: var VAPID_PUBLIC_KEY = \'GANTI_DENGAN_VAPID_PUBLIC_KEY_ANDA\'');
  console.log('   ganti nilainya dengan public key di atas\n');

} catch(e) {
  console.log('\n❌ Package web-push belum terinstall.');
  console.log('Jalankan dulu: npm install web-push');
  console.log('Lalu jalankan lagi: node supabase/generate-vapid-keys.js\n');
}
