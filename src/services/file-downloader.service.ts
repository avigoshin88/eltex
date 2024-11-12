import { Logger } from "./logger/logger.service";

export class FileDownloader {
  private logger: Logger;

  constructor(id: string) {
    this.logger = new Logger(id, "FileDownloader");
  }

  download(url: string, filename?: string) {
    const a = document.createElement("a");

    a.target = "_blank";
    a.href = url;
    a.download = filename || new Date().toLocaleString();

    a.click();
  }
}
