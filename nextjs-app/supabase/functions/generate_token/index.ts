import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateTokenCode } from "../_shared/token.ts";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: me } = await supabase
    .from("members")
    .select("membership_active")
    .eq("user_id", user.id)
    .single();
    
  if (!me?.membership_active) {
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