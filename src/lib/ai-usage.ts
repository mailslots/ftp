import { AI_MODEL_SEQUENCE } from "@/lib/llm";
import { getSupabaseAdmin } from "@/lib/supabase";

export const AI_USAGE_DOCUMENT_TITLE = "__ptech_ai_usage__";

type UsageStore = {
  byDay: Record<string, Record<string, number>>;
  allTime: Record<string, number>;
};

export type AiUsagePeriod = "day" | "month" | "year" | "all";

function emptyStore(): UsageStore {
  return { byDay: {}, allTime: {} };
}

function parseStore(value: string | null | undefined): UsageStore {
  if (!value) return emptyStore();
  try {
    const parsed = JSON.parse(value) as Partial<UsageStore>;
    return {
      byDay: parsed.byDay && typeof parsed.byDay === "object" ? parsed.byDay : {},
      allTime: parsed.allTime && typeof parsed.allTime === "object" ? parsed.allTime : {},
    };
  } catch {
    return emptyStore();
  }
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function modelKeyFromProvider(provider: string) {
  if (/^groq:/i.test(provider)) {
    return provider.replace(/^groq:/i, "").replace(/:rank-\d+.*/i, "");
  }
  if (/deepseek/i.test(provider)) return "deepseek-v4-flash";
  return provider.replace(/-after-.*/i, "").replace(/-fallback-.*/i, "").replace(/-empty.*/i, "");
}

function totalForPeriod(store: UsageStore, period: AiUsagePeriod, model: string) {
  if (period === "all") return store.allTime[model] || 0;
  const nowKey = dateKey();
  const prefix = period === "day" ? nowKey : period === "month" ? nowKey.slice(0, 7) : nowKey.slice(0, 4);
  return Object.entries(store.byDay).reduce((sum, [day, counts]) => {
    return day.startsWith(prefix) ? sum + (counts[model] || 0) : sum;
  }, 0);
}

async function readUsageDocument() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("id,extracted_text")
    .eq("title", AI_USAGE_DOCUMENT_TITLE)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data as { id: string; extracted_text: string | null } | null;
}

async function writeUsageStore(store: UsageStore, existingId?: string) {
  const supabase = getSupabaseAdmin();
  const text = JSON.stringify(store);
  if (existingId) {
    const { error } = await supabase
      .from("knowledge_documents")
      .update({
        source_type: "text",
        mime_type: "application/json",
        file_size: Buffer.byteLength(text, "utf8"),
        extracted_text: text,
        notes: "AI usage counters. Hidden from admin knowledge table.",
        category: "other",
        expires_at: null,
      })
      .eq("id", existingId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("knowledge_documents").insert({
    title: AI_USAGE_DOCUMENT_TITLE,
    source_type: "text",
    mime_type: "application/json",
    file_path: null,
    file_size: Buffer.byteLength(text, "utf8"),
    extracted_text: text,
    notes: "AI usage counters. Hidden from admin knowledge table.",
    category: "other",
    expires_at: null,
  });
  if (error) throw error;
}

export async function recordAiUsage(provider: string) {
  const model = modelKeyFromProvider(provider);
  if (!model || model.includes("fallback")) return;

  const existing = await readUsageDocument();
  const store = parseStore(existing?.extracted_text);
  const day = dateKey();
  store.byDay[day] = store.byDay[day] || {};
  store.byDay[day][model] = (store.byDay[day][model] || 0) + 1;
  store.allTime[model] = (store.allTime[model] || 0) + 1;
  await writeUsageStore(store, existing?.id);
}

export async function getAiUsage(period: AiUsagePeriod) {
  const existing = await readUsageDocument();
  const store = parseStore(existing?.extracted_text);
  return AI_MODEL_SEQUENCE.map((item, index) => ({
    id: `${item.provider}:${item.model}`,
    order: index + 1,
    provider: item.provider,
    model: item.model,
    count: totalForPeriod(store, period, item.model),
    used: totalForPeriod(store, period, item.model) > 0,
  }));
}
