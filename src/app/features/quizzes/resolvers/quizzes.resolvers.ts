import { RedirectCommand, ResolveFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { QuizCatalogStore } from '../../../state/stores/quiz-catalog.store';
import { QuizResolvedData } from '../../../state/tokens/quiz-route-data';

export const quizCatalogResolver: ResolveFn<boolean> = async () => {
  const catalogStore = inject(QuizCatalogStore);
  await catalogStore.loadCatalog();
  return !catalogStore.error();
};

export const quizRouteResolver: ResolveFn<QuizResolvedData | RedirectCommand> = async (route) => {
  const quizId = route.paramMap.get('quizId');
  const catalogStore = inject(QuizCatalogStore);
  const router = inject(Router);

  if (!quizId) {
    return new RedirectCommand(
      router.createUrlTree(['/error'], {
        queryParams: { message: 'Quiz id is missing in route.' },
      }),
    );
  }

  try {
    await catalogStore.loadCatalog();
    const entry = catalogStore.catalog().find((quiz) => quiz.id === quizId);

    if (!entry) {
      return new RedirectCommand(
        router.createUrlTree(['/error'], {
          queryParams: { message: `Quiz '${quizId}' does not exist.` },
        }),
      );
    }

    const definition = await catalogStore.loadQuizDefinition(quizId);

    return {
      entry,
      definition,
    };
  } catch (error) {
    return new RedirectCommand(
      router.createUrlTree(['/error'], {
        queryParams: {
          message: error instanceof Error ? error.message : 'Failed to load quiz data.',
        },
      }),
    );
  }
};
