/**
 * Browser Supabase client — used ONLY for reads (sidebar, message history)
 * and for Auth. The anon key + RLS policies guarantee each user sees
 * exclusively their own data; all writes go through the Worker API.
 */

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy web/.env.example to web/.env");
}

export const supabase = createClient(url, anonKey);
