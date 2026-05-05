import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { getAppSettings, updateAppSettings } from "@/lib/app-settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdminSession();
    const settings = await getAppSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdminSession();
    const body = (await request.json()) as {
      deepseekCooldownEnabled?: unknown;
      deepseekCooldownLimit?: unknown;
      groqEnabled?: unknown;
      aiForceEnabled?: unknown;
      aiForceStartOrder?: unknown;
    };
    const settings = await updateAppSettings({
      deepseekCooldownEnabled: Boolean(body.deepseekCooldownEnabled),
      deepseekCooldownLimit: Number(body.deepseekCooldownLimit),
      groqEnabled: Boolean(body.groqEnabled),
      aiForceEnabled: Boolean(body.aiForceEnabled),
      aiForceStartOrder: body.aiForceStartOrder === null ? null : Number(body.aiForceStartOrder),
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

function handleApiError(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}
