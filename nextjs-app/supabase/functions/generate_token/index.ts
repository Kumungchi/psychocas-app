import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateTokenCode } from "../_shared/token.ts";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    return new Response("Unable to verify session", { status: 401 });
  }

  const user = session?.user ?? null;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { error: ensureError } = await supabase.rpc('ensure_membership_from_whitelist');
  if (ensureError) {
    console.warn('ensure_membership_from_whitelist RPC failed', ensureError);
  }

  const { data: me, error: membershipError } = await supabase
    .from("memberships")
    .select("membership_active, membership_expires")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    console.warn('Unable to load membership in generate_token', membershipError);
  }

  const membershipExpires = me?.membership_expires
    ? new Date(me.membership_expires)
    : null;
  const membershipActive =
    Boolean(me?.membership_active) && (!membershipExpires || membershipExpires.getTime() > Date.now());

  if (!membershipActive) {
    return new Response(
      JSON.stringify({ error: "membership_inactive" }),
      { status: 403 }
    );
  }

  const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("tokens")
    .insert({ 
      code: generateTokenCode(),
      user_id: user.id, 
      expires_at: expiresAt 
    })
    .select("*")
    .single();
    
  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 400 }
    );
  }

  return new Response(
    JSON.stringify({ 
      code: data.code, 
      expiresAt: data.expires_at 
    }), 
    { 
      headers: { "Content-Type": "application/json" }
    }
  );
});