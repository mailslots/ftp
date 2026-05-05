import { KNOWLEDGE_BUCKET, getSupabaseAdmin } from "@/lib/supabase";
import type { KnowledgeChunk, KnowledgeDocument } from "@/lib/types";

const MAX_TEXT_LENGTH = 180_000;
const CHUNK_SIZE = 1_200;
const CHUNK_OVERLAP = 160;

export function getSourceType(mimeType: string, filename: string): KnowledgeDocument["source_type"] {
  const lower = filename.toLowerCase();
  if (mimeType.includes("pdf") || lower.endsWith(".pdf")) return "pdf";
  if (mimeType.includes("word") || lower.endsWith(".docx") || lower.endsWith(".doc")) return "doc";
  if (mimeType.startsWith("image/")) return "image";
  return "text";
}

export function makeChunks(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
  if (!cleaned) return [];

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < cleaned.length) {
    const end = Math.min(cursor + CHUNK_SIZE, cleaned.length);
    chunks.push(cleaned.slice(cursor, end).trim());
    if (end === cleaned.length) break;
    cursor = Math.max(0, end - CHUNK_OVERLAP);
  }

  return chunks.filter(Boolean);
}

export async function extractTextFromFile(file: File, sourceType: KnowledgeDocument["source_type"], notes: string) {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (sourceType === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text || notes;
  }

  if (sourceType === "doc" && file.name.toLowerCase().endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value || notes;
  }

  if (sourceType === "image") {
    return notes || `รูปภาพ: ${file.name}. โปรดเพิ่มคำอธิบายภาพในช่องบันทึกเพื่อให้พี่เทคใช้อ้างอิงได้ดีขึ้น`;
  }

  return notes;
}

export async function listDocuments() {
  const supabase = getSupabaseAdmin();
  await deleteExpiredDocuments();

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("*")
    .is("deleted_at", null)
    .order("expires_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as KnowledgeDocument[];
}

async function insertDocument(input: {
  title: string;
  sourceType: KnowledgeDocument["source_type"];
  mimeType: string | null;
  filePath: string | null;
  fileSize: number | null;
  extractedText: string;
  notes: string;
  category: KnowledgeDocument["category"];
  expiresAt: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const { data: document, error: insertError } = await supabase
    .from("knowledge_documents")
    .insert({
      title: input.title,
      source_type: input.sourceType,
      mime_type: input.mimeType,
      file_path: input.filePath,
      file_size: input.fileSize,
      extracted_text: input.extractedText,
      notes: input.notes || null,
      category: input.category,
      expires_at: input.expiresAt || null,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;

  const chunks = makeChunks([input.title, input.notes, input.extractedText].filter(Boolean).join("\n\n"));
  if (chunks.length) {
    const { error: chunkError } = await supabase.from("knowledge_chunks").insert(
      chunks.map((content, index) => ({
        document_id: document.id,
        chunk_index: index,
        content,
      })),
    );
    if (chunkError) throw chunkError;
  }

  return document as KnowledgeDocument;
}

export async function createTextKnowledgeDocument(input: {
  title: string;
  text: string;
  expiresAt: string | null;
  notes: string;
  category: KnowledgeDocument["category"];
}) {
  const text = input.text.trim();
  if (!text) throw new Error("กรุณาใส่ข้อความหรือเลือกไฟล์");

  return insertDocument({
    title: input.title || "ข้อความจากแอดมิน",
    sourceType: "text",
    mimeType: "text/plain",
    filePath: null,
    fileSize: Buffer.byteLength(text, "utf8"),
    extractedText: text,
    notes: input.notes,
    category: input.category,
    expiresAt: input.expiresAt,
  });
}

export async function createKnowledgeDocument(input: {
  file: File;
  title: string;
  expiresAt: string | null;
  notes: string;
  category: KnowledgeDocument["category"];
}) {
  const supabase = getSupabaseAdmin();
  const mimeType = input.file.type || "application/octet-stream";
  const sourceType = getSourceType(mimeType, input.file.name);
  const extractedText = await extractTextFromFile(input.file, sourceType, input.notes);
  const path = `${Date.now()}-${crypto.randomUUID()}-${input.file.name.replace(/[^\w.\-ก-๙]+/g, "-")}`;

  const { error: uploadError } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .upload(path, input.file, { contentType: mimeType, upsert: false });

  if (uploadError) throw uploadError;

  return insertDocument({
    title: input.title || input.file.name,
    sourceType,
    mimeType,
    filePath: path,
    fileSize: input.file.size,
    extractedText,
    notes: input.notes,
    category: input.category,
    expiresAt: input.expiresAt,
  });
}

export async function deleteDocument(id: string) {
  const supabase = getSupabaseAdmin();
  const { data: document, error: findError } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", id)
    .single();

  if (findError) throw findError;
  if (document?.file_path) {
    await supabase.storage.from(KNOWLEDGE_BUCKET).remove([document.file_path]);
  }

  const { error } = await supabase.from("knowledge_documents").delete().eq("id", id);
  if (error) throw error;
}

export async function updateTextDocument(input: {
  id: string;
  title: string;
  text: string;
  expiresAt: string | null;
  notes: string;
  category: KnowledgeDocument["category"];
}) {
  const supabase = getSupabaseAdmin();
  const text = input.text.trim();
  if (!text) throw new Error("กรุณาใส่ข้อความ");

  const { data: document, error } = await supabase
    .from("knowledge_documents")
    .update({
      title: input.title || "ข้อความจากแอดมิน",
      source_type: "text",
      mime_type: "text/plain",
      file_size: Buffer.byteLength(text, "utf8"),
      extracted_text: text,
      notes: input.notes || null,
      category: input.category,
      expires_at: input.expiresAt || null,
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) throw error;

  await supabase.from("knowledge_chunks").delete().eq("document_id", input.id);
  const chunks = makeChunks([input.title, input.notes, text].filter(Boolean).join("\n\n"));
  if (chunks.length) {
    const { error: chunkError } = await supabase.from("knowledge_chunks").insert(
      chunks.map((content, index) => ({
        document_id: input.id,
        chunk_index: index,
        content,
      })),
    );
    if (chunkError) throw chunkError;
  }

  return document as KnowledgeDocument;
}

export async function deleteExpiredDocuments() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("id,file_path")
    .is("deleted_at", null)
    .not("expires_at", "is", null)
    .lte("expires_at", new Date().toISOString());

  if (error) throw error;
  const expired = data ?? [];
  if (!expired.length) return 0;

  const filePaths = expired.map((item) => item.file_path).filter(Boolean) as string[];
  if (filePaths.length) {
    await supabase.storage.from(KNOWLEDGE_BUCKET).remove(filePaths);
  }

  const { error: deleteError } = await supabase
    .from("knowledge_documents")
    .delete()
    .in(
      "id",
      expired.map((item) => item.id),
    );

  if (deleteError) throw deleteError;
  return expired.length;
}

export async function searchKnowledge(query: string) {
  const supabase = getSupabaseAdmin();
  await deleteExpiredDocuments();

  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("*, knowledge_documents!inner(id,title,source_type,expires_at)")
    .is("knowledge_documents.deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) throw error;

  const normalizedQuery = query.toLowerCase().replace(/\s+/g, " ").trim();
  const terms = normalizedQuery
    .split(/[\s,.;:!?()[\]{}"'????]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);

  const yearMatches = [...normalizedQuery.matchAll(/(?:\u0e1b\u0e35|\u0e1b\u0e35\u0e17\u0e35\u0e48|\u0e0a\u0e31\u0e49\u0e19\u0e1b\u0e35|\u0e0a\u0e31\u0e49\u0e19\u0e1b\u0e35\u0e17\u0e35\u0e48)\s*(\d)/g)].map((match) => match[1]);
  for (const year of yearMatches) {
    terms.push("\u0e1b\u0e35 " + year, "\u0e1b\u0e35\u0e17\u0e35\u0e48 " + year, "\u0e0a\u0e31\u0e49\u0e19\u0e1b\u0e35\u0e17\u0e35\u0e48 " + year, "\u0e0a\u0e31\u0e49\u0e19\u0e1b\u0e35 " + year);
  }

  const termMatches = [...normalizedQuery.matchAll(/(?:\u0e40\u0e17\u0e2d\u0e21|\u0e20\u0e32\u0e04|\u0e20\u0e32\u0e04\u0e01\u0e32\u0e23\u0e28\u0e36\u0e01\u0e29\u0e32\u0e17\u0e35\u0e48)\s*(\d)/g)].map((match) => match[1]);
  for (const term of termMatches) {
    terms.push("\u0e40\u0e17\u0e2d\u0e21 " + term, "\u0e20\u0e32\u0e04\u0e01\u0e32\u0e23\u0e28\u0e36\u0e01\u0e29\u0e32\u0e17\u0e35\u0e48 " + term, "\u0e20\u0e32\u0e04 " + term);
  }

  if (normalizedQuery.includes("\u0e40\u0e23\u0e35\u0e22\u0e19\u0e2d\u0e30\u0e44\u0e23") || normalizedQuery.includes("\u0e40\u0e23\u0e35\u0e22\u0e19\u0e2d\u0e30\u0e44\u0e23\u0e1a\u0e49\u0e32\u0e07")) {
    terms.push("\u0e41\u0e1c\u0e19\u0e01\u0e32\u0e23\u0e40\u0e23\u0e35\u0e22\u0e19", "\u0e23\u0e32\u0e22\u0e27\u0e34\u0e0a\u0e32", "\u0e40\u0e23\u0e35\u0e22\u0e19\u0e2d\u0e30\u0e44\u0e23\u0e1a\u0e49\u0e32\u0e07");
  }

  const faqKeywords = [
    "\u0e2b\u0e25\u0e31\u0e01\u0e2a\u0e39\u0e15\u0e23",
    "\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e01\u0e34\u0e15",
    "\u0e2d\u0e32\u0e0a\u0e35\u0e1e",
    "\u0e08\u0e1a",
    "\u0e1d\u0e36\u0e01\u0e07\u0e32\u0e19",
    "\u0e2a\u0e2b\u0e01\u0e34\u0e08",
    "\u0e2a\u0e21\u0e31\u0e04\u0e23",
    "\u0e2d\u0e32\u0e08\u0e32\u0e23\u0e22\u0e4c",
    "\u0e1b\u0e23\u0e30\u0e01\u0e31\u0e19",
    "\u0e40\u0e04\u0e23\u0e35\u0e22\u0e14",
    "\u0e40\u0e28\u0e23\u0e49\u0e32",
    "\u0e23\u0e35\u0e44\u0e17\u0e23\u0e4c",
    "\u0e1e\u0e49\u0e19\u0e2a\u0e20\u0e32\u0e1e",
    "ปฏิทิน",
    "ปฏิทินการศึกษา",
    "เปิดเทอม",
    "เปิดภาคเรียน",
    "ปิดเทอม",
    "วันสุดท้ายของภาค",
    "สอบกลางภาค",
    "สอบปลายภาค",
    "ขอจบ",
    "ขอสำเร็จ",
    "สำเร็จการศึกษา",
    "ขึ้นทะเบียนบัณฑิต",
    "english exit",
    "ลงทะเบียน",
    "เพิ่มถอน",
    "ชำระเงิน",
    "วันหยุด",
    "สงกรานต์",
  ];
  for (const keyword of faqKeywords) {
    if (normalizedQuery.includes(keyword)) terms.push(keyword);
  }
  if (normalizedQuery.includes("retire")) terms.push("retire");
  if (normalizedQuery.includes("gpa")) terms.push("gpa");
  if (normalizedQuery.includes("\u0e01\u0e35\u0e48\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e01\u0e34\u0e15")) {
    terms.push("\u0e15\u0e49\u0e2d\u0e07\u0e40\u0e23\u0e35\u0e22\u0e19\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14\u0e01\u0e35\u0e48\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e01\u0e34\u0e15", "124");
  }
  if (normalizedQuery.includes("\u0e2d\u0e32\u0e0a\u0e35\u0e1e")) {
    terms.push("\u0e1b\u0e23\u0e30\u0e01\u0e2d\u0e1a\u0e2d\u0e32\u0e0a\u0e35\u0e1e", "\u0e0a\u0e48\u0e32\u0e07\u0e20\u0e32\u0e1e", "photographer", "editor");
  }
  if (normalizedQuery.includes("\u0e40\u0e04\u0e23\u0e35\u0e22\u0e14") || normalizedQuery.includes("\u0e40\u0e28\u0e23\u0e49\u0e32")) {
    terms.push("\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e49\u0e04\u0e33\u0e1b\u0e23\u0e36\u0e01\u0e29\u0e32", "0 2549 3024");
  }

  const now = Date.now();

  return ((data ?? []) as KnowledgeChunk[])
    .filter((chunk) => {
      const expiresAt = chunk.knowledge_documents?.expires_at;
      return !expiresAt || new Date(expiresAt).getTime() > now;
    })
    .map((chunk) => {
      const title = chunk.knowledge_documents?.title?.toLowerCase() || "";
      const content = `${title}\n${chunk.content}`.toLowerCase();
      const compactContent = content.replace(/\s+/g, "");
      const score = [...new Set(terms)].reduce((sum, term) => {
        const compactTerm = term.replace(/\s+/g, "");
        return sum + (content.includes(term) || compactContent.includes(compactTerm) ? 2 : 0);
      }, 0);
      return { ...chunk, score };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk_index - b.chunk_index)
    .slice(0, 6);
}

export async function getStudyPlanChunks(year: string, term: string) {
  const supabase = getSupabaseAdmin();
  await deleteExpiredDocuments();

  let query = supabase
    .from("knowledge_chunks")
    .select("*, knowledge_documents!inner(id,title,source_type,expires_at)")
    .is("knowledge_documents.deleted_at", null)
    .like("knowledge_documents.title", `%year ${year}%`)
    .like("knowledge_documents.title", "FTP study plan%")
    .order("created_at", { ascending: true })
    .limit(12);

  if (term) {
    query = query.like("knowledge_documents.title", `%term ${term}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const now = Date.now();
  return ((data ?? []) as KnowledgeChunk[]).filter((chunk) => {
    const expiresAt = chunk.knowledge_documents?.expires_at;
    return !expiresAt || new Date(expiresAt).getTime() > now;
  });
}
