type LogMessage = unknown;

class LoggerService {
  private TAG: string;

  constructor(tag?: string) {
    this.TAG = tag ? `${tag}:` : "";
  }

  log(...messages: LogMessage[]) {
    console.log(this.TAG, ...this.makeLogMessage(messages));
  }

  warn(...messages: LogMessage[]) {
    console.warn(this.TAG, ...this.makeLogMessage(messages));
  }

  error(...messages: LogMessage[]) {
    console.error(this.TAG, ...this.makeLogMessage(messages));
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
