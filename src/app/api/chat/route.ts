import { NextResponse } from "next/server";
import { askModel } from "@/lib/llm";
import { recordAiUsage } from "@/lib/ai-usage";
import { getAppSettings } from "@/lib/app-settings";
import { getStudyPlanChunks, searchKnowledge } from "@/lib/knowledge";
import type { ChatMessage, KnowledgeChunk, ResponseLanguage } from "@/lib/types";

export const runtime = "nodejs";

type SpamState = {
  attempts: number[];
  shortAttempts: number[];
  violations: number;
  lockedUntil: number;
};

type DeepSeekCooldownState = {
  count: number;
  lockedUntil: number;
};

type ChatIntent =
  | { type: "study_plan"; year: string; term: string; query: string }
  | { type: "course_catalog"; courseName: string; query: string }
  | { type: "ptech_meaning"; query: string }
  | { type: "nine_q"; query: string }
  | { type: "mental_health"; query: string }
  | { type: "insurance"; query: string }
  | { type: "retire"; query: string }
  | { type: "faculty_roster"; query: string }
  | { type: "academic_calendar"; query: string }
  | { type: "administration_policy"; query: string }
  | { type: "orientation"; query: string }
  | { type: "camera_purchase"; query: string }
  | { type: "knowledge"; query: string }
  | { type: "general"; query: string };

const spamStates = new Map<string, SpamState>();
const deepseekCooldownStates = new Map<string, DeepSeekCooldownState>();
const DEEPSEEK_COOLDOWN_MS = 60_000;

function getClientKey(request: Request, clientId: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip = forwardedFor || realIp || "unknown-ip";
  return `${ip}:${clientId || "unknown-client"}`;
}

function lockDurationMs(violations: number) {
  if (violations <= 1) return 30_000;
  if (violations === 2) return 2 * 60_000;
  return 10 * 60_000;
}

function checkSpam(request: Request, clientId: string, message: string) {
  const now = Date.now();
  const key = getClientKey(request, clientId);
  const state = spamStates.get(key) ?? { attempts: [], shortAttempts: [], violations: 0, lockedUntil: 0 };

  if (state.lockedUntil > now) {
    spamStates.set(key, state);
    return { blocked: true, lockedUntil: state.lockedUntil, reason: "locked" };
  }

  state.attempts = state.attempts.filter((time) => now - time < 10_000);
  state.shortAttempts = state.shortAttempts.filter((time) => now - time < 20_000);

  const compact = message.replace(/\s+/g, "");
  const isShortSpam = compact.length <= 2;
  const tooFast = state.attempts.length > 0 && now - state.attempts[state.attempts.length - 1] < 1_200;

  state.attempts.push(now);
  if (isShortSpam) state.shortAttempts.push(now);

  const tooManyInWindow = state.attempts.length > 5;
  const tooManyShortMessages = state.shortAttempts.length >= 3;

  if (tooFast || tooManyInWindow || tooManyShortMessages) {
    state.violations += 1;
    state.lockedUntil = now + lockDurationMs(state.violations);
    spamStates.set(key, state);
    return {
      blocked: true,
      lockedUntil: state.lockedUntil,
      reason: tooManyShortMessages ? "short-message-spam" : tooFast ? "too-fast" : "burst-spam",
    };
  }

  spamStates.set(key, state);
  return { blocked: false, lockedUntil: 0, reason: "" };
}

function checkDeepSeekCooldown(request: Request, clientId: string, enabled: boolean) {
  if (!enabled) return { blocked: false, lockedUntil: 0 };
  const now = Date.now();
  const key = getClientKey(request, clientId);
  const state = deepseekCooldownStates.get(key);
  if (state?.lockedUntil && state.lockedUntil > now) {
    return { blocked: true, lockedUntil: state.lockedUntil };
  }
  if (state?.lockedUntil && state.lockedUntil <= now) {
    deepseekCooldownStates.delete(key);
  }
  return { blocked: false, lockedUntil: 0 };
}

function isDeepSeekProvider(provider: string) {
  return /deepseek/i.test(provider);
}

function isGroqProvider(provider: string) {
  return /^groq:/i.test(provider);
}

function isOpenRouterProvider(provider: string) {
  return /^openrouter:/i.test(provider);
}

function providerStatus(provider: string) {
  if (isDeepSeekProvider(provider)) return "deepseek";
  if (isOpenRouterProvider(provider)) return "openrouter";
  if (isGroqProvider(provider)) return "groq";
  return "gemini";
}

function groqRank(provider: string) {
  const match = provider.match(/rank-(\d+)/i);
  return match ? Math.max(1, Math.min(12, Number(match[1]))) : null;
}

function recordDeepSeekUse(request: Request, clientId: string, enabled: boolean, limit: number, provider: string) {
  if (!enabled) return null;
  const cooldownLimit = Math.max(1, Math.round(limit || 1));
  const key = getClientKey(request, clientId);
  const state = deepseekCooldownStates.get(key) ?? { count: 0, lockedUntil: 0 };
  if (!isDeepSeekProvider(provider)) {
    if (state.count > 0 || state.lockedUntil > 0) deepseekCooldownStates.set(key, { count: 0, lockedUntil: 0 });
    return null;
  }

  state.count += 1;
  if (state.count >= cooldownLimit) {
    state.count = 0;
    state.lockedUntil = Date.now() + DEEPSEEK_COOLDOWN_MS;
  }
  deepseekCooldownStates.set(key, state);
  return state.lockedUntil > Date.now() ? state.lockedUntil : null;
}

function chatResponse(
  request: Request,
  clientId: string,
  cooldownEnabled: boolean,
  cooldownLimit: number,
  body: {
    answer: string;
    provider: string;
    sources: Array<{ id: string; title: string; type: string }>;
  },
) {
  void recordAiUsage(body.provider).catch(() => null);
  const cooldownLockedUntil = recordDeepSeekUse(request, clientId, cooldownEnabled, cooldownLimit, body.provider);
  return NextResponse.json({
    ...body,
    providerStatus: providerStatus(body.provider),
    providerRank: groqRank(body.provider),
    cooldownLockedUntil,
  });
}

function feminineTone(answer: string) {
  return answer
    .replace(/นะครับ/g, "นะคะ")
    .replace(/ครับ/g, "ค่ะ")
    .replace(/ไหมค่ะ/g, "ไหมคะ")
    .replace(/หรือยังค่ะ/g, "หรือยังคะ")
    .replace(/นะค่ะ/g, "นะคะ");
}

function normalizeResponseLanguage(value: unknown): ResponseLanguage {
  return value === "en" || value === "zh" || value === "th" ? value : "th";
}

function ensureChineseTranslationNote(answer: string) {
  if (/翻译|翻譯|泰语资料|泰語資料/.test(answer)) return answer;
  return `${answer.trim()}\n（此内容由泰语资料翻译生成）`;
}

async function localizeAnswer(answer: string, language: ResponseLanguage) {
  const thaiAnswer = feminineTone(answer || "");
  if (language === "th" || !thaiAnswer.trim()) return thaiAnswer;

  const instruction =
    language === "en"
      ? [
          "Translate and rewrite the following Thai answer into natural English for an international student.",
          "Keep official course codes and official English course names/descriptions if they appear in the source.",
          "Do not mention internal systems or sources.",
        ].join("\n")
      : [
          "Translate and rewrite the following Thai answer into Simplified Chinese for an international student.",
          "Keep course codes and official English course names where helpful.",
          "End with exactly this note: （此内容由泰语资料翻译生成）",
          "Do not mention internal systems or sources.",
        ].join("\n");

  const result = await askModel({
    language,
    chunks: [],
    messages: [
      {
        role: "user",
        content: `${instruction}\n\n${thaiAnswer}`,
      },
    ],
  });

  const localized = result.answer?.trim() || thaiAnswer;
  return language === "zh" ? ensureChineseTranslationNote(localized) : localized;
}

function presentAnswer(answer: string, language: ResponseLanguage) {
  return language === "th" ? feminineTone(answer) : language === "zh" ? ensureChineseTranslationNote(answer) : answer;
}

function isCameraPurchaseQuestion(question: string) {
  const compact = question.toLowerCase().replace(/\s+/g, "");
  return (
    compact.includes("\u0e0b\u0e37\u0e49\u0e2d\u0e01\u0e25\u0e49\u0e2d\u0e07") ||
    compact.includes("\u0e01\u0e25\u0e49\u0e2d\u0e07\u0e2d\u0e30\u0e44\u0e23\u0e14\u0e35") ||
    compact.includes("\u0e01\u0e25\u0e49\u0e2d\u0e07\u0e23\u0e38\u0e48\u0e19\u0e44\u0e2b\u0e19\u0e14\u0e35") ||
    compact.includes("\u0e41\u0e19\u0e30\u0e19\u0e33\u0e01\u0e25\u0e49\u0e2d\u0e07") ||
    compact.includes("camera")
  );
}

function isAcademicCalendarQuestion(question: string) {
  const lower = question.toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  const hasCalendarTerm =
    /ปฏิทิน|เปิดเทอม|เปิดภาคเรียน|ปิดเทอม|วันสุดท้ายของภาค|สอบกลางภาค|สอบปลายภาค|ขอจบ|ขอสำเร็จ|สําเร็จการศึกษา|สำเร็จการศึกษา|ขึ้นทะเบียนบัณฑิต|english exit|ลงทะเบียน|เพิ่มถอน|เพิ่ม-ถอน|ชำระเงิน|ชาระเงิน|ค่าปรับ|วันหยุด|สงกรานต์/.test(lower);
  const hasAcademicYear = /2569|2570|1\/2569|2\/2569|ภาค\s*1|ภาค\s*2|เทอม\s*1|เทอม\s*2|ฤดูร้อน|ซัมเมอร์|summer/.test(lower);
  const asksDate = /วันไหน|เมื่อไหร่|กี่วัน|วันที่|ช่วงไหน|ถึงวันไหน|ตั้งแต่/.test(lower);
  return hasCalendarTerm && (hasAcademicYear || asksDate || compact.includes("ปฏิทินการศึกษา"));
}

function isAdministrationPolicyQuestion(question: string) {
  const lower = question.toLowerCase();
  return /นโยบาย|วิสัยทัศน์|ยุทธศาสตร์|วัฒนธรรมองค์กร|ค่านิยม|ฝ่ายบริหาร|mct|moral|creativity|innovative management|learning to be innovator/.test(lower);
}

function isFacultyRosterQuestion(question: string) {
  const lower = question.toLowerCase();
  return /คณบดี|รองคณบดี|ผู้ช่วยคณบดี|ประธานหลักสูตร|หัวหน้าสาขา|คณาจารย์|รายชื่ออาจารย์|อาจารย์.*ใครบ้าง|อจ\.?|ชื่อเล่น.*อาจารย์|โต๊ะทำงาน|ห้องทำงาน|แอ๋ม|ผึ้ง|ประภาภร|อรสุชา|อุกฤษ|ไวยวุฒิ|กิตติพร|อิทธิพล|สุวัฒน์|อนุสรณ์|ภูเบศ|วิษณุพร|จิรศักดิ์|กมล สังข์ทอง|วิภาวี|กุลกนิษฐ์|คำรณ|ภาณินี|ชาลิน|กุลภัสสร์/.test(lower);
}

function isKnowledgeIntent(question: string) {
  if (isAcademicCalendarQuestion(question)) return true;
  if (isAdministrationPolicyQuestion(question)) return true;
  if (isFacultyRosterQuestion(question)) return true;
  const lower = question.toLowerCase();
  return /\d{2}-\d{3}-\d{3}|\u0e04\u0e33\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22\u0e23\u0e32\u0e22\u0e27\u0e34\u0e0a\u0e32|\u0e2a\u0e2d\u0e19\u0e2d\u0e30\u0e44\u0e23|\u0e1b\u0e35\s*\d|\u0e40\u0e17\u0e2d\u0e21\s*\d|\u0e40\u0e23\u0e35\u0e22\u0e19\u0e2d\u0e30\u0e44\u0e23|\u0e23\u0e32\u0e22\u0e27\u0e34\u0e0a\u0e32|\u0e27\u0e34\u0e0a\u0e32|\u0e41\u0e1c\u0e19\u0e01\u0e32\u0e23\u0e40\u0e23\u0e35\u0e22\u0e19|retire|\u0e23\u0e35\u0e44\u0e17\u0e23\u0e4c|\u0e1e\u0e49\u0e19\u0e2a\u0e20\u0e32\u0e1e|gpa|\u0e40\u0e01\u0e23\u0e14\u0e40\u0e09\u0e25\u0e35\u0e48\u0e22|\u0e2b\u0e25\u0e31\u0e01\u0e2a\u0e39\u0e15\u0e23|\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e01\u0e34\u0e15|\u0e2d\u0e32\u0e0a\u0e35\u0e1e|\u0e1d\u0e36\u0e01\u0e07\u0e32\u0e19|\u0e2a\u0e2b\u0e01\u0e34\u0e08|\u0e2a\u0e21\u0e31\u0e04\u0e23|\u0e2d\u0e32\u0e08\u0e32\u0e23\u0e22\u0e4c|\u0e1b\u0e23\u0e30\u0e01\u0e31\u0e19|\u0e40\u0e04\u0e23\u0e35\u0e22\u0e14|\u0e40\u0e28\u0e23\u0e49\u0e32|\u0e44\u0e21\u0e48\u0e42\u0e2d\u0e40\u0e04|\u0e04\u0e25\u0e34\u0e19\u0e34\u0e01\u0e01\u0e33\u0e25\u0e31\u0e07\u0e43\u0e08|\u0e01\u0e33\u0e25\u0e31\u0e07\u0e43\u0e08|\u0e2a\u0e38\u0e02\u0e20\u0e32\u0e1e\u0e08\u0e34\u0e15|\u0e08\u0e34\u0e15\u0e27\u0e34\u0e17\u0e22\u0e32|\u0e1b\u0e23\u0e36\u0e01\u0e29\u0e32|\u0e2a\u0e32\u0e22\u0e14\u0e48\u0e27\u0e19|\u0e2b\u0e21\u0e14\u0e44\u0e1f|\u0e01\u0e31\u0e07\u0e27\u0e25|\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e2a\u0e38\u0e02|\u0e04\u0e27\u0e32\u0e21\u0e2a\u0e38\u0e02|\u0e14\u0e39\u0e41\u0e25\u0e43\u0e08|\u0e1e\u0e35\u0e48\u0e40\u0e17\u0e04|take care|technology|hotline|facebook|เงินรางวัล|คืนเงินค่าสอบ|ค่าสอบวัดระดับภาษา|วัดระดับภาษา|toeic|ielts|toefl|jlpt|hsk|hskk|นโยบาย|วิสัยทัศน์|ยุทธศาสตร์|วัฒนธรรมองค์กร|ค่านิยม|คณาจารย์|รายชื่ออาจารย์|ประธานหลักสูตร|คณบดี|รองคณบดี|ผู้ช่วยคณบดี|หัวหน้าสาขา|ชื่อเล่น|โต๊ะทำงาน|ห้องทำงาน|mct|moral|creativity|innovative management|learning to be innovator/.test(lower);
}

function expandKnowledgeText(text: string) {
  const courseName = extractCourseName(text);
  if (!courseName) return text;
  return [text, `${courseName} เรียนอะไร`, `คำอธิบายรายวิชา ${courseName}`].join("\n");
}

function extractCourseName(text: string) {
  const patterns = [
    /คำอธิบายรายวิชาของ\s*(?:วิชา)?(.+)$/i,
    /(?:วิชา)?(.+?)(?:สอนอะไร|เรียนอะไร)(?:อะ|ไหม|บ้าง)?$/i,
    /วิชา(.+?)(?:คืออะไร|เกี่ยวกับอะไร)(?:อะ|ไหม)?$/i,
  ];
  for (const pattern of patterns) {
    const match = text.trim().match(pattern);
    const courseName = match?.[1]?.replace(/^(วิชา|ของ)\s*/, "").trim();
    if (courseName && courseName.length >= 3 && !/คำอธิบาย|รายวิชา|ได้ไหม|ไหม/.test(courseName)) return courseName;
  }
  return "";
}

function buildKnowledgeQuery(messages: ChatMessage[], lastUserMessage: string) {
  const userMessages = messages.filter((message) => message.role === "user");
  const lastCourseName = extractCourseName(lastUserMessage);
  const asksCourseFollowUp = /คำอธิบายรายวิชา|ขอคำอธิบาย|วิชานี้|ตัวนี้|อันนี้/.test(lastUserMessage);
  const previousCourseName = [...userMessages]
    .slice(0, -1)
    .reverse()
    .map((message) => extractCourseName(message.content))
    .find(Boolean);

  const focusedCourseName = lastCourseName || (asksCourseFollowUp ? previousCourseName : "");
  if (focusedCourseName) {
    return [`${focusedCourseName} เรียนอะไร`, `คำอธิบายรายวิชา ${focusedCourseName}`, lastUserMessage].join("\n");
  }

  const recentContext = userMessages.slice(-4).map((message) => expandKnowledgeText(message.content)).join("\n");

  return [expandKnowledgeText(lastUserMessage), recentContext].filter(Boolean).join("\n").slice(-6000);
}

function inferIntent(messages: ChatMessage[], lastUserMessage: string): ChatIntent {
  const userMessages = messages.filter((message) => message.role === "user");
  const lower = lastUserMessage.toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  const hasExplicitStudyPlanIntent = /ปี(?:ที่)?\s*\d|ชั้นปี(?:ที่)?\s*\d|เทอม\s*\d|ภาค(?:การศึกษาที่)?\s*\d/.test(lastUserMessage)
    && /เรียน|วิชา|แผนการเรียน/.test(lastUserMessage);

  if ((compact.includes("พี่เทค") || compact.includes("takecare")) && /คือ|แปลว่า|หมายถึง|อะไร|ที่มา|ย่อ/.test(lower)) {
    return { type: "ptech_meaning", query: lastUserMessage };
  }

  if (/เครียด|เศร้า|ไม่โอเค|หมดไฟ|กังวล|สุขภาพจิต|จิตวิทยา|คลินิกกำลังใจ|กำลังใจ|ปรึกษา|สร้างสุข|ความสุข/.test(lower)) {
    return { type: "mental_health", query: lastUserMessage };
  }

  if (/ประกัน|อุบัติเหตุ|คุ้มครอง|ค่ารักษา|สินไหม|ทิพยประกันภัย/.test(lower)) {
    return {
      type: "insurance",
      query: "ประกันอุบัติเหตุนักศึกษาใหม่ RMUTT คุ้มครองอะไรบ้าง ค่ารักษาพยาบาล สินไหม ทิพยประกันภัย",
    };
  }

  const studyPlanParts = hasExplicitStudyPlanIntent ? getStudyPlanLookupParts(lastUserMessage) : null;
  if (studyPlanParts) {
    return {
      type: "study_plan",
      year: studyPlanParts.year,
      term: studyPlanParts.term,
      query: getStudyPlanLookupQuery(lastUserMessage),
    };
  }

  const courseName = extractCourseName(lastUserMessage);
  const asksCourseFollowUp = /คำอธิบายรายวิชา|ขอคำอธิบาย|วิชานี้|ตัวนี้|อันนี้/.test(lastUserMessage);
  const previousCourseName = [...userMessages]
    .slice(0, -1)
    .reverse()
    .map((message) => extractCourseName(message.content))
    .find(Boolean);
  const focusedCourseName = courseName || (asksCourseFollowUp ? previousCourseName : "");
  if (focusedCourseName && !studyPlanParts) {
    return {
      type: "course_catalog",
      courseName: focusedCourseName,
      query: [`${focusedCourseName} เรียนอะไร`, `คำอธิบายรายวิชา ${focusedCourseName}`, lastUserMessage].join("\n"),
    };
  }

  if (/9q|แบบประเมินโรคซึมเศร้า 9 คำถาม|ผลแบบประเมินโรคซึมเศร้า/i.test(lastUserMessage)) {
    return { type: "nine_q", query: lastUserMessage };
  }

  if (/retire|รีไทร์|พ้นสภาพ|gpa|เกรดเฉลี่ย/.test(lower)) {
    return { type: "retire", query: lastUserMessage };
  }

  if (isAdministrationPolicyQuestion(lastUserMessage)) {
    return {
      type: "administration_policy",
      query: "AI READY ฝ่ายบริหาร นโยบาย วิสัยทัศน์ ยุทธศาสตร์ วัฒนธรรมองค์กร ค่านิยม MCT Moral Creativity Technology",
    };
  }

  if (isFacultyRosterQuestion(lastUserMessage)) {
    return {
      type: "faculty_roster",
      query: `AI READY ฝ่ายบริหาร รายชื่อคณาจารย์ ประธานหลักสูตร คณบดี ชื่อเล่น โต๊ะทำงาน เทคโนโลยีการผลิตภาพยนตร์และวิทยุโทรทัศน์ ${lastUserMessage}`,
    };
  }

  if (isAcademicCalendarQuestion(lastUserMessage)) {
    return {
      type: "academic_calendar",
      query: `ปฏิทินการศึกษา 2569 RMUTT ${lastUserMessage}`,
    };
  }

  if (compact.includes("เปิดเทอม") || compact.includes("เปิดภาคเรียน")) {
    return { type: "orientation", query: lastUserMessage };
  }

  if (isCameraPurchaseQuestion(lastUserMessage)) {
    return { type: "camera_purchase", query: lastUserMessage };
  }

  const knowledgeQuery = buildKnowledgeQuery(messages, lastUserMessage);
  return isKnowledgeIntent(knowledgeQuery)
    ? { type: "knowledge", query: knowledgeQuery }
    : { type: "general", query: knowledgeQuery };
}

function answerPTechMeaning(question: string) {
  const lower = question.toLowerCase().replace(/\s+/g, "");
  if (!lower.includes("\u0e1e\u0e35\u0e48\u0e40\u0e17\u0e04") && !lower.includes("takecare")) return null;
  if (!/คือ|แปลว่า|หมายถึง|อะไร|ที่มา|ย่อ/.test(question.toLowerCase())) return null;

  return [
    "พี่เทค (Take Care) มีความหมายอยู่ 2 ชั้นค่ะ",
    "ชั้นแรกคือ Take Care หมายถึงพี่ที่คอยดูแล ช่วยฟัง ช่วยตอบ และช่วยพาน้องไปหาช่องทางที่เหมาะสมเมื่อมีเรื่องเรียน ชีวิต หรือความกังวล",
    "อีกชั้นคือเล่นคำกับ Technology เพราะคณะและสาขาของเราชูจุดเด่นเรื่องการนำเทคโนโลยีมาใช้จริง",
    "ดังนั้นภาพถ่าย ภาพยนตร์ วิทยุ และโทรทัศน์ ไม่ได้เป็นแค่ศาสตร์ด้านศิลปะอย่างเดียว แต่เป็นการใช้เทคโนโลยีมาประกอบให้เกิดประโยชน์และสุนทรียภาพสูงสุด",
    "สรุปง่าย ๆ พี่เทคคือผู้ช่วยที่ทั้งดูแลใจแบบ Take Care และสะท้อนตัวตนสาย Technology ของสาขาเราค่ะ",
  ].join("\n");
}

function answerMentalHealthQuestion(question: string) {
  const lower = question.toLowerCase();
  const isMental = /\u0e40\u0e04\u0e23\u0e35\u0e22\u0e14|\u0e40\u0e28\u0e23\u0e49\u0e32|\u0e44\u0e21\u0e48\u0e42\u0e2d\u0e40\u0e04|\u0e2b\u0e21\u0e14\u0e44\u0e1f|\u0e01\u0e31\u0e07\u0e27\u0e25|\u0e2a\u0e38\u0e02\u0e20\u0e32\u0e1e\u0e08\u0e34\u0e15|\u0e08\u0e34\u0e15\u0e27\u0e34\u0e17\u0e22\u0e32|\u0e04\u0e25\u0e34\u0e19\u0e34\u0e01\u0e01\u0e33\u0e25\u0e31\u0e07\u0e43\u0e08|\u0e01\u0e33\u0e25\u0e31\u0e07\u0e43\u0e08|\u0e1b\u0e23\u0e36\u0e01\u0e29\u0e32|\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e2a\u0e38\u0e02|\u0e04\u0e27\u0e32\u0e21\u0e2a\u0e38\u0e02/.test(lower);
  if (!isMental) return null;

  const asksContact = /\u0e15\u0e34\u0e14\u0e15\u0e48\u0e2d|\u0e17\u0e35\u0e48\u0e44\u0e2b\u0e19|\u0e40\u0e1a\u0e2d\u0e23\u0e4c|hotline|facebook|\u0e19\u0e31\u0e14|\u0e04\u0e25\u0e34\u0e19\u0e34\u0e01/.test(lower);
  const contact = [
    "ถ้ายังไม่พร้อมคุยกับคลินิกกำลังใจโดยตรง เริ่มจากคุยกับพี่ส้มหรือพี่แก้ว เจ้าหน้าที่ฝ่ายพัฒนานักศึกษาของคณะก่อนได้ค่ะ",
    "พี่ส้มกับพี่แก้วนั่งอยู่ในห้องหน้าคณะ บริเวณใกล้ LED ประชาสัมพันธ์หน้าคณะ ถ้าคิดอะไรไม่ออกหรือไม่รู้จะเริ่มติดต่อใคร ให้ไปหาพี่ทั้งสองคนก่อนได้",
    "บริการให้คำปรึกษา RMUTT ติดต่อได้ที่ฝ่ายแนะแนวการศึกษาและอาชีพ ชั้น 2 กองพัฒนานักศึกษา",
    "เปิดวันจันทร์-ศุกร์ เวลา 09.00-16.30 น. Hotline 08 0197 2024",
    "ติดตามและนัดหมายผ่าน Facebook งานบริการให้คำปรึกษา RMUTT: https://www.facebook.com/profile.php?id=100063935491321",
    "เคสที่ซับซ้อนอาจส่งต่อคลินิกกำลังใจ เพื่อพบผู้เชี่ยวชาญเฉพาะด้าน ในวันเสาร์ที่ 2 และเสาร์ที่ 4 ของทุกเดือน",
  ];

  if (asksContact) return contact.join("\n");

  return [
    "ได้เลยนะคะ ก่อนอื่นพี่อยากให้น้องรู้ว่า ความเครียด/ความกังวลไม่ได้แปลว่าน้องอ่อนแอ มันเป็นสัญญาณว่าร่างกายกับใจต้องการการดูแลค่ะ",
    "ลองเริ่มจาก 3 อย่างสั้น ๆ ตอนนี้: หายใจช้า ๆ 4-6 รอบ, เขียนสิ่งที่กังวลออกมาเป็นข้อ ๆ, แล้วเลือกทำแค่ข้อเล็กที่สุดก่อน",
    "วิธีช่วยลดเครียดที่ทำได้คือ ออกกำลังกายเบา ๆ หรือจริงจังประมาณ 30 นาที, นอนให้พอ, กินอาหารให้ครบ 5 หมู่, พักจากโซเชียล และทำกิจกรรมที่ชอบ",
    "ถ้าอยากสร้างสุขให้ตัวเอง ลองทบทวนสิ่งดี ๆ ของวันนี้ ยิ้ม/ขอบคุณคนรอบตัว ตั้งเป้าหมายเล็ก ๆ หยุดคิดวน และคุยกับคนที่ไว้ใจค่ะ",
    ...contact.slice(0, 3),
    "ถ้าน้องมีความคิดทำร้ายตัวเองหรือรู้สึกไม่ปลอดภัย ให้ติดต่อคนใกล้ตัวทันที และโทร 1323 สายด่วนสุขภาพจิต หรือ 1669/โรงพยาบาลใกล้ที่สุดนะคะ",
  ].join("\n");
}

function answerInsuranceQuestion(question: string) {
  if (!/ประกัน|อุบัติเหตุ|คุ้มครอง|ค่ารักษา|สินไหม|ทิพยประกันภัย/.test(question.toLowerCase())) return null;

  return [
    "ประกันอุบัติเหตุกลุ่มสำหรับนักศึกษาใหม่ ปีการศึกษา 2568 คุ้มครองหลัก ๆ แบบนี้ค่ะ",
    "1. เสียชีวิตจากอุบัติเหตุทั่วไป สูญเสียอวัยวะ สายตา หรือทุพพลภาพถาวร: 120,000 บาท",
    "2. เสียชีวิตจากอุบัติเหตุขณะขับขี่หรือโดยสารรถจักรยานยนต์: 75,000 บาท",
    "3. เสียชีวิตจากโรคทั่วไป: ค่าปลงศพ 5,000 บาท โดยมีระยะเวลารอคอย 180 วัน",
    "4. ค่ารักษาพยาบาลจากอุบัติเหตุแต่ละครั้ง: เบิกได้สูงสุด 15,000 บาท",
    "กรณีรักษาพยาบาล นักศึกษาต้องสำรองจ่ายก่อน แล้วนำใบเสร็จรับเงินฉบับจริง ใบรับรองแพทย์ฉบับจริง สำเนาบัตรประชาชน และสำเนาสมุดบัญชีธนาคาร ไปทำเรื่องเบิกคืนค่ะ",
    "ถ้าเกิดอุบัติเหตุ แนะนำให้เข้ารับการรักษาที่สถานพยาบาลของมหาวิทยาลัยเป็นอันดับแรก ถ้าต้องไปรักษาที่อื่น ให้เก็บเอกสารตัวจริงไว้ให้ครบค่ะ",
  ].join("\n");
}

function answerNineQResult(question: string) {
  if (!/9q|แบบประเมินโรคซึมเศร้า 9 คำถาม|ผลแบบประเมินโรคซึมเศร้า/i.test(question)) return null;
  const scoreMatch = question.match(/คะแนนรวม:\s*(\d+)/);
  const q9Match = question.match(/ข้อ 9 ความคิดทำร้ายตนเอง:\s*(\d+)/);
  const score = scoreMatch ? Number(scoreMatch[1]) : null;
  const q9Score = q9Match ? Number(q9Match[1]) : 0;
  if (score === null || Number.isNaN(score)) return null;

  const level = score <= 6 ? "ปกติ/เศร้าเล็กน้อย" : score <= 12 ? "ซึมเศร้าเล็กน้อย" : score <= 18 ? "ซึมเศร้าปานกลาง" : "ซึมเศร้ารุนแรง";
  const nextStep =
    score <= 6
      ? "ตอนนี้คะแนนยังอยู่ในช่วงที่ไม่สูงมาก แต่อย่าละเลยการพักผ่อน การกิน การนอน และการคุยกับคนที่ไว้ใจนะคะ"
      : score <= 12
        ? "คะแนนเริ่มมีสัญญาณที่ควรดูแลจริงจังขึ้น ลองคุยกับพี่ส้ม/พี่แก้ว หรือคนที่ไว้ใจ และติดตามอาการอีกครั้งค่ะ"
        : score <= 18
          ? "คะแนนอยู่ระดับปานกลาง พี่แนะนำให้คุยกับเจ้าหน้าที่ฝ่ายพัฒนานักศึกษา หรือบริการให้คำปรึกษา RMUTT เพื่อประเมินต่ออย่างเหมาะสมนะคะ"
          : "คะแนนอยู่ระดับรุนแรง ควรติดต่อผู้เชี่ยวชาญหรือบริการให้คำปรึกษาโดยเร็ว และไม่ควรอยู่กับความรู้สึกนี้คนเดียวค่ะ";

  const lines = [
    `ผล 9Q ของน้องได้ ${score} คะแนน อยู่ในเกณฑ์: ${level}`,
    "แบบประเมินนี้เป็นการคัดกรอง ไม่ใช่การวินิจฉัยโรคทางคลินิกนะคะ",
    nextStep,
    "ถ้ายังไม่พร้อมคุยกับคลินิกกำลังใจโดยตรง เริ่มจากพี่ส้มหรือพี่แก้ว ฝ่ายพัฒนานักศึกษา ที่ห้องหน้าคณะใกล้ LED ประชาสัมพันธ์หน้าคณะได้ค่ะ",
    "บริการให้คำปรึกษา RMUTT: Hotline 08 0197 2024 หรือ Facebook https://www.facebook.com/profile.php?id=100063935491321",
  ];

  if (q9Score > 0) {
    lines.push("สำคัญมาก: ข้อ 9 มีคะแนนมากกว่า 0 ถ้าตอนนี้มีความคิดทำร้ายตัวเองหรือรู้สึกไม่ปลอดภัย ให้รีบอยู่กับคนใกล้ตัว และโทร 1323 สายด่วนสุขภาพจิต หรือ 1669/โรงพยาบาลใกล้ที่สุดทันทีนะคะ");
  }

  return lines.join("\n");
}

function answerCameraPurchaseQuestion(question: string) {
  const compact = question.toLowerCase().replace(/\s+/g, "");
  const isShortFilm = compact.includes("\u0e2b\u0e19\u0e31\u0e07\u0e2a\u0e31\u0e49\u0e19") || compact.includes("shortfilm") || compact.includes("video");
  const intro = isShortFilm
    ? "\u0e16\u0e49\u0e32\u0e08\u0e30\u0e0b\u0e37\u0e49\u0e2d\u0e01\u0e25\u0e49\u0e2d\u0e07\u0e44\u0e27\u0e49\u0e16\u0e48\u0e32\u0e22\u0e2b\u0e19\u0e31\u0e07\u0e2a\u0e31\u0e49\u0e19 \u0e1e\u0e35\u0e48\u0e40\u0e17\u0e04\u0e08\u0e30\u0e40\u0e19\u0e49\u0e19\u0e27\u0e34\u0e14\u0e35\u0e42\u0e2d, \u0e42\u0e1f\u0e01\u0e31\u0e2a, \u0e40\u0e2a\u0e35\u0e22\u0e07 \u0e41\u0e25\u0e30\u0e40\u0e25\u0e19\u0e2a\u0e4c\u0e01\u0e48\u0e2d\u0e19\u0e04\u0e23\u0e31\u0e1a"
    : "\u0e16\u0e49\u0e32\u0e16\u0e32\u0e21\u0e27\u0e48\u0e32\u0e0b\u0e37\u0e49\u0e2d\u0e01\u0e25\u0e49\u0e2d\u0e07\u0e2d\u0e30\u0e44\u0e23\u0e14\u0e35 \u0e1e\u0e35\u0e48\u0e40\u0e17\u0e04\u0e02\u0e2d\u0e40\u0e23\u0e34\u0e48\u0e21\u0e08\u0e32\u0e01\u0e07\u0e32\u0e19\u0e17\u0e35\u0e48\u0e08\u0e30\u0e43\u0e0a\u0e49\u0e01\u0e48\u0e2d\u0e19\u0e04\u0e23\u0e31\u0e1a";

  return [
    intro,
    "\u0e16\u0e49\u0e32\u0e40\u0e1b\u0e47\u0e19\u0e19\u0e31\u0e01\u0e28\u0e36\u0e01\u0e29\u0e32 FTP \u0e41\u0e25\u0e49\u0e27\u0e15\u0e49\u0e2d\u0e07\u0e17\u0e33\u0e07\u0e32\u0e19\u0e16\u0e48\u0e32\u0e22\u0e20\u0e32\u0e1e/\u0e16\u0e48\u0e32\u0e22\u0e17\u0e33 \u0e04\u0e27\u0e23\u0e40\u0e25\u0e37\u0e2d\u0e01 mirrorless \u0e17\u0e35\u0e48\u0e21\u0e35 4K, \u0e23\u0e39\u0e40\u0e2a\u0e35\u0e22\u0e1a\u0e44\u0e21\u0e04\u0e4c, autofocus \u0e14\u0e35 \u0e41\u0e25\u0e30\u0e2b\u0e32\u0e40\u0e25\u0e19\u0e2a\u0e4c\u0e07\u0e48\u0e32\u0e22",
    "\u0e07\u0e1a\u0e1b\u0e23\u0e30\u0e2b\u0e22\u0e31\u0e14: \u0e14\u0e39\u0e21\u0e37\u0e2d\u0e2a\u0e2d\u0e07\u0e40\u0e0a\u0e48\u0e19 Sony A6400/A6600, Fujifilm X-S10, Canon R50/R10 \u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e40\u0e25\u0e19\u0e2a\u0e4c kit \u0e2b\u0e23\u0e37\u0e2d\u0e40\u0e25\u0e19\u0e2a\u0e4c\u0e23\u0e30\u0e22\u0e30\u0e1b\u0e01\u0e15\u0e34",
    "\u0e07\u0e1a\u0e01\u0e25\u0e32\u0e07: \u0e14\u0e39 Sony ZV-E10 II, Fujifilm X-S20, Canon R8/R7 \u0e16\u0e49\u0e32\u0e40\u0e19\u0e49\u0e19\u0e27\u0e34\u0e14\u0e35\u0e42\u0e2d\u0e41\u0e25\u0e30\u0e07\u0e32\u0e19\u0e01\u0e25\u0e38\u0e48\u0e21",
    "\u0e2d\u0e22\u0e48\u0e32\u0e25\u0e37\u0e21\u0e01\u0e31\u0e19\u0e07\u0e1a\u0e44\u0e27\u0e49\u0e43\u0e2b\u0e49\u0e40\u0e25\u0e19\u0e2a\u0e4c, \u0e44\u0e21\u0e04\u0e4c, tripod/gimbal, memory card \u0e41\u0e25\u0e30\u0e41\u0e1a\u0e15\u0e2a\u0e33\u0e23\u0e2d\u0e07 \u0e40\u0e1e\u0e23\u0e32\u0e30\u0e07\u0e32\u0e19\u0e2a\u0e48\u0e07\u0e08\u0e23\u0e34\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e43\u0e0a\u0e49\u0e41\u0e04\u0e48 body",
    "\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e23\u0e23\u0e30\u0e27\u0e31\u0e07: \u0e2d\u0e22\u0e48\u0e32\u0e0b\u0e37\u0e49\u0e2d\u0e01\u0e25\u0e49\u0e2d\u0e07\u0e41\u0e1e\u0e07\u0e08\u0e19\u0e44\u0e21\u0e48\u0e21\u0e35\u0e40\u0e07\u0e34\u0e19\u0e0b\u0e37\u0e49\u0e2d\u0e40\u0e25\u0e19\u0e2a\u0e4c/\u0e44\u0e21\u0e04\u0e4c \u0e41\u0e25\u0e30\u0e40\u0e0a\u0e47\u0e04\u0e23\u0e32\u0e04\u0e32\u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14\u0e01\u0e48\u0e2d\u0e19\u0e0b\u0e37\u0e49\u0e2d",
    "\u0e1a\u0e2d\u0e01\u0e07\u0e1a\u0e01\u0e31\u0e1a\u0e27\u0e48\u0e32\u0e40\u0e19\u0e49\u0e19\u0e20\u0e32\u0e1e\u0e19\u0e34\u0e48\u0e07, vlog, \u0e2b\u0e19\u0e31\u0e07\u0e2a\u0e31\u0e49\u0e19, \u0e2b\u0e23\u0e37\u0e2d\u0e16\u0e48\u0e32\u0e22\u0e07\u0e32\u0e19\u0e23\u0e31\u0e1a\u0e08\u0e49\u0e32\u0e07\u0e21\u0e32 \u0e1e\u0e35\u0e48\u0e08\u0e30\u0e0a\u0e48\u0e27\u0e22\u0e04\u0e31\u0e14\u0e43\u0e2b\u0e49\u0e40\u0e2b\u0e25\u0e37\u0e2d 2-3 \u0e15\u0e31\u0e27\u0e40\u0e25\u0e37\u0e2d\u0e01",
  ].join("\n\n");
}

function cameraBuyingRequiredSummary() {
  return "แนะนำให้เริ่มจากกล้องเปลี่ยนเลนส์ได้ก่อนค่ะ ถ้างบจำกัดให้ดู DSLR มือสอง และจัดเลนส์ให้ครบ 3 ระยะคือ กว้าง / ปกติ / แคบ โดยใช้งบรวมเป็นตัวตั้งก่อนเลือกรุ่นนะคะ";
}

function answerStudyPlanQuestion(question: string, chunks: KnowledgeChunk[]) {
  const yearMatch = question.match(/\u0e1b\u0e35(?:\u0e17\u0e35\u0e48)?\s*(\d)|\u0e0a\u0e31\u0e49\u0e19\u0e1b\u0e35(?:\u0e17\u0e35\u0e48)?\s*(\d)/);
  const year = yearMatch?.[1] || yearMatch?.[2];
  if (!year || !/\u0e40\u0e23\u0e35\u0e22\u0e19|\u0e27\u0e34\u0e0a\u0e32|\u0e41\u0e1c\u0e19\u0e01\u0e32\u0e23\u0e40\u0e23\u0e35\u0e22\u0e19/.test(question)) return null;

  const termMatch = question.match(/\u0e40\u0e17\u0e2d\u0e21\s*(\d)|\u0e20\u0e32\u0e04(?:\u0e01\u0e32\u0e23\u0e28\u0e36\u0e01\u0e29\u0e32\u0e17\u0e35\u0e48)?\s*(\d)/);
  const requestedTerm = termMatch?.[1] || termMatch?.[2] || "";
  const planChunks = chunks.filter((chunk) =>
    (chunk.knowledge_documents?.title || "").includes("FTP study plan") &&
    (chunk.knowledge_documents?.title || "").includes("year " + year) &&
    (!requestedTerm || (chunk.knowledge_documents?.title || "").includes("term " + requestedTerm)),
  );
  if (!planChunks.length) return null;

  const byTerm = new Map<string, KnowledgeChunk>();
  for (const chunk of planChunks) {
    const title = chunk.knowledge_documents?.title || "";
    const term = title.match(/term (\d)/)?.[1] || "";
    if (term && !byTerm.has(term)) byTerm.set(term, chunk);
  }

  const sections = [...byTerm.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([term, chunk]) => {
      const lines = chunk.content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const total = lines.find((line) => line.startsWith("\u0e23\u0e27\u0e21 ")) || "";
      const courseStart = lines.findIndex((line) => line === "\u0e23\u0e32\u0e22\u0e27\u0e34\u0e0a\u0e32:");
      const courses = courseStart >= 0 ? lines.slice(courseStart + 1).slice(0, 8) : [];
      return ["\u0e40\u0e17\u0e2d\u0e21 " + term + (total ? " (" + total + ")" : ""), ...courses].join("\n");
    });

  if (!sections.length) return null;
  return [
    "\u0e41\u0e1c\u0e19\u0e2b\u0e25\u0e31\u0e01\u0e2a\u0e39\u0e15\u0e23 FTP: \u0e1b\u0e35 " + year + (requestedTerm ? " \u0e40\u0e17\u0e2d\u0e21 " + requestedTerm : "") + " \u0e40\u0e23\u0e35\u0e22\u0e19\u0e1b\u0e23\u0e30\u0e21\u0e32\u0e13\u0e19\u0e35\u0e49\u0e04\u0e23\u0e31\u0e1a",
    ...sections,
    "\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38: \u0e41\u0e1c\u0e19 \u0e01/\u0e02 \u0e08\u0e30\u0e15\u0e48\u0e32\u0e07\u0e01\u0e31\u0e19\u0e0a\u0e31\u0e14\u0e40\u0e08\u0e19\u0e0a\u0e48\u0e27\u0e07\u0e1b\u0e35 4 \u0e40\u0e1e\u0e23\u0e32\u0e30\u0e40\u0e25\u0e37\u0e2d\u0e01 CWIE \u0e2b\u0e23\u0e37\u0e2d\u0e1d\u0e36\u0e01\u0e07\u0e32\u0e19",
  ].join("\n\n").replace(/กราฟ.ก/g, "กราฟิก");
}

function getStudyPlanLookupQuery(question: string) {
  const yearMatch = question.match(/\u0e1b\u0e35(?:\u0e17\u0e35\u0e48)?\s*(\d)|\u0e0a\u0e31\u0e49\u0e19\u0e1b\u0e35(?:\u0e17\u0e35\u0e48)?\s*(\d)/);
  const year = yearMatch?.[1] || yearMatch?.[2];
  if (!year || !/\u0e40\u0e23\u0e35\u0e22\u0e19|\u0e27\u0e34\u0e0a\u0e32|\u0e41\u0e1c\u0e19\u0e01\u0e32\u0e23\u0e40\u0e23\u0e35\u0e22\u0e19/.test(question)) return "";
  const termMatch = question.match(/\u0e40\u0e17\u0e2d\u0e21\s*(\d)|\u0e20\u0e32\u0e04(?:\u0e01\u0e32\u0e23\u0e28\u0e36\u0e01\u0e29\u0e32\u0e17\u0e35\u0e48)?\s*(\d)/);
  const term = termMatch?.[1] || termMatch?.[2] || "";
  return [
    `FTP study plan year ${year}${term ? ` term ${term}` : ""}`,
    `AI READY FTP year ${year} study plan answer`,
    `ปี ${year}${term ? ` เทอม ${term}` : ""} เรียนอะไร รายวิชา แผนการเรียน`,
  ].join("\n");
}

function getStudyPlanLookupParts(question: string) {
  const yearMatch = question.match(/\u0e1b\u0e35(?:\u0e17\u0e35\u0e48)?\s*(\d)|\u0e0a\u0e31\u0e49\u0e19\u0e1b\u0e35(?:\u0e17\u0e35\u0e48)?\s*(\d)/);
  const year = yearMatch?.[1] || yearMatch?.[2] || "";
  if (!year || !/\u0e40\u0e23\u0e35\u0e22\u0e19|\u0e27\u0e34\u0e0a\u0e32|\u0e41\u0e1c\u0e19\u0e01\u0e32\u0e23\u0e40\u0e23\u0e35\u0e22\u0e19/.test(question)) return null;
  const termMatch = question.match(/\u0e40\u0e17\u0e2d\u0e21\s*(\d)|\u0e20\u0e32\u0e04(?:\u0e01\u0e32\u0e23\u0e28\u0e36\u0e01\u0e29\u0e32\u0e17\u0e35\u0e48)?\s*(\d)/);
  const term = termMatch?.[1] || termMatch?.[2] || "";
  return { year, term };
}

function mergeChunks(primary: KnowledgeChunk[], secondary: KnowledgeChunk[]) {
  const seen = new Set<string>();
  return [...secondary, ...primary].filter((chunk) => {
    const key = `${chunk.document_id}:${chunk.chunk_index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function answerOrientationQuestion(question: string) {
  const compact = question.replace(/\s+/g, "");
  const asksOpeningTerm = compact.includes("\u0e40\u0e1b\u0e34\u0e14\u0e40\u0e17\u0e2d\u0e21") || compact.includes("\u0e40\u0e1b\u0e34\u0e14\u0e20\u0e32\u0e04\u0e40\u0e23\u0e35\u0e22\u0e19");
  if (!asksOpeningTerm) return null;

  return [
    "\u0e16\u0e49\u0e32\u0e40\u0e1e\u0e34\u0e48\u0e07\u0e40\u0e1b\u0e34\u0e14\u0e40\u0e17\u0e2d\u0e21 \u0e2a\u0e34\u0e48\u0e07\u0e17\u0e35\u0e48\u0e04\u0e27\u0e23\u0e23\u0e39\u0e49\u0e01\u0e48\u0e2d\u0e19\u0e04\u0e37\u0e2d: \u0e15\u0e32\u0e23\u0e32\u0e07\u0e40\u0e23\u0e35\u0e22\u0e19, \u0e2b\u0e49\u0e2d\u0e07\u0e40\u0e23\u0e35\u0e22\u0e19, \u0e0a\u0e37\u0e48\u0e2d\u0e2d\u0e32\u0e08\u0e32\u0e23\u0e22\u0e4c, \u0e01\u0e25\u0e38\u0e48\u0e21\u0e41\u0e0a\u0e17\u0e27\u0e34\u0e0a\u0e32 \u0e41\u0e25\u0e30\u0e07\u0e32\u0e19\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e2a\u0e48\u0e07\u0e0a\u0e48\u0e27\u0e07\u0e2a\u0e31\u0e1b\u0e14\u0e32\u0e2b\u0e4c\u0e41\u0e23\u0e01\u0e04\u0e23\u0e31\u0e1a",
    "\u0e2a\u0e32\u0e22 FTP \u0e41\u0e19\u0e30\u0e19\u0e33\u0e43\u0e2b\u0e49\u0e40\u0e0a\u0e47\u0e04\u0e14\u0e49\u0e27\u0e22\u0e27\u0e48\u0e32\u0e21\u0e35\u0e27\u0e34\u0e0a\u0e32\u0e1b\u0e0f\u0e34\u0e1a\u0e31\u0e15\u0e34\u0e44\u0e2b\u0e21 \u0e40\u0e1e\u0e23\u0e32\u0e30\u0e2d\u0e32\u0e08\u0e15\u0e49\u0e2d\u0e07\u0e40\u0e15\u0e23\u0e35\u0e22\u0e21\u0e01\u0e25\u0e49\u0e2d\u0e07, \u0e2a\u0e21\u0e38\u0e14, \u0e41\u0e1a\u0e15, \u0e40\u0e21\u0e21, \u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e1f\u0e25\u0e4c\u0e07\u0e32\u0e19\u0e25\u0e48\u0e27\u0e07\u0e2b\u0e19\u0e49\u0e32",
    "\u0e2d\u0e35\u0e01\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e04\u0e37\u0e2d\u0e2d\u0e22\u0e48\u0e32\u0e40\u0e1e\u0e34\u0e48\u0e07\u0e23\u0e2d\u0e43\u0e2b\u0e49\u0e07\u0e32\u0e19\u0e01\u0e2d\u0e07 \u0e43\u0e2b\u0e49\u0e08\u0e14 deadline \u0e41\u0e25\u0e30\u0e41\u0e1a\u0e48\u0e07\u0e07\u0e32\u0e19\u0e17\u0e35\u0e21\u0e15\u0e31\u0e49\u0e07\u0e41\u0e15\u0e48\u0e15\u0e49\u0e19\u0e40\u0e17\u0e2d\u0e21",
    "\u0e15\u0e2d\u0e19\u0e19\u0e35\u0e49\u0e40\u0e23\u0e35\u0e22\u0e19\u0e1b\u0e35\u0e44\u0e2b\u0e19 \u0e40\u0e17\u0e2d\u0e21\u0e44\u0e2b\u0e19\u0e04\u0e23\u0e31\u0e1a? \u0e16\u0e49\u0e32\u0e1a\u0e2d\u0e01\u0e1e\u0e35\u0e48\u0e21\u0e32 \u0e1e\u0e35\u0e48\u0e40\u0e17\u0e04\u0e08\u0e30\u0e14\u0e39\u0e08\u0e32\u0e01\u0e10\u0e32\u0e19\u0e2b\u0e25\u0e31\u0e01\u0e2a\u0e39\u0e15\u0e23\u0e41\u0e25\u0e49\u0e27\u0e1a\u0e2d\u0e01\u0e27\u0e48\u0e32\u0e04\u0e27\u0e23\u0e40\u0e15\u0e23\u0e35\u0e22\u0e21\u0e2d\u0e30\u0e44\u0e23\u0e40\u0e09\u0e1e\u0e32\u0e30\u0e40\u0e17\u0e2d\u0e21\u0e19\u0e31\u0e49\u0e19",
  ].join("\n\n");
}

function answerAdministrationPolicyQuestion(question: string) {
  if (!isAdministrationPolicyQuestion(question)) return null;
  return [
    "นโยบายหลัก: สร้างนักเทคโนโลยีที่มีคุณภาพมาตรฐานระดับสากล ที่เป็นนักปฏิบัติ มีคุณธรรมจริยธรรม ด้วยกระบวนการเรียนการสอนที่บูรณาการการเรียนรู้กับการทำงาน (Work Integrated Learning) และการวิจัยและพัฒนา (Research and Development)",
    "วิสัยทัศน์: องค์กรแห่งการพัฒนากำลังคนและนวัตกรรมเพื่อยกระดับอุตสาหกรรมสื่อสู่สากล",
    "ยุทธศาสตร์ 4 ด้าน:",
    "1. Learning to be Innovator : การเรียนรู้สู่การเป็นนวัตกร",
    "2. Research for Innovator : การวิจัยเพื่อสร้างสรรค์นวัตกรรม",
    "3. Social and Culture Enhance by Innovation : การบริการวิชาการและเพิ่มคุณค่าด้วยศิลปวัฒนธรรมด้วยนวัตกรรม",
    "4. Innovative Management : การบริหารจัดการด้วยนวัตกรรม",
    "วัฒนธรรมองค์กร: คิดสร้างคุณค่า ทำอย่างสร้างสรรค์ เชี่ยวชาญเทคโนโลยี",
    "ค่านิยม MCT:",
    "M = Moral : ยึดมั่นในคุณธรรม",
    "C = Creativity : ส่งเสริมความคิดสร้างสรรค์",
    "T = Technology : ใช้และพัฒนาเทคโนโลยีเพื่อสร้างคุณค่า",
  ].join("\n");
}

function answerAcademicCalendarQuestion(question: string) {
  if (!isAcademicCalendarQuestion(question)) return null;

  const lower = question.toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  const isTerm1 = /1\/2569|ภาค\s*1|เทอม\s*1/.test(lower);
  const isTerm2 = /2\/2569|ภาค\s*2|เทอม\s*2/.test(lower);
  const isSummer = /ฤดูร้อน|ซัมเมอร์|summer/.test(lower);
  const asksOpen = /เปิดเทอม|เปิดภาคเรียน/.test(lower);
  const asksClose = /ปิดเทอม|วันสุดท้ายของภาค/.test(lower);
  const asksMidterm = /สอบกลางภาค|กลางภาค/.test(lower);
  const asksFinal = /สอบปลายภาค|ปลายภาค/.test(lower);
  const asksGraduation = /ขอจบ|ขอสำเร็จ|สําเร็จการศึกษา|สำเร็จการศึกษา|ขึ้นทะเบียนบัณฑิต|english exit|เอกสารสำเร็จ/.test(lower);
  const asksRegistration = /ลงทะเบียน|เพิ่มถอน|เพิ่ม-ถอน|ชำระเงิน|ชาระเงิน|ค่าปรับ/.test(lower);
  const asksHoliday = /วันหยุด|สงกรานต์/.test(lower);

  if (asksOpen && !isTerm1 && !isTerm2 && !isSummer) {
    return [
      "ปฏิทินการศึกษา 2569 ระบุวันเปิดภาคเรียนหลักไว้แบบนี้ค่ะ",
      "1. ภาค 1/2569 เปิดภาคเรียนปกติ 6 กรกฎาคม 2569 และภาคพิเศษ 4 กรกฎาคม 2569",
      "2. ภาค 2/2569 เปิดภาคเรียนปกติ 23 พฤศจิกายน 2569 และภาคพิเศษ 21 พฤศจิกายน 2569",
      "3. ภาคฤดูร้อน/2569 เปิดภาคเรียน 5 เมษายน 2570",
      "หมายเหตุ: ถ้าเป็นเรื่องสำคัญให้เช็คประกาศล่าสุดจาก www.oreg.rmutt.ac.th อีกครั้งนะคะ",
    ].join("\n");
  }

  if (isTerm1) {
    if (asksOpen) return "ภาค 1/2569 เปิดภาคเรียนปกติวันที่ 6 กรกฎาคม 2569 ค่ะ ถ้าเป็นภาคพิเศษเปิดวันที่ 4 กรกฎาคม 2569";
    if (asksClose) return "ภาค 1/2569 วันสุดท้ายของภาคการศึกษาคือ 8 พฤศจิกายน 2569 ค่ะ";
    if (asksMidterm) return "ภาค 1/2569 สอบกลางภาควันที่ 29 สิงหาคม - 6 กันยายน 2569 ค่ะ";
    if (asksFinal) return "ภาค 1/2569 สอบปลายภาควันที่ 26 ตุลาคม - 8 พฤศจิกายน 2569 ค่ะ";
    if (asksGraduation) {
      return [
        "ภาค 1/2569 ขอสำเร็จการศึกษาและขึ้นทะเบียนบัณฑิตวันที่ 7 กรกฎาคม - 5 สิงหาคม 2569 ค่ะ",
        "ถ้าขอช้าอยู่ในช่วง 6 สิงหาคม - 4 กันยายน 2569 มีค่าปรับ 500 บาท",
        "ส่ง English Exit Exam ภายใน 16 พฤศจิกายน 2569 และวันสำเร็จการศึกษาคือ 16 พฤศจิกายน 2569",
      ].join("\n");
    }
    if (asksRegistration) {
      return [
        "ภาค 1/2569 เพิ่ม-ถอนรายวิชาวันที่ 28 มิถุนายน - 4 กรกฎาคม 2569 ค่ะ",
        "ชำระเงินค่าลงทะเบียนวันที่ 5-9 กรกฎาคม 2569",
        "ช่วงลงทะเบียน/ชำระเงินล่าช้าคือ 10 กรกฎาคม - 18 สิงหาคม 2569 มีค่าปรับวันละ 50 บาท",
      ].join("\n");
    }
  }

  if (isTerm2) {
    if (asksOpen) return "ภาค 2/2569 เปิดภาคเรียนปกติวันที่ 23 พฤศจิกายน 2569 ค่ะ ถ้าเป็นภาคพิเศษเปิดวันที่ 21 พฤศจิกายน 2569";
    if (asksClose) return "ภาค 2/2569 วันสุดท้ายของภาคการศึกษาคือ 28 มีนาคม 2570 ค่ะ";
    if (asksMidterm) return "ภาค 2/2569 สอบกลางภาควันที่ 16-24 มกราคม 2570 ค่ะ";
    if (asksFinal) return "ภาค 2/2569 สอบปลายภาควันที่ 15-28 มีนาคม 2570 ค่ะ";
    if (asksGraduation) {
      return [
        "ภาค 2/2569 ขอสำเร็จการศึกษาและขึ้นทะเบียนบัณฑิตวันที่ 24 พฤศจิกายน - 23 ธันวาคม 2569 ค่ะ",
        "ถ้าขอช้าอยู่ในช่วง 24 ธันวาคม 2569 - 22 มกราคม 2570 มีค่าปรับ 500 บาท",
        "ส่ง English Exit Exam ภายใน 5 เมษายน 2570 และวันสำเร็จการศึกษาคือ 5 เมษายน 2570",
      ].join("\n");
    }
    if (asksRegistration) {
      return [
        "ภาค 2/2569 ลงทะเบียนนักศึกษาเดิม: ปี 1 วันที่ 16-17 พฤศจิกายน 2569, ปี 4-5 ขึ้นไปวันที่ 18-19 พฤศจิกายน 2569, ปี 2 วันที่ 20-21 พฤศจิกายน 2569, กลุ่มที่ยังไม่ได้ลงทะเบียนวันที่ 22-23 พฤศจิกายน 2569",
        "เพิ่ม-ถอนรายวิชาวันที่ 24-28 พฤศจิกายน 2569 และชำระเงินวันที่ 29 พฤศจิกายน - 3 ธันวาคม 2569",
        "ช่วงลงทะเบียน/ชำระเงินล่าช้าคือ 4 ธันวาคม 2569 - 12 มกราคม 2570 มีค่าปรับวันละ 50 บาท",
      ].join("\n");
    }
  }

  if (isSummer) {
    if (asksOpen) return "ภาคฤดูร้อน/2569 เปิดภาคเรียนวันที่ 5 เมษายน 2570 ค่ะ";
    if (asksClose) return "ภาคฤดูร้อน/2569 วันสุดท้ายของภาคการศึกษาคือ 13 มิถุนายน 2570 ค่ะ";
    if (asksMidterm) return "ภาคฤดูร้อน/2569 สอบกลางภาควันที่ 3-9 พฤษภาคม 2570 ค่ะ";
    if (asksFinal) return "ภาคฤดูร้อน/2569 สอบปลายภาควันที่ 7-13 มิถุนายน 2570 ค่ะ";
    if (asksGraduation) {
      return [
        "ภาคฤดูร้อน/2569 ขอสำเร็จการศึกษาและขึ้นทะเบียนบัณฑิตวันที่ 6-20 เมษายน 2570 ค่ะ",
        "ถ้าขอช้าอยู่ในช่วง 21 เมษายน - 5 พฤษภาคม 2570 มีค่าปรับ 500 บาท",
        "ส่ง English Exit Exam ภายใน 21 มิถุนายน 2570 และวันสำเร็จการศึกษาคือ 21 มิถุนายน 2570",
      ].join("\n");
    }
    if (asksRegistration) {
      return [
        "ภาคฤดูร้อน/2569 ลงทะเบียนวันที่ 29 มีนาคม - 4 เมษายน 2570 ค่ะ",
        "ชำระเงินวันที่ 5-9 เมษายน 2570",
        "ช่วงลงทะเบียน/ชำระเงินล่าช้าคือ 10 เมษายน - 19 พฤษภาคม 2570 มีค่าปรับวันละ 50 บาท",
      ].join("\n");
    }
  }

  if (asksGraduation) {
    return [
      "กำหนดขอสำเร็จการศึกษา ปีการศึกษา 2569 แยกตามภาคเป็นแบบนี้ค่ะ",
      "1. ภาค 1/2569: 7 กรกฎาคม - 5 สิงหาคม 2569, ขอช้า 6 สิงหาคม - 4 กันยายน 2569",
      "2. ภาค 2/2569: 24 พฤศจิกายน - 23 ธันวาคม 2569, ขอช้า 24 ธันวาคม 2569 - 22 มกราคม 2570",
      "3. ภาคฤดูร้อน/2569: 6-20 เมษายน 2570, ขอช้า 21 เมษายน - 5 พฤษภาคม 2570",
      "วันพระราชทานปริญญาบัตรยังไม่กำหนดในปฏิทินฉบับนี้ค่ะ",
    ].join("\n");
  }

  if (asksFinal) {
    return "สอบปลายภาคปีการศึกษา 2569 คือ ภาค 1 วันที่ 26 ตุลาคม - 8 พฤศจิกายน 2569, ภาค 2 วันที่ 15-28 มีนาคม 2570, และภาคฤดูร้อนวันที่ 7-13 มิถุนายน 2570 ค่ะ";
  }

  if (asksMidterm) {
    return "สอบกลางภาคปีการศึกษา 2569 คือ ภาค 1 วันที่ 29 สิงหาคม - 6 กันยายน 2569, ภาค 2 วันที่ 16-24 มกราคม 2570, และภาคฤดูร้อนวันที่ 3-9 พฤษภาคม 2570 ค่ะ";
  }

  if (asksHoliday || compact.includes("สงกรานต์")) {
    return [
      "วันหยุดที่มักถามบ่อยในปฏิทินนี้คือ สงกรานต์ 13-15 เมษายน 2570 ค่ะ",
      "ตัวอย่างวันหยุดอื่น ๆ: ปีใหม่ 1 มกราคม 2570, มาฆบูชา 21 กุมภาพันธ์ 2570, จักรี 6 เมษายน 2570, วิสาขบูชา 20 พฤษภาคม 2570, วันเฉลิมพระชนมพรรษาพระราชินี 3 มิถุนายน 2570",
      "ถ้าน้องอยากดูวันหยุดทั้งหมด บอกพี่เทคว่า 'วันหยุดปี 2569/2570 มีอะไรบ้าง' ได้เลยค่ะ",
    ].join("\n");
  }

  return null;
}

function answerAiReadyQuestion(question: string, chunks: KnowledgeChunk[]) {
  if (!isKnowledgeIntent(question)) return null;
  const chunk =
    chunks.find((item) => (item.knowledge_documents?.title || "").startsWith("AI READY") && item.content.includes("คำถาม:") && item.content.includes("คำตอบ:")) ||
    chunks.find((item) => (item.knowledge_documents?.title || "").startsWith("AI READY"));
  if (!chunk) return null;

  const lines = chunk.content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const questionTerms = question
    .toLowerCase()
    .split(/[\s,.;:!?()[\]{}"']+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
  const compactQuestion = question.toLowerCase().replace(/\s+/g, "");
  const intentTerms = [
    "\u0e01\u0e35\u0e48\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e01\u0e34\u0e15",
    "\u0e2d\u0e32\u0e0a\u0e35\u0e1e",
    "\u0e1b\u0e23\u0e30\u0e01\u0e2d\u0e1a\u0e2d\u0e32\u0e0a\u0e35\u0e1e",
    "\u0e40\u0e04\u0e23\u0e35\u0e22\u0e14",
    "\u0e40\u0e28\u0e23\u0e49\u0e32",
    "\u0e15\u0e34\u0e14\u0e15\u0e48\u0e2d\u0e43\u0e04\u0e23",
    "\u0e04\u0e25\u0e34\u0e19\u0e34\u0e01\u0e01\u0e33\u0e25\u0e31\u0e07\u0e43\u0e08",
    "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e43\u0e08",
    "\u0e2a\u0e38\u0e02\u0e20\u0e32\u0e1e\u0e08\u0e34\u0e15",
    "\u0e08\u0e34\u0e15\u0e27\u0e34\u0e17\u0e22\u0e32",
    "\u0e1b\u0e23\u0e36\u0e01\u0e29\u0e32",
    "hotline",
    "facebook",
    "\u0e1d\u0e36\u0e01\u0e07\u0e32\u0e19",
    "\u0e2a\u0e2b\u0e01\u0e34\u0e08",
    "\u0e2a\u0e21\u0e31\u0e04\u0e23",
    "\u0e2d\u0e32\u0e08\u0e32\u0e23\u0e22\u0e4c",
    "\u0e1b\u0e23\u0e30\u0e01\u0e31\u0e19",
    "ปฏิทินการศึกษา",
    "เปิดเทอม",
    "เปิดภาคเรียน",
    "ปิดเทอม",
    "สอบกลางภาค",
    "สอบปลายภาค",
    "ขอจบ",
    "ขอสำเร็จ",
    "ขึ้นทะเบียนบัณฑิต",
    "english exit",
    "ลงทะเบียน",
    "เพิ่มถอน",
    "วันหยุด",
    "เงินรางวัล",
    "คืนเงินค่าสอบ",
    "ค่าสอบวัดระดับภาษา",
    "วัดระดับภาษา",
    "toeic",
    "ielts",
    "toefl",
    "jlpt",
    "hsk",
    "hskk",
    "นโยบาย",
    "วิสัยทัศน์",
    "ยุทธศาสตร์",
    "วัฒนธรรมองค์กร",
    "ค่านิยม",
    "mct",
    "moral",
    "creativity",
    "innovative management",
    "learning to be innovator",
  ].filter((term) => compactQuestion.includes(term.replace(/\s+/g, "")));
  questionTerms.push(...intentTerms);
  const questionLineIndexes = lines
    .map((line, index) => ({ line: line.toLowerCase(), index }))
    .filter((item) => item.line.startsWith("\u0e04\u0e33\u0e16\u0e32\u0e21:"));
  const bestQuestion = questionLineIndexes
    .map((item) => ({
      index: item.index,
      score: questionTerms.reduce((sum, term) => sum + (item.line.includes(term) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)[0];
  if (questionLineIndexes.length > 0 && (!bestQuestion || bestQuestion.score < 1)) return null;

  const scopedLines = bestQuestion?.score
    ? lines.slice(bestQuestion.index, questionLineIndexes.find((item) => item.index > bestQuestion.index)?.index ?? lines.length)
    : lines;
  const answerStart = scopedLines.findIndex((line) => line.startsWith("\u0e04\u0e33\u0e15\u0e2d\u0e1a:"));
  if (answerStart < 0) return null;

  const inlineAnswer = scopedLines[answerStart].replace(/^\u0e04\u0e33\u0e15\u0e2d\u0e1a:\s*/, "").trim();
  const answerLines = scopedLines
    .slice(answerStart + 1)
    .filter((line) => !line.startsWith("\u0e04\u0e33\u0e16\u0e32\u0e21:"))
    .filter((line) => !line.startsWith("\u0e04\u0e33\u0e15\u0e2d\u0e1a:"))
    .filter((line) => !line.startsWith("\u0e41\u0e2b\u0e25\u0e48\u0e07\u0e17\u0e35\u0e48\u0e21\u0e32:"))
    .slice(0, 14);

  const finalLines = [inlineAnswer, ...answerLines].filter(Boolean);
  if (!finalLines.length) return null;
  return finalLines.join("\n");
}

function answerFacultyRosterQuestion(question: string, chunks: KnowledgeChunk[]) {
  const rosterChunks = chunks.filter((chunk) => chunk.knowledge_documents?.title === "AI READY academic staff MCT curriculum faculty roster");
  if (!rosterChunks.length) return null;
  const content = rosterChunks.map((chunk) => chunk.content).join("\n");
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const lower = question.toLowerCase();
  const questionTerms = lower.split(/[\s,.;:!?()[\]{}"']+/).map((term) => term.trim()).filter((term) => term.length >= 3);

  const isFilmCurriculum =
    /ภาพยนตร์|วิทยุโทรทัศน์|ftp|film|television/.test(lower) ||
    /แอ๋ม|ผึ้ง|อรสุชา|ประภาภร|อุกฤษ|ไวยวุฒิ|กิตติพร|อิทธิพล|สุวัฒน์|อนุสรณ์|ภูเบศ|วิษณุพร|จิรศักดิ์|กมล|วิภาวี|กุลกนิษฐ์|คำรณ|ภาณินี|ชาลิน|กุลภัสสร์/.test(lower);

  const personMatches = lines.filter((line) => {
    if (!line.startsWith("- ")) return false;
    const compactLine = line.toLowerCase().replace(/\s+/g, "");
    return questionTerms.some((term) => compactLine.includes(term.replace(/\s+/g, "")));
  });

  if (personMatches.length) {
    return personMatches.slice(0, 5).join("\n");
  }

  if (/คณบดี/.test(lower)) {
    const dean = lines.find((line) => line.includes("ประภาภร ดลกิจ"));
    return dean ? `คณบดีคณะเทคโนโลยีสื่อสารมวลชนคือ ${dean.replace(/^- /, "")} ค่ะ` : null;
  }

  if (/ประธานหลักสูตร/.test(lower) && isFilmCurriculum) {
    const chair = lines.find((line) => line.includes("อรสุชา อุปกิจ"));
    return chair ? `ประธานหลักสูตรเทคโนโลยีการผลิตภาพยนตร์และวิทยุโทรทัศน์คือ ${chair.replace(/^- /, "")} ค่ะ` : null;
  }

  if (/อาจารย์|คณาจารย์|รายชื่อ/.test(lower) && isFilmCurriculum) {
    const start = lines.findIndex((line) => line.includes("หลักสูตร: เทคโนโลยีการผลิตภาพยนตร์และวิทยุโทรทัศน์"));
    const end = lines.findIndex((line, index) => index > start && line.startsWith("หลักสูตร:"));
    if (start >= 0) {
      return ["คณาจารย์หลักสูตรเทคโนโลยีการผลิตภาพยนตร์และวิทยุโทรทัศน์ มีดังนี้ค่ะ", ...lines.slice(start + 1, end > start ? end : lines.length).filter((line) => line.startsWith("- ")).slice(0, 20)].join("\n");
    }
  }

  return null;
}

function valueFromCourseContent(content: string, label: string) {
  const labels = [
    "รหัสวิชา",
    "ชื่อวิชาไทย",
    "ชื่อวิชาอังกฤษ",
    "คำถามที่เกี่ยวข้อง",
    "หน่วยกิต",
    "หน่วยกิตจริง",
    "ทฤษฎี",
    "ปฏิบัติ",
    "ศึกษาด้วยตนเอง",
    "ประเภทวิชา",
    "หมวดวิชา",
    "กลุ่มวิชา",
    "กลุ่มย่อย",
    "คำอธิบายรายวิชาไทย",
    "คำอธิบายรายวิชาอังกฤษ",
    "แนวทางตอบนักศึกษา",
  ];
  const marker = `${label}:`;
  const start = content.indexOf(marker);
  if (start < 0) return "";
  const valueStart = start + marker.length;
  const nextStarts = labels
    .filter((item) => item !== label)
    .map((item) => content.indexOf(`${item}:`, valueStart))
    .filter((index) => index > valueStart);
  const valueEnd = nextStarts.length ? Math.min(...nextStarts) : content.length;
  return content.slice(valueStart, valueEnd).replace(/\s+/g, " ").trim();
}

function cleanCourseGroup(group: string) {
  return group
    .replace(/\s*ให้ศึกษา(?:จาก)?รายวิชา(?:ต่อไปนี้)?/g, "")
    .replace(/\s*ให้เลือกศึกษา(?:จาก)?รายวิชา(?:ต่อไปนี้)?/g, "")
    .replace(/\s*ให้เลือกศึกษา$/g, "")
    .replace(/\s*จากรายวิชาต่อไปนี้$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function answerCourseCatalogQuestion(question: string, chunks: KnowledgeChunk[]) {
  const lower = question.toLowerCase();
  if (/\u0e1b\u0e35\s*\d|\u0e40\u0e17\u0e2d\u0e21\s*\d|\u0e20\u0e32\u0e04(?:\u0e01\u0e32\u0e23\u0e28\u0e36\u0e01\u0e29\u0e32\u0e17\u0e35\u0e48)?\s*\d/.test(lower)) return null;
  const hasCourseIntent = /\d{2}-\d{3}-\d{3}|\u0e2a\u0e2d\u0e19\u0e2d\u0e30\u0e44\u0e23|\u0e40\u0e23\u0e35\u0e22\u0e19\u0e2d\u0e30\u0e44\u0e23|\u0e27\u0e34\u0e0a\u0e32|\u0e04\u0e33\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22|course/.test(lower);
  if (!hasCourseIntent) return null;

  const courseChunk = chunks.find((chunk) => {
    const title = chunk.knowledge_documents?.title || "";
    return title.startsWith("FTP course catalog") && !title.endsWith("summary");
  });
  if (!courseChunk) return null;

  const content = courseChunk.content;
  const code = valueFromCourseContent(content, "\u0e23\u0e2b\u0e31\u0e2a\u0e27\u0e34\u0e0a\u0e32");
  const thaiName = valueFromCourseContent(content, "\u0e0a\u0e37\u0e48\u0e2d\u0e27\u0e34\u0e0a\u0e32\u0e44\u0e17\u0e22");
  const englishName = valueFromCourseContent(content, "\u0e0a\u0e37\u0e48\u0e2d\u0e27\u0e34\u0e0a\u0e32\u0e2d\u0e31\u0e07\u0e01\u0e24\u0e29");
  const credits = valueFromCourseContent(content, "\u0e2b\u0e19\u0e48\u0e27\u0e22\u0e01\u0e34\u0e15");
  const type = valueFromCourseContent(content, "\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17\u0e27\u0e34\u0e0a\u0e32");
  const group = cleanCourseGroup(valueFromCourseContent(content, "\u0e01\u0e25\u0e38\u0e48\u0e21\u0e27\u0e34\u0e0a\u0e32"));
  const thaiDescription = valueFromCourseContent(content, "\u0e04\u0e33\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22\u0e23\u0e32\u0e22\u0e27\u0e34\u0e0a\u0e32\u0e44\u0e17\u0e22");
  if (!code || !thaiName) return null;

  return [
    `วิชา ${code} ${thaiName}${englishName ? ` (${englishName})` : ""}`,
    `หน่วยกิต: ${credits || "ไม่ระบุ"}${type ? `, ประเภท: ${type}` : ""}`,
    thaiDescription ? `เรียนเกี่ยวกับ: ${thaiDescription}` : "ยังไม่มีคำอธิบายรายวิชาไทยในฐานค่ะ",
    group ? `อยู่ในกลุ่ม: ${group}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function answerRetireCheck(question: string) {
  const lower = question.toLowerCase();
  const isRetireQuestion = /retire|\u0e23\u0e35\u0e44\u0e17\u0e23\u0e4c|\u0e1e\u0e49\u0e19\u0e2a\u0e20\u0e32\u0e1e|gpa|\u0e40\u0e01\u0e23\u0e14\u0e40\u0e09\u0e25\u0e35\u0e48\u0e22/.test(lower);
  if (!isRetireQuestion) return null;

  const gpaMatch = lower.match(/(?:gpa|เกรดเฉลี่ย)?\s*([0-4](?:\.\d+)?)/i);
  const creditAfterKeyword = lower.match(/(?:หน่วยกิต|credits?|cr)\s*([0-9]{1,3})/i);
  const creditBeforeKeyword = lower.match(/(?:^|[^\d.])([0-9]{1,3})\s*(?:หน่วยกิต|credits?|cr)/i);
  const gpa = gpaMatch ? Number(gpaMatch[1]) : null;
  const credits = creditAfterKeyword
    ? Number(creditAfterKeyword[1])
    : creditBeforeKeyword
      ? Number(creditBeforeKeyword[1])
      : null;
  if (gpa === null || credits === null || Number.isNaN(gpa) || Number.isNaN(credits)) return null;

  const threshold = credits < 30 ? 1.0 : credits < 60 ? 1.5 : 1.75;
  const rangeText =
    credits < 30
      ? "หน่วยกิตสะสมน้อยกว่า 30"
      : credits < 60
        ? "หน่วยกิตสะสม 30-59"
        : "หน่วยกิตสะสมตั้งแต่ 60 ขึ้นไป แต่ยังไม่ครบหลักสูตร";
  const isAtRisk = gpa < threshold;

  return [
    isAtRisk
      ? `จากเกณฑ์ที่มีในฐาน ตอนนี้เสี่ยงพ้นสภาพค่ะ เพราะ ${rangeText} ต้องมี GPA ไม่ต่ำกว่า ${threshold.toFixed(2)} แต่ตอนนี้ GPA ${gpa.toFixed(2)}`
      : `จากเกณฑ์ที่มีในฐาน ตอนนี้ยังไม่เข้าเกณฑ์พ้นสภาพค่ะ เพราะ ${rangeText} เกณฑ์ขั้นต่ำคือ GPA ${threshold.toFixed(2)} และตอนนี้ GPA ${gpa.toFixed(2)}`,
    "ถ้าหน่วยกิตสะสมครบตามหลักสูตรแล้ว เกณฑ์จะขยับเป็นต้องไม่ต่ำกว่า GPA 1.80",
    "แนะนำให้เช็กข้อมูลล่าสุดกับทะเบียน/อาจารย์ที่ปรึกษาอีกที โดยเฉพาะถ้ากำลังรอเกรด I, W, S/U หรือมีรายวิชาที่เพิ่งแก้เกรด",
  ].join("\n\n");
}


export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/", request.url));
}

export async function POST(request: Request) {
  try {
    const { messages, clientId, responseLanguage } = (await request.json()) as {
      messages?: ChatMessage[];
      clientId?: string;
      responseLanguage?: unknown;
    };
    const language = normalizeResponseLanguage(responseLanguage);
    const clientKey = String(clientId || "");
    const cleanMessages = (messages ?? [])
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({ role: message.role, content: String(message.content || "").slice(0, 4000) }));

    const lastUserMessage = [...cleanMessages].reverse().find((message) => message.role === "user")?.content;
    if (!lastUserMessage) {
      return NextResponse.json({ error: "กรุณาพิมพ์คำถาม" }, { status: 400 });
    }

    let cooldownEnabled = false;
    let cooldownLimit = 1;
    let groqEnabled = false;
    let aiForceEnabled = false;
    let aiForceStartOrder: number | null = null;
    try {
      const settings = await getAppSettings();
      cooldownEnabled = settings.deepseekCooldownEnabled;
      cooldownLimit = settings.deepseekCooldownLimit;
      groqEnabled = settings.groqEnabled;
      aiForceEnabled = settings.aiForceEnabled;
      aiForceStartOrder = settings.aiForceStartOrder;
    } catch {}
    const aiRouting = { groqEnabled, aiForceEnabled, aiForceStartOrder };

    const deepseekCooldownCheck = checkDeepSeekCooldown(request, clientKey, cooldownEnabled);
    if (deepseekCooldownCheck.blocked) {
      return NextResponse.json(
        {
          error: "พี่เทคกำลังคุยกับน้องอีกคนอยู่ ขอให้รอคิวแปปนึงนะคะ",
          reason: "deepseek-cooldown",
          lockedUntil: deepseekCooldownCheck.lockedUntil,
          providerStatus: "deepseek",
        },
        { status: 429 },
      );
    }

    const spamCheck = checkSpam(request, clientKey, lastUserMessage);
    if (spamCheck.blocked) {
      return NextResponse.json(
        {
          error: "ระบบตรวจพบการส่งข้อความถี่เกินไป จึงล็อกการส่งชั่วคราว",
          reason: spamCheck.reason,
          lockedUntil: spamCheck.lockedUntil,
        },
        { status: 429 },
      );
    }

    const intent = inferIntent(cleanMessages, lastUserMessage);
    const knowledgeQuery = intent.query;
    let chunks: KnowledgeChunk[] = [];

    if (intent.type === "study_plan") {
      try {
        chunks = mergeChunks(chunks, await getStudyPlanChunks(intent.year, intent.term));
      } catch {}
      try {
        chunks = mergeChunks(chunks, await searchKnowledge(knowledgeQuery));
      } catch {}
    } else if (intent.type !== "general" && intent.type !== "orientation" && intent.type !== "ptech_meaning") {
      try {
        chunks = await searchKnowledge(knowledgeQuery);
      } catch {
        chunks = [];
      }
    }

    if (intent.type === "ptech_meaning") {
      const ptechMeaningAnswer = answerPTechMeaning(lastUserMessage);
      return NextResponse.json({
        answer: await localizeAnswer(ptechMeaningAnswer || "", language),
        provider: "knowledge-direct",
        sources: [],
      });
    }

    if (intent.type === "nine_q") {
      const nineQAnswer = answerNineQResult(lastUserMessage);
      if (!nineQAnswer) {
        return NextResponse.json({
          answer: await localizeAnswer("แบบประเมิน 9Q ควรทำผ่านหน้าต่างแบบประเมินก่อนนะคะ แล้วระบบจะส่งคะแนนรวมมาให้พี่เทคช่วยแนะนำต่อค่ะ", language),
          provider: "conversation-direct",
          sources: [],
        });
      }
      return NextResponse.json({
        answer: await localizeAnswer(nineQAnswer, language),
        provider: "knowledge-direct",
        sources: chunks.map((chunk) => ({
          id: chunk.document_id,
          title: chunk.knowledge_documents?.title ?? "เอกสารไม่ระบุชื่อ",
          type: chunk.knowledge_documents?.source_type ?? "text",
        })),
      });
    }

    if (intent.type === "mental_health") {
      const mentalHealthAnswer = answerMentalHealthQuestion(lastUserMessage);
      return NextResponse.json({
        answer: await localizeAnswer(mentalHealthAnswer || "", language),
        provider: "knowledge-direct",
        sources: chunks.map((chunk) => ({
          id: chunk.document_id,
          title: chunk.knowledge_documents?.title ?? "เอกสารไม่ระบุชื่อ",
          type: chunk.knowledge_documents?.source_type ?? "text",
        })),
      });
    }

    if (intent.type === "insurance") {
      const insuranceAnswer = answerInsuranceQuestion(lastUserMessage) || answerAiReadyQuestion(lastUserMessage, chunks);
      if (insuranceAnswer) {
        return NextResponse.json({
          answer: await localizeAnswer(insuranceAnswer, language),
          provider: "knowledge-direct",
          sources: chunks.map((chunk) => ({
            id: chunk.document_id,
            title: chunk.knowledge_documents?.title ?? "เอกสารไม่ระบุชื่อ",
            type: chunk.knowledge_documents?.source_type ?? "text",
          })),
        });
      }
    }

    if (intent.type === "retire") {
      const retireCheckAnswer = answerRetireCheck(lastUserMessage);
      if (!retireCheckAnswer) {
        try {
          chunks = chunks.length ? chunks : await searchKnowledge("รีไทร์ พ้นสภาพ เกรดเฉลี่ย GPA หน่วยกิต");
        } catch {
          chunks = [];
        }
      }
      const directRetireAnswer = retireCheckAnswer || answerAiReadyQuestion("รีไทร์ พ้นสภาพ เกรดเฉลี่ย GPA หน่วยกิต", chunks);
      if (!directRetireAnswer) {
        const result = await askModel({ messages: cleanMessages, chunks, language, ...aiRouting });
        return chatResponse(request, clientKey, cooldownEnabled, cooldownLimit, {
          answer: presentAnswer(result.answer, language),
          provider: result.provider,
          sources: chunks.map((chunk) => ({
            id: chunk.document_id,
            title: chunk.knowledge_documents?.title ?? "เอกสารไม่ระบุชื่อ",
            type: chunk.knowledge_documents?.source_type ?? "text",
          })),
        });
      }
      return NextResponse.json({
        answer: await localizeAnswer(directRetireAnswer, language),
        provider: "knowledge-direct",
        sources: chunks.map((chunk) => ({
          id: chunk.document_id,
          title: chunk.knowledge_documents?.title ?? "\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23\u0e44\u0e21\u0e48\u0e23\u0e30\u0e1a\u0e38\u0e0a\u0e37\u0e48\u0e2d",
          type: chunk.knowledge_documents?.source_type ?? "text",
        })),
      });
    }

    if (intent.type === "orientation") {
      const orientationAnswer = answerOrientationQuestion(lastUserMessage);
      return NextResponse.json({
        answer: await localizeAnswer(orientationAnswer || "", language),
        provider: "conversation-direct",
        sources: [],
      });
    }

    if (intent.type === "faculty_roster") {
      const rosterChunks = chunks.filter((chunk) => chunk.knowledge_documents?.title === "AI READY academic staff MCT curriculum faculty roster");
      const scopedChunks = rosterChunks.length ? rosterChunks : chunks;
      const rosterAnswer = answerFacultyRosterQuestion(lastUserMessage, scopedChunks) || answerAiReadyQuestion(knowledgeQuery, scopedChunks);
      if (rosterAnswer) {
        return NextResponse.json({
          answer: await localizeAnswer(rosterAnswer, language),
          provider: "knowledge-direct",
          sources: scopedChunks.map((chunk) => ({
            id: chunk.document_id,
            title: chunk.knowledge_documents?.title ?? "เอกสารไม่ระบุชื่อ",
            type: chunk.knowledge_documents?.source_type ?? "text",
          })),
        });
      }
    }

    if (intent.type === "administration_policy") {
      const policyChunks = chunks.filter((chunk) => chunk.knowledge_documents?.title === "AI READY administration faculty policy vision strategy MCT");
      const scopedChunks = policyChunks.length ? policyChunks : chunks;
      const policyAnswer = answerAdministrationPolicyQuestion(lastUserMessage) || answerAiReadyQuestion(lastUserMessage, scopedChunks) || answerAiReadyQuestion(knowledgeQuery, scopedChunks);
      if (policyAnswer) {
        return NextResponse.json({
          answer: await localizeAnswer(policyAnswer, language),
          provider: "knowledge-direct",
          sources: scopedChunks.map((chunk) => ({
            id: chunk.document_id,
            title: chunk.knowledge_documents?.title ?? "เอกสารไม่ระบุชื่อ",
            type: chunk.knowledge_documents?.source_type ?? "text",
          })),
        });
      }

      const result = await askModel({ messages: cleanMessages, chunks: scopedChunks, language, ...aiRouting });
      return chatResponse(request, clientKey, cooldownEnabled, cooldownLimit, {
        answer: presentAnswer(result.answer, language),
        provider: result.provider,
        sources: scopedChunks.map((chunk) => ({
          id: chunk.document_id,
          title: chunk.knowledge_documents?.title ?? "เอกสารไม่ระบุชื่อ",
          type: chunk.knowledge_documents?.source_type ?? "text",
        })),
      });
    }

    if (intent.type === "academic_calendar") {
      const calendarAnswer =
        answerAcademicCalendarQuestion(lastUserMessage) ||
        answerAiReadyQuestion(knowledgeQuery, chunks) ||
        answerAiReadyQuestion(lastUserMessage, chunks);
      if (calendarAnswer) {
        return NextResponse.json({
          answer: await localizeAnswer(calendarAnswer, language),
          provider: "knowledge-direct",
          sources: chunks.map((chunk) => ({
            id: chunk.document_id,
            title: chunk.knowledge_documents?.title ?? "เอกสารไม่ระบุชื่อ",
            type: chunk.knowledge_documents?.source_type ?? "text",
          })),
        });
      }

      const result = await askModel({ messages: cleanMessages, chunks, language, ...aiRouting });
      return chatResponse(request, clientKey, cooldownEnabled, cooldownLimit, {
        answer: presentAnswer(result.answer, language),
        provider: result.provider,
        sources: chunks.map((chunk) => ({
          id: chunk.document_id,
          title: chunk.knowledge_documents?.title ?? "เอกสารไม่ระบุชื่อ",
          type: chunk.knowledge_documents?.source_type ?? "text",
        })),
      });
    }

    if (intent.type === "study_plan") {
      const studyPlanQuestion = `ปี ${intent.year}${intent.term ? ` เทอม ${intent.term}` : ""} เรียนอะไร`;
      const studyPlanAnswer = answerStudyPlanQuestion(studyPlanQuestion, chunks);
      return NextResponse.json({
        answer: await localizeAnswer(studyPlanAnswer || "ยังไม่เจอแผนการเรียนปี/เทอมนี้ในฐานข้อมูลค่ะ ลองระบุปีและเทอมอีกครั้ง เช่น ปี 1 เทอม 1", language),
        provider: "knowledge-direct",
        sources: chunks.map((chunk) => ({
          id: chunk.document_id,
          title: chunk.knowledge_documents?.title ?? "\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23\u0e44\u0e21\u0e48\u0e23\u0e30\u0e1a\u0e38\u0e0a\u0e37\u0e48\u0e2d",
          type: chunk.knowledge_documents?.source_type ?? "text",
        })),
      });
    }

    if (intent.type === "camera_purchase") {
      const cameraChunks = chunks.length ? chunks : await searchKnowledge("AI READY camera buying guide DSLR mirrorless เลนส์ 24-70 กล้องมือสอง");
      if (!cameraChunks.length) {
        return NextResponse.json({
          answer: await localizeAnswer(answerCameraPurchaseQuestion(lastUserMessage), language),
          provider: "conversation-direct",
          sources: [],
        });
      }
      const result = await askModel({
        messages: [
          ...cleanMessages,
          {
            role: "user",
            content: `${lastUserMessage}\n\nให้ขึ้นต้นคำตอบด้วยใจความนี้เสมอ: กล้องเปลี่ยนเลนส์ได้, DSLR มือสอง, เลนส์ครบช่วงกว้าง/ปกติ/แคบ, ใช้งบเป็นตัวตั้ง\nจากนั้นค่อยอธิบายโดยใช้ฐานข้อมูลคำแนะนำซื้อกล้องก่อน แล้วเสริมความรู้ทั่วไปได้ ถ้าต้องอ้างรุ่น/ราคา ให้บอกว่าควรเช็กราคาปัจจุบันจากร้าน/เว็บขายของก่อนซื้อ`,
          },
        ],
        chunks: cameraChunks,
        language,
        ...aiRouting,
      });
      const answer = presentAnswer(result.answer, language);
      const requiredSummary = language === "th" && !/กล้องเปลี่ยนเลนส์ได้|DSLR มือสอง|กว้าง.*ปกติ.*แคบ|ใช้งบ/.test(answer)
        ? `${cameraBuyingRequiredSummary()}\n\n${answer}`
        : answer;
      return chatResponse(request, clientKey, cooldownEnabled, cooldownLimit, {
        answer: requiredSummary,
        provider: result.provider,
        sources: cameraChunks.map((chunk) => ({
          id: chunk.document_id,
          title: chunk.knowledge_documents?.title ?? "เอกสารไม่ระบุชื่อ",
          type: chunk.knowledge_documents?.source_type ?? "text",
        })),
      });
    }

    if (intent.type === "course_catalog") {
      const courseCatalogAnswer = answerCourseCatalogQuestion(knowledgeQuery, chunks);
      return NextResponse.json({
        answer: await localizeAnswer(courseCatalogAnswer || "ยังไม่เจอคำอธิบายรายวิชานี้ในฐานข้อมูลค่ะ ลองพิมพ์ชื่อวิชาเต็มหรือรหัสวิชาอีกครั้งนะคะ", language),
        provider: "knowledge-direct",
        sources: chunks.map((chunk) => ({
          id: chunk.document_id,
          title: chunk.knowledge_documents?.title ?? "\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23\u0e44\u0e21\u0e48\u0e23\u0e30\u0e1a\u0e38\u0e0a\u0e37\u0e48\u0e2d",
          type: chunk.knowledge_documents?.source_type ?? "text",
        })),
      });
    }

    const aiReadyAnswer = answerAiReadyQuestion(knowledgeQuery, chunks);
    if (aiReadyAnswer) {
      return NextResponse.json({
        answer: await localizeAnswer(aiReadyAnswer, language),
        provider: "knowledge-direct",
        sources: chunks.map((chunk) => ({
          id: chunk.document_id,
          title: chunk.knowledge_documents?.title ?? "\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23\u0e44\u0e21\u0e48\u0e23\u0e30\u0e1a\u0e38\u0e0a\u0e37\u0e48\u0e2d",
          type: chunk.knowledge_documents?.source_type ?? "text",
        })),
      });
    }

    const modelChunks = isKnowledgeIntent(knowledgeQuery) ? chunks : [];
    const result = await askModel({ messages: cleanMessages, chunks: modelChunks, language, ...aiRouting });
    return chatResponse(request, clientKey, cooldownEnabled, cooldownLimit, {
      answer: presentAnswer(result.answer, language),
      provider: result.provider,
      sources: modelChunks.map((chunk) => ({
        id: chunk.document_id,
        title: chunk.knowledge_documents?.title ?? "เอกสารไม่ระบุชื่อ",
        type: chunk.knowledge_documents?.source_type ?? "text",
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


