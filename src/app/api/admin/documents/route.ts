import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { createKnowledgeDocument, createTextKnowledgeDocument, listDocuments } from "@/lib/knowledge";
import type { KnowledgeDocument } from "@/lib/types";

export const runtime = "nodejs";

const categories: KnowledgeDocument["category"][] = ["branch", "academic", "student_development", "academic_staff", "administration", "other"];

function normalizeCategory(value: FormDataEntryValue | null): KnowledgeDocument["category"] {
  const category = String(value || "branch") as KnowledgeDocument["category"];
  return categories.includes(category) ? category : "branch";
}

export async function GET() {
  try {
    await requireAdminSession();
    const documents = await listDocuments();
    return NextResponse.json({ documents });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const form = await request.formData();
    const file = form.get("file");
    const text = String(form.get("text") || "");
    const title = String(form.get("title") || "");
    const expiresAt = String(form.get("expiresAt") || "") || null;
    const notes = String(form.get("notes") || "");
    const category = normalizeCategory(form.get("category"));

    const hasFile = file instanceof File && file.size > 0;
    const document = hasFile
      ? await createKnowledgeDocument({
          file,
          title: title || file.name,
          expiresAt,
          notes,
          category,
        })
      : await createTextKnowledgeDocument({
          title,
          text,
          expiresAt,
          notes,
          category,
        });

    return NextResponse.json({ document });
  } catch (error) {
    return handleApiError(error);
  }
}

function handleApiError(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}
