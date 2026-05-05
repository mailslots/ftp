import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "data");
const sourcePath = process.argv[2] || "D:\\Codex\\ftp_courses.csv";
const importPrefix = "FTP course catalog";
const chunkSize = 1_500;
const chunkOverlap = 180;

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

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }

  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return value.replace(/^\uFEFF/, "").trim();
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function makeChunks(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const chunks = [];
  let cursor = 0;

  while (cursor < cleaned.length) {
    const end = Math.min(cursor + chunkSize, cleaned.length);
    chunks.push(cleaned.slice(cursor, end).trim());
    if (end === cleaned.length) break;
    cursor = Math.max(0, end - chunkOverlap);
  }

  return chunks.filter(Boolean);
}

function rowToRecord(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, clean(row[index])]));
}

function makeCourseText(record) {
  const code = record["รหัสวิชา"];
  const thaiName = record["ชื่อวิชาไทย"];
  const englishName = record["ชื่อวิชาอังกฤษ"];
  const credits = record["หน่วยกิต"];
  const realCredits = record["หน่วยกิตจริง"];
  const theory = record["ทฤษฎี"];
  const practice = record["ปฏิบัติ"];
  const selfStudy = record["ศึกษาด้วยตนเอง"];
  const type = record["ประเภทวิชา"];
  const category = record["หมวดวิชา"];
  const group = record["กลุ่มวิชา"];
  const subgroup = record["กลุ่มย่อย"];
  const thaiDescription = record["คำอธิบายรายวิชาไทย"];
  const englishDescription = record["คำอธิบายรายวิชาอังกฤษ"];

  return [
    `AI READY FTP COURSE CATALOG`,
    `รหัสวิชา: ${code}`,
    `ชื่อวิชาไทย: ${thaiName}`,
    `ชื่อวิชาอังกฤษ: ${englishName}`,
    `คำถามที่เกี่ยวข้อง: ${code} เรียนอะไร, ${thaiName} เรียนอะไร, วิชา ${thaiName} คืออะไร, คำอธิบายรายวิชา ${code}, ${englishName} course description`,
    `หน่วยกิต: ${credits}`,
    `หน่วยกิตจริง: ${realCredits}`,
    `ทฤษฎี: ${theory}`,
    `ปฏิบัติ: ${practice}`,
    `ศึกษาด้วยตนเอง: ${selfStudy}`,
    `ประเภทวิชา: ${type}`,
    `หมวดวิชา: ${category}`,
    `กลุ่มวิชา: ${group}`,
    subgroup ? `กลุ่มย่อย: ${subgroup}` : "",
    `คำอธิบายรายวิชาไทย: ${thaiDescription || "ไม่มีคำอธิบายภาษาไทยในไฟล์ CSV"}`,
    englishDescription ? `คำอธิบายรายวิชาอังกฤษ: ${englishDescription}` : "",
    `แนวทางตอบนักศึกษา: ถ้านักศึกษาถามว่าวิชานี้เรียนอะไร ให้ตอบด้วยชื่อวิชา หน่วยกิต และสรุปคำอธิบายรายวิชาไทยแบบเข้าใจง่ายก่อน แล้วค่อยบอกหมวดวิชา/ประเภทวิชาถ้าจำเป็น`,
  ]
    .filter(Boolean)
    .join("\n");
}

function makeSummaryText(records) {
  const lines = [
    "AI READY FTP COURSE CATALOG SUMMARY",
    "ฐานข้อมูลรายวิชาหลักสูตรเทคโนโลยีการผลิตภาพยนตร์และวิทยุโทรทัศน์ ใช้ตอบคำถามรหัสวิชา ชื่อวิชา หน่วยกิต และคำอธิบายรายวิชา",
    "ตัวอย่างคำถาม: วิชานี้เรียนอะไร, รหัสวิชา 08-160-xxx เรียนอะไร, คำอธิบายรายวิชา, วิชาเลือกมีอะไรบ้าง",
    `จำนวนรายวิชาในชุดนี้: ${records.length} รายวิชา`,
    "",
    "รายการรายวิชา:",
  ];

  for (const record of records) {
    lines.push(`${record["รหัสวิชา"]} - ${record["ชื่อวิชาไทย"]} (${record["ชื่อวิชาอังกฤษ"]}) ${record["หน่วยกิต"]}`);
  }

  return lines.join("\n");
}

function batch(items, size) {
  const batches = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}

await loadEnv();
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const csv = await readFile(sourcePath, "utf8");
const [rawHeaders, ...rows] = parseCsv(csv);
const headers = rawHeaders.map(normalizeHeader);
const records = rows.map((row) => rowToRecord(headers, row)).filter((record) => record["รหัสวิชา"] && record["ชื่อวิชาไทย"]);
if (!records.length) throw new Error("No course records found in CSV");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const existing = await supabase.from("knowledge_documents").select("id").like("title", `${importPrefix}%`);
if (existing.error) throw existing.error;
const existingIds = (existing.data ?? []).map((item) => item.id);
if (existingIds.length) {
  for (const ids of batch(existingIds, 100)) {
    const chunkDelete = await supabase.from("knowledge_chunks").delete().in("document_id", ids);
    if (chunkDelete.error) throw chunkDelete.error;
    const docDelete = await supabase.from("knowledge_documents").delete().in("id", ids);
    if (docDelete.error) throw docDelete.error;
  }
}

const docs = [
  {
    title: `${importPrefix} summary`,
    text: makeSummaryText(records),
  },
  ...records.map((record) => ({
    title: `${importPrefix} ${record["รหัสวิชา"]} ${record["ชื่อวิชาไทย"]}`,
    text: makeCourseText(record),
    record,
  })),
];

const insertedDocs = [];
for (const docBatch of batch(docs, 100)) {
  const insert = await supabase
    .from("knowledge_documents")
    .insert(
      docBatch.map((doc) => ({
        title: doc.title,
        source_type: "text",
        mime_type: "text/csv",
        file_path: null,
        file_size: Buffer.byteLength(doc.text, "utf8"),
        extracted_text: doc.text,
        notes: "AI-ready FTP course catalog imported from ftp_courses.csv. Contains course code, Thai/English names, credits, category, and course descriptions.",
        expires_at: null,
      })),
    )
    .select("id,title,extracted_text");
  if (insert.error) throw insert.error;
  insertedDocs.push(...insert.data);
}

const chunks = insertedDocs.flatMap((doc) =>
  makeChunks(`${doc.title}\n\n${doc.extracted_text}`).map((content, index) => ({
    document_id: doc.id,
    chunk_index: index,
    content,
  })),
);

for (const chunkBatch of batch(chunks, 500)) {
  const insert = await supabase.from("knowledge_chunks").insert(chunkBatch);
  if (insert.error) throw insert.error;
}

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "ftp_course_catalog_ai_ready.json"), JSON.stringify(records, null, 2), "utf8");
await writeFile(path.join(outputDir, "ftp_course_catalog_ai_ready.txt"), docs.map((doc) => `# ${doc.title}\n${doc.text}`).join("\n\n---\n\n"), "utf8");

console.log(
  JSON.stringify(
    {
      sourcePath,
      deletedExisting: existingIds.length,
      parsedCourses: records.length,
      insertedDocuments: insertedDocs.length,
      insertedChunks: chunks.length,
      outputJson: path.join(outputDir, "ftp_course_catalog_ai_ready.json"),
      outputText: path.join(outputDir, "ftp_course_catalog_ai_ready.txt"),
    },
    null,
    2,
  ),
);
