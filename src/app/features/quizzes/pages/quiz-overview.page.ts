import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { QuizAttemptStore } from '../../../state/stores/quiz-attempt.store';
import { QuizCatalogStore } from '../../../state/stores/quiz-catalog.store';
import { QuizResolvedData } from '../../../state/tokens/quiz-route-data';

@Component({
  selector: 'app-quiz-overview-page',
  standalone: true,
  imports: [RouterLink, DatePipe, MatButtonModule, MatCardModule, MatDividerModule],
  templateUrl: './quiz-overview.page.html',
  styleUrl: './quiz-overview.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizOverviewPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly parentRoute = this.route.parent ?? this.route;

  protected readonly attemptStore = inject(QuizAttemptStore);
  protected readonly catalogStore = inject(QuizCatalogStore);

  private readonly parentData = toSignal(this.parentRoute.data, { initialValue: this.parentRoute.snapshot.data });

  protected readonly resolved = computed(
    () => this.parentData()['quizData'] as QuizResolvedData | undefined,
  );

  protected readonly questionCount = computed(() => this.resolved()?.definition.questions.length ?? 0);

  constructor() {
    effect(() => {
      const data = this.resolved();
      if (!data) {
        return;
      }

      this.attemptStore.setQuizContext(data.entry, data.definition);
      this.attemptStore.refreshHistoryAndStats();
      this.catalogStore.refreshStats(data.entry.id);
    });
  }
}
