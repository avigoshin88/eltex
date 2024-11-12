import {
  DatachannelEventListener,
  DatachannelEventListeners,
  DatachannelMessageType,
  DatachannelNativeEventListeners,
} from "../../types/datachannel-listener";
import { CustomEventsService } from "../custom-events.service";
import { Logger } from "../logger/logger.service";
import { DatachannelTransportBuilderService } from "./data-channel-transport-builder.service";

export class DatachannelClientService {
  private logger: Logger;
  private customEventsService: CustomEventsService;
  private datachannel!: RTCDataChannel;
  private readonly datachannelTransportBuilder: DatachannelTransportBuilderService;
  private listeners: DatachannelEventListeners = {};
  private errorListener?: (error: any) => void;

  onClose?: () => void | Promise<void>;

  constructor(
    private id: string,
    onClose?: () => void | Promise<void>,
    errorListener?: (error: any) => void
  ) {
    this.customEventsService = CustomEventsService.getInstance(this.id);
    this.onClose = onClose;
    this.errorListener = errorListener;
    this.logger = new Logger(id, "DatachannelClientService");
    this.datachannelTransportBuilder = new DatachannelTransportBuilderService(
      id
    );
  }

  register(
    peerConnection: RTCPeerConnection,
    nativeListeners: DatachannelNativeEventListeners,
    listeners: DatachannelEventListeners
  ) {
    this.logger.log("info", "Регистрируем datachannel");
    this.datachannel = peerConnection.createDataChannel("data");

    for (const listenerName in nativeListeners) {
      if (listenerName === "open") {
        this.datachannel.addEventListener(listenerName, (event) => {
          this.logger.log("info", "datachannel открыт");
          nativeListeners[listenerName]?.(event);
        });
      }

      if (listenerName === "close") {
        this.datachannel.addEventListener(listenerName, (event) => {
          this.logger.log("info", "datachannel закрыт");
          nativeListeners[listenerName]?.(event);
        });
      }
    }

    if (Object.keys(nativeListeners).length === 0) {
      this.datachannel.onopen = () => {
        this.logger.log("info", "datachannel открыт");
      };
      this.datachannel.onclose = () => {
        this.logger.log("info", "datachannel закрыт");
      };
    }

    this.listeners = listeners;

    this.datachannel.onmessage = (e) => this.onMessage(e);
  }

  updateListener(
    type: DatachannelMessageType,
    cb: DatachannelEventListener | undefined
  ) {
    this.logger.log("info", `Обновляем слушателя события типа ${type}`);
    this.listeners[type] = cb;
  }

  send(type: DatachannelMessageType, data?: unknown) {
    this.logger.log(
      "info",
      "Отправлено событие:",
      this.datachannelTransportBuilder.build(type, data)
    );
    this.datachannel.send(this.datachannelTransportBuilder.build(type, data));
  }

  private onMessage(event: MessageEvent) {
    this.logger.log("info", "Новое сообщение:", event.data);

    const listenerNames = Object.keys(
      this.listeners
    ) as DatachannelMessageType[];
    if (listenerNames.length === 0) {
      this.logger.warn("info", "Нет подписок на datachannel");
      return;
    }

    try {
      const result = JSON.parse(event.data);

      if (typeof result !== "object") {
        throw new Error(`Тип ответа datachannel не объект: ${result}`);
      }

      const { type, data, error } = result;

      if (!type && error) {
        this.errorListener?.(error);
        return;
      }

      this.signalData(type, data);

      if (type == null) {
        throw new Error("Неправильный тип ответа, отсутствует тип");
      }

      const listener = listenerNames.find(
        (listenerName) => listenerName === type
      );

      if (!listener) {
        this.logger.warn("info", "Слушателя события нет:", type);
        return;
      }

      this.listeners[listener]?.(data, error);
    } catch (error) {
      this.logger.error(
        "info",
        "Не удалось расшифровать сообщение:",
        error,
        "сообщение:",
        event.data
      );
    }
  }

  async close() {
    this.datachannel?.close();

    await this.onClose?.();
  }

  private signalData(type: string, data: object) {
    switch (type) {
      case DatachannelMessageType.META:
        this.customEventsService.emit("meta", data);
        break;
    }
  }
}
