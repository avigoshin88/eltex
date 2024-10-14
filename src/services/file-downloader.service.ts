export class FileDownloader {
  download(url: string, filename?: string) {
    const a = document.createElement("a");

    a.target = "_blank";
    a.href = url;
    a.download = filename || new Date().toLocaleString();

    a.click();
  }
}
