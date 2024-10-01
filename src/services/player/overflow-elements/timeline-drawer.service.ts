import { Nullable } from "../../../types/global";
import { RangeData } from "../../../types/range";
import {
  ExportRangeCallback,
  TimelineClickCallback,
} from "../../../types/timeline";
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

export class TimelineOverflowDrawer {
  private ranges: RangeData[] = [];
  private readonly container: HTMLDivElement;
  private scrollContainer: Nullable<HTMLDivElement> = null;
  private timelineContainer: Nullable<HTMLDivElement> = null;
  private scale: number = 1; // Начальный масштаб
  private currentStartTime: number = 0; // Текущее начало времени
  private isReady: boolean = false; // Флаг, указывающий готовность к отрисовке
  private clickCallback: TimelineClickCallback; // Callback для кликов

  private customTrackTimestamp: Nullable<number> = null; // Пользовательское время для трека

  private exportMode: boolean = false; // Режим экспорта
  private exportStartTime: Nullable<number> = null; // Время начала выбранного диапазона
  private exportEndTime: Nullable<number> = null; // Время конца выбранного диапазона
  private exportCallback: Nullable<ExportRangeCallback> = null; // Callback для экспорта

  constructor(
    container: HTMLDivElement,
    clickCallback?: TimelineClickCallback
  ) {
    this.container = container;
    this.scrollContainer = document.createElement("div");

    this.timelineContainer = document.createElement("div");
    this.clickCallback = clickCallback || (() => {}); // Используем переданную функцию или пустой callback

    // Устанавливаем CSS класс для timelineContainer
    this.timelineContainer.classList.add("video-player__timeline");

    // Изначально скролл отключен
    this.timelineContainer.style.overflowX = "hidden";
    this.timelineContainer.style.whiteSpace = "nowrap";

    this.scrollContainer.appendChild(this.timelineContainer);

    this.scrollContainer.style.width = "100%";
    this.scrollContainer.style.overflowX = "auto";

    this.container.appendChild(this.scrollContainer);

    this.registerListeners();
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
      // this.container.style.overflowX = "auto"; // Включаем скролл
      this.timelineContainer.style.width = `${totalRangeWidth}px`; // Задаем большую ширину таймлайна
    } else {
      // this.container.style.overflowX = "hidden"; // Отключаем скролл
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

    // Обновление трека и маркеров экспорта
    this.updateTrackAndExportMarkers(
      currentTime,
      startTime,
      totalTimeRange,
      totalRangeWidth
    );
  }

  // Основная логика для обновления трека и экспортных маркеров
  private updateTrackAndExportMarkers(
    currentTime: number,
    startTime: number,
    totalTimeRange: number,
    totalRangeWidth: number
  ): void {
    const currentTimestamp =
      (this.customTrackTimestamp || startTime) + currentTime;

    const timestamp = this.getNearestTimestamp(currentTimestamp);
    if (timestamp === undefined) {
      return;
    }

    const trackPosition =
      ((timestamp - startTime) / totalTimeRange) * totalRangeWidth;

    const track = document.createElement("div");
    track.classList.add("video-player__timeline__track");
    track.style.left = `${trackPosition}px`;

    this.timelineContainer!.appendChild(track);

    // Обновляем экспортные маркеры, если включен режим экспорта
    if (this.exportMode) {
      this.updateExportMarkers(startTime, totalTimeRange, totalRangeWidth);
    }
  }

  private getNearestTimestamp(timestamp: number) {
    const currentRange = this.findRangeByTimestamp(timestamp);

    if (currentRange && currentRange.type === "data") {
      return timestamp;
    }

    return this.findNearestDataRange(timestamp)?.start_time;
  }

  // Включение режима экспорта
  enableExportMode(callback: ExportRangeCallback): void {
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

  private addExportMarker(position: number, type: "start" | "end"): void {
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

      this.addExportMarker(startMarkerPosition, "start");
    }

    if (this.exportEndTime !== null) {
      const endMarkerPosition =
        ((this.exportEndTime - startTime) / totalTimeRange) * totalRangeWidth;

      this.addExportMarker(endMarkerPosition, "end");
    }
  }

  private drawVirtualizedDivisions(
    startTime: number,
    totalTimeRange: number,
    totalRangeWidth: number
  ): void {
    const divisionStep = this.getDivisionStep(); // Шаг делений

    // Границы видимой области
    const scrollLeft = this.scrollContainer!.scrollLeft;
    const containerWidth = this.scrollContainer!.offsetWidth;

    const visibleStartTime =
      startTime + (scrollLeft / totalRangeWidth) * totalTimeRange;
    const visibleEndTime =
      startTime +
      ((scrollLeft + containerWidth) / totalRangeWidth) * totalTimeRange;

    const firstVisibleDivision = Math.floor(
      (visibleStartTime - startTime) / divisionStep
    );
    const lastVisibleDivision = Math.floor(
      (visibleEndTime - startTime) / divisionStep
    );

    // Удаляем старые деления
    const oldDivisions = this.timelineContainer!.querySelectorAll(
      ".video-player__timeline__period"
    );
    oldDivisions.forEach((division) => division.remove());

    // Расчет ширины одного деления в пикселях
    const divisionWidth = divisionStep * this.scale;

    // Динамическое измерение ширины метки
    const sampleTime = startTime + firstVisibleDivision * divisionStep;
    const sampleLabelText = this.formatTime(sampleTime);

    const tempLabel = document.createElement("span");
    tempLabel.classList.add("video-player__timeline__period__text");
    tempLabel.style.visibility = "hidden"; // Скрываем элемент
    tempLabel.style.position = "absolute"; // Убираем из потока
    tempLabel.innerText = sampleLabelText;
    document.body.appendChild(tempLabel);
    const labelWidth = tempLabel.offsetWidth;
    document.body.removeChild(tempLabel);

    // Расчет интервала между метками
    let labelInterval = 1;
    if (divisionWidth < labelWidth + 5) {
      labelInterval = Math.ceil((labelWidth + 5) / divisionWidth);
    }

    // Отрисовка видимых делений
    for (let i = firstVisibleDivision; i <= lastVisibleDivision; i++) {
      const divisionTime = startTime + i * divisionStep;
      const position =
        ((divisionTime - startTime) / totalTimeRange) * totalRangeWidth;

      const division = document.createElement("div");
      division.classList.add("video-player__timeline__period");
      division.style.left = `${position}px`;

      // Отображение меток в зависимости от интервала
      if (i % labelInterval === 0) {
        const timeLabel = document.createElement("span");
        timeLabel.classList.add("video-player__timeline__period__text");
        timeLabel.innerText = this.formatTime(divisionTime);
        division.classList.add("video-player__timeline__period_with_text");
        division.appendChild(timeLabel);
      }

      // Добавляем деление в контейнер
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
      // Малый масштаб: часы, минуты, секунды
      return format(date, "HH:mm:ss");
    } else if (this.scale >= 0.000001) {
      // Средний масштаб: день, месяц, часы, минуты
      return format(date, "dd.MM HH:mm");
    } else if (this.scale >= 0.00000001) {
      // Большой масштаб: день, месяц
      return format(date, "dd.MM");
    } else {
      // Очень большой масштаб: год
      return format(date, "yyyy");
    }
  }

  private getDivisionStep(): number {
    const scaleFactor = this.scale;

    const stepInfo = divisionSteps.find((step) => scaleFactor > step.scale);

    return stepInfo?.step ?? divisionSteps[divisionSteps.length - 1].step;
  }

  // Клик по таймлайну для обновления трека и установки экспортных маркеров
  private clickEventListener(event: MouseEvent): void {
    event.preventDefault();

    const containerRect = this.container.getBoundingClientRect();
    const scrollLeft = this.scrollContainer?.scrollLeft || 0;
    const clickX = event.clientX - containerRect.left + scrollLeft;

    const startTime = this.ranges[0]?.start_time || 0;
    const endTime = this.ranges[this.ranges.length - 1]?.end_time || 0;
    const totalTimeRange = endTime - startTime;
    const totalRangeWidth = totalTimeRange * this.scale;

    const clickedTimestamp =
      startTime + (clickX / totalRangeWidth) * totalTimeRange;

    const timestamp = this.getNearestTimestamp(clickedTimestamp);
    if (timestamp === undefined) {
      return;
    }

    const clickedRange = this.findRangeByTimestamp(timestamp);
    if (!clickedRange) {
      return;
    }

    // Пользовательское время для трека
    this.customTrackTimestamp = timestamp;

    // Если включен режим экспорта, обрабатываем клик как установку маркеров
    if (this.exportMode) {
      if (this.exportStartTime === null) {
        this.exportStartTime = clickedTimestamp;
      } else if (this.exportEndTime === null) {
        this.exportEndTime = clickedTimestamp;

        // Если начало и конец перепутаны, меняем их местами
        if (this.exportStartTime > this.exportEndTime) {
          [this.exportStartTime, this.exportEndTime] = [
            this.exportEndTime,
            this.exportStartTime,
          ];
        }

        // Вызываем callback для экспорта диапазона
        this.exportCallback?.({
          start_time: this.exportStartTime,
          end_time: this.exportEndTime,
          duration: this.exportEndTime - this.exportStartTime,
        });
      } else {
        // Перезапуск диапазона
        this.exportStartTime = clickedTimestamp;
        this.exportEndTime = null;
      }

      // Обновляем маркеры
      this.updateExportMarkers(startTime, totalTimeRange, totalRangeWidth);
    } else {
      // Визуально перемещаем трек
      this.draw(this.customTrackTimestamp);
      // Вызываем коллбэк с новым значением времени (если нужно)
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
    this.scrollContainer?.addEventListener(
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
    this.scrollContainer?.removeEventListener(
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
