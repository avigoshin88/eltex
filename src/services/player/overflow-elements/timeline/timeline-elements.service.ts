import { Nullable } from "../../../../types/global";
import { Logger } from "../../../logger/logger.service";

export class TimelineElementsService {
  private ranges: HTMLDivElement[] = [];
  private divisions: HTMLDivElement[] = [];
  private logger: Logger;

  constructor(
    id: string,
    public scrollContainer: Nullable<HTMLDivElement>,
    public timelineContainer: Nullable<HTMLDivElement>,
    public track: Nullable<HTMLDivElement>
  ) {
    this.logger = new Logger(id, "TimelineElementsService");
  }

  setRanges(ranges: HTMLDivElement[]) {
    this.ranges = ranges;
  }

  setDivisions(divisions: HTMLDivElement[]) {
    this.divisions = divisions;
  }

  clearTimeline() {
    this.clearRanges();
    this.clearDivisions();
  }

  clearRanges() {
    for (const range of this.ranges) {
      this.timelineContainer?.removeChild(range);
    }
  }

  clearDivisions() {
    for (const division of this.divisions) {
      this.timelineContainer?.removeChild(division);
    }
  }
}
