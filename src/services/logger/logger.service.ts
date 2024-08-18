type LogMessage = unknown;

class LoggerService {
  log(...messages: LogMessage[]) {
    console.log(...this.makeLogMessage(messages));
  }

  warn(...messages: LogMessage[]) {
    console.warn(...this.makeLogMessage(messages));
  }

  error(...messages: LogMessage[]) {
    console.error(...this.makeLogMessage(messages));
  }

  private makeLogMessage(messages: LogMessage[]) {
    return messages.map(this.parseMessage);
  }

  private parseMessage(message: LogMessage) {
    if (message === null || message === undefined) {
      return "";
    }

    try {
      return JSON.stringify(message, null, 2);
    } catch (error) {
      return "";
    }
  }
}

const logger = new LoggerService();

export { logger as Logger };
