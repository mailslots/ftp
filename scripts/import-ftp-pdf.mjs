import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const pdfPath = process.argv[2] || "C:/Users/Phubet_DESKTOP/Downloads/FTP_ย่อ.pdf";
const outputDir = path.join(projectRoot, "data");
const bucket = "p-tech-knowledge";

function loadEnv() {
  const envPath = path.join(projectRoot, ".env.local");
  return readFile(envPath, "utf8")
    .then((text) => {
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [key, ...valueParts] = trimmed.split("=");
        process.env[key] ??= valueParts.join("=").replace(/^"|"$/g, "");
      }
    })
    .catch(() => undefined);
}

function cleanText(text) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function chunkText(text) {
  const sections = text
    .split(/\n(?=(?:\d+(?:\.\d+){1,4}|[0-9]{2}-[0-9]{3}-[0-9]{3})\s)/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 80);

  const source = sections.length >= 20 ? sections : text.match(/[\s\S]{1,1400}(?=\s|$)/g) || [];
  const chunks = [];

  for (const section of source) {
    if (section.length <= 1600) {
      chunks.push(section);
      continue;
    }
    for (let cursor = 0; cursor < section.length; cursor += 1300) {
      chunks.push(section.slice(cursor, cursor + 1450).trim());
    }
  }

  return chunks.filter(Boolean);
}

function extractCourseRows(text) {
  const rows = [];
  const pattern =
    /(?<code>\d{2}-\d{3}-\d{3})\s+(?<thai>[^\n]+?)\s+(?<english>[A-Z][^\n]+?)\s+(?<credits>\d+\(\d+-\d+-\d+\))/g;

  for (const match of text.matchAll(pattern)) {
    const credits = match.groups.credits.match(/(?<units>\d+)\((?<theory>\d+)-(?<practice>\d+)-(?<self>\d+)\)/);
    rows.push({
      code: match.groups.code,
      thaiTitle: match.groups.thai.trim(),
      englishTitle: match.groups.english.trim(),
      credits: match.groups.credits,
      creditUnits: Number(credits?.groups?.units ?? 0),
      theoryHours: Number(credits?.groups?.theory ?? 0),
      practiceHours: Number(credits?.groups?.practice ?? 0),
      selfStudyHours: Number(credits?.groups?.self ?? 0),
    });
  }

  const unique = new Map();
  for (const row of rows) unique.set(row.code, row);
  return [...unique.values()];
}

function toCsv(rows) {
  const header = ["code", "thaiTitle", "englishTitle", "credits", "creditUnits", "theoryHours", "practiceHours", "selfStudyHours"];
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return "\ufeff" + [header.join(","), ...rows.map((row) => header.map((key) => escape(row[key])).join(","))].join("\n");
}

await loadEnv();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const data = await readFile(pdfPath);
const parser = new PDFParse({ data });
const parsed = await parser.getText();
await parser.destroy();

const text = cleanText(parsed.text);
const chunks = chunkText(text);
const courses = extractCourseRows(text);

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "ftp_yor_extracted.txt"), text, "utf8");
await writeFile(
  path.join(outputDir, "ftp_yor_chunks.json"),
  JSON.stringify(
    chunks.map((content, index) => ({ index, content })),
    null,
    2,
  ),
  "utf8",
);
await writeFile(path.join(outputDir, "ftp_yor_courses.json"), JSON.stringify(courses, null, 2), "utf8");
await writeFile(path.join(outputDir, "ftp_yor_courses.csv"), toCsv(courses), "utf8");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const filePath = `imports/${Date.now()}-FTP_yor.pdf`;
const upload = await supabase.storage.from(bucket).upload(filePath, data, {
  contentType: "application/pdf",
  upsert: false,
});
if (upload.error) throw upload.error;

const inserted = await supabase
  .from("knowledge_documents")
  .insert({
    title: "FTP_ย่อ.pdf - ข้อมูลหลักสูตร FTP",
    source_type: "pdf",
    mime_type: "application/pdf",
    file_path: filePath,
    file_size: data.length,
    extracted_text: text.slice(0, 180000),
    notes: `นำเข้าอัตโนมัติจาก PDF; แยกได้ ${chunks.length} chunks และตรวจพบรายวิชา ${courses.length} รายการ`,
    expires_at: null,
  })
  .select("*")
  .single();
if (inserted.error) throw inserted.error;

if (chunks.length) {
  const rows = chunks.map((content, index) => ({
    document_id: inserted.data.id,
    chunk_index: index,
    content,
  }));

  for (let cursor = 0; cursor < rows.length; cursor += 100) {
    const batch = rows.slice(cursor, cursor + 100);
    const result = await supabase.from("knowledge_chunks").insert(batch);
    if (result.error) throw result.error;
  }
}

console.log(
  JSON.stringify(
    {
      documentId: inserted.data.id,
      outputDir,
      textLength: text.length,
      chunkCount: chunks.length,
      courseCount: courses.length,
      storagePath: filePath,
    },
    null,
    2,
  ),
);
