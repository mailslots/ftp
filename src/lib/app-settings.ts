import { KNOWLEDGE_DOCUMENTS_TABLE, getSupabaseAdmin } from "@/lib/supabase";
import type { AppSettings } from "@/lib/types";

export const SETTINGS_DOCUMENT_TITLE = "__ptech_app_settings__";

const DEFAULT_SETTINGS: AppSettings = {
  deepseekCooldownEnabled: false,
  deepseekCooldownLimit: 1,
  groqEnabled: false,
  aiForceEnabled: false,
  aiForceStartOrder: null,
};

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  const settings = value as Partial<AppSettings>;
  const cooldownLimit = Number(settings.deepseekCooldownLimit);
  const forceStartOrder = settings.aiForceStartOrder === null || settings.aiForceStartOrder === undefined ? null : Number(settings.aiForceStartOrder);
  return {
    deepseekCooldownEnabled: Boolean(settings.deepseekCooldownEnabled),
    deepseekCooldownLimit: Number.isFinite(cooldownLimit) ? Math.min(20, Math.max(1, Math.round(cooldownLimit))) : DEFAULT_SETTINGS.deepseekCooldownLimit,
    groqEnabled: Boolean(settings.groqEnabled),
    aiForceEnabled: Boolean(settings.aiForceEnabled),
    aiForceStartOrder: typeof forceStartOrder === "number" && Number.isFinite(forceStartOrder) ? Math.min(30, Math.max(1, Math.round(forceStartOrder))) : DEFAULT_SETTINGS.aiForceStartOrder,
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(KNOWLEDGE_DOCUMENTS_TABLE)
    .select("extracted_text")
    .eq("title", SETTINGS_DOCUMENT_TITLE)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data?.extracted_text) return DEFAULT_SETTINGS;

  try {
    return normalizeSettings(JSON.parse(data.extracted_text));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateAppSettings(input: Partial<AppSettings>) {
  const supabase = getSupabaseAdmin();
  const current = await getAppSettings();
  const next = normalizeSettings({ ...current, ...input });
  const text = JSON.stringify(next);

  const { data: existing, error: findError } = await supabase
    .from(KNOWLEDGE_DOCUMENTS_TABLE)
    .select("id")
    .eq("title", SETTINGS_DOCUMENT_TITLE)
    .is("deleted_at", null)
    .maybeSingle();

  if (findError) throw findError;

  if (existing?.id) {
    const { error } = await supabase
      .from(KNOWLEDGE_DOCUMENTS_TABLE)
      .update({
        source_type: "text",
        mime_type: "application/json",
        file_size: Buffer.byteLength(text, "utf8"),
        extracted_text: text,
        notes: "Application settings. Hidden from admin knowledge table.",
        category: "other",
        expires_at: null,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return next;
  }

  const { error } = await supabase.from(KNOWLEDGE_DOCUMENTS_TABLE).insert({
    title: SETTINGS_DOCUMENT_TITLE,
    source_type: "text",
    mime_type: "application/json",
    file_path: null,
    file_size: Buffer.byteLength(text, "utf8"),
    extracted_text: text,
    notes: "Application settings. Hidden from admin knowledge table.",
    category: "other",
    expires_at: null,
  });
  if (error) throw error;

  return next;
}
