import { ConnectionOptions } from "../types/connection-options";
import {
  DatachannelNativeEventListeners,
  DatachannelEventListeners,
} from "../types/datachannel-listener";
import { Nullable } from "../types/global";
import { GetSDPOfferResponse, Candidate } from "../dto/connection";
import { CustomEventsService } from "./custom-events.service";
import { DatachannelClientService } from "./datachannel/data-channel.service";
import { EventBus } from "./event-bus.service";
import { Logger } from "./logger/logger.service";
import { MicrophoneService } from "./microphone.service";
import { Mode } from "../constants/mode";

export class WebRTCService {
  private logger: Logger;
  private customEventsService: CustomEventsService | undefined;
  private eventBus: EventBus;

  private peerConnection: Nullable<RTCPeerConnection> = null;
  private microphoneService: Nullable<MicrophoneService> = null;
  private options!: ConnectionOptions;
  private currentMode: Nullable<Mode> = null;
  private datachannelClient: DatachannelClientService;

  private nativeListeners: DatachannelNativeEventListeners = {};
  private listeners: DatachannelEventListeners = {};

  private setSource: (stream: MediaStream) => void;
  private _tracks: MediaStreamTrack[] = [];

  constructor(
    id: string,
    mode: Mode,
    options: ConnectionOptions,
    datachannel: DatachannelClientService,
    setSource: (stream: MediaStream) => void,
    private onConnectionStateChangeCb: () => void
  ) {
    this.options = { ...options };
    this.currentMode = mode;
    this.logger = new Logger(id, "WebRTCService");

    this.datachannelClient = datachannel;
    this.microphoneService = new MicrophoneService(id);
    this.setSource = setSource;

    this.customEventsService = CustomEventsService.getInstance(id);
    this.eventBus = EventBus.getInstance(id);

    this.customEventsService.on("reinit-connection", this.reinitPeerConnection);
  }

  public async setupPeerConnection({
    nativeListeners,
    listeners,
  }: {
    nativeListeners: DatachannelNativeEventListeners;
    listeners: DatachannelEventListeners;
  }) {
    this.logger.log("debug", `Подготавливаем Peer connection`);

    this.nativeListeners = nativeListeners;
    this.listeners = listeners;

    this.peerConnection = new RTCPeerConnection(this.options.config);

    this.eventBus.emit("setup-peerconnection", this.peerConnection);

    this.datachannelClient.register(
      this.peerConnection,
      nativeListeners,
      listeners
    );

    if (this.isNeedIceCandidates()) {
      this.logger.log(
        "debug",
        `Локальное предложение будет отправлено только после сбора кандидатов`
      );

      this.peerConnection.onicecandidate = this._onIceCandidate;
      this.peerConnection.onicecandidateerror = this._onIceCandidateError;
      this.peerConnection.onicegatheringstatechange =
        this.onIcegatheringStateChange;
    }

    this.peerConnection.ontrack = this._onTrack.bind(this);
    this.peerConnection.onconnectionstatechange =
      this._onConnectionStateChange.bind(this);

    await this.prepareTransceivers();

    this.initListeners();

    this.customEventsService?.emit(
      "peerconnection-status",
      this.peerConnection!.connectionState
    );
  }

  private reinitPeerConnection = async () => {
    this.logger.log("debug", `Перезапускаем Peer connection`);

    await this.setupPeerConnection({
      nativeListeners: this.nativeListeners,
      listeners: this.listeners,
    });
  };

  private initListeners() {
    this.logger.log("debug", `Инициализируем слушателей`);

    this.customEventsService?.on(
      "remote-description",
      this.onRemoteDescription
    );
    this.customEventsService?.on(
      "request-local-description",
      this.onRequestLocalDescription
    );
  }

  public resetListeners() {
    this.logger.log("debug", `Удаляем слушателей`);

    if (this.isNeedIceCandidates()) {
      this.peerConnection?.removeEventListener(
        "icecandidate",
        this._onIceCandidate
      );
      this.peerConnection?.removeEventListener(
        "icecandidateerror",
        this._onIceCandidateError
      );
      this.peerConnection?.removeEventListener(
        "icegatheringstatechange",
        this.onIcegatheringStateChange
      );
    }

    this.customEventsService?.off(
      "remote-description",
      this.onRemoteDescription
    );
    this.customEventsService?.off(
      "request-local-description",
      this.onRequestLocalDescription
    );
  }

  private async prepareTransceivers() {
    const peerConnection = this.peerConnection;

    if (!peerConnection) return;

    this.logger.log("debug", "prepareTransceivers: Подготавливаем трансиверы");

    this.logger.log(
      "debug",
      "prepareTransceivers: Подготавливаем данные о трансиверах"
    );

    const VideoTransceiverInit: RTCRtpTransceiverInit = {
      direction: "recvonly",
      sendEncodings: [],
    };

    this.currentMode === Mode.ARCHIVE
      ? await this.microphoneService?.receiveOnlyAudio(peerConnection)
      : await this.microphoneService?.enableMicrophone(peerConnection);

    this.logger.log("debug", "prepareTransceivers: Добавляем трансиверы");
    peerConnection.addTransceiver("video", VideoTransceiverInit);

    this.logger.log("debug", "prepareTransceivers: Трансиверы добавлены");
  }

  private onRemoteDescription = async (remoteOffer: GetSDPOfferResponse) => {
    if (!this.peerConnection) {
      throw Error("Peer connection отсутствует");
    }

    if (this.peerConnection.remoteDescription) {
      return;
    }

    try {
      this.logger.log("debug", "Получен Remote Description: ", remoteOffer);

      const remoteDescription: RTCSessionDescriptionInit = {
        type:
          this.peerConnection.signalingState === "have-remote-offer"
            ? "offer"
            : "answer",
        sdp: remoteOffer.sdp,
      };

      await this.peerConnection?.setRemoteDescription(remoteDescription);

      this.logger.log("debug", "Remote Description установлен");
    } catch (error) {
      this.logger.error(
        "debug",
        "Ошибка при создании или установке удаленного описания:",
        error
      );
    }
  };

  private onRequestLocalDescription = async () => {
    if (!this.peerConnection) {
      throw Error("Peer connection отсутствует");
    }

    if (this.peerConnection.localDescription) {
      return;
    }

    this.logger.log(
      "debug",
      "Запрос локального описания, текущее состояние сигнала:",
      this.peerConnection.signalingState
    );

    try {
      let description: RTCSessionDescriptionInit;

      if (this.peerConnection.signalingState === "have-remote-offer") {
        this.logger.log("debug", "Создание ответа на удаленное предложение");
        description = await this.peerConnection.createAnswer();
      } else {
        this.logger.log("debug", "Создание нового предложения");
        description = await this.peerConnection.createOffer();
      }

      description.sdp = this.modifySDP(
        description.sdp!,
        this.options.constrains?.maxBitrate ?? 0
      );

      await this.peerConnection.setLocalDescription(description);

      if (!this.isNeedIceCandidates()) {
        this.customEventsService?.emit(
          "local-description",
          this.peerConnection.localDescription!.sdp
        );
      }

      this.logger.log("debug", "Local Description установлен");
    } catch (error) {
      this.logger.error(
        "debug",
        "Ошибка при создании или установке локального описания:",
        error
      );
    }
  };

  public getPeerConnection() {
    return this.peerConnection;
  }

  public getOffers() {
    if (!this.peerConnection) {
      throw Error("Peer connection отсутствует");
    }

    return {
      local: this.peerConnection.localDescription?.sdp,
      remote: this.peerConnection.remoteDescription?.sdp,
    };
  }

  private onIcegatheringStateChange = () => {
    this.logger.log(
      "debug",
      `Ice gathering state: ${this.peerConnection?.iceGatheringState}`
    );

    if (this.peerConnection?.iceGatheringState === "complete") {
      this.logger.log("debug", `Сбор кандидатов закончен`);

      this.customEventsService?.emit(
        "local-description",
        this.peerConnection.localDescription?.sdp
      );
    }
  };

  public get hasAccessToMicrophone() {
    return this.microphoneService?.hasAccessToMicrophone;
  }

  public get isMicEnabled() {
    return this.microphoneService?.isMicrophoneEnabled;
  }

  public get micCallbacks() {
    return this.microphoneService?.prepareButtonCallbacks;
  }

  private modifySDP(sdp: string, maxBitrate: number): string {
    this.logger.log(
      "debug",
      `Модифицируем SDP предложение, максимальный битрейт ${maxBitrate}, оригинальное предложение: ${sdp}`
    );

    if (maxBitrate === 0) {
      this.logger.log(
        "debug",
        `Ограничений нет, оставляем предложение как есть`
      );
      return sdp;
    }

    const lines = sdp.split("\n");

    let videoPayloadTypes: string[] = [];
    let isVideoSection = false;

    const minBitrate = 300;
    const startBitrate = maxBitrate < 800 ? maxBitrate - minBitrate : 800;

    // Сначала определяем видео секцию SDP и собираем все payload types для видео
    lines.forEach((line) => {
      if (line.startsWith("m=video")) {
        isVideoSection = true;
      } else if (line.startsWith("m=")) {
        isVideoSection = false; // Мы вышли из видео секции
      }

      // Если мы в видео секции и находим rtpmap, то это возможный видео кодек
      if (isVideoSection && line.startsWith("a=rtpmap:")) {
        const payloadTypeMatch = line.match(/^a=rtpmap:(\d+)\s(.+?)\/\d+/);

        if (payloadTypeMatch) {
          videoPayloadTypes.push(payloadTypeMatch[1]);
        }
      }
    });

    // Теперь модифицируем или добавляем fmtp для найденных видео кодеков
    const modifiedSDP = lines
      .map((line, index) => {
        if (line.startsWith("a=fmtp:")) {
          const payloadType = line.match(/^a=fmtp:(\d+)/)?.[1];

          if (payloadType && videoPayloadTypes.includes(payloadType)) {
            return `${line}; x-google-max-bitrate=${maxBitrate}; x-google-min-bitrate=${minBitrate}; x-google-start-bitrate=${startBitrate}`;
          }
        } else if (line.startsWith("a=rtpmap:")) {
          const payloadType = line.match(/^a=rtpmap:(\d+)/)?.[1];

          if (payloadType && videoPayloadTypes.includes(payloadType)) {
            const nextLine = lines[index + 1];

            // Если нет fmtp для этого кодека, добавляем новую строку
            if (!nextLine.startsWith("a=fmtp:")) {
              return `${line}\na=fmtp:${payloadType} x-google-max-bitrate=${maxBitrate}; x-google-min-bitrate=${minBitrate}; x-google-start-bitrate=${startBitrate}`;
            }
          }
        }
        return line;
      })
      .join("\n");

    this.logger.log(
      "debug",
      `Модифицированное SDP предложение с учетом максимального битрейта ${maxBitrate}: ${modifiedSDP}`
    );

    return modifiedSDP;
  }

  public async reset() {
    this.logger.log("debug", "Начало очистки сервиса");

    this.peerConnection
      ?.getTransceivers()
      .forEach((transceiver) => transceiver.stop());

    this.microphoneService?.close();
    this.peerConnection?.close();
    this._tracks = [];
    this.peerConnection = null;
    await this.datachannelClient.close();

    this.customEventsService?.off(
      "reinit-connection",
      this.reinitPeerConnection
    );
    this.resetListeners();

    this.logger.log("debug", "Сервис очищен");
  }

  private _onIceCandidate = (event: RTCPeerConnectionIceEvent) => {
    if (!event.candidate) {
      return;
    }

    this.logger.log(
      "debug",
      "Удаленный ICE candidate: \n " + event.candidate.candidate
    );

    this.customEventsService?.emit(
      "ice-candidate",
      this.parseCandidate(event.candidate.candidate)
    );
  };

  private _onTrack(event: RTCTrackEvent) {
    this.logger.log(
      "debug",
      "Получен новый Track event, kind:",
      event.track.kind
    );

    if (!this.peerConnection) throw Error("Peer connection отсутствует");

    this._tracks.push(event.track);

    if (this.peerConnection.getReceivers().length && this._tracks.length) {
      this.setSource(new MediaStream(this._tracks));
    } else if (event.streams?.length > 0) {
      this.setSource(event.streams[0]);
    } else {
      this.logger.error(
        "debug",
        "onTrack: Дожидаемся пока придут все треки и их количество будет совпадать с количеством получателей"
      );
    }
  }

  private _onIceCandidateError = (event: RTCPeerConnectionIceErrorEvent) => {
    this.logger.error(
      "debug",
      "Ошибка ICE_CANDIDATE_ERROR:",
      event.errorText,
      ", код",
      event.errorCode,
      ", адрес",
      event.url,
      ", порт",
      event.port
    );
  };

  private _onConnectionStateChange = async (event: Event) => {
    this.logger.log(
      "debug",
      "Статус подключения изменился, новый статус:",
      this.peerConnection?.connectionState,
      ", event:",
      event
    );

    this.customEventsService?.emit(
      "peerconnection-status",
      this.peerConnection?.connectionState
    );

    this.onConnectionStateChangeCb();

    if (this.peerConnection?.connectionState === "disconnected") {
      this.logger.log("debug", `Соединение оборвалось, перезапускаем`);

      this.eventBus.emit("restart-connection");
    }
  };

  private parseCandidate(line: string) {
    this.logger.log(
      "trace",
      `Обрабатываем кандидата, оригинальная строка ${line}`
    );

    let parts;

    if (line.indexOf("a=candidate:") === 0) {
      parts = line.substring(12).split(" ");
    } else {
      parts = line.substring(10).split(" ");
    }

    const candidate: Candidate = {
      foundation: parts[0],
      component: parseInt(parts[1], 10),
      protocol: parts[2].toLowerCase(),
      priority: parseInt(parts[3], 10),
      ip: parts[4],
      address: parts[4], // address is an alias for ip.
      port: parseInt(parts[5], 10),
      type: parts[7],
    };

    for (var i = 8; i < parts.length; i += 2) {
      switch (parts[i]) {
        case "raddr":
          candidate.relatedAddress = parts[i + 1];
          break;
        case "rport":
          candidate.relatedPort = parseInt(parts[i + 1], 10);
          break;
        case "tcptype":
          candidate.tcpType = parts[i + 1];
          break;
        case "ufrag":
          candidate.ufrag = parts[i + 1]; // for backward compability.
          candidate.usernameFragment = parts[i + 1];
          break;
        default: // extension handling, in particular ufrag
          candidate[parts[i]] = parts[i + 1];
          break;
      }
    }

    this.logger.log("trace", `Кандидат обработан: ${candidate}`);

    return candidate;
  }

  get connectionState() {
    return this.peerConnection?.connectionState;
  }

  private isNeedIceCandidates() {
    return this.currentMode !== Mode.ARCHIVE;
  }
}
