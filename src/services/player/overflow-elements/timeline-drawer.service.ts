import { RangePeriod } from "../../../dto/ranges";
import { Nullable } from "../../../types/global";
import { RangeData } from "../../../types/range";

// import { debounce } from "es-toolkit";

const PERIODS_COUNT = 58;

export class TimelineOverflowDrawer {
  private ranges: RangeData[] = [];
  private readonly container: HTMLDivElement;
  private timelineContainer: Nullable<HTMLDivElement> = null;
  private scale: number = 1; // Начальный масштаб
  private currentStartTime: number = 0; // Текущее начало времени
  private isReady: boolean = false; // Флаг, указывающий готовность к отрисовке

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.timelineContainer = document.createElement("div");

    // Устанавливаем CSS класс для timelineContainer
    this.timelineContainer.classList.add("timelineContainer");

    // Изначально скролл отключен
    this.container.style.overflowX = "hidden";
    this.container.style.whiteSpace = "nowrap";

    this.container.appendChild(this.timelineContainer);

    // Добавляем слушатель на колесо мыши
    this.addWheelEventListener();
  }

  draw(currentTime: number): void {
    if (!this.isReady || !this.timelineContainer || this.ranges.length === 0)
      return;

    this.timelineContainer.innerHTML = ""; // Очистка контейнера перед отрисовкой

    const startTime = this.ranges[0]?.start_time || 0;
    const endTime = this.ranges[this.ranges.length - 1]?.end_time || 0;
    const totalTimeRange = endTime - startTime; // Общее время от начала до конца всех диапазонов

    // Преобразуем currentTime в миллисекунды для корректного отображения
    const videoTimestamp = startTime + currentTime;

    const containerWidth = this.container.offsetWidth; // Ширина контейнера

    // Рассчитываем ширину диапазонов с учетом масштаба
    const totalRangeWidth = totalTimeRange * this.scale; // totalTimeRange в масштабе

    // Если ширина всех диапазонов больше ширины контейнера, включаем скролл
    if (totalRangeWidth > containerWidth) {
      this.container.style.overflowX = "auto"; // Включаем скролл
      this.timelineContainer.style.width = `${totalRangeWidth}px`; // Задаем большую ширину таймлайна
    } else {
      this.container.style.overflowX = "hidden"; // Отключаем скролл
      this.timelineContainer.style.width = `${containerWidth}px`; // Устанавливаем стандартную ширину
    }

    // Отрисовка делений времени в зависимости от масштаба
    this.drawTimeDivisions(startTime, totalTimeRange, totalRangeWidth);

    // Отрисовка самих диапазонов (ranges) с учётом масштаба
    this.ranges.forEach((range) => {
      const rangeStartPosition =
        ((range.start_time - startTime) / totalTimeRange) * totalRangeWidth;
      const rangeWidth = (range.duration / totalTimeRange) * totalRangeWidth;

      const rangeBlock = document.createElement("div");
      rangeBlock.classList.add("rangeBlock");
      rangeBlock.style.left = `${rangeStartPosition}px`;
      rangeBlock.style.width = `${rangeWidth}px`;
      rangeBlock.style.backgroundColor =
        range.type === "data" ? "#4caf50" : "#f44336"; // Цвета для разных типов

      this.timelineContainer!.appendChild(rangeBlock);
    });

    // Отрисовка трека текущего времени
    const trackPosition =
      ((videoTimestamp - startTime) / totalTimeRange) * totalRangeWidth;

    const track = document.createElement("div");
    track.classList.add("track");
    track.style.left = `${trackPosition}px`;

    this.timelineContainer.appendChild(track);
  }

  drawTimeDivisions(
    startTime: number,
    totalTimeRange: number,
    totalRangeWidth: number
  ): void {
    const divisionStep = this.getDivisionStep(); // Получаем шаг делений в зависимости от масштаба
    const numDivisions = Math.floor(totalTimeRange / divisionStep);

    for (let i = 0; i <= numDivisions; i++) {
      const divisionTime = startTime + i * divisionStep;
      const position =
        ((divisionTime - startTime) / totalTimeRange) * totalRangeWidth;

      const division = document.createElement("div");
      division.classList.add("division");
      division.style.left = `${position}px`;

      // Отображаем время только на каждом 5-м делении
      if (i % 5 === 0) {
        const timeLabel = document.createElement("span");
        timeLabel.innerText = this.formatTime(divisionTime);
        division.appendChild(timeLabel);
      }

      this.timelineContainer!.appendChild(division);
    }
  }

  setOptions(ranges: RangeData[]): void {
    this.ranges = ranges;
    this.currentStartTime = this.ranges[0]?.start_time || 0;
    this.isReady = true; // Устанавливаем флаг готовности к отрисовке

    const totalTimeRange =
      ranges[ranges.length - 1].end_time - ranges[0].start_time;
    const containerWidth = this.container.offsetWidth;

    // Устанавливаем начальный масштаб так, чтобы диапазоны занимали всю ширину контейнера
    this.scale = containerWidth / totalTimeRange;

    this.draw(this.currentStartTime); // Отрисовка шкалы после установки диапазонов
  }

  clear(): void {
    if (this.timelineContainer) {
      this.container.removeChild(this.timelineContainer);
      this.timelineContainer = null;
      this.isReady = false; // Сбрасываем флаг готовности
    }
  }

  private formatTime(time: number): string {
    const date = new Date(time);
    return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
  }

  // Определяет шаг делений в зависимости от масштаба
  private getDivisionStep(): number {
    const scaleFactor = this.scale;

    // Уменьшаем шаг делений для увеличения их количества
    if (scaleFactor > 0.8) {
      return 30 * 1000; // Шаг 30 секунд
    } else if (scaleFactor > 0.5) {
      return 1 * 60 * 1000; // Шаг 1 минута
    } else if (scaleFactor > 0.3) {
      return 2 * 60 * 1000; // Шаг 2 минуты
    } else {
      return 5 * 60 * 1000; // Шаг 5 минут
    }
  }

  // Добавляем слушатель на колесо мыши для изменения масштаба и прокрутки
  private addWheelEventListener() {
    this.timelineContainer?.addEventListener("wheel", (event: WheelEvent) => {
      event.preventDefault();

      if (event.shiftKey) {
        // Если зажата клавиша Shift — горизонтальная прокрутка
        this.container.scrollLeft += event.deltaY;
      } else {
        // Иначе — изменение масштаба

        // Ограничим максимальные изменения при каждом событии скролла
        const scaleChange = Math.sign(event.deltaY) * 0.000002; // Более мелкий шаг для плавности

        const totalTimeRange =
          this.ranges[this.ranges.length - 1].end_time -
          this.ranges[0].start_time;
        const containerWidth = this.container.offsetWidth;

        // Рассчитаем максимальный масштаб так, чтобы диапазоны не могли выходить за пределы контейнера
        const maxScale = 1; // Масштабирование не должно превышать единичный масштаб
        const minScale = containerWidth / totalTimeRange; // Минимальный масштаб, при котором диапазоны занимают контейнер

        // Ограничиваем масштаб значениями от minScale до maxScale
        this.scale = Math.min(
          maxScale,
          Math.max(minScale, this.scale + scaleChange)
        );

        if (this.isReady) {
          this.draw(this.currentStartTime);
        }
      }
    });
  }
}
