import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { QuizAttemptStore } from '../../../state/stores/quiz-attempt.store';
import { QuizResolvedData } from '../../../state/tokens/quiz-route-data';

@Component({
  selector: 'app-quiz-results-page',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    MatExpansionModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
  ],
  templateUrl: './quiz-results.page.html',
  styleUrl: './quiz-results.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizResultsPageComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly attemptStore = inject(QuizAttemptStore);

  private readonly parentRoute = this.route.parent ?? this.route;
  private readonly parentData = toSignal(this.parentRoute.data, { initialValue: this.parentRoute.snapshot.data });
  private readonly paramMap = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly resolved = computed(
    () => this.parentData()['quizData'] as QuizResolvedData | undefined,
  );

  protected readonly results = computed(() => this.attemptStore.resultsModel());

  constructor() {
    effect(() => {
      const data = this.resolved();
      const attemptId = this.paramMap().get('attemptId');
      if (!data || !attemptId) {
        return;
      }

      this.attemptStore.setQuizContext(data.entry, data.definition);

      if (this.attemptStore.attemptId() === attemptId && this.attemptStore.status() === 'finished') {
        return;
      }

      const resumed = this.attemptStore.resumeAttempt(data.entry.id);
      if (resumed && this.attemptStore.attemptId() === attemptId) {
        return;
      }

      this.attemptStore.loadArchivedAttempt(attemptId);
    });
  }

  protected choiceText(questionId: string, choiceId: string): string {
    const definition = this.attemptStore.quizDefinition();
    const question = definition?.questions.find((item) => item.id === questionId);
    const choice = question?.choices.find((item) => item.id === choiceId);
    return choice?.text ?? choiceId;
  }

  protected isSelected(questionId: string, selectedChoiceIds: string[], choiceId: string): boolean {
    return selectedChoiceIds.includes(choiceId);
  }

  protected isCorrect(correctChoiceIds: string[], choiceId: string): boolean {
    return correctChoiceIds.includes(choiceId);
  }
}
