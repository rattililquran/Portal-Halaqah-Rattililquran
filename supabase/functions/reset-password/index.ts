// ============================================================
//  Edge Function: reset-password
//  Hanya bisa dipanggil oleh admin/superadmin
//  Update password di: (1) users.password_hash, (2) Supabase Auth
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
    // Verifikasi bahwa pemanggil adalah admin/superadmin
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ status: "error", message: "Unauthorized" }, 401);
    }

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Cek role pemanggil dari JWT
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ status: "error", message: "Unauthorized" }, 401);

    const callerRole = caller.user_metadata?.role;
    if (!["admin", "superadmin"].includes(callerRole)) {
      return json({ status: "error", message: "Hanya admin yang bisa reset password" }, 403);
    }

    const { id_user, new_password } = await req.json();

    if (!id_user || !new_password) {
      return json({ status: "error", message: "id_user dan new_password wajib diisi" }, 400);
    }
    if (new_password.length < 6) {
      return json({ status: "error", message: "Password minimal 6 karakter" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── 1. Ambil data user target ─────────────────────────
    const { data: targetUser, error: fetchErr } = await admin
      .from("users")
      .select("id_user, nama_lengkap, auth_id, status")
      .eq("id_user", id_user.trim().toUpperCase())
      .maybeSingle();

    if (fetchErr || !targetUser) {
      return json({ status: "error", message: "User tidak ditemukan" }, 404);
    }

    // ── 2. Update password_hash di tabel users ────────────
    const { error: hashErr } = await admin.rpc("set_user_password", {
      p_id_user: targetUser.id_user,
      p_password: new_password,
    });
    if (hashErr) {
      console.error("set_user_password error:", hashErr);
      return json({ status: "error", message: "Gagal update password di database" }, 500);
    }

    // ── 3. Update password di Supabase Auth (jika auth_id ada) ─
    if (targetUser.auth_id) {
      const { error: authErr } = await admin.auth.admin.updateUserById(
        targetUser.auth_id,
        { password: new_password }
      );
      if (authErr) {
        console.error("updateUserById error:", authErr);
        // Tidak fatal — user bisa login lagi dan Auth akan di-sync
      }
    }

    // ── 4. Audit log ──────────────────────────────────────
    await admin.from("audit_log").insert({
      user_id: caller.user_metadata?.id_user || caller.id,
      action:  "reset_password",
      detail:  { target_user: targetUser.id_user, nama: targetUser.nama_lengkap },
    });

    return json({
      status: "ok",
      message: `Password ${targetUser.nama_lengkap} berhasil direset`,
    });

  } catch (err) {
    console.error("reset-password error:", err);
    return json({ status: "error", message: "Terjadi kesalahan server" }, 500);
  }
});
