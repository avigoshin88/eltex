import { RangeDto } from "../dto/ranges";
import { RangeData } from "../types/range";
import { Logger } from "./logger/logger.service";

type Emitter = (fragment: RangeDto) => void;

export class ArchiveControlService {
  private readonly logger = new Logger(ArchiveControlService.name);

  private ranges: RangeDto[] = [];
  private allRanges: RangeData[] = [];
  private fragmentIndex = 0;
  private emit!: Emitter;

  constructor(emit: Emitter) {
    this.emit = emit;
  }

  get currentFragment() {
    return this.ranges[this.fragmentIndex];
  }

  get nextFragment() {
    if (this.fragmentIndex >= this.ranges.length - 1) {
      return null;
    }

    return this.ranges[this.fragmentIndex + 1];
  }

  get prevFragment() {
    if (this.fragmentIndex === 0) {
      return null;
    }

    return this.ranges[this.fragmentIndex - 1];
  }

  setRanges(ranges: RangeDto[], allRanges: RangeData[]) {
    this.ranges = ranges;
    this.allRanges = allRanges;
  }

  init() {
    this.emit(this.currentFragment);
  }

  toNextFragment() {
    if (!this.nextFragment) {
      this.logger.warn(
        "Нельзя переключиться к следующему фрагменту: текущий фрагмент последний."
      );
      return;
    }

    this.emit(this.nextFragment);
  }

  toPrevFragment() {
    if (!this.prevFragment) {
      this.logger.warn(
        "Нельзя переключиться к предыдущему фрагменту: текущий фрагмент первый."
      );
      return;
    }

    this.emit(this.prevFragment);
  }
}
