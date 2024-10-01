import { EventBus } from "../event-bus.service";
import { Logger } from "../logger/logger.service";

export class VideoPlayerService {
  private readonly logger = new Logger(VideoPlayerService.name);

  container!: HTMLDivElement;
  videoContainer!: HTMLDivElement;
  video!: HTMLVideoElement;

  isPlaying = true;
  isVolumeOn = false;

  init(
    container: HTMLDivElement,
    videoContainer: HTMLDivElement,
    video: HTMLVideoElement
  ) {
    this.container = container;
    this.videoContainer = videoContainer;

    EventBus.emit("setup-video", video);

    this.video = video;
  }

  setSource(stream: MediaStream) {
    this.video.srcObject = stream;
  }

  play() {
    this.video.play();

    this.isPlaying = true;
  }

  pause() {
    this.video.pause();

    this.isPlaying = false;
  }

  volumeOn() {
    this.video.muted = false;

    this.isVolumeOn = true;
  }

  volumeMute() {
    this.video.muted = true;

    this.isVolumeOn = false;
  }

  setVolume(volume: number) {
    if (volume > 1) this.video.volume = 1;
    else if (volume < 0) this.video.volume = 0;
    else this.video.volume = volume;
  }

  destroy() {
    document.removeChild(this.container);
  }
}
