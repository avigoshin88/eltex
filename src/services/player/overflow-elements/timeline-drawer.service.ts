import { Nullable } from "../../../types/global";
import { RangeData } from "../../../types/range";
import {
  ExportRangeCallback,
  TimelineClickCallback,
} from "../../../types/timeline";
import { format } from "date-fns";
import { TimelineElementsFactoryService } from "./timeline/timeline-elements-factory.service";
import { TimelineElementsService } from "./timeline/timeline-elements.service";

const steps = [
  { scale: 0.02, step: 1000, amplifier: 0.0001, label: "1 секунда" }, // 1 секунда
  { scale: 0.004, step: 5 * 1000, amplifier: 0.00005, label: "5 секунд" }, // 5 секунд
  { scale: 0.002, step: 10 * 1000, amplifier: 0.00002, label: "10 секунд" }, // 10 секунд
  { scale: 0.001, step: 20 * 1000, amplifier: 0.00001, label: "20 секунд" }, // 20 секунд
  { scale: 0.0005, step: 30 * 1000, amplifier: 0.000005, label: "30 секунд" }, // 30 секунд
  { scale: 0.0002, step: 1 * 60 * 1000, amplifier: 0.000002, label: "1 минута" }, // 1 минута
  {
    scale: 0.0001,
    step: 2 * 60 * 1000,
    amplifier: 0.000001,
    label: "2 минуты",
  }, // 2 минуты
  {
    scale: 0.00005,
    step: 5 * 60 * 1000,
    amplifier: 0.0000005,
    label: "5 минут",
  }, // 5 минут
  {
    scale: 0.00002,
    step: 10 * 60 * 1000,
    amplifier: 0.0000002,
    label: "10 минут",
  }, // 10 минут
  {
    scale: 0.00001,
    step: 15 * 60 * 1000,
    amplifier: 0.0000001,
    label: "15 минут",
  }, // 15 минут
  {
    scale: 0.000005,
    step: 30 * 60 * 1000,
    amplifier: 0.00000005,
    label: "30 минут",
  }, // 30 минут
  {
    scale: 0.000002,
    step: 1 * 60 * 60 * 1000,
    amplifier: 0.00000002,
    label: "1 час",
  }, // 1 час
  {
    scale: 0.000001,
    step: 6 * 60 * 60 * 1000,
    amplifier: 0.00000001,
    label: "6 часов",
  }, // 6 часов
  {
    scale: 0.0000005,
    step: 12 * 60 * 60 * 1000,
    amplifier: 0.000000005,
    label: "12 часов",
  }, // 12 часов
  {
    scale: 0.0000002,
    step: 1 * 24 * 60 * 60 * 1000,
    amplifier: 0.000000002,
    label: "1 день",
  }, // 1 день
  {
    scale: 0.0000001,
    step: 2 * 24 * 60 * 60 * 1000,
    amplifier: 0.000000001,
    label: "2 дня",
  }, // 2 дня
  {
    scale: 0.00000005,
    step: 7 * 24 * 60 * 60 * 1000,
    amplifier: 0.0000000005,
    label: "1 неделя",
  }, // 1 неделя
  {
    scale: 0.00000002,
    step: 14 * 24 * 60 * 60 * 1000,
    amplifier: 0.0000000002,
    label: "2 недели",
  }, // 2 недели
  {
    scale: 0.00000001,
    step: 1 * 30 * 24 * 60 * 60 * 1000,
    amplifier: 0.0000000001,
    label: "1 месяц",
  }, // 1 месяц
  {
    scale: 0.000000005,
    step: 3 * 30 * 24 * 60 * 60 * 1000,
    amplifier: 0.00000000005,
    label: "1 квартал",
  }, // 1 квартал
  {
    scale: 0.000000002,
    step: 6 * 30 * 24 * 60 * 60 * 1000,
    amplifier: 0.00000000002,
    label: "полгода",
  }, // полгода
  {
    scale: 0.000000001,
    step: 1 * 365 * 24 * 60 * 60 * 1000,
    amplifier: 0.00000000001,
    label: "1 год",
  }, // 1 год
  {
    scale: 0.0000000005,
    step: 2 * 365 * 24 * 60 * 60 * 1000,
    amplifier: 0.000000000005,
    label: "2 года",
  }, // 2 года
  {
    scale: 0.0000000002,
    step: 5 * 365 * 24 * 60 * 60 * 1000,
    amplifier: 0.000000000002,
    label: "5 лет",
  }, // 5 лет
  {
    scale: 0.0000000001,
    step: 10 * 365 * 24 * 60 * 60 * 1000,
    amplifier: 0.000000000001,
    label: "10 лет",
  }, // 10 лет
];

// Add more steps for smoother transitions
for (let i = 1; i < steps.length; i++) {
  const prevStep = steps[i - 1];
  const nextStep = steps[i];
  const numIntermediateSteps = 1024 / steps.length;

  for (let j = 1; j < numIntermediateSteps; j++) {
    const scale =
      prevStep.scale +
      ((nextStep.scale - prevStep.scale) / numIntermediateSteps) * j;
    const amplifier =
      prevStep.amplifier +
      ((nextStep.amplifier - prevStep.amplifier) / numIntermediateSteps) * j;
    steps.splice(i, 0, {
      scale,
      step: prevStep.step,
      amplifier,
      label: `${prevStep.label} - ${nextStep.label}`,
    });
    i++;
  }
}

export class TimelineOverflowDrawer {
  private ranges: RangeData[] = [];
  private readonly container: HTMLDivElement;

  private readonly timelineElements: TimelineElementsService;
  private timelineElementsFactory = new TimelineElementsFactoryService();

  private currentTime = 0;
  private scale: number = 1; // Начальный масштаб
  private currentStartTime: number = 0; // Текущее начало времени
  private isReady: boolean = false; // Флаг, указывающий готовность к отрисовке
  private clickCallback: TimelineClickCallback; // Callback для кликов

  private isUserScrolling: boolean = false;
  private isProgrammaticScroll: boolean = false;
  private userScrollTimeout: Nullable<number> = null;
  private programmaticScrollTimeout: Nullable<number> = null;
  private scrollEndTimeout: Nullable<number> = null;
  private trackObserver: Nullable<IntersectionObserver> = null;

  private customTrackTimestamp: Nullable<number> = null; // Пользовательское время для трека
  private currentTimestamp: number = 0;

  private exportMode: boolean = false; // Режим экспорта
  private exportStartTime: Nullable<number> = null; // Время начала выбранного диапазона
  private exportEndTime: Nullable<number> = null; // Время конца выбранного диапазона
  private exportCallback: Nullable<ExportRangeCallback> = null; // Callback для экспорта

  constructor(
    container: HTMLDivElement,
    clickCallback?: TimelineClickCallback
  ) {
    this.clickCallback = clickCallback ?? (() => {});
    this.container = container;

    this.timelineElements = new TimelineElementsService(
      this.timelineElementsFactory.makeScrollContainer(),
      this.timelineElementsFactory.makeTimelineContainer(),
      this.timelineElementsFactory.makeTrack()
    );

    this.timelineElements.timelineContainer!.appendChild(
      this.timelineElements.track!
    );
    this.timelineElements.scrollContainer!.appendChild(
      this.timelineElements.timelineContainer!
    );
    this.container.appendChild(this.timelineElements.scrollContainer!);

    this.trackObserver = new IntersectionObserver(
      this.onTrackObserve.bind(this),
      {
        root: this.timelineElements.scrollContainer,
      }
    );

    this.trackObserver.observe(this.timelineElements.track!);

    this.registerListeners();
  }

  draw(currentTime: number): void {
    if (
      !this.isReady ||
      !this.timelineElements.timelineContainer ||
      this.ranges.length === 0
    ) {
      return;
    }

    this.currentTime = currentTime;

    this.timelineElements.clearTimeline();

    const startTime = this.ranges[0]?.start_time || 0;
    const endTime = this.ranges[this.ranges.length - 1]?.end_time || 0;
    const totalTimeRange = endTime - startTime; // Общее время от начала до конца всех диапазонов

    const containerWidth = this.container.offsetWidth; // Ширина контейнера

    // Рассчитываем ширину диапазонов с учетом масштаба
    const totalRangeWidth = totalTimeRange * this.scale; // totalTimeRange в масштабе

    // Если ширина всех диапазонов больше ширины контейнера, включаем скролл
    if (totalRangeWidth > containerWidth) {
      this.timelineElements.timelineContainer.style.width = `${totalRangeWidth}px`; // Задаем большую ширину таймлайна
    } else {
      this.timelineElements.timelineContainer.style.width = `${containerWidth}px`; // Устанавливаем стандартную ширину
    }

    // Виртуализация делений
    this.drawVirtualizedDivisions(startTime, totalTimeRange, totalRangeWidth);

    const rangeBlocks: HTMLDivElement[] = [];

    // Отрисовка самих диапазонов (ranges) с учётом масштаба
    this.ranges.forEach((range) => {
      const rangeStartPosition =
        ((range.start_time - startTime) / totalTimeRange) * totalRangeWidth;
      const rangeWidth = (range.duration / totalTimeRange) * totalRangeWidth;

      const rangeBlock = this.timelineElementsFactory.makeRange(
        rangeStartPosition,
        rangeWidth,
        range.type
      );

      rangeBlocks.push(rangeBlock);
    });

    this.timelineElements.timelineContainer!.append(...rangeBlocks);
    this.timelineElements.setRanges(rangeBlocks);

    // Обновление трека и маркеров экспорта
    this.updateTrackAndExportMarkers(
      currentTime,
      startTime,
      totalTimeRange,
      totalRangeWidth
    );
  }

  private updateTrackAndExportMarkers(
    currentTime: number,
    startTime: number,
    totalTimeRange: number,
    totalRangeWidth: number
  ): void {
    // Конвертируем currentTime из секунд в миллисекунды
    const currentTimeMs = currentTime * 1000;

    // Используем customTrackTimestamp (если он установлен) + текущий прогресс видео (в миллисекундах)
    this.currentTimestamp =
      this.customTrackTimestamp !== null
        ? this.customTrackTimestamp + currentTimeMs
        : startTime + currentTimeMs;

    // Рассчитываем общую длительность breaks до текущего времени (включая текущий range, если это break)
    const breakDuration = this.getBreakDurationUntil(this.currentTimestamp);

    // Рассчитываем длину break в пикселях
    const breakLengthPx = breakDuration / (totalTimeRange / totalRangeWidth);

    // Получаем ближайший корректный timestamp (игнорируя breaks)
    const nearestTimestamp = this.getNearestTimestamp(this.currentTimestamp);

    if (nearestTimestamp === undefined) {
      return;
    }

    const [validTimestamp] = nearestTimestamp;

    // Рассчитываем смещение трека с учетом breaks
    const trackPosition =
      ((validTimestamp - startTime) / totalTimeRange) * totalRangeWidth +
      breakLengthPx;

    // Обновляем позицию трека
    this.timelineElements.track!.style.left = `${trackPosition}px`;

    // Если включен режим экспорта, обновляем маркеры экспорта
    if (this.exportMode) {
      this.updateExportMarkers(startTime, totalTimeRange, totalRangeWidth);
    }
  }

  private getNearestTimestamp(
    timestamp: number
  ): [nearestTimestamp: number, range: RangeData] | undefined {
    let currentRange = this.findRangeByTimestamp(timestamp);

    // Если текущий диапазон — "data", просто возвращаем сам timestamp
    if (currentRange && currentRange.type === "data") {
      return [timestamp, currentRange];
    }

    // Если текущий диапазон — "break", находим следующий диапазон с типом "data"
    const nextDataRange = this.findNextDataRange(timestamp);
    if (nextDataRange) {
      // Возвращаем начало следующего диапазона "data"
      return [nextDataRange.start_time, nextDataRange];
    }

    return undefined; // Если нет доступных диапазонов с типом "data"
  }

  getCurrentTimestamp(): number {
    return this.currentTimestamp;
  }

  private getBreakDurationUntil(timestamp: number): number {
    let totalBreakDuration = 0;
    let startPoint =
      this.customTrackTimestamp !== null ? this.customTrackTimestamp : 0;

    for (const range of this.ranges) {
      // Если диапазон начинается после customTrackTimestamp, продолжаем
      if (range.end_time < startPoint) {
        continue;
      }

      // Проверяем диапазоны с типом 'break'
      if (range.type === "break") {
        // Если конец диапазона меньше или равен timestamp, добавляем всю длину диапазона
        if (range.end_time <= timestamp) {
          totalBreakDuration += range.end_time - range.start_time;
        }
        // Если timestamp находится внутри диапазона, добавляем только до timestamp
        else if (range.start_time <= timestamp) {
          totalBreakDuration += timestamp - range.start_time;
          break; // Останавливаемся, так как текущий range перекрывает timestamp
        }
      }

      // Прерываем цикл, если диапазон начинается после переданного timestamp
      if (range.start_time > timestamp) {
        break;
      }
    }

    return totalBreakDuration;
  }

  private findNextDataRange(timestamp: number): RangeData | null {
    // Ищем следующий диапазон с типом "data" после указанного времени
    for (const range of this.ranges) {
      if (range.start_time > timestamp && range.type === "data") {
        return range;
      }
    }
    return null; // Если не найден диапазон
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
    this.exportStartTime = null;
    this.exportEndTime = null;

    // Удаляем черты
    this.clearExportMarkers();
  }

  private clearExportMarkers(): void {
    const markers = this.timelineElements.timelineContainer!.querySelectorAll(
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

    this.timelineElements.timelineContainer!.appendChild(marker);
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

  private onTrackObserve(entries: IntersectionObserverEntry[]) {
    const trackEntry = entries[0];
    if (!trackEntry) {
      return;
    }

    if (trackEntry.isIntersecting) {
      this.isUserScrolling = false;
      return;
    }

    if (this.isUserScrolling) {
      return;
    }

    this.scrollToTrackRightEdge();
  }

  public scrollToTrackRightEdge(): void {
    if (
      !this.timelineElements.scrollContainer ||
      !this.timelineElements.timelineContainer
    )
      return;

    // Получаем позицию трека относительно timelineElements.timelineContainer
    const trackLeft = this.timelineElements.track!.offsetLeft;
    const trackWidth = this.timelineElements.track!.offsetWidth;

    // Рассчитываем необходимый scrollLeft
    const scrollContainerWidth =
      this.timelineElements.scrollContainer.offsetWidth;

    // Устанавливаем scrollLeft так, чтобы трек был на правом краю
    let newScrollLeft = trackLeft + trackWidth - scrollContainerWidth;

    // Ограничиваем scrollLeft допустимыми значениями
    const maxScrollLeft =
      this.timelineElements.scrollContainer.scrollWidth - scrollContainerWidth;
    newScrollLeft = Math.max(0, Math.min(newScrollLeft, maxScrollLeft));

    // Устанавливаем флаг программной прокрутки
    this.isProgrammaticScroll = true;

    // Используем плавную прокрутку
    this.timelineElements.scrollContainer.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });

    // Начинаем отслеживать завершение прокрутки
    this.monitorProgrammaticScrollEnd();
  }

  private monitorProgrammaticScrollEnd(): void {
    // Очищаем предыдущий таймер, если он был установлен
    if (this.programmaticScrollTimeout) {
      clearTimeout(this.programmaticScrollTimeout);
    }

    // Устанавливаем таймер для определения окончания прокрутки
    this.programmaticScrollTimeout = setTimeout(() => {
      // Прокрутка завершена
      this.isProgrammaticScroll = false;
    }, 500); // Настройте время в соответствии с длительностью плавной прокрутки
  }

  private drawVirtualizedDivisions(
    startTime: number,
    totalTimeRange: number,
    totalRangeWidth: number
  ): void {
    const divisionStep = this.getStep().step; // Шаг делений

    // Границы видимой области
    const scrollLeft = this.timelineElements.scrollContainer!.scrollLeft;
    const containerWidth = this.timelineElements.scrollContainer!.offsetWidth;

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

    // Расчет ширины одного деления в пикселях
    const divisionWidth = divisionStep * this.scale;

    // Динамическое измерение ширины метки
    const sampleTime = startTime + firstVisibleDivision * divisionStep;
    const sampleLabelText = this.formatTime(sampleTime);

    const tempLabel =
      this.timelineElementsFactory.makeTempLabel(sampleLabelText);

    document.body.appendChild(tempLabel);
    const labelWidth = tempLabel.offsetWidth;
    document.body.removeChild(tempLabel);

    // Расчет интервала между метками
    let labelInterval = 1;
    if (divisionWidth < labelWidth + 5) {
      labelInterval = Math.ceil((labelWidth + 5) / divisionWidth);
    }

    const divisions: HTMLDivElement[] = [];

    // Отрисовка видимых делений
    for (let i = firstVisibleDivision; i <= lastVisibleDivision; i++) {
      const divisionTime = startTime + i * divisionStep;
      const position =
        ((divisionTime - startTime) / totalTimeRange) * totalRangeWidth;

      const division = this.timelineElementsFactory.makeDivision(
        position,
        i % labelInterval === 0 ? this.formatTime(divisionTime) : undefined
      );

      divisions.push(division);
    }

    this.timelineElements.setDivisions(divisions);
    this.timelineElements.timelineContainer!.append(...divisions);
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

  setOptions(ranges: RangeData[]): void {
    this.ranges = ranges;
    this.currentStartTime = this.ranges[0]?.start_time || 0;
    this.isReady = true;

    const totalTimeRange =
      ranges[ranges.length - 1].end_time - ranges[0].start_time;
    const containerWidth = this.container.offsetWidth;

    // Устанавливаем начальный масштаб так, чтобы диапазоны занимали всю ширину контейнера
    this.scale = containerWidth / totalTimeRange;

    this.draw(this.currentStartTime); // Отрисовка шкалы после установки диапазонов
  }

  clear(): void {
    if (!this.timelineElements.scrollContainer) {
      return;
    }

    this.currentTime = 0;

    this.clearListeners();

    this.trackObserver?.disconnect();

    this.container.removeChild(this.timelineElements.scrollContainer!);
    this.timelineElements.scrollContainer = null;
    this.timelineElements.timelineContainer = null;

    this.isReady = false;
  }

  setCustomTrackTimestamp(timestamp: number) {
    this.customTrackTimestamp = timestamp;
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

  private getStep() {
    const scaleFactor = this.scale;

    const stepInfo = steps.find((step) => scaleFactor > step.scale);

    return stepInfo ?? steps[steps.length - 1];
  }

  private clickEventListener(event: MouseEvent): void {
    event.preventDefault();

    // Получаем размеры контейнера
    const containerRect = this.container.getBoundingClientRect();

    // Позиция клика относительно контейнера
    const clickX = event.clientX - containerRect.left;

    // Получаем текущую ширину видимого контейнера и всю ширину таймлайна
    const scrollLeft = this.timelineElements.scrollContainer?.scrollLeft || 0;
    const totalTimelineWidth =
      this.timelineElements.timelineContainer?.offsetWidth || 0;

    // Рассчитываем позицию клика с учётом прокрутки и масштаба
    const totalClickPosition = (clickX + scrollLeft) / totalTimelineWidth;

    // Время на таймлайне, соответствующее позиции клика
    const startTime = this.ranges[0]?.start_time || 0;
    const endTime = this.ranges[this.ranges.length - 1]?.end_time || 0;
    const totalTimeRange = endTime - startTime;

    const clickedTimestamp = startTime + totalClickPosition * totalTimeRange;

    // Находим ближайшую временную метку
    const nearestTimestamp = this.getNearestTimestamp(clickedTimestamp);
    if (nearestTimestamp === undefined) {
      return;
    }

    const [timestamp, clickedRange] = nearestTimestamp;

    // Обработка режима экспорта
    if (this.exportMode) {
      if (this.exportStartTime === null) {
        this.exportStartTime = timestamp;
      } else if (this.exportEndTime === null) {
        this.exportEndTime = timestamp;

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
        this.exportStartTime = timestamp;
        this.exportEndTime = null;
      }

      this.updateExportMarkers(
        startTime,
        totalTimeRange,
        this.timelineElements.timelineContainer!.offsetWidth
      );
    } else {
      // Пользовательское время для трека
      this.customTrackTimestamp = timestamp;
      this.clickCallback?.(timestamp, clickedRange);
    }
  }

  private scrollEventListener() {
    // Очищаем предыдущий таймер завершения прокрутки
    if (this.scrollEndTimeout) {
      clearTimeout(this.scrollEndTimeout);
    }

    // Устанавливаем таймер для определения окончания прокрутки
    this.scrollEndTimeout = setTimeout(() => {
      if (this.isProgrammaticScroll) {
        this.isProgrammaticScroll = false;
      }
    }, 100); // Настройте задержку по необходимости

    if (this.isProgrammaticScroll) {
      // Если прокрутка программная, ничего не делаем
      return;
    }

    // Пользовательская прокрутка
    this.isUserScrolling = true;

    // Очищаем предыдущий таймер пользовательской прокрутки
    if (this.userScrollTimeout) {
      clearTimeout(this.userScrollTimeout);
    }

    const rangesDuration =
      this.ranges[this.ranges.length - 1].end_time - this.ranges[0].start_time;

    // Устанавливаем таймер для сброса флага пользовательской прокрутки
    this.userScrollTimeout = setTimeout(() => {
      this.isUserScrolling = false;
    }, rangesDuration);

    const startTime = this.ranges[0]?.start_time || 0;
    const endTime = this.ranges[this.ranges.length - 1]?.end_time || 0;
    const totalTimeRange = endTime - startTime;
    const totalRangeWidth = totalTimeRange * this.scale;

    this.timelineElements.clearDivisions();

    this.drawVirtualizedDivisions(startTime, totalTimeRange, totalRangeWidth);
    this.updateTrackAndExportMarkers(
      this.currentTime,
      this.currentStartTime,
      totalTimeRange,
      totalRangeWidth
    );
  }

  private wheelEventListener(event: WheelEvent) {
    event.preventDefault();

    if (event.shiftKey) {
      // Если зажата клавиша Shift — горизонтальная прокрутка
      this.container.scrollLeft += event.deltaY;
    } else {
      // Иначе — изменение масштаба

      // Устанавливаем флаг пользовательского взаимодействия
      this.isUserScrolling = true;

      // Очищаем предыдущий таймер, если он был установлен
      if (this.userScrollTimeout) {
        clearTimeout(this.userScrollTimeout);
      }

      // Устанавливаем таймер для сброса флага пользовательского взаимодействия
      // Например, через 2 секунды после последнего масштабирования
      this.userScrollTimeout = setTimeout(() => {
        this.isUserScrolling = false;
      }, 2000);

      // Ограничим максимальные изменения при каждом событии скролла
      // const scaleChange = Math.sign(event.deltaY) *  0.000002;
      const scaleChange = Math.sign(event.deltaY) * this.getStep().amplifier; // Более мелкий шаг для плавности
      console.log(
        "🚀 ~ TimelineOverflowDrawer ~ wheelEventListener ~ scaleChange:",
        scaleChange,
        this.getStep()
      );

      const totalTimeRange =
        this.ranges[this.ranges.length - 1].end_time -
        this.ranges[0].start_time;
      const containerWidth = this.container.offsetWidth;

      // Рассчитаем максимальный масштаб так, чтобы диапазоны не могли выходить за пределы контейнера
      const maxScale = 1; // Масштабирование не должно превышать единичный масштаб
      const minScale = containerWidth / totalTimeRange; // Минимальный масштаб, при котором диапазоны занимают контейнер

      // Текущее значение масштаба перед изменением
      const previousScale = this.scale;

      // Ограничиваем масштаб значениями от minScale до maxScale

      const step = this.getStep();
      console.log(step.label);

      // const logScaleChange =
      //   scaleChange * Math.log10(Math.abs(this.scale)) * step.amplifier;

      this.scale = Math.min(
        maxScale,
        Math.max(minScale, this.scale + scaleChange)
      );

      if (this.isReady) {
        // Рассчитаем позицию трека относительно предыдущего масштаба
        const track = this.timelineElements.track;
        if (track) {
          const trackLeft = track.offsetLeft; // Позиция трека до масштабирования
          const visibleWidth =
            this.timelineElements.scrollContainer!.offsetWidth; // Ширина видимой области

          // Сохраним смещение относительно центра или границы
          let trackOffsetFromLeft =
            trackLeft - this.timelineElements.scrollContainer!.scrollLeft;

          if (trackOffsetFromLeft > visibleWidth / 2) {
            trackOffsetFromLeft = visibleWidth / 2; // Центрируем трек, если он далеко справа
          } else if (trackLeft <= 0) {
            trackOffsetFromLeft = 0; // Трек в самом начале
          }

          // Обновляем отрисовку
          this.draw(this.currentTime);

          // После перерисовки восстанавливаем позицию трека
          const newTrackLeft = (trackLeft / previousScale) * this.scale;
          const newScrollLeft = Math.max(0, newTrackLeft - trackOffsetFromLeft);
          this.timelineElements.scrollContainer!.scrollTo({
            left: newScrollLeft,
            behavior: "auto",
          });
        } else {
          // Если трека нет, просто обновляем таймлайн
          this.draw(this.currentTime);
        }

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
    this.timelineElements.scrollContainer?.addEventListener(
      "scroll",
      this.scrollEventListener.bind(this)
    );
    this.timelineElements.timelineContainer?.addEventListener(
      "wheel",
      this.wheelEventListener.bind(this)
    );
    this.timelineElements.timelineContainer?.addEventListener(
      "click",
      this.clickEventListener.bind(this)
    );
  }

  private clearListeners() {
    this.timelineElements.scrollContainer?.removeEventListener(
      "scroll",
      this.scrollEventListener
    );
    this.timelineElements.timelineContainer?.removeEventListener(
      "wheel",
      this.wheelEventListener
    );
    this.timelineElements.timelineContainer?.removeEventListener(
      "click",
      this.clickEventListener
    );
  }
}
