// =============================================================================
// EDGE FUNCTION: generate_token
// =============================================================================
// Called when a member taps "Use discount" in the app.
// Creates a 3-minute, single-use token linked to a specific discount.
//
// REQUEST:
//   POST /functions/v1/generate_token
//   Headers: Authorization: Bearer <user_jwt>
//   Body: { "discount_id": "<uuid>" }
//
// RESPONSE (success):
//   { "token_hash": "...", "code": "PSYCH-A7B2C3", "expires_at": "...", "validation_url": "..." }
//
// ERRORS:
//   401 — not logged in
//   403 — membership inactive or expired
//   400 — active token already exists (anti-spam trigger)
//   400 — invalid discount_id
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Generate a short human-readable code: PSYCH-XXXXXX
// Excludes confusable characters: 0, 1, I, O
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "PSYCH-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// CORS headers — needed for browser requests from the Vite app
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { discount_id } = await req.json();
    if (!discount_id) {
      return new Response(
        JSON.stringify({ error: "missing_discount_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a client that acts as the logged-in user (respects RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // Service role client — bypasses RLS (for reading whitelist, inserting token)
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Verify the user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get the member profile
    const { data: member } = await svc
      .from("members")
      .select("id, branch_id, whitelist_id")
      .eq("user_id", user.id)
      .single();

    if (!member) {
      return new Response(
        JSON.stringify({ error: "member_not_found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check membership is active (from whitelist)
    const { data: whitelist } = await svc
      .from("member_whitelist")
      .select("is_active, membership_expires_at")
      .eq("id", member.whitelist_id)
      .single();

    if (!whitelist?.is_active || new Date(whitelist.membership_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "membership_inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Verify the discount exists and is active
    const { data: discount } = await svc
      .from("discounts")
      .select("id")
      .eq("id", discount_id)
      .eq("is_active", true)
      .single();

    if (!discount) {
      return new Response(
        JSON.stringify({ error: "discount_not_found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Create the token (anti-spam trigger will reject if one is already active)
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    const code = generateCode();

    const { data: token, error: insertError } = await svc
      .from("tokens")
      .insert({
        member_id: member.id,
        discount_id: discount_id,
        code: code,
        expires_at: expiresAt,
      })
      .select("id, token_hash, code, expires_at")
      .single();

    if (insertError) {
      // Anti-spam trigger raises: "Již máte aktivní token..."
      const isSpam = insertError.message.includes("aktivní token");
      return new Response(
        JSON.stringify({
          error: isSpam ? "active_token_exists" : insertError.message,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Build the public validation URL
    // In production this would use the actual domain
    const appUrl = Deno.env.get("APP_URL") || "https://psychocas.vercel.app";
    const validationUrl = `${appUrl}/v/${token.token_hash}`;

    return new Response(
      JSON.stringify({
        token_hash: token.token_hash,
        code: token.code,
        expires_at: token.expires_at,
        validation_url: validationUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch {
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
