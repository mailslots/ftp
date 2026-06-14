import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || key.includes("replace-with")) {
    throw new Error("Supabase server environment variables are not configured.");
  }

  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  return adminClient;
}

export const KNOWLEDGE_DOCUMENTS_TABLE = process.env.SUPABASE_KNOWLEDGE_DOCUMENTS_TABLE || "ptech_knowledge_documents";
export const KNOWLEDGE_CHUNKS_TABLE = process.env.SUPABASE_KNOWLEDGE_CHUNKS_TABLE || "ptech_knowledge_chunks";
export const NINEQ_ASSESSMENTS_TABLE = process.env.SUPABASE_NINEQ_ASSESSMENTS_TABLE || "ptech_nineq_assessments";
export const KNOWLEDGE_DOCUMENTS_RELATION = `knowledge_documents:${KNOWLEDGE_DOCUMENTS_TABLE}!inner(id,title,source_type,expires_at)`;
export const KNOWLEDGE_DOCUMENTS_QUERY_PREFIX = "knowledge_documents";
export const KNOWLEDGE_BUCKET = process.env.SUPABASE_KNOWLEDGE_BUCKET || "ptech-knowledge";
