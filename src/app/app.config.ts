import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { DEFAULT_LANGUAGE } from './core/i18n/supported-languages';
import { APP_INITIALIZER, ApplicationConfig, LOCALE_ID } from '@angular/core';
import { RegionalSettingsService } from './core/services/regional-settings.service';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { routes } from './app.routes';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { FilterUndoService } from './core/services/filter-undo.service';
import { NotificationStreamService } from './core/services/notification-stream.service';

export const appConfig: ApplicationConfig = {
  providers: [
    FilterUndoService,
    NotificationStreamService,
    { provide: APP_INITIALIZER, multi: true, deps: [RegionalSettingsService], useFactory: (_regional: RegionalSettingsService) => () => undefined },
    { provide: LOCALE_ID, useValue: DEFAULT_LANGUAGE.locale },
    provideHttpClient(withInterceptorsFromDi()),
    provideRouter(routes),
    provideAnimations(),
    {
      provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
      useValue: {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'bottom',
      },
    },
    provideCharts(withDefaultRegisterables()),
    // RegionalSettingsService seeds the registered dictionaries before first render.
    provideTranslateService(),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
  ],
};
