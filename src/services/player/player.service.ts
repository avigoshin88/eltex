import { Logger } from "../logger/logger.service";

export class VideoPlayerService {
  private readonly logger = new Logger(VideoPlayerService.name);

  container!: HTMLDivElement;
  video!: HTMLVideoElement;

  init(container: HTMLDivElement, video: HTMLVideoElement) {
    this.container = container;
    this.video = video;
  }

  setSource(stream: MediaStream) {
    this.video.srcObject = stream;
  }

  play() {
    const stream = this.video.srcObject as MediaStream | null;

    if (!stream) {
      this.logger.warn("Нельзя запустить поток, тк его не существует");

      return;
    }

    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      track.enabled = true;
    });

    this.video.play();
  }

  stop() {
    const stream = this.video.srcObject as MediaStream | null;

    if (!stream) {
      this.logger.warn("Нельзя остановить поток, тк его не существует");

      return;
    }

    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      track.enabled = true;
    });

    this.video.pause();
  }
}
