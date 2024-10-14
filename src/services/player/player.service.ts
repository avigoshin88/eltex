import { EventBus } from "../event-bus.service";
import { VideoPlayerBuilderService } from "./player-builder.service";

export class VideoPlayerService {
  builder = new VideoPlayerBuilderService();
  container!: HTMLDivElement;
  videoContainer!: HTMLDivElement;
  video!: HTMLVideoElement;

  isPlaying = true;
  isVolumeOn = false;

  init() {
    const { container, videoContainer, video } = this.builder.createPlayer();

    this.container = container;
    this.videoContainer = videoContainer;

    EventBus.emit("setup-video", video);

    this.video = video;

    return { container };
  }

  setSource(stream: MediaStream) {
    if (stream.getVideoTracks().length === 0) return;

    if (this.video.srcObject) {
      const videoElement = this.builder.createVideoElement();
      videoElement.srcObject = stream;

      const onPlay = () => {
        videoElement.onplaying = null;
        this.videoContainer.replaceChild(videoElement, this.video);
        this.video = videoElement;
      };

      videoElement.onplaying = onPlay;
      videoElement.play();
    } else {
      this.video.srcObject = stream;
    }
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
