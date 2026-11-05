import { theme } from "../theme";

/**
 * SyncAI backend client.
 *
 * Set EXPO_PUBLIC_API_URL to the deployed backend, e.g.
 *   EXPO_PUBLIC_API_URL=https://your-app.vercel.app
 * Defaults to the local dev API (works on the same machine / emulator with
 * 10.0.2.2 for Android emulator).
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

export interface ChatMessageLite {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  answer: string;
  conversation_id: string;
  sources: Array<{ label: string; title: string; type: string; page?: number }>;
  related_resources: Array<{ id: string; title: string; type: string; subjectCode: string }>;
  pyq_resources: Array<{ id: string; title: string; type: string; subjectCode: string }>;
  videos: Array<{ videoId: string; title: string; channel: string; url: string; duration: string | null }>;
  video_error: string | null;
  grounded: string | null;
}

export interface AnalyzeResponse {
  subject?: string;
  summary?: string;
  estimatedHours?: number;
  priorityOrder?: string[];
  focusAreas?: string[];
  modules?: Array<{
    topicName: string;
    priority: string;
    description: string;
    questions: Array<{ text: string; marks?: number; difficulty?: string; yearAppeared?: string | null; reference?: string }>;
  }>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as T & { message?: string };
  if (!res.ok) {
    throw new Error(payload.message || `Request failed (HTTP ${res.status})`);
  }
  return payload;
}

export const api = {
  chat: (message: string, history: ChatMessageLite[]) =>
    post<ChatResponse>("/api/syncai/chat", {
      message,
      history: history.slice(-10),
      context: { branch: "", semester: null, scheme: "", subject: "", subjectCode: "" },
    }),

  analyze: (syllabus: string, papers: Array<{ name: string; text: string }>) =>
    post<AnalyzeResponse>("/api/analyze", { syllabus, files: papers }),
};
