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

    this.trackObserver = new IntersectionObserver(
      this.onTrackObserve.bind(this),
      {
        root: this.scrollContainer,
      }
    );

    this.registerListeners();
  }

  draw(currentTime: number): void {
    if (!this.isReady || !this.timelineContainer || this.ranges.length === 0)
      return;

    const oldTrack = document.getElementById("track");
    if (oldTrack) {
      this.trackObserver?.unobserve(oldTrack);
    }

    this.timelineContainer.innerHTML = ""; // Очистка контейнера перед отрисовкой

    const startTime = this.ranges[0]?.start_time || 0;
    const endTime = this.ranges[this.ranges.length - 1]?.end_time || 0;
    const totalTimeRange = endTime - startTime; // Общее время от начала до конца всех диапазонов

    const containerWidth = this.container.offsetWidth; // Ширина контейнера

    // Рассчитываем ширину диапазонов с учетом масштаба
    const totalRangeWidth = totalTimeRange * this.scale; // totalTimeRange в масштабе

    // Если ширина всех диапазонов больше ширины контейнера, включаем скролл
    if (totalRangeWidth > containerWidth) {
      this.timelineContainer.style.width = `${totalRangeWidth}px`; // Задаем большую ширину таймлайна
    } else {
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

    let track = document.getElementById("track");
    // Проверяем, существует ли трек, если да — обновляем его, если нет — создаем
    if (!track) {
      track = document.createElement("div");
      track.id = "track";
      track.classList.add("video-player__timeline__track");
      this.timelineContainer!.appendChild(track);
    }

    // Обновляем позицию трека
    track!.style.left = `${trackPosition}px`;

    // Следим за треком (если используется IntersectionObserver)
    this.trackObserver?.observe(track);

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
    if (!this.scrollContainer || !this.timelineContainer) return;

    // Находим элемент трека
    const track = this.timelineContainer.querySelector(
      ".video-player__timeline__track"
    ) as HTMLElement;

    if (!track) return; // Трек не найден

    // Получаем позицию трека относительно timelineContainer
    const trackLeft = track.offsetLeft;
    const trackWidth = track.offsetWidth;

    // Рассчитываем необходимый scrollLeft
    const scrollContainerWidth = this.scrollContainer.offsetWidth;

    // Устанавливаем scrollLeft так, чтобы трек был на правом краю
    let newScrollLeft = trackLeft + trackWidth - scrollContainerWidth;

    // Ограничиваем scrollLeft допустимыми значениями
    const maxScrollLeft =
      this.scrollContainer.scrollWidth - scrollContainerWidth;
    newScrollLeft = Math.max(0, Math.min(newScrollLeft, maxScrollLeft));

    // Устанавливаем флаг программной прокрутки
    this.isProgrammaticScroll = true;

    // Используем плавную прокрутку
    this.scrollContainer.scrollTo({
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
    if (!this.scrollContainer) {
      return;
    }

    this.clearListeners();

    this.trackObserver?.disconnect();

    this.container.removeChild(this.scrollContainer!);
    this.scrollContainer = null;
    this.timelineContainer = null;

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

  private getDivisionStep(): number {
    const scaleFactor = this.scale;

    const stepInfo = divisionSteps.find((step) => scaleFactor > step.scale);

    return stepInfo?.step ?? divisionSteps[divisionSteps.length - 1].step;
  }

  private clickEventListener(event: MouseEvent): void {
    event.preventDefault();

    // Получаем размеры контейнера
    const containerRect = this.container.getBoundingClientRect();

    // Позиция клика относительно контейнера
    const clickX = event.clientX - containerRect.left;

    // Получаем текущую ширину видимого контейнера и всю ширину таймлайна
    const scrollLeft = this.scrollContainer?.scrollLeft || 0;
    const totalTimelineWidth = this.timelineContainer?.offsetWidth || 0;

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
        this.timelineContainer!.offsetWidth
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

    this.updateVirtualizedDivisions();
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
      const scaleChange = Math.sign(event.deltaY) * 0.000002; // Более мелкий шаг для плавности

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
      this.scale = Math.min(
        maxScale,
        Math.max(minScale, this.scale + scaleChange)
      );

      if (this.isReady) {
        // Рассчитаем позицию трека относительно предыдущего масштаба
        const track = document.getElementById("track");
        if (track) {
          const trackLeft = track.offsetLeft; // Позиция трека до масштабирования
          const visibleWidth = this.scrollContainer!.offsetWidth; // Ширина видимой области

          // Сохраним смещение относительно центра или границы
          let trackOffsetFromLeft =
            trackLeft - this.scrollContainer!.scrollLeft;

          if (trackOffsetFromLeft > visibleWidth / 2) {
            trackOffsetFromLeft = visibleWidth / 2; // Центрируем трек, если он далеко справа
          } else if (trackLeft <= 0) {
            trackOffsetFromLeft = 0; // Трек в самом начале
          }

          // Обновляем отрисовку
          this.draw(this.currentStartTime);

          // После перерисовки восстанавливаем позицию трека
          const newTrackLeft = (trackLeft / previousScale) * this.scale;
          const newScrollLeft = Math.max(0, newTrackLeft - trackOffsetFromLeft);
          this.scrollContainer!.scrollTo({
            left: newScrollLeft,
            behavior: "auto",
          });
        } else {
          // Если трека нет, просто обновляем таймлайн
          this.draw(this.currentStartTime);
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
