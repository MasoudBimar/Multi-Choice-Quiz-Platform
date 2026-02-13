import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { QuizAttemptStore } from './quiz-attempt.store';
import { QuizPersistenceService } from '../../core/services/quiz-persistence.service';
import {
  QuizAggregatedStats,
  QuizAttemptPersisted,
  QuizCatalogEntry,
  QuizDefinition,
  QuizHistoryEntry,
} from '../../data/models/quiz.models';

class MockQuizPersistenceService {
  readonly attempts = new Map<string, QuizAttemptPersisted>();
  readonly archives = new Map<string, QuizAttemptPersisted>();
  history: QuizHistoryEntry[] = [];
  readonly stats = new Map<string, QuizAggregatedStats>();

  readAttempt(quizId: string): QuizAttemptPersisted | null {
    return this.attempts.get(quizId) ?? null;
  }

  writeAttempt(attempt: QuizAttemptPersisted): boolean {
    this.attempts.set(attempt.quizId, { ...attempt, answers: { ...attempt.answers } });
    return true;
  }

  clearAttempt(quizId: string): void {
    this.attempts.delete(quizId);
  }

  writeAttemptArchive(attempt: QuizAttemptPersisted): boolean {
    this.archives.set(attempt.attemptId, { ...attempt, answers: { ...attempt.answers } });
    return true;
  }

  readAttemptArchive(attemptId: string): QuizAttemptPersisted | null {
    return this.archives.get(attemptId) ?? null;
  }

  readHistory(): QuizHistoryEntry[] {
    return [...this.history];
  }

  readHistoryForQuiz(quizId: string): QuizHistoryEntry[] {
    return this.history.filter((entry) => entry.quizId === quizId);
  }

  appendHistory(entry: QuizHistoryEntry): boolean {
    this.history = [entry, ...this.history];
    return true;
  }

  readStats(quizId: string): QuizAggregatedStats | null {
    return this.stats.get(quizId) ?? null;
  }

  updateStatsFromHistoryEntry(entry: QuizHistoryEntry): QuizAggregatedStats {
    const current = this.readStats(entry.quizId);
    const attemptCount = (current?.attemptCount ?? 0) + 1;
    const avgScore =
      Math.round((((current?.avgScore ?? 0) * (attemptCount - 1) + entry.scorePercent) / attemptCount) * 100) /
      100;

    const next: QuizAggregatedStats = {
      quizId: entry.quizId,
      attemptCount,
      bestScore: Math.max(current?.bestScore ?? 0, entry.scorePercent),
      lastScore: entry.scorePercent,
      avgScore,
      updatedAt: Date.now(),
    };

    this.stats.set(entry.quizId, next);
    return next;
  }
}

const entry: QuizCatalogEntry = {
  id: 'signals-quiz',
  title: 'Signals Quiz',
  description: 'Signals basics',
  jsonPath: '/assets/quizzes/signals.json',
  shuffleQuestions: true,
  shuffleAnswers: true,
};

const definition: QuizDefinition = {
  id: 'signals-quiz',
  title: 'Signals Quiz',
  version: 1,
  questions: [
    {
      id: 'q1',
      type: 'single',
      prompt: 'Question 1',
      choices: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      correctChoiceIds: ['b'],
    },
    {
      id: 'q2',
      type: 'single',
      prompt: 'Question 2',
      choices: [
        { id: 'c', text: 'C' },
        { id: 'd', text: 'D' },
      ],
      correctChoiceIds: ['d'],
    },
  ],
};

describe('QuizAttemptStore', () => {
  let store: InstanceType<typeof QuizAttemptStore>;
  let persistence: MockQuizPersistenceService;

  beforeEach(() => {
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [
        QuizAttemptStore,
        {
          provide: QuizPersistenceService,
          useClass: MockQuizPersistenceService,
        },
      ],
    });

    store = TestBed.inject(QuizAttemptStore);
    persistence = TestBed.inject(QuizPersistenceService) as unknown as MockQuizPersistenceService;

    store.setQuizContext(entry, definition);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('scores answers correctly and updates history/stats on finish', () => {
    store.startAttempt(definition, { seed: 'fixed', shuffleQuestions: false, shuffleAnswers: false });

    store.answerCurrent('b');
    store.goNext();
    store.answerCurrent('c');
    store.finishAttempt();

    expect(store.status()).toBe('finished');
    expect(store.scoreRaw()).toBe(1);
    expect(store.scorePercent()).toBe(50);
    expect(store.history().length).toBe(1);
    expect(store.stats()?.attemptCount).toBe(1);
    expect(store.stats()?.lastScore).toBe(50);
  });

  it('persists minimal attempt snapshot shape', () => {
    store.startAttempt(definition, { seed: 'fixed', shuffleQuestions: false, shuffleAnswers: false });
    store.answerCurrent('b');
    store.persistAttemptSnapshot();

    const saved = persistence.readAttempt('signals-quiz');

    expect(saved).toBeTruthy();
    expect(saved?.quizId).toBe('signals-quiz');
    expect(saved?.order.questionIds).toEqual(['q1', 'q2']);
    expect(saved?.answers['q1']?.selectedChoiceIds).toEqual(['b']);
    expect((saved as unknown as { quizDefinition?: unknown }).quizDefinition).toBeUndefined();
  });

  it('rejects resume when quiz version changed', () => {
    persistence.writeAttempt({
      quizId: 'signals-quiz',
      quizVersion: 1,
      attemptId: 'attempt-1',
      startedAt: Date.now(),
      seed: 'seed-x',
      currentIndex: 0,
      order: {
        questionIds: ['q1', 'q2'],
        choiceOrderByQuestionId: {
          q1: ['a', 'b'],
          q2: ['c', 'd'],
        },
      },
      answers: {},
      status: 'inProgress',
    });

    store.setQuizContext(entry, { ...definition, version: 2 });

    expect(store.resumeAttempt('signals-quiz')).toBe(false);
    expect(store.error()).toContain('version');
  });

  it('rejects resume when saved questions do not match current quiz', () => {
    persistence.writeAttempt({
      quizId: 'signals-quiz',
      quizVersion: 1,
      attemptId: 'attempt-2',
      startedAt: Date.now(),
      seed: 'seed-y',
      currentIndex: 0,
      order: {
        questionIds: ['q1', 'removed-question'],
        choiceOrderByQuestionId: {
          q1: ['a', 'b'],
          q2: ['c', 'd'],
        },
      },
      answers: {},
      status: 'inProgress',
    });

    expect(store.resumeAttempt('signals-quiz')).toBe(false);
    expect(store.error()).toContain('removed question');
  });
});
