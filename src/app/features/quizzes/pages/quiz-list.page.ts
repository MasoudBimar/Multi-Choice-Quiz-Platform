import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { QuizCatalogStore } from '../../../state/stores/quiz-catalog.store';
import { UiPrefsStore } from '../../../state/stores/ui-prefs.store';

@Component({
  selector: 'app-quiz-list-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './quiz-list.page.html',
  styleUrl: './quiz-list.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizListPageComponent {
  protected readonly uiPrefs = inject(UiPrefsStore);
  protected readonly catalogStore = inject(QuizCatalogStore);
  protected readonly query = signal('');

  protected readonly filteredCatalog = computed(() => {
    const filter = this.query().trim().toLowerCase();
    if (!filter) {
      return this.catalogStore.catalog();
    }

    return this.catalogStore
      .catalog()
      .filter(
        (quiz) =>
          quiz.title.toLowerCase().includes(filter) ||
          quiz.description.toLowerCase().includes(filter) ||
          quiz.id.toLowerCase().includes(filter),
      );
  });

  constructor() {
    void this.catalogStore.loadCatalog();
  }

  protected trackByQuizId(index: number, item: { id: string }): string {
    return item.id;
  }
}
