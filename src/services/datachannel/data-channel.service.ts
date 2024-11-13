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
    this.logger.log("debug", "Регистрируем datachannel");
    this.datachannel = peerConnection.createDataChannel("data");

    this.logger.log(
      "debug",
      `Регистрируем следующих нативных слушателей: ${Object.keys(
        nativeListeners
      )
        .filter(
          (l) => !!nativeListeners[l as keyof DatachannelNativeEventListeners]
        )
        .join(", ")}`
    );

    for (const listenerName in nativeListeners) {
      if (listenerName === "open") {
        this.datachannel.addEventListener(listenerName, (event) => {
          this.logger.log("debug", "Datachannel открыт");
          nativeListeners[listenerName]?.(event);
        });
      }

      if (listenerName === "close") {
        this.datachannel.addEventListener(listenerName, (event) => {
          this.logger.log("debug", "Datachannel закрыт");
          nativeListeners[listenerName]?.(event);
        });
      }

      this.datachannel.addEventListener(listenerName, (e) => {
        this.logger.log(
          "debug",
          `Сработало событие типа ${listenerName}: ${JSON.stringify(e)}`
        );
        nativeListeners[
          listenerName as keyof DatachannelNativeEventListeners
        ]?.(e);
      });
    }

    if (!Object.keys(nativeListeners).includes("open")) {
      this.datachannel.onopen = () => {
        this.logger.log("debug", "Datachannel открыт");
      };
    }

    if (!Object.keys(nativeListeners).includes("close")) {
      this.datachannel.onclose = () => {
        this.logger.log("debug", "Datachannel закрыт");
      };
    }

    this.logger.log(
      "debug",
      `Регистрируем следующих кастомных слушателей: ${Object.keys(listeners)
        .filter((l) => !!listeners[l as keyof DatachannelEventListeners])
        .join(", ")}`
    );
    this.listeners = listeners;

    this.datachannel.onmessage = (e) => this.onMessage(e);
  }

  updateListener(
    type: DatachannelMessageType,
    cb: DatachannelEventListener | undefined
  ) {
    this.logger.log(
      "trace",
      `Обновляем кастомного слушателя события типа ${type}`
    );
    this.listeners[type] = cb;
  }

  send(type: DatachannelMessageType, data?: unknown) {
    this.logger.log(
      "trace",
      "Отправляем событие:",
      this.datachannelTransportBuilder.build(type, data)
    );
    this.datachannel.send(this.datachannelTransportBuilder.build(type, data));
  }

  private onMessage(event: MessageEvent) {
    this.logger.log("trace", "Новое сообщение:", event.data);

    const listenerNames = Object.keys(
      this.listeners
    ) as DatachannelMessageType[];

    if (listenerNames.length === 0) {
      this.logger.warn("trace", "Нет подписок на datachannel");
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
        this.logger.warn("trace", "Слушателя события нет:", type);
        return;
      }

      this.listeners[listener]?.(data, error);
    } catch (error) {
      this.logger.error(
        "trace",
        "Не удалось расшифровать сообщение:",
        error,
        "сообщение:",
        event.data
      );
    }
  }

  async close() {
    this.logger.log("debug", "Закрываем datachannel");
    this.datachannel?.close();

    await this.onClose?.();
  }

  private signalData(type: string, data: object) {
    this.logger.log(
      "trace",
      `Отправляем кастомное событие с сообщением типа ${type} и сообщением ${JSON.stringify(
        data
      )}`
    );

    switch (type) {
      case DatachannelMessageType.META:
        this.customEventsService.emit("meta", data);
        break;
    }
  }
}
