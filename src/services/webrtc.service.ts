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
import { EventBus } from "./event-bus.service";
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
    EventBus.emit("setup-peerconnection", this.peerConnection);

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
    this.logger.log("P2P: Начало соединения через P2P");

    this.currentType = "play_analytic";

    if (!this.peerConnection)
      throw Error("P2P: Live сервис не инициализирован");

    const peerConnection = this.peerConnection;

    this.prepareTransceivers();

    const { app, stream } = this.options;

    this.logger.log("P2P: Запрашиваем SDP offer");

    const getSDPOfferResponse = await getSDPOffer(app, stream);

    if (getSDPOfferResponse.code != 0) {
      throw new Error(
        `P2P: Не удается получить SDP offer, ответ: ${JSON.stringify(
          getSDPOfferResponse
        )}`
      );
    }

    this.logger.log("P2P: Ответ на запрос SDP offer:", getSDPOfferResponse);

    const offer: RTCSessionDescriptionInit = {
      sdp: getSDPOfferResponse.sdp,
      type: "offer",
    };

    this.logger.log("P2P: setRemoteDescription");
    await peerConnection.setRemoteDescription(offer);

    this.logger.log("P2P: Подготавливаем ответ на SDP offer");
    const answer = await peerConnection.createAnswer();

    if (!answer.sdp) throw Error("P2P: Не удается подготовить SDP offer");

    this.logger.log("P2P: Ответ на SDP offer:", answer);

    this.logger.log("P2P: Отправляем ответный SDP offer");

    await requestSDPOfferExchangeP2P(app, stream, answer.sdp);

    this.logger.log("P2P: Ответный SDP offer отправлен успешно");

    this.logger.log("P2P: setLocalDescription");
    await peerConnection.setLocalDescription(answer).catch((e) => {
      throw Error(
        `P2P: Не удалось установить Local Description, ошибка: ${JSON.stringify(
          e
        )}`
      );
    });

    this.logger.log("P2P: setLocalDescription установлено");
  }

  public async startTURN(connectionType: TURNConnectionType) {
    this.logger.log("TURN: Начало соединения через TURN");

    this.currentType = connectionType;

    if (!this.peerConnection)
      throw Error("TURN: Live сервис не инициализирован");

    const peerConnection = this.peerConnection;

    await this.prepareTransceivers();

    const { app, stream } = this.options;

    this.logger.log("TURN: Подготавливаем SDP offer");
    const offer = await peerConnection.createOffer();
    this.logger.log("TURN: SDP offer подготовлен: ", offer);

    this.logger.log("TURN: Устанавливаем свой SDP offer");
    await peerConnection.setLocalDescription(offer);

    this.logger.log("TURN: Запрашиваем обмен SDP offer");
    const requestSDPOfferExchangeResponse = await requestSDPOfferExchangeTURN(
      app,
      stream,
      this.currentType,
      offer.sdp!
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
    this.logger.log(
      "TURN: Ответ на обмен SDP offer:",
      requestSDPOfferExchangeResponse
    );

    const answer: RTCSessionDescriptionInit = {
      type: "answer",
      sdp: requestSDPOfferExchangeResponse.sdp,
    };

    this.logger.log("TURN: setRemoteDescription");
    peerConnection.setRemoteDescription(answer);
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
      this.processIceCandidateEvent(event);
    }
  }

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
    this.logger.log(
      "Получен новый Track event, kind:",
      event.track.kind,
      this.peerConnection?.getReceivers()
    );

    if (!this.peerConnection) throw Error("Peer connection отсутствует");

    this._tracks.push(event.track);

    // let videoStats = {
    //   bitrate: 0, // Скорость в кбит/с
    //   // resolution: {
    //   //   width: this. .videoWidth,
    //   //   height: videoElement.videoHeight,
    //   // },
    //   codec: "",
    //   frameRate: 0,
    // };

    // this.peerConnection.getStats().then((stats) => {
    //   stats.forEach((report) => {
    //     console.log("🚀 ~ WebRTCService ~ stats.forEach ~ report:", report);
    //     if (report.type === "inbound-rtp" && report.kind === "video") {
    //       // Рассчитываем скорость
    //       const bytesReceived = report.bytesReceived;
    //       const timestamp = report.timestamp;

    //       // if (window.prevBytesReceived && window.prevTimestamp) {
    //       //   const bitrate =
    //       //     ((bytesReceived - window.prevBytesReceived) * 8) /
    //       //     (timestamp - window.prevTimestamp);
    //       //   videoStats.bitrate = Math.round(bitrate); // в кбит/с
    //       // }

    //       // // Сохраняем для следующего расчета
    //       // window.prevBytesReceived = bytesReceived;
    //       // window.prevTimestamp = timestamp;
    //     }

    //     // Получаем кодек
    //     if (report.type === "codec" && report.mimeType.includes("video")) {
    //       videoStats.codec = report.mimeType;
    //     }

    //     // Получаем количество кадров
    //     if (report.type === "track" && report.kind === "video") {
    //       videoStats.frameRate = report.framesPerSecond || 0;
    //     }
    //   });
    // });

    if (event.streams?.length > 0) {
      this.setSource(event.streams[0]);
    } else if (
      this.peerConnection.getReceivers().length
      // ??? в примере идет проверка равности количества ресиверов и количества треков, но у меня 4 ресивера и 2 трека, понять бы почему
      // == this._tracks.length
    ) {
      this.setSource(new MediaStream(this._tracks));
    } else {
      // ??? хотелось бы понять что это значит
      this.logger.error("wait stream track finish");
    }
  }

  // private async getStats() {
  //   let prevBytesReceived = 0;
  //   let prevTimestamp = 0;

  //   return async () => {
  //     const stats = await this.peerConnection!.getStats();

  //     let videoStats = {
  //       bitrate: 0, // Скорость в кбит/с
  //       resolution: {
  //         width: videoElement.videoWidth,
  //         height: videoElement.videoHeight,
  //       },
  //       codec: "",
  //       frameRate: 0,
  //     };

  //     stats.forEach((report) => {
  //       if (report.type === "inbound-rtp" && report.kind === "video") {
  //         const bytesReceived = report.bytesReceived;
  //         const timestamp = report.timestamp;

  //         if (prevBytesReceived && prevTimestamp) {
  //           const bitrate =
  //             ((bytesReceived - prevBytesReceived) * 8) /
  //             (timestamp - prevTimestamp);
  //           videoStats.bitrate = Math.round(bitrate); // в кбит/с
  //         }

  //         // Обновляем для следующего расчета
  //         prevBytesReceived = bytesReceived;
  //         prevTimestamp = timestamp;
  //       }

  //       // Получаем кодек
  //       if (report.type === "codec" && report.mimeType.includes("video")) {
  //         videoStats.codec = report.mimeType;
  //       }

  //       // Получаем количество кадров
  //       if (report.type === "track" && report.kind === "video") {
  //         videoStats.frameRate = report.framesPerSecond || 0;
  //       }
  //     });

  //     console.log("WebRTC Stats:", videoStats);

  //     return videoStats;
  //   };
  // }

  private _onIceCandidateError(event: RTCPeerConnectionIceErrorEvent) {
    this.logger.error("Ошибка ICE_CANDIDATE_ERROR: ", event);
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
