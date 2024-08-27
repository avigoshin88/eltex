import {
  Candidate,
  getSDPOffer,
  requestPutCandidate,
  requestSDPOfferExchangeTURN,
  requestSDPOfferExchangeP2P,
} from "./api/live";
import { Logger } from "./logger/logger.service";

type Options = {
  playerElement: HTMLVideoElement;
  app: string;
  stream: string;
  config: RTCConfiguration;
};

export class LiveVideoService {
  private logger = new Logger(LiveVideoService.name);

  private peerConnection: RTCPeerConnection | null = null;
  private options!: Options;
  private currentType: null | "p2p_play" | "play" = null;
  private _remoteStream?: MediaStream;
  private _tracks: MediaStreamTrack[] = [];

  constructor(options: Options) {
    this.options = { ...options };
  }

  init() {
    this.setupPeerConnection();

    this.startP2P().catch((p2pError: Error) => {
      this.logger.error(
        "Не удается установить соединение через P2P, причина:",
        p2pError.message
      );

      this.logger.log("Пробуем соединиться через TURN");
      this.resetService();
      this.setupPeerConnection();

      this.startTURN().catch((turnError: Error) => {
        this.logger.error(
          "Не удается установить соединение через TURN, причина:",
          turnError.message
        );
      });
    });
  }

  private setupPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.options.config);

    this.peerConnection.onicecandidate = this._onIceCandidate.bind(this);
    this.peerConnection.onicecandidateerror =
      this._onIceCandidateError.bind(this);
    this.peerConnection.ontrack = this._onTrack.bind(this);
    this.peerConnection.onconnectionstatechange =
      this._onConnectionStateChange.bind(this);
  }

  private async startP2P() {
    this.logger.log("P2P: Начало соединения через P2P");

    this.currentType = "p2p_play";

    if (!this.peerConnection)
      throw Error("P2P: Live сервис не инициализирован");

    const peerConnection = this.peerConnection;

    // ??? Прием аудио/видео сигнала работает и без этого, но в примере это есть. Зачем? Но оно используется при TURN соединении, возможно здесь можно убрать
    // ??? should 'recvonly' audio direction be changed to enable audio sending?
    // const AudioTransceiverInit: RTCRtpTransceiverInit = {
    //   direction: "recvonly",
    //   sendEncodings: [],
    // };
    // const VideoTransceiverInit: RTCRtpTransceiverInit = {
    //   direction: "recvonly",
    //   sendEncodings: [],
    // };

    // this.peerConnection.addTransceiver("audio", AudioTransceiverInit);
    // this.peerConnection.addTransceiver("video", VideoTransceiverInit);

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

  private async startTURN() {
    this.logger.log("TURN: Начало соединения через TURN");

    this.currentType = "play";

    if (!this.peerConnection)
      throw Error("TURN: Live сервис не инициализирован");

    const peerConnection = this.peerConnection;

    this.logger.log("TURN: Подготавливаем данные о трансиверах");
    // ??? should 'recvonly' audio direction be changed to enable audio sending?
    const AudioTransceiverInit: RTCRtpTransceiverInit = {
      direction: "recvonly",
      sendEncodings: [],
    };
    const VideoTransceiverInit: RTCRtpTransceiverInit = {
      direction: "recvonly",
      sendEncodings: [],
    };

    this.logger.log("TURN: Добавляем трансиверы");
    this.peerConnection.addTransceiver("audio", AudioTransceiverInit);
    this.peerConnection.addTransceiver("video", VideoTransceiverInit);
    this.logger.log("TURN: Трансиверы добавлены");

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

  private _onIceCandidate(event: RTCPeerConnectionIceEvent) {
    if (event.candidate) {
      this.logger.log(
        "Удаленный ICE candidate: \n " + event.candidate.candidate
      );
      this.processIceCandidateEvent(event);
    }
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
    this.logger.log("Получен новый Track event", event.track);

    if (!this.peerConnection) throw Error("Peer connection отсутствует");

    this._tracks.push(event.track);

    if (this.options.playerElement && event.streams?.length > 0) {
      this.options.playerElement.srcObject = event.streams[0];
      this._remoteStream = event.streams[0];
    } else if (
      this.peerConnection.getReceivers().length
      // ??? в примере идет проверка равности количества ресиверов и количества треков, но у меня 4 ресивера и 2 трека, понять бы почему
      // == this._tracks.length
    ) {
      this._remoteStream = new MediaStream(this._tracks);
      this.options.playerElement.srcObject = this._remoteStream;
    } else {
      // ??? хотелось бы понять что это значит
      this.logger.error("wait stream track finish");
    }
  }

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

  resetService() {
    this.logger.log("Начало очистки сервиса");

    this.peerConnection
      ?.getTransceivers()
      .forEach((transceiver) => transceiver.stop());

    this.peerConnection?.close();
    this._remoteStream = undefined;
    this._tracks = [];
    this.currentType = null;
    this.peerConnection = null;

    this.logger.log("Сервис очищен");
  }
}
