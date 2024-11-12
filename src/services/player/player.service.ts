import { Logger } from "../logger/logger.service";
import { VideoPlayerBuilderService } from "./player-builder.service";

export class VideoPlayerService {
  private logger: Logger | undefined;
  builder: VideoPlayerBuilderService;
  container!: HTMLDivElement;
  videoContainer!: HTMLDivElement;
  video!: HTMLVideoElement;
  private placeholder: HTMLDivElement | undefined;

  isPlaying = true;
  isVolumeOn = false;
  cameraName = "";

  constructor(id: string) {
    this.builder = new VideoPlayerBuilderService(id);
    this.logger = new Logger(id, "VideoPlayerService");
  }

  init(cameraName: string) {
    this.cameraName = cameraName;

    const { container, videoContainer, video, placeholder } =
      this.builder.createPlayer(this.cameraName);

    this.container = container;
    this.videoContainer = videoContainer;
    this.placeholder = placeholder;

    this.video = video;

    return { container };
  }

  setSource(
    stream: MediaStream,
    onStartPlay?: (video: HTMLVideoElement) => void
  ) {
    if (stream.getVideoTracks().length === 0) return;

    if (this.video.srcObject) {
      const videoElement = this.builder.createVideoElement(this.cameraName);
      videoElement.srcObject = stream;

      const onPlay = () => {
        videoElement.onplaying = null;
        videoElement.muted = this.video.muted;
        videoElement.volume = this.video.volume;
        videoElement.playbackRate = this.video.playbackRate;
        this.videoContainer.replaceChild(videoElement, this.video);
        this.video = videoElement;
        onStartPlay?.(videoElement);
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

  togglePlaceholder(on: boolean) {
    if (this.placeholder)
      this.placeholder.style.visibility = on ? "visible" : "hidden";
  }
}
