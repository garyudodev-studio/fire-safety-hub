import { createBrowserClient } from '@supabase/ssr';

// Fallback dummy JWT to prevent createBrowserClient validation throw during static build
const DUMMY_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.placeholder';

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://placeholder.supabase.co';

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    DUMMY_ANON_KEY;

  cachedClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return cachedClient;
}


