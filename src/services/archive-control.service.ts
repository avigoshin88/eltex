import { Mode } from "../constants/mode";
import { RangeDto, RangeFragment } from "../dto/ranges";
import { Nullable } from "../types/global";
import { CustomEventsService } from "./custom-events.service";
import { EnvService } from "./env.service";
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

type Emitter = (
  fragment: RangeFragment,
  isPreload: boolean,
  isNeedToUpdateTrack?: boolean
) => void;

export class ArchiveControlService {
  private logger: Logger;
  private customEventsService: CustomEventsService;

  private ranges: RangeDto[] = [];
  private fragmentIndex = 0;
  private currentSubFragment = 0;
  private rangeFragmentsGenerator!: Generator<RangeFragment>;

  private connectionSupporterId: Nullable<number> = null;
  private preloadTimeoutId: Nullable<number> = null;

  private emit!: Emitter;
  private supportConnect: () => void;
  private currentTimestamp: number = 0;

  private speed: number = 1;

  private isFirstPreloadDone = false; // Флаг для отслеживания первой дозагрузки
  private isPause = false;

  public isNewRange = false;

  constructor(private id: string, emit: Emitter, supportConnect: () => void) {
    this.logger = new Logger(id, "ArchiveControlService");
    this.customEventsService = CustomEventsService.getInstance(this.id);
    this.emit = emit;
    this.supportConnect = supportConnect;
  }

  getCurrentFragment() {
    this.logger.log("trace", `Запрос текущего фрагмента`);
    return this.ranges[this.fragmentIndex];
  }

  getNextFragment() {
    this.logger.log("trace", `Запрос следующего фрагмента`);
    if (this.fragmentIndex >= this.ranges.length - 1) {
      this.logger.log("trace", `Следующего фрагмента нет, текущий последний`);
      return null;
    }
    return this.ranges[this.fragmentIndex + 1];
  }

  getPrevFragment() {
    this.logger.log("trace", `Запрос предыдущего фрагмента`);
    if (this.fragmentIndex === 0) {
      this.logger.log("trace", `Предыдущего фрагмента нет, текущий первый`);
      return null;
    }
    return this.ranges[this.fragmentIndex - 1];
  }

  setRanges(ranges: RangeDto[]) {
    this.logger.log("trace", "Установлены фрагменты:", JSON.stringify(ranges));
    this.ranges = [...ranges];
  }

  setFragmentIndex(index: number) {
    this.logger.log("trace", `Устанавливаем новый номер фрагмента: ${index}`);
    this.fragmentIndex = index;
  }

  init() {
    this.initGenerator(this.getCurrentFragment().start_time);
    this.logger.log(
      "debug",
      "Инициализация воспроизведения с начального фрагмента."
    );
  }

  clear() {
    this.logger.log("debug", "Очистка состояния ArchiveControlService.");
    this.fragmentIndex = 0;
    this.ranges = [];
    this.isFirstPreloadDone = false;
    this.isPause = false;
    this.speed = 1;

    this.isNewRange = false;
    this.clearSupportConnectInterval();
    this.clearPreloadTimeout();
  }

  clearIntervals() {
    this.logger.log("debug", `Чистим интервалы`);
    this.clearSupportConnectInterval();
    this.clearPreloadTimeout();
  }

  toNextFragment() {
    this.logger.log("trace", `Переход к следующего фрагменту`);

    const nextFragment = this.getNextFragment();

    if (!nextFragment) {
      this.logger.warn(
        "trace",
        "Нельзя переключиться к следующему фрагменту, переключаемся в режим Live"
      );

      this.switchToLiveMode();
      return;
    }

    this.logger.log(
      "trace",
      "Переключение на следующий фрагмент с индексом",
      this.fragmentIndex + 1
    );

    this.setCurrentRange(
      nextFragment.start_time,
      nextFragment,
      true,
      false,
      true
    );
  }

  toPrevFragment() {
    this.logger.log("trace", `Переход к предыдущему фрагменты`);

    const prevFragment = this.getPrevFragment();

    if (!prevFragment) {
      this.logger.warn("trace", "Нельзя переключиться к предыдущему фрагменту");
      return;
    }

    this.logger.log(
      "trace",
      "Переключение на предыдущий фрагмент с индексом",
      this.fragmentIndex - 1
    );

    this.setCurrentRange(
      prevFragment.start_time,
      prevFragment,
      true,
      false,
      true
    );
  }

  pause(currentTimestamp: number) {
    this.logger.log("trace", "Пауза дозагрузки фрагментов.");

    this.currentTimestamp = currentTimestamp;
    this.fragmentIndex = this.findRangeIndex(
      currentTimestamp,
      currentTimestamp
    );

    this.isPause = true;

    this.clearPreloadTimeout();
  }

  resume() {
    this.logger.log("trace", "Возобновление дозагрузки фрагментов.");

    this.isPause = false;

    this.initGenerator(this.currentTimestamp);
    this.preloadRangeFragment();
  }

  updateRanges(ranges: RangeDto[], currentTime: number) {
    this.ranges = ranges;
    this.currentTimestamp = currentTime;
    this.logger.log("trace", "Обновлены ranges:", ranges);

    const rangeFragmentResult = this.rangeFragmentsGenerator.next();
    if (rangeFragmentResult.done) {
      this.logger.log("trace", "Все фрагменты загружены.");
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
    preload = false,
    isNeedToUpdateTrack = false
  ) {
    const rangeIndex = this.findRangeIndex(range.start_time, range.end_time);
    if (rangeIndex === -1) {
      this.logger.error("trace", "Указанный range не найден в списке ranges.");
      return;
    }

    this.fragmentIndex = rangeIndex;
    this.currentTimestamp = timestamp;

    this.logger.log(
      "trace",
      "Установлен текущий range с индексом",
      this.fragmentIndex,
      "и временем",
      this.currentTimestamp
    );

    this.initGenerator(this.currentTimestamp);

    if (emitEnable) {
      this.isPause = false;

      this.clearPreloadTimeout();
      this.preloadRangeFragment(preload, isNeedToUpdateTrack); // Переход на новый range
    }
  }

  setCurrentTime(timestamp: number, isPreload = false, onlySave = false) {
    const rangeIndex = this.findRangeIndex(timestamp, timestamp);
    if (rangeIndex === -1) {
      this.logger.error("trace", "Указанный range не найден в списке ranges.");
      return;
    }

    if (onlySave) {
      this.currentTimestamp = timestamp;
      this.fragmentIndex = rangeIndex;

      this.logger.log(
        "trace",
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
        "trace",
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
    this.logger.log("trace", `Устанавливаем скорость ${speed}`);
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
        if (rangeFragmentStart < startTimestamp) {
          rangeFragmentStart = startTimestamp;
        }
        if (rangeFragmentStart >= range.end_time) {
          continue;
        }
      }

      const isLastRange = rangeIndex === this.ranges.length - 1;

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

        const isLastSubFragmentOfLastRange =
          isLastRange && rangeFragmentEnd >= range.end_time;

        yield {
          start_time: rangeFragmentStart,
          end_time: rangeFragmentEnd,
          duration: fragmentDuration,
          fragmentIndex: rangeIndex,
          subFragmentIndex: currentSubFragmentIndex,
          isLastFragment: rangeFragmentEnd >= range.end_time,
          isLastRangeSubFragment: isLastSubFragmentOfLastRange,
        };

        rangeFragmentStart = rangeFragmentEnd;
      }
    }
  }

  public preloadRangeFragment(preload = false, isNeedToUpdateTrack = false) {
    // Первый фрагмент отправляется без продвижения генератора
    const rangeFragmentResult = this.rangeFragmentsGenerator.next();
    if (rangeFragmentResult.done) {
      this.logger.log("trace", "Все фрагменты загружены.");
      this.switchToLiveMode();
      return;
    }

    const rangeFragment = rangeFragmentResult.value;

    this.fragmentIndex = rangeFragment.fragmentIndex;
    this.currentSubFragment = rangeFragment.subFragmentIndex;

    this.emit(rangeFragment, preload, isNeedToUpdateTrack); // Первый фрагмент
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
        this.logger.log("trace", "Все фрагменты загружены.");
        this.switchToLiveMode();
        return;
      }

      const rangeFragment = rangeFragmentResult.value;

      this.currentSubFragment = rangeFragment.subFragmentIndex;

      const fragmentDuration = rangeFragment.duration;
      const nextPreloadDelay =
        Math.max(
          0,
          this.isNewRange
            ? fragmentDuration - preloadRangeFragmentTimeout
            : fragmentDuration
        ) / this.speed;

      if (this.isNewRange) {
        this.isNewRange = false;
      }

      this.logger.log(
        "trace",
        "Планируем дозагрузку фрагмента через",
        nextPreloadDelay,
        "мс."
      );

      this.preloadTimeoutId = setTimeout(() => {
        this.logger.log("trace", "Выполняем дозагрузку фрагмента.");
        this.emit(rangeFragment, true); // Дозагрузка фрагмента
        this.scheduleNextPreload();
      }, nextPreloadDelay);
    }
  }

  public clearPreloadTimeout() {
    if (this.preloadTimeoutId !== null) {
      clearTimeout(this.preloadTimeoutId);
      this.logger.log("trace", "Очищен таймаут дозагрузки.");
      this.preloadTimeoutId = null;
    }
  }

  public initSupportConnectInterval() {
    this.logger.log("trace", "Запуск интервала поддержки подключения.");
    this.clearSupportConnectInterval();
    this.connectionSupporterId = setInterval(() => {
      this.supportConnect();
    }, connectionSupportInterval);
  }

  private clearSupportConnectInterval() {
    if (this.connectionSupporterId !== null) {
      clearInterval(this.connectionSupporterId);
      this.logger.log("trace", "Очищен интервал поддержки подключения.");
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
          "trace",
          "Найден range с индексом",
          i,
          "для заданного времени."
        );
        return i;
      }
    }

    this.logger.warn("trace", "Range для заданного времени не найден.");
    return -1;
  }

  private switchToLiveMode() {
    this.logger.log("debug", "Переключение на режим LIVE.");
    this.customEventsService.emit("mode-changed", Mode.LIVE);
  }
}
