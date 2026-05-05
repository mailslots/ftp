"use client";

import Image from "next/image";
import { CheckSquare, ChevronLeft, ChevronRight, Edit3, FileText, ImageIcon, Loader2, LogIn, LogOut, Plus, Save, Send, Trash2, Upload, X } from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { AppSettings, ChatMessage, KnowledgeDocument, ResponseLanguage } from "@/lib/types";

type Source = { id: string; title: string; type: string };
type DocumentCategory = KnowledgeDocument["category"];
type EditState = { id: string; title: string; text: string; expiresAt: string; notes: string; category: DocumentCategory } | null;
type FaqItem = { label: string; action: "chat" | "assessment" | "link"; prompt?: string; href?: string };
type NineQAssessment = {
  id: string;
  total_score: number;
  severity: "minimal" | "mild" | "moderate" | "severe";
  severity_label: string;
  q9_score: number;
  voluntary_name: string | null;
  voluntary_year: string | null;
  voluntary_group: string | null;
  voluntary_phone: string | null;
  consent_contact: boolean;
  created_at: string;
};
type NineQMonthlySummary = { month: string; total: number; mild: number; moderate: number; severe: number; q9Risk: number };
type ProviderMode = "gemini" | "groq" | "deepseek";
type AiUsagePeriod = "day" | "month" | "year" | "all";
type AiUsageRow = { id: string; order: number; provider: ProviderMode; model: string; count: number; used: boolean };

const documentCategories: { value: DocumentCategory; label: string }[] = [
  { value: "branch", label: "ฐานข้อมูลสาขา" },
  { value: "academic", label: "ฝ่ายวิชาการ" },
  { value: "student_development", label: "ฝ่ายพัฒนานักศึกษา" },
  { value: "academic_staff", label: "ฝ่ายนักวิชาการ" },
  { value: "administration", label: "ฝ่ายบริหาร" },
  { value: "other", label: "อื่นๆ" },
];

const documentsPerPage = 10;

const faqItems: FaqItem[] = [
  { label: "ปี 1 เทอม 1 เรียนอะไร?", action: "chat" },
  { label: "ขอเงินรางวัล/คืนเงินค่าสอบภาษา", action: "chat", prompt: "การขอรับเงินรางวัลและการคืนเงินค่าสอบวัดระดับภาษา ทำอย่างไร?" },
  { label: "นโยบาย/วิสัยทัศน์ของคณะ", action: "chat", prompt: "นโยบาย วิสัยทัศน์ ยุทธศาสตร์ วัฒนธรรมองค์กร และค่านิยม MCT ของคณะคืออะไร?" },
  { label: "ประกันอุบัติเหตุคุ้มครองอะไรบ้าง?", action: "chat" },
  { label: "คลินิกกำลังใจติดต่อได้ที่ไหน?", action: "chat" },
  { label: "แบบประเมินโรคซึมเศร้า 9Q", action: "assessment" },
  { label: "GPA 1.4 หน่วยกิต 50 จะพ้นสภาพไหม?", action: "chat" },
];

const complaintFormUrl = "https://forms.gle/HpJtisPWZLK8chAV9";
const spamLockKey = "ptech-chat-spam-lock-until";
const spamAttemptsKey = "ptech-chat-spam-attempts";
const spamShortAttemptsKey = "ptech-chat-spam-short-attempts";
const deviceIdKey = "ptech-chat-device-id";
const languageKey = "ptech-chat-response-language";

const responseLanguages: { value: ResponseLanguage; label: string; shortLabel: string; flag: string }[] = [
  { value: "th", label: "ภาษาไทย", shortLabel: "TH", flag: "🇹🇭" },
  { value: "en", label: "English", shortLabel: "EN", flag: "🇬🇧" },
  { value: "zh", label: "中文", shortLabel: "ZH", flag: "🇨🇳" },
];

const nineQQuestions = [
  "ท่านรู้สึกเบื่อ ไม่สนใจอยากทำอะไร",
  "ท่านรู้สึกไม่สบายใจ ซึมเศร้า ท้อแท้",
  "ท่านมีอาการหลับยาก หรือหลับ ๆ ตื่น ๆ หรือหลับมากไป",
  "ท่านรู้สึกเหนื่อยง่ายหรือไม่ค่อยมีแรง",
  "ท่านรู้สึกเบื่ออาหารหรือมีพฤติกรรมการกินที่มากเกินไป",
  "ท่านรู้สึกไม่ดีกับตัวเอง คิดว่าตัวเองล้มเหลว หรือทำให้ครอบครัวผิดหวัง",
  "ท่านมีสมาธิไม่ดีเวลาทำอะไร เช่น ดูโทรทัศน์ ฟังวิทยุ หรือทำงานที่ต้องใช้ความตั้งใจ",
  "ท่านพูดช้า ทำอะไรช้าลง จนคนอื่นสังเกตเห็นได้ หรือกระสับกระส่ายไม่สามารถอยู่นิ่งได้เหมือนที่เคยเป็น",
  "ท่านมีความคิดทำร้ายตนเอง หรือคิดว่าถ้าตายไปคงจะดี",
];

const nineQOptions = [
  { label: "ไม่มีเลย", score: 0 },
  { label: "เป็นบางวัน (1 - 7 วัน)", score: 1 },
  { label: "เป็นบ่อย (มากกว่า 7 วัน)", score: 2 },
  { label: "เป็นทุกวัน", score: 3 },
];

const ptechAvatar = "/ptech-avatar.png";

function formatDate(value: string | null) {
  if (!value) return "ถาวร";
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function formatFileSize(size: number | null) {
  if (!size) return "-";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function sourceLabel(type: KnowledgeDocument["source_type"]) {
  if (type === "pdf") return "PDF";
  if (type === "doc") return "DOC";
  if (type === "image") return "รูปภาพ";
  return "ข้อความ";
}

function categoryLabel(category: DocumentCategory) {
  return documentCategories.find((item) => item.value === category)?.label ?? "ฐานข้อมูลสาขา";
}

function sortDocumentsByExpiry(documents: KnowledgeDocument[]) {
  return [...documents].sort((a, b) => {
    const aTime = a.expires_at ? new Date(a.expires_at).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.expires_at ? new Date(b.expires_at).getTime() : Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function interpretNineQ(score: number) {
  if (score <= 6) return "ปกติ/เศร้าเล็กน้อย";
  if (score <= 12) return "ซึมเศร้าเล็กน้อย";
  if (score <= 18) return "ซึมเศร้าปานกลาง";
  return "ซึมเศร้ารุนแรง";
}

function isNineQAtRisk(score: number, q9Score: number) {
  return score >= 7 || q9Score > 0;
}

function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Date(year, month - 1, 1).toLocaleDateString("th-TH", { month: "short", year: "numeric" });
}

function formatLockRemaining(lockedUntil: number, now: number) {
  const seconds = Math.max(1, Math.ceil((lockedUntil - now) / 1000));
  if (seconds < 60) return `${seconds} วินาที`;
  return `${Math.ceil(seconds / 60)} นาที`;
}

function thinkingClass(providerMode: ProviderMode, providerRank: number | null) {
  if (providerMode === "deepseek") return "border-purple-200 bg-purple-50 text-purple-700";
  if (providerMode !== "groq") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  const rank = Math.max(1, Math.min(12, providerRank || 1));
  const scale = [
    "border-red-100 bg-red-50 text-red-500",
    "border-red-100 bg-red-50 text-red-600",
    "border-red-200 bg-red-50 text-red-600",
    "border-red-200 bg-red-100 text-red-700",
    "border-red-300 bg-red-100 text-red-700",
    "border-red-300 bg-red-100 text-red-800",
    "border-red-400 bg-red-100 text-red-800",
    "border-red-400 bg-red-200 text-red-800",
    "border-red-500 bg-red-200 text-red-900",
    "border-red-500 bg-red-200 text-red-900",
    "border-red-600 bg-red-200 text-red-950",
    "border-red-700 bg-red-300 text-red-950",
  ];
  return scale[rank - 1];
}

function getDeviceId() {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(deviceIdKey);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(deviceIdKey, next);
  return next;
}

function getStoredLanguage(): ResponseLanguage {
  if (typeof window === "undefined") return "th";
  const value = localStorage.getItem(languageKey);
  return value === "en" || value === "zh" || value === "th" ? value : "th";
}

function parseStoredTimes(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "number") : [];
  } catch {
    return [];
  }
}

function checkLocalSpam(message: string, now: number) {
  const storedLock = Number(localStorage.getItem(spamLockKey) || 0);
  if (storedLock > now) return { blocked: true, lockedUntil: storedLock };

  const attempts = parseStoredTimes(spamAttemptsKey).filter((time) => now - time < 10_000);
  const shortAttempts = parseStoredTimes(spamShortAttemptsKey).filter((time) => now - time < 20_000);
  const compact = message.replace(/\s+/g, "");
  const tooFast = attempts.length > 0 && now - attempts[attempts.length - 1] < 1_200;

  attempts.push(now);
  if (compact.length <= 2) shortAttempts.push(now);
  localStorage.setItem(spamAttemptsKey, JSON.stringify(attempts));
  localStorage.setItem(spamShortAttemptsKey, JSON.stringify(shortAttempts));

  const shouldLock = tooFast || attempts.length > 5 || shortAttempts.length >= 3;
  if (!shouldLock) return { blocked: false, lockedUntil: 0 };

  const previousViolationCount = Number(localStorage.getItem("ptech-chat-spam-violations") || 0) + 1;
  localStorage.setItem("ptech-chat-spam-violations", String(previousViolationCount));
  const duration = previousViolationCount <= 1 ? 30_000 : previousViolationCount === 2 ? 2 * 60_000 : 10 * 60_000;
  const lockedUntil = now + duration;
  localStorage.setItem(spamLockKey, String(lockedUntil));
  return { blocked: true, lockedUntil };
}

export function PTechApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "สวัสดีค่ะ นี่พี่เทคนะ ถามมาได้เลย พี่จะตอบสั้น ๆ ให้เข้าใจง่ายค่ะ" },
  ]);
  const [input, setInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [, setSources] = useState<Source[]>([]);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<EditState>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState<DocumentCategory>("branch");
  const [documentPage, setDocumentPage] = useState(1);
  const [adminError, setAdminError] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showNineQ, setShowNineQ] = useState(false);
  const [nineQStep, setNineQStep] = useState(0);
  const [nineQAnswers, setNineQAnswers] = useState<number[]>(Array(nineQQuestions.length).fill(-1));
  const [pendingNineQ, setPendingNineQ] = useState<NineQAssessment | null>(null);
  const [showNineQContact, setShowNineQContact] = useState(false);
  const [savingNineQContact, setSavingNineQContact] = useState(false);
  const [nineqAssessments, setNineqAssessments] = useState<NineQAssessment[]>([]);
  const [nineqMonthly, setNineqMonthly] = useState<NineQMonthlySummary[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({ deepseekCooldownEnabled: false, deepseekCooldownLimit: 1, groqEnabled: false });
  const [savingSettings, setSavingSettings] = useState(false);
  const [providerMode, setProviderMode] = useState<ProviderMode>("gemini");
  const [providerRank, setProviderRank] = useState<number | null>(null);
  const [showAiUsage, setShowAiUsage] = useState(false);
  const [aiUsagePeriod, setAiUsagePeriod] = useState<AiUsagePeriod>("day");
  const [aiUsageRows, setAiUsageRows] = useState<AiUsageRow[]>([]);
  const [loadingAiUsage, setLoadingAiUsage] = useState(false);
  const [deviceId] = useState(() => getDeviceId());
  const [responseLanguage, setResponseLanguage] = useState<ResponseLanguage>(() => getStoredLanguage());
  const [spamLockedUntil, setSpamLockedUntil] = useState(() => (typeof window === "undefined" ? 0 : Number(localStorage.getItem(spamLockKey) || 0)));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activeDocuments = useMemo(() => documents.filter((document) => !document.expires_at || new Date(document.expires_at) > new Date()), [documents]);
  const visibleDocuments = useMemo(
    () => sortDocumentsByExpiry(activeDocuments.filter((document) => document.category === activeCategory)),
    [activeDocuments, activeCategory],
  );
  const totalDocumentPages = Math.max(1, Math.ceil(visibleDocuments.length / documentsPerPage));
  const currentDocumentPage = Math.min(documentPage, totalDocumentPages);
  const pagedDocuments = visibleDocuments.slice((currentDocumentPage - 1) * documentsPerPage, currentDocumentPage * documentsPerPage);
  const selectedVisibleIds = selectedIds.filter((id) => visibleDocuments.some((document) => document.id === id));
  const isSpamLocked = spamLockedUntil > nowMs;
  const lockRemainingText = isSpamLocked ? formatLockRemaining(spamLockedUntil, nowMs) : "";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((response) => response.json())
      .then((data) => {
        if (data.authenticated) setAdminEmail(data.email);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!adminEmail) return;
    Promise.all([
      fetch("/api/admin/documents").then((response) => response.json()),
      fetch("/api/admin/nineq").then((response) => response.json()),
      fetch("/api/admin/settings").then((response) => response.json()),
    ])
      .then(([documentData, nineqData, settingsData]) => {
        if (documentData.documents) setDocuments(documentData.documents);
        if (documentData.error) setAdminError(documentData.error);
        if (nineqData.assessments) setNineqAssessments(nineqData.assessments);
        if (nineqData.monthly) setNineqMonthly(nineqData.monthly);
        if (nineqData.error) setAdminError(nineqData.error);
        if (settingsData.settings) setAppSettings(settingsData.settings);
        if (settingsData.error) setAdminError(settingsData.error);
      })
      .catch((error) => setAdminError(error.message));
  }, [adminEmail, refreshKey]);

  function chooseResponseLanguage(language: ResponseLanguage) {
    setResponseLanguage(language);
    localStorage.setItem(languageKey, language);
  }

  async function updateAppSettings(nextSettings: AppSettings) {
    setSavingSettings(true);
    setAdminError("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(nextSettings),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save settings failed");
      setAppSettings(data.settings);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Save settings failed");
    } finally {
      setSavingSettings(false);
    }
  }

  async function loadAiUsage(period: AiUsagePeriod = aiUsagePeriod) {
    setLoadingAiUsage(true);
    setAdminError("");
    try {
      const response = await fetch(`/api/admin/ai-usage?period=${period}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Load AI usage failed");
      setAiUsageRows(data.models ?? []);
      setAiUsagePeriod(data.period ?? period);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Load AI usage failed");
    } finally {
      setLoadingAiUsage(false);
    }
  }

  function openAiUsage() {
    setShowAiUsage(true);
    void loadAiUsage("day");
  }

  async function submitChat(event?: FormEvent, preset?: string) {
    event?.preventDefault();
    const question = (preset || input).trim();
    if (!question || loadingChat) return;

    const localBlock = checkLocalSpam(question, nowMs);
    if (localBlock.blocked) {
      setSpamLockedUntil(localBlock.lockedUntil);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `ระบบล็อกการส่งข้อความชั่วคราว เพราะตรวจพบการส่งถี่เกินไปหรือข้อความสั้นรัว ๆ กรุณารอ ${formatLockRemaining(localBlock.lockedUntil, nowMs)} แล้วค่อยส่งใหม่นะคะ`,
        },
      ]);
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setLoadingChat(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", "x-client-id": deviceId || getDeviceId() },
        body: JSON.stringify({ messages: nextMessages, clientId: deviceId || getDeviceId(), responseLanguage }),
      });
      const data = await response.json();
      if (response.status === 429 && data.lockedUntil) {
        const lockedUntil = Number(data.lockedUntil);
        localStorage.setItem(spamLockKey, String(lockedUntil));
        setSpamLockedUntil(lockedUntil);
        if (data.providerStatus === "deepseek" || data.providerStatus === "groq") setProviderMode(data.providerStatus);
        if (typeof data.providerRank === "number") setProviderRank(data.providerRank);
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content:
              data.reason === "deepseek-cooldown"
                ? `พี่เทคกำลังคุยกับน้องอีกคนอยู่ ขอให้รอคิวแปปนึงนะคะ อีกประมาณ ${formatLockRemaining(lockedUntil, nowMs)} ค่อยส่งใหม่นะ`
                : `ระบบล็อกการส่งข้อความชั่วคราว เพราะตรวจพบการส่งถี่เกินไป กรุณารอ ${formatLockRemaining(lockedUntil, nowMs)} แล้วค่อยส่งใหม่นะคะ`,
          },
        ]);
        return;
      }
      if (!response.ok) throw new Error(data.error || "Chat failed");
      if (data.providerStatus === "gemini" || data.providerStatus === "groq" || data.providerStatus === "deepseek") setProviderMode(data.providerStatus);
      setProviderRank(typeof data.providerRank === "number" ? data.providerRank : null);
      if (data.cooldownLockedUntil) {
        localStorage.setItem(spamLockKey, String(data.cooldownLockedUntil));
        setSpamLockedUntil(Number(data.cooldownLockedUntil));
      }
      setSources(data.sources ?? []);
      setMessages((current) => [...current, { role: "assistant", content: data.answer }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: "ตอนนี้พี่ตอบไม่ได้ ลองถามใหม่อีกครั้งนะ" }]);
    } finally {
      setLoadingChat(false);
    }
  }

  function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submitChat();
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    const data = await response.json();
    if (!response.ok) {
      setAdminError(data.error || "Login failed");
      return;
    }
    setAdminEmail(data.email);
    setShowLogin(false);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAdminEmail(null);
    setDocuments([]);
    setNineqAssessments([]);
    setNineqMonthly([]);
    setSelectedIds([]);
    setEditing(null);
    setShowDocumentModal(false);
    setShowLogin(false);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setAdminError("");
    try {
      const response = await fetch("/api/admin/documents", { method: "POST", body: new FormData(event.currentTarget) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed");
      event.currentTarget.reset();
      setShowDocumentModal(false);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setAdminError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/admin/documents/${editing.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          text: form.get("text"),
          expiresAt: String(form.get("expiresAt") || "") || null,
          notes: form.get("notes"),
          category: form.get("category"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Update failed");
      setEditing(null);
      setShowDocumentModal(false);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocuments(ids: string[]) {
    if (!ids.length) return;
    setAdminError("");
    for (const id of ids) {
      const response = await fetch(`/api/admin/documents/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        setAdminError(data.error || "Delete failed");
        return;
      }
    }
    setDocuments((current) => current.filter((document) => !ids.includes(document.id)));
    setSelectedIds([]);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function openNineQ() {
    setNineQStep(0);
    setNineQAnswers(Array(nineQQuestions.length).fill(-1));
    setShowNineQ(true);
  }

  function handleFaqClick(item: FaqItem) {
    if (item.action === "assessment") {
      openNineQ();
      return;
    }
    if (item.action === "link" && item.href) {
      window.open(item.href, "_blank", "noopener,noreferrer");
      return;
    }
    void submitChat(undefined, item.prompt ?? item.label);
  }

  function setNineQAnswer(score: number) {
    setNineQAnswers((current) => current.map((value, index) => (index === nineQStep ? score : value)));
  }

  async function submitNineQ() {
    if (nineQAnswers.some((answer) => answer < 0)) return;
    const total = nineQAnswers.reduce((sum, answer) => sum + answer, 0);
    const level = interpretNineQ(total);
    const q9Score = nineQAnswers[8] ?? 0;
    const atRisk = isNineQAtRisk(total, q9Score);
    const answerLines = nineQAnswers.map((score, index) => `ข้อ ${index + 1}: ${nineQOptions.find((option) => option.score === score)?.label ?? "-"} (${score} คะแนน)`);
    const prompt = [
      "ผลแบบประเมินโรคซึมเศร้า 9 คำถาม (9Q)",
      "หมายเหตุ: แบบประเมินนี้ใช้เพื่อคัดกรองและติดตามความรุนแรงของอาการ ไม่สามารถแทนการประเมินและวินิจฉัยทางคลินิกได้",
      "อ้างอิงความรู้สึกในช่วงสองสัปดาห์ที่ผ่านมา",
      `คะแนนรวม: ${total} คะแนน`,
      `ระดับตามเกณฑ์: ${level}`,
      "เกณฑ์แปลผล: 0-6 ปกติ/เศร้าเล็กน้อย, 7-12 ซึมเศร้าเล็กน้อย, 13-18 ซึมเศร้าปานกลาง, 19 ขึ้นไป ซึมเศร้ารุนแรง",
      `ข้อ 9 ความคิดทำร้ายตนเอง: ${q9Score} คะแนน`,
      "คำตอบรายข้อ:",
      ...answerLines,
      "ช่วยอธิบายผลแบบเข้าใจง่ายและแนะนำขั้นตอนต่อไปให้หน่อยค่ะ",
    ].join("\n");
    setShowNineQ(false);
    if (atRisk) {
      fetch("/api/nineq", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId: deviceId || getDeviceId(), answers: nineQAnswers }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.assessment) {
            setPendingNineQ(data.assessment);
            setShowNineQContact(true);
            setRefreshKey((key) => key + 1);
          }
        })
        .catch(() => null);
    }
    void submitChat(undefined, prompt);
  }

  async function submitNineQContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingNineQ) return;
    setSavingNineQContact(true);
    const form = new FormData(event.currentTarget);
    try {
      await fetch("/api/nineq", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: pendingNineQ.id,
          name: form.get("name"),
          year: form.get("year"),
          group: form.get("group"),
          phone: form.get("phone"),
          consentContact: form.get("consentContact") === "on",
        }),
      });
      setShowNineQContact(false);
      setPendingNineQ(null);
      setRefreshKey((key) => key + 1);
    } finally {
      setSavingNineQContact(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef3f8_52%,#ffffff_100%)] text-[#0d1b2e]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1240px] flex-col px-4 py-4 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0d1b2e]/10 pb-4">
          <div className="flex items-center gap-3">
            <Image src={ptechAvatar} alt="พี่เทค" width={48} height={48} priority className="h-12 w-12 rounded-full border-2 border-white object-cover object-[50%_34%] shadow-md shadow-[#0d1b2e]/18" />
            <div>
              <h1 className="text-2xl font-semibold leading-tight tracking-normal">พี่เทค <span className="text-base font-medium text-[#42526a]">(Take Care)</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-white/80 bg-white/64 p-1 shadow-sm backdrop-blur-xl" aria-label="เลือกภาษาคำตอบ">
            {responseLanguages.map((language) => {
              const active = responseLanguage === language.value;
              return (
                <button
                  key={language.value}
                  type="button"
                  onClick={() => chooseResponseLanguage(language.value)}
                  className={`inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-sm font-semibold transition ${
                    active ? "bg-[#0d1b2e] text-white shadow-sm" : "text-[#42526a] hover:bg-white/80 hover:text-[#0d1b2e]"
                  }`}
                  aria-pressed={active}
                  aria-label={language.label}
                  title={language.label}
                >
                  <span className="text-base leading-none" aria-hidden="true">{language.flag}</span>
                  <span className="hidden sm:inline">{language.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </header>

        <section className="py-4">
          <section className="flex min-h-[680px] flex-col overflow-hidden rounded-lg border border-white/70 bg-white/58 shadow-[0_22px_70px_rgba(13,27,46,0.12)] backdrop-blur-2xl">
            <div className="border-b border-[#0d1b2e]/10 bg-white/45 px-5 py-4 backdrop-blur-xl">
              <h2 className="text-lg font-semibold text-[#0d1b2e]">ห้องคุยกับพี่เทค</h2>
              <p className="text-sm font-medium text-[#0d1b2e]">สาขาวิชาเทคโนโลยีการผลิตภาพยนตร์และวิทยุโทรทัศน์</p>
              {isSpamLocked && (
                <div className="mt-3 rounded-md border border-[#dc2626]/20 bg-red-50 px-3 py-2 text-sm leading-6 text-[#7f1d1d]">
                  เครื่องนี้ถูกล็อกการส่งข้อความชั่วคราว กรุณารอ {lockRemainingText} เพื่อป้องกัน spam หรือการกดส่งรัว ๆ
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && (
                    <Image src={ptechAvatar} alt="พี่เทค" width={36} height={36} className="mr-2 mt-1 h-9 w-9 shrink-0 rounded-full border border-white object-cover object-[50%_34%] shadow-sm" />
                  )}
                  <div className={`max-w-[82%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-7 shadow-sm ${message.role === "user" ? "bg-[#0d1b2e] text-white" : "border border-white/80 bg-white/72 text-[#0d1b2e] backdrop-blur-xl"}`}>
                    {message.content}
                  </div>
                </div>
              ))}
              {loadingChat && (
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium ${thinkingClass(providerMode, providerRank)}`}>
                  <Loader2 className="animate-spin" size={16} />
                  พี่เทคกำลังคิดคำตอบ
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={submitChat} className="flex gap-2 border-t border-[#0d1b2e]/10 bg-white/45 p-4 backdrop-blur-xl">
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={submitOnEnter} rows={2} disabled={isSpamLocked} placeholder={isSpamLocked ? `รออีก ${lockRemainingText} ก่อนส่งข้อความใหม่` : "พิมพ์คำถาม แล้วกด Enter เพื่อส่ง หรือ Shift+Enter เพื่อขึ้นบรรทัดใหม่"} className="min-h-12 flex-1 resize-none rounded-md border border-white/80 bg-white/75 px-3 py-3 text-sm leading-6 text-[#0d1b2e] outline-none backdrop-blur focus:border-[#dc2626] focus:ring-2 focus:ring-[#dc2626]/15 disabled:cursor-not-allowed disabled:opacity-60" />
              <button type="submit" disabled={loadingChat || isSpamLocked} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#dc2626] text-white shadow-sm shadow-[#dc2626]/25 transition hover:bg-[#b91c1c] disabled:opacity-50" aria-label="ส่งคำถาม">
                <Send size={18} />
              </button>
            </form>
          </section>

          <div className="mt-3 rounded-lg border border-white/70 bg-white/62 px-4 py-3 shadow-sm backdrop-blur-xl">
            <div className="mb-2 text-xs font-semibold uppercase text-[#42526a]">FAQ</div>
            <div className="flex flex-wrap gap-2">
              {faqItems.map((item) => (
                <button key={item.label} onClick={() => handleFaqClick(item)} className="rounded-md border border-[#0d1b2e]/10 bg-white/70 px-3 py-1.5 text-xs text-[#0d1b2e] transition hover:border-[#dc2626]/35 hover:bg-white">
                  {item.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => window.open(complaintFormUrl, "_blank", "noopener,noreferrer")}
              className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-[#dc2626] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#dc2626]/20 transition hover:bg-[#b91c1c] sm:w-auto"
            >
              แบบฟอร์มรับเรื่องร้องเรียนและข้อเสนอแนะ
            </button>
          </div>
        </section>

        {adminEmail && (
          <section className="space-y-4 pb-4">
            <section className="rounded-lg border border-[#0d1b2e]/10 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">ตั้งค่าคิวและโมเดลสำรอง</h2>
                  <p className="text-sm leading-6 text-[#42526a]">
                    ถ้าเปิด Groq ระบบจะลอง Groq ก่อน DeepSeek หลัง Gemini เต็ม ส่วน Cooldown จะนับเฉพาะตอนที่ระบบไปถึง DeepSeek
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={openAiUsage}
                    className="inline-flex min-w-[112px] items-center justify-center rounded-md border border-[#0d1b2e]/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#0d1b2e] transition hover:bg-[#eef3f8]"
                  >
                    ลำดับ AI
                  </button>
                  <button
                    type="button"
                    disabled={savingSettings}
                    onClick={() => updateAppSettings({ ...appSettings, groqEnabled: !appSettings.groqEnabled })}
                    className={`inline-flex min-w-[112px] items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                      appSettings.groqEnabled ? "bg-[#dc2626] text-white" : "border border-[#0d1b2e]/15 bg-white text-[#0d1b2e] hover:bg-[#eef3f8]"
                    }`}
                  >
                    {savingSettings ? <Loader2 className="mr-2 animate-spin" size={16} /> : null}
                    {appSettings.groqEnabled ? "Groq เปิดอยู่" : "Groq ปิดอยู่"}
                  </button>
                  <button
                    type="button"
                    disabled={savingSettings}
                    onClick={() => updateAppSettings({ ...appSettings, deepseekCooldownEnabled: !appSettings.deepseekCooldownEnabled })}
                    className={`inline-flex min-w-[128px] items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                      appSettings.deepseekCooldownEnabled ? "bg-[#0d1b2e] text-white" : "border border-[#0d1b2e]/15 bg-white text-[#0d1b2e] hover:bg-[#eef3f8]"
                    }`}
                  >
                    {appSettings.deepseekCooldownEnabled ? "Cooldown เปิดอยู่" : "Cooldown ปิดอยู่"}
                  </button>
                  <label className="inline-flex items-center gap-2 rounded-md border border-[#0d1b2e]/15 bg-white px-3 py-2 text-sm text-[#42526a]">
                    ครบ
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={appSettings.deepseekCooldownLimit}
                      onChange={(event) => setAppSettings((current) => ({ ...current, deepseekCooldownLimit: Math.max(1, Math.min(20, Number(event.target.value) || 1)) }))}
                      onBlur={() => updateAppSettings(appSettings)}
                      className="h-8 w-16 rounded border border-[#0d1b2e]/15 px-2 text-center text-[#0d1b2e] outline-none focus:border-[#dc2626]"
                    />
                    ครั้ง
                  </label>
                </div>
              </div>
            </section>
            <section className="rounded-lg border border-[#0d1b2e]/10 bg-white p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">สรุป 9Q ที่มีแนวโน้มควรดูแล</h2>
                  <p className="text-sm text-[#42526a]">บันทึกเฉพาะผลที่ได้ 7 คะแนนขึ้นไป หรือข้อ 9 มากกว่า 0 และข้อมูลติดต่อเป็นข้อมูลสมัครใจ</p>
                </div>
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-[#991b1b]">{nineqAssessments.length} รายการ</div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {nineqMonthly.slice(0, 3).map((item) => (
                  <div key={item.month} className="rounded-lg border border-[#0d1b2e]/10 bg-[#f8fafc] p-4">
                    <div className="text-sm font-semibold text-[#0d1b2e]">{formatMonth(item.month)}</div>
                    <div className="mt-2 text-2xl font-semibold text-[#dc2626]">{item.total}</div>
                    <div className="mt-1 text-xs leading-5 text-[#42526a]">เล็กน้อย {item.mild} · ปานกลาง {item.moderate} · รุนแรง {item.severe} · ข้อ 9 เสี่ยง {item.q9Risk}</div>
                  </div>
                ))}
                {nineqMonthly.length === 0 && <div className="rounded-lg border border-[#0d1b2e]/10 bg-[#f8fafc] p-4 text-sm text-[#42526a] md:col-span-3">ยังไม่มีข้อมูล 9Q ที่เข้าเกณฑ์เสี่ยง</div>}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead className="bg-white/55 text-left text-xs uppercase text-[#42526a]">
                    <tr>
                      <th className="border-b border-[#0d1b2e]/10 px-4 py-3 font-semibold">วันที่</th>
                      <th className="border-b border-[#0d1b2e]/10 px-4 py-3 font-semibold">คะแนน</th>
                      <th className="border-b border-[#0d1b2e]/10 px-4 py-3 font-semibold">ระดับ</th>
                      <th className="border-b border-[#0d1b2e]/10 px-4 py-3 font-semibold">ข้อ 9</th>
                      <th className="border-b border-[#0d1b2e]/10 px-4 py-3 font-semibold">ชื่อ/ชั้นปี/กลุ่ม</th>
                      <th className="border-b border-[#0d1b2e]/10 px-4 py-3 font-semibold">เบอร์ติดต่อ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nineqAssessments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-[#42526a]">ยังไม่มีข้อมูล</td>
                      </tr>
                    ) : (
                      nineqAssessments.slice(0, 30).map((item) => (
                        <tr key={item.id} className="border-b border-[#eef1ec] last:border-b-0">
                          <td className="px-4 py-4 text-[#42526a]">{formatDate(item.created_at)}</td>
                          <td className="px-4 py-4 font-semibold text-[#0d1b2e]">{item.total_score}</td>
                          <td className="px-4 py-4 text-[#42526a]">{item.severity_label}</td>
                          <td className="px-4 py-4 text-[#42526a]">{item.q9_score}</td>
                          <td className="px-4 py-4 text-[#42526a]">
                            {[item.voluntary_name, item.voluntary_year, item.voluntary_group].filter(Boolean).join(" / ") || "-"}
                          </td>
                          <td className="px-4 py-4 text-[#42526a]">{item.consent_contact ? item.voluntary_phone || "-" : "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-[#0d1b2e]/10 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0d1b2e]/10 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold">ฐานข้อมูลเจ้าหน้าที่</h2>
                  <p className="text-sm text-[#42526a]">แสดง 10 รายการต่อหน้า และเรียงข้อมูลที่ใกล้หมดอายุก่อน</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-[#eef3f8] px-3 py-2 text-sm font-medium text-[#0d1b2e]">{visibleDocuments.length} รายการ</div>
                  <button
                    onClick={() => {
                      setEditing(null);
                      setShowDocumentModal(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-md bg-[#dc2626] px-3 py-2 text-sm font-semibold text-white hover:bg-[#b91c1c]"
                  >
                    <Plus size={15} /> เพิ่มข้อมูล
                  </button>
                  <button disabled={!selectedVisibleIds.length} onClick={() => deleteDocuments(selectedVisibleIds)} className="inline-flex items-center gap-2 rounded-md bg-[#9a3412] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
                    <Trash2 size={15} /> ลบที่เลือก
                  </button>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto border-b border-[#0d1b2e]/10 px-5 py-3">
                {documentCategories.map((category) => {
                  const count = activeDocuments.filter((document) => document.category === category.value).length;
                  const active = activeCategory === category.value;
                  return (
                    <button
                      key={category.value}
                      onClick={() => {
                        setActiveCategory(category.value);
                        setDocumentPage(1);
                        setSelectedIds([]);
                      }}
                      className={`shrink-0 rounded-md border px-3 py-2 text-sm font-medium transition ${
                        active ? "border-[#0d1b2e] bg-[#0d1b2e] text-white" : "border-[#0d1b2e]/10 bg-white text-[#42526a] hover:border-[#dc2626]/35 hover:text-[#0d1b2e]"
                      }`}
                    >
                      {category.label} <span className={active ? "text-white/75" : "text-[#8a96a8]"}>{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead className="bg-white/55 text-left text-xs uppercase  text-[#42526a]">
                    <tr>
                      <th className="border-b border-[#0d1b2e]/10 px-4 py-3 font-semibold">
                        <CheckSquare size={15} />
                      </th>
                      <th className="border-b border-[#0d1b2e]/10 px-4 py-3 font-semibold">ชื่อข้อมูล</th>
                      <th className="border-b border-[#0d1b2e]/10 px-4 py-3 font-semibold">ฝ่าย</th>
                      <th className="border-b border-[#0d1b2e]/10 px-4 py-3 font-semibold">ประเภท</th>
                      <th className="border-b border-[#0d1b2e]/10 px-4 py-3 font-semibold">ขนาด</th>
                      <th className="border-b border-[#0d1b2e]/10 px-4 py-3 font-semibold">สถานะ</th>
                      <th className="border-b border-[#0d1b2e]/10 px-4 py-3 font-semibold">เพิ่มเมื่อ</th>
                      <th className="border-b border-[#0d1b2e]/10 px-4 py-3 text-right font-semibold">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDocuments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-8 text-center text-[#42526a]">ยังไม่มีข้อมูลในหมวดนี้</td>
                      </tr>
                    ) : (
                      pagedDocuments.map((document) => (
                        <tr key={document.id} className="border-b border-[#eef1ec] last:border-b-0">
                          <td className="px-4 py-4">
                            <input type="checkbox" checked={selectedIds.includes(document.id)} onChange={() => toggleSelected(document.id)} />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex min-w-0 items-center gap-2">
                              {document.source_type === "image" ? <ImageIcon size={17} /> : <FileText size={17} />}
                              <span className="truncate font-medium">{document.title}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-[#42526a]">{categoryLabel(document.category)}</td>
                          <td className="px-4 py-4 text-[#42526a]">{sourceLabel(document.source_type)}</td>
                          <td className="px-4 py-4 text-[#42526a]">{formatFileSize(document.file_size)}</td>
                          <td className="px-4 py-4 text-[#42526a]">{formatDate(document.expires_at)}</td>
                          <td className="px-4 py-4 text-[#42526a]">{formatDate(document.created_at)}</td>
                          <td className="px-4 py-4 text-right">
                            <button
                              onClick={() => {
                                setEditing({ id: document.id, title: document.title, text: document.extracted_text || "", expiresAt: toDateTimeLocal(document.expires_at), notes: document.notes || "", category: document.category });
                                setShowDocumentModal(true);
                              }}
                              className="mr-1 inline-flex items-center justify-center rounded-md p-2 text-[#0d1b2e] hover:bg-[#eef3f8]"
                              aria-label="แก้ไข"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button onClick={() => deleteDocuments([document.id])} className="inline-flex items-center justify-center rounded-md p-2 text-[#9a3412] hover:bg-[#fff1e8]" aria-label="ลบ">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#0d1b2e]/10 px-5 py-4">
                <div className="text-sm text-[#42526a]">
                  หน้า {currentDocumentPage} จาก {totalDocumentPages} · แสดง {pagedDocuments.length} จาก {visibleDocuments.length} รายการ
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    disabled={currentDocumentPage <= 1}
                    onClick={() => setDocumentPage((page) => Math.max(1, page - 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#0d1b2e]/10 text-[#0d1b2e] disabled:opacity-35"
                    aria-label="หน้าก่อนหน้า"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalDocumentPages }, (_, index) => index + 1)
                    .slice(Math.max(0, currentDocumentPage - 3), Math.min(totalDocumentPages, currentDocumentPage + 2))
                    .map((page) => (
                      <button
                        key={page}
                        onClick={() => setDocumentPage(page)}
                        className={`h-9 min-w-9 rounded-md border px-3 text-sm font-medium ${
                          page === currentDocumentPage ? "border-[#0d1b2e] bg-[#0d1b2e] text-white" : "border-[#0d1b2e]/10 bg-white text-[#0d1b2e] hover:border-[#dc2626]/35"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  <button
                    disabled={currentDocumentPage >= totalDocumentPages}
                    onClick={() => setDocumentPage((page) => Math.min(totalDocumentPages, page + 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#0d1b2e]/10 text-[#0d1b2e] disabled:opacity-35"
                    aria-label="หน้าถัดไป"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </section>
            {adminError && <div className="rounded-md bg-red-50 p-3 text-sm leading-6 text-red-700">{adminError}</div>}
          </section>
        )}

        {adminEmail && showDocumentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1b2e]/45 p-4 backdrop-blur-sm">
            <section className="max-h-[92vh] w-full max-w-[760px] overflow-hidden rounded-lg border border-white/70 bg-white shadow-[0_24px_80px_rgba(13,27,46,0.24)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#0d1b2e]/10 px-5 py-4">
                <div>
                  <h2 className="font-semibold">{editing ? "แก้ไขข้อมูล" : "เพิ่มข้อมูลใหม่"}</h2>
                  <p className="text-sm text-[#42526a]">เลือกฝ่ายและตั้งวันหมดอายุได้ ถ้าเว้นว่างจะเป็นข้อมูลถาวร</p>
                </div>
                <button
                  onClick={() => {
                    setShowDocumentModal(false);
                    setEditing(null);
                  }}
                  className="rounded-md border border-[#0d1b2e]/10 p-2 text-[#42526a] hover:bg-[#eef3f8]"
                  aria-label="ปิด"
                >
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={editing ? submitEdit : submitCreate} className="max-h-[calc(92vh-80px)] space-y-3 overflow-y-auto p-5">
                <label className="block text-xs font-medium text-[#42526a]">
                  ฝ่าย / ฐานข้อมูล
                  <select name="category" defaultValue={editing?.category ?? activeCategory} className="mt-1 w-full rounded-md border border-[#0d1b2e]/15 px-3 py-2.5 text-sm outline-none focus:border-[#dc2626]">
                    {documentCategories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <input name="title" defaultValue={editing?.title ?? ""} placeholder="ชื่อข้อมูล" className="w-full rounded-md border border-[#0d1b2e]/15 px-3 py-2.5 text-sm outline-none focus:border-[#dc2626]" />
                <textarea name="text" defaultValue={editing?.text ?? ""} rows={8} placeholder="ใส่ข้อความที่ต้องการเพิ่มเข้าฐานข้อมูล" className="w-full resize-none rounded-md border border-[#0d1b2e]/15 px-3 py-2.5 text-sm leading-6 outline-none focus:border-[#dc2626]" />
                {!editing && <input name="file" type="file" accept=".pdf,.doc,.docx,image/*" className="w-full rounded-md border border-dashed border-[#0d1b2e]/15 px-3 py-3 text-sm" />}
                <label className="block text-xs font-medium text-[#42526a]">
                  Auto delete time เว้นว่าง = ถาวร
                  <input name="expiresAt" type="datetime-local" defaultValue={editing?.expiresAt ?? ""} className="mt-1 w-full rounded-md border border-[#0d1b2e]/15 px-3 py-2.5 text-sm outline-none focus:border-[#dc2626]" />
                </label>
                <textarea name="notes" defaultValue={editing?.notes ?? ""} rows={3} placeholder="บันทึกเพิ่มเติม" className="w-full resize-none rounded-md border border-[#0d1b2e]/15 px-3 py-2.5 text-sm leading-6 outline-none focus:border-[#dc2626]" />
                <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#dc2626] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b91c1c] disabled:opacity-50">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : editing ? <Save size={16} /> : <Upload size={16} />} {editing ? "Save edit" : "Save"}
                </button>
                {adminError && <div className="rounded-md bg-red-50 p-3 text-sm leading-6 text-red-700">{adminError}</div>}
              </form>
            </section>
          </div>
        )}
        {adminEmail && showAiUsage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1b2e]/45 p-4 backdrop-blur-sm">
            <section className="max-h-[92vh] w-full max-w-[860px] overflow-hidden rounded-lg border border-white/70 bg-white shadow-[0_24px_80px_rgba(13,27,46,0.24)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#0d1b2e]/10 px-5 py-4">
                <div>
                  <h2 className="font-semibold">ลำดับ AI และจำนวนครั้งที่ถูกใช้</h2>
                  <p className="text-sm text-[#42526a]">ค่าเริ่มต้นเป็น By day และ counter จะเพิ่มเมื่อระบบเรียกโมเดลสำรองจริง</p>
                </div>
                <button onClick={() => setShowAiUsage(false)} className="rounded-md border border-[#0d1b2e]/10 p-2 text-[#42526a] hover:bg-[#eef3f8]" aria-label="ปิด">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "day", label: "By day" },
                    { value: "month", label: "By month" },
                    { value: "year", label: "By year" },
                    { value: "all", label: "All the time" },
                  ].map((period) => (
                    <button
                      key={period.value}
                      onClick={() => loadAiUsage(period.value as AiUsagePeriod)}
                      className={`rounded-md px-3 py-2 text-sm font-semibold ${
                        aiUsagePeriod === period.value ? "bg-[#0d1b2e] text-white" : "border border-[#0d1b2e]/10 bg-white text-[#0d1b2e] hover:bg-[#eef3f8]"
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                  <button onClick={() => loadAiUsage()} className="rounded-md border border-[#0d1b2e]/10 bg-white px-3 py-2 text-sm font-semibold text-[#42526a] hover:bg-[#eef3f8]">
                    Refresh
                  </button>
                </div>
                <div className="max-h-[60vh] overflow-auto rounded-lg border border-[#0d1b2e]/10">
                  <table className="w-full min-w-[680px] border-collapse text-sm">
                    <thead className="sticky top-0 bg-white text-left text-xs uppercase text-[#42526a]">
                      <tr>
                        <th className="border-b border-[#0d1b2e]/10 px-4 py-3">ลำดับ</th>
                        <th className="border-b border-[#0d1b2e]/10 px-4 py-3">Provider</th>
                        <th className="border-b border-[#0d1b2e]/10 px-4 py-3">Model</th>
                        <th className="border-b border-[#0d1b2e]/10 px-4 py-3">ใช้แล้ว</th>
                        <th className="border-b border-[#0d1b2e]/10 px-4 py-3 text-right">Counter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingAiUsage ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-[#42526a]">กำลังโหลด</td></tr>
                      ) : (
                        aiUsageRows.map((row) => (
                          <tr key={row.id} className="border-b border-[#eef1ec] last:border-b-0">
                            <td className="px-4 py-3 font-semibold text-[#0d1b2e]">{row.order}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                row.provider === "gemini" ? "bg-emerald-50 text-emerald-700" : row.provider === "groq" ? "bg-red-50 text-red-700" : "bg-purple-50 text-purple-700"
                              }`}>
                                {row.provider}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[#42526a]">{row.model}</td>
                            <td className="px-4 py-3 text-[#42526a]">{row.used ? "ใช้แล้ว" : "-"}</td>
                            <td className="px-4 py-3 text-right font-semibold text-[#0d1b2e]">{row.count}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        )}
        {showLogin && !adminEmail && (
          <section className="mb-4 rounded-lg border border-[#0d1b2e]/10 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
            <form onSubmit={submitLogin} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input name="email" type="email" placeholder="Email เจ้าหน้าที่" autoComplete="off" className="rounded-md border border-[#0d1b2e]/15 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[#dc2626]" />
              <input name="password" type="password" placeholder="Password" className="rounded-md border border-[#0d1b2e]/15 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[#dc2626]" />
              <button className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0d1b2e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#162b48]">
                <LogIn size={16} /> Login
              </button>
            </form>
            {adminError && <div className="mt-3 rounded-md bg-red-50 p-3 text-sm leading-6 text-red-700">{adminError}</div>}
          </section>
        )}

        {showNineQ && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1b2e]/45 p-4 backdrop-blur-sm">
            <section className="max-h-[92vh] w-full max-w-[720px] overflow-hidden rounded-lg border border-white/70 bg-white/92 shadow-[0_24px_80px_rgba(13,27,46,0.24)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4 border-b border-[#0d1b2e]/10 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#0d1b2e]">แบบประเมินโรคซึมเศร้า 9Q</h2>
                  <p className="mt-1 text-sm leading-6 text-[#42526a]">
                    ใช้เพื่อคัดกรองและติดตามความรุนแรงของอาการ ไม่สามารถแทนการประเมินและวินิจฉัยทางคลินิกได้ กรุณาเลือกตอบจากความรู้สึกในช่วงสองสัปดาห์ที่ผ่านมา
                  </p>
                </div>
                <button onClick={() => setShowNineQ(false)} className="rounded-md border border-[#0d1b2e]/10 p-2 text-[#42526a] hover:bg-[#eef3f8]" aria-label="ปิดแบบประเมิน">
                  <X size={16} />
                </button>
              </div>

              <div className="overflow-y-auto px-5 py-5">
                <div className="mb-4 flex items-center justify-between text-sm text-[#42526a]">
                  <span>คำถามที่ {nineQStep + 1} จาก {nineQQuestions.length}</span>
                  <span>ตอบแล้ว {nineQAnswers.filter((answer) => answer >= 0).length}/{nineQQuestions.length}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#eef3f8]">
                  <div className="h-full rounded-full bg-[#0d1b2e]" style={{ width: `${((nineQStep + 1) / nineQQuestions.length) * 100}%` }} />
                </div>

                <h3 className="mt-6 text-xl font-semibold leading-8 text-[#0d1b2e]">{nineQQuestions[nineQStep]}</h3>
                <div className="mt-5 grid gap-3">
                  {nineQOptions.map((option) => (
                    <button
                      key={option.score}
                      onClick={() => setNineQAnswer(option.score)}
                      className={`rounded-lg border px-4 py-3 text-left text-sm leading-6 transition ${
                        nineQAnswers[nineQStep] === option.score
                          ? "border-[#0d1b2e] bg-[#0d1b2e] text-white"
                          : "border-[#0d1b2e]/12 bg-white/75 text-[#0d1b2e] hover:border-[#dc2626]/40 hover:bg-white"
                      }`}
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className="ml-2 text-xs opacity-75">{option.score} คะแนน</span>
                    </button>
                  ))}
                </div>

                {nineQStep === 8 && nineQAnswers[8] > 0 && (
                  <div className="mt-4 rounded-lg border border-[#dc2626]/20 bg-red-50 px-4 py-3 text-sm leading-6 text-[#7f1d1d]">
                    ถ้าข้อนี้มีคำตอบมากกว่า “ไม่มีเลย” และตอนนี้รู้สึกไม่ปลอดภัย กรุณาติดต่อคนใกล้ตัวทันที หรือโทร 1323 สายด่วนสุขภาพจิต / 1669 ฉุกเฉิน
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#0d1b2e]/10 px-5 py-4">
                <button
                  onClick={() => setNineQStep((step) => Math.max(0, step - 1))}
                  disabled={nineQStep === 0}
                  className="rounded-md border border-[#0d1b2e]/15 bg-white/80 px-4 py-2 text-sm font-medium text-[#0d1b2e] disabled:opacity-40"
                >
                  ย้อนกลับ
                </button>
                {nineQStep < nineQQuestions.length - 1 ? (
                  <button
                    onClick={() => setNineQStep((step) => Math.min(nineQQuestions.length - 1, step + 1))}
                    disabled={nineQAnswers[nineQStep] < 0}
                    className="rounded-md bg-[#0d1b2e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    ไปคำถามถัดไป
                  </button>
                ) : (
                  <button
                    onClick={submitNineQ}
                    disabled={nineQAnswers.some((answer) => answer < 0)}
                    className="rounded-md bg-[#dc2626] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    ส่งคำตอบและให้พี่เทคแนะนำ
                  </button>
                )}
              </div>
            </section>
          </div>
        )}

        {showNineQContact && pendingNineQ && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1b2e]/45 p-4 backdrop-blur-sm">
            <section className="w-full max-w-[560px] rounded-lg border border-white/70 bg-white/95 p-5 shadow-[0_24px_80px_rgba(13,27,46,0.24)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#0d1b2e]">ฝากข้อมูลติดต่อไว้ให้เจ้าหน้าที่ไหมคะ</h2>
                  <p className="mt-1 text-sm leading-6 text-[#42526a]">
                    ผล 9Q ของน้องอยู่ในช่วงที่ควรมีคนช่วยดูแลต่อ ข้อมูลตรงนี้ไม่บังคับ จะกรอกเท่าที่สะดวกก็ได้ค่ะ
                  </p>
                </div>
                <button onClick={() => setShowNineQContact(false)} className="rounded-md border border-[#0d1b2e]/10 p-2 text-[#42526a] hover:bg-[#eef3f8]" aria-label="ปิด">
                  <X size={16} />
                </button>
              </div>
              <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm leading-6 text-[#7f1d1d]">
                คะแนนรวม {pendingNineQ.total_score} คะแนน ({pendingNineQ.severity_label}) ข้อ 9 ได้ {pendingNineQ.q9_score} คะแนน
              </div>
              <form onSubmit={submitNineQContact} className="mt-4 grid gap-3">
                <input name="name" placeholder="ชื่อ-นามสกุล (ถ้าสะดวก)" className="rounded-md border border-[#0d1b2e]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#dc2626]" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input name="year" placeholder="ชั้นปี เช่น ปี 1" className="rounded-md border border-[#0d1b2e]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#dc2626]" />
                  <input name="group" placeholder="กลุ่ม/ห้อง (ถ้าสะดวก)" className="rounded-md border border-[#0d1b2e]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#dc2626]" />
                </div>
                <input name="phone" placeholder="เบอร์โทร/ช่องทางติดต่อ (ถ้าอยากให้ติดต่อกลับ)" className="rounded-md border border-[#0d1b2e]/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#dc2626]" />
                <label className="flex items-start gap-2 rounded-md border border-[#0d1b2e]/10 bg-[#f8fafc] px-3 py-2.5 text-sm leading-6 text-[#42526a]">
                  <input name="consentContact" type="checkbox" className="mt-1" />
                  ยินยอมให้เจ้าหน้าที่ติดต่อกลับตามข้อมูลที่ฝากไว้
                </label>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowNineQContact(false)} className="rounded-md border border-[#0d1b2e]/15 bg-white px-4 py-2 text-sm font-medium text-[#0d1b2e]">
                    ข้ามก่อน
                  </button>
                  <button disabled={savingNineQContact} className="inline-flex items-center gap-2 rounded-md bg-[#dc2626] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {savingNineQContact && <Loader2 className="animate-spin" size={16} />} บันทึกข้อมูลสมัครใจ
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        <footer className="flex flex-col items-center gap-3 border-t border-[#0d1b2e]/10 py-4 text-center text-sm text-[#42526a]">
          {adminEmail ? (
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-md border border-[#0d1b2e]/15 bg-white/75 px-3 py-2 text-sm text-[#0d1b2e] shadow-sm backdrop-blur hover:bg-white">
              <LogOut size={16} /> ออกจากระบบเจ้าหน้าที่
            </button>
          ) : (
            <button onClick={() => setShowLogin((value) => !value)} className="inline-flex items-center gap-2 rounded-md border border-[#0d1b2e]/15 bg-white/75 px-3 py-2 text-sm text-[#0d1b2e] shadow-sm backdrop-blur hover:bg-white">
              <LogIn size={16} /> Login เจ้าหน้าที่
            </button>
          )}
          <div>Developed by Phubet Chitapanya</div>
        </footer>
      </div>
    </main>
  );
}


