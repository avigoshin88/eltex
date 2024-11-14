import { EventCallback, EventName } from "../types/event-bus";
import { Logger } from "./logger/logger.service";

class EventBus {
  static instances: Record<string, EventBus> = {};
  static getInstance(id: string): EventBus {
    if (!EventBus.instances[id]) {
      EventBus.instances[id] = new EventBus(id);
    }
    return EventBus.instances[id];
  }

  private logger: Logger;
  private listeners: Map<EventName, EventCallback[]> = new Map();

  constructor(id: string) {
    this.logger = new Logger(id, "EventBus");
  }

  on(event: EventName, callback: EventCallback): void {
    this.logger.log("trace", `Подписываемся на событие ${event}`);

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event)!.push(callback);
  }

  off(event: EventName, callback: EventCallback): void {
    this.logger.log("trace", `Отписываемся от события ${event}`);

    const eventListeners = this.listeners.get(event);

    if (!eventListeners) {
      return;
    }

    this.listeners.set(
      event,
      eventListeners.filter((listener) => listener !== callback)
    );

    if (this.listeners.get(event)?.length === 0) {
      this.listeners.delete(event);
    }
  }

  emit(event: EventName, data?: any): void {
    this.logger.log("trace", `Вызываем событие ${event}`);

    const eventListeners = this.listeners.get(event);

    if (!eventListeners) {
      return;
    }

    eventListeners.forEach((callback) => callback(data));
  }
}

export { EventBus };
