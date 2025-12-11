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
}

export interface TopicModule {
  topicName: string;
  priority: 'High' | 'Medium' | 'Low';
  description: string;
  questions: Question[];
}

export interface StudyPlan {
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