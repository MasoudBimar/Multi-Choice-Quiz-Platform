export type QuizQuestionType = 'single' | 'multi';

export type QuizControlType = 'textbox' | 'unknown';

export interface QuestionChoice {
  id: string;
  text: string;
}

export interface QuizCatalogEntry {
  id: string;
  title: string;
  description: string;
  jsonPath: string;
  timeLimitSeconds?: number;
  shuffleQuestions?: boolean;
  shuffleAnswers?: boolean;
  quizzBackgroundColor?: string;

}

export interface QuizCatalog {
  quizzes: QuizCatalogEntry[];
}

export interface QuizChoice {
  id: string;
  text: string;
}

export class QuizQuestion {
  id: string;
  key: string;
  label: string;
  title: string;
  required?: boolean;
  order?: number;
  type: QuizQuestionType;
  controlType: QuizControlType;
  choices: QuestionChoice[];
  correctChoiceIds: string | string[];
  explanation?: string;
  prompt: string;
  constructor(
    options: {
      key?: string;
      label?: string;
      required?: boolean;
      order?: number;
      type?: QuizQuestionType;
      controlType?: QuizControlType;
      choices?: QuestionChoice[];
      correctChoiceIds?: string | string[];
      explanation?: string;
      prompt?: string;
    } = {},
  ) {
    this.id = crypto.randomUUID();
    this.key = options.key || '';
    this.label = this.title = options.label || '';
    this.required = !!options.required;
    this.order = options.order === undefined ? 1 : options.order;
    this.type = options.type || 'single';
    this.controlType = options.controlType || 'textbox';
    this.choices = options.choices || [];
    this.correctChoiceIds = options.correctChoiceIds || [];
    this.explanation = options.explanation;
    this.prompt = options.prompt || 'what does it mean?';
  }
}

export interface QuizDefinition {
  id: string;
  title: string;
  version: number;
  questions: QuizQuestion[];
}

export interface QuizAttemptOrder {
  questionIds: string[];
  choiceOrderByQuestionId: Record<string, string[]>;
}

export interface QuizAttemptAnswer {
  selectedChoiceIds: string[];
  answeredAt: number;
}

export type QuizAttemptStatus = 'idle' | 'inProgress' | 'finished';

export interface QuizAttemptPersisted {
  quizId: string;
  quizVersion: number;
  attemptId: string;
  startedAt: number;
  finishedAt?: number;
  seed: string;
  currentIndex: number;
  order: QuizAttemptOrder;
  answers: Record<string, QuizAttemptAnswer>;
  status: Exclude<QuizAttemptStatus, 'idle'>;
}

export interface QuizHistoryEntry {
  attemptId: string;
  quizId: string;
  quizVersion: number;
  quizTitle: string;
  startedAt: number;
  finishedAt: number;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  scorePercent: number;
  durationSeconds: number;
  seed: string;
}

export interface QuizAggregatedStats {
  quizId: string;
  attemptCount: number;
  bestScore: number;
  lastScore: number;
  avgScore: number;
  updatedAt: number;
}

export interface QuizQuestionResultRow {
  questionId: string;
  prompt: string;
  selectedChoiceIds: string[];
  correctChoiceIds: string[];
  isCorrect: boolean;
  explanation?: string;
  presentedChoiceIds: string[];
}

export interface QuizResultsModel {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  startedAt: number;
  finishedAt?: number;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  scorePercent: number;
  durationSeconds: number;
  questions: QuizQuestionResultRow[];
}

export interface QuizCompatibilityResult {
  compatible: boolean;
  reason?: string;
}

export interface StartAttemptOptions {
  seed?: string;
  shuffleQuestions?: boolean;
  shuffleAnswers?: boolean;
}

export type ThemeMode = 'light' | 'dark';

export interface UiPrefs {
  theme: ThemeMode;
}
