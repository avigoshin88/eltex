import { Logger } from "../logger/logger.service";
import { VideoPlayerBuilderService } from "./player-builder.service";

export class VideoPlayerService {
  private logger: Logger;
  builder: VideoPlayerBuilderService;
  container!: HTMLDivElement;
  videoContainer!: HTMLDivElement;
  video!: HTMLVideoElement;
  private placeholder: HTMLDivElement | undefined;

  isPlaying = true;
  isVolumeOn = false;
  cameraName = "";

  constructor(id: string) {
    this.builder = new VideoPlayerBuilderService(id);
    this.logger = new Logger(id, "VideoPlayerService");
  }

  init(cameraName: string) {
    this.logger.log(
      "debug",
      `Инициализируем плеер сервис, имя камеры ${cameraName}`
    );
    this.cameraName = cameraName;

    const { container, videoContainer, video, placeholder } =
      this.builder.createPlayer(this.cameraName);

    this.container = container;
    this.videoContainer = videoContainer;
    this.placeholder = placeholder;

    this.video = video;

    return { container };
  }

  setSource(
    stream: MediaStream,
    onStartPlay?: (video: HTMLVideoElement) => void
  ) {
    this.logger.log("debug", "Устанавливаем стрим в качестве источника видео");

    if (stream.getVideoTracks().length === 0) {
      this.logger.log("debug", "Видеопоток отсутствует");
      return;
    }

    if (this.video.srcObject) {
      this.logger.log(
        "debug",
        "Источник был установлен ранее, создаем новый видеоэлемент для бесшовной замены потока"
      );

      const videoElement = this.builder.createVideoElement(this.cameraName);
      videoElement.srcObject = stream;

      const onPlay = () => {
        videoElement.onplaying = null;
        videoElement.muted = this.video.muted;
        videoElement.volume = this.video.volume;
        videoElement.playbackRate = this.video.playbackRate;
        this.videoContainer.replaceChild(videoElement, this.video);
        this.video = videoElement;
        onStartPlay?.(videoElement);
        this.logger.log(
          "debug",
          "Видеоэлемент был заменен на новый с новым потоком"
        );
      };

      videoElement.onplaying = onPlay;
      videoElement.play();
    } else {
      this.video.srcObject = stream;
      this.logger.log("debug", "Источник был установлен");
    }
  }

  play() {
    this.logger.log("trace", "Запуск воспроизведения видео");

    this.video.play();

    this.isPlaying = true;
  }

  pause() {
    this.logger.log("trace", "Ставим видео на паузу");

    this.video.pause();

    this.isPlaying = false;
  }

  volumeOn() {
    this.logger.log("trace", "Включаем звук видео элемента");

    this.video.muted = false;

    this.isVolumeOn = true;
  }

  volumeMute() {
    this.logger.log("trace", "Выключаем звук видео элемента (ставим мьют)");

    this.video.muted = true;

    this.isVolumeOn = false;
  }

  setVolume(volume: number) {
    this.logger.log("trace", `Устанавливаем громкость равную ${volume}`);

    if (volume > 1) this.video.volume = 1;
    else if (volume < 0) this.video.volume = 0;
    else this.video.volume = volume;
  }

  togglePlaceholder(on: boolean) {
    this.logger.log(
      "trace",
      `${on ? "Включаем" : "Выключаем"} отображение заглушки`
    );

    if (this.placeholder) {
      this.placeholder.style.visibility = on ? "visible" : "hidden";
    } else {
      this.logger.error(
        "trace",
        "Заглушка отсутствует, не удается изменить состояние"
      );
    }
  }
}
