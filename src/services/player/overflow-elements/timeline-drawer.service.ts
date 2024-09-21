import { Nullable } from "../../../types/global";
import { RangeData } from "../../../types/range";
import { TimelineClickCallback } from "../../../types/timeline";

export class TimelineOverflowDrawer {
  private ranges: RangeData[] = [];
  private readonly container: HTMLDivElement;
  private timelineContainer: Nullable<HTMLDivElement> = null;
  private scale: number = 1; // Начальный масштаб
  private currentStartTime: number = 0; // Текущее начало времени
  private isReady: boolean = false; // Флаг, указывающий готовность к отрисовке
  private clickCallback: TimelineClickCallback; // Callback для кликов

  constructor(
    container: HTMLDivElement,
    clickCallback?: TimelineClickCallback
  ) {
    this.container = container;
    this.timelineContainer = document.createElement("div");
    this.clickCallback = clickCallback || (() => {}); // Используем переданную функцию или пустой callback

    // Устанавливаем CSS класс для timelineContainer
    this.timelineContainer.classList.add("timelineContainer");

    // Изначально скролл отключен
    this.container.style.overflowX = "hidden";
    this.container.style.whiteSpace = "nowrap";

    this.container.appendChild(this.timelineContainer);

    // Добавляем слушатели
    this.addScrollEventListener();
    this.addWheelEventListener();
    this.addClickEventListener(); // Обработчик клика
  }

  draw(currentTime: number): void {
    if (!this.isReady || !this.timelineContainer || this.ranges.length === 0)
      return;

    this.timelineContainer.innerHTML = ""; // Очистка контейнера перед отрисовкой

    const startTime = this.ranges[0]?.start_time || 0;
    const endTime = this.ranges[this.ranges.length - 1]?.end_time || 0;
    const totalTimeRange = endTime - startTime; // Общее время от начала до конца всех диапазонов

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

    // Виртуализация делений
    this.drawVirtualizedDivisions(startTime, totalTimeRange, totalRangeWidth);

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
      ((currentTime - startTime) / totalTimeRange) * totalRangeWidth;

    const track = document.createElement("div");
    track.classList.add("track");
    track.style.left = `${trackPosition}px`;

    this.timelineContainer.appendChild(track);
  }

  private drawVirtualizedDivisions(
    startTime: number,
    totalTimeRange: number,
    totalRangeWidth: number
  ): void {
    const divisionStep = this.getDivisionStep(); // Получаем шаг делений в зависимости от масштаба

    // Получаем текущие границы прокрутки (начало и конец видимой области)
    const scrollLeft = this.container.scrollLeft;
    const containerWidth = this.container.offsetWidth;

    // Рассчитываем границы видимой области по времени
    const visibleStartTime =
      startTime + (scrollLeft / totalRangeWidth) * totalTimeRange;
    const visibleEndTime =
      startTime +
      ((scrollLeft + containerWidth) / totalRangeWidth) * totalTimeRange;

    // Рассчитываем индекс первого и последнего видимого деления
    const firstVisibleDivision = Math.floor(
      (visibleStartTime - startTime) / divisionStep
    );
    const lastVisibleDivision = Math.floor(
      (visibleEndTime - startTime) / divisionStep
    );

    // Удаляем только старые деления
    const oldDivisions = this.timelineContainer!.querySelectorAll(".division");
    oldDivisions.forEach((division) => division.remove());

    // Отрисовываем только видимые деления
    for (let i = firstVisibleDivision; i <= lastVisibleDivision; i++) {
      const divisionTime = startTime + i * divisionStep;
      const position =
        ((divisionTime - startTime) / totalTimeRange) * totalRangeWidth;

      const division = document.createElement("div");
      division.classList.add("division");
      division.style.left = `${position}px`;

      // Отображаем время на каждом 5-м делении
      if (i % 5 === 0) {
        const timeLabel = document.createElement("span");
        timeLabel.innerText = this.formatTime(divisionTime);
        division.appendChild(timeLabel);
      }

      // Добавляем только видимые деления в контейнер
      this.timelineContainer!.appendChild(division);
    }
  }

  private addScrollEventListener() {
    this.container.addEventListener("scroll", () => {
      this.updateVirtualizedDivisions();
    });
  }

  private updateVirtualizedDivisions() {
    const startTime = this.ranges[0]?.start_time || 0;
    const endTime = this.ranges[this.ranges.length - 1]?.end_time || 0;
    const totalTimeRange = endTime - startTime;
    const totalRangeWidth = totalTimeRange * this.scale;

    this.drawVirtualizedDivisions(startTime, totalTimeRange, totalRangeWidth);
  }

  private addClickEventListener(): void {
    this.timelineContainer?.addEventListener("click", (event: MouseEvent) => {
      const clickX = event.offsetX; // Координата клика по оси X
      const containerWidth = this.container.offsetWidth;
      const startTime = this.ranges[0]?.start_time || 0;
      const endTime = this.ranges[this.ranges.length - 1]?.end_time || 0;
      const totalTimeRange = endTime - startTime;

      // Вычисляем время на основе позиции клика
      let clickedTimestamp =
        startTime + (clickX / containerWidth) * totalTimeRange;

      // Ищем диапазон, на который пришелся клик
      let clickedRange = this.findRangeByTimestamp(clickedTimestamp);

      // Если диапазон типа break, устанавливаем timestamp на начало диапазона
      if (clickedRange && clickedRange.type === "break") {
        clickedRange = this.findNearestDataRange(clickedTimestamp);
        clickedTimestamp = clickedRange?.start_time ?? startTime;
      }

      if (clickedRange === null) {
        return;
      }

      // Вызов callback-функции с найденным timestamp и range
      this.clickCallback?.(clickedTimestamp, clickedRange);
    });
  }

  private findRangeByTimestamp(timestamp: number): RangeData | null {
    // Находим диапазон, который включает timestamp
    for (const range of this.ranges) {
      if (timestamp >= range.start_time && timestamp <= range.end_time) {
        return range;
      }
    }
    return null; // Если не найден диапазон
  }

  private findNearestDataRange(timestamp: number): RangeData | null {
    // Находим ближайший диапазон с типом "data"
    let nearestRange: RangeData | null = null;
    let minDistance = Infinity;

    for (const range of this.ranges) {
      if (range.type === "data") {
        const distance = Math.abs(timestamp - range.start_time);
        if (distance < minDistance) {
          minDistance = distance;
          nearestRange = range;
        }
      }
    }

    return nearestRange;
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

  private getDivisionStep(): number {
    const scaleFactor = this.scale;

    if (scaleFactor > 0.004) {
      return 5 * 1000; // Шаг 5 секунд
    } else if (scaleFactor > 0.002) {
      return 10 * 1000; // Шаг 10 секунд
    } else if (scaleFactor > 0.001) {
      return 20 * 1000; // Шаг 20 секунд
    } else if (scaleFactor > 0.0005) {
      return 30 * 1000; // Шаг 30 секунд
    } else if (scaleFactor > 0.0002) {
      return 1 * 60 * 1000; // Шаг 1 минута
    } else if (scaleFactor > 0.0001) {
      return 2 * 60 * 1000; // Шаг 2 минуты
    } else if (scaleFactor > 0.00005) {
      return 5 * 60 * 1000; // Шаг 5 минут
    } else if (scaleFactor > 0.00002) {
      return 10 * 60 * 1000; // Шаг 10 минут
    } else if (scaleFactor > 0.00001) {
      return 15 * 60 * 1000; // Шаг 15 минут
    } else {
      return 30 * 60 * 1000; // Шаг 30 минут
    }
  }

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
