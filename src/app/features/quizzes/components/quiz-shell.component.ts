import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { QuizAttemptStore } from '../../../state/stores/quiz-attempt.store';
import { QuizResolvedData } from '../../../state/tokens/quiz-route-data';

@Component({
  selector: 'app-quiz-shell',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizShellComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly attemptStore = inject(QuizAttemptStore);
  private readonly dataSignal = toSignal(this.route.data, { initialValue: this.route.snapshot.data });

  constructor() {
    effect(() => {
      const resolved = this.dataSignal()['quizData'];
      if (!resolved) {
        return;
      }
      if (resolved satisfies QuizResolvedData) {
        untracked(() => {
          this.attemptStore.setQuizContext(resolved.entry, resolved.definition);
        })
      } else {
        throw new Error("raise error on wrong data schema")
      }
    });
  }
}
