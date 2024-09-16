export class VideoPlayerBuilderService {
  createPlayer() {
    const container = this.createContainer();
    const videoContainer = this.createVideoContainer();

    const video = document.createElement("video");
    video.controls = false;
    video.autoplay = true;
    video.preload = "none";
    video.muted = true;
    video.id = `video-player-${Math.random() * 100}`;
    video.style.width = "100%";

    videoContainer.appendChild(video);
    container.appendChild(videoContainer);

    return { container, videoContainer, video };
  }

  private createVideoContainer() {
    const container = document.createElement("div");

    container.className = "video-player__container";

    return container;
  }

  private createContainer() {
    const container = document.createElement("div");

    container.className = "video-player";

    return container;
  }
}
