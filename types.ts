export interface FileUpload {
  file: File;
  id: string;
  previewUrl?: string;
}

export interface Question {
  text: string;
  marks?: number;
  yearAppeared?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  reference?: string;
}

export interface TopicModule {
  topicName: string;
  priority: 'High' | 'Medium' | 'Low';
  description: string;
  questions: Question[];
}

export interface StudyPlan {
  subject: string;
  summary: string;
  extractedQuestions: Question[];
  modules: TopicModule[];
  /** Optional fields emitted by the analyzer model. */
  keyTopics?: string[];
  questionsByTopic?: Record<string, Question[]>;
  studySchedule?: Array<string | Record<string, unknown>>;
  focusAreas?: string[];
  estimatedHours?: number;
  /** Ordered topics to tackle first, most-likely-tested first. */
  priorityOrder?: string[];
}

export enum AppState {
  IDLE,
  ANALYZING,
  SUCCESS,
  ERROR
}

/**
 * Interface to allow swapping AI providers (Gemini, OpenAI, etc.)
 * without changing the UI code.
 */
export interface AIProvider {
  name: string;
  generateStudyPlan(syllabus: string, files: File[]): Promise<StudyPlan>;
}

/* ============================================================
 * SyncAI — shared types (client + serverless functions)
 * ========================================================== */

export type ResourceType =
  | 'notes'
  | 'pyq'
  | 'question_bank'
  | 'syllabus'
  | 'scheme_of_evaluation'
  | 'pdf';

export interface ResourceItem {
  id: string;
  title: string;
  type: ResourceType;
  subject: string;
  subjectCode: string;
  branch: string;
  semester: number;
  scheme: string;
  module?: string;
  tags: string[];
  /** Let the resource layer mark internal datasets; live pages omit it. */
  fileUrl: string | null;
  stub?: boolean;
  source: 'VTUSync';
}

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string | null;
  durationSeconds: number | null;
  url: string;
  publishedAt: string;
}

export interface AcademicContext {
  branch: string;
  semester: number | null;
  scheme: string;
  subject: string;
  subjectCode: string;
}

export type AnswerMarks = 2 | 5 | 10 | 15;

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DocumentContext {
  filename: string;
  /** Text per page, index 0 = page 1. */
  pages: string[];
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  history?: ChatHistoryMessage[];
  context?: AcademicContext;
  marks?: AnswerMarks | null;
  document?: DocumentContext | null;
  /** Chat model chosen in the composer picker; absent = server default. */
  model?: string;
  /** User's saved BYO model id (Firebase uid-scoped). */
  custom_model_id?: string;
}

export interface ChatSource {
  label: string;
  title: string;
  type: 'vtunsync_resource' | 'document' | 'youtube';
  page?: number;
}

export type Grounding = 'vtunsync' | 'document' | 'general';

export interface ChatResponse {
  answer: string;
  conversation_id: string;
  sources: ChatSource[];
  related_resources: ResourceItem[];
  pyq_resources: ResourceItem[];
  videos: YouTubeVideo[];
  video_error: string | null;
  grounded: Grounding | null;
  ai_generated: true;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  marks?: AnswerMarks | null;
  relatedResources?: ResourceItem[];
  pyqResources?: ResourceItem[];
  videos?: YouTubeVideo[];
  videoError?: string | null;
  sources?: ChatSource[];
  grounded?: Grounding | null;
  error?: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  context: AcademicContext;
  messages: ChatMessage[];
  /** Uploaded PDF kept with the conversation (session-limited; may be dropped if storage is full). */
  document?: DocumentContext | null;
}

export interface ConversationStoreShape {
  conversations: Conversation[];
}

/** Academic metadata detected from syllabus text. */
export interface SyllabusDetection {
  subject: string | null;
  subjectCode: string | null;
  semester: number | null;
  branch: string | null;
  scheme: string | null;
}