import { RangeDto } from "../dto/ranges";
import { Nullable } from "../types/global";
import { EventBus } from "./event-bus.service";
import { Logger } from "./logger/logger.service";

const connectionSupportInterval = Number(
  import.meta.env.VITE_ARCHIVE_CONNECT_SUPPORT_INTERVAL
);

const preloadRangeFragmentTimeout = Number(
  import.meta.env.VITE_PRELOAD_RANGE_FRAGMENT_TIMEOUT
);

const preloadInterval = Number(import.meta.env.VITE_ARCHIVE_PRELOAD_INTERVAL);

if (isNaN(connectionSupportInterval)) {
  throw new Error(
    `VITE_ARCHIVE_CONNECT_SUPPORT_INTERVAL должно быть числом. Текущее значение: ${
      import.meta.env.VITE_ARCHIVE_CONNECT_SUPPORT_INTERVAL
    } `
  );
}

if (isNaN(preloadInterval)) {
  throw new Error(
    `VITE_ARCHIVE_PRELOAD_INTERVAL должно быть числом. Текущее значение: ${
      import.meta.env.VITE_ARCHIVE_PRELOAD_INTERVAL
    } `
  );
}

if (isNaN(preloadRangeFragmentTimeout)) {
  throw new Error(
    `VITE_PRELOAD_RANGE_FRAGMENT_TIMEOUT должно быть числом. Текущее значение: ${
      import.meta.env.VITE_PRELOAD_RANGE_FRAGMENT_TIMEOUT
    } `
  );
}

type Emitter = (fragment: RangeDto, isPreload: boolean) => void;

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
  private preloadTimeoutId: Nullable<number> = null;
  private emit!: Emitter;
  private supportConnect: () => void;
  private currentTimestamp: number = 0;

  private isFirstPreloadDone = false; // Флаг для отслеживания первой дозагрузки

  constructor(emit: Emitter, supportConnect: () => void) {
    this.emit = emit;
    this.supportConnect = supportConnect;
    this.logger.log("Сервис ArchiveControlService инициализирован.");
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
    this.logger.log("Установлены ranges:", ranges);
  }

  init() {
    this.initGenerator(this.currentFragment.start_time);
    this.logger.log("Инициализация воспроизведения с начального фрагмента.");
    this.preloadRangeFragment(); // Отправляем первый фрагмент
    this.initSupportConnectInterval();
    this.scheduleNextPreload(); // Начинаем дозагрузку
  }

  clear() {
    this.logger.log("Очистка состояния ArchiveControlService.");
    this.fragmentIndex = 0;
    this.ranges = [];
    this.isFirstPreloadDone = false; // Сбрасываем флаг при очистке
    this.clearSupportConnectInterval();
    this.clearPreloadTimeout();
  }

  toNextFragment() {
    if (!this.nextFragment) {
      this.logger.warn(
        "Нельзя переключиться к следующему фрагменту: текущий фрагмент последний."
      );
      return;
    }

    this.fragmentIndex += 1;
    this.currentTimestamp = this.currentFragment.start_time;
    this.logger.log(
      "Переключение на следующий фрагмент с индексом",
      this.fragmentIndex
    );

    EventBus.emit("new-archive-fragment-started", this.currentFragment);
    this.clearPreloadTimeout();
    this.preloadRangeFragment(); // Переход на новый range
    this.scheduleNextPreload(); // Начинаем дозагрузку
  }

  toPrevFragment() {
    if (!this.prevFragment) {
      this.logger.warn(
        "Нельзя переключиться к предыдущему фрагменту: текущий фрагмент первый."
      );
      return;
    }

    this.fragmentIndex -= 1;
    this.currentTimestamp = this.currentFragment.start_time;
    this.logger.log(
      "Переключение на предыдущий фрагмент с индексом",
      this.fragmentIndex
    );

    EventBus.emit("new-archive-fragment-started", this.currentFragment);
    this.clearPreloadTimeout();
    this.preloadRangeFragment(); // Переход на новый range
    this.scheduleNextPreload(); // Начинаем дозагрузку
  }

  setCurrentRange(timestamp: number, range: RangeDto) {
    const rangeIndex = this.findRangeIndex(range.start_time, range.end_time);
    if (rangeIndex === -1) {
      this.logger.error("Указанный range не найден в списке ranges.");
      return;
    }

    this.fragmentIndex = rangeIndex;
    this.currentTimestamp = timestamp;
    this.logger.log(
      "Установлен текущий range с индексом",
      this.fragmentIndex,
      "и временем",
      this.currentTimestamp
    );

    // EventBus.emit("new-archive-fragment-started", this.currentFragment);
    this.clearPreloadTimeout();
    this.preloadRangeFragment(); // Переход на новый range
    this.scheduleNextPreload(); // Начинаем дозагрузку
  }

  private initGenerator(startTimestamp: number) {
    this.rangeFragmentsGenerator =
      this.splitRangeIntoFragmentsLazy(startTimestamp);
  }

  private *splitRangeIntoFragmentsLazy(
    startTimestamp: number
  ): Generator<RangeFragment> {
    for (
      let rangeIndex = this.fragmentIndex;
      rangeIndex < this.ranges.length;
      rangeIndex++
    ) {
      const range = this.ranges[rangeIndex];
      let rangeFragmentStart = range.start_time;
      if (
        rangeIndex === this.fragmentIndex &&
        startTimestamp > range.start_time
      ) {
        rangeFragmentStart = startTimestamp;
      }

      while (rangeFragmentStart < range.end_time) {
        const rangeFragmentEnd = Math.min(
          rangeFragmentStart + preloadInterval,
          range.end_time
        );
        const fragmentDuration = rangeFragmentEnd - rangeFragmentStart;

        const subFragmentIndex = Math.floor(
          (rangeFragmentStart - range.start_time) / preloadInterval
        );

        yield {
          start_time: rangeFragmentStart,
          end_time: rangeFragmentEnd,
          duration: fragmentDuration,
          fragmentIndex: rangeIndex,
          subFragmentIndex: subFragmentIndex,
          isLastFragment: rangeFragmentEnd >= range.end_time,
        };

        rangeFragmentStart = rangeFragmentEnd;
      }
    }
  }

  private preloadRangeFragment() {
    // Первый фрагмент отправляется без продвижения генератора
    const rangeFragmentResult = this.rangeFragmentsGenerator.next();
    if (rangeFragmentResult.done) {
      this.logger.log("Все фрагменты загружены.");
      return;
    }

    const rangeFragment = rangeFragmentResult.value;
    this.emit(rangeFragment, false); // Первый фрагмент
    this.isFirstPreloadDone = true; // Флаг того, что первый фрагмент отправлен
  }

  private scheduleNextPreload() {
    // Если первый фрагмент уже отправлен, начинаем с дозагрузки второго
    if (this.isFirstPreloadDone) {
      const rangeFragmentResult = this.rangeFragmentsGenerator.next();
      if (rangeFragmentResult.done) {
        this.logger.log("Все фрагменты загружены.");
        return;
      }

      const rangeFragment = rangeFragmentResult.value;
      const fragmentDuration = rangeFragment.duration;
      const nextPreloadDelay = Math.max(
        0,
        fragmentDuration - preloadRangeFragmentTimeout
      );

      this.logger.log(
        "Планируем дозагрузку фрагмента через",
        nextPreloadDelay,
        "мс."
      );

      this.preloadTimeoutId = setTimeout(() => {
        this.logger.log("Выполняем дозагрузку фрагмента.");
        this.emit(rangeFragment, true); // Дозагрузка фрагмента
        this.scheduleNextPreload();
      }, nextPreloadDelay);
    }
  }

  private clearPreloadTimeout() {
    if (this.preloadTimeoutId !== null) {
      clearTimeout(this.preloadTimeoutId);
      this.logger.log("Очищен таймаут дозагрузки.");
      this.preloadTimeoutId = null;
    }
  }

  private initSupportConnectInterval() {
    this.logger.log("Запуск интервала поддержки подключения.");
    this.connectionSupporterId = setInterval(() => {
      this.supportConnect();
    }, connectionSupportInterval);
  }

  private clearSupportConnectInterval() {
    if (this.connectionSupporterId !== null) {
      clearInterval(this.connectionSupporterId);
      this.logger.log("Очищен интервал поддержки подключения.");
      this.connectionSupporterId = null;
    }
  }

  private findRangeIndex(
    customStartTime: number,
    customEndTime: number
  ): number {
    for (let i = 0; i < this.ranges.length; i++) {
      const range = this.ranges[i];
      if (
        customStartTime >= range.start_time &&
        customEndTime <= range.end_time
      ) {
        this.logger.log("Найден range с индексом", i, "для заданного времени.");
        return i;
      }
    }

    this.logger.warn("Range для заданного времени не найден.");
    return -1;
  }
}
