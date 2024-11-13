import { Nullable } from "../../../types/global";
import { EventBus } from "../../event-bus.service";
import { Logger } from "../../logger/logger.service";
import { WebRTCService } from "../../webrtc.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RTP_TIMESTAMP = 2 ** 32;

const NEW_FRAGMENT_PACKAGE_DIFFERENCE = 10 * 1000;
const RESET_PACKAGE_DIFFERENCE = 10 * 1000;

export class ArchiveTimeControlService {
  private logger: Logger;

  private eventBus: EventBus;
  private currentCodec: Nullable<string> = null;

  private fragmentStartTimestamp = 0;

  public isWaitingForNewFragment = false;

  private startTimestamp = 0;
  private offset = 0;

  private prevRTPTimestamp: number = 0;

  private rate = 0;
  private rtpMaxTimestampMs = 0;

  private speed: number = 1;

  private isIgnorePackets = false;

  constructor(id: string, private webRTCClient: WebRTCService) {
    this.eventBus = EventBus.getInstance(id);
    this.logger = new Logger(id, "ArchiveTimeControlService");

    this.setupListeners();
  }

  setSpeed(speed: number) {
    this.logger.log("trace", `Устанавливаем скорость ${speed}`);
    this.speed = speed;
  }

  setFragmentStartTimestamp(fragmentStartTimestamp: number) {
    this.logger.log(
      "trace",
      `Устанавливаем начальный таймстемп фрагмента:`,
      fragmentStartTimestamp
    );

    this.isIgnorePackets = false;
    this.isWaitingForNewFragment = true;
    this.fragmentStartTimestamp = fragmentStartTimestamp;
  }

  ignorePackets() {
    this.logger.log("trace", `Пропускаем пакеты`);
    this.isIgnorePackets = true;
  }

  public async calculate() {
    const sources = this.getSynchronizationSources();

    if (sources === undefined) {
      return 0;
    }

    if (this.fragmentStartTimestamp === 0) {
      return 0;
    }

    const { rtpTimestamp } = sources;

    if (this.rate === 0) {
      return this.fragmentStartTimestamp;
    }

    this.logger.log("trace", "Текущий полученный rtpTimestamp:", rtpTimestamp);

    if (this.isIgnorePackets) {
      this.prevRTPTimestamp = rtpTimestamp;
      return;
    }

    const oldOffset = this.offset;

    if (this.isWaitingForNewFragment) {
      const expectedRTPTimestamp = this.getExpectedRTPTimestamp(
        this.fragmentStartTimestamp,
        this.rate
      );

      this.logger.log("trace", `Ожидаемый rtpTimestamp:`, expectedRTPTimestamp);

      if (
        Math.abs(expectedRTPTimestamp - rtpTimestamp) <
        NEW_FRAGMENT_PACKAGE_DIFFERENCE * this.rate * this.speed
      ) {
        this.startTimestamp = this.getBaseTimestamp(
          this.fragmentStartTimestamp
        );

        this.logger.log(
          "trace",
          `Новый пакет: startTimestamp=`,
          this.startTimestamp
        );

        this.isWaitingForNewFragment = false;
      }
    } else if (
      rtpTimestamp < this.prevRTPTimestamp &&
      Math.abs(rtpTimestamp - this.prevRTPTimestamp) >
        RESET_PACKAGE_DIFFERENCE * this.rate * this.speed
    ) {
      this.startTimestamp = this.getNextBaseTimestamp(this.startTimestamp);

      this.logger.log(
        "trace",
        `Сброс: rtpTimestamp= ${rtpTimestamp} prevRTPTimestamp= ${this.prevRTPTimestamp} startTimestamp= ${this.startTimestamp}`
      );

      this.offset = this.rtpTimestampToTimestamp(rtpTimestamp);

      this.logger.log(
        "trace",
        `Изменение отступа: offset= ${this.offset} oldOffset= ${oldOffset}`
      );
    } else {
      this.offset = this.rtpTimestampToTimestamp(rtpTimestamp);

      this.logger.log(
        "trace",
        `Обычное изменение отступа: offset= ${this.offset} oldOffset= ${oldOffset}`
      );
    }

    this.prevRTPTimestamp = rtpTimestamp;
  }

  public getCurrentTimestamp() {
    this.logger.log(
      "trace",
      `Текущий Timestamp: ${new Date(
        this.startTimestamp + this.offset
      ).toUTCString()} start= ${new Date(
        this.startTimestamp
      ).toUTCString()} offset= ${this.offset}`
    );

    return this.startTimestamp + this.offset;
  }

  public reset() {
    this.logger.log("trace", `Обнуляем сервис`);

    this.fragmentStartTimestamp = 0;

    this.startTimestamp = 0;
    this.prevRTPTimestamp = 0;

    this.rate = 0;
    this.rtpMaxTimestampMs = 0;

    this.currentCodec = null;
    this.clearListeners();
  }

  private init() {
    this.logger.log("trace", `Инициализация сервиса`);

    const { local } = this.webRTCClient.getOffers();

    if (!local) {
      return;
    }

    const rate = this.getDiscretizationRTPRate(local);

    if (!rate) {
      return;
    }

    this.rate = rate / 1000;
    this.rtpMaxTimestampMs = this.rtpTimestampToTimestamp(MAX_RTP_TIMESTAMP);
  }

  private getExpectedRTPTimestamp(currentTimestamp: number, rate: number) {
    return (currentTimestamp - this.getBaseTimestamp(currentTimestamp)) * rate;
  }

  private getBaseTimestamp(currentTimestamp: number) {
    const dayStartOffset = currentTimestamp % DAY_MS;
    const dayStartTimestamp = currentTimestamp - dayStartOffset;

    const t = Math.floor(dayStartOffset / this.rtpMaxTimestampMs);

    return (
      dayStartTimestamp + this.rtpTimestampToTimestamp(t * MAX_RTP_TIMESTAMP)
    );
  }

  private getNextBaseTimestamp(currentBaseTimestamp: number) {
    const t = currentBaseTimestamp % DAY_MS;

    if (t + this.rtpMaxTimestampMs > DAY_MS) {
      return currentBaseTimestamp + DAY_MS - t;
    } else {
      return currentBaseTimestamp + this.rtpMaxTimestampMs;
    }
  }

  private rtpTimestampToTimestamp(rtpTimestamp: number) {
    return rtpTimestamp / this.rate;
  }

  private getSynchronizationSources() {
    return this.webRTCClient
      .getPeerConnection()
      ?.getReceivers()
      .filter((receiver) => receiver.track.kind === "video")
      .flatMap((item) => item.getSynchronizationSources())
      .find((sources) => sources.rtpTimestamp);
  }

  async getRemoteTimestamp() {
    const stats =
      (await this.webRTCClient.getPeerConnection()?.getStats()) ?? [];

    let remoteTimestamp = 0;

    stats.forEach((report) => {
      if (report.type === "remote-outbound-rtp" && report.kind === "video") {
        remoteTimestamp = report.remoteTimestamp;
      }
    });

    return remoteTimestamp;
  }

  private getDiscretizationRTPRate(offer: string) {
    if (!this.currentCodec) {
      return 90000;
    }

    const lines = offer.split("\n");
    for (const line of lines) {
      if (line.startsWith("a=rtpmap:")) {
        const parts = line.split(" ");
        const codecInfo = parts[1];
        const [name, clockRate] = codecInfo.split("/");

        // Сравниваем имя кодека
        if (name.toLowerCase() === this.currentCodec.toLowerCase()) {
          return parseInt(clockRate, 10);
        }
      }
    }

    return 1;
  }

  private setCurrentVideoCodec = (codec: string) => {
    if (!codec) {
      return;
    }

    this.currentCodec = codec.replace("video/", "");
    this.init();
  };

  private setupListeners() {
    this.eventBus.on("current-video-codec", this.setCurrentVideoCodec);
  }

  private clearListeners() {
    this.eventBus.off("current-video-codec", this.setCurrentVideoCodec);
  }
}
