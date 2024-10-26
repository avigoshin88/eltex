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
  private readonly logger = new Logger(SnapshotService.name);

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
    const canvas = window.document.createElement("canvas");
    canvas.width = snapWidth;
    canvas.height = snapHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      this.logger.warn("info", "Скриншот невозможен: контекст не определен");
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
