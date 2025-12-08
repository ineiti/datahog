import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

export function callback_datahog(s: number) {
  console.log(s);
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
