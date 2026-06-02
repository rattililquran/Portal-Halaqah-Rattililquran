// ============================================================
//  Edge Function: login
//  Rattililqur'an Portal — Custom Auth
//
//  Request:  POST /functions/v1/login
//  Body:     { id_user: "RTL24180250", password: "123456" }
//  Response: { access_token, refresh_token, user: { id_user, nama, role } }
//
//  Flow:
//  1. Cek id_user + password di tabel users (bcrypt)
//  2. Sign in via Supabase Auth (email = id_user@rattil.internal)
//  3. Set custom JWT claims (id_user, role, nama)
//  4. Return session ke frontend
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { id_user, password } = await req.json();

    if (!id_user || !password) {
      return new Response(
        JSON.stringify({ status: "error", message: "id_user dan password wajib diisi" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buat Supabase admin client (service_role key, bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── 1. Cari user di tabel users ──────────────────────
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id_user, nama_lengkap, role, status, password_hash, email")
      .eq("id_user", id_user.trim().toUpperCase())
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ status: "error", message: "ID pengguna atau password salah" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (user.status !== "aktif") {
      return new Response(
        JSON.stringify({ status: "error", message: "Akun tidak aktif. Hubungi admin." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Verifikasi password (bcrypt) ──────────────────
    const passwordValid = await bcrypt.compare(password, user.password_hash ?? "");
    if (!passwordValid) {
      return new Response(
        JSON.stringify({ status: "error", message: "ID pengguna atau password salah" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Sign in via Supabase Auth ─────────────────────
    // Email internal: id_user@rattil.internal
    const authEmail = `${user.id_user.toLowerCase()}@rattil.internal`;

    let authSession;
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: authEmail,
      password: password,
    });

    if (signInError) {
      // Mungkin user belum ada di Auth → buat dulu
      const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          id_user: user.id_user,
          role: user.role,
          nama: user.nama_lengkap,
        },
      });

      if (signUpError) {
        console.error("Auth create error:", signUpError);
        return new Response(
          JSON.stringify({ status: "error", message: "Gagal membuat sesi. Hubungi admin." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update auth_id di tabel users
      await supabaseAdmin
        .from("users")
        .update({ auth_id: signUpData.user.id })
        .eq("id_user", user.id_user);

      // Sign in lagi setelah create
      const { data: retryData, error: retryError } = await supabaseAdmin.auth.signInWithPassword({
        email: authEmail,
        password: password,
      });

      if (retryError || !retryData.session) {
        return new Response(
          JSON.stringify({ status: "error", message: "Gagal login. Coba lagi." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      authSession = retryData.session;
    } else {
      authSession = signInData.session;
    }

    // ── 4. Audit log ─────────────────────────────────────
    await supabaseAdmin.from("audit_log").insert({
      user_id: user.id_user,
      action: "login",
      detail: { role: user.role },
    });

    // ── 5. Return session ke frontend ─────────────────────
    return new Response(
      JSON.stringify({
        status: "ok",
        access_token: authSession.access_token,
        refresh_token: authSession.refresh_token,
        expires_at: authSession.expires_at,
        user: {
          id_user: user.id_user,
          nama: user.nama_lengkap,
          role: user.role,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    console.error("Login error:", err);
    return new Response(
      JSON.stringify({ status: "error", message: "Terjadi kesalahan server" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
