import { Nullable } from "../types/global";

export type CustomEventName =
  | "meta"
  | "local-sdp-offer"
  | "local-sdp-answer"
  | "remote-sdp-offer"
  | "remote-sdp-error"
  | 'request-remote-sdp-offer'
  | "ice-candidate";

export type CustomEventCallback<T = any> = (data: T) => void;

class CustomEventsService {
  private id: Nullable<string> = null;

  private eventListeners: Map<string, Map<CustomEventCallback, EventListener>> =
    new Map();

  constructor() {}

  setId(id: string) {
    this.id = id;
  }

  on<T = any>(name: CustomEventName, callback: CustomEventCallback<T>) {
    const eventName = this.getEventNameWithId(name);

    const eventListener = (event: CustomEvent) => {
      callback(event.detail);
    };

    // @ts-ignore
    window.addEventListener(eventName, eventListener);

    this.storeEventListener(eventName, callback, eventListener);
  }

  off<T = any>(name: CustomEventName, callback: CustomEventCallback<T>) {
    const eventName = this.getEventNameWithId(name);

    const eventListener = this.retrieveEventListener(eventName, callback);

    if (eventListener) {
      window.removeEventListener(eventName, eventListener);
      this.removeStoredEventListener(eventName, callback);
    }
  }

  emit<T = any>(name: CustomEventName, data?: T) {
    const eventName = this.getEventNameWithId(name);

    const event = new CustomEvent(eventName, {
      detail: data,
    });

    window.dispatchEvent(event);
  }

  private getEventNameWithId(name: CustomEventName): string {
    if (!this.id) {
      throw new Error("ID is not set");
    }
    return `${name}-${this.id}`;
  }

  private storeEventListener(
    eventName: string,
    callback: CustomEventCallback,
    eventListener: CustomEventCallback
  ) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Map());
    }
    this.eventListeners.get(eventName)!.set(callback, eventListener);
  }

  private retrieveEventListener(
    eventName: string,
    callback: CustomEventCallback
  ): EventListener | undefined {
    return this.eventListeners.get(eventName)?.get(callback);
  }

  private removeStoredEventListener(
    eventName: string,
    callback: CustomEventCallback
  ) {
    this.eventListeners.get(eventName)?.delete(callback);
    if (this.eventListeners.get(eventName)?.size === 0) {
      this.eventListeners.delete(eventName);
    }
  }
}

const customEvents = new CustomEventsService();

export { customEvents as CustomEvents };
