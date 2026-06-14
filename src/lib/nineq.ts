import { NINEQ_ASSESSMENTS_TABLE, getSupabaseAdmin } from "@/lib/supabase";

export type NineQAssessment = {
  id: string;
  client_id: string | null;
  total_score: number;
  severity: "minimal" | "mild" | "moderate" | "severe";
  severity_label: string;
  q9_score: number;
  answers: number[];
  is_at_risk: boolean;
  voluntary_name: string | null;
  voluntary_year: string | null;
  voluntary_group: string | null;
  voluntary_phone: string | null;
  consent_contact: boolean;
  created_at: string;
  updated_at: string;
};

function severityFromScore(score: number) {
  if (score <= 6) return { severity: "minimal" as const, label: "ปกติ/เศร้าเล็กน้อย" };
  if (score <= 12) return { severity: "mild" as const, label: "ซึมเศร้าเล็กน้อย" };
  if (score <= 18) return { severity: "moderate" as const, label: "ซึมเศร้าปานกลาง" };
  return { severity: "severe" as const, label: "ซึมเศร้ารุนแรง" };
}

function cleanText(value: unknown, maxLength = 120) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

export function shouldStoreNineQ(totalScore: number, q9Score: number) {
  return totalScore >= 7 || q9Score > 0;
}

export async function createNineQAssessment(input: {
  clientId?: string;
  answers: number[];
}) {
  const answers = input.answers.map(Number);
  if (answers.length !== 9 || answers.some((score) => !Number.isInteger(score) || score < 0 || score > 3)) {
    throw new Error("คำตอบ 9Q ไม่ถูกต้อง");
  }

  const totalScore = answers.reduce((sum, score) => sum + score, 0);
  const q9Score = answers[8] ?? 0;
  const isAtRisk = shouldStoreNineQ(totalScore, q9Score);
  if (!isAtRisk) return null;

  const { severity, label } = severityFromScore(totalScore);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(NINEQ_ASSESSMENTS_TABLE)
    .insert({
      client_id: cleanText(input.clientId, 160),
      total_score: totalScore,
      severity,
      severity_label: label,
      q9_score: q9Score,
      answers,
      is_at_risk: isAtRisk,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as NineQAssessment;
}

export async function updateNineQContact(input: {
  id: string;
  name?: unknown;
  year?: unknown;
  group?: unknown;
  phone?: unknown;
  consentContact?: unknown;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(NINEQ_ASSESSMENTS_TABLE)
    .update({
      voluntary_name: cleanText(input.name),
      voluntary_year: cleanText(input.year, 40),
      voluntary_group: cleanText(input.group, 80),
      voluntary_phone: cleanText(input.phone, 40),
      consent_contact: Boolean(input.consentContact),
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) throw error;
  return data as NineQAssessment;
}

export async function listNineQAssessments() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(NINEQ_ASSESSMENTS_TABLE)
    .select("*")
    .eq("is_at_risk", true)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  const assessments = (data ?? []) as NineQAssessment[];
  const monthly = assessments.reduce<Record<string, { month: string; total: number; mild: number; moderate: number; severe: number; q9Risk: number }>>(
    (summary, item) => {
      const month = item.created_at.slice(0, 7);
      summary[month] ??= { month, total: 0, mild: 0, moderate: 0, severe: 0, q9Risk: 0 };
      summary[month].total += 1;
      if (item.severity === "mild") summary[month].mild += 1;
      if (item.severity === "moderate") summary[month].moderate += 1;
      if (item.severity === "severe") summary[month].severe += 1;
      if (item.q9_score > 0) summary[month].q9Risk += 1;
      return summary;
    },
    {},
  );

  return {
    assessments,
    monthly: Object.values(monthly).sort((a, b) => b.month.localeCompare(a.month)),
  };
}
