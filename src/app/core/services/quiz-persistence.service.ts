import { Injectable, inject } from '@angular/core';
import {
  QuizAggregatedStats,
  QuizAttemptPersisted,
  QuizHistoryEntry,
} from '../../data/models/quiz.models';
import { LocalStorageService } from './local-storage.service';
import { STORAGE_KEYS } from './storage-keys';

@Injectable({ providedIn: 'root' })
export class QuizPersistenceService {
  private readonly storage = inject(LocalStorageService);

  readAttempt(quizId: string): QuizAttemptPersisted | null {
    return this.storage.readJson<QuizAttemptPersisted>(STORAGE_KEYS.quizAttempt(quizId));
  }

  writeAttempt(attempt: QuizAttemptPersisted): boolean {
    return this.storage.writeJson(STORAGE_KEYS.quizAttempt(attempt.quizId), attempt);
  }

  clearAttempt(quizId: string): void {
    this.storage.removeItem(STORAGE_KEYS.quizAttempt(quizId));
  }

  writeAttemptArchive(attempt: QuizAttemptPersisted): boolean {
    return this.storage.writeJson(STORAGE_KEYS.quizAttemptArchive(attempt.attemptId), attempt);
  }

  readAttemptArchive(attemptId: string): QuizAttemptPersisted | null {
    return this.storage.readJson<QuizAttemptPersisted>(STORAGE_KEYS.quizAttemptArchive(attemptId));
  }

  readHistory(): QuizHistoryEntry[] {
    const history = this.storage.readJson<QuizHistoryEntry[]>(STORAGE_KEYS.quizHistory);
    if (!Array.isArray(history)) {
      return [];
    }

    return history
      .filter((entry) => !!entry && typeof entry.quizId === 'string' && typeof entry.attemptId === 'string')
      .sort((left, right) => right.finishedAt - left.finishedAt);
  }

  readHistoryForQuiz(quizId: string): QuizHistoryEntry[] {
    return this.readHistory().filter((entry) => entry.quizId === quizId);
  }

  appendHistory(entry: QuizHistoryEntry): boolean {
    const history = this.readHistory();
    history.unshift(entry);
    return this.storage.writeJson(STORAGE_KEYS.quizHistory, history.slice(0, 200));
  }

  readStats(quizId: string): QuizAggregatedStats | null {
    return this.storage.readJson<QuizAggregatedStats>(STORAGE_KEYS.quizStats(quizId));
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

    this.storage.writeJson(STORAGE_KEYS.quizStats(entry.quizId), next);
    return next;
  }
}
