import { environment } from '../../environments/environment';

export class DevelopmentLogger {
  constructor(private readonly production = environment.production) {}

  debug(event: string, context?: unknown): void {
    if (this.production) {
      return;
    }

    if (context === undefined) {
      console.debug(`[${event}]`);
      return;
    }

    console.debug(`[${event}]`, context);
  }

  error(event: string, error?: unknown): void {
    if (this.production) {
      return;
    }

    if (error === undefined) {
      console.error(`[${event}]`);
      return;
    }

    console.error(`[${event}]`, error);
  }
}

export const developmentLogger = new DevelopmentLogger();
