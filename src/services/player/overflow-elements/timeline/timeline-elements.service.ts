import { Nullable } from "../../../../types/global";

export class TimelineElementsService {
  private ranges: HTMLDivElement[] = [];
  private divisions: HTMLDivElement[] = [];

  constructor(
    public scrollContainer: Nullable<HTMLDivElement>,
    public contentContainer: Nullable<HTMLDivElement>,
    public timelineContainer: Nullable<HTMLDivElement>,
    public trackContainer: Nullable<HTMLDivElement>,
    public track: Nullable<HTMLDivElement>,
    public phantomTrack: Nullable<HTMLDivElement>,
    public phantomTrackTimeCard: Nullable<HTMLDivElement>,
    public phantomTrackTimeCardText: Nullable<HTMLSpanElement>
  ) {}

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
