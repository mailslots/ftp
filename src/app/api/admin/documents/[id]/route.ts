import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { deleteDocument, updateTextDocument } from "@/lib/knowledge";
import type { KnowledgeDocument } from "@/lib/types";

export const runtime = "nodejs";

const categories: KnowledgeDocument["category"][] = ["branch", "academic", "student_development", "academic_staff", "administration", "other"];

function normalizeCategory(value: unknown): KnowledgeDocument["category"] {
  const category = String(value || "branch") as KnowledgeDocument["category"];
  return categories.includes(category) ? category : "branch";
}

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
      category?: string;
    };

    const document = await updateTextDocument({
      id,
      title: String(body.title || ""),
      text: String(body.text || ""),
      expiresAt: body.expiresAt || null,
      notes: String(body.notes || ""),
      category: normalizeCategory(body.category),
    });

    return NextResponse.json({ document });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
