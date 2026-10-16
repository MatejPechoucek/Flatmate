import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  console.warn("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_KEY — copy .env.example to .env.local");
}

// Placeholders keep `next build` working without env vars; requests fail until they are set.
export const supabase = createClient(url ?? "http://localhost:54321", key ?? "missing-key");
