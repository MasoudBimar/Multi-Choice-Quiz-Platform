import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatDividerModule } from '@angular/material/divider';
import { QuizAttemptStore } from '../../../state/stores/quiz-attempt.store';
import { QuizResolvedData } from '../../../state/tokens/quiz-route-data';

@Component({
  selector: 'app-quiz-runner-page',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatProgressBarModule,
    MatRadioModule,
    MatDividerModule,
  ],
  templateUrl: './quiz-runner.page.html',
  styleUrl: './quiz-runner.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizRunnerPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly attemptStore = inject(QuizAttemptStore);

  private readonly parentRoute = this.route.parent ?? this.route;
  private readonly parentData = toSignal(this.parentRoute.data, { initialValue: this.parentRoute.snapshot.data });
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  private readonly bootstrapped = signal(false);

  protected readonly resolved = computed(
    () => this.parentData()['quizData'] as QuizResolvedData | undefined,
  );

  protected readonly selectedChoiceId = computed(() => {
    const current = this.attemptStore.currentQuestion();
    if (!current) {
      return null;
    }

    return this.attemptStore.answers()[current.id]?.selectedChoiceIds[0] ?? null;
  });

  protected readonly questionProgressLabel = computed(() => {
    const total = this.attemptStore.totalQuestions();
    if (total === 0) {
      return '0/0';
    }
    return `${this.attemptStore.currentIndex() + 1}/${total}`;
  });

  constructor() {
    effect(() => {
      const data = this.resolved();
      const mode = this.queryParams().get('mode');

      if (!data || this.bootstrapped()) {
        return;
      }

      this.attemptStore.setQuizContext(data.entry, data.definition);

      if (mode === 'resume') {
        const resumed = this.attemptStore.resumeAttempt(data.entry.id);
        if (!resumed) {
          this.attemptStore.startAttempt(data.definition, {
            shuffleQuestions: data.entry.shuffleQuestions,
            shuffleAnswers: data.entry.shuffleAnswers,
          });
        }
      } else {
        this.attemptStore.startAttempt(data.definition, {
          shuffleQuestions: data.entry.shuffleQuestions,
          shuffleAnswers: data.entry.shuffleAnswers,
        });
      }

      this.bootstrapped.set(true);
    });
  }

  protected onAnswer(choiceId: string): void {
    this.attemptStore.answerCurrent(choiceId);
  }

  protected finishQuiz(): void {
    if (this.attemptStore.remainingCount() > 0) {
      const shouldFinish = window.confirm(
        `You still have ${this.attemptStore.remainingCount()} unanswered question(s). Finish anyway?`,
      );

      if (!shouldFinish) {
        return;
      }
    }

    this.attemptStore.finishAttempt();

    const quizId = this.attemptStore.quizId();
    const attemptId = this.attemptStore.attemptId();
    if (quizId && attemptId) {
      void this.router.navigate(['/quiz', quizId, 'results', attemptId]);
    }
  }
}
