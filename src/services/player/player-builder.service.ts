export class VideoPlayerBuilderService {
  createPlayer(name: string) {
    const container = this.createContainer();
    const videoContainer = this.createVideoContainer();
    const video = this.createVideoElement(name);
    const placeholder = this.createPlaceholder(name);

    videoContainer.appendChild(video);
    container.appendChild(videoContainer);
    videoContainer.appendChild(placeholder);

    return { container, videoContainer, video, placeholder };
  }

  private createPlaceholder(name: string) {
    const container = document.createElement("div");

    container.className = "video-player__placeholder-container";

    const text = document.createElement("p");

    text.innerHTML = name;
    text.className = "video-player__placeholder-text";

    container.appendChild(text);

    return container;
  }

  public createVideoElement(name: string) {
    const video = document.createElement("video");

    video.controls = false;
    video.autoplay = true;
    video.preload = "none";
    video.muted = true;
    video.id = `video-player-${name}-${Math.random() * 100}`;
    video.className = "video-player__video-element";

    return video;
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
