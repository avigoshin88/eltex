import { RangeDto } from "../../../dto/ranges";
import { Nullable } from "../../../types/global";
import { RangeData } from "../../../types/range";
import { TimelineClickCallback } from "../../../types/timeline";

import { format } from "date-fns";

const divisionSteps = [
  { scale: 0.004, step: 5 * 1000 }, // 5 секунд
  { scale: 0.002, step: 10 * 1000 }, // 10 секунд
  { scale: 0.001, step: 20 * 1000 }, // 20 секунд
  { scale: 0.0005, step: 30 * 1000 }, // 30 секунд
  { scale: 0.0002, step: 1 * 60 * 1000 }, // 1 минута
  { scale: 0.0001, step: 2 * 60 * 1000 }, // 2 минуты
  { scale: 0.00005, step: 5 * 60 * 1000 }, // 5 минут
  { scale: 0.00002, step: 10 * 60 * 1000 }, // 10 минут
  { scale: 0.00001, step: 15 * 60 * 1000 }, // 15 минут
  { scale: 0.000005, step: 30 * 60 * 1000 }, // 30 минут
  { scale: 0.000002, step: 1 * 60 * 60 * 1000 }, // 1 час
  { scale: 0.000001, step: 2 * 60 * 60 * 1000 }, // 2 часа
  { scale: 0.0000005, step: 6 * 60 * 60 * 1000 }, // 6 часов
  { scale: 0.0000002, step: 12 * 60 * 60 * 1000 }, // 12 часов
  { scale: 0.0000001, step: 1 * 24 * 60 * 60 * 1000 }, // 1 день
  { scale: 0.00000005, step: 2 * 24 * 60 * 60 * 1000 }, // 2 дня
  { scale: 0.00000002, step: 7 * 24 * 60 * 60 * 1000 }, // 1 неделя
  { scale: 0.00000001, step: 14 * 24 * 60 * 60 * 1000 }, // 2 недели
  { scale: 0.000000005, step: 1 * 30 * 24 * 60 * 60 * 1000 }, // 1 месяц
  { scale: 0.000000002, step: 3 * 30 * 24 * 60 * 60 * 1000 }, // 1 квартал
  { scale: 0.000000001, step: 6 * 30 * 24 * 60 * 60 * 1000 }, // полгода
  { scale: 0.0000000005, step: 1 * 365 * 24 * 60 * 60 * 1000 }, // 1 год
  { scale: 0.0000000002, step: 2 * 365 * 24 * 60 * 60 * 1000 }, // 2 года
  { scale: 0.0000000001, step: 5 * 365 * 24 * 60 * 60 * 1000 }, // 5 лет
  { scale: 0.00000000005, step: 10 * 365 * 24 * 60 * 60 * 1000 }, // 10 лет (добавлено соответствующее значение scale)
];

type ExportRangeCallback = (range: RangeDto) => void;

export class TimelineOverflowDrawer {
  private ranges: RangeData[] = [];
  private readonly container: HTMLDivElement;
  private timelineContainer: Nullable<HTMLDivElement> = null;
  private scale: number = 1; // Начальный масштаб
  private currentStartTime: number = 0; // Текущее начало времени
  private isReady: boolean = false; // Флаг, указывающий готовность к отрисовке
  private clickCallback: TimelineClickCallback; // Callback для кликов

  private exportMode: boolean = false; // Режим экспорта
  private exportStartTime: Nullable<number> = null; // Время начала выбранного диапазона
  private exportEndTime: Nullable<number> = null; // Время конца выбранного диапазона
  private exportCallback: Nullable<ExportRangeCallback> = null; // Callback для экспорта

  constructor(
    container: HTMLDivElement,
    clickCallback?: TimelineClickCallback
  ) {
    this.container = container;
    this.timelineContainer = document.createElement("div");
    this.clickCallback = clickCallback || (() => {}); // Используем переданную функцию или пустой callback

    // Устанавливаем CSS класс для timelineContainer
    this.timelineContainer.classList.add("video-player__timeline");

    // Изначально скролл отключен
    this.timelineContainer.style.overflowX = "hidden";
    this.timelineContainer.style.whiteSpace = "nowrap";
    this.registerListeners();

    this.container.appendChild(this.timelineContainer);
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
      rangeBlock.classList.add("video-player__timeline__range");
      rangeBlock.style.left = `${rangeStartPosition}px`;
      rangeBlock.style.width = `${rangeWidth}px`;

      rangeBlock.setAttribute("data-type", range.type);

      this.timelineContainer!.appendChild(rangeBlock);
    });

    const currentTimestamp = startTime + currentTime;

    // Проверяем, находится ли текущий временной штамп внутри диапазона 'data'
    const currentRange = this.findRangeByTimestamp(currentTimestamp);

    if (currentRange && currentRange.type === "data") {
      // Если текущий временной штамп внутри диапазона типа 'data', рисуем трек
      const trackPosition =
        ((currentTimestamp - startTime) / totalTimeRange) * totalRangeWidth;

      const track = document.createElement("div");
      track.classList.add("video-player__timeline__track");
      track.style.left = `${trackPosition}px`;

      this.timelineContainer.appendChild(track);
    } else {
      // Ищем ближайший диапазон типа 'data'
      const nearestDataRange = this.findNearestDataRange(currentTimestamp);

      if (nearestDataRange) {
        // Перемещаем трек на начало ближайшего диапазона типа 'data'
        const trackPosition =
          ((nearestDataRange.start_time - startTime) / totalTimeRange) *
          totalRangeWidth;

        const track = document.createElement("div");
        track.classList.add("video-player__timeline__track");
        track.style.left = `${trackPosition}px`;

        this.timelineContainer.appendChild(track);
      }
    }
  }

  // Включение режима экспорта
  enableExportMode(callback: (range: RangeDto) => void): void {
    this.exportMode = true;
    this.exportCallback = callback;
    this.exportStartTime = null;
    this.exportEndTime = null;

    // Очищаем предыдущие черты
    this.clearExportMarkers();
  }

  // Отключение режима экспорта
  disableExportMode(): void {
    this.exportMode = false;
    this.exportCallback = null;

    // Удаляем черты
    this.clearExportMarkers();
  }

  private clearExportMarkers(): void {
    const markers = this.timelineContainer!.querySelectorAll(
      ".video-player__timeline__export-marker"
    );
    markers.forEach((marker) => marker.remove());
  }

  private addExportMarker(
    time: number,
    position: number,
    type: "start" | "end"
  ): void {
    const marker = document.createElement("div");

    marker.classList.add("video-player__timeline__export-marker");

    marker.classList.add(
      type === "start"
        ? "video-player__timeline__export-marker_start"
        : "video-player__timeline__export-marker_end"
    );

    marker.style.left = `${position}px`;

    this.timelineContainer!.appendChild(marker);
  }

  private updateExportMarkers(
    startTime: number,
    totalTimeRange: number,
    totalRangeWidth: number
  ): void {
    this.clearExportMarkers();

    if (this.exportStartTime !== null) {
      const startMarkerPosition =
        ((this.exportStartTime - startTime) / totalTimeRange) * totalRangeWidth;

      this.addExportMarker(this.exportStartTime, startMarkerPosition, "start");
    }

    if (this.exportEndTime !== null) {
      const endMarkerPosition =
        ((this.exportEndTime - startTime) / totalTimeRange) * totalRangeWidth;

      this.addExportMarker(this.exportEndTime, endMarkerPosition, "end");
    }
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
    const oldDivisions = this.timelineContainer!.querySelectorAll(
      ".video-player__timeline__period"
    );
    oldDivisions.forEach((division) => division.remove());

    // Отрисовываем только видимые деления
    for (let i = firstVisibleDivision; i <= lastVisibleDivision; i++) {
      const divisionTime = startTime + i * divisionStep;
      const position =
        ((divisionTime - startTime) / totalTimeRange) * totalRangeWidth;

      const division = document.createElement("div");
      division.classList.add("video-player__timeline__period");
      division.style.left = `${position}px`;

      // Отображаем время на каждом 5-м делении
      if (i % 5 === 0) {
        const timeLabel = document.createElement("span");

        timeLabel.classList.add("video-player__timeline__period__text");

        timeLabel.innerText = this.formatTime(divisionTime);

        division.classList.add("video-player__timeline__period_with_text");
        division.appendChild(timeLabel);
      }

      // Добавляем только видимые деления в контейнер
      this.timelineContainer!.appendChild(division);
    }
  }

  private updateVirtualizedDivisions() {
    const startTime = this.ranges[0]?.start_time || 0;
    const endTime = this.ranges[this.ranges.length - 1]?.end_time || 0;
    const totalTimeRange = endTime - startTime;
    const totalRangeWidth = totalTimeRange * this.scale;

    this.drawVirtualizedDivisions(startTime, totalTimeRange, totalRangeWidth);
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
    if (!this.timelineContainer) {
      return;
    }

    this.clearListeners();

    this.container.removeChild(this.timelineContainer);
    this.timelineContainer = null;

    this.isReady = false;
  }

  private formatTime(time: number): string {
    const date = new Date(time);

    if (this.scale >= 0.00001) {
      // Малый масштаб: полное время (часы, минуты, секунды)
      return format(date, "HH:mm:ss");
    } else if (this.scale >= 0.0000001) {
      // Средний масштаб: дата и время
      return format(date, "dd.MM.yyyy HH:mm");
    } else {
      // Большой масштаб: только дата
      return format(date, "dd.MM.yyyy");
    }
  }
  private getDivisionStep(): number {
    const scaleFactor = this.scale;

    const stepInfo = divisionSteps.find((step) => scaleFactor > step.scale);

    return stepInfo?.step ?? divisionSteps[divisionSteps.length - 1].step;
  }

  private clickEventListener(event: MouseEvent): void {
    event.preventDefault();

    const clickX = event.offsetX; // Координата клика по оси X
    const containerWidth = this.container.offsetWidth;
    const startTime = this.ranges[0]?.start_time || 0;
    const endTime = this.ranges[this.ranges.length - 1]?.end_time || 0;
    const totalTimeRange = endTime - startTime;
    const totalRangeWidth = totalTimeRange * this.scale;

    // Вычисляем время на основе позиции клика
    let clickedTimestamp =
      startTime + (clickX / containerWidth) * totalTimeRange;

    if (this.exportMode) {
      // Если включён режим экспорта
      if (this.exportStartTime === null) {
        this.exportStartTime = clickedTimestamp;
      } else if (this.exportEndTime === null) {
        this.exportEndTime = clickedTimestamp;

        // Проверяем, что время конца больше времени начала
        if (this.exportStartTime > this.exportEndTime) {
          [this.exportStartTime, this.exportEndTime] = [
            this.exportEndTime,
            this.exportStartTime,
          ];
        }

        this.exportCallback?.({
          start_time: this.exportStartTime,
          end_time: this.exportEndTime,
          duration: this.exportEndTime - this.exportStartTime,
        });
      } else {
        // Если оба времени уже установлены, сбрасываем выбор
        this.exportStartTime = clickedTimestamp;
        this.exportEndTime = null;
      }

      this.updateExportMarkers(startTime, totalTimeRange, totalRangeWidth);
    } else {
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
    }
  }

  private scrollEventListener() {
    this.updateVirtualizedDivisions();
  }

  private wheelEventListener(event: WheelEvent) {
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

        // Обновляем маркеры экспорта при изменении масштаба
        this.updateExportMarkers(
          this.ranges[0]?.start_time || 0,
          totalTimeRange,
          totalTimeRange * this.scale
        );
      }
    }
  }

  private registerListeners() {
    this.timelineContainer?.addEventListener(
      "scroll",
      this.scrollEventListener.bind(this)
    );
    this.timelineContainer?.addEventListener(
      "wheel",
      this.wheelEventListener.bind(this)
    );
    this.timelineContainer?.addEventListener(
      "click",
      this.clickEventListener.bind(this)
    );
  }

  private clearListeners() {
    this.timelineContainer?.removeEventListener(
      "scroll",
      this.scrollEventListener
    );
    this.timelineContainer?.removeEventListener(
      "wheel",
      this.wheelEventListener
    );
    this.timelineContainer?.removeEventListener(
      "click",
      this.clickEventListener
    );
  }
}
