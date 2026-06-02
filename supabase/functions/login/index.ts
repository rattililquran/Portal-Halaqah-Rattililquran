// ============================================================
//  Edge Function: login v2
//  Rattililqur'an Portal — Custom Auth
//
//  Verifikasi password langsung di PostgreSQL (crypt)
//  Tidak butuh library bcrypt eksternal — lebih ringan dan cepat
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { id_user, password } = await req.json();

    if (!id_user || !password) {
      return json({ status: "error", message: "id_user dan password wajib diisi" }, 400);
    }

    // Admin client — bypass RLS
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── 1. Verifikasi id_user + password langsung di PostgreSQL ──
    // PostgreSQL crypt() kompatibel dengan bcrypt — tidak perlu library eksternal
    const { data: userData, error: verifyError } = await admin.rpc("verify_user_password", {
      p_id_user:  id_user.trim().toUpperCase(),
      p_password: password,
    });

    if (verifyError) {
      console.error("verify_user_password error:", verifyError);
      return json({ status: "error", message: "Terjadi kesalahan server" }, 500);
    }

    if (!userData || userData.length === 0) {
      return json({ status: "error", message: "ID pengguna atau password salah" }, 401);
    }

    const user = userData[0];

    if (user.status !== "aktif") {
      return json({ status: "error", message: "Akun tidak aktif. Hubungi admin." }, 403);
    }

    // ── 2. Sign in via Supabase Auth ──────────────────────────
    const authEmail = `${user.id_user.toLowerCase()}@rattil.internal`;

    let session;

    // Coba sign in langsung
    const { data: signIn, error: signInErr } = await admin.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (signInErr) {
      // User Auth belum ada — buat dulu
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        user_metadata: { id_user: user.id_user, role: user.role, nama: user.nama_lengkap },
      });

      if (createErr || !created?.user) {
        console.error("createUser error:", createErr);
        return json({ status: "error", message: "Gagal membuat sesi. Hubungi admin." }, 500);
      }

      // Update auth_id di users table
      await admin.from("users").update({ auth_id: created.user.id }).eq("id_user", user.id_user);

      // Sign in ulang
      const { data: retry, error: retryErr } = await admin.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      if (retryErr || !retry?.session) {
        return json({ status: "error", message: "Gagal login. Coba lagi." }, 500);
      }

      session = retry.session;
    } else {
      session = signIn?.session;
    }

    if (!session) {
      return json({ status: "error", message: "Gagal mendapatkan sesi" }, 500);
    }

    // ── 3. Audit log ──────────────────────────────────────────
    await admin.from("audit_log").insert({
      user_id: user.id_user,
      action:  "login",
      detail:  { role: user.role },
    });

    // ── 4. Return session ─────────────────────────────────────
    return json({
      status:        "ok",
      access_token:  session.access_token,
      refresh_token: session.refresh_token,
      expires_at:    session.expires_at,
      user: {
        id_user: user.id_user,
        nama:    user.nama_lengkap,
        role:    user.role,
      },
    });

  } catch (err) {
    console.error("Login error:", err);
    return json({ status: "error", message: "Terjadi kesalahan server" }, 500);
  }
});
