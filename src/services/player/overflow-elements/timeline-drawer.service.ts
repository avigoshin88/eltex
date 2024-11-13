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

const MOUSE_MICRO_MOVE_TIMEOUT = 100;

export class TimelineOverflowDrawer {
  private readonly container: HTMLDivElement;

  private readonly timelineElements: TimelineElementsService;
  private readonly timelineElementsFactory: TimelineElementsFactoryService;
  private readonly timelineMathService = new TimelineMathService();

  private scale: number = 1; // Начальный масштаб
  private isReady: boolean = false; // Флаг, указывающий готовность к отрисовке
  private clickCallback: TimelineClickCallback; // Callback для кликов

  private scrollTimeout: Nullable<number> = null;
  private isUserScrolling: boolean = false;
  private isProgrammaticScroll: boolean = false;
  private userScrollTimeout: Nullable<number> = null;
  private programmaticScrollTimeout: Nullable<number> = null;
  private scrollEndTimeout: Nullable<number> = null;

  private trackObserver: IntersectionObserver;
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

  private isWheel = false;

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

    this.timelineElementsFactory = new TimelineElementsFactoryService(id);
    const [phantomTrack, phantomTrackTimeCard, phantomTrackTimeCardText] =
      this.timelineElementsFactory.makePhantomTrack();

    this.timelineElements = new TimelineElementsService(
      id,
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

    this.trackObserver = new IntersectionObserver(this.onTrackObserve, {
      root: this.timelineElements.scrollContainer,
      threshold: 0,
    });
    this.resizeTimelineObserver = new ResizeObserver(this.onTimelineResize);

    this.trackObserver.observe(this.timelineElements.track!);
    this.resizeTimelineObserver.observe(this.timelineElements.scrollContainer!);

    this.originalMouseMove = document.body
      .onmousemove as Nullable<EventListener>;
    this.originalMouseUp = document.body.onmouseup as Nullable<EventListener>;

    this.registerListeners();
    this.setupEvents();
  }

  draw(currentTimestamp: number): void {
    if (!this.isReady || !this.timelineElements.timelineContainer) {
      return;
    }

    this.currentTimestamp = currentTimestamp;

    this.timelineElements.clearTimeline();

    const containerWidth = this.timelineElements.scrollContainer!.offsetWidth; // Ширина контейнера

    // Рассчитываем ширину диапазонов с учетом масштаба
    const totalRangeWidth = this.timelineMathService.duration * this.scale; // totalTimeRange в масштабе

    // Если ширина всех диапазонов больше ширины контейнера, включаем скролл
    if (totalRangeWidth > containerWidth) {
      this.timelineElements.contentContainer!.style.width = `${totalRangeWidth}px`; // Задаем большую ширину контейнеру с контентом
      this.timelineElements.timelineContainer.style.width = `${totalRangeWidth}px`; // Задаем большую ширину таймлайна
      this.timelineElements.trackContainer!.style.width = `${totalRangeWidth}px`; // Задаем большую ширину треку
    } else {
      this.eventBus.emit(
        "manual-scale-change",
        String(this.timelineMathService.duration)
      );

      this.timelineElements.contentContainer!.style.width = `${containerWidth}px`; // Задаем большую ширину контейнеру с контентом
      this.timelineElements.timelineContainer.style.width = `${containerWidth}px`; // Устанавливаем стандартную ширину
      this.timelineElements.trackContainer!.style.width = `${containerWidth}px`; // Устанавливаем стандартную ширину
    }

    // Виртуализация делений
    this.drawVirtualizedDivisions(
      this.timelineMathService.startTimestamp,
      this.timelineMathService.duration,
      totalRangeWidth
    );

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

  private onTrackObserve = (entries: IntersectionObserverEntry[]) => {
    if (this.isMouseDown && this.isMouseMove) {
      return;
    }

    const trackEntry = entries[0];
    if (!trackEntry) {
      return;
    }

    if (trackEntry.isIntersecting) {
      return;
    }

    if (this.isUserScrolling) {
      return;
    }

    this.scrollTrackToAlign(this.timelineElements.track!, "right");
  };

  private onTimelineResize = () => {
    this.draw(this.currentTimestamp);
  };

  public scrollTrackToAlign(
    track: HTMLElement,
    align: "center" | "left" | "right",
    offset = 0
  ) {
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
    if (align === "right") {
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
    this.timelineElements.scrollContainer.scrollTo({
      left: newScroll,
    });

    setTimeout(() => {
      this.draw(this.currentTimestamp);
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

  setOptions(ranges: RangeData[], updateScale = true): void {
    this.timelineMathService.setRanges(ranges);

    this.isReady = true;

    if (updateScale) {
      const totalTimeRange =
        ranges[ranges.length - 1].end_time - ranges[0].start_time;
      const containerWidth = this.timelineElements.scrollContainer!.offsetWidth;

      const options = TIMELINE_STEPS_OPTIONS.filter(
        (step) => Number(step.value) <= totalTimeRange
      ).sort((a, b) => Number(a.value) - Number(b.value));

      options.push({ label: "Max", value: String(totalTimeRange) });

      this.eventBus.emit("set-timeline-scale-options", [
        options[options.length - 1].value,
        options,
      ]);

      // Устанавливаем начальный масштаб так, чтобы диапазоны занимали всю ширину контейнера
      this.scale = containerWidth / totalTimeRange;
      this.draw(this.timelineMathService.startTimestamp); // Отрисовка шкалы после установки диапазонов
    }
  }

  clear(): void {
    if (!this.timelineElements.scrollContainer) {
      return;
    }

    this.currentTimestamp = 0;

    this.clearEvents();
    this.clearListeners();

    this.trackObserver?.disconnect();

    this.container.removeChild(this.timelineElements.scrollContainer!);
    this.timelineElements.scrollContainer = null;
    this.timelineElements.timelineContainer = null;

    this.isReady = false;
  }

  private formatTime(time: number): string {
    return formatTime(time, this.scale);
  }

  private getStep() {
    const scaleFactor = this.scale;

    const stepInfo = TIMELINE_DIVISION_STEPS.find(
      (step) => scaleFactor > step.scale
    );

    return (
      stepInfo ?? TIMELINE_DIVISION_STEPS[TIMELINE_DIVISION_STEPS.length - 1]
    );
  }

  private setScale = (value: number) => {
    const containerWidth = this.timelineElements.scrollContainer!.offsetWidth;

    this.scale = containerWidth / value;

    this.draw(this.currentTimestamp);

    this.scrollTrackToAlign(this.timelineElements.track!, "center");
  };

  private clickEventListener(event: MouseEvent): void {
    event.preventDefault();

    const time = this.getTimestampByPosition(event.clientX);
    if (!time) {
      return;
    }

    const [timestamp, clickedRange] = time;

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
        this.timelineMathService.startTimestamp,
        this.timelineMathService.duration,
        this.timelineElements.timelineContainer!.offsetWidth
      );
    } else {
      this.clickCallback?.(timestamp, clickedRange);
    }
  }

  private showPhantomTrack() {
    this.timelineElements.phantomTrack!.style.visibility = "visible";
  }

  private hidePhantomTrack() {
    this.timelineElements.phantomTrack!.style.visibility = "hidden";
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

  private updatePhantomTrack(position: number) {
    const time = this.getTimestampByPosition(position);
    if (!time) {
      return;
    }

    const [timestamp] = time;

    // Рассчитываем ширину диапазонов с учетом масштаба
    const totalRangeWidth = this.timelineMathService.duration * this.scale; // totalTimeRange в масштабе

    if (this.timelineMathService.duration === 0) {
      return;
    }

    const scrollLeft = this.timelineElements.scrollContainer!.scrollLeft;

    const trackPosition =
      ((timestamp - this.timelineMathService.startTimestamp) /
        this.timelineMathService.duration) *
        totalRangeWidth -
      scrollLeft;

    // Обновляем позицию трека
    this.timelineElements.phantomTrack!.style.left = `${trackPosition}px`;
    this.timelineElements.phantomTrackTimeCardText!.innerText =
      formatPhantomTime(timestamp);
  }

  private onMouseOver = () => {
    this.isShowPhantomTrack = true;
    this.showPhantomTrack();
  };

  private onMouseOut = () => {
    this.isShowPhantomTrack = false;
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

    this.lastMouseX = null;
  };

  private getTimestampByPosition(
    position: number
  ): Nullable<[timestamp: number, range: RangeData]> {
    const containerRect =
      this.timelineElements.scrollContainer!.getBoundingClientRect();

    // Позиция клика относительно контейнера
    const clickX = position - containerRect.left;

    // Получаем текущую ширину видимого контейнера и всю ширину таймлайна
    const scrollLeft = this.timelineElements.scrollContainer?.scrollLeft || 0;

    // Рассчитываем позицию клика с учётом прокрутки и масштаба
    const totalClickPosition = (clickX + scrollLeft) / this.scale;

    const clickedTimestamp =
      this.timelineMathService.startTimestamp + totalClickPosition;

    // Находим ближайшую временную метку
    const nearestTimestamp = this.getNearestTimestamp(clickedTimestamp);
    if (nearestTimestamp === undefined) {
      return null;
    }

    return nearestTimestamp;
  }

  private scrollEventListener() {
    // Очищаем предыдущий таймер завершения прокрутки
    if (!this.isWheel) {
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

      // Устанавливаем таймер для сброса флага пользовательской прокрутки
      this.userScrollTimeout = setTimeout(() => {
        this.isUserScrolling = false;

        if (this.isProgrammaticScroll) {
          this.isProgrammaticScroll = false;
        }
      }, 300);

      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }
    }

    const totalRangeWidth = this.timelineMathService.duration * this.scale;

    this.timelineElements.clearDivisions();

    this.drawVirtualizedDivisions(
      this.timelineMathService.startTimestamp,
      this.timelineMathService.duration,
      totalRangeWidth
    );

    this.updateTrackAndExportMarkers(
      this.timelineMathService.startTimestamp,
      this.timelineMathService.duration,
      totalRangeWidth
    );
  }

  private wheelEventListener(event: WheelEvent) {
    event.preventDefault();

    if (event.shiftKey) {
      // Если зажата клавиша Shift — горизонтальная прокрутка
      this.container.scrollLeft += event.deltaY;
    } else {
      this.isWheel = true;
      // Иначе — изменение масштаба

      // Устанавливаем флаг пользовательского взаимодействия
      this.isUserScrolling = false;

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

      const scaleChange = Math.sign(event.deltaY) * this.getStep().amplifier; // Более мелкий шаг для плавности

      const containerWidth = this.timelineElements.scrollContainer!.offsetWidth;

      // Рассчитаем максимальный масштаб так, чтобы диапазоны не могли выходить за пределы контейнера
      const maxScale = 1; // Масштабирование не должно превышать единичный масштаб
      const minScale = containerWidth / this.timelineMathService.duration; // Минимальный масштаб, при котором диапазоны занимают контейнер

      // Текущее значение масштаба перед изменением
      const previousScale = this.scale;

      // Ограничиваем масштаб значениями от minScale до maxScale
      this.scale = Math.min(
        maxScale,
        Math.max(minScale, this.scale + scaleChange)
      );

      this.eventBus.emit("manual-scale-change", "");

      if (this.isReady) {
        if (this.isShowPhantomTrack) {
          this.updatePhantomTrack(event.clientX);
        }

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
          this.draw(this.currentTimestamp);

          // После перерисовки восстанавливаем позицию трека
          const newTrackLeft = (trackLeft / previousScale) * this.scale;
          const newScrollLeft = Math.max(0, newTrackLeft - trackOffsetFromLeft);
          this.timelineElements.scrollContainer!.scrollTo({
            left: newScrollLeft,
            behavior: "auto",
          });
        } else {
          // Если трека нет, просто обновляем таймлайн
          this.draw(this.currentTimestamp);
        }

        // Обновляем маркеры экспорта при изменении масштаба
        this.updateExportMarkers(
          this.timelineMathService.startTimestamp,
          this.timelineMathService.duration,
          this.timelineMathService.duration * this.scale
        );
      }

      this.isWheel = false;
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
