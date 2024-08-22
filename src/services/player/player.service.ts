import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";

export class VideoPlayerService {
  player!: Player;

  init(video: HTMLVideoElement) {
    this.player = videojs(video);
  }

  play() {
    this.player.play();
  }

  pause() {
    this.player.pause();
  }
}
