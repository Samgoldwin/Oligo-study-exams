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