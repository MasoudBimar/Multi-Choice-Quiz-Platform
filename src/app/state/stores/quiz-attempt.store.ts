import { DestroyRef, computed, effect, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { QuizPersistenceService } from '../../core/services/quiz-persistence.service';
import { checkAttemptCompatibility } from '../../core/utils/quiz-compatibility.util';
import { createAttemptId, createAttemptSeed, createSeededRandom } from '../../core/utils/random.util';
import { shuffle } from '../../core/utils/shuffle.util';
import {
  QuizAggregatedStats,
  QuizAttemptAnswer,
  QuizAttemptOrder,
  QuizAttemptPersisted,
  QuizAttemptStatus,
  QuizCatalogEntry,
  QuizDefinition,
  QuizHistoryEntry,
  QuizQuestion,
  QuizResultsModel,
  StartAttemptOptions,
} from '../../data/models/quiz.models';

interface QuizAttemptState {
  quizId: string | null;
  quizTitle: string;
  quizVersion: number | null;
  quizDefinition: QuizDefinition | null;
  shuffleQuestionsDefault: boolean;
  shuffleAnswersDefault: boolean;
  timeLimitSeconds: number | null;
  quizzBackgroundColor: string | null;
  status: QuizAttemptStatus;
  attemptId: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  seed: string | null;
  currentIndex: number;
  order: QuizAttemptOrder;
  answers: Record<string, QuizAttemptAnswer>;
  error: string | null;
  isHydrating: boolean;
  hasPersistedAttempt: boolean;
  history: QuizHistoryEntry[];
  stats: QuizAggregatedStats | null;
}

const EMPTY_ORDER: QuizAttemptOrder = {
  questionIds: [],
  choiceOrderByQuestionId: {},
};

const initialState: QuizAttemptState = {
  quizId: null,
  quizTitle: '',
  quizVersion: null,
  quizDefinition: null,
  shuffleQuestionsDefault: true,
  shuffleAnswersDefault: true,
  timeLimitSeconds: null,
  quizzBackgroundColor: null,
  status: 'idle',
  attemptId: null,
  startedAt: null,
  finishedAt: null,
  seed: null,
  currentIndex: 0,
  order: EMPTY_ORDER,
  answers: {},
  error: null,
  isHydrating: false,
  hasPersistedAttempt: false,
  history: [],
  stats: null,
};

function normalizeIds(...ids: string[]): string[] {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

function buildQuestionLookup(definition: QuizDefinition | null): Record<string, QuizQuestion> {
  if (!definition) {
    return {};
  }

  return definition.questions.reduce<Record<string, QuizQuestion>>((accumulator, question) => {
    accumulator[question.id] = question;
    return accumulator;
  }, {});
}

function buildOrder(
  definition: QuizDefinition,
  seed: string,
  shuffleQuestionsEnabled: boolean,
  shuffleAnswersEnabled: boolean,
): QuizAttemptOrder {
  const random = createSeededRandom(seed);

  const questionIds = shuffleQuestionsEnabled
    ? shuffle(definition.questions.map((question) => question.id), random)
    : definition.questions.map((question) => question.id);

  const choiceOrderByQuestionId = definition.questions.reduce<Record<string, string[]>>(
    (accumulator, question) => {
      const choiceIds = question.choices.map((choice) => choice.id);
      accumulator[question.id] = shuffleAnswersEnabled ? shuffle(choiceIds, random) : choiceIds;
      return accumulator;
    },
    {},
  );

  return {
    questionIds,
    choiceOrderByQuestionId,
  };
}

function buildPersistedSnapshotFromSignals(store: {
  quizId: () => string | null;
  quizVersion: () => number | null;
  attemptId: () => string | null;
  startedAt: () => number | null;
  finishedAt: () => number | null;
  seed: () => string | null;
  currentIndex: () => number;
  order: () => QuizAttemptOrder;
  answers: () => Record<string, QuizAttemptAnswer>;
  status: () => QuizAttemptStatus;
}): QuizAttemptPersisted | null {
  const quizId = store.quizId();
  const quizVersion = store.quizVersion();
  const attemptId = store.attemptId();
  const startedAt = store.startedAt();
  const seed = store.seed();
  const status = store.status();

  if (!quizId || !quizVersion || !attemptId || !startedAt || !seed || status === 'idle') {
    return null;
  }

  return {
    quizId,
    quizVersion,
    attemptId,
    startedAt,
    finishedAt: store.finishedAt() ?? undefined,
    seed,
    currentIndex: store.currentIndex(),
    order: store.order(),
    answers: store.answers(),
    status: status === 'finished' ? 'finished' : 'inProgress',
  };
}

function scoreAttempt(definition: QuizDefinition, attempt: QuizAttemptPersisted): number {
  return definition.questions.reduce((score, question) => {
    const selected = attempt.answers[question.id]?.selectedChoiceIds ?? [];
    const correctChoiceIds = Array.isArray(question.correctChoiceIds) ? question.correctChoiceIds : [question.correctChoiceIds];
    const isCorrect =
      normalizeIds(...selected).join('|') === normalizeIds(...correctChoiceIds).join('|');
    return isCorrect ? score + 1 : score;
  }, 0);
}

function buildHistoryEntry(definition: QuizDefinition, attempt: QuizAttemptPersisted): QuizHistoryEntry {
  const correctCount = scoreAttempt(definition, attempt);
  const totalQuestions = definition.questions.length;
  const incorrectCount = totalQuestions - correctCount;
  const scorePercent = totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 10000) / 100;
  const finishedAt = attempt.finishedAt ?? Date.now();

  return {
    attemptId: attempt.attemptId,
    quizId: attempt.quizId,
    quizVersion: attempt.quizVersion,
    quizTitle: definition.title,
    startedAt: attempt.startedAt,
    finishedAt,
    totalQuestions,
    correctCount,
    incorrectCount,
    scorePercent,
    durationSeconds: Math.max(0, Math.round((finishedAt - attempt.startedAt) / 1000)),
    seed: attempt.seed,
  };
}

export const QuizAttemptStore = signalStore(
  withState(initialState),
  withComputed((store) => {
    const questionLookup = computed(() => buildQuestionLookup(store.quizDefinition()));

    const currentQuestion = computed(() => {
      const questionId = store.order().questionIds[store.currentIndex()];
      if (!questionId) {
        return null;
      }
      return questionLookup()[questionId] ?? null;
    });

    const totalQuestions = computed(() => store.order().questionIds.length);

    const answeredCount = computed(() => {
      const orderedIds = store.order().questionIds;
      return orderedIds.reduce((count, questionId) => (store.answers()[questionId] ? count + 1 : count), 0);
    });

    const correctQuestionIds = computed(() => {
      const definition = store.quizDefinition();
      if (!definition) {
        return [] as string[];
      }

      return definition.questions
        .filter((question) => {
          const selected = store.answers()[question.id]?.selectedChoiceIds ?? [];
          const correctChoiceIds = Array.isArray(question.correctChoiceIds) ? question.correctChoiceIds : [question.correctChoiceIds]
          return normalizeIds(...selected).join('|') === normalizeIds(...correctChoiceIds).join('|');
        })
        .map((question) => question.id);
    });

    const incorrectQuestionIds = computed(() => {
      const definition = store.quizDefinition();
      if (!definition) {
        return [] as string[];
      }

      return definition.questions
        .filter((question) => {
          const selected = store.answers()[question.id]?.selectedChoiceIds ?? [];
          const correctChoiceIds = Array.isArray(question.correctChoiceIds) ? question.correctChoiceIds : [question.correctChoiceIds];
          return normalizeIds(...selected).join('|') !== normalizeIds(...correctChoiceIds).join('|');
        })
        .map((question) => question.id);
    });

    const scoreRaw = computed(() => correctQuestionIds().length);

    return {
      totalQuestions,
      answeredCount,
      remainingCount: computed(() => Math.max(totalQuestions() - answeredCount(), 0)),
      progressPercent: computed(() =>
        totalQuestions() === 0 ? 0 : Math.round((answeredCount() / totalQuestions()) * 100),
      ),
      currentQuestion,
      isCurrentAnswered: computed(() => {
        const question = currentQuestion();
        if (!question) {
          return false;
        }
        return !!store.answers()[question.id];
      }),
      canGoNext: computed(() => store.currentIndex() < Math.max(totalQuestions() - 1, 0)),
      canGoPrev: computed(() => store.currentIndex() > 0),
      scoreRaw,
      scorePercent: computed(() =>
        totalQuestions() === 0 ? 0 : Math.round((scoreRaw() / totalQuestions()) * 10000) / 100,
      ),
      correctQuestionIds,
      incorrectQuestionIds,
      presentedChoices: computed(() => {
        const question = currentQuestion();
        if (!question) {
          return [] as QuizQuestion['choices'];
        }

        const order = store.order().choiceOrderByQuestionId[question.id] ?? [];
        const choiceMap = question.choices.reduce<Record<string, { id: string; text: string }>>(
          (accumulator, choice) => {
            accumulator[choice.id] = choice;
            return accumulator;
          },
          {},
        );

        return order
          .map((choiceId) => choiceMap[choiceId])
          .filter((choice): choice is { id: string; text: string } => !!choice);
      }),
      resultsModel: computed((): QuizResultsModel | null => {
        const definition = store.quizDefinition();
        const attemptId = store.attemptId();
        const quizId = store.quizId();
        const startedAt = store.startedAt();

        if (!definition || !attemptId || !quizId || !startedAt) {
          return null;
        }

        const correctCount = scoreRaw();
        const total = definition.questions.length;
        const finishedAt = store.finishedAt() ?? undefined;
        const incorrectCount = total - correctCount;

        return {
          attemptId,
          quizId,
          quizTitle: definition.title,
          startedAt,
          finishedAt,
          totalQuestions: total,
          correctCount,
          incorrectCount,
          scorePercent: total === 0 ? 0 : Math.round((correctCount / total) * 10000) / 100,
          durationSeconds: Math.max(0, Math.round(((finishedAt ?? Date.now()) - startedAt) / 1000)),
          questions: definition.questions.map((question) => {
            const selectedChoiceIds = store.answers()[question.id]?.selectedChoiceIds ?? [];
            const correctChoiceIds = Array.isArray(question.correctChoiceIds) ? question.correctChoiceIds : [question.correctChoiceIds];
            const isCorrect = normalizeIds(...selectedChoiceIds).join('|') === normalizeIds(...correctChoiceIds).join('|');

            return {
              questionId: question.id,
              prompt: question.prompt,
              selectedChoiceIds,
              correctChoiceIds: Array.isArray(question.correctChoiceIds) ? question.correctChoiceIds : [question.correctChoiceIds],
              isCorrect,
              explanation: question.explanation,
              presentedChoiceIds:
                store.order().choiceOrderByQuestionId[question.id] ?? question.choices.map((choice) => choice.id),
            };
          }),
        };
      }),
    };
  }),
  withMethods((store, persistence = inject(QuizPersistenceService)) => ({
    setQuizContext(entry: QuizCatalogEntry, definition: QuizDefinition): void {
      if (entry?.id) {
        const persistedAttempt = persistence.readAttempt(entry.id);
        patchState(store, {
          status: 'idle',
          attemptId: null,
          startedAt: null,
          finishedAt: null,
          seed: null,
          currentIndex: 0,
          order: EMPTY_ORDER,
          answers: {},
          error: null,
          quizId: entry.id,
          quizTitle: definition.title,
          quizVersion: definition.version,
          quizDefinition: definition,
          shuffleQuestionsDefault: entry.shuffleQuestions ?? true,
          shuffleAnswersDefault: entry.shuffleAnswers ?? true,
          timeLimitSeconds: entry.timeLimitSeconds ?? null,
          quizzBackgroundColor: entry.quizzBackgroundColor ?? null,
          history: persistence.readHistoryForQuiz(entry.id),
          stats: persistence.readStats(entry.id),
          hasPersistedAttempt: !!persistedAttempt,
        });
      } else {
        throw new Error('entry id not found');
      }
    },

    startAttempt(definition: QuizDefinition, options?: StartAttemptOptions): void {
      const seed = options?.seed ?? createAttemptSeed();
      const shuffleQuestionsEnabled = options?.shuffleQuestions ?? store.shuffleQuestionsDefault();
      const shuffleAnswersEnabled = options?.shuffleAnswers ?? store.shuffleAnswersDefault();
      const order = buildOrder(definition, seed, shuffleQuestionsEnabled, shuffleAnswersEnabled);

      patchState(store, {
        quizId: store.quizId() ?? definition.id,
        quizTitle: definition.title,
        quizVersion: store.quizVersion() ?? definition.version,
        quizDefinition: definition,
        status: 'inProgress',
        attemptId: createAttemptId(),
        startedAt: Date.now(),
        finishedAt: null,
        seed,
        currentIndex: 0,
        order,
        answers: {},
        error: null,
        hasPersistedAttempt: true,
      });

      const snapshot = buildPersistedSnapshotFromSignals(store);
      if (snapshot) {
        persistence.writeAttempt(snapshot);
      }
    },

    resumeAttempt(quizId: string): boolean {
      const definition = store.quizDefinition();
      if (!definition) {
        patchState(store, { error: 'Quiz is not loaded yet.' });
        return false;
      }

      const persisted = persistence.readAttempt(quizId);
      if (!persisted) {
        patchState(store, { error: 'No saved attempt found for this quiz.', hasPersistedAttempt: false });
        return false;
      }

      const compatibility = checkAttemptCompatibility(persisted, definition);
      if (!compatibility.compatible) {
        patchState(store, {
          error:
            compatibility.reason ??
            'Saved attempt is no longer compatible with the latest quiz version. Please restart.',
          hasPersistedAttempt: false,
        });
        return false;
      }

      patchState(store, { isHydrating: true });
      patchState(store, {
        quizId: persisted.quizId,
        quizVersion: persisted.quizVersion,
        attemptId: persisted.attemptId,
        startedAt: persisted.startedAt,
        finishedAt: persisted.finishedAt ?? null,
        seed: persisted.seed,
        currentIndex: persisted.currentIndex,
        order: persisted.order,
        answers: persisted.answers,
        status: persisted.status,
        error: null,
        hasPersistedAttempt: true,
      });
      patchState(store, { isHydrating: false });

      return true;
    },

    loadArchivedAttempt(attemptId: string): boolean {
      const definition = store.quizDefinition();
      if (!definition) {
        patchState(store, { error: 'Quiz is not loaded yet.' });
        return false;
      }

      const archived = persistence.readAttemptArchive(attemptId);
      if (!archived) {
        patchState(store, { error: 'The selected result record is not available.' });
        return false;
      }

      if (store.quizId() && archived.quizId !== store.quizId()) {
        patchState(store, { error: 'Result does not belong to the current quiz.' });
        return false;
      }

      const compatibility = checkAttemptCompatibility(archived, definition);
      if (!compatibility.compatible) {
        patchState(store, {
          error:
            compatibility.reason ??
            'Saved results are not compatible with the latest quiz content. Start a new attempt.',
        });
        return false;
      }

      patchState(store, { isHydrating: true });
      patchState(store, {
        quizId: archived.quizId,
        quizVersion: archived.quizVersion,
        attemptId: archived.attemptId,
        startedAt: archived.startedAt,
        finishedAt: archived.finishedAt ?? null,
        seed: archived.seed,
        currentIndex: archived.currentIndex,
        order: archived.order,
        answers: archived.answers,
        status: archived.status,
        error: null,
      });
      patchState(store, { isHydrating: false });

      return true;
    },

    answerCurrent(choiceId: string): void {
      const question = store.currentQuestion();
      if (!question || store.status() !== 'inProgress') {
        return;
      }

      patchState(store, {
        answers: {
          ...store.answers(),
          [question.id]: {
            selectedChoiceIds: [choiceId],
            answeredAt: Date.now(),
          },
        },
      });
    },

    goNext(): void {
      if (!store.canGoNext()) {
        return;
      }
      patchState(store, { currentIndex: store.currentIndex() + 1 });
    },

    goPrev(): void {
      if (!store.canGoPrev()) {
        return;
      }
      patchState(store, { currentIndex: Math.max(store.currentIndex() - 1, 0) });
    },

    goTo(index: number): void {
      const total = store.totalQuestions();
      if (total === 0) {
        return;
      }
      patchState(store, { currentIndex: Math.min(Math.max(index, 0), total - 1) });
    },

    finishAttempt(): void {
      if (store.status() !== 'inProgress') {
        return;
      }

      patchState(store, { status: 'finished', finishedAt: Date.now() });

      const snapshot = buildPersistedSnapshotFromSignals(store);
      const definition = store.quizDefinition();
      if (!snapshot || !definition) {
        return;
      }

      persistence.writeAttempt(snapshot);
      persistence.writeAttemptArchive(snapshot);

      const historyEntry = buildHistoryEntry(definition, snapshot);
      persistence.appendHistory(historyEntry);
      const stats = persistence.updateStatsFromHistoryEntry(historyEntry);

      patchState(store, {
        history: persistence.readHistoryForQuiz(snapshot.quizId),
        stats,
      });
    },

    restartAttempt(): void {
      const definition = store.quizDefinition();
      if (!definition) {
        return;
      }

      const seed = createAttemptSeed();
      const order = buildOrder(
        definition,
        seed,
        store.shuffleQuestionsDefault(),
        store.shuffleAnswersDefault(),
      );

      patchState(store, {
        status: 'inProgress',
        attemptId: createAttemptId(),
        startedAt: Date.now(),
        finishedAt: null,
        seed,
        currentIndex: 0,
        order,
        answers: {},
        error: null,
        hasPersistedAttempt: true,
      });

      const snapshot = buildPersistedSnapshotFromSignals(store);
      if (snapshot) {
        persistence.writeAttempt(snapshot);
      }
    },

    clearAttempt(quizId: string): void {
      persistence.clearAttempt(quizId);

      if (store.quizId() === quizId) {
        patchState(store, {
          status: 'idle',
          attemptId: null,
          startedAt: null,
          finishedAt: null,
          seed: null,
          currentIndex: 0,
          order: EMPTY_ORDER,
          answers: {},
          error: null,
          hasPersistedAttempt: false,
        });
      }
    },

    refreshHistoryAndStats(): void {
      const quizId = store.quizId();
      if (!quizId) {
        return;
      }

      patchState(store, {
        history: persistence.readHistoryForQuiz(quizId),
        stats: persistence.readStats(quizId),
        hasPersistedAttempt: !!persistence.readAttempt(quizId),
      });
    },

    persistAttemptSnapshot(): void {
      if (store.isHydrating()) {
        return;
      }

      const snapshot = buildPersistedSnapshotFromSignals(store);
      if (!snapshot) {
        return;
      }

      persistence.writeAttempt(snapshot);
    },
  })),
  withHooks({
    onInit(store) {
      const destroyRef = inject(DestroyRef);
      const persistence = inject(QuizPersistenceService);
      let persistTimer: ReturnType<typeof setTimeout> | null = null;

      effect(() => {
        const quizId = store.quizId();
        const attemptId = store.attemptId();
        const status = store.status();
        const isHydrating = store.isHydrating();

        store.currentIndex();
        store.answers();
        store.order();
        store.startedAt();
        store.finishedAt();
        store.seed();

        if (!quizId || !attemptId || status === 'idle' || isHydrating) {
          return;
        }

        if (persistTimer) {
          clearTimeout(persistTimer);
        }

        persistTimer = setTimeout(() => {
          const snapshot = buildPersistedSnapshotFromSignals(store);
          if (snapshot) {
            persistence.writeAttempt(snapshot);
          }
        }, 250);
      });

      destroyRef.onDestroy(() => {
        if (persistTimer) {
          clearTimeout(persistTimer);
        }
      });
    },
  }),
);
