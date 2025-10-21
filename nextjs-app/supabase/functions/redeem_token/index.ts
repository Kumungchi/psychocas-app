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

  const { data: sessionData } = await userClient.auth.getSession();
  const user = sessionData?.session?.user ?? null;
  if (!user) return new Response("Unauthorized", { status: 401 });

  await userClient.rpc("ensure_membership").catch(() => undefined);

  const { data: manager } = await userClient
    .from("memberships")
    .select("role, branch_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (manager?.role !== "manager" || manager.status !== "active") {
    return new Response(
      JSON.stringify({ error: "forbidden" }), 
      { status: 403 }
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

  const { data: owner } = await svc
    .from("memberships")
    .select("membership_active, status")
    .eq("user_id", tok.user_id)
    .maybeSingle();

  if (!owner?.membership_active || owner.status !== "active") {
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
      branch_id: manager.branch_id 
    });

  return new Response(
    JSON.stringify({ valid: true }), 
    { 
      headers: { "Content-Type": "application/json" }
    }
  );
});
