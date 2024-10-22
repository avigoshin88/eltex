import { ConnectionOptions } from "../types/connection-options";
import {
  DatachannelNativeEventListeners,
  DatachannelEventListeners,
} from "../types/datachannel-listener";
import { Nullable } from "../types/global";
import { GetSDPOfferResponse, Candidate } from "../dto/connection";
import { CustomEvents } from "./custom-events.service";
import { DatachannelClientService } from "./datachannel/data-channel.service";
import { Logger } from "./logger/logger.service";
import { MicrophoneService } from "./microphone.service";
import { Mode } from "../constants/mode";

export class WebRTCService {
  private logger = new Logger(WebRTCService.name);

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
    mode: Mode,
    options: ConnectionOptions,
    datachannel: DatachannelClientService,
    setSource: (stream: MediaStream) => void
  ) {
    this.options = { ...options };
    this.currentMode = mode;

    this.datachannelClient = datachannel;
    this.microphoneService = new MicrophoneService();
    this.setSource = setSource;

    CustomEvents.on("reinit-connection", this.reinitPeerConnection.bind(this));
  }

  public async setupPeerConnection({
    nativeListeners,
    listeners,
  }: {
    nativeListeners: DatachannelNativeEventListeners;
    listeners: DatachannelEventListeners;
  }) {
    this.nativeListeners = nativeListeners;
    this.listeners = listeners;

    this.peerConnection = new RTCPeerConnection(this.options.config);

    this.datachannelClient.register(
      this.peerConnection,
      nativeListeners,
      listeners
    );

    this.peerConnection.onicecandidate = this._onIceCandidate.bind(this);
    this.peerConnection.onicecandidateerror =
      this._onIceCandidateError.bind(this);
    this.peerConnection.ontrack = this._onTrack.bind(this);
    this.peerConnection.onconnectionstatechange =
      this._onConnectionStateChange.bind(this);

    this.peerConnection.onicegatheringstatechange =
      this.onIceatheringsStateChange.bind(this);

    await this.prepareTransceivers();

    this.initListeners();

    CustomEvents.emit(
      "peerconnection-status",
      this.peerConnection!.connectionState
    );
  }

  private async reinitPeerConnection() {
    await this.setupPeerConnection({
      nativeListeners: this.nativeListeners,
      listeners: this.listeners,
    });
  }

  private initListeners() {
    CustomEvents.on("remote-description", this.onRemoteDescription.bind(this));
    CustomEvents.on(
      "request-local-description",
      this.onRequestLocalDescription.bind(this)
    );

    if (!this.peerConnection) {
      return;
    }

    this.peerConnection.onconnectionstatechange = () => {
      CustomEvents.emit(
        "peerconnection-status",
        this.peerConnection?.connectionState
      );

      if (
        this.peerConnection?.connectionState === "disconnected" ||
        this.peerConnection?.connectionState === "failed"
      ) {
        this.reset();
      }
    };
  }

  private async prepareTransceivers() {
    const peerConnection = this.peerConnection;

    if (!peerConnection) return;

    this.logger.log("info", "prepareTransceivers: Подготавливаем трансиверы");

    this.logger.log(
      "info",
      "prepareTransceivers: Подготавливаем данные о трансиверах"
    );

    const VideoTransceiverInit: RTCRtpTransceiverInit = {
      direction: "recvonly",
      sendEncodings: [],
    };

    this.logger.log("info", "prepareTransceivers: Добавляем трансиверы");

    this.currentMode === Mode.ARCHIVE
      ? await this.microphoneService?.receiveOnlyAudio(peerConnection)
      : await this.microphoneService?.enableMicrophone(peerConnection);
    peerConnection.addTransceiver("video", VideoTransceiverInit);

    this.logger.log("info", "prepareTransceivers: Трансиверы добавлены");
  }

  private onRemoteDescription(remoteOffer: GetSDPOfferResponse) {
    if (!this.peerConnection) {
      throw Error("Peer connection отсутствует");
    }

    this.logger.log("info", "Получен Remote Description: ", remoteOffer);

    const remoteDescription: RTCSessionDescriptionInit = {
      type:
        this.peerConnection.signalingState === "have-remote-offer"
          ? "offer"
          : "answer",
      sdp: remoteOffer.sdp,
    };

    this.peerConnection?.setRemoteDescription(remoteDescription).then(() => {
      this.logger.log("info", "Remote Description установлен");
    });
  }

  private async onRequestLocalDescription() {
    if (!this.peerConnection) {
      throw Error("Peer connection отсутствует");
    }

    this.logger.log(
      "info",
      "Запрос локального описания, текущее состояние сигнала:",
      this.peerConnection.signalingState
    );

    try {
      let description: RTCSessionDescriptionInit;

      if (this.peerConnection.signalingState === "have-remote-offer") {
        this.logger.log("info", "Создание ответа на удаленное предложение");
        description = await this.peerConnection.createAnswer();
      } else {
        this.logger.log("info", "Создание нового предложения");
        description = await this.peerConnection.createOffer();
      }

      description.sdp = this.modifySDP(
        description.sdp!,
        this.options.constrains?.maxBitrate ?? 0
      );

      await this.peerConnection.setLocalDescription(description);

      this.logger.log("info", "Local Description установлен:", description);
    } catch (error) {
      this.logger.error(
        "info",
        "Ошибка при создании или установке локального описания:",
        error
      );
    }
  }

  private onIceatheringsStateChange() {
    if (this.peerConnection?.iceGatheringState === "complete") {
      CustomEvents.emit(
        "local-description",
        this.peerConnection.localDescription?.sdp
      );
    }
  }

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
    if (maxBitrate === 0) return sdp;

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

    return modifiedSDP;
  }

  public reset() {
    this.logger.log("info", "Начало очистки сервиса");

    this.peerConnection
      ?.getTransceivers()
      .forEach((transceiver) => transceiver.stop());

    this.microphoneService?.close();
    this.peerConnection?.close();
    this.currentMode = null;
    this._tracks = [];
    this.peerConnection = null;
    this.datachannelClient.close();

    this.logger.log("info", "Сервис очищен");
  }

  private _onIceCandidate(event: RTCPeerConnectionIceEvent) {
    if (!event.candidate) {
      this.logger.warn("info", "ICE candidate: null");
      return;
    }

    this.logger.log(
      "info",
      "Удаленный ICE candidate: \n " + event.candidate.candidate
    );

    CustomEvents.emit(
      "ice-candidate",
      this.parseCandidate(event.candidate.candidate)
    );
  }

  private _onTrack(event: RTCTrackEvent) {
    this.logger.log(
      "info",
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
        "info",
        "onTrack: Дожидаемся пока придут все треки и их количество будет совпадать с количеством получателей"
      );
    }
  }

  private _onIceCandidateError(event: RTCPeerConnectionIceErrorEvent) {
    this.logger.error(
      "info",
      "Ошибка ICE_CANDIDATE_ERROR:",
      event.errorText,
      ", код",
      event.errorCode,
      ", адрес",
      event.url,
      ", порт",
      event.port
    );
  }

  private _onConnectionStateChange(event: Event) {
    this.logger.log(
      "info",
      "Статус подключения изменился, новый статус:",
      this.peerConnection?.connectionState,
      ", event:",
      event
    );
  }

  private parseCandidate(line: string) {
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
    return candidate;
  }
}
