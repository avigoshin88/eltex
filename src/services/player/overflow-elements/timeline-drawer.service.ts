import { RangePeriod } from "../../../dto/ranges";
import { OverflowElementDrawer } from "../../../interfaces/overflow-element-builder";
import { RangeData } from "../../../types/range";

const STATES_COUNT = 58;

export class TimelineOverflowDrawer implements OverflowElementDrawer {
  private ranges: RangeData[] = [];

  formatter = new Intl.DateTimeFormat("ru", {
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });

  draw(container: HTMLDivElement): void {
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

    container.appendChild(timelineContainer);
  }

  setOptions(ranges: RangeData[]): void {
    this.ranges = ranges;
  }

  private makeRange(range: RangeData): HTMLDivElement {
    const rangeContainer = document.createElement("div");

    const classNames = ["video-player_timeline_range"];
    if (range.type === "break") {
      classNames.push("video-player_timeline_range_break");
    }

    rangeContainer.className = classNames.join(" ");

    return rangeContainer;
  }

  private makePeriods(ranges: RangeData[], period: keyof typeof RangePeriod) {
    // Получаем периоды для отображения

    const periodsContainer = document.createElement("div");
    periodsContainer.className = "video-player_timeline_periods_container";

    const periodElements: HTMLDivElement[] = [];

    for (let i = 0; i < STATES_COUNT; i++) {
      const periodContainer = document.createElement("div");

      periodContainer.className = "video-player_timeline_period_container";

      const periodElement = document.createElement("div");
      const periodElementClasses = ["video-player_timeline_period"];

      // if (index % 4 === 0 && index !== 0) {
      //   const timeElement = document.createElement("span");
      //   timeElement.textContent = this.formatDate(date);
      //   timeElement.className = "video-player_timeline_period_text";
      //   periodContainer.appendChild(timeElement);
      // }

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

    trackElement.className = "video-player_timeline_track";

    return trackElement;
  }

  private setTimelineStyles(timelineContainer: HTMLDivElement) {
    timelineContainer.className = "video-player_timeline";
  }

  private formatDate(date: Date) {
    return this.formatter.format(date);
  }
}
