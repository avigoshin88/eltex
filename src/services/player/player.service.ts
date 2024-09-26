import { Nullable } from "../../types/global";
import { Logger } from "../logger/logger.service";

export class VideoPlayerService {
  private readonly logger = new Logger(VideoPlayerService.name);

  container!: HTMLDivElement;
  videoContainer!: HTMLDivElement;
  video!: HTMLVideoElement;

  isPlaying = true;
  isVolumeOn = true;

  init(
    container: HTMLDivElement,
    videoContainer: HTMLDivElement,
    video: HTMLVideoElement
  ) {
    this.container = container;
    this.videoContainer = videoContainer;
    this.video = video;
  }

  setSource(stream: MediaStream) {
    this.video.srcObject = stream;
  }

  play() {
    const stream = this.video.srcObject as Nullable<MediaStream>;

    if (!stream) {
      this.logger.warn("Нельзя запустить поток: потока не существует");

      return;
    }

    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      track.enabled = true;
    });

    this.video.play();

    this.isPlaying = true;
  }

  pause() {
    const stream = this.video.srcObject as Nullable<MediaStream>;

    if (!stream) {
      this.logger.warn("Нельзя остановить поток: потока не существует");

      return;
    }

    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      track.enabled = false;
    });

    this.video.pause();

    this.isPlaying = false;
  }

  volumeOn() {
    const stream = this.video.srcObject as Nullable<MediaStream>;

    if (!stream) {
      this.logger.warn("Нельзя включить звук потока: потока не существует");

      return;
    }

    const tracks = stream.getAudioTracks();
    tracks.forEach((track) => {
      track.enabled = true;
    });

    this.isVolumeOn = true;
  }

  volumeMute() {
    const stream = this.video.srcObject as Nullable<MediaStream>;

    if (!stream) {
      this.logger.warn("Нельзя выключить звук потока: потока не существует");

      return;
    }

    const tracks = stream.getAudioTracks();
    tracks.forEach((track) => {
      track.enabled = true;
    });

    this.isVolumeOn = false;
  }

  destroy() {
    document.removeChild(this.container);
  }
}
