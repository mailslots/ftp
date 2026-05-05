import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "data");

async function loadEnv() {
  const envPath = path.join(projectRoot, ".env.local");
  try {
    const text = await readFile(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      process.env[key] ??= valueParts.join("=").replace(/^"|"$/g, "");
    }
  } catch {}
}

const docs = [
  {
    title: "AI READY RMUTT retire academic status criteria",
    text: [
      "AI READY ข้อมูลเกณฑ์ Retire / รีไทร์ / พ้นสภาพนักศึกษา เนื่องจากผลการศึกษา",
      "คำถาม: เมื่อไหร่จะ Retire",
      "คำถาม: รีไทร์ตอนไหน",
      "คำถาม: GPA เท่าไหร่ถึงพ้นสภาพ",
      "คำถาม: เกรดเฉลี่ยเท่าไหร่ถึงโดนรีไทร์",
      "คำถาม: หน่วยกิตเท่าไหร่ถึงพ้นสภาพ",
      "คำตอบ:",
      "นักศึกษาจะเข้าข่ายพ้นสภาพเนื่องจากผลการศึกษา เมื่อเกรดเฉลี่ยสะสมและหน่วยกิตสะสมเข้าเงื่อนไขต่อไปนี้",
      "1. เกรดเฉลี่ยสะสมต่ำกว่า 1.00 และมีหน่วยกิตสะสมน้อยกว่า 30 หน่วยกิต",
      "2. เกรดเฉลี่ยสะสมต่ำกว่า 1.50 และมีหน่วยกิตสะสมระหว่าง 30-59 หน่วยกิต",
      "3. เกรดเฉลี่ยสะสมต่ำกว่า 1.75 และมีหน่วยกิตสะสมตั้งแต่ 60 หน่วยกิตขึ้นไป จนถึงก่อนครบหน่วยกิตตามหลักสูตร",
      "4. เกรดเฉลี่ยสะสมต่ำกว่า 1.80 และมีหน่วยกิตสะสมครบตามหลักสูตร",
      "สรุปสั้นๆ คือ ยิ่งเรียนไปไกล เกณฑ์ GPA ขั้นต่ำที่ต้องรักษาจะสูงขึ้น ถ้าเริ่มเสี่ยงควรรีบคุยกับอาจารย์ที่ปรึกษาและวางแผนลงทะเบียนซ่อม/เรียนซ้ำทันที",
      "แหล่งที่มา: ประกาศมหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี เรื่อง เกณฑ์การวัดและประเมินผลการศึกษาระดับปริญญาตรี ข้อ 18",
    ].join("\n"),
  },
  {
    title: "AI READY RMUTT retire quick answer",
    text: [
      "AI READY คำตอบเร็ว Retire รีไทร์ พ้นสภาพ",
      "คำถาม: จะโดนรีไทร์ไหม",
      "คำถาม: เช็กรีไทร์ยังไง",
      "คำตอบ:",
      "ให้เช็ก 2 อย่างคู่กัน: เกรดเฉลี่ยสะสม (GPA) และหน่วยกิตสะสม",
      "ถ้าหน่วยกิตสะสมน้อยกว่า 30 ต้องไม่ต่ำกว่า GPA 1.00",
      "ถ้าหน่วยกิตสะสม 30-59 ต้องไม่ต่ำกว่า GPA 1.50",
      "ถ้าหน่วยกิตสะสมตั้งแต่ 60 ขึ้นไป ต้องไม่ต่ำกว่า GPA 1.75",
      "ถ้าหน่วยกิตครบหลักสูตร ต้องไม่ต่ำกว่า GPA 1.80",
      "ถ้าไม่แน่ใจ ส่ง GPA กับหน่วยกิตสะสมมาถามพี่เทคได้ พี่จะช่วยเทียบเกณฑ์ให้",
      "แหล่งที่มา: ประกาศมหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี ข้อ 18",
    ].join("\n"),
  },
  {
    title: "AI READY RMUTT grade symbols and credits note for retire",
    text: [
      "AI READY หมายเหตุเรื่องเกรดและหน่วยกิตที่เกี่ยวกับการพ้นสภาพ",
      "คำถาม: เกรดอะไรนับ GPA",
      "คำถาม: I W AU นับไหม",
      "คำตอบ:",
      "การคิดหน่วยกิตสะสมสำหรับเกณฑ์การพ้นสภาพ ให้นับหน่วยกิตทุกรายวิชาที่นักศึกษาได้รับระดับคะแนน ยกเว้นรายวิชาที่ได้ I, W และ AU",
      "ระดับคะแนนหลักที่มีค่าระดับคะแนน เช่น A = 4.0, B+ = 3.5, B = 3.0, C+ = 2.5, C = 2.0, D+ = 1.5, D = 1.0, F = 0.0",
      "รายวิชา S หรือ U จะไม่นำมาคำนวณ GPA ภาคและ GPA สะสม",
      "แหล่งที่มา: ประกาศมหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี ข้อ 2, 9, 15 และ 17",
    ].join("\n"),
  },
];

await loadEnv();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const existing = await supabase.from("knowledge_documents").select("id").like("title", "AI READY RMUTT retire%");
if (existing.error) throw existing.error;

const existingIds = (existing.data ?? []).map((item) => item.id);
if (existingIds.length) {
  const chunkDelete = await supabase.from("knowledge_chunks").delete().in("document_id", existingIds);
  if (chunkDelete.error) throw chunkDelete.error;
  const docDelete = await supabase.from("knowledge_documents").delete().in("id", existingIds);
  if (docDelete.error) throw docDelete.error;
}

const rows = docs.map((doc) => ({
  title: doc.title,
  source_type: "text",
  mime_type: "text/plain",
  file_path: null,
  file_size: Buffer.byteLength(doc.text, "utf8"),
  extracted_text: doc.text,
  notes: "AI-ready retire/pun-saphap criteria from RMUTT undergraduate grading announcement PDF.",
  expires_at: null,
}));

const inserted = await supabase.from("knowledge_documents").insert(rows).select("id,title,extracted_text");
if (inserted.error) throw inserted.error;

const chunks = inserted.data.map((doc) => ({
  document_id: doc.id,
  chunk_index: 0,
  content: `${doc.title}\n\n${doc.extracted_text}`,
}));
const chunkInsert = await supabase.from("knowledge_chunks").insert(chunks);
if (chunkInsert.error) throw chunkInsert.error;

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "rmutt_retire_ai_ready_knowledge.json"), JSON.stringify(docs, null, 2), "utf8");
await writeFile(path.join(outputDir, "rmutt_retire_ai_ready_knowledge.txt"), docs.map((doc) => `# ${doc.title}\n${doc.text}`).join("\n\n---\n\n"), "utf8");

console.log(
  JSON.stringify(
    {
      deletedExisting: existingIds.length,
      insertedDocuments: inserted.data.length,
      insertedChunks: chunks.length,
      outputJson: path.join(outputDir, "rmutt_retire_ai_ready_knowledge.json"),
      outputText: path.join(outputDir, "rmutt_retire_ai_ready_knowledge.txt"),
    },
    null,
    2,
  ),
);
