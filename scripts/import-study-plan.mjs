import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "data");
const sourcePath = path.join(outputDir, "ftp_yor_extracted.txt");

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

function cleanThai(text) {
  return text
    .replace(/ปB/g, "ปี")
    .replace(/หน5วย/g, "หน่วย")
    .replace(/ดRวย/g, "ด้วย")
    .replace(/ถ:าย/g, "ถ่าย")
    .replace(/กลุ:ม/g, "กลุ่ม")
    .replace(/สร#าง/g, "สร้าง")
    .replace(/ความเปน/g, "ความเป็น")
    .replace(/ส:ง/g, "ส่ง")
    .replace(/ฝก/g, "ฝึก")
    .replace(/ฝก/g, "ฝึก")
    .replace(/ปฏิบัติการจัดแสงสำหรับภาพนิ่งและ\s*ภาพเคลื่อนไหว/g, "ปฏิบัติการจัดแสงสำหรับภาพนิ่งและภาพเคลื่อนไหว")
    .replace(/เทคโนโลยีการผลิตภาพยนตรQและวิทยุ\s*โทรทัศนQ/g, "เทคโนโลยีการผลิตภาพยนตร์และวิทยุโทรทัศน์")
    .replace(/สื่อสารมวลชน/g, "สื่อสารมวลชน")
    .replace(/Q/g, "์")
    .replace(/#/g, "");
}

function getPlanSlice(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing marker: ${startMarker}`);
  const end = endMarker ? text.indexOf(endMarker, start + startMarker.length) : -1;
  return text.slice(start, end > start ? end : undefined);
}

function parsePlan(planName, description, slice) {
  const lines = cleanThai(slice)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !/^\d+$/.test(line) && !line.startsWith("-- "));

  const terms = [];
  let current = null;
  let pending = "";

  function flushPending() {
    if (current && pending.trim()) {
      current.courses.push(pending.trim());
      pending = "";
    }
  }

  for (const line of lines) {
    const header = line.match(/^ปีที่\s*(\d)\s*\/\s*ภาคการศึกษาที่\s*(\d)/);
    if (header) {
      flushPending();
      current = { year: Number(header[1]), term: Number(header[2]), totalCredits: null, courses: [] };
      terms.push(current);
      continue;
    }
    if (!current) continue;
    if (line === "ตนเอง" || line.includes("หน่วยกิต ทฤษฎี ปฏิบัติ")) continue;
    const total = line.match(/^รวม\s*(\d+)\s*หน่วยกิต/);
    if (total) {
      flushPending();
      current.totalCredits = Number(total[1]);
      continue;
    }

    const startsCourse = /^(?:\d{2}-\d{3}-\d{3}|\d{2}-xxx-xxx|0x-xxx-xxx|01-3xx-xxx|xx-xxx-xxx|หรือ\s+\d{2}-\d{3}-\d{3})\b/.test(line);
    if (startsCourse && pending) flushPending();
    pending = pending ? `${pending} ${line}` : line;

    if (/\s(?:\d|x)\s(?:\d|x)\s(?:\d|x)\s(?:\d|x)$/.test(pending)) {
      pending = pending.replace(/\s(\d|x)\s(\d|x)\s(\d|x)\s(\d|x)$/, " $1 หน่วยกิต");
      flushPending();
    }
  }
  flushPending();

  return { plan: planName, planDescription: description, terms };
}

function makeTermText(plan, term) {
  return [
    `แผนการเรียนหลักสูตร FTP ${plan.plan} ${plan.planDescription}`,
    `ปี ${term.year} เทอม ${term.term}`,
    `ปีที่ ${term.year} ภาคการศึกษาที่ ${term.term}`,
    `ชั้นปีที่ ${term.year} ภาคการศึกษาที่ ${term.term}`,
    `คำถามที่เกี่ยวข้อง: ปี ${term.year} เรียนอะไรบ้าง, ปี${term.year} เรียนอะไรบ้าง, ปี ${term.year} เทอม ${term.term} เรียนอะไร, แผนการเรียนปี ${term.year}`,
    `รวม ${term.totalCredits ?? "ไม่ระบุ"} หน่วยกิต`,
    "รายวิชา:",
    ...term.courses.map((course, index) => `${index + 1}. ${course}`),
  ].join("\n");
}

function makeSummaryText(plans) {
  const lines = [
    "สรุปแผนการเรียนหลักสูตร FTP แยกตามปีและภาคการศึกษา",
    "ใช้ตอบคำถาม เช่น ปี 1 เรียนอะไรบ้าง, ปี 2 เรียนอะไรบ้าง, แต่ละเทอมมีวิชาอะไร โดยอ้างอิงจากฐานข้อมูลก่อน",
  ];
  for (const plan of plans) {
    lines.push("", `${plan.plan}: ${plan.planDescription}`);
    for (const term of plan.terms) {
      lines.push(`ปี ${term.year} เทอม ${term.term}: ${term.courses.join("; ")} รวม ${term.totalCredits ?? "ไม่ระบุ"} หน่วยกิต`);
    }
  }
  return lines.join("\n");
}

await loadEnv();
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const raw = await readFile(sourcePath, "utf8");
const section = getPlanSlice(raw, "3.1.4 แผนการศึกษาเสนอแนะ", "-- 31 of 166 --");
const planA = parsePlan("แผน ก", "สำหรับนักศึกษาที่เลือกรายวิชา CWIE", getPlanSlice(section, "แผน ก", "แผน ข"));
const planB = parsePlan("แผน ข", "สำหรับนักศึกษาที่เลือกรายวิชาฝึกงาน", getPlanSlice(section, "แผน ข"));
const plans = [planA, planB];
const summaryText = makeSummaryText(plans);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const existing = await supabase.from("knowledge_documents").select("id").like("title", "FTP study plan%");
if (existing.error) throw existing.error;
const existingIds = (existing.data ?? []).map((item) => item.id);
if (existingIds.length) {
  const chunkDelete = await supabase.from("knowledge_chunks").delete().in("document_id", existingIds);
  if (chunkDelete.error) throw chunkDelete.error;
  const docDelete = await supabase.from("knowledge_documents").delete().in("id", existingIds);
  if (docDelete.error) throw docDelete.error;
}

const rows = [
  {
    title: "FTP study plan summary - year and semester",
    source_type: "text",
    mime_type: "text/plain",
    file_path: null,
    file_size: Buffer.byteLength(summaryText, "utf8"),
    extracted_text: summaryText,
    notes: "Clean structured Thai summary imported from FTP_ย่อ.pdf study plan section.",
    expires_at: null,
  },
];

for (const plan of plans) {
  for (const term of plan.terms) {
    const text = makeTermText(plan, term);
    rows.push({
      title: `FTP study plan ${plan.plan} year ${term.year} term ${term.term}`,
      source_type: "text",
      mime_type: "text/plain",
      file_path: null,
      file_size: Buffer.byteLength(text, "utf8"),
      extracted_text: text,
      notes: "Clean structured Thai year/semester record imported from FTP_ย่อ.pdf study plan section.",
      expires_at: null,
    });
  }
}

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
await writeFile(path.join(outputDir, "ftp_yor_study_plan.json"), JSON.stringify(plans, null, 2), "utf8");
await writeFile(path.join(outputDir, "ftp_yor_study_plan.txt"), summaryText, "utf8");

console.log(JSON.stringify({
  deletedExisting: existingIds.length,
  insertedDocuments: inserted.data.length,
  insertedChunks: chunks.length,
  plans: plans.map((plan) => ({ plan: plan.plan, terms: plan.terms.length })),
  outputJson: path.join(outputDir, "ftp_yor_study_plan.json"),
  outputText: path.join(outputDir, "ftp_yor_study_plan.txt"),
}, null, 2));
