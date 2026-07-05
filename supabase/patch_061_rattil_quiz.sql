-- ============================================================
--  patch_061_rattil_quiz.sql
--  Rattililqur'an Portal — Fitur Rattil Quiz (v1.6 Final)
--
--  Jalankan file ini di Supabase SQL Editor
--  Dokumen referensi: PRD_Rattil_Quiz.md (v1.6)
-- ============================================================

-- ─────────────────────────────────────────────
--  1. EXTENSION & UTILITY CHECK
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
--  2. TABEL-TABEL UTAMA
-- ─────────────────────────────────────────────

-- 2.1 TABEL MASTER KUIS
CREATE TABLE IF NOT EXISTS public.quiz (
  id_quiz                 TEXT PRIMARY KEY DEFAULT 'QZ-' || gen_random_uuid(),
  id_guru                 TEXT NOT NULL REFERENCES public.users(id_user) ON DELETE RESTRICT,
  judul                   TEXT NOT NULL,
  deskripsi               TEXT,
  kategori                TEXT,  -- 'Tajwid' | 'Makharijul Huruf' | 'Hafalan' | 'Murajaah' | 'Umum'
  mode                    TEXT NOT NULL DEFAULT 'mandiri' CHECK (mode IN ('mandiri', 'live')),
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'aktif', 'selesai', 'arsip')),

  -- Setting eksplisit
  durasi_per_soal_detik   INTEGER DEFAULT 30,  -- NULL = tanpa batas waktu
  urutan_soal             TEXT DEFAULT 'berurutan' CHECK (urutan_soal IN ('berurutan', 'acak')),
  tampilkan_jawaban       TEXT DEFAULT 'setelah_submit' CHECK (tampilkan_jawaban IN ('setelah_submit', 'setelah_semua', 'tidak_pernah')),
  boleh_retake            BOOLEAN DEFAULT false,
  tgl_mulai               DATE,
  tgl_selesai             DATE,
  anti_tab_aktif          BOOLEAN DEFAULT true,
  maks_peringatan_tab     INTEGER DEFAULT 2 CHECK (maks_peringatan_tab IN (1, 2, 3)),

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2 JUNCTION TABEL KUIS <-> HALAQAH
CREATE TABLE IF NOT EXISTS public.quiz_halaqah (
  id_quiz                 TEXT NOT NULL REFERENCES public.quiz(id_quiz) ON DELETE CASCADE,
  id_halaqah              TEXT NOT NULL REFERENCES public.halaqah(id_halaqah) ON DELETE CASCADE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id_quiz, id_halaqah)
);

-- 2.3 BANK SOAL
CREATE TABLE IF NOT EXISTS public.soal (
  id_soal                 TEXT PRIMARY KEY DEFAULT 'SL-' || gen_random_uuid(),
  id_guru                 TEXT NOT NULL REFERENCES public.users(id_user) ON DELETE RESTRICT,
  tipe_soal               TEXT NOT NULL CHECK (tipe_soal IN ('pilihan_ganda', 'benar_salah', 'matching', 'audio', 'teks_arab', 'isian_singkat')),
  teks_soal               TEXT NOT NULL,        -- Pertanyaan dalam Latin
  teks_arab               TEXT,                 -- Konten Arab (NULL jika bukan tipe teks_arab)
  highlight_markup        TEXT,                 -- Markup {[...]} untuk highlight
  audio_url               TEXT,                 -- URL GDrive / YouTube
  audio_tipe              TEXT,                 -- 'gdrive' | 'youtube' | 'soundcloud'
  isian_case_sensitive    BOOLEAN DEFAULT false,
  isian_abaikan_tanda_baca BOOLEAN DEFAULT false,
  penjelasan              TEXT,                 -- Pembahasan setelah menjawab
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.4 PILIHAN JAWABAN (PG, B/S, Audio, Teks Arab)
CREATE TABLE IF NOT EXISTS public.soal_pilihan (
  id_pilihan              TEXT PRIMARY KEY DEFAULT 'SP-' || gen_random_uuid(),
  id_soal                 TEXT NOT NULL REFERENCES public.soal(id_soal) ON DELETE CASCADE,
  teks_pilihan            TEXT NOT NULL,
  urutan                  INTEGER NOT NULL DEFAULT 1,
  is_benar                BOOLEAN NOT NULL DEFAULT false
);

-- 2.5 PASANGAN MATCHING (Menjodohkan)
CREATE TABLE IF NOT EXISTS public.soal_pasangan (
  id_pasangan             TEXT PRIMARY KEY DEFAULT 'SPa-' || gen_random_uuid(),
  id_soal                 TEXT NOT NULL REFERENCES public.soal(id_soal) ON DELETE CASCADE,
  teks_kiri               TEXT NOT NULL,
  teks_kanan              TEXT NOT NULL,
  urutan                  INTEGER NOT NULL DEFAULT 1
);

-- 2.6 VARIAN KUNCI ISIAN SINGKAT
CREATE TABLE IF NOT EXISTS public.soal_kunci_isian (
  id_kunci                TEXT PRIMARY KEY DEFAULT 'SK-' || gen_random_uuid(),
  id_soal                 TEXT NOT NULL REFERENCES public.soal(id_soal) ON DELETE CASCADE,
  teks_kunci              TEXT NOT NULL,
  ditambahkan_dari_review BOOLEAN DEFAULT false,
  ditambahkan_oleh        TEXT REFERENCES public.users(id_user) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_soal_kunci_isian UNIQUE (id_soal, teks_kunci)
);

-- 2.7 MAPPING KUIS <-> SOAL (DENGAN LOCK PER-KUIS)
CREATE TABLE IF NOT EXISTS public.quiz_soal (
  id_quiz                 TEXT NOT NULL REFERENCES public.quiz(id_quiz) ON DELETE CASCADE,
  id_soal                 TEXT NOT NULL REFERENCES public.soal(id_soal) ON DELETE RESTRICT,
  urutan                  INTEGER NOT NULL DEFAULT 1,
  bobot_poin              INTEGER NOT NULL DEFAULT 10,
  is_locked_for_quiz      BOOLEAN DEFAULT false,
  PRIMARY KEY (id_quiz, id_soal)
);

-- 2.8 SESI LIVE KUIS
CREATE TABLE IF NOT EXISTS public.sesi_quiz (
  id_sesi                 TEXT PRIMARY KEY DEFAULT 'SQ-' || gen_random_uuid(),
  id_quiz                 TEXT NOT NULL REFERENCES public.quiz(id_quiz) ON DELETE CASCADE,
  id_halaqah              TEXT NOT NULL REFERENCES public.halaqah(id_halaqah) ON DELETE CASCADE,
  kode_join               TEXT NOT NULL UNIQUE,
  status                  TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'berjalan', 'selesai')),
  soal_aktif_index        INTEGER DEFAULT 0,
  started_at              TIMESTAMPTZ,
  ended_at                TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.9 JAWABAN MURID PER SOAL PER ATTEMPT
CREATE TABLE IF NOT EXISTS public.jawaban_murid (
  id_jawaban              TEXT PRIMARY KEY DEFAULT 'JW-' || gen_random_uuid(),
  id_quiz                 TEXT NOT NULL REFERENCES public.quiz(id_quiz) ON DELETE CASCADE,
  id_sesi                 TEXT REFERENCES public.sesi_quiz(id_sesi) ON DELETE SET NULL,
  id_murid                TEXT NOT NULL REFERENCES public.users(id_user) ON DELETE CASCADE,
  id_soal                 TEXT NOT NULL REFERENCES public.soal(id_soal) ON DELETE RESTRICT,
  attempt_ke              INTEGER NOT NULL DEFAULT 1,
  id_pilihan_dipilih      TEXT REFERENCES public.soal_pilihan(id_pilihan) ON DELETE SET NULL,
  jawaban_matching        JSONB,
  teks_jawaban_isian      TEXT,
  status_review           TEXT DEFAULT 'na' CHECK (status_review IN ('na', 'menunggu_review', 'disetujui', 'ditolak')),
  review_oleh             TEXT REFERENCES public.users(id_user) ON DELETE SET NULL,
  review_at               TIMESTAMPTZ,
  waktu_menjawab_detik    INTEGER,
  is_benar                BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_jawaban_murid_attempt UNIQUE (id_quiz, id_murid, id_soal, attempt_ke),
  CONSTRAINT chk_panjang_teks_isian CHECK (length(teks_jawaban_isian) <= 500)
);

-- 2.10 HASIL KUIS PER ATTEMPT
CREATE TABLE IF NOT EXISTS public.hasil_quiz (
  id_hasil                TEXT PRIMARY KEY DEFAULT 'HQ-' || gen_random_uuid(),
  id_quiz                 TEXT NOT NULL REFERENCES public.quiz(id_quiz) ON DELETE CASCADE,
  id_sesi                 TEXT REFERENCES public.sesi_quiz(id_sesi) ON DELETE SET NULL,
  id_murid                TEXT NOT NULL REFERENCES public.users(id_user) ON DELETE CASCADE,
  attempt_ke              INTEGER NOT NULL DEFAULT 1,
  skor_total              INTEGER NOT NULL DEFAULT 0,
  skor_maksimal           INTEGER NOT NULL DEFAULT 0,
  jumlah_benar            INTEGER NOT NULL DEFAULT 0,
  durasi_pengerjaan_detik INTEGER,
  jumlah_tab_switch       INTEGER NOT NULL DEFAULT 0,
  total_durasi_keluar_detik INTEGER NOT NULL DEFAULT 0,
  flag_suspicious         BOOLEAN NOT NULL DEFAULT false,
  submitted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_hasil_quiz_attempt UNIQUE (id_quiz, id_murid, attempt_ke)
);

-- ─────────────────────────────────────────────
--  3. INDEXES UNTUK PERFORMA
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quiz_guru           ON public.quiz(id_guru);
CREATE INDEX IF NOT EXISTS idx_quiz_status         ON public.quiz(status);
CREATE INDEX IF NOT EXISTS idx_quiz_halaqah_hq     ON public.quiz_halaqah(id_halaqah);
CREATE INDEX IF NOT EXISTS idx_soal_guru           ON public.soal(id_guru);
CREATE INDEX IF NOT EXISTS idx_soal_tipe           ON public.soal(tipe_soal);
CREATE INDEX IF NOT EXISTS idx_soal_pilihan_soal   ON public.soal_pilihan(id_soal);
CREATE INDEX IF NOT EXISTS idx_soal_pasangan_soal  ON public.soal_pasangan(id_soal);
CREATE INDEX IF NOT EXISTS idx_jawaban_murid_qm    ON public.jawaban_murid(id_quiz, id_murid);
CREATE INDEX IF NOT EXISTS idx_jawaban_murid_rv    ON public.jawaban_murid(status_review) WHERE status_review = 'menunggu_review';
CREATE INDEX IF NOT EXISTS idx_hasil_quiz_qm       ON public.hasil_quiz(id_quiz, id_murid);

-- ─────────────────────────────────────────────
--  4. ROW-LEVEL SECURITY (RLS) POLICIES
-- ─────────────────────────────────────────────

ALTER TABLE public.quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_halaqah ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soal_pilihan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soal_pasangan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soal_kunci_isian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesi_quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jawaban_murid ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hasil_quiz ENABLE ROW LEVEL SECURITY;

-- 4.1 POLICIES UNTUK QUIZ
DROP POLICY IF EXISTS "guru_crud_quiz" ON public.quiz;
CREATE POLICY "guru_crud_quiz" ON public.quiz FOR ALL
  USING (
    id_guru = public.current_user_id()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "murid_lihat_quiz_aktif" ON public.quiz;
CREATE POLICY "murid_lihat_quiz_aktif" ON public.quiz FOR SELECT
  USING (
    status = 'aktif'
    AND (tgl_mulai IS NULL OR tgl_mulai <= CURRENT_DATE)
    AND (tgl_selesai IS NULL OR tgl_selesai >= CURRENT_DATE)
    AND EXISTS (
      SELECT 1 FROM public.quiz_halaqah qh
      JOIN public.anggota a ON a.id_halaqah = qh.id_halaqah
      WHERE qh.id_quiz = quiz.id_quiz
        AND a.id_murid = public.current_user_id()
        AND a.status = 'aktif'
    )
  );

-- 4.2 POLICIES UNTUK QUIZ_HALAQAH
DROP POLICY IF EXISTS "guru_crud_quiz_halaqah" ON public.quiz_halaqah;
CREATE POLICY "guru_crud_quiz_halaqah" ON public.quiz_halaqah FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz q
      WHERE q.id_quiz = quiz_halaqah.id_quiz
        AND (q.id_guru = public.current_user_id() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "murid_lihat_quiz_halaqah" ON public.quiz_halaqah;
CREATE POLICY "murid_lihat_quiz_halaqah" ON public.quiz_halaqah FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.anggota a
      WHERE a.id_halaqah = quiz_halaqah.id_halaqah
        AND a.id_murid = public.current_user_id()
        AND a.status = 'aktif'
    )
  );

-- 4.3 POLICIES UNTUK SOAL & OPSI
DROP POLICY IF EXISTS "guru_crud_soal" ON public.soal;
CREATE POLICY "guru_crud_soal" ON public.soal FOR ALL
  USING (
    id_guru = public.current_user_id() OR public.is_admin()
  );

DROP POLICY IF EXISTS "guru_edit_soal" ON public.soal;
CREATE POLICY "guru_edit_soal" ON public.soal FOR UPDATE
  USING (
    id_guru = public.current_user_id()
    AND NOT EXISTS (
      SELECT 1 FROM public.quiz_soal
      WHERE id_soal = soal.id_soal
        AND is_locked_for_quiz = true
    )
  );

DROP POLICY IF EXISTS "murid_baca_soal_kuis" ON public.soal;
CREATE POLICY "murid_baca_soal_kuis" ON public.soal FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_soal qs
      JOIN public.quiz_halaqah qh ON qh.id_quiz = qs.id_quiz
      JOIN public.anggota a ON a.id_halaqah = qh.id_halaqah
      WHERE qs.id_soal = soal.id_soal
        AND a.id_murid = public.current_user_id()
        AND a.status = 'aktif'
    )
  );

DROP POLICY IF EXISTS "baca_soal_pilihan" ON public.soal_pilihan;
CREATE POLICY "baca_soal_pilihan" ON public.soal_pilihan FOR SELECT USING (true);

DROP POLICY IF EXISTS "baca_soal_pasangan" ON public.soal_pasangan;
CREATE POLICY "baca_soal_pasangan" ON public.soal_pasangan FOR SELECT USING (true);

DROP POLICY IF EXISTS "baca_quiz_soal" ON public.quiz_soal;
CREATE POLICY "baca_quiz_soal" ON public.quiz_soal FOR SELECT USING (true);

-- 4.4 POLICIES UNTUK JAWABAN_MURID
DROP POLICY IF EXISTS "murid_lihat_jawaban_sendiri" ON public.jawaban_murid;
CREATE POLICY "murid_lihat_jawaban_sendiri" ON public.jawaban_murid FOR SELECT
  USING (id_murid = public.current_user_id());

DROP POLICY IF EXISTS "guru_baca_jawaban" ON public.jawaban_murid;
CREATE POLICY "guru_baca_jawaban" ON public.jawaban_murid FOR SELECT
  USING (
    public.is_guru() AND EXISTS (
      SELECT 1 FROM public.quiz q
      WHERE q.id_quiz = jawaban_murid.id_quiz
        AND (q.id_guru = public.current_user_id() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "guru_review_jawaban" ON public.jawaban_murid;
CREATE POLICY "guru_review_jawaban" ON public.jawaban_murid FOR UPDATE
  USING (
    public.is_guru() AND EXISTS (
      SELECT 1 FROM public.quiz q
      WHERE q.id_quiz = jawaban_murid.id_quiz
        AND (q.id_guru = public.current_user_id() OR public.is_admin())
    )
  );

-- 4.5 POLICIES UNTUK HASIL_QUIZ
DROP POLICY IF EXISTS "murid_baca_hasil_sendiri" ON public.hasil_quiz;
CREATE POLICY "murid_baca_hasil_sendiri" ON public.hasil_quiz FOR SELECT
  USING (id_murid = public.current_user_id());

DROP POLICY IF EXISTS "guru_baca_hasil_halaqah" ON public.hasil_quiz;
CREATE POLICY "guru_baca_hasil_halaqah" ON public.hasil_quiz FOR SELECT
  USING (
    public.is_guru() AND EXISTS (
      SELECT 1 FROM public.quiz q
      WHERE q.id_quiz = hasil_quiz.id_quiz
        AND (q.id_guru = public.current_user_id() OR public.is_admin())
    )
  );

-- ─────────────────────────────────────────────
--  5. SECURITY DEFINER HELPER & RPC FUNCTIONS
-- ─────────────────────────────────────────────

-- 5.1 HELPER SINGLE SOURCE OF TRUTH REKALKULASI SKOR
CREATE OR REPLACE FUNCTION public.recalculate_skor_attempt(
  p_id_quiz    TEXT,
  p_id_murid   TEXT,
  p_attempt_ke INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quiz public.quiz;
BEGIN
  SELECT * INTO v_quiz FROM public.quiz WHERE id_quiz = p_id_quiz;

  UPDATE public.hasil_quiz SET
    skor_total = (
      SELECT COALESCE(SUM(
        CASE
          -- 1. Speed bonus hanya di Mode Live + durasi per soal tidak NULL
          WHEN v_quiz.mode = 'live' AND v_quiz.durasi_per_soal_detik IS NOT NULL
               AND jm.is_benar AND jm.status_review != 'menunggu_review'
            THEN qs.bobot_poin + GREATEST(0,
                   FLOOR(((v_quiz.durasi_per_soal_detik - COALESCE(jm.waktu_menjawab_detik, 0))
                          ::NUMERIC / v_quiz.durasi_per_soal_detik) * 50))
          -- 2. Partial Score untuk Matching
          WHEN jm.jawaban_matching IS NOT NULL AND jm.status_review = 'na'
            THEN FLOOR(
              (SELECT COUNT(DISTINCT sp.id_pasangan)
                 FROM jsonb_array_elements(jm.jawaban_matching) AS j
                 JOIN public.soal_pasangan sp ON sp.id_soal = jm.id_soal
                   AND sp.teks_kiri = j->>'kiri' AND sp.teks_kanan = j->>'kanan_dipilih'
              )::NUMERIC
              / NULLIF((SELECT COUNT(*) FROM public.soal_pasangan WHERE id_soal = jm.id_soal), 0)
              * qs.bobot_poin
            )
          -- 3. Binary Scoring (PG, B/S, Audio, Teks Arab, Isian Singkat)
          WHEN jm.is_benar AND jm.status_review != 'menunggu_review'
            THEN qs.bobot_poin
          ELSE 0
        END
      ), 0)
      FROM public.jawaban_murid jm
      JOIN public.quiz_soal qs ON qs.id_quiz = jm.id_quiz AND qs.id_soal = jm.id_soal
      WHERE jm.id_quiz = p_id_quiz
        AND jm.id_murid = p_id_murid
        AND jm.attempt_ke = p_attempt_ke
    ),
    skor_maksimal = (
      SELECT COALESCE(SUM(qs.bobot_poin), 0)
      FROM public.quiz_soal qs WHERE qs.id_quiz = p_id_quiz
    ),
    jumlah_benar = (
      SELECT COUNT(*) FROM public.jawaban_murid
      WHERE id_quiz = p_id_quiz
        AND id_murid = p_id_murid
        AND attempt_ke = p_attempt_ke
        AND is_benar = true
        AND status_review != 'menunggu_review'
    )
  WHERE id_quiz = p_id_quiz
    AND id_murid = p_id_murid
    AND attempt_ke = p_attempt_ke;
END;
$$;

-- 5.2 RPC MURID JAWAB SOAL
CREATE OR REPLACE FUNCTION public.jawab_soal(
  p_id_quiz        TEXT,
  p_id_soal        TEXT,
  p_attempt_ke     INTEGER,
  p_id_pilihan     TEXT    DEFAULT NULL,
  p_matching_json  JSONB   DEFAULT NULL,
  p_teks_isian     TEXT    DEFAULT NULL,
  p_waktu_detik    INTEGER DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_soal           public.soal;
  v_is_benar       BOOLEAN := false;
  v_status_review  TEXT := 'na';
  v_bobot          INTEGER;
  v_total_pasangan INTEGER;
  v_benar_pasangan INTEGER := 0;
  v_durasi_maks    INTEGER;
BEGIN
  -- Validasi: murid harus anggota aktif halaqah kuis ini
  IF NOT EXISTS (
    SELECT 1 FROM public.quiz_halaqah qh
    JOIN public.anggota a ON a.id_halaqah = qh.id_halaqah
    WHERE qh.id_quiz = p_id_quiz
      AND a.id_murid = public.current_user_id()
      AND a.status = 'aktif'
  ) THEN
    RAISE EXCEPTION 'Akses ditolak: kamu bukan anggota halaqah kuis ini.';
  END IF;

  -- Blok ubah jawaban jika attempt sudah disubmit
  IF EXISTS (
    SELECT 1 FROM public.hasil_quiz
    WHERE id_quiz    = p_id_quiz
      AND id_murid   = public.current_user_id()
      AND attempt_ke = p_attempt_ke
  ) THEN
    RAISE EXCEPTION 'Attempt ini sudah disubmit, jawaban tidak bisa diubah.';
  END IF;

  -- Validasi: kuis masih dalam periode aktif
  IF EXISTS (
    SELECT 1 FROM public.quiz
    WHERE id_quiz = p_id_quiz
      AND tgl_selesai IS NOT NULL AND tgl_selesai < CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'Kuis sudah melewati tanggal selesai.';
  END IF;

  SELECT * INTO v_soal FROM public.soal WHERE id_soal = p_id_soal;
  SELECT bobot_poin INTO v_bobot
    FROM public.quiz_soal WHERE id_quiz = p_id_quiz AND id_soal = p_id_soal;

  -- Sanity check waktu
  SELECT durasi_per_soal_detik INTO v_durasi_maks FROM public.quiz WHERE id_quiz = p_id_quiz;
  IF v_durasi_maks IS NOT NULL AND p_waktu_detik IS NOT NULL
     AND p_waktu_detik > (v_durasi_maks + 5) THEN
    RAISE EXCEPTION 'Waktu jawab tidak valid.';
  END IF;

  -- Hitung is_benar berdasarkan tipe soal
  CASE v_soal.tipe_soal

    WHEN 'pilihan_ganda', 'benar_salah', 'audio', 'teks_arab' THEN
      SELECT is_benar INTO v_is_benar
        FROM public.soal_pilihan
        WHERE id_pilihan = p_id_pilihan AND id_soal = p_id_soal;
      v_is_benar := COALESCE(v_is_benar, false);

    WHEN 'matching' THEN
      SELECT COUNT(*) INTO v_total_pasangan
        FROM public.soal_pasangan WHERE id_soal = p_id_soal;

      IF jsonb_array_length(COALESCE(p_matching_json, '[]'::jsonb)) > v_total_pasangan THEN
        RAISE EXCEPTION 'Jumlah pasangan jawaban melebihi jumlah soal.';
      END IF;

      SELECT COUNT(*) INTO v_benar_pasangan
        FROM (
          SELECT DISTINCT ON (j->>'kiri') j->>'kiri' AS kiri, j->>'kanan_dipilih' AS kanan
          FROM jsonb_array_elements(p_matching_json) AS j
        ) AS jd
        JOIN public.soal_pasangan sp
          ON sp.id_soal = p_id_soal
         AND sp.teks_kiri  = jd.kiri
         AND sp.teks_kanan = jd.kanan;

      v_is_benar := (v_benar_pasangan = v_total_pasangan AND v_total_pasangan > 0);

    WHEN 'isian_singkat' THEN
      IF p_teks_isian IS NULL OR trim(p_teks_isian) = '' THEN
        v_is_benar      := false;
        v_status_review := 'na';
      ELSE
        DECLARE
          v_teks_normal TEXT := trim(p_teks_isian);
        BEGIN
          IF NOT v_soal.isian_case_sensitive THEN
            v_teks_normal := lower(v_teks_normal);
          END IF;
          IF v_soal.isian_abaikan_tanda_baca THEN
            v_teks_normal := regexp_replace(v_teks_normal, '[''"\-]', '', 'g');
          END IF;
          SELECT EXISTS (
            SELECT 1 FROM public.soal_kunci_isian
            WHERE id_soal = p_id_soal
              AND CASE WHEN NOT v_soal.isian_case_sensitive
                       THEN lower(trim(teks_kunci))
                       ELSE trim(teks_kunci) END = v_teks_normal
          ) INTO v_is_benar;
          v_is_benar := COALESCE(v_is_benar, false);
          IF NOT v_is_benar THEN
            v_status_review := 'menunggu_review';
          END IF;
        END;
      END IF;

  END CASE;

  -- Upsert jawaban
  INSERT INTO public.jawaban_murid (
    id_quiz, id_murid, id_soal, attempt_ke,
    id_pilihan_dipilih, jawaban_matching, teks_jawaban_isian,
    is_benar, status_review, waktu_menjawab_detik
  ) VALUES (
    p_id_quiz, public.current_user_id(), p_id_soal, p_attempt_ke,
    p_id_pilihan, p_matching_json, p_teks_isian,
    v_is_benar, v_status_review, p_waktu_detik
  )
  ON CONFLICT (id_quiz, id_murid, id_soal, attempt_ke)
    DO UPDATE SET
      id_pilihan_dipilih   = EXCLUDED.id_pilihan_dipilih,
      jawaban_matching     = EXCLUDED.jawaban_matching,
      teks_jawaban_isian   = EXCLUDED.teks_jawaban_isian,
      is_benar             = EXCLUDED.is_benar,
      status_review        = EXCLUDED.status_review,
      waktu_menjawab_detik = EXCLUDED.waktu_menjawab_detik;

  RETURN jsonb_build_object(
    'is_benar',      v_is_benar,
    'status_review', v_status_review
  );
END;
$$;

-- 5.3 RPC SUBMIT KUIS
CREATE OR REPLACE FUNCTION public.submit_quiz(
  p_id_quiz                  TEXT,
  p_attempt_ke               INTEGER,
  p_durasi_pengerjaan_detik  INTEGER DEFAULT NULL,
  p_jumlah_tab_switch        INTEGER DEFAULT 0,
  p_total_durasi_keluar_detik INTEGER DEFAULT 0
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quiz public.quiz;
  v_flag_suspicious BOOLEAN := false;
BEGIN
  SELECT * INTO v_quiz FROM public.quiz WHERE id_quiz = p_id_quiz;

  IF v_quiz.tgl_selesai IS NOT NULL AND v_quiz.tgl_selesai < CURRENT_DATE THEN
    RAISE EXCEPTION 'Kuis sudah melewati tanggal selesai.';
  END IF;

  IF p_jumlah_tab_switch >= v_quiz.maks_peringatan_tab THEN
    v_flag_suspicious := true;
  END IF;

  INSERT INTO public.hasil_quiz (
    id_quiz, id_murid, attempt_ke, skor_total, skor_maksimal, jumlah_benar,
    durasi_pengerjaan_detik, jumlah_tab_switch, total_durasi_keluar_detik, flag_suspicious
  )
  VALUES (
    p_id_quiz, public.current_user_id(), p_attempt_ke, 0, 0, 0,
    p_durasi_pengerjaan_detik, p_jumlah_tab_switch, p_total_durasi_keluar_detik, v_flag_suspicious
  )
  ON CONFLICT (id_quiz, id_murid, attempt_ke) DO NOTHING;

  PERFORM public.recalculate_skor_attempt(p_id_quiz, public.current_user_id(), p_attempt_ke);

  UPDATE public.quiz_soal SET is_locked_for_quiz = true
  WHERE id_quiz = p_id_quiz;
END;
$$;

-- 5.4 RPC UPDATE SOAL
CREATE OR REPLACE FUNCTION public.update_soal(
  p_id_soal        TEXT,
  p_teks_soal      TEXT    DEFAULT NULL,
  p_penjelasan     TEXT    DEFAULT NULL,
  p_highlight      TEXT    DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.soal WHERE id_soal = p_id_soal
      AND (id_guru = public.current_user_id() OR public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Akses ditolak atau soal tidak ditemukan.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quiz_soal
    WHERE id_soal = p_id_soal AND is_locked_for_quiz = true
  ) THEN
    RAISE EXCEPTION 'Soal tidak bisa diedit: sudah digunakan di kuis yang berjalan. Duplikasi soal terlebih dahulu jika ingin mengedit.';
  END IF;

  UPDATE public.soal SET
    teks_soal        = COALESCE(p_teks_soal, teks_soal),
    penjelasan       = COALESCE(p_penjelasan, penjelasan),
    highlight_markup = COALESCE(p_highlight, highlight_markup),
    updated_at       = now()
  WHERE id_soal = p_id_soal;
END;
$$;

-- 5.5 RPC REVIEW ISIAN SINGKAT (GURU)
CREATE OR REPLACE FUNCTION public.review_isian_singkat(
  p_id_jawaban            TEXT,
  p_disetujui             BOOLEAN,
  p_simpan_sebagai_varian BOOLEAN DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jaw public.jawaban_murid;
BEGIN
  SELECT * INTO v_jaw FROM public.jawaban_murid WHERE id_jawaban = p_id_jawaban;

  IF NOT EXISTS (
    SELECT 1 FROM public.quiz q
    WHERE q.id_quiz = v_jaw.id_quiz
      AND (q.id_guru = public.current_user_id() OR public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Akses ditolak.';
  END IF;

  UPDATE public.jawaban_murid SET
    status_review = CASE WHEN p_disetujui THEN 'disetujui' ELSE 'ditolak' END,
    is_benar      = p_disetujui,
    review_oleh   = public.current_user_id(),
    review_at     = now()
  WHERE id_jawaban = p_id_jawaban;

  IF p_disetujui AND p_simpan_sebagai_varian THEN
    INSERT INTO public.soal_kunci_isian (id_soal, teks_kunci, ditambahkan_dari_review, ditambahkan_oleh)
    VALUES (v_jaw.id_soal, trim(v_jaw.teks_jawaban_isian), true, public.current_user_id())
    ON CONFLICT DO NOTHING;
  END IF;

  PERFORM public.recalculate_skor_attempt(v_jaw.id_quiz, v_jaw.id_murid, v_jaw.attempt_ke);
END;
$$;

-- 5.6 RPC JOIN SESI LIVE
CREATE OR REPLACE FUNCTION public.join_sesi_live(p_kode TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_sesi public.sesi_quiz;
BEGIN
  SELECT * INTO v_sesi
  FROM public.sesi_quiz
  WHERE kode_join = upper(trim(p_kode)) AND status = 'menunggu';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kode tidak valid atau sesi sudah dimulai.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.anggota
    WHERE id_halaqah = v_sesi.id_halaqah
      AND id_murid = public.current_user_id() AND status = 'aktif'
  ) THEN
    RAISE EXCEPTION 'Kamu bukan anggota halaqah untuk sesi ini.';
  END IF;

  RETURN jsonb_build_object('id_sesi', v_sesi.id_sesi, 'id_quiz', v_sesi.id_quiz);
END;
$$;

-- ─────────────────────────────────────────────
--  6. GRANT PRIVILEGES UNTUK AUTH USERS
-- ─────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_skor_attempt TO authenticated;
GRANT EXECUTE ON FUNCTION public.jawab_soal TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quiz TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_soal TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_isian_singkat TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_sesi_live TO authenticated;
