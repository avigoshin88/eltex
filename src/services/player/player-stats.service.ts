import { Nullable } from "../../types/global";
import { VideoStats } from "../../types/video";

type OnStatUpdate = (stats: Nullable<VideoStats>) => void;

export class PlayerStatsService {
  private height: Nullable<number> = null;
  private width: Nullable<number> = null;

  constructor(video: HTMLVideoElement, onStatUpdate: OnStatUpdate) {
    this.setup(video, onStatUpdate);
  }

  get stats(): VideoStats | null {
    if (this.height === null || this.width === null) {
      return null;
    }

    return {
      height: this.height,
      width: this.width,
    };
  }

  private setup(video: HTMLVideoElement, onStatUpdate: OnStatUpdate) {
    video.onloadedmetadata = () => {
      this.height = video.videoHeight;
      this.width = video.videoWidth;

      onStatUpdate(this.stats);
    };
  }
}
