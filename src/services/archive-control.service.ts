import { RangeDto } from "../dto/ranges";
import { Nullable } from "../types/global";
import { Logger } from "./logger/logger.service";

const connectionSupportInterval = Number(
  import.meta.env.VITE_ARCHIVE_CONNECT_SUPPORT_INTERVAL
);

const preloadRangeFragmentTimeout = 2000;

const preloadInterval = Number(import.meta.env.VITE_ARCHIVE_PRELOAD_INTERVAL);

if (isNaN(connectionSupportInterval)) {
  throw new Error(
    `VITE_ARCHIVE_CONNECT_SUPPORT_INTERVAL must be a number. Currently is ${
      import.meta.env.VITE_ARCHIVE_CONNECT_SUPPORT_INTERVAL
    } `
  );
}

if (isNaN(preloadInterval)) {
  throw new Error(
    `VITE_ARCHIVE_PRELOAD_INTERVAL must be a number. Currently is ${
      import.meta.env.VITE_ARCHIVE_PRELOAD_INTERVAL
    } `
  );
}

type Emitter = (fragment: RangeDto, isPreRequestRange?: boolean) => void;

type RangeFragment = RangeDto & {
  fragmentIndex: number;
  isLastFragment: boolean;
};

export class ArchiveControlService {
  private readonly logger = new Logger(ArchiveControlService.name);

  private ranges: RangeDto[] = [];

  private fragmentIndex = 0;

  private rangeFragmentsGenerator!: Generator<RangeFragment>;

  private connectionSupporterId: Nullable<number> = null;

  private preloadRangeFragmentsId: Nullable<number> = null;

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

    this.rangeFragmentsGenerator = this.splitRangeIntoFragmentsLazy();
  }

  init() {
    this.preloadRangeFragment(true);

    this.initSupportConnectInterval();
    this.initPreloadFragmentsInterval();
  }

  clear() {
    this.fragmentIndex = 0;

    this.ranges = [];

    this.clearSupportConnectInterval();
    this.clearPreloadFragmentsInterval();
  }

  toNextFragment() {
    if (!this.nextFragment) {
      this.logger.warn(
        "Нельзя переключиться к следующему фрагменту: текущий фрагмент последний."
      );
      return;
    }

    this.fragmentIndex = this.fragmentIndex + 1;

    this.clearPreloadFragmentsInterval();
    this.initPreloadFragmentsInterval();
  }

  toPrevFragment() {
    if (!this.prevFragment) {
      this.logger.warn(
        "Нельзя переключиться к предыдущему фрагменту: текущий фрагмент первый."
      );
      return;
    }

    this.fragmentIndex = this.fragmentIndex - 1;

    this.clearPreloadFragmentsInterval();
    this.initPreloadFragmentsInterval();
  }

  private initGenerator() {
    this.rangeFragmentsGenerator = this.splitRangeIntoFragmentsLazy();
  }

  private *splitRangeIntoFragmentsLazy(): Generator<RangeFragment> {
    for (
      let rangeIndex = this.fragmentIndex;
      rangeIndex < this.ranges.length;
      rangeIndex++
    ) {
      const range = this.ranges[rangeIndex];
      const totalRangeFragments = Math.ceil(range.duration / preloadInterval);
      let rangeFragmentStart = range.start_time;

      for (let i = 0; i < totalRangeFragments; i++) {
        const rangeFragmentEnd = Math.min(
          rangeFragmentStart + preloadInterval,
          range.end_time
        );
        const fragmentDuration = rangeFragmentEnd - rangeFragmentStart;

        yield {
          start_time: rangeFragmentStart,
          end_time: rangeFragmentEnd,
          duration: fragmentDuration,
          fragmentIndex: rangeIndex,
          isLastFragment: i === totalRangeFragments - 1,
        };

        rangeFragmentStart += preloadInterval;
      }
    }
  }

  private preloadRangeFragment(isFirst: boolean = false) {
    const rangeFragmentResult = this.rangeFragmentsGenerator.next();

    if (rangeFragmentResult.done) {
      // конец, переключаем в live
      return;
    }

    const rangeFragment = rangeFragmentResult.value;

    this.emit(rangeFragment, !isFirst);
    if (rangeFragment.isLastFragment) {
      this.toNextFragment();
    }
  }

  private initPreloadFragmentsInterval() {
    this.initGenerator();

    this.preloadRangeFragmentsId = setInterval(() => {
      this.preloadRangeFragment();
    }, preloadInterval - preloadRangeFragmentTimeout);
  }

  private clearPreloadFragmentsInterval() {
    if (this.preloadRangeFragmentsId === null) {
      return;
    }

    clearInterval(this.preloadRangeFragmentsId);
    this.preloadRangeFragmentsId = null;
  }

  private initSupportConnectInterval() {
    this.connectionSupporterId = setInterval(() => {
      this.supportConnect();
    }, connectionSupportInterval);
  }

  private clearSupportConnectInterval() {
    if (this.connectionSupporterId === null) {
      return;
    }

    clearInterval(this.connectionSupporterId);
    this.connectionSupporterId = null;
  }
}
