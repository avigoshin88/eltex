import { MetaDto } from "../../../../dto/meta";

export default class MetaOverflowDrawerService {
  private readonly container!: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private offscreenCanvas: OffscreenCanvas;
  private worker: Worker;
  private observer = new ResizeObserver(() => {
    this.resizeCanvas();
  });

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.canvas = document.createElement("canvas");
    this.worker = new Worker(new URL("./draw.worker.ts", import.meta.url)); // Worker должен быть в отдельном файле

    this.offscreenCanvas = this.canvas.transferControlToOffscreen();

    this.worker.postMessage({ canvas: this.offscreenCanvas }, [
      this.offscreenCanvas,
    ]);
  }

  init = () => {
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.offscreenCanvas.width = this.container.clientWidth; // Внутреннее разрешение
    this.offscreenCanvas.height = this.container.clientHeight; // Внутреннее разрешение

    this.container.appendChild(this.canvas);
    this.resizeCanvas();

    this.observer.observe(this.container);
  };

  clear = () => {
    this.worker.postMessage({ action: "clear" });
  };

  destroy = () => {
    this.clear();
    this.observer.disconnect();
    this.container.removeChild(this.canvas);
    this.worker.terminate();
  };

  resizeCanvas = () => {
    this.worker.postMessage({
      action: "resize",
      size: {
        width: this.container.clientWidth,
        height: this.container.clientHeight,
      },
    });
  };

  draw = (meta: MetaDto): void => {
    this.worker.postMessage({
      action: "draw",
      meta,
    });
  };
}
