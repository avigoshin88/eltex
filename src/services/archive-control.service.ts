import { RangeDto } from "../dto/ranges";
import { Nullable } from "../types/global";
import { EventBus } from "./event-bus.service";
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
  subFragmentIndex: number;
  isLastFragment: boolean;
};

export class ArchiveControlService {
  private readonly logger = new Logger(ArchiveControlService.name);

  private ranges: RangeDto[] = [];

  private fragmentIndex = 0;

  private rangeFragmentsGenerator!: Generator<RangeFragment>;

  private connectionSupporterId: Nullable<number> = null;

  private preloadRangeFragmentsId: Nullable<number> = null;

  private nextFragmentTimeoutId: Nullable<number> = null;

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

  setCurrentRange(range: RangeDto) {
    this.fragmentIndex = this.findRangeIndex(range.start_time, range.end_time);

    this.initGenerator();

    this.preloadRangeFragment(true);

    this.initPreloadFragmentsInterval();
    this.clearPreloadFragmentsInterval();
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

  toNextFragment(isStart = false) {
    if (!this.nextFragment) {
      this.logger.warn(
        "Нельзя переключиться к следующему фрагменту: текущий фрагмент последний."
      );
      return;
    }

    this.fragmentIndex = this.fragmentIndex + 1;

    EventBus.emit("new-archive-fragment-started", this.currentFragment);

    if (isStart) {
      this.initGenerator();
    }

    this.clearNextFragmentPreload();

    this.preloadRangeFragment(isStart);
    this.clearPreloadFragmentsInterval();
    this.initPreloadFragmentsInterval();
  }

  toPrevFragment(isStart = false) {
    if (!this.prevFragment) {
      this.logger.warn(
        "Нельзя переключиться к предыдущему фрагменту: текущий фрагмент первый."
      );
      return;
    }

    this.fragmentIndex = this.fragmentIndex - 1;

    EventBus.emit("new-archive-fragment-started", this.currentFragment);

    if (isStart) {
      this.initGenerator();
    }

    this.clearNextFragmentPreload();

    this.preloadRangeFragment(isStart);
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
          subFragmentIndex: i,
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
      this.clearNextFragmentPreload();

      const nextFragmentTimeout = Math.max(
        0,
        rangeFragment.duration - preloadRangeFragmentTimeout
      );
      this.clearPreloadFragmentsInterval();

      this.nextFragmentTimeoutId = setTimeout(() => {
        this.toNextFragment();
      }, nextFragmentTimeout);
    }
  }

  private initPreloadFragmentsInterval() {
    this.initGenerator();

    // console.time();
    this.preloadRangeFragmentsId = setInterval(() => {
      // console.timeLog();
      this.preloadRangeFragment();
    }, preloadInterval - preloadRangeFragmentTimeout);
  }

  private clearNextFragmentPreload() {
    if (this.nextFragmentTimeoutId === null) {
      return;
    }

    clearTimeout(this.nextFragmentTimeoutId);
    this.nextFragmentTimeoutId = null;
  }

  private clearPreloadFragmentsInterval() {
    if (this.preloadRangeFragmentsId === null) {
      return;
    }

    clearInterval(this.preloadRangeFragmentsId);

    // console.timeEnd();
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

  private findRangeIndex(
    customStartTime: number,
    customEndTime: number
  ): number {
    for (let i = 0; i < this.ranges.length; i++) {
      const range = this.ranges[i];

      // Проверяем пересечение кастомного диапазона с текущим
      if (
        customStartTime >= range.start_time &&
        customEndTime <= range.end_time
      ) {
        return i; // Возвращаем индекс найденного диапазона
      }
    }

    return -1; // Если не найдено пересечение
  }
}
