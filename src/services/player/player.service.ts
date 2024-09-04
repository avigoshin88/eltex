import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";

export class VideoPlayerService {
  container!: HTMLDivElement;
  video!: HTMLVideoElement;
  // player!: Player;

  init(container: HTMLDivElement, video: HTMLVideoElement) {
    this.container = container;
    this.video = video;
    // this.player = videojs(video);
  }

  play() {
    this.video.play();
  }

  pause() {
    this.video.pause();
  }
}
