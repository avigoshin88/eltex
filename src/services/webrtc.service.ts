import { ConnectionOptions } from "../types/connection-options";
import {
  DatachannelNativeEventListeners,
  DatachannelEventListeners,
} from "../types/datachannel-listener";
import { Nullable } from "../types/global";
import {
  ConnectionType,
  requestSDPOfferExchangeTURN,
  TURNConnectionType,
} from "./api/common";
import {
  Candidate,
  getSDPOffer,
  requestPutCandidate,
  requestSDPOfferExchangeP2P,
} from "./api/live";
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

        const { app, stream } = outerThis.options;

        outerThis.logger.log("P2P: Запрашиваем SDP offer");

        const getSDPOfferResponse = await getSDPOffer(app, stream);

        if (getSDPOfferResponse.code != 0) {
          throw new Error(
            `P2P: Не удается получить SDP offer, ответ: ${JSON.stringify(
              getSDPOfferResponse
            )}`
          );
        }

        outerThis.logger.log(
          "P2P: Ответ на запрос SDP offer:",
          getSDPOfferResponse
        );

        const offer: RTCSessionDescriptionInit = {
          sdp: getSDPOfferResponse.sdp,
          type: "offer",
        };

        outerThis.logger.log("P2P: setRemoteDescription");
        await peerConnection.setRemoteDescription(offer);

        outerThis.logger.log("P2P: Подготавливаем ответ на SDP offer");
        let answer = await peerConnection.createAnswer();

        if (outerThis.options.constrains && answer.sdp) {
          outerThis.logger.log(
            "P2P: Устанавливаем ограничения битрейда равное ",
            outerThis.options.constrains.maxBitrate
          );
          answer = {
            ...answer,
            sdp: outerThis.modifySDP(
              answer.sdp,
              outerThis.options.constrains.maxBitrate
            ),
          };
        }

        if (!answer.sdp) throw Error("P2P: Не удается подготовить SDP offer");

        outerThis.logger.log("P2P: Ответ на SDP offer:", answer);

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

        outerThis.logger.log("P2P: Отправляем ответный SDP offer");

        await requestSDPOfferExchangeP2P(
          app,
          stream,
          peerConnection.currentLocalDescription?.sdp!
        );

        outerThis.logger.log("P2P: Ответный SDP offer отправлен успешно");

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

        const { app, stream } = outerThis.options;

        outerThis.logger.log("TURN: Подготавливаем SDP offer");
        let offer = await peerConnection.createOffer();
        outerThis.logger.log("TURN: SDP offer подготовлен: ", offer);

        if (outerThis.options.constrains && offer.sdp) {
          outerThis.logger.log(
            "TURN: Устанавливаем ограничения битрейта равное ",
            outerThis.options.constrains.maxBitrate
          );

          offer = {
            ...offer,
            sdp: outerThis.modifySDP(
              offer.sdp,
              outerThis.options.constrains.maxBitrate
            ),
          };
        }

        outerThis.logger.log("TURN: Устанавливаем свой SDP offer");
        await peerConnection.setLocalDescription(offer);

        yield;

        outerThis.logger.log(
          "TURN: Запрашиваем обмен SDP offer",
          peerConnection.localDescription?.sdp!
        );
        const requestSDPOfferExchangeResponse =
          await requestSDPOfferExchangeTURN(
            app,
            stream,
            outerThis.currentType,
            peerConnection.localDescription?.sdp!
          );

        if (
          requestSDPOfferExchangeResponse.code !== 0 ||
          !requestSDPOfferExchangeResponse.sdp
        ) {
          throw Error(
            `TURN: Не удается получить SDP offer, ответ: ${JSON.stringify(
              requestSDPOfferExchangeResponse
            )}`
          );
        }

        outerThis.logger.log(
          "TURN: Ответ на обмен SDP offer:",
          requestSDPOfferExchangeResponse
        );

        const answer: RTCSessionDescriptionInit = {
          type: "answer",
          sdp: requestSDPOfferExchangeResponse.sdp,
        };

        outerThis.logger.log("TURN: setRemoteDescription");
        peerConnection.setRemoteDescription(answer);

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
    if (this.currentType === "archive") {
      return;
    }

    if (event.candidate) {
      this.logger.log(
        "Удаленный ICE candidate: \n " + event.candidate.candidate
      );
      // this.processIceCandidateEvent(event);
    }
  }

  // Уточнить, убираем ли метод
  private processIceCandidateEvent(e: RTCPeerConnectionIceEvent) {
    this.logger.log("Начинаем процессинг и отправку кандидата");

    if (!e.candidate) throw Error(`Кандидат отсутствует, event: ${e}`);
    if (!this.currentType) throw Error("Не указан текущий тип соединения");

    this.logger.log("Обрабатываем кандидата");

    const candidate = this.parseCandidate(e.candidate.candidate);

    const { app, stream } = this.options;

    this.logger.log("Отправляем обработанного кандидата");

    requestPutCandidate(app, stream, this.currentType, candidate);
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
