export class VideoPlayerService {
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
    this.video.preload = "none";
    this.video.play();
  }

  pause() {
    this.video.pause();
  }
}
