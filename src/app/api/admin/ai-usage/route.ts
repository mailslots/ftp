import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { getAppSettings } from "@/lib/app-settings";
import { getAiUsage, type AiUsagePeriod } from "@/lib/ai-usage";

export const runtime = "nodejs";

const periods: AiUsagePeriod[] = ["day", "month", "year", "all"];

export async function GET(request: Request) {
  try {
    await requireAdminSession();
    const period = new URL(request.url).searchParams.get("period");
    const selectedPeriod = periods.includes(period as AiUsagePeriod) ? (period as AiUsagePeriod) : "day";
    const settings = await getAppSettings();
    const usage = await getAiUsage(selectedPeriod, settings);
    return NextResponse.json({ period: selectedPeriod, models: usage.models, total: usage.total, settings });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
