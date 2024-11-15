import { Nullable } from "../../types/global";
import { Stats } from "../../types/video";
import { EnvService } from "../env.service";
import { EventBus } from "../event-bus.service";
import { Logger } from "../logger/logger.service";

const trackingStatsInterval = EnvService.getENVAsNumber(
  "VITE_TRACKING_STATS_INTERVAL"
);

export class PlayerStatsService {
  private logger: Logger;
  private eventBus: EventBus;

  private peerConnection: Nullable<RTCPeerConnection> = null;
  private videoElement: Nullable<HTMLVideoElement> = null;

  private trackingStatsInterval: Nullable<number> = null;

  constructor(private id: string) {
    this.eventBus = EventBus.getInstance(this.id);
    this.logger = new Logger(id, "PlayerStatsService");
  }

  private setupPeerConnection = (peerConnection: RTCPeerConnection) => {
    this.peerConnection = peerConnection;
    this.tryStartTracking();
  };

  private setupVideo = (video: HTMLVideoElement) => {
    this.videoElement = video;
    this.tryStartTracking();
  };

  tryStartTracking() {
    this.logger.log(
      "debug",
      "Пробуем начать отслеживание изменения статистики"
    );

    if (!this.videoElement || !this.peerConnection) {
      this.logger.error(
        "debug",
        "Не удается начать отслеживание изменения статистики, соединение и/или видео элемент отсутствуют"
      );

      return;
    }

    this.startTracking();
  }

  private async startTracking() {
    this.logger.log("debug", "Начинаем отслеживание изменения статистики");

    if (this.trackingStatsInterval) {
      this.logger.log(
        "debug",
        "Отслеживание было запущено ранее, удаляем старое"
      );

      clearInterval(this.trackingStatsInterval);
      this.trackingStatsInterval = null;
    }

    const trackWebRTCStats = this.createWebRTCStatsTracker(
      this.peerConnection!,
      this.videoElement!
    );

    await this.updateStats(trackWebRTCStats);

    this.trackingStatsInterval = setInterval(() => {
      this.updateStats(trackWebRTCStats);
    }, trackingStatsInterval);

    this.logger.log("debug", "Отслеживание изменения статистики запущено");
  }

  init() {
    this.logger.log("debug", "Инициализация сервиса статистики");

    this.eventBus.on("setup-video", this.setupVideo);
    this.eventBus.on("setup-peerconnection", this.setupPeerConnection);
  }

  reset() {
    this.logger.log("debug", "Обнуляем сервис статистики");

    this.eventBus.off("setup-video", this.setupVideo);
    this.eventBus.off("setup-peerconnection", this.setupPeerConnection);

    this.peerConnection = null;
    this.videoElement = null;

    if (this.trackingStatsInterval !== null) {
      clearInterval(this.trackingStatsInterval);
    }

    this.logger.log("debug", "Сервис статистики обнулен");
  }

  private async updateStats(trackWebRTCStats: () => Promise<Stats>) {
    this.logger.log("trace", "Обновляем статистику");

    try {
      const stats = await trackWebRTCStats();

      this.logger.log("trace", `Новая статистика: ${JSON.stringify(stats)}`);

      this.eventBus.emit("current-video-codec", stats.videoCodec);

      this.eventBus.emit("stats", stats);
    } catch (error) {
      this.logger.error("trace", "Ошибка получения статистики: ", error);
    }
  }

  private createWebRTCStatsTracker(
    peerConnection: RTCPeerConnection,
    videoElement: HTMLVideoElement
  ) {
    this.logger.log("debug", "Создаем трекер статистики");

    let prevBytesReceived: number = 0;
    let prevTimestamp: number = 0;

    return async function getWebRTCStats(): Promise<Stats> {
      const stats = await peerConnection.getStats();

      let videoStats: Stats = {
        bitrate: 0,
        resolution: {
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
        },
        videoCodec: "",
        audioCodec: "",
        frameRate: 0,
      };

      stats.forEach((report) => {
        if (report.type === "inbound-rtp" && report.kind === "video") {
          const bytesReceived = report.bytesReceived;
          const timestamp = report.timestamp;

          if (prevBytesReceived && prevTimestamp) {
            const bitrate =
              (((bytesReceived - prevBytesReceived) * 8) /
                (timestamp - prevTimestamp)) *
              1000;
            videoStats.bitrate = Math.round(bitrate); // в кбит/с
          }

          prevBytesReceived = bytesReceived;
          prevTimestamp = timestamp;

          if (report.framesPerSecond) {
            videoStats.frameRate = report.framesPerSecond;
          }
        }

        if (report.type === "codec" && report.mimeType.includes("video")) {
          videoStats.videoCodec = report.mimeType;
        }

        if (report.type === "codec" && report.mimeType.includes("audio")) {
          videoStats.audioCodec = report.mimeType;
        }
      });

      return videoStats;
    };
  }
}
