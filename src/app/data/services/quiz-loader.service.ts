import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { QuizCatalog, QuizDefinition } from '../models/quiz.models';
import { validateQuizCatalog, validateQuizDefinition } from '../validation/quiz-schema.validator';

@Injectable({ providedIn: 'root' })
export class QuizLoaderService {
  private readonly http = inject(HttpClient);

  async loadCatalog(): Promise<QuizCatalog> {
    const payload = await firstValueFrom(this.http.get<unknown>('/assets/quizzes/index.json'));
    const result = validateQuizCatalog(payload);
    if (!result.ok || !result.value) {
      throw new Error(result.error ?? 'Invalid quiz catalog.');
    }

    return result.value;
  }

  async loadQuizDefinition(jsonPath: string): Promise<QuizDefinition> {
    const payload = await firstValueFrom(this.http.get<unknown>(jsonPath));
    const result = validateQuizDefinition(payload);

    if (!result.ok || !result.value) {
      throw new Error(result.error ?? `Invalid quiz definition: ${jsonPath}`);
    }

    return result.value;
  }
}
