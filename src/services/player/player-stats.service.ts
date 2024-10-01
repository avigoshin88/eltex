import { Nullable } from "../../types/global";
import { Stats } from "../../types/video";
import { EventBus } from "../event-bus.service";
import { Logger } from "../logger/logger.service";

const trackingStatsInterval = Number(
  import.meta.env.VITE_TRACKING_STATS_INTERVAL
);

if (isNaN(trackingStatsInterval)) {
  throw new Error(
    `VITE_TRACKING_STATS_INTERVAL must be a number. Currently is ${
      import.meta.env.VITE_TRACKING_STATS_INTERVAL
    } `
  );
}

export class PlayerStatsService {
  private readonly logger = new Logger("PlayerStatsService");

  private peerConnection: Nullable<RTCPeerConnection> = null;
  private videoElement: Nullable<HTMLVideoElement> = null;

  private trackingStatsInterval: Nullable<number> = null;

  constructor() {
    this.init();
  }

  private setupPeerConnection(peerConnection: RTCPeerConnection) {
    this.peerConnection = peerConnection;
    this.tryStartTracking();
  }

  private setupVideo(video: HTMLVideoElement) {
    this.videoElement = video;
    this.tryStartTracking();
  }

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

        EventBus.emit("stats", stats);
      } catch (error) {
        this.logger.error("Ошибка получения статистики: ", error);
      }
    }, trackingStatsInterval);
  }

  init() {
    EventBus.on("setup-video", this.setupVideo.bind(this));
    EventBus.on("setup-peerconnection", this.setupPeerConnection.bind(this));
  }

  reset() {
    EventBus.off("setup-video", this.setupVideo.bind(this));
    EventBus.off("setup-peerconnection", this.setupPeerConnection.bind(this));

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
