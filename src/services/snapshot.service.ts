import { Logger } from "./logger/logger.service";

type SnapConfig = {
  download?: boolean;
  title?: string;
};

const defaultSnapConfig: SnapConfig = {
  download: true,
  title: "snapshot",
};

export class SnapshotService {
  private logger: Logger;

  constructor(id: string) {
    this.logger = new Logger(id, "SnapshotService");
  }

  snap(
    snapWidth: number,
    snapHeight: number,
    video: HTMLVideoElement,
    meta?: HTMLCanvasElement,
    {
      download = defaultSnapConfig.download,
      title = defaultSnapConfig.title,
    }: SnapConfig = defaultSnapConfig
  ) {
    this.logger.log("debug", "Делаем скриншот");

    const canvas = window.document.createElement("canvas");
    canvas.width = snapWidth;
    canvas.height = snapHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      this.logger.warn("debug", "Скриншот невозможен: контекст не определен");
      return;
    }

    context.fillRect(0, 0, snapWidth, snapHeight);
    context.drawImage(video, 0, 0, snapWidth, snapHeight);
    meta && context.drawImage(meta, 0, 0, snapWidth, snapHeight);

    let dataURI = canvas.toDataURL("image/jpeg");

    if (download) {
      const downloadLink = document.createElement("a");

      downloadLink.href = dataURI;
      downloadLink.download = `${title}.jpg`;
      downloadLink.click();

      return;
    }

    return dataURI;
  }
}
