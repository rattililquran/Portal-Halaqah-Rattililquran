// ============================================================
//  HQ ASSEMBLE — dimuat TERAKHIR tiap portal (boundary fill, QuizAPI facade, SWR cache)
//  Hasil split supabase-client.js (2026-07-18). File ini KANONIK — edit di sini.
//  supabase-client.js lama disimpan sbg fallback rollback; boleh dihapus stlh live OK.
// ============================================================

(function(){
  var HQ = window.HQ; if (!HQ) return;
  function ensure(n){ HQ[n] = HQ[n] || {}; return HQ[n]; }
  function fill(n,m,fn){ var o = ensure(n); if (!o[m]) o[m] = fn; }
  // 3 boundary diakses via HQ.<Obj> di portal yg tak memuat objek aslinya.
  fill('GuruAPI','getPenilaianHafalan', _core_getPenilaianHafalan);
  fill('AdminAPI','getPushConfig',      _core_getPushConfig);
  fill('MuridAPI','getLatihanUploadToken', _core_getLatihanUploadToken);
  // _core_getRincianRaport & _core_generateRaportPDF TIDAK di-fill: hanya dipanggil
  // wrapper MuridAPI langsung (HQ.GuruAPI.* keduanya tak pernah dipanggil portal mana pun).

  // QuizAPI facade — ref via HQ.* (undefined-safe; method sisi-lain hanya error bila dipanggil di portal salah)
  HQ.QuizAPI = {
    // Guru Methods
    getKuisList: function() { return HQ.GuruAPI.getKuisList.apply(HQ.GuruAPI, arguments); },
    getMazeLevelsGuru: function() { return HQ.GuruAPI.getMazeLevelsGuru.apply(HQ.GuruAPI, arguments); },
    createMazeLevelGuru: function() { return HQ.GuruAPI.createMazeLevelGuru.apply(HQ.GuruAPI, arguments); },
    updateMazeLevelGuru: function() { return HQ.GuruAPI.updateMazeLevelGuru.apply(HQ.GuruAPI, arguments); },
    setMazeLevelAktifGuru: function() { return HQ.GuruAPI.setMazeLevelAktifGuru.apply(HQ.GuruAPI, arguments); },
    deleteMazeLevelGuru: function() { return HQ.GuruAPI.deleteMazeLevelGuru.apply(HQ.GuruAPI, arguments); },
    getRunLevelsGuru: function() { return HQ.GuruAPI.getRunLevelsGuru.apply(HQ.GuruAPI, arguments); },
    createRunLevelGuru: function() { return HQ.GuruAPI.createRunLevelGuru.apply(HQ.GuruAPI, arguments); },
    updateRunLevelGuru: function() { return HQ.GuruAPI.updateRunLevelGuru.apply(HQ.GuruAPI, arguments); },
    setRunLevelAktifGuru: function() { return HQ.GuruAPI.setRunLevelAktifGuru.apply(HQ.GuruAPI, arguments); },
    deleteRunLevelGuru: function() { return HQ.GuruAPI.deleteRunLevelGuru.apply(HQ.GuruAPI, arguments); },
    createKuis: function() { return HQ.GuruAPI.createKuis.apply(HQ.GuruAPI, arguments); },
    updateKuis: function() { return HQ.GuruAPI.updateKuis.apply(HQ.GuruAPI, arguments); },
    deleteKuis: function() { return HQ.GuruAPI.deleteKuis.apply(HQ.GuruAPI, arguments); },
    getBankSoal: function() { return HQ.GuruAPI.getBankSoal.apply(HQ.GuruAPI, arguments); },
    createSoal: function() { return HQ.GuruAPI.createSoal.apply(HQ.GuruAPI, arguments); },
    updateSoal: function() { return HQ.GuruAPI.updateSoal.apply(HQ.GuruAPI, arguments); },
    getSoalDetail: function() { return HQ.GuruAPI.getSoalDetail.apply(HQ.GuruAPI, arguments); },
    updateSoalFull: function() { return HQ.GuruAPI.updateSoalFull.apply(HQ.GuruAPI, arguments); },
    deleteSoal: function() { return HQ.GuruAPI.deleteSoal.apply(HQ.GuruAPI, arguments); },
    addSoalToKuis: function() { return HQ.GuruAPI.addSoalToKuis.apply(HQ.GuruAPI, arguments); },
    removeSoalFromKuis: function() { return HQ.GuruAPI.removeSoalFromKuis.apply(HQ.GuruAPI, arguments); },
    updateSoalKuisSetting: function() { return HQ.GuruAPI.updateSoalKuisSetting.apply(HQ.GuruAPI, arguments); },
    getHasilKuis: function() { return HQ.GuruAPI.getHasilKuis.apply(HQ.GuruAPI, arguments); },
    getAntrianReviewIsian: function() { return HQ.GuruAPI.getAntrianReviewIsian.apply(HQ.GuruAPI, arguments); },
    reviewIsianSingkat: function() { return HQ.GuruAPI.reviewIsianSingkat.apply(HQ.GuruAPI, arguments); },
    startSesiLive: function() { return HQ.GuruAPI.startSesiLive.apply(HQ.GuruAPI, arguments); },
    // Murid Methods
    getKuisTersedia: function() { return HQ.MuridAPI.getKuisTersedia.apply(HQ.MuridAPI, arguments); },
    getKuisDetail: function() { return HQ.MuridAPI.getKuisDetail.apply(HQ.MuridAPI, arguments); },
    jawabSoal: function() { return HQ.MuridAPI.jawabSoal.apply(HQ.MuridAPI, arguments); },
    submitKuis: function() { return HQ.MuridAPI.submitKuis.apply(HQ.MuridAPI, arguments); },
    getHasilKuisMurid: function() { return HQ.MuridAPI.getHasilKuisMurid.apply(HQ.MuridAPI, arguments); },
    getRiwayatKuisMurid: function() { return HQ.MuridAPI.getRiwayatKuisMurid.apply(HQ.MuridAPI, arguments); },
    getLeaderboardKuis: function() { return HQ.MuridAPI.getLeaderboardKuis.apply(HQ.MuridAPI, arguments); },
    joinSesiLive: function() { return HQ.MuridAPI.joinSesiLive.apply(HQ.MuridAPI, arguments); }
  };
})();

// ─────────────────────────────────────────────
//  DYNAMIC CACHE WRAPPER (SWR & INVALIDATION) — dipindah dari monolit
//  apis via window.HQ + guard (objek berbeda per portal)
// ─────────────────────────────────────────────
(function() {
  if (typeof window === "undefined") return;
  var apis = {
    AdminAPI: window.HQ.AdminAPI,
    GuruAPI:  window.HQ.GuruAPI,
    MuridAPI: window.HQ.MuridAPI,
    KetuaAPI: window.HQ.KetuaAPI
  };
  var readPrefixes = ['get', 'load', 'find', 'search'];
  var writePrefixes = ['create', 'update', 'delete', 'simpan', 'hapus', 'add', 'aktivasi', 'set'];

  function getCacheKey(apiName, methodName, args) {
    return 'hq_cache_' + apiName + '_' + methodName + '_' + JSON.stringify(args);
  }

  function clearCache() {
    if (typeof sessionStorage === 'undefined') return;
    for (var i = sessionStorage.length - 1; i >= 0; i--) {
      var key = sessionStorage.key(i);
      if (key && key.indexOf('hq_cache_') === 0) {
        sessionStorage.removeItem(key);
      }
    }
  }

  // SWR Caching
  function wrapRead(apiName, methodName, original) {
    return async function() {
      var args = Array.prototype.slice.call(arguments);
      if (typeof sessionStorage === 'undefined') {
        return original.apply(this, args);
      }

      var key = getCacheKey(apiName, methodName, args);
      var FRESH_TTL = 30 * 1000;       // 30 seconds
      var STALE_TTL = 5 * 60 * 1000;    // 5 minutes

      try {
        var cached = sessionStorage.getItem(key);
        if (cached) {
          var parsed = JSON.parse(cached);
          var age = Date.now() - parsed.timestamp;

          if (age < FRESH_TTL) {
            return parsed.data;
          } else if (age < STALE_TTL) {
            // SWR: fetch background, return cache immediately
            original.apply(this, args).then(function(res) {
              sessionStorage.setItem(key, JSON.stringify({
                timestamp: Date.now(),
                data: res
              }));
            }).catch(function(err) {
              console.warn('SWR refresh failed for ' + key + ':', err);
            });
            return parsed.data;
          }
        }
      } catch (e) {
        console.warn('Cache read error for ' + key + ':', e);
      }

      // Blocking fetch
      var res = await original.apply(this, args);
      try {
        sessionStorage.setItem(key, JSON.stringify({
          timestamp: Date.now(),
          data: res
        }));
      } catch (e) {
        console.warn('Cache write error for ' + key + ':', e);
      }
      return res;
    };
  }

  // Mutation Invalidation
  function wrapWrite(original) {
    return async function() {
      var args = Array.prototype.slice.call(arguments);
      var res = await original.apply(this, args);
      clearCache();
      return res;
    };
  }

  // Wrap all API functions
  Object.keys(apis).forEach(function(apiName) {
    var api = apis[apiName];
    if (!api) return;
    Object.keys(api).forEach(function(methodName) {
      var original = api[methodName];
      if (typeof original !== 'function') return;

      var isRead = readPrefixes.some(function(p) { return methodName.indexOf(p) === 0; });
      var isWrite = writePrefixes.some(function(p) { return methodName.indexOf(p) === 0; });

      if (isRead) {
        api[methodName] = wrapRead(apiName, methodName, original);
      } else if (isWrite) {
        api[methodName] = wrapWrite(original);
      }
    });
  });

  // Wrap Auth.logout
  if (typeof Auth !== 'undefined' && Auth.logout) {
    var originalLogout = Auth.logout;
    Auth.logout = async function() {
      var args = Array.prototype.slice.call(arguments);
      clearCache();
      return originalLogout.apply(this, args);
    };
  }

  // Expose global clear cache function
  window._clearHQCache = clearCache;
})();
