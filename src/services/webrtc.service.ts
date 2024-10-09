import { ConnectionOptions } from "../types/connection-options";
import {
  DatachannelNativeEventListeners,
  DatachannelEventListeners,
} from "../types/datachannel-listener";
import { Nullable } from "../types/global";
import {
  ConnectionType,
  TURNConnectionType,
  GetSDPOfferResponse,
  Candidate,
} from "../dto/connection";
import { CustomEvents } from "./custom-events.service";
import { DatachannelClientService } from "./datachannel/data-channel.service";
import { Logger } from "./logger/logger.service";
import { MicrophoneService } from "./microphone.service";

export class WebRTCService {
  private logger = new Logger(WebRTCService.name);

  private peerConnection: Nullable<RTCPeerConnection> = null;
  private microphoneService: Nullable<MicrophoneService> = null;
  private options!: ConnectionOptions;
  private currentType: null | ConnectionType = null;
  private datachannelClient: DatachannelClientService;

  private setSource: (stream: MediaStream) => void;
  private _tracks: MediaStreamTrack[] = [];
  private generator: AsyncGenerator<undefined, void, unknown> | undefined;

  constructor(
    options: ConnectionOptions,
    datachannel: DatachannelClientService,
    setSource: (stream: MediaStream) => void
  ) {
    this.options = { ...options };

    this.datachannelClient = datachannel;
    this.microphoneService = new MicrophoneService();
    this.setSource = setSource;
  }

  public setupPeerConnection({
    nativeListeners,
    listeners,
  }: {
    nativeListeners: DatachannelNativeEventListeners;
    listeners: DatachannelEventListeners;
  }) {
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
  }

  private async prepareTransceivers() {
    const peerConnection = this.peerConnection;

    if (!peerConnection) return;

    this.logger.log("prepareTransceivers: Подготавливаем трансиверы");

    this.logger.log("prepareTransceivers: Подготавливаем данные о трансиверах");

    const VideoTransceiverInit: RTCRtpTransceiverInit = {
      direction: "recvonly",
      sendEncodings: [],
    };

    this.logger.log("prepareTransceivers: Добавляем трансиверы");

    this.currentType === "archive"
      ? await this.microphoneService?.receiveOnlyAudio(peerConnection)
      : await this.microphoneService?.enableMicrophone(peerConnection);
    peerConnection.addTransceiver("video", VideoTransceiverInit);

    this.logger.log("prepareTransceivers: Трансиверы добавлены");
  }

  private async waitForRemoteOffer() {
    return new Promise<GetSDPOfferResponse>((resolve, reject) => {
      let isResolved = false;

      const onRemoteOffer = (response: GetSDPOfferResponse) => {
        if (!isResolved) {
          isResolved = true;
          CustomEvents.off("remote-sdp-offer", onRemoteOffer);
          CustomEvents.off("remote-sdp-error", onError);
          resolve(response);
        }
      };

      const onError = (error: any) => {
        if (!isResolved) {
          isResolved = true;
          CustomEvents.off("remote-sdp-offer", onRemoteOffer);
          CustomEvents.off("remote-sdp-error", onError);
          reject(error);
        }
      };

      CustomEvents.on("remote-sdp-offer", onRemoteOffer);
      CustomEvents.on("remote-sdp-error", onError);

      // Проверка, если событие уже было отправлено до подписки
      setTimeout(() => {
        if (!isResolved) {
          CustomEvents.emit("request-remote-sdp-offer");
        }
      }, 0);
    });
  }

  public async startP2P() {
    return new Promise<void>(async (resolve, reject) => {
      const outerThis = this;

      if (!outerThis.peerConnection)
        throw Error("P2P: Live сервис не инициализирован");

      const peerConnection = outerThis.peerConnection;

      async function* startP2PGen() {
        outerThis.logger.log("P2P: Начало соединения через P2P");

        outerThis.currentType = "play_analytic";

        await outerThis.prepareTransceivers();

        outerThis.logger.log("P2P: Запрашиваем SDP offer");
        const remoteOffer = await outerThis.waitForRemoteOffer().catch(reject);

        outerThis.logger.log("P2P: SDP offer получен: ", remoteOffer);

        const offer: RTCSessionDescriptionInit = {
          sdp: remoteOffer?.sdp,
          type: "offer",
        };

        outerThis.logger.log("P2P: setRemoteDescription");
        await peerConnection.setRemoteDescription(offer);

        outerThis.logger.log("P2P: Готовим локальный SDP offer");

        const answer = await outerThis.getSDP.bind(outerThis)("P2P");

        outerThis.logger.log("P2P: setLocalDescription");

        await peerConnection.setLocalDescription(answer).catch((e) => {
          throw Error(
            `P2P: Не удалось установить Local Description, ошибка: ${JSON.stringify(
              e
            )}`
          );
        });

        outerThis.logger.log("P2P: setLocalDescription установлено");

        yield;

        CustomEvents.emit("local-sdp-answer", answer.sdp!);

        outerThis.logger.log("P2P: очищаем генератор");

        outerThis.generator = undefined;
      }

      outerThis.logger.log("P2P: устанавливаем генератор");

      const onIceGatheringStateChange = async () => {
        try {
          if (
            peerConnection.iceGatheringState === "complete" &&
            this.generator
          ) {
            const result = await this.generator.next();

            if (result.done) {
              peerConnection.onicegatheringstatechange = null;
              resolve();
            }
          }
        } catch (e) {
          reject(e);
        }
      };

      peerConnection.onicegatheringstatechange = onIceGatheringStateChange;

      this.generator = startP2PGen();
      await this.generator.next();
    });
  }

  public async startTURN(connectionType: TURNConnectionType) {
    return new Promise<void>(async (resolve, reject) => {
      const outerThis = this;

      if (!outerThis.peerConnection)
        throw Error("TURN: Live сервис не инициализирован");

      const peerConnection = outerThis.peerConnection;

      async function* startTURNGen() {
        outerThis.logger.log("TURN: Начало соединения через TURN");

        outerThis.currentType = connectionType;

        await outerThis.prepareTransceivers();

        outerThis.logger.log("TURN: Готовим локальный SDP offer");

        const offer = await outerThis.getSDP.bind(outerThis)("TURN");

        CustomEvents.emit("local-sdp-offer", offer.sdp!);

        outerThis.logger.log("TURN: setLocalDescription");

        await peerConnection.setLocalDescription(offer).catch((e) => {
          throw Error(
            `TURN: Не удалось установить Local Description, ошибка: ${JSON.stringify(
              e
            )}`
          );
        });

        yield;

        outerThis.logger.log(
          "TURN: Запрашиваем обмен SDP offer",
          peerConnection.localDescription?.sdp!
        );

        const remoteOffer = await outerThis.waitForRemoteOffer();

        if (remoteOffer.code !== 0 || !remoteOffer.sdp) {
          throw Error(
            `TURN: Не удается получить SDP offer, ответ: ${JSON.stringify(
              remoteOffer
            )}`
          );
        }

        const answer: RTCSessionDescriptionInit = {
          type: "answer",
          sdp: remoteOffer.sdp!,
        };

        outerThis.logger.log("TURN: setRemoteDescription");
        await peerConnection.setRemoteDescription(answer);

        outerThis.logger.log("TURN: очищаем генератор");

        outerThis.generator = undefined;
      }

      outerThis.logger.log("TURN: устанавливаем генератор");

      const onIceGatheringStateChange = async () => {
        try {
          if (
            peerConnection.iceGatheringState === "complete" &&
            this.generator
          ) {
            const result = await this.generator.next();

            if (result.done) {
              peerConnection.onicegatheringstatechange = null;
              resolve();
            }
          }
        } catch (e) {
          reject(e);
        }
      };

      peerConnection.onicegatheringstatechange = onIceGatheringStateChange;

      this.generator = startTURNGen();
      await this.generator.next();
    });
  }

  private async getSDP(type: "P2P" | "TURN") {
    let data = await (type === "P2P"
      ? this.peerConnection!.createAnswer()
      : this.peerConnection!.createOffer());

    if (!data.sdp) {
      throw Error(`${type}: Не удается подготовить SDP offer`);
    }

    this.logger.log(`${type}: SDP offer подготовлен: `, data);

    if (this.options.constrains) {
      this.logger.log(
        "TURN: Устанавливаем ограничения битрейта равное ",
        this.options.constrains.maxBitrate
      );

      data = {
        ...data,
        sdp: this.modifySDP(data.sdp, this.options.constrains.maxBitrate),
      };
    }

    return data;
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
    this.logger.log("Начало очистки сервиса");

    this.peerConnection
      ?.getTransceivers()
      .forEach((transceiver) => transceiver.stop());

    this.microphoneService?.close();
    this.peerConnection?.close();
    this._tracks = [];
    this.currentType = null;
    this.peerConnection = null;
    this.datachannelClient.close();

    this.logger.log("Сервис очищен");
  }

  private _onIceCandidate(event: RTCPeerConnectionIceEvent) {
    if (!event.candidate) {
      this.logger.warn("ICE candidate: null");
      return;
    }

    this.logger.log("Удаленный ICE candidate: \n " + event.candidate.candidate);

    CustomEvents.emit(
      "ice-candidate",
      this.parseCandidate(event.candidate.candidate)
    );
  }

  private _onTrack(event: RTCTrackEvent) {
    this.logger.log("Получен новый Track event, kind:", event.track.kind);

    if (!this.peerConnection) throw Error("Peer connection отсутствует");

    this._tracks.push(event.track);

    if (this.peerConnection.getReceivers().length && this._tracks.length) {
      this.setSource(new MediaStream(this._tracks));
    } else if (event.streams?.length > 0) {
      this.setSource(event.streams[0]);
    } else {
      this.logger.error(
        "onTrack: Дожидаемся пока придут все треки и их количество будет совпадать с количеством получателей"
      );
    }
  }

  private _onIceCandidateError(event: RTCPeerConnectionIceErrorEvent) {
    this.logger.error(
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
