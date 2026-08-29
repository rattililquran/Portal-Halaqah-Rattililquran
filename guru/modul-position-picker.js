/* ================================================================
   Manifest Modul-Web v3 — 3 cabang utama:
   1. materi_rujukan : materi pengantar & konsep dasar
   2. huruf          : 30 huruf hijaiyah (per makhraj → huruf → tadrīb → item)
   3. hukum_tajwid   : bab-bab hukum + ringkasan
   ================================================================ */
window.MODUL_MANIFEST = {
  "version": 3,
  "cabang": ["materi_rujukan","huruf","hukum_tajwid"],
  "tadrib_labels": {"a":"Tadrīb A · Latihan Lisan","b":"Tadrīb B · Latihan Frasa","c":"Tadrīb C · Latihan Ayat"},

  /* ── CABANG 1: Materi Rujukan ─────────────────────────── */
  "materi_rujukan": [
    {"slug":"pengantar-tahsin",         "name":"Pengantar Tahsin"},
    {"slug":"anatomi-makhraj",          "name":"Anatomi Makhraj"},
    {"slug":"penjelasan-sifat",         "name":"Penjelasan Sifat"},
    {"slug":"itmamul-harakat",          "name":"Itmāmul Ḥarakāt"},
    {"slug":"penjelasan-bacaan-khusus", "name":"Bacaan Khusus"},
    {"slug":"penjelasan-rasm-utsmani",  "name":"Rasm Utsmani"},
    {"slug":"penjelasan-hamzah-wasal",  "name":"Hamzah Wasal"},
    {"slug":"penjelasan-hukum-ra",      "name":"Hukum Rā'"},
    {"slug":"penjelasan-shad-sin",      "name":"Shād dibaca Sīn"},
    {"slug":"penjelasan-tamkin-yaa",    "name":"Tamkīn Al-Yā'"}
  ],

  /* ── CABANG 2: Huruf Hijaiyah ─────────────────────────── */
  "makharij": [
    {"slug":"jauf",      "title":"Al-Jauf"},
    {"slug":"halq",      "title":"Al-Ḥalq"},
    {"slug":"lisan",     "title":"Al-Lisān"},
    {"slug":"syafatain", "title":"Asy-Syafatain"},
    {"slug":"khaisyum",  "title":"Al-Khaisyum"}
  ],
  "huruf": [
    {"slug":"jauf",     "ar":"ا · و · ي","name":"Al-Jauf",   "makhraj":"jauf",      "order":1,  "tadrib":["a","b","c"],"built":true},
    {"slug":"hamzah",   "ar":"ء",         "name":"Hamzah",    "makhraj":"halq",      "order":2,  "tadrib":["a","b","c"],"built":true},
    {"slug":"ha",       "ar":"ه",         "name":"Ha",        "makhraj":"halq",      "order":3,  "tadrib":["a","b","c"],"built":true},
    {"slug":"ain",      "ar":"ع",         "name":"'Ain",      "makhraj":"halq",      "order":4,  "tadrib":["a","b","c"],"built":true},
    {"slug":"ha-harfi", "ar":"ح",         "name":"Ḥa",        "makhraj":"halq",      "order":5,  "tadrib":["a","b","c"],"built":true},
    {"slug":"ghain",    "ar":"غ",         "name":"Ghain",     "makhraj":"halq",      "order":6,  "tadrib":["a","b","c"],"built":true},
    {"slug":"kha",      "ar":"خ",         "name":"Kha",       "makhraj":"halq",      "order":7,  "tadrib":["a","b","c"],"built":true},
    {"slug":"qaf",      "ar":"ق",         "name":"Qāf",       "makhraj":"lisan",     "order":8,  "tadrib":["a","b","c"],"built":true},
    {"slug":"kaf",      "ar":"ك",         "name":"Kaf",       "makhraj":"lisan",     "order":9,  "tadrib":["a","b","c"],"built":true},
    {"slug":"jim",      "ar":"ج",         "name":"Jīm",       "makhraj":"lisan",     "order":10, "tadrib":["a","b","c"],"built":true},
    {"slug":"syin",     "ar":"ش",         "name":"Syīn",      "makhraj":"lisan",     "order":11, "tadrib":["a","b","c"],"built":true},
    {"slug":"yaa",      "ar":"ي",         "name":"Yā'",       "makhraj":"lisan",     "order":12, "tadrib":["a","b","c"],"built":true},
    {"slug":"dad",      "ar":"ض",         "name":"Ḍād",       "makhraj":"lisan",     "order":13, "tadrib":["a","b","c"],"built":true},
    {"slug":"lam",      "ar":"ل",         "name":"Lām",       "makhraj":"lisan",     "order":14, "tadrib":["a","b","c"],"built":true},
    {"slug":"nun",      "ar":"ن",         "name":"Nūn",       "makhraj":"lisan",     "order":15, "tadrib":["a","b","c"],"built":true},
    {"slug":"ra",       "ar":"ر",         "name":"Rā'",       "makhraj":"lisan",     "order":16, "tadrib":["a","b","c"],"built":true},
    {"slug":"tsa",      "ar":"ث",         "name":"Tsā'",      "makhraj":"lisan",     "order":17, "tadrib":["a","b","c"],"built":true},
    {"slug":"dzal",     "ar":"ذ",         "name":"Dzāl",      "makhraj":"lisan",     "order":18, "tadrib":["a","b","c"],"built":true},
    {"slug":"zha",      "ar":"ظ",         "name":"Ẓā'",       "makhraj":"lisan",     "order":19, "tadrib":["a","b","c"],"built":true},
    {"slug":"sin",      "ar":"س",         "name":"Sīn",       "makhraj":"lisan",     "order":20, "tadrib":["a","b","c"],"built":true},
    {"slug":"zay",      "ar":"ز",         "name":"Zāy",       "makhraj":"lisan",     "order":21, "tadrib":["a","b","c"],"built":true},
    {"slug":"shad",     "ar":"ص",         "name":"Shād",      "makhraj":"lisan",     "order":22, "tadrib":["a","b","c"],"built":true},
    {"slug":"tha",      "ar":"ط",         "name":"Ṭā'",       "makhraj":"lisan",     "order":23, "tadrib":["a","b","c"],"built":true},
    {"slug":"dal",      "ar":"د",         "name":"Dāl",       "makhraj":"lisan",     "order":24, "tadrib":["a","b","c"],"built":true},
    {"slug":"ta",       "ar":"ت",         "name":"Tā'",       "makhraj":"lisan",     "order":25, "tadrib":["a","b","c"],"built":true},
    {"slug":"ba",       "ar":"ب",         "name":"Bā'",       "makhraj":"syafatain", "order":26, "tadrib":["a","b","c"],"built":true},
    {"slug":"mim",      "ar":"م",         "name":"Mīm",       "makhraj":"syafatain", "order":27, "tadrib":["a","b","c"],"built":true},
    {"slug":"wau",      "ar":"و",         "name":"Wāw",       "makhraj":"syafatain", "order":28, "tadrib":["a","b","c"],"built":true},
    {"slug":"fa",       "ar":"ف",         "name":"Fā'",       "makhraj":"syafatain", "order":29, "tadrib":["a","b","c"],"built":true},
    {"slug":"ghunnah",  "ar":"غنة",       "name":"Al-Ghunnah","makhraj":"khaisyum",  "order":30, "tadrib":[],           "built":true}
  ],

  /* ── CABANG 3: Hukum Tajwid ───────────────────────────── */
  "hukum_tajwid": [
    {"bab":"Nūn Sukun & Tanwīn","items":[
      {"slug":"penjelasan-izhar-halq",        "name":"Iẓhār Ḥalqī"},
      {"slug":"penjelasan-idgham-bighunnah",  "name":"Idghām Bighunnah"},
      {"slug":"penjelasan-idgham-bilaghunnah","name":"Idghām Bilā Ghunnah"},
      {"slug":"penjelasan-iqlab",             "name":"Iqlāb"},
      {"slug":"penjelasan-ikhfa-haqiqi",      "name":"Ikhfā' Ḥaqīqī"},
      {"slug":"ringkasan-nun-sukun-tanwin",   "name":"Ringkasan Nūn Sukun & Tanwīn"}
    ]},
    {"bab":"Mīm Sukun","items":[
      {"slug":"penjelasan-ikhfa-syafawi",  "name":"Ikhfā' Syafawī"},
      {"slug":"penjelasan-idgham-mimi",    "name":"Idghām Mīmī"},
      {"slug":"penjelasan-izhar-syafawi",  "name":"Iẓhār Syafawī"},
      {"slug":"ringkasan-mim-sukun",       "name":"Ringkasan Mīm Sukun"}
    ]},
    {"bab":"Alif-Lām","items":[
      {"slug":"penjelasan-izhar-qamariyah",  "name":"Iẓhār Qamariyyah"},
      {"slug":"penjelasan-idgham-syamsiyah", "name":"Idghām Syamsiyyah"},
      {"slug":"ringkasan-alif-lam",          "name":"Ringkasan Hukum Alif-Lām"}
    ]},
    {"bab":"Idghām Khusus","items":[
      {"slug":"penjelasan-idgham-mutajanisain", "name":"Idghām Mutajānisain"},
      {"slug":"penjelasan-idgham-mutamatsilain","name":"Idghām Mutamātsilain"},
      {"slug":"penjelasan-idgham-mutaqaribain", "name":"Idghām Mutaqāribain"},
      {"slug":"ringkasan-pertemuan-huruf",      "name":"Ringkasan Pertemuan Dua Huruf"}
    ]},
    {"bab":"Mad Ṭabī'ī","items":[
      {"slug":"penjelasan-mad-thabii",        "name":"Mad Ṭabī'ī"},
      {"slug":"penjelasan-mad-iwadh",         "name":"Mad 'Iwaḍ"},
      {"slug":"penjelasan-mad-shilah-qasirah","name":"Mad Ṣilah Qaṣīrah"},
      {"slug":"penjelasan-tamkin-yaa",        "name":"Tamkīn Al-Yā'"},
      {"slug":"ringkasan-mad-thabii",         "name":"Ringkasan Mad Ṭabī'ī"}
    ]},
    {"bab":"Mad Far'ī","items":[
      {"slug":"penjelasan-mad-wajib-muttasil", "name":"Mad Wājib Muttaṣil"},
      {"slug":"penjelasan-mad-jaiz-munfasil",  "name":"Mad Jā'iz Munfaṣil"},
      {"slug":"penjelasan-mad-aridh-lissukun", "name":"Mad 'Āriḍ Lissukūn"},
      {"slug":"penjelasan-mad-lin",            "name":"Mad Līn"},
      {"slug":"penjelasan-mad-badal",          "name":"Mad Badal"},
      {"slug":"penjelasan-mad-shilah-kubra",   "name":"Mad Ṣilah Kubrā"},
      {"slug":"penjelasan-mad-lazim",          "name":"Mad Lāzim"},
      {"slug":"ringkasan-mad-fari",            "name":"Ringkasan Mad Far'ī"}
    ]}
  ],

  /* kompatibilitas mundur — rujukan lama masih bisa dibaca */
  "rujukan": []
};

/* ================================================================
   Modul Position Picker v3 — 3 cabang: Materi Rujukan | Huruf | Hukum Tajwid
   Picker: Cabang (level-1) → Isi (level-2) → Tadrīb (level-3, huruf saja)
   ================================================================ */
(function(){
  "use strict";
  var MANIFEST_URL = "";
  var M = window.MODUL_MANIFEST;
  var TARGETS = ["jurnalHalaman","ejHalaman"];

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function tadLabel(x){ return (M.tadrib_labels && M.tadrib_labels[x]) || ('Tadrīb '+String(x).toUpperCase()); }

  function canonical(sel){
    if(sel.kind==='index') return '[web] index';
    if(sel.kind==='materi_rujukan' || sel.kind==='hukum_tajwid') return '[web] rujukan/'+sel.slug;
    var p='[web] huruf/'+sel.slug;
    if(sel.tadrib){ p+='/'+sel.tadrib; if(sel.item) p+='/'+sel.item; }
    return p;
  }

  function humanLabel(sel){
    if(sel.kind==='index') return 'Beranda Huruf';
    if(sel.kind==='materi_rujukan'){
      var r=(M.materi_rujukan||[]).find(function(x){return x.slug===sel.slug;});
      return r?r.name:sel.slug;
    }
    if(sel.kind==='hukum_tajwid'){
      var found=null;
      (M.hukum_tajwid||[]).forEach(function(bab){ bab.items.forEach(function(it){ if(it.slug===sel.slug) found=it; }); });
      return found?found.name:sel.slug;
    }
    var h=(M.huruf||[]).find(function(x){return x.slug===sel.slug;});
    var s=h?h.ar+'  '+h.name:sel.slug;
    if(sel.tadrib){ s+=' · '+tadLabel(sel.tadrib); if(sel.item) s+=' · no.'+sel.item; }
    return s;
  }

  function fullString(sel){ return canonical(sel)+' — '+humanLabel(sel); }

  function opt(v,t,extra){ return '<option value="'+esc(v)+'"'+(extra||'')+'>'+esc(t)+'</option>'; }

  function buildPanelHTML(){
    return ''
    +'<div class="mpp-row">'
    +  '<label>Cabang</label>'
    +  '<select class="mpp-cabang fc">'
    +    '<option value="">— pilih cabang —</option>'
    +    '<option value="materi_rujukan">Materi Rujukan</option>'
    +    '<option value="huruf">Huruf Hijaiyah</option>'
    +    '<option value="hukum_tajwid">Hukum Tajwid</option>'
    +  '</select>'
    +'</div>'
    /* level 2A: makhraj (hanya untuk huruf) */
    +'<div class="mpp-row mpp-makhraj-wrap" style="display:none">'
    +  '<label>Makhraj</label>'
    +  '<select class="mpp-mk fc" disabled><option value="">—</option></select>'
    +'</div>'
    /* level 2B: bab hukum tajwid */
    +'<div class="mpp-row mpp-bab-wrap" style="display:none">'
    +  '<label>Bab</label>'
    +  '<select class="mpp-bab fc" disabled><option value="">—</option></select>'
    +'</div>'
    /* level 2C: isi (huruf/rujukan/hukum) */
    +'<div class="mpp-row mpp-isi-wrap" style="display:none">'
    +  '<label>Pilih</label>'
    +  '<select class="mpp-isi fc" disabled><option value="">—</option></select>'
    +'</div>'
    /* level 3: tadrīb (hanya huruf) */
    +'<div class="mpp-row mpp-tad-wrap" style="display:none">'
    +  '<label>Bagian (Tadrīb)</label>'
    +  '<select class="mpp-tad fc" disabled><option value="">(awal halaman huruf)</option></select>'
    +'</div>'
    +'<div class="mpp-row mpp-item-wrap" style="display:none">'
    +  '<label>No. item <span style="font-weight:400;color:#888">(opsional)</span></label>'
    +  '<input type="number" min="1" class="mpp-item fc" placeholder="mis. 3" disabled>'
    +'</div>'
    +'<div class="mpp-row mpp-preview">—</div>'
    +'<div class="mpp-actions">'
    +  '<button type="button" class="mpp-apply" disabled>Terapkan ke field</button>'
    +  '<button type="button" class="mpp-cancel">Tutup</button>'
    +'</div>';
  }

  function currentSel(panel){
    var cabang = panel.querySelector('.mpp-cabang').value;
    if(!cabang) return null;
    if(cabang==='index') return {kind:'index'};
    if(cabang==='materi_rujukan'){
      var s=panel.querySelector('.mpp-isi').value;
      return s?{kind:'materi_rujukan',slug:s}:null;
    }
    if(cabang==='hukum_tajwid'){
      var s2=panel.querySelector('.mpp-isi').value;
      return s2?{kind:'hukum_tajwid',slug:s2}:null;
    }
    if(cabang==='huruf'){
      var hs=panel.querySelector('.mpp-isi').value; if(!hs) return null;
      var td=panel.querySelector('.mpp-tad').value||null;
      var itv=panel.querySelector('.mpp-item').value;
      var item=(td && itv && parseInt(itv,10)>0)?parseInt(itv,10):null;
      return {kind:'huruf',slug:hs,tadrib:td,item:item};
    }
    return null;
  }

  function refreshPreview(panel){
    var sel=currentSel(panel);
    panel.querySelector('.mpp-preview').textContent = sel ? fullString(sel) : '—';
    panel.querySelector('.mpp-apply').disabled = !sel;
  }

  function hideAll(panel){
    ['.mpp-makhraj-wrap','.mpp-bab-wrap','.mpp-isi-wrap','.mpp-tad-wrap','.mpp-item-wrap'].forEach(function(c){
      var el=panel.querySelector(c); if(el) el.style.display='none';
    });
    ['.mpp-mk','.mpp-bab','.mpp-isi','.mpp-tad','.mpp-item'].forEach(function(c){
      var el=panel.querySelector(c);
      if(el){ el.disabled=true; el.innerHTML=el.tagName==='SELECT'?'<option value="">—</option>':''; if(el.tagName==='INPUT') el.value=''; }
    });
  }

  function onCabangChange(panel){
    hideAll(panel);
    var cabang=panel.querySelector('.mpp-cabang').value;
    if(!cabang){ refreshPreview(panel); return; }

    if(cabang==='materi_rujukan'){
      var isiSel=panel.querySelector('.mpp-isi');
      var isiWrap=panel.querySelector('.mpp-isi-wrap');
      isiSel.innerHTML='<option value="">—</option>';
      (M.materi_rujukan||[]).forEach(function(r){ isiSel.innerHTML+=opt(r.slug,r.name); });
      isiSel.disabled=false; isiWrap.style.display='';
    }

    if(cabang==='huruf'){
      var mkSel=panel.querySelector('.mpp-mk');
      var mkWrap=panel.querySelector('.mpp-makhraj-wrap');
      mkSel.innerHTML='<option value="">—</option>';
      (M.makharij||[]).forEach(function(g){ mkSel.innerHTML+=opt(g.slug,g.title); });
      mkSel.disabled=false; mkWrap.style.display='';
    }

    if(cabang==='hukum_tajwid'){
      var babSel=panel.querySelector('.mpp-bab');
      var babWrap=panel.querySelector('.mpp-bab-wrap');
      babSel.innerHTML='<option value="">—</option>';
      (M.hukum_tajwid||[]).forEach(function(b){ babSel.innerHTML+=opt(b.bab,b.bab); });
      babSel.disabled=false; babWrap.style.display='';
    }
    refreshPreview(panel);
  }

  function onMakhrajChange(panel){
    var mk=panel.querySelector('.mpp-mk').value;
    var isiSel=panel.querySelector('.mpp-isi');
    var isiWrap=panel.querySelector('.mpp-isi-wrap');
    var tadWrap=panel.querySelector('.mpp-tad-wrap');
    var itemWrap=panel.querySelector('.mpp-item-wrap');
    isiSel.innerHTML='<option value="">—</option>'; isiSel.disabled=true;
    panel.querySelector('.mpp-tad').innerHTML='<option value="">(awal halaman huruf)</option>';
    panel.querySelector('.mpp-tad').disabled=true;
    panel.querySelector('.mpp-item').value=''; panel.querySelector('.mpp-item').disabled=true;
    tadWrap.style.display='none'; itemWrap.style.display='none';
    if(!mk){ isiWrap.style.display='none'; refreshPreview(panel); return; }
    (M.huruf||[]).filter(function(h){return h.makhraj===mk;}).forEach(function(h){
      isiSel.innerHTML+=opt(h.slug, h.ar+'  '+h.name);
    });
    isiSel.disabled=false; isiWrap.style.display='';
    refreshPreview(panel);
  }

  function onBabChange(panel){
    var bab=panel.querySelector('.mpp-bab').value;
    var isiSel=panel.querySelector('.mpp-isi');
    var isiWrap=panel.querySelector('.mpp-isi-wrap');
    isiSel.innerHTML='<option value="">—</option>'; isiSel.disabled=true;
    if(!bab){ isiWrap.style.display='none'; refreshPreview(panel); return; }
    var babObj=(M.hukum_tajwid||[]).find(function(b){return b.bab===bab;});
    if(babObj){ babObj.items.forEach(function(it){ isiSel.innerHTML+=opt(it.slug,it.name); }); }
    isiSel.disabled=false; isiWrap.style.display='';
    refreshPreview(panel);
  }

  function onIsiChange(panel){
    var cabang=panel.querySelector('.mpp-cabang').value;
    var tadWrap=panel.querySelector('.mpp-tad-wrap');
    var itemWrap=panel.querySelector('.mpp-item-wrap');
    var tadSel=panel.querySelector('.mpp-tad');
    if(cabang==='huruf'){
      var hs=panel.querySelector('.mpp-isi').value;
      var h=(M.huruf||[]).find(function(x){return x.slug===hs;});
      tadSel.innerHTML='<option value="">(awal halaman huruf)</option>';
      if(h && h.tadrib && h.tadrib.length){ h.tadrib.forEach(function(t){ tadSel.innerHTML+=opt(t,tadLabel(t)); }); tadSel.disabled=false; tadWrap.style.display=''; }
      else { tadSel.disabled=true; tadWrap.style.display='none'; }
      itemWrap.style.display='none'; panel.querySelector('.mpp-item').value=''; panel.querySelector('.mpp-item').disabled=true;
    } else {
      tadWrap.style.display='none'; itemWrap.style.display='none';
    }
    refreshPreview(panel);
  }

  function onTadChange(panel){
    var td=panel.querySelector('.mpp-tad').value;
    var itemWrap=panel.querySelector('.mpp-item-wrap');
    var item=panel.querySelector('.mpp-item');
    if(td){ itemWrap.style.display=''; item.disabled=false; }
    else { itemWrap.style.display='none'; item.value=''; item.disabled=true; }
    refreshPreview(panel);
  }

  function injectCSS(){
    if(document.getElementById('mpp-css')) return;
    var st=document.createElement('style'); st.id='mpp-css';
    st.textContent=''
    +'.mpp-btn{'
    +  'display:flex;align-items:center;justify-content:center;gap:5px;'
    +  'width:100%;box-sizing:border-box;margin-bottom:6px;cursor:pointer;'
    +  'background:linear-gradient(135deg,#fef2f2,#fecaca);'
    +  'border:1.5px solid #ef4444;border-radius:8px;'
    +  'padding:6px 11px;font-size:11px;font-weight:800;'
    +  'color:#991b1b;text-transform:uppercase;letter-spacing:.07em;'
    +'}'
    +'.mpp-btn:hover{border-color:#dc2626;background:linear-gradient(135deg,#fecaca,#fca5a5)}'
    +'.mpp-panel{'
    +  'margin-top:10px;border:1px solid var(--kbm-line,rgba(100,116,139,.18));'
    +  'background:var(--kbm-card,#fff);border-radius:10px;padding:12px 14px;font-size:13px;'
    +  'width:100%;box-sizing:border-box;'
    +'}'
    +'.mpp-row{display:flex;flex-direction:column;gap:3px;margin-bottom:8px}'
    +'.mpp-row label{'
    +  'display:inline-flex;align-items:center;gap:5px;'
    +  'background:linear-gradient(135deg,#fef3c7,#fde68a);'
    +  'border:1px solid #f59e0b;border-radius:8px;'
    +  'padding:2px 8px;font-size:10px;font-weight:800;'
    +  'color:#92400e;text-transform:uppercase;letter-spacing:.07em;'
    +  'width:fit-content;margin-bottom:2px;'
    +'}'
    +'.mpp-panel select,.mpp-panel input{'
    +  'font-size:13px;padding:7px 10px;width:100%;'
    +  'border:1px solid var(--kbm-line,rgba(100,116,139,.18));'
    +  'border-radius:8px;background:var(--kbm-card,#fff);'
    +  'color:var(--text,#0f172a);'
    +'}'
    +'.mpp-panel select:focus,.mpp-panel input:focus{'
    +  'border-color:var(--kbm-accent,#0f172a);'
    +  'box-shadow:0 0 0 3px var(--kbm-accent-soft,rgba(15,23,42,.08));outline:none;'
    +'}'
    +'.mpp-preview{'
    +  'font-family:ui-monospace,Menlo,monospace;font-size:11.5px;'
    +  'background:var(--kbm-accent-soft,rgba(15,23,42,.05));'
    +  'border:1px solid var(--kbm-accent-border,rgba(15,23,42,.12));'
    +  'border-radius:8px;padding:7px 10px;'
    +  'color:var(--text,#0f172a);white-space:normal;word-break:break-word;'
    +'}'
    +'.mpp-actions{display:flex;gap:8px;margin-top:8px}'
    +'.mpp-apply{'
    +  'flex:1;padding:8px;border:0;border-radius:8px;cursor:pointer;'
    +  'background:var(--kbm-accent,#0f172a);color:var(--kbm-card,#fff);'
    +  'font-size:12px;font-weight:700;'
    +'}'
    +'.mpp-apply:disabled{opacity:.45;cursor:not-allowed}'
    +'.mpp-apply:hover:not(:disabled){filter:brightness(1.1)}'
    +'.mpp-cancel{'
    +  'padding:8px 14px;font-size:12px;font-weight:700;'
    +  'border:1px solid var(--kbm-line,rgba(100,116,139,.18));'
    +  'background:transparent;border-radius:8px;cursor:pointer;'
    +  'color:var(--text-2,#475569);'
    +'}'
    +'html.theme-dark .mpp-panel{background:#121214;border-color:rgba(255,255,255,.1)}'
    +'html.theme-dark .mpp-panel select,html.theme-dark .mpp-panel input{background:#1b1d20;border-color:rgba(255,255,255,.12);color:#f0f2f8}'
    +'html.theme-dark .mpp-preview{background:rgba(240,242,248,.06);border-color:rgba(240,242,248,.12);color:#f0f2f8}'
    +'html.theme-dark .mpp-apply{background:#f0f2f8;color:#0f172a}'
    +'html.theme-dark .mpp-btn{background:rgba(220,38,38,.15);border-color:rgba(220,38,38,.4);color:#fca5a5}';
    document.head.appendChild(st);
  }

  function attach(id){
    var input=document.getElementById(id); if(!input) return;
    if(input.dataset.mppAttached) return; input.dataset.mppAttached='1';
    injectCSS();
    var btn=document.createElement('button');
    btn.type='button'; btn.className='mpp-btn'; btn.textContent='Isi dari Modul-Web';
    var panel=document.createElement('div'); panel.className='mpp-panel'; panel.style.display='none';
    panel.innerHTML=buildPanelHTML();
    input.insertAdjacentElement('beforebegin', btn);
    btn.insertAdjacentElement('afterend', panel);
    btn.addEventListener('click',function(){ panel.style.display = panel.style.display==='none'?'':'none'; });
    panel.querySelector('.mpp-cabang').addEventListener('change',function(){ onCabangChange(panel); });
    panel.querySelector('.mpp-mk').addEventListener('change',function(){ onMakhrajChange(panel); });
    panel.querySelector('.mpp-bab').addEventListener('change',function(){ onBabChange(panel); });
    panel.querySelector('.mpp-isi').addEventListener('change',function(){ onIsiChange(panel); });
    panel.querySelector('.mpp-tad').addEventListener('change',function(){ onTadChange(panel); });
    panel.querySelector('.mpp-item').addEventListener('input',function(){ refreshPreview(panel); });
    panel.querySelector('.mpp-cancel').addEventListener('click',function(){ panel.style.display='none'; });
    panel.querySelector('.mpp-apply').addEventListener('click',function(){
      var sel=currentSel(panel); if(!sel) return;
      input.value=fullString(sel);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      panel.style.display='none';
    });
  }

  function init(){ TARGETS.forEach(attach);
    new MutationObserver(function(){ TARGETS.forEach(attach); }).observe(document.body,{childList:true,subtree:true});
  }
  function boot(){
    if(MANIFEST_URL){ fetch(MANIFEST_URL).then(function(r){return r.json();}).then(function(j){ if(j&&j.huruf) M=j; }).catch(function(){}).then(init); }
    else init();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
