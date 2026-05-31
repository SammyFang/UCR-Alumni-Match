import type { Timestamp } from "firebase/firestore";

export const trackLabels = {
  mockInterview: "Mock Interview",
  resumeReview: "Resume Review",
  careerChat: "Career Chat",
  industryConversation: "Industry Conversation",
} as const;

export function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinList(value?: string[]) {
  return value?.join(", ") || "";
}

export function isHttpsUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isLinkedInUrl(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)linkedin\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export function formatDateTime(value?: Timestamp | Date | null) {
  if (!value) return "Not set";
  const date = value instanceof Date ? value : value.toDate();
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function toLocalInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromLocalInputValue(value: string) {
  return new Date(value);
}

export function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 90);
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
