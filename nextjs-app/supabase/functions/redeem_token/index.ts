import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const body = await req.json();
  const code = (body?.code || "").toString().trim().toUpperCase();

  if (!code) {
    return new Response(
      JSON.stringify({ error: "missing_code" }),
      { status: 400 }
    );
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const svc = createClient(url, service);
  const userClient = createClient(url, anon, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization")!
      }
    }
  });

  const {
    data: { session },
    error: sessionError,
  } = await userClient.auth.getSession();

  if (sessionError) {
    return new Response("Unable to verify session", { status: 401 });
  }

  const user = session?.user ?? null;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { error: ensureError } = await userClient.rpc("ensure_membership_from_whitelist");
  if (ensureError) {
    console.warn("ensure_membership_from_whitelist RPC failed", ensureError);
  }

  const {
    data: membership,
    error: membershipError,
  } = await userClient
    .from("memberships")
    .select("role, branch_id, membership_active, membership_expires")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    console.error("Failed to resolve membership for redeemer", membershipError);
    return new Response(
      JSON.stringify({ error: "membership_lookup_failed" }),
      { status: 500 }
    );
  }

  const membershipExpires = membership?.membership_expires
    ? new Date(membership.membership_expires)
    : null;
  const membershipActive =
    Boolean(membership?.membership_active) && (!membershipExpires || membershipExpires.getTime() > Date.now());

  if (!membershipActive) {
    return new Response(
      JSON.stringify({ error: "membership_inactive" }),
      { status: 403 }
    );
  }

  if (!membership || membership.role !== "manager") {
    return new Response(
      JSON.stringify({ error: "forbidden" }),
      { status: 403 }
    );
  }

  const branchId = membership.branch_id ?? null;
  if (!branchId) {
    return new Response(
      JSON.stringify({ error: "missing_branch" }),
      { status: 400 }
    );
  }

  const { data: tok } = await svc
    .from("tokens")
    .select("id, code, user_id, expires_at, consumed_at")
    .eq("code", code)
    .maybeSingle();

  if (!tok || tok.consumed_at) {
    return new Response(
      JSON.stringify({ valid: false, reason: "used_or_not_found" }),
      { status: 200 }
    );
  }

  if (new Date(tok.expires_at).getTime() < Date.now()) {
    return new Response(
      JSON.stringify({ valid: false, reason: "expired" }),
      { status: 200 }
    );
  }

  const { data: owner, error: ownerError } = await svc
    .from("memberships")
    .select("membership_active, membership_expires")
    .eq("user_id", tok.user_id)
    .maybeSingle();

  if (ownerError) {
    console.error("Failed to load membership for token owner", ownerError);
    return new Response(
      JSON.stringify({ valid: false, reason: "owner_lookup_failed" }),
      { status: 200 }
    );
  }

  const ownerExpires = owner?.membership_expires
    ? new Date(owner.membership_expires)
    : null;
  const ownerActive =
    Boolean(owner?.membership_active) && (!ownerExpires || ownerExpires.getTime() > Date.now());

  if (!ownerActive) {
    return new Response(
      JSON.stringify({ valid: false, reason: "inactive_membership" }),
      { status: 200 }
    );
  }

  await svc
    .from("tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", tok.id);

  await svc
    .from("redemptions")
    .insert({
      token_id: tok.id,
      branch_id: branchId
    });

  return new Response(
    JSON.stringify({ valid: true }),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
});
