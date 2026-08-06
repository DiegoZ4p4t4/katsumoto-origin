import { createClient } from "npm:@supabase/supabase-js@2";
import { error } from "./http.ts";
import type { SupabaseClientLike } from "./types.ts";

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;

  const supabase = createClient(url, anonKey);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return null;

  const payload = JSON.parse(atob(token.split(".")[1]));
  if (payload.exp && payload.exp < Date.now() / 1000) return null;

  return { userId: user.id };
}

export async function resolveAuth(
  req: Request,
  supabase: SupabaseClientLike,
) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return { error: error("Unauthorized", 401, "NO_AUTH") };

  const token = authHeader.replace("Bearer ", "");
  if (!token || token.length < 10) {
    return { error: error("Unauthorized: empty token", 401, "NO_AUTH") };
  }

  const verified = await verifyToken(token);
  if (!verified) return { error: error("Invalid or expired token", 401, "INVALID_TOKEN") };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", verified.userId)
    .single();

  if (!profile) return { error: error("Profile not found", 403) };
  return {
    userId: verified.userId,
    orgId: (profile as Record<string, unknown>).organization_id,
    role: (profile as Record<string, unknown>).role,
  };
}
