import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { QuizPersistenceService } from '../../core/services/quiz-persistence.service';
import { QuizLoaderService } from '../../data/services/quiz-loader.service';
import { QuizAggregatedStats, QuizCatalogEntry, QuizDefinition } from '../../data/models/quiz.models';

interface QuizCatalogState {
  loading: boolean;
  error: string | null;
  catalog: QuizCatalogEntry[];
  quizDefinitionCache: Record<string, QuizDefinition>;
  statsByQuizId: Record<string, QuizAggregatedStats>;
  catalogLoaded: boolean;
}

const initialState: QuizCatalogState = {
  loading: false,
  error: null,
  catalog: [],
  quizDefinitionCache: {},
  statsByQuizId: {},
  catalogLoaded: false,
};

export const QuizCatalogStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    catalogCount: computed(() => store.catalog().length),
    catalogMap: computed(() =>
      store.catalog().reduce<Record<string, QuizCatalogEntry>>((accumulator, entry) => {
        accumulator[entry.id] = entry;
        return accumulator;
      }, {}),
    ),
  })),
  withMethods((store, loader = inject(QuizLoaderService), persistence = inject(QuizPersistenceService)) => {
    const loadCatalogInternal = async (force = false): Promise<void> => {
      if (store.loading()) {
        return;
      }

      if (store.catalogLoaded() && !force) {
        return;
      }

      patchState(store, { loading: true, error: null });

      try {
        const catalog = await loader.loadCatalog();
        const statsByQuizId = catalog.quizzes.reduce<Record<string, QuizAggregatedStats>>((accumulator, entry) => {
          const stats = persistence.readStats(entry.id);
          if (stats) {
            accumulator[entry.id] = stats;
          }
          return accumulator;
        }, {});

        patchState(store, {
          catalog: catalog.quizzes,
          statsByQuizId,
          loading: false,
          error: null,
          catalogLoaded: true,
        });
      } catch (error) {
        patchState(store, {
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load quiz catalog.',
        });
      }
    };

    return {
      async loadCatalog(force = false): Promise<void> {
        await loadCatalogInternal(force);
      },

      async loadQuizDefinition(quizId: string): Promise<QuizDefinition> {
        const cached = store.quizDefinitionCache()[quizId];
        if (cached) {
          return cached;
        }

        if (!store.catalogLoaded()) {
          await loadCatalogInternal(false);
        }

        const entry = store.catalog().find((item) => item.id === quizId);
        if (!entry) {
          throw new Error(`Quiz '${quizId}' was not found in catalog.`);
        }

        const definition = await loader.loadQuizDefinition(entry.jsonPath);
        if (definition.id !== entry.id) {
          throw new Error(`Quiz id mismatch. Catalog id '${entry.id}' differs from file id '${definition.id}'.`);
        }

        patchState(store, {
          quizDefinitionCache: {
            ...store.quizDefinitionCache(),
            [quizId]: definition,
          },
        });

        return definition;
      },

      refreshStats(quizId?: string): void {
        if (quizId) {
          const stats = persistence.readStats(quizId);
          if (!stats) {
            return;
          }

          patchState(store, {
            statsByQuizId: {
              ...store.statsByQuizId(),
              [quizId]: stats,
            },
          });
          return;
        }

        const statsByQuizId = store.catalog().reduce<Record<string, QuizAggregatedStats>>((accumulator, entry) => {
          const stats = persistence.readStats(entry.id);
          if (stats) {
            accumulator[entry.id] = stats;
          }
          return accumulator;
        }, {});

        patchState(store, { statsByQuizId });
      },
    };
  }),
);
