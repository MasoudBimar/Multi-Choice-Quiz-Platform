import { Routes } from '@angular/router';
import { QuizAttemptStore } from './state/stores/quiz-attempt.store';
import { quizCatalogResolver, quizRouteResolver } from './features/quizzes/resolvers/quizzes.resolvers';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'quizzes',
  },
  {
    path: 'quizzes',
    loadComponent: () =>
      import('./features/quizzes/pages/quiz-list.page').then((module) => module.QuizListPageComponent),
    resolve: {
      catalogReady: quizCatalogResolver,
    },
  },
  {
    path: 'quiz/:quizId',
    providers: [QuizAttemptStore],
    resolve: {
      quizData: quizRouteResolver,
    },
    loadComponent: () =>
      import('./features/quizzes/components/quiz-shell.component').then((module) => module.QuizShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/quizzes/pages/quiz-overview.page').then(
            (module) => module.QuizOverviewPageComponent,
          ),
      },
      {
        path: 'take',
        loadComponent: () =>
          import('./features/quizzes/pages/quiz-runner.page').then((module) => module.QuizRunnerPageComponent),
      },
      {
        path: 'results/:attemptId',
        loadComponent: () =>
          import('./features/quizzes/pages/quiz-results.page').then(
            (module) => module.QuizResultsPageComponent,
          ),
      },
    ],
  },
  {
    path: 'error',
    loadComponent: () =>
      import('./features/quizzes/pages/quiz-error.page').then((module) => module.QuizErrorPageComponent),
  },
  {
    path: '**',
    redirectTo: 'quizzes',
  },
];
