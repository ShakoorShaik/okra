// Replaced by Supabase Realtime — see src/lib/supabase.ts
// Keeping this file so existing imports don't break during migration.
export async function broadcastNewReport(_report: unknown): Promise<void> {
  // No-op: inserts to Supabase now trigger Realtime automatically via postgres_changes
}
