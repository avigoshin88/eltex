import { MetaDto } from "../../../../dto/meta";

const green = "rgb(18, 117, 49)";
const greenWithOpacity = "rgba(18, 117, 49, 0.2)";
const fontSize = 18;
const fontMargin = -4;

let offscreenCanvas: OffscreenCanvas;

self.onmessage = (
  event: MessageEvent<{
    canvas?: OffscreenCanvas;
    action: string;
    meta?: MetaDto;
    size?: { width: number; height: number };
  }>
) => {
  const { canvas, action, meta, size } = event.data;

  if (canvas) offscreenCanvas = canvas;

  if (offscreenCanvas) {
    const context = offscreenCanvas.getContext("2d");

    if (!context) return;

    if (action === "clear") {
      context.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    }

    if (action === "resize" && size) {
      offscreenCanvas.width = size.width;
      offscreenCanvas.height = size.height;
    }

    if (action === "draw" && meta) {
      // Логика отрисовки объектов, как в Canvas
      context.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

      const canvasWidth = offscreenCanvas.width;
      const canvasHeight = offscreenCanvas.height;

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
    }
  }
};
