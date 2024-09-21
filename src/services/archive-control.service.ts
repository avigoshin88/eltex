import { RangeDto } from "../dto/ranges";
import { Nullable } from "../types/global";
import { Logger } from "./logger/logger.service";

const connectionSupportInterval = Number(
  import.meta.env.VITE_ARCHIVE_CONNECT_SUPPORT_INTERVAL
);

if (isNaN(connectionSupportInterval)) {
  throw new Error(
    `VITE_ARCHIVE_CONNECT_SUPPORT_INTERVAL must be a number. Currently is ${
      import.meta.env.VITE_ARCHIVE_CONNECT_SUPPORT_INTERVAL
    } `
  );
}

type Emitter = (fragment: RangeDto) => void;

export class ArchiveControlService {
  private readonly logger = new Logger(ArchiveControlService.name);

  private ranges: RangeDto[] = [];
  private fragmentIndex = 0;

  private connectionSupporterId: Nullable<number> = null;

  private emit!: Emitter;
  private supportConnect: () => void;

  constructor(emit: Emitter, supportConnect: () => void) {
    this.emit = emit;
    this.supportConnect = supportConnect;
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

  setRanges(ranges: RangeDto[]) {
    this.ranges = ranges;
  }

  init() {
    this.emit(this.currentFragment);

    this.connectionSupporterId = setInterval(() => {
      this.supportConnect();
    }, connectionSupportInterval);
  }

  clear() {
    if (this.connectionSupporterId === null) {
      return;
    }

    clearInterval(this.connectionSupporterId);
    this.connectionSupporterId = null;
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
