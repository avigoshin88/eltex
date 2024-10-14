import {
  DatachannelEventListeners,
  DatachannelMessageType,
  DatachannelNativeEventListeners,
} from "../../types/datachannel-listener";
import { CustomEvents } from "../custom-events.service";
import { Logger } from "../logger/logger.service";
import { DatachannelTransportBuilderService } from "./data-channel-transport-builder.service";

export class DatachannelClientService {
  private readonly logger = new Logger(DatachannelClientService.name);
  private datachannel!: RTCDataChannel;
  private readonly datachannelTransportBuilder: DatachannelTransportBuilderService =
    new DatachannelTransportBuilderService();

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

    this.datachannel.onmessage = (event) => this.onMessage(event, listeners);
  }

  send(type: DatachannelMessageType, data?: unknown) {
    this.logger.log(
      "info",
      "Отправлено событие:",
      this.datachannelTransportBuilder.build(type, data)
    );
    this.datachannel.send(this.datachannelTransportBuilder.build(type, data));
  }

  private onMessage(event: MessageEvent, listeners: DatachannelEventListeners) {
    this.logger.log("info", "Новое сообщение:", event.data);

    const listenerNames = Object.keys(listeners) as DatachannelMessageType[];
    if (listenerNames.length === 0) {
      this.logger.warn("info", "Нет подписок на datachannel");
      return;
    }

    try {
      const result = JSON.parse(event.data);

      if (typeof result !== "object") {
        throw new Error(`Тип ответа datachannel не объект: ${result}`);
      }

      const { type, data } = result;

      this.signalData(type, data);

      // времянка пока не поменяли формат данных
      if (listenerNames.includes(DatachannelMessageType.META) && !type) {
        listeners[DatachannelMessageType.META]?.(result);
        return;
      }

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

      listeners[listener]?.(data);
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

  close() {
    this.datachannel?.close();
  }

  private signalData(type: string, data: object) {
    switch (type) {
      case DatachannelMessageType.META:
        CustomEvents.emit("meta", data);
        break;
    }
  }
}
