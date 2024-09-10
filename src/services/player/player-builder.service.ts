export class VideoPlayerBuilderService {
  createPlayer() {
    const container = this.createContainer();

    const video = document.createElement("video");
    video.controls = true;
    video.autoplay = false;
    video.muted = true;
    video.id = `video-player-${Math.random() * 100}`;

    container.appendChild(video);

    return { container, video };
  }

  private createContainer() {
    const container = document.createElement("div");

    container.style.position = "relative";

    return container;
  }
}
