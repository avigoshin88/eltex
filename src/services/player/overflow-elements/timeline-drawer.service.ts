import { RangePeriod } from "../../../dto/ranges";
import { OverflowElementDrawer } from "../../../interfaces/overflow-element-builder";
import { RangeData } from "../../../types/range";

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

    this.animateTrack(trackElement, totalDuration);
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
    const periods = this.getPeriods(ranges, period);

    const periodsContainer = document.createElement("div");
    periodsContainer.className = "video-player_timeline_periods_container";

    // Создаем элементы для каждой даты в периодах
    const periodElements = periods.map((date, index) => {
      const periodContainer = document.createElement("div");

      periodContainer.className = "video-player_timeline_period_container";

      const periodElement = document.createElement("div");
      periodElement.className = "video-player_timeline_period";

      if (index % 4 === 0 && index !== 0) {
        const timeElement = document.createElement("span");
        timeElement.textContent = this.formatDate(date);
        timeElement.className = "video-player_timeline_period_text";
        periodContainer.appendChild(timeElement);
      }

      periodContainer.appendChild(periodElement);

      return periodContainer;
    });
    // Добавляем элементы периодов в контейнер временной шкалы
    periodElements.forEach((element) => periodsContainer.appendChild(element));

    return periodsContainer;
  }

  private animateTrack(
    trackElement: HTMLDivElement,
    totalDuration: number
  ): void {
    const animationDuration = 100; // 100ms
    const stepSize = 100; // 100 пикселей

    let currentPosition = 0;

    // const animate = () => {
    //   currentPosition += stepSize;

    //   if (currentPosition >= totalDuration) {
    //     // Проверяем, достигнут ли мы конца видео
    //     if (currentPosition > totalDuration) {
    //       // Если да, то останавливаем анимацию и устанавливаем конечное положение
    //       clearInterval(animationInterval);
    //       trackElement.style.left = `${(totalDuration / 60000) * 100}%`;
    //     } else {
    //       // Если нет, продолжаем анимацию
    //       setTimeout(animate, animationDuration);
    //     }
    //   } else {
    //     // Устанавливаем позицию трека в зависимости от текущего времени видео
    //     const currentTime =
    //       this.ranges[this.ranges.length - 1].start_time + currentPosition;
    //     trackElement.style.left = `${(currentTime / 60000) * 100}%`;

    //     // Продолжаем анимацию
    //     setTimeout(animate, animationDuration);
    //   }
    // };

    // const animationInterval = setInterval(animate, animationDuration);
  }

  private makeTrack(totalDuration: number): HTMLDivElement {
    const trackElement = document.createElement("div");

    // Set initial position
    trackElement.style.left = `${(totalDuration / 60000) * 100}%`;

    trackElement.className = "video-player_timeline_track";

    return trackElement;
  }

  private setTimelineStyles(timelineContainer: HTMLDivElement) {
    timelineContainer.className = "video-player_timeline";
  }

  private getPeriods(ranges: RangeData[], period: keyof typeof RangePeriod) {
    const startDate = ranges[0].start_time;
    const endDate = ranges[ranges.length - 1].end_time;

    switch (period) {
      case "7days":
        return this.getDaysInRange(startDate, endDate, 7);

      case "1day":
        return this.getDaysInRange(startDate, endDate, 1);

      case "24hours":
        return this.getHoursInRange(startDate, endDate, 24);

      case "12hours":
        return this.getHoursInRange(startDate, endDate, 12);

      case "6hours":
        return this.getHoursInRange(startDate, endDate, 6);

      case "1hour":
        return this.getHoursInRange(startDate, endDate, 1);

      case "30min":
        return this.getMinutesInRange(startDate, endDate, 30);

      case "10min":
        return this.getMinutesInRange(startDate, endDate, 10);

      case "5min":
        return this.getMinutesInRange(startDate, endDate, 5);

      default:
        throw new Error(`Unsupported period: ${period}`);
    }
  }

  private getDaysInRange(start: number, end: number, days: number): Date[] {
    const currentDate = new Date(start * 1000);
    const periods: Date[] = [];

    while (currentDate.getTime() <= end * 1000 && days > 0) {
      periods.push(new Date(currentDate.getTime()));
      currentDate.setDate(currentDate.getDate() + 1);
      days--;
    }

    return periods;
  }

  private getHoursInRange(start: number, end: number, hours: number): Date[] {
    const currentDate = new Date(start * 1000);
    const periods: Date[] = [];

    while (currentDate.getTime() <= end * 1000 && hours > 0) {
      periods.push(new Date(currentDate.getTime()));
      currentDate.setHours(currentDate.getHours() + 1);
      hours--;
    }

    return periods;
  }

  private getMinutesInRange(
    start: number,
    end: number,
    minutes: number
  ): Date[] {
    const currentDate = new Date(start * 1000);
    const periods: Date[] = [];

    while (currentDate.getTime() <= end * 1000 && minutes > 0) {
      periods.push(new Date(currentDate.getTime()));
      currentDate.setMinutes(currentDate.getMinutes() + 1);
      minutes--;
    }

    return periods;
  }

  private formatDate(date: Date) {
    return this.formatter.format(date);
  }
}
