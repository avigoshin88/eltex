import { Nullable } from "../../types/global";
import { Stats } from "../../types/video";
import { EnvService } from "../env.service";
import { EventBus } from "../event-bus.service";
import { Logger } from "../logger/logger.service";

const trackingStatsInterval = EnvService.getENVAsNumber(
  "VITE_TRACKING_STATS_INTERVAL"
);

export class PlayerStatsService {
  private readonly logger = new Logger("PlayerStatsService");
  private eventBus: EventBus;

  private peerConnection: Nullable<RTCPeerConnection> = null;
  private videoElement: Nullable<HTMLVideoElement> = null;

  private trackingStatsInterval: Nullable<number> = null;

  constructor(private id: string) {
    this.eventBus = EventBus.getInstance(this.id);
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
    if (!this.videoElement || !this.peerConnection) {
      return;
    }

    this.startTracking();
  }

  private startTracking() {
    const trackWebRTCStats = this.createWebRTCStatsTracker(
      this.peerConnection!,
      this.videoElement!
    );

    this.trackingStatsInterval = setInterval(async () => {
      try {
        const stats = await trackWebRTCStats();

        this.eventBus.emit("stats", stats);
      } catch (error) {
        this.logger.error("info", "Ошибка получения статистики: ", error);
      }
    }, trackingStatsInterval);
  }

  init() {
    this.eventBus.on("setup-video", this.setupVideo);
    this.eventBus.on("setup-peerconnection", this.setupPeerConnection);
  }

  reset() {
    this.eventBus.off("setup-video", this.setupVideo);
    this.eventBus.off("setup-peerconnection", this.setupPeerConnection);

    this.peerConnection = null;
    this.videoElement = null;

    if (this.trackingStatsInterval !== null) {
      clearInterval(this.trackingStatsInterval);
    }
  }

  private createWebRTCStatsTracker(
    peerConnection: RTCPeerConnection,
    videoElement: HTMLVideoElement
  ) {
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
