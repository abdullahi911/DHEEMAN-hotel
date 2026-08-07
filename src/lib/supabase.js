import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function signInWithGoogle() {
  if (!supabase) return { error: { message: "Supabase configuration is missing" } };
  const redirectUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  return await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
    },
  });
}

export async function signInWithEmail(email, password) {
  if (!supabase) return { error: { message: "Supabase configuration is missing" } };
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email, password) {
  if (!supabase) return { error: { message: "Supabase configuration is missing" } };
  return await supabase.auth.signUp({ email, password });
}

export async function signOutUser() {
  if (!supabase) return;
  return await supabase.auth.signOut();
}
