import { Nullable } from "../../../types/global";
import { RangeData } from "../../../types/range";
import {
  ExportRangeCallback,
  TimelineClickCallback,
} from "../../../types/timeline";
import { TimelineElementsFactoryService } from "./timeline/timeline-elements-factory.service";
import { TimelineElementsService } from "./timeline/timeline-elements.service";
import { formatPhantomTime, formatTime } from "../../../helpers/format.helper";
import {
  TIMELINE_DIVISION_STEPS,
  TIMELINE_STEPS_OPTIONS,
} from "../../../constants/timeline-steps";
import { EventBus } from "../../event-bus.service";
import { Logger } from "../../logger/logger.service";
import { TimelineMathService } from "./timeline/timeline-math.service";
import { SelectOption } from "../../../types/controls";
import { TimelineScaleService } from "./timeline/timeline-scale.service";

const MOUSE_MICRO_MOVE_TIMEOUT = 100;
const SCROLL_TO_TRACK_OFFSET_PX = 5;

export class TimelineOverflowDrawer {
  private readonly container: HTMLDivElement;

  private readonly timelineElements: TimelineElementsService;
  private readonly timelineElementsFactory: TimelineElementsFactoryService;
  private readonly timelineMathService = new TimelineMathService();
  private readonly timelineScaleService = new TimelineScaleService();

  private isReady: boolean = false; // Флаг, указывающий готовность к отрисовке
  private clickCallback: TimelineClickCallback; // Callback для кликов

  private scrollTimeout: Nullable<number> = null;
  private isUserScrolling: boolean = false;
  private isProgrammaticScroll: boolean = false;
  private userScrollTimeout: Nullable<number> = null;
  private programmaticScrollTimeout: Nullable<number> = null;
  private scrollEndTimeout: Nullable<number> = null;

  private trackIntersectionObserver: IntersectionObserver;
  private trackObserverId: Nullable<number> = null;

  private resizeTimelineObserver: ResizeObserver;

  private currentTimestamp: number = 0;

  private exportMode: boolean = false; // Режим экспорта
  private exportStartTime: Nullable<number> = null; // Время начала выбранного диапазона
  private exportEndTime: Nullable<number> = null; // Время конца выбранного диапазона
  private exportCallback: Nullable<ExportRangeCallback> = null; // Callback для экспорта

  private eventBus: EventBus;
  private logger: Logger;

  private isShowPhantomTrack = false;
  private isMouseDown = false;
  private isMouseMove = false;
  private isMouseMicroMove = false;

  private lastMouseX: Nullable<number> = 0;
  private phantomTrackLastPosition: Nullable<number> = 0;
  private phantomTrackLastTime: Nullable<number> = 0;

  private isWheel = false;
  private isManuallyScale = false;

  private originalMouseUp: Nullable<EventListener> = null;
  private originalMouseMove: Nullable<EventListener> = null;

  constructor(
    id: string,
    container: HTMLDivElement,
    clickCallback?: TimelineClickCallback
  ) {
    this.eventBus = EventBus.getInstance(id);
    this.logger = new Logger(id, "TimelineOverflowDrawer");

    this.clickCallback = clickCallback ?? (() => {});
    this.container = container;

    this.timelineElementsFactory = new TimelineElementsFactoryService();
    const [phantomTrack, phantomTrackTimeCard, phantomTrackTimeCardText] =
      this.timelineElementsFactory.makePhantomTrack();

    this.timelineElements = new TimelineElementsService(
      this.timelineElementsFactory.makeScrollContainer(),
      this.timelineElementsFactory.makeContentContainer(),
      this.timelineElementsFactory.makeTimelineContainer(),
      this.timelineElementsFactory.makeTrackContainer(),
      this.timelineElementsFactory.makeTrack(),
      phantomTrack,
      phantomTrackTimeCard,
      phantomTrackTimeCardText
    );

    this.timelineElements.trackContainer!.appendChild(
      this.timelineElements.track!
    );

    this.timelineElements.contentContainer!.appendChild(
      this.timelineElements.trackContainer!
    );

    this.container.appendChild(phantomTrackTimeCard);

    this.timelineElements.contentContainer!.appendChild(
      this.timelineElements.phantomTrack!
    );
    this.timelineElements.contentContainer!.appendChild(
      this.timelineElements.timelineContainer!
    );
    this.timelineElements.scrollContainer!.appendChild(
      this.timelineElements.contentContainer!
    );

    this.container.appendChild(this.timelineElements.scrollContainer!);

    this.trackIntersectionObserver = new IntersectionObserver(
      this.onTrackObserve,
      {
        root: this.timelineElements.scrollContainer,
        rootMargin: `0px ${-SCROLL_TO_TRACK_OFFSET_PX}px 0px 0px`,
        threshold: 0.1,
      }
    );
    this.trackIntersectionObserver.observe(this.timelineElements.track!);

    this.trackObserverId = setInterval(() => {
      if (this.isWheel) {
        return;
      }

      this.tryScrollToTrack();
    }, 100);

    this.resizeTimelineObserver = new ResizeObserver(this.onTimelineResize);
    this.resizeTimelineObserver.observe(this.timelineElements.scrollContainer!);

    this.originalMouseMove = document.body
      .onmousemove as Nullable<EventListener>;
    this.originalMouseUp = document.body.onmouseup as Nullable<EventListener>;

    this.registerListeners();
    this.setupEvents();
  }

  draw(
    currentTimestamp: number,
    isWheelSource = false,
    withoutDivisions = false
  ): void {
    this.logger.log("trace", `Отрисовываем таймштемп ${currentTimestamp}`);

    if (!this.isWheel && isWheelSource) {
      return;
    }

    if (!this.isReady || !this.timelineElements.timelineContainer) {
      this.logger.error("trace", `Не удается отрисовать`);
      return;
    }

    this.currentTimestamp = currentTimestamp;

    this.timelineElements.clearRanges();

    // Рассчитываем ширину диапазонов с учетом масштаба
    const totalRangeWidth =
      this.timelineMathService.duration * this.timelineScaleService.scale; // totalTimeRange в масштабе

    this.timelineElements.contentContainer!.style.width = `${totalRangeWidth}px`; // Задаем большую ширину контейнеру с контентом
    this.timelineElements.timelineContainer.style.width = `${totalRangeWidth}px`; // Задаем большую ширину таймлайна
    this.timelineElements.trackContainer!.style.width = `${totalRangeWidth}px`; // Задаем большую ширину треку

    if (!withoutDivisions) {
      this.drawVirtualizedDivisions(
        this.timelineMathService.startTimestamp,
        this.timelineMathService.duration,
        totalRangeWidth
      );
    }

    const rangeBlocks: HTMLDivElement[] = [];

    // Отрисовка самих диапазонов (ranges) с учётом масштаба
    this.timelineMathService.ranges.forEach((range) => {
      const rangeStartPosition =
        ((range.start_time - this.timelineMathService.startTimestamp) /
          this.timelineMathService.duration) *
        totalRangeWidth;
      const rangeWidth =
        (range.duration / this.timelineMathService.duration) * totalRangeWidth;

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
      this.timelineMathService.startTimestamp,
      this.timelineMathService.duration,
      totalRangeWidth
    );
  }

  private updateTrackAndExportMarkers(
    startTime: number,
    totalTimeRange: number,
    totalRangeWidth: number
  ): void {
    // Получаем ближайший корректный timestamp (игнорируя breaks)
    const nearestTimestamp = this.getNearestTimestamp(this.currentTimestamp);

    if (nearestTimestamp === undefined) {
      return;
    }

    const [validTimestamp] = nearestTimestamp;

    // Рассчитываем смещение трека с учетом breaks
    const trackPosition =
      ((validTimestamp - startTime) / totalTimeRange) * totalRangeWidth;

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
    let currentRange = this.timelineMathService.findRangeByTimestamp(timestamp);

    // Если текущий диапазон — "data", просто возвращаем сам timestamp
    if (currentRange && currentRange.type === "data") {
      return [timestamp, currentRange];
    }

    // Если текущий диапазон — "break", находим следующий диапазон с типом "data"
    const nextDataRange = this.timelineMathService.findNextDataRange(timestamp);
    if (nextDataRange) {
      // Возвращаем начало следующего диапазона "data"
      return [nextDataRange.start_time, nextDataRange];
    }

    return undefined; // Если нет доступных диапазонов с типом "data"
  }

  // Включение режима экспорта
  enableExportMode(callback: ExportRangeCallback): void {
    this.logger.log("trace", `Включаем экспорт мод`);

    this.exportMode = true;
    this.exportCallback = callback;
    this.exportStartTime = null;
    this.exportEndTime = null;

    // Очищаем предыдущие черты
    this.clearExportMarkers();
  }

  // Отключение режима экспорта
  disableExportMode(): void {
    this.logger.log("trace", `Выключаем экспорт мод`);

    this.exportMode = false;
    this.exportCallback = null;
    this.exportStartTime = null;
    this.exportEndTime = null;

    // Удаляем черты
    this.clearExportMarkers();
  }

  private clearExportMarkers(): void {
    this.logger.log("trace", `Очищаем маркеры экспорта`);

    const markers = this.timelineElements.timelineContainer!.querySelectorAll(
      ".video-player__timeline__export-marker"
    );
    markers.forEach((marker) => marker.remove());
  }

  private addExportMarker(position: number, type: "start" | "end"): void {
    this.logger.log("trace", `Добавляем маркер экспорта`);

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
    this.logger.log("trace", `Обновляем экспорт маркеры`);

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

  private onTimelineResize = () => {
    this.logger.log("trace", `Произошло изменение размеров`);

    const containerWidth = this.timelineElements.scrollContainer!.offsetWidth;

    this.timelineScaleService.setContainerWidth(containerWidth);

    this.draw(this.currentTimestamp);
  };

  private onTrackObserve = (entries: IntersectionObserverEntry[]) => {
    const trackEntry = entries[0];

    if (trackEntry.isIntersecting) {
      this.logger.log("trace", `Трек в зоне видимости`);

      this.isUserScrolling = false;

      return;
    }

    if (this.isWheel) {
      return;
    }

    if (this.isUserScrolling) {
      return;
    }

    this.logger.log("trace", `Трек за пределами видимости`);

    this.tryScrollToTrack();
  };

  public scrollTrackToAlign(
    track: HTMLElement,
    align: "center" | "left" | "right" | "visible",
    offset = 0,
    withoutDraw = false
  ) {
    this.logger.log("trace", `Скроллируем до трека`);

    if (
      !this.timelineElements.scrollContainer ||
      !this.timelineElements.trackContainer
    )
      return;

    // Получаем позицию трека относительно timelineElements.timelineContainer
    const trackLeft = track.offsetLeft;
    const trackRight = track.offsetLeft;
    const trackWidth = track.offsetWidth;

    // Рассчитываем необходимый scrollLeft
    const scrollContainerWidth =
      this.timelineElements.scrollContainer.offsetWidth;

    let newScroll = 0;
    if (align === "visible") {
      const isRightCorner = trackRight - offset < scrollContainerWidth;
      const isLeftCorner = trackRight + trackWidth > scrollContainerWidth;

      if (isRightCorner) {
        newScroll = trackRight - offset;
      } else if (isLeftCorner) {
        newScroll = trackRight + trackWidth - scrollContainerWidth;
      } else {
        return;
      }
    } else if (align === "right") {
      newScroll = trackLeft + trackWidth - scrollContainerWidth + offset;
    } else if (align === "left") {
      newScroll = trackRight - offset;
    } else {
      newScroll =
        trackLeft - scrollContainerWidth / 2 + trackWidth / 2 + offset;
    }

    // Ограничиваем scrollLeft допустимыми значениями
    const maxScrollLeft =
      this.timelineElements.scrollContainer.scrollWidth - scrollContainerWidth;
    newScroll = Math.max(0, Math.min(newScroll, maxScrollLeft));

    // Устанавливаем флаг программной прокрутки
    this.isProgrammaticScroll = true;

    // Используем плавную прокрутку
    this.timelineElements.scrollContainer!.scrollLeft = newScroll;

    if (!withoutDraw) {
      setTimeout(() => {
        this.draw(this.currentTimestamp);
      });
    }

    // Начинаем отслеживать завершение прокрутки
    this.monitorProgrammaticScrollEnd();
  }

  public forceScrollToTrack() {
    this.isUserScrolling = false;
  }

  private tryScrollToTrack(
    position: "left" | "right" | "center" = "right",
    force = false,
    onlyVisible = false
  ) {
    if (this.isManuallyScale && !force) {
      return;
    }

    const isVisibleTrack = this.checkTrackVisibility(
      this.timelineElements.track!
    );

    const totalRangeWidth =
      this.timelineMathService.duration * this.timelineScaleService.scale;

    if (isVisibleTrack && this.isUserScrolling) {
      this.isUserScrolling = false;
    }

    const update = () => {
      if (this.isWheel && this.wheelTimeoutId !== null) {
        clearTimeout(this.wheelTimeoutId);
      }

      this.isWheel = true;

      this.draw(this.currentTimestamp, true, true);

      this.scrollTrackToAlign(
        this.timelineElements.track!,
        !onlyVisible ? position : "visible",
        SCROLL_TO_TRACK_OFFSET_PX,
        true
      );

      this.drawVirtualizedDivisions(
        this.timelineMathService.startTimestamp,
        this.timelineMathService.duration,
        totalRangeWidth,
        true
      );

      if (this.isShowPhantomTrack) {
        this.updatePhantomTrack();
      }

      this.wheelTimeoutId = setTimeout(() => {
        this.isWheel = false;
      }, 250);
    };

    if (force) {
      this.forceScrollToTrack();
      update();

      return;
    }

    if (this.isMouseDown) {
      return;
    }

    if (!this.isUserScrolling && !this.isMouseMove && !this.isMouseDown) {
      if (!isVisibleTrack) {
        update();
      } else {
        if (this.isUserScrolling) {
          this.isUserScrolling = false;
        }
      }
    }
  }

  private checkTrackVisibility(track: HTMLDivElement): boolean {
    const trackRect = track.getBoundingClientRect();
    const containerRect =
      this.timelineElements.scrollContainer!.getBoundingClientRect();

    return (
      trackRect.right >= containerRect.left &&
      trackRect.left <= containerRect.right - SCROLL_TO_TRACK_OFFSET_PX
    );
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
    }, 300);
  }

  private prevTotalRangeWidth: Nullable<number> = null;
  private prevScale: Nullable<number> = null;

  private drawVirtualizedDivisions(
    startTime: number,
    totalTimeRange: number,
    totalRangeWidth: number,
    force = false
  ): void {
    if (
      !force &&
      this.prevTotalRangeWidth === totalRangeWidth &&
      this.prevScale === this.timelineScaleService.scale
    ) {
      return;
    }

    this.prevTotalRangeWidth = totalRangeWidth;
    this.prevScale = this.timelineScaleService.scale;

    this.timelineElements.clearDivisions();

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
    const divisionWidth = divisionStep * this.timelineScaleService.scale;

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

  setOptions(ranges: RangeData[], updateScale = true): void {
    this.logger.log(
      "trace",
      `Устанавливаем фрагменты: ${JSON.stringify(ranges)}`
    );

    this.timelineMathService.setRanges(ranges);

    this.isReady = true;

    if (updateScale) {
      const containerWidth = this.timelineElements.scrollContainer!.offsetWidth;

      const options: SelectOption[] = TIMELINE_STEPS_OPTIONS.map((step) => {
        return {
          label: step.label,
          value: step.value,
          disabled: Number(step.value) > this.timelineMathService.duration,
        };
      }).sort((a, b) => Number(a.value) - Number(b.value));

      options.push({
        label: "Max",
        value: String(this.timelineMathService.duration),
      });

      this.eventBus.emit("set-timeline-scale-options", [
        options[options.length - 1].value,
        options,
      ]);

      // Устанавливаем начальный масштаб так, чтобы диапазоны занимали всю ширину контейнера
      this.timelineScaleService.setMaxViewedTime(
        this.timelineMathService.duration
      );
      this.timelineScaleService.setContainerWidth(containerWidth);
      this.timelineScaleService.setViewedTime(
        this.timelineMathService.duration
      );

      this.draw(this.timelineMathService.startTimestamp); // Отрисовка шкалы после установки диапазонов
    }
  }

  clear(): void {
    this.logger.log("trace", `Очищаем сервис`);

    if (!this.timelineElements.scrollContainer) {
      return;
    }

    this.currentTimestamp = 0;
    this.phantomTrackLastPosition = null;
    this.phantomTrackLastTime = null;

    this.clearEvents();
    this.clearListeners();

    this.container.removeChild(this.timelineElements.scrollContainer!);
    this.timelineElements.scrollContainer = null;
    this.timelineElements.timelineContainer = null;

    if (this.trackObserverId !== null) {
      clearInterval(this.trackObserverId);
    }

    this.isReady = false;
  }

  private formatTime(time: number): string {
    return formatTime(time, this.timelineScaleService.scale);
  }

  private getStep() {
    const scaleFactor = this.timelineScaleService.scale;

    const stepInfo = TIMELINE_DIVISION_STEPS.find(
      (step) => scaleFactor > step.scale
    );

    return (
      stepInfo ?? TIMELINE_DIVISION_STEPS[TIMELINE_DIVISION_STEPS.length - 1]
    );
  }

  private setScale = (viewedTime: number) => {
    this.logger.log("trace", `Устанавливаем масштаб равный ${viewedTime}`);
    this.isManuallyScale = true;

    if (this.isWheel && this.wheelTimeoutId !== null) {
      clearTimeout(this.wheelTimeoutId);
    }

    this.isWheel = true;

    const containerWidth = this.timelineElements.scrollContainer!.offsetWidth;

    this.timelineScaleService.setContainerWidth(containerWidth);
    this.timelineScaleService.setViewedTime(viewedTime);

    setTimeout(() => {
      this.tryScrollToTrack("center", true, false);

      this.isManuallyScale = false;
    });

    this.wheelTimeoutId = setTimeout(() => {
      this.isWheel = false;
    }, 250);
  };

  private clickEventListener(event: MouseEvent): void {
    event.preventDefault();

    const time = this.getTimestampByPosition(event.clientX);
    if (!time) {
      return;
    }

    const [timestamp, clickedRange] = time;

    const formattedTimestamp = Math.round(timestamp);
    const formattedRange: RangeData = {
      ...clickedRange,
      start_time: Math.round(clickedRange.start_time),
      end_time: Math.round(clickedRange.end_time),
      duration:
        Math.round(clickedRange.end_time) - Math.round(clickedRange.start_time),
    };

    // Обработка режима экспорта
    if (this.exportMode) {
      if (this.exportStartTime === null) {
        this.exportStartTime = formattedTimestamp;
      } else if (this.exportEndTime === null) {
        this.exportEndTime = formattedTimestamp;

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
        this.exportStartTime = formattedTimestamp;
        this.exportEndTime = null;
      }

      this.updateExportMarkers(
        this.timelineMathService.startTimestamp,
        this.timelineMathService.duration,
        this.timelineElements.timelineContainer!.offsetWidth
      );
    } else {
      this.clickCallback?.(formattedTimestamp, formattedRange);
    }
  }

  private showPhantomTrack() {
    this.logger.log("trace", `Показываем фантомный трек`);
    this.timelineElements.phantomTrack!.style.visibility = "visible";
    this.timelineElements.phantomTrackTimeCard!.style.visibility = "visible";
  }

  private hidePhantomTrack() {
    this.logger.log("trace", `Скрываем фантомный трек`);
    this.timelineElements.phantomTrack!.style.visibility = "hidden";
    this.timelineElements.phantomTrackTimeCard!.style.visibility = "hidden";
  }

  private onMouseMove = (event: MouseEvent) => {
    if (!this.isMouseMicroMove && this.isMouseDown) {
      this.isMouseMove = true;

      if (this.isShowPhantomTrack) {
        this.hidePhantomTrack();
      }

      let deltaX = (this.lastMouseX ?? 0) - event.clientX;
      if (this.lastMouseX === null) {
        this.lastMouseX = event.clientX;
        return;
      }

      this.lastMouseX = event.clientX;

      this.timelineElements.scrollContainer!.scrollBy({
        left: deltaX,
      });
    } else {
      this.updatePhantomTrack(event.clientX);
    }
  };

  private updatePhantomTrack(positionX?: number) {
    this.logger.log("trace", `Обновляем фантомный трек`);

    const position = positionX ?? this.phantomTrackLastPosition;
    if (position === null) {
      return;
    }

    const time = this.getTimestampByPosition(position, true);
    if (!time) {
      return;
    }

    const [timestamp] = time;

    if (!this.isWheel) {
      this.phantomTrackLastTime = timestamp;
    }

    if (positionX !== undefined) {
      this.phantomTrackLastPosition = positionX;
    }

    // Рассчитываем ширину диапазонов с учетом масштаба
    const totalRangeWidth =
      this.timelineMathService.duration * this.timelineScaleService.scale; // totalTimeRange в масштабе

    if (this.timelineMathService.duration === 0) {
      return;
    }

    const scrollLeft = this.timelineElements.scrollContainer!.scrollLeft;

    const trackPosition =
      ((timestamp - this.timelineMathService.startTimestamp) /
        this.timelineMathService.duration) *
        totalRangeWidth -
      scrollLeft +
      this.timelineElements.scrollContainer!.offsetLeft;

    // Обновляем позицию трека
    this.timelineElements.phantomTrack!.style.left = `${trackPosition}px`;

    const phantomTrackCardWidth =
      this.timelineElements.phantomTrackTimeCard!.offsetWidth;
    const phantomTrackTimeCardSelfLeftOffset = phantomTrackCardWidth / 2;

    let phantomTrackTimeCardLeftOffset =
      this.timelineElements.phantomTrack!.offsetLeft -
      phantomTrackTimeCardSelfLeftOffset;

    if (
      phantomTrackTimeCardLeftOffset + phantomTrackCardWidth >=
      this.timelineElements.scrollContainer!.offsetWidth
    ) {
      phantomTrackTimeCardLeftOffset =
        this.timelineElements.scrollContainer!.offsetWidth -
        phantomTrackCardWidth -
        1;
    }
    if (phantomTrackTimeCardLeftOffset <= 0) {
      phantomTrackTimeCardLeftOffset = 0;
    }

    this.timelineElements.phantomTrackTimeCard!.style.left = `${phantomTrackTimeCardLeftOffset}px`;
    this.timelineElements.phantomTrackTimeCard!.style.top = `${
      this.timelineElements.phantomTrack!.offsetTop
    }px`;

    this.timelineElements.phantomTrackTimeCardText!.innerText =
      formatPhantomTime(timestamp);
  }

  private onMouseOver = () => {
    this.isShowPhantomTrack = true;
    this.showPhantomTrack();
  };

  private onMouseOut = () => {
    this.isShowPhantomTrack = false;
    this.phantomTrackLastPosition = null;
    this.phantomTrackLastTime = null;
    this.hidePhantomTrack();
  };

  private onMouseDown = () => {
    this.isMouseDown = true;
    this.isMouseMove = false;

    this.isMouseMicroMove = true;

    setTimeout(() => {
      this.isMouseMicroMove = false;
    }, MOUSE_MICRO_MOVE_TIMEOUT);
  };

  private onMouseUp = (event: MouseEvent) => {
    if (!this.isMouseMove) {
      this.clickEventListener(event);
    }

    if (this.isShowPhantomTrack) {
      this.updatePhantomTrack(event.clientX);
      this.showPhantomTrack();
    }

    this.isMouseDown = false;
    this.isMouseMove = false;
    this.isMouseMicroMove = false;

    this.lastMouseX = null;
  };

  private onGlobalMouseUp = (event: MouseEvent) => {
    if (!this.isMouseDown) {
      this.originalMouseUp?.(event);
      return;
    }

    this.isMouseDown = false;
    this.isMouseMove = false;
    this.isMouseMicroMove = false;

    this.lastMouseX = null;

    this.originalMouseUp?.(event);
  };

  private onGlobalMouseMove = (event: MouseEvent) => {
    if (!this.isMouseDown) {
      this.originalMouseMove?.(event);
      return;
    }

    this.onMouseMove(event);
    this.originalMouseMove?.(event);
  };

  private onGlobalMouseLeave = () => {
    if (!this.isMouseDown) {
      return;
    }

    this.isMouseDown = false;
    this.isMouseMove = false;
    this.isMouseMicroMove = false;
    this.phantomTrackLastPosition = null;
    this.phantomTrackLastTime = null;

    this.lastMouseX = null;
  };

  private getTimestampByPosition(
    position: number,
    absolute: boolean = false
  ): Nullable<[timestamp: number, range: RangeData]> {
    const containerRect =
      this.timelineElements.scrollContainer!.getBoundingClientRect();

    // Позиция клика относительно контейнера
    const clickX = position - containerRect.left;

    // Получаем текущую ширину видимого контейнера и всю ширину таймлайна
    const scrollLeft = this.timelineElements.scrollContainer?.scrollLeft || 0;

    // Рассчитываем позицию клика с учётом прокрутки и масштаба
    const totalClickPosition =
      (clickX + scrollLeft) / this.timelineScaleService.scale;

    const clickedTimestamp =
      this.timelineMathService.startTimestamp + totalClickPosition;

    if (absolute) {
      return [
        clickedTimestamp,
        { start_time: 0, end_time: 0, duration: 0, type: "break" },
      ];
    }

    // Находим ближайшую временную метку
    const nearestTimestamp = this.getNearestTimestamp(clickedTimestamp);
    if (nearestTimestamp === undefined) {
      return null;
    }

    return nearestTimestamp;
  }

  private scrollEventListener = () => {
    if (this.isWheel) {
      return;
    }

    if (this.scrollEndTimeout) {
      clearTimeout(this.scrollEndTimeout);
    }

    if (this.isShowPhantomTrack) {
      this.updatePhantomTrack();
    }

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

    // Устанавливаем таймер для сброса флага пользовательской прокрутки
    this.userScrollTimeout = setTimeout(() => {
      if (this.isProgrammaticScroll) {
        this.isProgrammaticScroll = false;
      }
    }, 300);

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    const totalRangeWidth =
      this.timelineMathService.duration * this.timelineScaleService.scale;

    this.drawVirtualizedDivisions(
      this.timelineMathService.startTimestamp,
      this.timelineMathService.duration,
      totalRangeWidth,
      true
    );

    this.updateTrackAndExportMarkers(
      this.timelineMathService.startTimestamp,
      this.timelineMathService.duration,
      totalRangeWidth
    );
  };

  wheelTimeoutId: Nullable<number> = null;

  private wheelEventListener = (event: WheelEvent) => {
    event.preventDefault();

    if (event.shiftKey) {
      // Если зажата клавиша Shift — горизонтальная прокрутка
      this.container.scrollLeft += event.deltaY;
    } else {
      if (this.isWheel && this.wheelTimeoutId !== null) {
        clearTimeout(this.wheelTimeoutId);
      }

      this.isWheel = true;

      // Устанавливаем флаг пользовательского взаимодействия
      this.isUserScrolling = false;

      // Очищаем предыдущий таймер, если он был установлен
      if (this.userScrollTimeout) {
        clearTimeout(this.userScrollTimeout);
      }

      const oldScale = this.timelineScaleService.scale;

      const scaleChange = Math.sign(event.deltaY) * this.getStep().scrollStep;

      // Ограничиваем масштаб значениями от minScale до maxScale
      this.timelineScaleService.addViewedTime(scaleChange);

      // Если ширина всех диапазонов больше ширины контейнера, включаем скролл
      if (
        this.timelineScaleService.isMaximumTime() ||
        this.timelineScaleService.isMinimumTime()
      ) {
        this.eventBus.emit(
          "manual-scale-change",
          String(this.timelineScaleService.getViewedTime())
        );
      } else {
        this.eventBus.emit("manual-scale-change", "");
      }

      if (this.isReady) {
        this.draw(this.currentTimestamp, true, true);

        if (this.phantomTrackLastTime !== null) {
          const totalRangeWidth =
            this.timelineMathService.duration * this.timelineScaleService.scale; // totalTimeRange в масштабе

          if (this.timelineMathService.duration === 0) {
            return;
          }

          const mouseX =
            event.clientX -
            this.timelineElements.scrollContainer!.getBoundingClientRect().left;

          const position =
            ((this.phantomTrackLastTime -
              this.timelineMathService.startTimestamp) /
              this.timelineMathService.duration) *
            totalRangeWidth;

          const newScrollLeft =
            position - mouseX * (this.timelineScaleService.scale / oldScale);

          this.timelineElements.scrollContainer!.scrollLeft = newScrollLeft;

          this.drawVirtualizedDivisions(
            this.timelineMathService.startTimestamp,
            this.timelineMathService.duration,
            totalRangeWidth,
            true
          );
        }

        // Обновляем маркеры экспорта при изменении масштаба
        this.updateExportMarkers(
          this.timelineMathService.startTimestamp,
          this.timelineMathService.duration,
          this.timelineMathService.duration * this.timelineScaleService.scale
        );
      }

      this.wheelTimeoutId = setTimeout(() => {
        this.isWheel = false;
        this.isUserScrolling = true;
      }, 250);
    }
  };

  private registerListeners() {
    this.logger.log("trace", `Регистрируем слушателей`);

    this.timelineElements.scrollContainer?.addEventListener(
      "scroll",
      this.scrollEventListener
    );
    this.timelineElements.timelineContainer?.addEventListener(
      "wheel",
      this.wheelEventListener
    );

    this.timelineElements.phantomTrack?.addEventListener(
      "mousedown",
      this.onMouseDown
    );
    this.timelineElements.phantomTrackTimeCard?.addEventListener(
      "mousedown",
      this.onMouseDown
    );
    this.timelineElements.contentContainer?.addEventListener(
      "mousemove",
      this.onMouseMove
    );
    this.timelineElements.contentContainer?.addEventListener(
      "mouseover",
      this.onMouseOver
    );
    this.timelineElements.contentContainer?.addEventListener(
      "mouseout",
      this.onMouseOut
    );
    this.timelineElements.contentContainer?.addEventListener(
      "mousedown",
      this.onMouseDown
    );
    this.timelineElements.contentContainer?.addEventListener(
      "mouseup",
      this.onMouseUp
    );
    document.body.addEventListener("mouseup", this.onGlobalMouseUp);
    document.body.addEventListener("mousemove", this.onGlobalMouseMove);
    document.body.addEventListener("mouseleave", this.onGlobalMouseLeave);
  }

  private clearListeners() {
    this.logger.log("trace", `Удаляем слушателей`);

    this.timelineElements.timelineContainer?.removeEventListener(
      "scroll",
      this.scrollEventListener
    );
    this.timelineElements.timelineContainer?.removeEventListener(
      "wheel",
      this.wheelEventListener
    );

    this.timelineElements.phantomTrack?.removeEventListener(
      "mousedown",
      this.onMouseDown
    );
    this.timelineElements.phantomTrackTimeCard?.removeEventListener(
      "mousedown",
      this.onMouseDown
    );

    this.timelineElements.contentContainer?.removeEventListener(
      "mousemove",
      this.onMouseMove
    );
    this.timelineElements.contentContainer?.removeEventListener(
      "mouseover",
      this.onMouseOver
    );
    this.timelineElements.contentContainer?.removeEventListener(
      "mouseout",
      this.onMouseOut
    );
    this.timelineElements.contentContainer?.removeEventListener(
      "mousedown",
      this.onMouseDown
    );
    this.timelineElements.contentContainer?.removeEventListener(
      "mouseup",
      this.onMouseUp
    );
    document.body.removeEventListener("mouseup", this.onGlobalMouseUp);
    document.body.removeEventListener("mousemove", this.onGlobalMouseMove);
    document.body.removeEventListener("mouseleave", this.onGlobalMouseLeave);
  }

  private setupEvents() {
    this.eventBus.on("set-timeline-scale", this.setScale);
  }

  private clearEvents() {
    this.eventBus.off("set-timeline-scale", this.setScale);
  }
}
