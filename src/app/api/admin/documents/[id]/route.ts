import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { deleteDocument, updateTextDocument } from "@/lib/knowledge";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();
    const { id } = await context.params;
    await deleteDocument(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();
    const { id } = await context.params;
    const body = (await request.json()) as {
      title?: string;
      text?: string;
      expiresAt?: string | null;
      notes?: string;
    };

    const document = await updateTextDocument({
      id,
      title: String(body.title || ""),
      text: String(body.text || ""),
      expiresAt: body.expiresAt || null,
      notes: String(body.notes || ""),
    });

    return NextResponse.json({ document });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
