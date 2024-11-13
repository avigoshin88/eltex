import { Logger } from "../logger/logger.service";

export class VideoPlayerBuilderService {
  private logger: Logger;

  constructor(id: string) {
    this.logger = new Logger(id, "VideoPlayerBuilderService");
  }

  createPlayer(name: string) {
    this.logger.log(
      "debug",
      "Создаем компоненты плеера: контейнер, контейнер для видео, видеоэлемент, заглушка"
    );

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
    this.logger.log("debug", "Создаем элемент заглушки");

    const container = document.createElement("div");

    container.className = "video-player__placeholder-container";

    const text = document.createElement("p");

    text.innerHTML = name;
    text.className = "video-player__placeholder-text";

    container.appendChild(text);

    return container;
  }

  public createVideoElement(name: string) {
    this.logger.log("debug", "Создаем видеоэлемент");

    const video = document.createElement("video");

    video.controls = false;
    video.autoplay = true;
    video.preload = "none";
    video.playbackRate = 1.0;
    video.muted = true;
    video.id = `video-player-${name}-${Math.random() * 100}`;
    video.className = "video-player__video-element";

    return video;
  }

  private createVideoContainer() {
    this.logger.log("debug", "Создаем видео контейнер");

    const container = document.createElement("div");

    container.className = "video-player__container";

    return container;
  }

  private createContainer() {
    this.logger.log("debug", "Создаем элемент контейнера");

    const container = document.createElement("div");

    container.className = "video-player";

    return container;
  }
}
