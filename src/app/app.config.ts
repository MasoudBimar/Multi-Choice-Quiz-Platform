import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, Router, withComponentInputBinding, withNavigationErrorHandler } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(),
      withNavigationErrorHandler((error) => {
        const router = inject(Router);
        console.error('Navigation error:', error);
        router.navigate(['/error']);
      }),),
    provideHttpClient(),
    provideAnimationsAsync(),
  ],
};
