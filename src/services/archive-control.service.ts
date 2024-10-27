import { Mode } from "../constants/mode";
import { RangeDto } from "../dto/ranges";
import { Nullable } from "../types/global";
import { CustomEventsService } from "./custom-events.service";
import { EnvService } from "./env.service";
import { EventBus } from "./event-bus.service";
import { Logger } from "./logger/logger.service";

const connectionSupportInterval = EnvService.getENVAsNumber(
  "VITE_ARCHIVE_CONNECT_SUPPORT_INTERVAL"
);

const preloadRangeFragmentTimeout = EnvService.getENVAsNumber(
  "VITE_PRELOAD_RANGE_FRAGMENT_TIMEOUT"
);

const preloadInterval = EnvService.getENVAsNumber(
  "VITE_ARCHIVE_PRELOAD_INTERVAL"
);

type Emitter = (fragment: RangeDto, isPreload: boolean) => void;

type RangeFragment = RangeDto & {
  fragmentIndex: number;
  subFragmentIndex: number;
  isLastFragment: boolean;
};

export class ArchiveControlService {
  private readonly logger = new Logger(ArchiveControlService.name);
  private customEventsService: CustomEventsService;
  private eventBus: EventBus;

  private ranges: RangeDto[] = [];
  private fragmentIndex = 0;
  private currentSubFragment = 0;
  private rangeFragmentsGenerator!: Generator<RangeFragment>;
  private connectionSupporterId: Nullable<NodeJS.Timeout> = null;
  private preloadTimeoutId: Nullable<NodeJS.Timeout> = null;
  private emit!: Emitter;
  private supportConnect: () => void;
  private currentTimestamp: number = 0;

  private speed: number = 1;

  private isFirstPreloadDone = false; // Флаг для отслеживания первой дозагрузки
  private isPause = false;

  constructor(private id: string, emit: Emitter, supportConnect: () => void) {
    this.eventBus = EventBus.getInstance(this.id);
    this.customEventsService = CustomEventsService.getInstance(this.id);
    this.emit = emit;
    this.supportConnect = supportConnect;
    this.logger.log("info", "Сервис ArchiveControlService инициализирован.");
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
    this.logger.log("info", "Установлены ranges:", ranges);
  }

  init() {
    this.initGenerator(this.currentFragment.start_time);
    this.logger.log(
      "info",
      "Инициализация воспроизведения с начального фрагмента."
    );
  }

  clear() {
    this.logger.log("info", "Очистка состояния ArchiveControlService.");
    this.fragmentIndex = 0;
    this.ranges = [];
    this.isFirstPreloadDone = false;
    this.isPause = false;
    this.speed = 1;
    this.clearSupportConnectInterval();
    this.clearPreloadTimeout();
  }

  clearIntervals() {
    this.clearSupportConnectInterval();
    this.clearPreloadTimeout();
  }

  toNextFragment() {
    if (!this.nextFragment) {
      this.logger.warn(
        "info",
        "Нельзя переключиться к следующему фрагменту: текущий фрагмент последний."
      );
      return;
    }

    this.logger.log(
      "info",
      "Переключение на следующий фрагмент с индексом",
      this.fragmentIndex + 1
    );

    this.setCurrentRange(this.nextFragment.start_time, this.nextFragment, true);
    this.eventBus.emit("new-archive-fragment-started", this.currentFragment);
  }

  toPrevFragment() {
    if (!this.prevFragment) {
      this.logger.warn(
        "info",
        "Нельзя переключиться к предыдущему фрагменту: текущий фрагмент первый."
      );
      return;
    }

    this.logger.log(
      "info",
      "Переключение на предыдущий фрагмент с индексом",
      this.fragmentIndex - 1
    );

    this.setCurrentRange(this.prevFragment.start_time, this.prevFragment, true);
    this.eventBus.emit("new-archive-fragment-started", this.currentFragment);
  }

  pause(currentTimestamp: number) {
    this.logger.log("info", "Пауза дозагрузки фрагментов.");

    this.currentTimestamp = currentTimestamp;
    this.fragmentIndex = this.findRangeIndex(
      currentTimestamp,
      currentTimestamp
    );

    this.isPause = true;

    this.clearPreloadTimeout();
  }

  resume() {
    this.logger.log("info", "Возобновление дозагрузки фрагментов.");

    this.isPause = false;

    this.initGenerator(this.currentTimestamp);
    this.preloadRangeFragment();
  }

  updateRanges(ranges: RangeDto[], currentTime: number) {
    this.ranges = ranges;
    this.currentTimestamp = currentTime;
    this.logger.log("info", "Обновлены ranges:", ranges);

    const rangeFragmentResult = this.rangeFragmentsGenerator.next();
    if (rangeFragmentResult.done) {
      this.logger.log("info", "Все фрагменты загружены.");
      return;
    }

    const nextSubFragment = rangeFragmentResult.value;

    this.fragmentIndex = nextSubFragment.fragmentIndex;
    this.currentSubFragment = nextSubFragment.subFragmentIndex;

    this.initGenerator(this.currentTimestamp, this.currentSubFragment);
  }

  setCurrentRange(
    timestamp: number,
    range: RangeDto,
    emitEnable = true,
    preload = false
  ) {
    const rangeIndex = this.findRangeIndex(range.start_time, range.end_time);
    if (rangeIndex === -1) {
      this.logger.error("info", "Указанный range не найден в списке ranges.");
      return;
    }

    this.fragmentIndex = rangeIndex;
    this.currentTimestamp = timestamp;
    this.logger.log(
      "info",
      "Установлен текущий range с индексом",
      this.fragmentIndex,
      "и временем",
      this.currentTimestamp
    );

    this.initGenerator(this.currentTimestamp);

    if (emitEnable) {
      this.isPause = false;

      this.clearPreloadTimeout();
      this.preloadRangeFragment(preload); // Переход на новый range
    }
  }

  setCurrentTime(timestamp: number, isPreload = false, onlySave = false) {
    console.log(
      "🚀 ~ ArchiveControlService ~ setCurrentTime ~ onlySave:",
      timestamp,
      isPreload,
      onlySave
    );
    const rangeIndex = this.findRangeIndex(timestamp, timestamp);
    if (rangeIndex === -1) {
      this.logger.error("info", "Указанный range не найден в списке ranges.");
      return;
    }

    if (onlySave) {
      this.currentTimestamp = timestamp;
      this.fragmentIndex = rangeIndex;

      this.logger.log(
        "info",
        "Установлен текущий range с индексом",
        this.fragmentIndex,
        "и временем",
        this.currentTimestamp
      );

      this.initGenerator(this.currentTimestamp);
      return;
    }

    if (!isPreload) {
      this.setCurrentRange(timestamp, this.ranges[rangeIndex], true);
    } else {
      this.currentTimestamp = timestamp;
      this.fragmentIndex = rangeIndex;

      this.logger.log(
        "info",
        "Установлен текущий range с индексом",
        this.fragmentIndex,
        "и временем",
        this.currentTimestamp
      );

      this.isPause = false;

      this.clearPreloadTimeout();
      this.initGenerator(this.currentTimestamp);
      this.preloadRangeFragment(true);
    }
  }

  public setSpeed(speed: number) {
    this.speed = speed;
  }

  private initGenerator(startTimestamp: number, subFragmentIndex?: number) {
    this.rangeFragmentsGenerator = this.splitRangeIntoFragmentsLazy(
      startTimestamp,
      subFragmentIndex
    );
  }

  private *splitRangeIntoFragmentsLazy(
    startTimestamp: number,
    subFragmentIndex?: number
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

      if (subFragmentIndex !== undefined) {
        rangeFragmentStart =
          range.start_time + subFragmentIndex * preloadInterval * this.speed;
        if (rangeFragmentStart >= range.end_time) {
          continue;
        }
      }

      while (rangeFragmentStart < range.end_time) {
        const interval = preloadInterval * this.speed;

        const rangeFragmentEnd = Math.min(
          rangeFragmentStart + interval,
          range.end_time
        );
        const fragmentDuration = rangeFragmentEnd - rangeFragmentStart;

        const currentSubFragmentIndex = Math.floor(
          (rangeFragmentStart - range.start_time) / interval
        );

        yield {
          start_time: rangeFragmentStart,
          end_time: rangeFragmentEnd,
          duration: fragmentDuration,
          fragmentIndex: rangeIndex,
          subFragmentIndex: currentSubFragmentIndex,
          isLastFragment: rangeFragmentEnd >= range.end_time,
        };

        rangeFragmentStart = rangeFragmentEnd;
      }
    }
  }

  public preloadRangeFragment(preload = false) {
    // Первый фрагмент отправляется без продвижения генератора
    const rangeFragmentResult = this.rangeFragmentsGenerator.next();
    if (rangeFragmentResult.done) {
      this.logger.log("info", "Все фрагменты загружены.");
      this.customEventsService.emit("mode-changed", Mode.LIVE);
      return;
    }

    const rangeFragment = rangeFragmentResult.value;
    console.log(
      "🚀 ~ ArchiveControlService ~ preloadRangeFragment ~ rangeFragment:",
      rangeFragment
    );
    this.fragmentIndex = rangeFragment.fragmentIndex;
    this.currentSubFragment = rangeFragment.subFragmentIndex;

    this.emit(rangeFragment, preload); // Первый фрагмент
    this.isFirstPreloadDone = true; // Флаг того, что первый фрагмент отправлен
  }

  public scheduleNextPreload() {
    if (this.isPause) {
      return;
    }

    // Если первый фрагмент уже отправлен, начинаем с дозагрузки второго
    if (this.isFirstPreloadDone) {
      const rangeFragmentResult = this.rangeFragmentsGenerator.next();
      if (rangeFragmentResult.done) {
        this.logger.log("info", "Все фрагменты загружены.");
        return;
      }

      const rangeFragment = rangeFragmentResult.value;
      console.log(
        "🚀 ~ ArchiveControlService ~ scheduleNextPreload ~ rangeFragment:",
        rangeFragment
      );
      this.fragmentIndex = rangeFragment.fragmentIndex;
      this.currentSubFragment = rangeFragment.subFragmentIndex;

      const fragmentDuration = rangeFragment.duration;
      const nextPreloadDelay =
        Math.max(0, fragmentDuration - preloadRangeFragmentTimeout) /
        this.speed;

      this.logger.log(
        "info",
        "Планируем дозагрузку фрагмента через",
        nextPreloadDelay,
        "мс."
      );

      this.preloadTimeoutId = setTimeout(() => {
        this.logger.log("info", "Выполняем дозагрузку фрагмента.");
        this.emit(rangeFragment, true); // Дозагрузка фрагмента
        this.scheduleNextPreload();
      }, nextPreloadDelay);
    }
  }

  public clearPreloadTimeout() {
    if (this.preloadTimeoutId !== null) {
      clearTimeout(this.preloadTimeoutId);
      this.logger.log("info", "Очищен таймаут дозагрузки.");
      this.preloadTimeoutId = null;
    }
  }

  public initSupportConnectInterval() {
    this.logger.log("info", "Запуск интервала поддержки подключения.");
    this.clearSupportConnectInterval();
    this.connectionSupporterId = setInterval(() => {
      this.supportConnect();
    }, connectionSupportInterval);
  }

  private clearSupportConnectInterval() {
    if (this.connectionSupporterId !== null) {
      clearInterval(this.connectionSupporterId);
      this.logger.log("info", "Очищен интервал поддержки подключения.");
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
        this.logger.log(
          "info",
          "Найден range с индексом",
          i,
          "для заданного времени."
        );
        return i;
      }
    }

    this.logger.warn("info", "Range для заданного времени не найден.");
    return -1;
  }
}
