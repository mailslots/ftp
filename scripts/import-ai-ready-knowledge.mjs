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

function thai(codepoints) {
  return codepoints.map((item) => String.fromCodePoint(item)).join("");
}

const T = {
  aiReady: "AI READY",
  course: thai([0x0e23, 0x0e32, 0x0e22, 0x0e27, 0x0e34, 0x0e0a, 0x0e32]),
  question: thai([0x0e04, 0x0e33, 0x0e16, 0x0e32, 0x0e21]),
  answer: thai([0x0e04, 0x0e33, 0x0e15, 0x0e2d, 0x0e1a]),
  year: thai([0x0e1b, 0x0e35]),
  term: thai([0x0e40, 0x0e17, 0x0e2d, 0x0e21]),
  source: thai([0x0e41, 0x0e2b, 0x0e25, 0x0e48, 0x0e07, 0x0e17, 0x0e35, 0x0e48, 0x0e21, 0x0e32]),
  credits: thai([0x0e2b, 0x0e19, 0x0e48, 0x0e27, 0x0e22, 0x0e01, 0x0e34, 0x0e15]),
  studyPlan: thai([0x0e41, 0x0e1c, 0x0e19, 0x0e01, 0x0e32, 0x0e23, 0x0e40, 0x0e23, 0x0e35, 0x0e22, 0x0e19]),
  learnWhat: thai([0x0e40, 0x0e23, 0x0e35, 0x0e22, 0x0e19, 0x0e2d, 0x0e30, 0x0e44, 0x0e23, 0x0e1a, 0x0e49, 0x0e32, 0x0e07]),
  databaseFirst: thai([
    0x0e02, 0x0e49, 0x0e2d, 0x0e21, 0x0e39, 0x0e25, 0x0e19, 0x0e35, 0x0e49, 0x0e17, 0x0e33, 0x0e44, 0x0e27,
    0x0e49, 0x0e43, 0x0e2b, 0x0e49, 0x0e1e, 0x0e35, 0x0e48, 0x0e40, 0x0e17, 0x0e04, 0x0e2d, 0x0e49, 0x0e32,
    0x0e07, 0x0e2d, 0x0e34, 0x0e07, 0x0e08, 0x0e32, 0x0e01, 0x0e10, 0x0e32, 0x0e19, 0x0e01, 0x0e48, 0x0e2d,
    0x0e19,
  ]),
};

function extractYearTerm(title) {
  const match = title.match(/year\s+(\d)\s+term\s+(\d)/);
  return match ? { year: Number(match[1]), term: Number(match[2]) } : null;
}

function extractPlan(title) {
  if (title.includes("\u0e41\u0e1c\u0e19 \u0e01")) return "\u0e41\u0e1c\u0e19 \u0e01";
  if (title.includes("\u0e41\u0e1c\u0e19 \u0e02")) return "\u0e41\u0e1c\u0e19 \u0e02";
  return "";
}

function courseLines(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const start = lines.findIndex((line) => line === T.course + ":");
  return start >= 0 ? lines.slice(start + 1).filter((line) => /^\d+\./.test(line)) : [];
}

function totalLine(text) {
  return text.split(/\r?\n/).find((line) => line.trim().startsWith("\u0e23\u0e27\u0e21 "))?.trim() || "";
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function makeYearDoc(year, records) {
  const lines = [
    `${T.aiReady} FTP ${T.studyPlan} ${T.year} ${year}`,
    `${T.question}: ${T.year} ${year} ${T.learnWhat}`,
    `${T.question}: ${T.year}${year} ${T.learnWhat}`,
    `${T.question}: ${T.year} ${year} ${T.term} 1 ${T.learnWhat}`,
    `${T.question}: ${T.year} ${year} ${T.term} 2 ${T.learnWhat}`,
    `${T.answer}:`,
    `${T.databaseFirst}`,
  ];

  for (const term of [1, 2]) {
    const termRecords = records.filter((record) => record.term === term);
    if (!termRecords.length) continue;
    const first = termRecords[0];
    lines.push("", `${T.year} ${year} ${T.term} ${term} ${totalLine(first.extracted_text)}`);
    unique(termRecords.flatMap((record) => courseLines(record.extracted_text))).forEach((course) => lines.push(course));
  }

  if (year === 4) {
    lines.push("", "\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38: \u0e1b\u0e35 4 \u0e41\u0e1c\u0e19 \u0e01 \u0e40\u0e19\u0e49\u0e19 CWIE/\u0e2a\u0e2b\u0e01\u0e34\u0e08\u0e28\u0e36\u0e01\u0e29\u0e32, \u0e41\u0e1c\u0e19 \u0e02 \u0e40\u0e19\u0e49\u0e19\u0e1d\u0e36\u0e01\u0e07\u0e32\u0e19");
  }

  return {
    title: `${T.aiReady} FTP year ${year} study plan answer`,
    text: lines.join("\n"),
  };
}

function makeTermDoc(record) {
  const { year, term } = record;
  const plan = record.plan || "";
  return {
    title: `${T.aiReady} FTP ${plan} year ${year} term ${term}`,
    text: [
      `${T.aiReady} FTP ${plan} ${T.year} ${year} ${T.term} ${term}`,
      `${T.question}: ${T.year} ${year} ${T.term} ${term} ${T.learnWhat}`,
      `${T.question}: ${T.studyPlan} ${T.year} ${year} ${T.term} ${term}`,
      `${T.answer}:`,
      totalLine(record.extracted_text),
      ...courseLines(record.extracted_text),
      `${T.source}: FTP study plan ${plan} year ${year} term ${term}`,
    ].join("\n"),
  };
}

function makeTopicDoc(records, keywordRegex, title, questions) {
  const matches = unique(records.flatMap((record) => courseLines(record.extracted_text).filter((line) => keywordRegex.test(line))));
  return {
    title,
    text: [
      `${T.aiReady} ${title}`,
      ...questions.map((question) => `${T.question}: ${question}`),
      `${T.answer}:`,
      ...matches,
      `${T.source}: FTP curriculum extracted into AI-ready records`,
    ].join("\n"),
  };
}

await loadEnv();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const existingReady = await supabase.from("knowledge_documents").select("id").like("title", "AI READY FTP%");
if (existingReady.error) throw existingReady.error;
const existingReadyIds = (existingReady.data ?? []).map((item) => item.id);
if (existingReadyIds.length) {
  const chunkDelete = await supabase.from("knowledge_chunks").delete().in("document_id", existingReadyIds);
  if (chunkDelete.error) throw chunkDelete.error;
  const docDelete = await supabase.from("knowledge_documents").delete().in("id", existingReadyIds);
  if (docDelete.error) throw docDelete.error;
}

const source = await supabase
  .from("knowledge_documents")
  .select("id,title,extracted_text")
  .like("title", "FTP study plan%")
  .order("title");
if (source.error) throw source.error;

const records = (source.data ?? [])
  .map((item) => ({ ...item, ...extractYearTerm(item.title), plan: extractPlan(item.title) }))
  .filter((item) => item.year && item.term);

const docs = [];
for (const year of [1, 2, 3, 4]) {
  docs.push(makeYearDoc(year, records.filter((record) => record.year === year)));
}
for (const record of records) docs.push(makeTermDoc(record));
docs.push(
  makeTopicDoc(
    records,
    /\u0e16\u0e48\u0e32\u0e22|\u0e01\u0e25\u0e49\u0e2d\u0e07|\u0e20\u0e32\u0e1e|\u0e41\u0e2a\u0e07/,
    "AI READY FTP camera photography film courses",
    [
      "\u0e2b\u0e25\u0e31\u0e01\u0e2a\u0e39\u0e15\u0e23 FTP \u0e21\u0e35\u0e27\u0e34\u0e0a\u0e32\u0e40\u0e01\u0e35\u0e48\u0e22\u0e27\u0e01\u0e31\u0e1a\u0e01\u0e25\u0e49\u0e2d\u0e07\u0e2d\u0e30\u0e44\u0e23\u0e1a\u0e49\u0e32\u0e07",
      "\u0e40\u0e23\u0e35\u0e22\u0e19\u0e16\u0e48\u0e32\u0e22\u0e20\u0e32\u0e1e\u0e15\u0e2d\u0e19\u0e44\u0e2b\u0e19",
      "\u0e27\u0e34\u0e0a\u0e32\u0e40\u0e01\u0e35\u0e48\u0e22\u0e27\u0e01\u0e31\u0e1a\u0e20\u0e32\u0e1e\u0e22\u0e19\u0e15\u0e23\u0e4c\u0e41\u0e25\u0e30\u0e20\u0e32\u0e1e\u0e16\u0e48\u0e32\u0e22",
    ],
  ),
);

const rows = docs.map((doc) => ({
  title: doc.title,
  source_type: "text",
  mime_type: "text/plain",
  file_path: null,
  file_size: Buffer.byteLength(doc.text, "utf8"),
  extracted_text: doc.text,
  notes: "AI-ready compact knowledge generated from structured FTP curriculum records.",
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
await writeFile(path.join(outputDir, "ftp_ai_ready_knowledge.json"), JSON.stringify(docs, null, 2), "utf8");
await writeFile(path.join(outputDir, "ftp_ai_ready_knowledge.txt"), docs.map((doc) => `# ${doc.title}\n${doc.text}`).join("\n\n---\n\n"), "utf8");

console.log(
  JSON.stringify(
    {
      deletedExisting: existingReadyIds.length,
      sourceRecords: records.length,
      insertedDocuments: inserted.data.length,
      insertedChunks: chunks.length,
      outputJson: path.join(outputDir, "ftp_ai_ready_knowledge.json"),
      outputText: path.join(outputDir, "ftp_ai_ready_knowledge.txt"),
    },
    null,
    2,
  ),
);
