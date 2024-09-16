import { RangePeriod } from "../../../dto/ranges";
import { Nullable } from "../../../types/global";
import { RangeData } from "../../../types/range";

const STATES_COUNT = 58;

export class TimelineOverflowDrawer {
  private ranges: RangeData[] = [];
  private readonly container!: HTMLDivElement;

  private timelineContainer: Nullable<HTMLDivElement> = null;

  formatter = new Intl.DateTimeFormat("ru", {
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });

  constructor(container: HTMLDivElement) {
    this.container = container;
  }

  draw(): void {
    const timelineContainer = document.createElement("div");

    const totalDuration =
      this.ranges[this.ranges.length - 1].end_time - this.ranges[0].start_time;

    this.setTimelineStyles(timelineContainer);

    const trackElement = this.makeTrack(totalDuration);

    timelineContainer.appendChild(this.makePeriods(this.ranges, "30min"));
    timelineContainer.appendChild(trackElement);

    // Добавляем элементы разрезов в контейнер временной шкалы
    this.ranges.forEach((range) => {
      const rangeElement = this.makeRange(range);
      timelineContainer.appendChild(rangeElement);
    });

    this.clear();
    this.timelineContainer = timelineContainer;
    this.container.appendChild(timelineContainer);
  }

  public clear() {
    if (!this.timelineContainer) {
      return;
    }

    this.container.removeChild(this.timelineContainer);
  }

  setOptions(ranges: RangeData[]): void {
    this.ranges = ranges;
  }

  private makeRange(range: RangeData): HTMLDivElement {
    const rangeContainer = document.createElement("div");

    const classNames = ["video-player__timeline__range"];
    if (range.type === "break") {
      classNames.push("video-player__timeline__range_break");
    }

    rangeContainer.className = classNames.join(" ");

    return rangeContainer;
  }

  private makePeriods(ranges: RangeData[], period: keyof typeof RangePeriod) {
    // Получаем периоды для отображения

    const periodsContainer = document.createElement("div");
    periodsContainer.className = "video-player__timeline__periods-container";

    const periodElements: HTMLDivElement[] = [];

    for (let i = 0; i < STATES_COUNT; i++) {
      const periodContainer = document.createElement("div");

      periodContainer.className = "video-player__timeline__period-container";

      const periodElement = document.createElement("div");
      const periodElementClasses = ["video-player__timeline__period"];

      if (i % 4 === 0 && i !== 0) {
        const timeElement = document.createElement("span");
        timeElement.textContent = this.formatDate(new Date());
        timeElement.className = "video-player__timeline__period__text";

        periodElementClasses.push("video-player__timeline__period_with_text");

        periodContainer.appendChild(timeElement);
      }

      periodElement.className = periodElementClasses.join(" ");

      periodContainer.appendChild(periodElement);

      periodElements.push(periodContainer);
    }

    // Добавляем элементы периодов в контейнер временной шкалы
    periodElements.forEach((element) => periodsContainer.appendChild(element));

    return periodsContainer;
  }

  private makeTrack(totalDuration: number): HTMLDivElement {
    const trackElement = document.createElement("div");

    trackElement.style.left = `${(totalDuration / 60000) * 100}%`;

    trackElement.className = "video-player__timeline__track";

    return trackElement;
  }

  private setTimelineStyles(timelineContainer: HTMLDivElement) {
    timelineContainer.className = "video-player__timeline";
  }

  private formatDate(date: Date) {
    return this.formatter.format(date);
  }
}
