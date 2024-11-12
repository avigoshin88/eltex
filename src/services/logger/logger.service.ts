import { EnvService } from "../env.service";

type LogMessage = unknown;
type LogLevel = "info" | "debug" | "trace";

const LOGGER_LEVEL: LogLevel = import.meta.env.DEV
  ? (EnvService.getENV("VITE_LOGGER_LEVEL") as LogLevel)
  : "info";

class LoggerService {
  static logLevels: Record<string, LogLevel> = {};
  static setLogLevel = (id: string, logLevel: LogLevel = LOGGER_LEVEL) => {
    LoggerService.logLevels[id] = logLevel;
  };
  private PREFIX: string;

  constructor(
    private id: string,
    tag: string,
    logLevel: LogLevel = LOGGER_LEVEL
  ) {
    this.PREFIX = `[${id}] ${tag}:`;
    LoggerService.setLogLevel(id, logLevel);
  }

  log(level: LogLevel, ...messages: LogMessage[]) {
    if (this.shouldLog(level)) {
      console.log(this.PREFIX, ...this.makeLogMessage(messages));
    }
  }

  warn(level: LogLevel, ...messages: LogMessage[]) {
    if (this.shouldLog(level)) {
      console.warn(this.PREFIX, ...this.makeLogMessage(messages));
    }
  }

  error(level: LogLevel, ...messages: LogMessage[]) {
    if (this.shouldLog(level)) {
      console.error(this.PREFIX, ...this.makeLogMessage(messages));
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ["info", "debug", "trace"];
    return (
      levels.indexOf(level) <= levels.indexOf(LoggerService.logLevels[this.id])
    );
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
