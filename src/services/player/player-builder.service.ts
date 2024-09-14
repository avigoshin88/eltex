export class VideoPlayerBuilderService {
  createPlayer() {
    const container = this.createContainer();

    const video = document.createElement("video");
    video.controls = false;
    video.autoplay = true;
    video.preload = "none";
    video.muted = true;
    video.id = `video-player-${Math.random() * 100}`;
    video.style.width = "100%";

    container.appendChild(video);

    return { container, video };
  }

  private createContainer() {
    const container = document.createElement("div");

    container.style.position = "relative";
    container.style.width = "100%";

    return container;
  }
}
