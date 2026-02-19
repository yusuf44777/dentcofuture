import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL (veya NEXT_PUBLIC_SUPABASE_URL) ya da SUPABASE_SERVICE_ROLE_KEY ortam değişkeni eksik."
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
