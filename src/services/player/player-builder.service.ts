export class VideoPlayerBuilderService {
  createPlayer() {
    const container = this.createContainer();

    const video = document.createElement("video");

    container.appendChild(video);

    return { container, video };
  }

  private createContainer() {
    const container = document.createElement("div");

    return container;
  }
}
