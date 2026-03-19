// =============================================================================
// EDGE FUNCTION: redeem_token
// =============================================================================
// Called when a shop scans a QR code or a member's short code is entered.
// This is a PUBLIC endpoint — no login required (shops don't have accounts).
//
// Two lookup methods:
//   1. By token_hash (UUID from QR code URL) — preferred, used by QR scan
//   2. By code ("PSYCH-XXXXXX") — fallback for manual entry
//
// REQUEST:
//   POST /functions/v1/redeem_token
//   Body: { "token_hash": "<uuid>" }   OR   { "code": "PSYCH-XXXXXX" }
//
// RESPONSE:
//   {
//     "status": "valid" | "expired" | "redeemed" | "invalid",
//     "member_name": "Jan Novák",
//     "discount_title": "15 % na všechny nápoje",
//     "discount_value": "15 %",
//     "partner_name": "Café Molo",
//     "membership_expires_at": "2027-06-15",
//     "redeemed_at": null | "2026-03-17T14:30:00Z"
//   }
//
// The function:
//   1. Looks up the token
//   2. Checks if valid (not expired, not already redeemed)
//   3. If valid → marks it as redeemed + creates a redemption row for analytics
//   4. Returns token status + member/discount info for the validation page
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers — needed for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const tokenHash = body?.token_hash?.toString().trim() || null;
    const code = body?.code?.toString().trim().toUpperCase() || null;

    if (!tokenHash && !code) {
      return jsonResponse({ error: "missing_token_hash_or_code" }, 400);
    }

    // Service role client — this is a public endpoint, no user auth needed.
    // We use service_role to bypass RLS since shops don't have accounts.
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Look up the token (by hash or code)
    let query = svc
      .from("tokens")
      .select("id, member_id, discount_id, token_hash, code, expires_at, redeemed_at");

    if (tokenHash) {
      query = query.eq("token_hash", tokenHash);
    } else {
      query = query.eq("code", code!);
    }

    const { data: token } = await query.maybeSingle();

    if (!token) {
      return jsonResponse({
        status: "invalid",
        member_name: null,
        discount_title: null,
        discount_value: null,
        partner_name: null,
        membership_expires_at: null,
        redeemed_at: null,
      });
    }

    // 2. Get member info + whitelist for membership check
    const { data: member } = await svc
      .from("members")
      .select("id, full_name, branch_id, whitelist_id")
      .eq("id", token.member_id)
      .single();

    if (!member) {
      return jsonResponse({
        status: "invalid",
        member_name: null,
        discount_title: null,
        discount_value: null,
        partner_name: null,
        membership_expires_at: null,
        redeemed_at: null,
      });
    }

    const { data: whitelist } = await svc
      .from("member_whitelist")
      .select("membership_expires_at, is_active")
      .eq("id", member.whitelist_id)
      .single();

    // 3. Get discount + partner info
    const { data: discount } = await svc
      .from("discounts")
      .select("id, title, discount_value, partner_id, partner:partners(id, name)")
      .eq("id", token.discount_id)
      .single();

    const partner = discount?.partner as { id: string; name: string } | null;

    // 4. Determine token status
    let status: "valid" | "expired" | "redeemed" | "invalid";

    if (token.redeemed_at) {
      status = "redeemed";
    } else if (new Date(token.expires_at) < new Date()) {
      status = "expired";
    } else if (!whitelist?.is_active || new Date(whitelist.membership_expires_at) < new Date()) {
      status = "invalid"; // membership no longer active
    } else {
      status = "valid";
    }

    // 5. If valid → redeem it (mark token + create redemption row)
    if (status === "valid") {
      const now = new Date().toISOString();

      // Mark token as redeemed
      await svc
        .from("tokens")
        .update({ redeemed_at: now })
        .eq("id", token.id);

      // Create redemption record for analytics (denormalized for fast queries)
      await svc
        .from("redemptions")
        .insert({
          token_id: token.id,
          discount_id: token.discount_id,
          partner_id: discount?.partner_id ?? partner?.id,
          member_id: member.id,
          branch_id: member.branch_id,
          redeemed_at: now,
        });

      // Return with the redeemed_at timestamp
      return jsonResponse({
        status: "valid",
        member_name: member.full_name,
        discount_title: discount?.title ?? null,
        discount_value: discount?.discount_value ?? null,
        partner_name: partner?.name ?? null,
        membership_expires_at: whitelist?.membership_expires_at ?? null,
        redeemed_at: now,
      });
    }

    // 6. Not valid — return status + info (for display purposes)
    return jsonResponse({
      status,
      member_name: member.full_name,
      discount_title: discount?.title ?? null,
      discount_value: discount?.discount_value ?? null,
      partner_name: partner?.name ?? null,
      membership_expires_at: whitelist?.membership_expires_at ?? null,
      redeemed_at: token.redeemed_at,
    });

  } catch {
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
