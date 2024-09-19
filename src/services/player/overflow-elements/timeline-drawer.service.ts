import { RangePeriod } from "../../../dto/ranges";
import { Nullable } from "../../../types/global";
import { RangeData } from "../../../types/range";

const PERIODS_COUNT = 58;

const periodSizeMS: Record<RangePeriod, number> = {
  [RangePeriod["week"]]: 604_800_000,
  [RangePeriod["day"]]: 86_400_000,
  [RangePeriod["16hours"]]: 57_600_000,
  [RangePeriod["12hours"]]: 43_200_000,
  [RangePeriod["6hours"]]: 21_600_000,
  [RangePeriod["1hour"]]: 3_600_000,
  [RangePeriod["30min"]]: 1_800_000,
  [RangePeriod["10min"]]: 600_000,
  [RangePeriod["5min"]]: 300_000,
  [RangePeriod["1min"]]: 60_000,
};

const periodStep: Record<RangePeriod, number> = {
  [RangePeriod["week"]]:
    (periodSizeMS[RangePeriod["week"]] / PERIODS_COUNT) * 10080,
  [RangePeriod["day"]]:
    (periodSizeMS[RangePeriod["day"]] / PERIODS_COUNT) * 1440,
  [RangePeriod["16hours"]]:
    (periodSizeMS[RangePeriod["16hours"]] / PERIODS_COUNT) * 960,
  [RangePeriod["12hours"]]:
    (periodSizeMS[RangePeriod["12hours"]] / PERIODS_COUNT) * 720,
  [RangePeriod["6hours"]]:
    (periodSizeMS[RangePeriod["6hours"]] / PERIODS_COUNT) * 360,
  [RangePeriod["1hour"]]:
    (periodSizeMS[RangePeriod["1hour"]] / PERIODS_COUNT) * 60,
  [RangePeriod["30min"]]:
    (periodSizeMS[RangePeriod["30min"]] / PERIODS_COUNT) * 30,
  [RangePeriod["10min"]]:
    (periodSizeMS[RangePeriod["10min"]] / PERIODS_COUNT) * 10,
  [RangePeriod["5min"]]:
    (periodSizeMS[RangePeriod["5min"]] / PERIODS_COUNT) * 5,
  [RangePeriod["1min"]]:
    (periodSizeMS[RangePeriod["1min"]] / PERIODS_COUNT) * 1,
};

export class TimelineOverflowDrawer {
  private ranges: RangeData[] = [];
  private readonly container!: HTMLDivElement;

  private readonly periodManager = new PeriodManager();

  private timelineContainer: Nullable<HTMLDivElement> = null;
  private startTime: Nullable<number> = null;

  formatter = new Intl.DateTimeFormat("ru", {
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });

  constructor(container: HTMLDivElement) {
    this.container = container;
  }

  draw(currentTime: number): void {
    const timelineContainer = document.createElement("div");

    this.setTimelineStyles(timelineContainer);

    const currentTimestamp = this.mapVideoTime(currentTime);

    // this.periodManager.period = RangePeriod["10min"];
    this.periodManager.calcPeriod(this.startTime ?? 0, currentTimestamp);

    timelineContainer.append(
      ...this.makeRanges(
        this.periodManager.period,
        this.ranges[this.ranges.length - 1].end_time
      )
    );
    timelineContainer.appendChild(
      this.makePeriods(currentTimestamp, this.periodManager.period)
    );
    timelineContainer.appendChild(this.makeTrack());

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
    if (!ranges.length) {
      return;
    }

    this.ranges = ranges;
    this.startTime = this.ranges[0].start_time;
  }

  private makePeriods(
    currentTime: number,
    period: RangePeriod
  ): HTMLDivElement {
    console.log("🚀 ~ TimelineOverflowDrawer ~ period:", period);
    const periodsContainer = document.createElement("div");
    periodsContainer.className = "video-player__timeline__periods-container";

    const periodElements: HTMLDivElement[] = [];
    const fistPeriodTime = this.startTime ?? 0;

    let periodTime = fistPeriodTime;

    const stepTime = Math.round(periodSizeMS[period] / PERIODS_COUNT);

    const dates: Date[] = [];

    // Создаем все периоды
    for (let i = 0; i < PERIODS_COUNT; i++) {
      const periodContainer = document.createElement("div");
      periodContainer.className = "video-player__timeline__period-container";

      const periodElement = document.createElement("div");
      const periodElementClasses = ["video-player__timeline__period"];

      // Проверяем, нужно ли отображать текст для этого периода
      if ((i + 1) % 4 === 0 && i !== 0) {
        const timeElement = document.createElement("span");

        timeElement.textContent = this.formatDate(new Date(periodTime));
        timeElement.className = "video-player__timeline__period__text";
        periodElementClasses.push("video-player__timeline__period_with_text");

        periodElement.appendChild(timeElement);
      }

      periodElement.className = periodElementClasses.join(" ");

      periodContainer.appendChild(periodElement);

      periodElements.push(periodContainer);

      dates.push(new Date(periodTime));
      periodTime += stepTime;
    }

    periodElements.forEach((element) => periodsContainer.appendChild(element));

    return periodsContainer;
  }

  private makeRanges(period: RangePeriod, now: number) {
    const allDuration = periodSizeMS[period];

    // const now = this.ranges[this.ranges.length - 1].end_time;

    const startTime = now - allDuration;

    const ranges = this.ranges.filter((range) => {
      if (
        range.start_time < startTime &&
        startTime <= range.end_time &&
        range.end_time <= now
      ) {
        return true;
      }

      if (
        range.start_time >= startTime &&
        startTime >= range.end_time &&
        range.end_time > now
      ) {
        return true;
      }

      if (range.start_time >= startTime && range.end_time <= now) {
        return true;
      }

      return false;
    });

    return ranges.map((range) => {
      const width = this.calcRangePercentageWidth(range, allDuration);

      return this.makeRange(range, width);
    });
  }

  private makeTrack(): HTMLDivElement {
    const trackElement = document.createElement("div");

    trackElement.style.right = "0";

    trackElement.className = "video-player__timeline__track";

    return trackElement;
  }

  private setTimelineStyles(timelineContainer: HTMLDivElement) {
    timelineContainer.className = "video-player__timeline";
  }

  private makeRange(range: RangeData, width: number): HTMLDivElement {
    const rangeContainer = document.createElement("div");
    const classNames = ["video-player__timeline__range"];

    rangeContainer.onclick = console.log;

    if (range.type === "break") {
      classNames.push("video-player__timeline__range_break");
    }
    rangeContainer.className = classNames.join(" ");

    rangeContainer.style.width = `${width}%`;

    return rangeContainer;
  }

  private calcRangePercentageWidth(
    range: RangeData,
    allDuration: number
  ): number {
    return (range.duration / allDuration) * 100;
  }

  private mapVideoTime(videoTime: number) {
    return (this.startTime ?? 0) + videoTime * 1000;
  }

  private formatDate(date: Date) {
    return this.formatter.format(date);
  }
}

class PeriodManager {
  period: RangePeriod = RangePeriod["1min"];

  changePeriod(newPeriod: RangePeriod) {
    this.period = newPeriod;
  }

  calcPeriod(startTime: number, videoTimestamp: number) {
    this.period = this.getPeriod(startTime, videoTimestamp);
  }

  private getPeriod(startTime: number, videoTimestamp: number) {
    // Периоды находятся в определенном поря��ке проверки, всегда должно быть от большего к меньшему
    const periods: RangePeriod[] = [
      RangePeriod["week"],
      RangePeriod["day"],
      RangePeriod["16hours"],
      RangePeriod["12hours"],
      RangePeriod["6hours"],
      RangePeriod["1hour"],
      RangePeriod["30min"],
      RangePeriod["10min"],
      RangePeriod["5min"],
      RangePeriod["1min"],
    ];

    for (const period of periods) {
      if (videoTimestamp - startTime >= periodSizeMS[period]) {
        return period;
      }
    }

    return periods[periods.length - 1];
  }
}
