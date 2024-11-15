type LogMessage = unknown;
export type LogLevel = "info" | "debug" | "trace";

class LoggerService {
  static logLevels: Record<string, LogLevel> = {};
  static setLogLevel = (id: string, logLevel: LogLevel = "info") => {
    LoggerService.logLevels[id] = logLevel;
  };
  private PREFIX: string;

  constructor(private id: string, tag: string, logLevel: LogLevel = "info") {
    this.PREFIX = `[ID: ${id}] ${tag}:`;

    if (!LoggerService.logLevels[id]) {
      LoggerService.setLogLevel(id, logLevel);
    }
  }

  log(level: LogLevel, ...messages: LogMessage[]) {
    if (this.shouldLog(level)) {
      console.log(
        `%c${level} [${new Date().toISOString()}]%c %c${
          this.PREFIX
        }%c ${this.makeLogMessage(messages)}`,
        "color: white; background-color: black;",
        "",
        "color: black; background-color: white;",
        ""
      );
    }
  }

  warn(level: LogLevel, ...messages: LogMessage[]) {
    if (this.shouldLog(level)) {
      console.warn(
        `%c${level} [${new Date().toISOString()}]%c %c${
          this.PREFIX
        }%c ${this.makeLogMessage(messages)}`,
        "color: white; background-color: black;",
        "",
        "color: black; background-color: white;",
        ""
      );
    }
  }

  error(level: LogLevel, ...messages: LogMessage[]) {
    if (this.shouldLog(level)) {
      console.error(
        `%c${level} [${new Date().toISOString()}]%c %c${
          this.PREFIX
        }%c ${this.makeLogMessage(messages)}`,
        "color: white; background-color: black;",
        "",
        "color: black; background-color: white;",
        ""
      );
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ["info", "debug", "trace"];
    return (
      levels.indexOf(level) <= levels.indexOf(LoggerService.logLevels[this.id])
    );
  }

  private makeLogMessage(messages: LogMessage[]) {
    return messages.map(this.parseMessage).filter(Boolean).join(" ");
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
