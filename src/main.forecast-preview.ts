// Dedicated opt-in entry. This component is not imported by the production app or its routes.
import { bootstrapApplication } from '@angular/platform-browser';
import { ForecastPreviewComponent } from './forecast-preview/forecast-preview.component';
bootstrapApplication(ForecastPreviewComponent).catch(error => console.error(error));
