export class VideoPlayerBuilderService {
  createPlayer() {
    const container = this.createContainer();

    const video = document.createElement("video");
    video.controls = true;
    video.autoplay = true;
    video.muted = true;
    video.id = `video-player-${Math.random() * 100}`;

    container.appendChild(video);

    return { container, video };
  }

  private createContainer() {
    const container = document.createElement("div");

    return container;
  }
}
