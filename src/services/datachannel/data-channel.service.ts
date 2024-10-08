import {
  DatachannelEventListener,
  DatachannelEventListeners,
  DatachannelMessageType,
  DatachannelNativeEventListeners,
} from "../../types/datachannel-listener";
import { Logger } from "../logger/logger.service";
import { DatachannelTransportBuilderService } from "./data-channel-transport-builder.service";

export class DatachannelClientService {
  private readonly logger = new Logger(DatachannelClientService.name);
  private datachannel!: RTCDataChannel;
  private readonly datachannelTransportBuilder: DatachannelTransportBuilderService =
    new DatachannelTransportBuilderService();
  private listeners: DatachannelEventListeners = {};

  register(
    peerConnection: RTCPeerConnection,
    nativeListeners: DatachannelNativeEventListeners,
    listeners: DatachannelEventListeners
  ) {
    this.logger.log("Регистрируем datachannel");
    this.datachannel = peerConnection.createDataChannel("data");

    for (const listenerName in nativeListeners) {
      if (listenerName === "open") {
        this.datachannel.addEventListener(listenerName, (event) => {
          this.logger.log("datachannel открыт");
          nativeListeners[listenerName]?.(event);
        });
      }

      if (listenerName === "close") {
        this.datachannel.addEventListener(listenerName, (event) => {
          this.logger.log("datachannel закрыт");
          nativeListeners[listenerName]?.(event);
        });
      }
    }

    if (Object.keys(nativeListeners).length === 0) {
      this.datachannel.onopen = () => {
        this.logger.log("datachannel открыт");
      };
      this.datachannel.onclose = () => {
        this.logger.log("datachannel закрыт");
      };
    }

    this.listeners = listeners;

    this.datachannel.onmessage = (e) => this.onMessage(e);
  }

  updateListener(
    type: DatachannelMessageType,
    cb: DatachannelEventListener | undefined
  ) {
    this.logger.log(`Обновляем слушателя события типа ${type}`);
    this.listeners[type] = cb;
  }

  send(type: DatachannelMessageType, data?: unknown) {
    this.logger.log(
      "Отправлено событие:",
      this.datachannelTransportBuilder.build(type, data)
    );
    this.datachannel.send(this.datachannelTransportBuilder.build(type, data));
  }

  private onMessage(event: MessageEvent) {
    this.logger.log("Новое сообщение:", event.data);

    const listenerNames = Object.keys(
      this.listeners
    ) as DatachannelMessageType[];
    if (listenerNames.length === 0) {
      this.logger.warn("Нет подписок на datachannel");
      return;
    }

    try {
      const result = JSON.parse(event.data);

      if (typeof result !== "object") {
        throw new Error(`Тип ответа datachannel не объект: ${result}`);
      }

      const { type, data } = result;

      if (type == null) {
        throw new Error("Неправильный тип ответа, отсутствует тип");
      }

      const listener = listenerNames.find(
        (listenerName) => listenerName === type
      );

      if (!listener) {
        this.logger.warn("Слушателя события нет:", type);
        return;
      }

      this.listeners[listener]?.(data);
    } catch (error) {
      this.logger.error(
        "Не удалось расшифровать сообщение:",
        error,
        "сообщение:",
        event.data
      );
    }
  }

  close() {
    this.datachannel?.close();
  }
}
