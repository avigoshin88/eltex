type LogMessage = unknown;
type LogLevel = "info" | "debug" | "trace";

const LOGGER_LEVEL: LogLevel = import.meta.env.DEV
  ? (import.meta.env.VITE_LOGGER_LEVEL as LogLevel)
  : "info";

class LoggerService {
  private TAG: string;
  private logLevel: LogLevel;

  constructor(tag?: string, logLevel: LogLevel = LOGGER_LEVEL) {
    this.TAG = tag ? `${tag}:` : "";
    this.logLevel = logLevel;
  }

  log(level: LogLevel, ...messages: LogMessage[]) {
    if (this.shouldLog(level)) {
      console.log(this.TAG, ...this.makeLogMessage(messages));
    }
  }

  warn(level: LogLevel, ...messages: LogMessage[]) {
    if (this.shouldLog(level)) {
      console.warn(this.TAG, ...this.makeLogMessage(messages));
    }
  }

  error(level: LogLevel, ...messages: LogMessage[]) {
    if (this.shouldLog(level)) {
      console.error(this.TAG, ...this.makeLogMessage(messages));
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ["info", "debug", "trace"];
    return levels.indexOf(level) <= levels.indexOf(this.logLevel);
  }

  private makeLogMessage(messages: LogMessage[]) {
    return messages.map(this.parseMessage);
  }

  private parseMessage(message: LogMessage) {
    if (message === null || message === undefined) {
      return "";
    }

    try {
      if (typeof message === "string") {
        return message;
      }

      return JSON.stringify(message, null, 2);
    } catch (error) {
      return "";
    }
  }
}

export { LoggerService as Logger };
