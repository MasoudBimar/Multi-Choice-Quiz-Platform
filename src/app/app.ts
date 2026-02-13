import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { UiPrefsStore } from './state/stores/ui-prefs.store';
import { LocalStorageService } from './core/services/local-storage.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatSlideToggleModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly uiPrefs = inject(UiPrefsStore);
  protected readonly storage = inject(LocalStorageService);

  protected onThemeChange(event: MatSlideToggleChange): void {
    this.uiPrefs.setTheme(event.checked ? 'dark' : 'light');
  }
}
