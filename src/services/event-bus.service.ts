import { EventCallback, EventName } from "../types/event-bus";

class EventBus {
  private listeners: Map<EventName, EventCallback[]> = new Map();

  on(event: EventName, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: EventName, callback: EventCallback): void {
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
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) {
      return;
    }

    eventListeners.forEach((callback) => callback(data));
  }
}

const eventBus = new EventBus();

export { eventBus as EventBus };
