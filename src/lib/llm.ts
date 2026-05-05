import type { ChatMessage, KnowledgeChunk, ResponseLanguage } from "@/lib/types";

const BASIC_KNOWLEDGE = `
พื้นฐานกล้อง: รูรับแสงคุมแสงและระยะชัดลึก, shutter speed คุมการหยุด/เบลอการเคลื่อนไหว, ISO เพิ่มความไวแสงแต่เพิ่ม noise.
การถ่ายภาพ: เริ่มจากวัตถุประสงค์ของภาพ, แสงหลัก, ฉากหลัง, องค์ประกอบ, white balance และโฟกัส.
ภาพยนตร์: แบ่งงานเป็น pre-production, production, post-production แล้วเช็คบท, shot list, continuity, sound, lighting และตัดต่อ.
การเลือกซื้อกล้อง: ให้เริ่มจากงบ, งานหลัก, ขนาดที่ยอมพก, เลนส์ในระบบ, autofocus, stabilization, battery, ช่องต่อไมค์/หูฟัง, และไฟล์วิดีโอที่ต้องใช้.
จิตวิทยาพื้นฐาน: รับฟังก่อน แสดงความเข้าใจ ไม่ตัดสิน ไม่วินิจฉัย ชวนผู้ใช้หายใจช้า ๆ แยกปัญหาเป็นข้อเล็ก ๆ ดูแลร่างกาย พักผ่อน และติดต่อคนที่ไว้ใจหรือผู้เชี่ยวชาญเมื่อจำเป็น.
สุขภาพใจฉุกเฉิน: ถ้าผู้ใช้เสี่ยงทำร้ายตัวเองหรือไม่ปลอดภัย ให้แนะนำให้ติดต่อคนใกล้ตัวทันที โทร 1323 สายด่วนสุขภาพจิต หรือ 1669/โรงพยาบาลใกล้ที่สุด.
`;

function languageInstruction(language: ResponseLanguage) {
  if (language === "en") {
    return [
      "Answer in natural English.",
      "Use the same Thai knowledge base as the source of truth, but rewrite the answer clearly for an international student.",
      "When answering course catalog questions, preserve official course codes and official English course names/descriptions from the source when they are available.",
      "Do not add a translation disclaimer for English.",
    ].join("\n");
  }

  if (language === "zh") {
    return [
      "Answer in Simplified Chinese.",
      "Use the same Thai knowledge base as the source of truth, then translate/rewrite the answer clearly.",
      "Preserve course codes and official English course names where helpful.",
      "Always include this short note at the end: （此内容由泰语资料翻译生成）",
    ].join("\n");
  }

  return [
    "ตอบเป็นภาษาไทยเท่านั้น",
    "ใช้น้ำเสียงผู้หญิง เป็นกันเอง อบอุ่น ลงท้ายด้วย \"ค่ะ\" หรือ \"นะคะ\" ตามธรรมชาติ",
  ].join("\n");
}

function buildSystemPrompt(context: string, hasKnowledge: boolean, language: ResponseLanguage) {
  return `คุณคือ "พี่เทค (Take Care)" ผู้ช่วยรุ่นพี่ผู้หญิงของนักศึกษาใหม่สายภาพยนตร์และภาพถ่าย
${languageInstruction(language)}
ตอบกระชับแต่ต้องมีประโยชน์ ปกติให้ตอบประมาณ 6-10 บรรทัด
ถ้าผู้ใช้ถามเรื่องเครียด เศร้า กังวล หมดไฟ หรือสุขภาพใจ ให้ตอบแบบ supportive counseling เบื้องต้น: รับฟัง สะท้อนความรู้สึก ให้ขั้นตอนดูแลตัวเองที่ทำได้ทันที และแนะนำบริการให้คำปรึกษา/ผู้เชี่ยวชาญเมื่อเหมาะสม
ห้ามวินิจฉัยโรค ห้ามสรุปว่าเป็นโรคทางจิตเวช และห้ามแทนที่นักจิตวิทยา แพทย์ หรือบริการฉุกเฉิน
อย่าตอบสั้นจนผู้ใช้เอาไปทำต่อไม่ได้ และอย่ายาวเป็นบทความถ้าผู้ใช้ไม่ได้ขอ
ใช้ฐานข้อมูลด้านล่างก่อนเฉพาะเมื่อข้อมูลตรงกับคำถามจริง ๆ ถ้าไม่ตรงบริบท ให้ตอบจากความรู้ทั่วไปแทน
ถ้าฐานข้อมูลไม่มีหรือไม่พอ ให้ตอบจากความรู้ทั่วไปของ Gemini แทนแบบธรรมชาติ ห้ามพูดว่าไม่เจอในฐานข้อมูลหรืออธิบายแหล่งข้อมูลให้ผู้ใช้เห็น
ถ้าผู้ใช้ถามว่า "ควรซื้อกล้องรุ่นไหนดี" หรือถามแนะนำซื้ออุปกรณ์ ให้ตอบเป็นหมวด: งานที่ใช้, งบ, ตัวเลือกที่เหมาะ, สิ่งที่ต้องระวัง, และถามงบ/การใช้งานต่อท้าย
สำหรับคำถามซื้อกล้อง ให้ยกตัวอย่างระดับรุ่นหรือสายกล้องได้ แต่ถ้าไม่มั่นใจเรื่องรุ่นล่าสุด ให้บอกให้เช็คราคาปัจจุบันก่อนซื้อ
อย่าอธิบายเรื่องระบบ, Supabase, API key, หรือ provider ให้ผู้ใช้ทั่วไปเห็น

สถานะฐานข้อมูล: ${hasKnowledge ? "พบข้อมูลที่เกี่ยวข้อง" : "ไม่พบข้อมูลที่เกี่ยวข้อง"}

ฐานข้อมูลที่เกี่ยวข้อง:
${context || "ไม่มีข้อมูลที่เกี่ยวข้อง"}

ความรู้ทั่วไปสำรอง:
${BASIC_KNOWLEDGE}`;
}

function toGeminiContents(messages: ChatMessage[]) {
  const conversation = messages.slice(-8).map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  return conversation.length ? conversation : [{ role: "user", parts: [{ text: "สวัสดี" }] }];
}

function toOpenAiMessages(systemPrompt: string, messages: ChatMessage[]) {
  return [
    { role: "system", content: systemPrompt },
    ...messages.slice(-8).map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

function isRateLimitOrQuota(status: number, detail: string) {
  return status === 429 || status === 403 || /rate|quota|limit|resource_exhausted/i.test(detail);
}

async function callGemini(input: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${input.apiKey}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemPrompt }],
        },
        contents: toGeminiContents(input.messages),
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 750,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    return {
      ok: false as const,
      status: response.status,
      detail: detail.slice(0, 500),
    };
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const answer = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  return {
    ok: true as const,
    answer: answer || "",
    provider: input.model,
  };
}

async function callDeepSeek(input: {
  apiKey: string;
  model: string;
  apiBase: string;
  systemPrompt: string;
  messages: ChatMessage[];
}) {
  const response = await fetch(`${input.apiBase.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model: input.model,
      messages: toOpenAiMessages(input.systemPrompt, input.messages),
      temperature: 0.3,
      max_tokens: 750,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return {
      ok: false as const,
      status: response.status,
      detail: detail.slice(0, 500),
    };
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return {
    ok: true as const,
    answer: data.choices?.[0]?.message?.content?.trim() || "",
    provider: input.model,
  };
}

export async function askModel(input: {
  messages: ChatMessage[];
  chunks: KnowledgeChunk[];
  language?: ResponseLanguage;
}) {
  const context = input.chunks
    .map((chunk, index) => {
      const title = chunk.knowledge_documents?.title || "เอกสารไม่ระบุชื่อ";
      return `[${index + 1}] ${title}: ${chunk.content}`;
    })
    .join("\n\n");

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  const deepseekModel = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const deepseekApiBase = process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com";
  const lastMessage = input.messages.at(-1)?.content || "";
  const enrichedMessages = /ซื้อ|รุ่นไหนดี|กล้อง.*ไหนดี|แนะนำ.*กล้อง/i.test(lastMessage)
    ? [
        ...input.messages.slice(0, -1),
        {
          role: "user" as const,
          content: `${lastMessage}\n\nช่วยตอบให้พอใช้งานได้จริง ไม่สั้นเกินไป: แบ่งตามงบ/งานที่ใช้/ตัวเลือก/ข้อควรระวัง และถามงบกลับท้ายคำตอบ`,
        },
      ]
    : input.messages;

  const language = input.language ?? "th";
  const systemPrompt = buildSystemPrompt(context, input.chunks.length > 0, language);

  if (!geminiApiKey || geminiApiKey.includes("replace-with")) {
    return {
      answer: fallbackAnswer(lastMessage, input.chunks, language),
      provider: "local-fallback",
    };
  }

  try {
    const gemini = await callGemini({
      apiKey: geminiApiKey,
      model: geminiModel,
      systemPrompt,
      messages: enrichedMessages,
    });

    if (gemini.ok && gemini.answer) {
      return {
        answer: gemini.answer,
        provider: gemini.provider,
      };
    }

    if (
      deepseekApiKey &&
      !deepseekApiKey.includes("replace-with") &&
      (gemini.ok || isRateLimitOrQuota(gemini.status, gemini.detail))
    ) {
      const deepseek = await callDeepSeek({
        apiKey: deepseekApiKey,
        model: deepseekModel,
        apiBase: deepseekApiBase,
        systemPrompt,
        messages: enrichedMessages,
      });

      if (deepseek.ok && deepseek.answer) {
        return {
          answer: deepseek.answer,
          provider: `${deepseek.provider}-after-gemini-limit`,
        };
      }

      return {
        answer: fallbackAnswer(lastMessage, input.chunks, language),
        provider: deepseek.ok ? "deepseek-empty-fallback" : `deepseek-fallback-${deepseek.status}`,
        detail: deepseek.ok ? "" : deepseek.detail.slice(0, 300),
      };
    }

    return {
      answer: fallbackAnswer(lastMessage, input.chunks, language),
      provider: gemini.ok ? "gemini-empty-fallback" : `gemini-fallback-${gemini.status}`,
      detail: gemini.ok ? "" : gemini.detail.slice(0, 300),
    };
  } catch (error) {
    if (deepseekApiKey && !deepseekApiKey.includes("replace-with")) {
      try {
        const deepseek = await callDeepSeek({
          apiKey: deepseekApiKey,
          model: deepseekModel,
          apiBase: deepseekApiBase,
          systemPrompt,
          messages: enrichedMessages,
        });

        if (deepseek.ok && deepseek.answer) {
          return {
            answer: deepseek.answer,
            provider: `${deepseek.provider}-after-gemini-error`,
          };
        }
      } catch {}
    }

    return {
      answer: fallbackAnswer(lastMessage, input.chunks, language),
      provider: "model-error-fallback",
      detail: error instanceof Error ? error.message.slice(0, 300) : "unknown model error",
    };
  }
}

function fallbackAnswer(question: string, chunks: KnowledgeChunk[], language: ResponseLanguage = "th") {
  const cameraQuestion = /ซื้อ|รุ่นไหนดี|กล้อง.*ไหนดี|แนะนำ.*กล้อง|camera/i.test(question);
  const sourceLine = chunks
    .slice(0, 2)
    .map((chunk) => chunk.knowledge_documents?.title)
    .filter(Boolean)
    .join(", ");

  if (!cameraQuestion) {
    if (language === "en") {
      return "I can help with that, but I need a little more context to answer accurately. Please add the year/semester, course name, document topic, or the exact detail you want checked.";
    }
    if (language === "zh") {
      return "我可以帮你，但需要更多背景才能准确回答。请补充年级/学期、课程名称、文件主题，或你想确认的具体内容。\n（此内容由泰语资料翻译生成）";
    }
    return sourceLine
      ? `คำถามคือ "${question}"\nสรุป: ให้เริ่มจากประเด็นหลัก แล้วเช็คขั้นตอนที่เกี่ยวข้องทีละข้อ\nถ้าอยากได้คำตอบแม่นขึ้น ส่งบริบทเพิ่ม เช่น งบ งานที่ทำ หรืออุปกรณ์ที่มีอยู่`
      : "พี่เทคช่วยได้ค่ะ แต่ขอบริบทเพิ่มนิดนึง เช่น ปี/เทอม ชื่อวิชา หัวข้อเอกสาร หรือรายละเอียดที่อยากให้เช็ก จะได้ตอบให้ตรงกว่านี้นะคะ";
  }

  if (language === "en") {
    return [
      "P'Tech suggests starting with your main goal first, then choosing what actually fits:",
      "For a camera, begin with budget and main use, such as still photos, video, vlogs, or short films.",
      "Beginners should check autofocus, flip screen, stabilization, mic input, and lens availability.",
      "With a limited budget, a used mirrorless camera with a kit lens can be better value than an expensive body without a good lens.",
      "Tell me your budget and what you plan to shoot, and I can narrow the options down.",
    ].join("\n");
  }

  if (language === "zh") {
    return [
      "P'Tech 建议先从主要目标开始，再选择真正适合的方法：",
      "如果要买相机，先看预算和主要用途，例如拍照、视频、vlog 或短片。",
      "新手可以优先看自动对焦、可翻转屏幕、防抖、麦克风接口，以及镜头是否容易购买。",
      "预算有限时，二手无反相机加 kit 镜头，可能比只买昂贵机身更划算。",
      "告诉我预算和拍摄用途，我可以帮你把选择缩小一些。",
      "（此内容由泰语资料翻译生成）",
    ].join("\n");
  }

  return [
    "พี่เทคแนะนำให้เริ่มจากเป้าหมายหลักก่อน แล้วค่อยเลือกวิธีที่ทำได้จริงนะคะ:",
    "ถ้าจะซื้อกล้อง ให้เริ่มจากงบและงานหลักก่อน เช่น ถ่ายภาพนิ่ง วิดีโอ vlog หรือหนังสั้น",
    "มือใหม่ควรดู autofocus ดี, จอพับได้, กันสั่น, ช่องไมค์ และเลนส์ที่หาง่าย",
    "ถ้างบจำกัด กล้อง mirrorless มือสองพร้อมเลนส์ kit อาจคุ้มกว่าซื้อ body แพงแต่ไม่มีเลนส์ดี",
    "บอกงบกับงานที่จะถ่ายมา เดี๋ยวพี่ช่วยคัดรุ่นให้แคบลงค่ะ",
  ].join("\n");
}


