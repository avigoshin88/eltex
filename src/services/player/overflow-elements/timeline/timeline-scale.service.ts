import { TIMELINE_MIN_STEP } from "../../../../constants/timeline-steps";

const MIN_VALUE = TIMELINE_MIN_STEP;

export class TimelineScaleService {
  private viewedTime = 0;
  private containerWidth = 1;
  private maxViewedTime = 0;

  public get scale(): number {
    return this.containerWidth / this.viewedTime;
  }

  public setMaxViewedTime(time: number) {
    this.maxViewedTime = time;
  }

  public setViewedTime(time: number) {
    this.viewedTime = this.processViewedTime(time);
  }

  public addViewedTime(time: number) {
    this.viewedTime = this.processViewedTime(this.viewedTime + time);
  }

  public setContainerWidth(width: number) {
    this.containerWidth = width;
  }

  public reset() {
    this.viewedTime = 0;
    this.containerWidth = 1;
  }

  public getViewedTime() {
    return this.viewedTime;
  }

  public isMinimumTime() {
    return this.viewedTime <= MIN_VALUE;
  }

  public isMaximumTime() {
    return this.viewedTime >= this.maxViewedTime;
  }

  private processViewedTime(time: number) {
    let value = time;

    if (time < 0) {
      value = 0;
    }
    if (time < MIN_VALUE) {
      value = MIN_VALUE;
    }
    if (time > this.maxViewedTime) {
      value = this.maxViewedTime;
    }

    return value;
  }
}
