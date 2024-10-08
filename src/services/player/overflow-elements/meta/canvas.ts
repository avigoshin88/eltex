import { MetaDto } from "../../../../dto/meta";

const green = "rgb(18, 117, 49)";
const greenWithOpacity = "rgba(18, 117, 49, 0.2)";
const fontSize = 18;
const fontMargin = -4;

export default class MetaOverflowDrawerService {
  private readonly container!: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D | null;
  private observer = new ResizeObserver(() => {
    this.resizeCanvas();
  });

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d");
  }

  init = () => {
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "none";

    this.container.appendChild(this.canvas);
    this.resizeCanvas();
    this.observer.observe(this.container);
  };

  clear = () => {
    if (this.context) {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  };

  destroy = () => {
    this.clear();
    this.observer.disconnect();
    this.container.removeChild(this.canvas);
  };

  resizeCanvas = () => {
    this.canvas.width = this.container.clientWidth;
    this.canvas.height = this.container.clientHeight;
    this.clear(); // Чтобы корректно пересчитать размеры
  };

  draw = (meta: MetaDto): void => {
    const context = this.context;

    if (!context) return;

    this.clear();

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // Рисуем объекты
    meta.objects.forEach((obj) => {
      const x = obj.x * canvasWidth;
      const y = obj.y * canvasHeight;
      const width = obj.w * canvasWidth;
      const height = obj.h * canvasHeight;

      context.strokeStyle = green;
      context.lineWidth = 3;
      context.strokeRect(x, y, width, height);

      context.fillStyle = "white";
      context.font = `${fontSize}px Arial`;
      context.fillText(obj.title, x, y + fontMargin);
    });

    // Рисуем линии
    meta.lines.forEach((line) => {
      context.strokeStyle = green;
      context.lineWidth = 3;

      const x1 = line.x1 * canvasWidth;
      const y1 = line.y1 * canvasHeight;
      const x2 = line.x2 * canvasWidth;
      const y2 = line.y2 * canvasHeight;

      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();

      context.fillStyle = "white";
      context.font = `${fontSize}px Arial`;
      context.fillText(line.name, x1, y1 + fontMargin);
    });

    // Рисуем зоны
    meta.zones.forEach((zone) => {
      context.strokeStyle = green;
      context.fillStyle = greenWithOpacity;
      context.lineWidth = 3;

      context.beginPath();
      zone.points.forEach((point, index) => {
        const x = point.x * canvasWidth;
        const y = point.y * canvasHeight;
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.closePath();
      context.fill();
      context.stroke();

      const firstPoint = zone.points[0];
      const x = firstPoint.x * canvasWidth;
      const y = firstPoint.y * canvasHeight;

      context.fillStyle = "white";
      context.font = `${fontSize}px Arial`;
      context.fillText(zone.name, x, y + fontMargin);
    });
  };
}
