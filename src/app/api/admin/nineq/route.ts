import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { listNineQAssessments } from "@/lib/nineq";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdminSession();
    const data = await listNineQAssessments();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
