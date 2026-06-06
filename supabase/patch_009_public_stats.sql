-- ============================================================
--  PATCH 009 — Public Statistics RPC (Bypass RLS securely)
--  Jalankan di Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS to fetch exact count for anonymous users
AS $$
DECLARE
  v_murid integer;
  v_guru integer;
  v_halaqah integer;
BEGIN
  SELECT COUNT(*)::integer INTO v_murid FROM public.users WHERE role = 'murid' AND status = 'aktif';
  SELECT COUNT(*)::integer INTO v_guru FROM public.users WHERE role = 'guru' AND status = 'aktif';
  SELECT COUNT(*)::integer INTO v_halaqah FROM public.halaqah WHERE status = 'aktif';
  
  RETURN json_build_object(
    'murid', v_murid,
    'guru', v_guru,
    'halaqah', v_halaqah
  );
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;
