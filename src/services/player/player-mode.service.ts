import { Mode } from "../../constants/mode";
import { ModeService } from "../../interfaces/mode";
import { ControlName, SelectOption } from "../../types/controls";
import { ConnectionOptions } from "../../types/connection-options";
import { ArchiveControlService } from "../archive-control.service";
import { Logger } from "../logger/logger.service";
import { ArchiveVideoService } from "../mode/archive.service";
import { LiveVideoService } from "../mode/live.service";
import { SnapshotService } from "../snapshot.service";
import { ControlsOverflowDrawerService } from "./overflow-elements/controls-drawer.service";
import { VideoPlayerService } from "./player.service";
import { Stats } from "../../types/video";
import { EventBus } from "../event-bus.service";
import { StatsOverflowDrawerService } from "./overflow-elements/stats-drawer.service";
import { Nullable } from "../../types/global";
import { CustomEventsService } from "../custom-events.service";
import { PlayerStatsService } from "./player-stats.service";

const quality = {
  sd: { name: "SD", bitrate: 500 },
  hd: { name: "HD", bitrate: 2000 },
  fhd: { name: "FHD", bitrate: 0 },
};

export class PlayerModeService {
  private readonly logger: Logger;
  private customEventsService: CustomEventsService;
  private eventBus: EventBus;

  private modeConnection!: ModeService;
  private options!: ConnectionOptions;
  private currentMode: Mode = Mode.LIVE;
  private archiveControl!: ArchiveControlService;
  private snapshotManager: SnapshotService;

  private readonly playerStats: PlayerStatsService;

  private statsDrawer!: StatsOverflowDrawerService;

  private isExport = false;
  private controlsDrawer!: ControlsOverflowDrawerService;

  private soundLevel = "0";
  private oldSoundLevel: Nullable<string> = null;

  private speed = "1.0";
  private quality: keyof typeof quality = "fhd";

  private resolution: Nullable<Stats["resolution"]> = null;
  private isShowStats = false;
  private metaEnabled = false;

  private timelineScaleOptions: SelectOption[] = [];

  constructor(
    private id: string,
    mode: Mode,
    options: ConnectionOptions,
    private player: VideoPlayerService
  ) {
    this.logger = new Logger(id, PlayerModeService.name);
    this.options = { ...options };
    this.customEventsService = CustomEventsService.getInstance(this.id);
    this.eventBus = EventBus.getInstance(id);
    this.playerStats = new PlayerStatsService(id);
    this.snapshotManager = new SnapshotService(id);

    this.playerStats.init();

    this.eventBus.emit("setup-video", this.player.video);

    this.setListeners();

    this.statsDrawer = new StatsOverflowDrawerService(
      id,
      this.player.videoContainer
    );

    this.enable(mode);
  }

  switch() {
    this.logger.log(
      "info",
      `Включаем режим ${
        this.currentMode === Mode.LIVE ? Mode.ARCHIVE : Mode.LIVE
      }`
    );

    this.customEventsService.emit(
      "mode-changed",
      this.currentMode === Mode.LIVE ? Mode.ARCHIVE : Mode.LIVE
    );
  }

  setupControlsDrawer() {
    this.logger.log("debug", `Конфигурируем элементы управления плеером`);

    this.controlsDrawer?.clear();

    this.controlsDrawer = new ControlsOverflowDrawerService(
      this.id,
      this.player.container,
      {
        [ControlName.MODE]: {
          type: "button",
          listeners: {
            click: this.switch.bind(this),
          },
          binary: true,
        },
        [ControlName.PLAY]: {
          type: "button",
          listeners: {
            click: this.switchPlayState.bind(this),
          },
          binary: true,
        },
        [ControlName.VOLUME]: {
          type: "button",
          listeners: {
            click: this.switchVolumeState.bind(this),
          },
          binary: true,
        },
        [ControlName.MICROPHONE]: {
          type: "button",
          listeners: {
            mousedown: this.onMicMouseDown.bind(this),
            mouseup: this.onMicMouseUp.bind(this),
            mouseleave: this.onMicMouseLeave.bind(this),
          },
          binary: true,
        },
        [ControlName.NEXT_FRAGMENT]: {
          type: "button",
          listeners: {
            click: this.toNextFragment.bind(this),
          },
        },
        [ControlName.PREV_FRAGMENT]: {
          type: "button",
          listeners: {
            click: this.toPrevFragment.bind(this),
          },
        },
        [ControlName.STOP]: {
          type: "button",
          listeners: {
            click: this.stop.bind(this),
          },
        },
        [ControlName.META]: {
          type: "button",
          binary: true,
          listeners: {
            click: this.switchMetaState.bind(this),
          },
        },
        [ControlName.EXPORT]: {
          type: "button",
          listeners: {
            click: this.switchExportMode.bind(this),
          },
          binary: true,
        },
        [ControlName.SNAPSHOT]: {
          type: "button",
          listeners: {
            click: this.snap.bind(this),
          },
        },
        [ControlName.STATS]: {
          type: "button",
          listeners: {
            click: this.switchStats.bind(this),
          },
          binary: true,
        },
        [ControlName.SPEED]: {
          type: "select",
          listeners: {
            change: this.onChangeSpeed.bind(this),
          },
          value: this.speed,
          options: [
            {
              label: "1x",
              value: "1.0",
            },
            {
              label: "2x",
              value: "2.0",
            },
            {
              label: "4x",
              value: "4.0",
            },
            {
              label: "8x",
              value: "8.0",
            },
            {
              label: "16x",
              value: "16.0",
            },
          ],
        },

        [ControlName.QUALITY]: {
          type: "select",
          listeners: {
            change: this.onChangeQuality.bind(this),
          },
          value: this.quality,
          options: (Object.keys(quality) as Array<keyof typeof quality>).map(
            (item) => ({
              label: quality[item].name,
              value: item,
            })
          ),
        },

        [ControlName.SOUND]: {
          type: "range",
          listeners: {
            change: this.onChangeSoundLevel.bind(this),
          },
          value: this.soundLevel,
          getLabel: () => `${this.soundLevel}%`,
        },

        [ControlName.SCALE]: {
          type: "select",
          listeners: {
            change: this.changeScale.bind(this),
          },
          value: undefined,
          options: this.timelineScaleOptions,
          placeholderLabel: "Не выбрано",
        },
      }
    );
  }

  private onConnectionStateChange = () => {
    this.logger.log(
      "debug",
      `Новый статус соединения ${this.modeConnection.connectionState}, ${
        this.modeConnection.connectionState !== "connected"
          ? "отображаем"
          : "скрываем"
      } заглушку`
    );

    this.player.togglePlaceholder(
      this.modeConnection.connectionState !== "connected"
    );
  };

  async enable(newMode: Mode) {
    this.modeConnection?.reset();
    this.logger.log("info", "Включение режима: ", newMode);

    if (this.currentMode === newMode) {
      this.logger.warn(
        "debug",
        "Попытка включить включенный режим плеера",
        newMode
      );
    }

    switch (newMode) {
      case Mode.LIVE:
        const options = {
          ...this.options,
        };

        if (this.quality !== "fhd") {
          this.logger.log(
            "debug",
            `Выбрано ограничение битрета ${this.quality}`
          );

          options.constrains = {
            maxBitrate: quality[this.quality].bitrate,
          };
        }

        this.modeConnection = new LiveVideoService(
          this.id,
          options,
          this.player,
          this.onConnectionStateChange
        );
        this.setupControlsDrawer();
        this.controlsDrawer.setHidden({
          [ControlName.PLAY]: true,
          [ControlName.EXPORT]: true,
          [ControlName.STOP]: true,
          [ControlName.NEXT_FRAGMENT]: true,
          [ControlName.PREV_FRAGMENT]: true,
          [ControlName.SPEED]: true,
          [ControlName.SCALE]: true,
        });

        break;
      case Mode.ARCHIVE:
        this.modeConnection = new ArchiveVideoService(
          this.id,
          this.options,
          this.player,
          (archiveControl) => (this.archiveControl = archiveControl),
          this.onConnectionStateChange
        );
        this.setupControlsDrawer();
        this.controlsDrawer.setHidden({
          [ControlName.MICROPHONE]: true,
        });

        break;
    }

    this.currentMode = newMode;

    this.controlsDrawer.setBinaryButtonsState({
      [ControlName.MODE]: newMode === Mode.LIVE,
      [ControlName.PLAY]: this.player.isPlaying,
      [ControlName.VOLUME]: this.player.isVolumeOn,
      [ControlName.EXPORT]: this.isExport,
      [ControlName.MICROPHONE]: (this.modeConnection as LiveVideoService)?.mic
        ?.isMicEnabled,
      [ControlName.STATS]: this.isShowStats,
      [ControlName.META]: this.metaEnabled,
    });
    this.controlsDrawer.draw();

    await this.modeConnection.init(this.metaEnabled);
  }

  async reset() {
    this.logger.log("debug", "Очистка сервиса");

    this.playerStats.reset();

    this.clearListeners();

    this.isExport = false;

    this.soundLevel = "0";
    this.oldSoundLevel = null;

    this.speed = "1.0";

    this.metaEnabled = true;

    this.statsDrawer.clear();

    await this.modeConnection.reset();
  }

  private switchPlayState() {
    this.logger.log(
      "debug",
      `Переключение режима воспроизведения после нажатия на кнопку управления, новый режим: ${
        this.player.isPlaying ? "плей" : "пауза"
      }`
    );

    if (!this.player.isPlaying) {
      this.modeConnection.play?.(true);
      this.player.play();
    } else {
      this.modeConnection.pause?.();
      this.player.pause();
    }

    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.PLAY]: this.player.isPlaying,
    });
    this.controlsDrawer.draw();
  }

  private enablePlay = () => {
    this.logger.log(
      "trace",
      `Переключение режима воспроизведения после срабатывания коллбэка`
    );

    this.player.play();

    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.PLAY]: this.player.isPlaying,
    });

    this.controlsDrawer.draw();
  };

  private stop() {
    this.logger.log("debug", `Установление режима воспроизведения в стоп`);

    this.modeConnection.stop?.();
    this.player.pause();

    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.PLAY]: false,
    });
    this.controlsDrawer.draw();
  }

  private switchVolumeState() {
    this.logger.log(
      "debug",
      `${this.player.isVolumeOn ? "Выключаем" : "Включаем"} звук`
    );

    if (!this.player.isVolumeOn) {
      this.soundLevel = this.oldSoundLevel ?? "100";
      this.oldSoundLevel = null;

      this.player.setVolume(Number(this.soundLevel) / 100);

      this.player.volumeOn();
    } else {
      this.oldSoundLevel = this.soundLevel;
      this.soundLevel = "0";

      this.player.volumeMute();
    }

    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.VOLUME]: this.player.isVolumeOn,
    });
    this.controlsDrawer.updateControlValues({
      [ControlName.SOUND]: this.soundLevel,
    });

    this.controlsDrawer.draw();
  }

  private switchMetaState() {
    this.logger.log(
      "debug",
      `${this.metaEnabled ? "Выключаем" : "Включаем"} отображение метаданных`
    );

    const newState = !this.metaEnabled;

    this.modeConnection.toggleMeta(newState);

    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.META]: newState,
    });

    this.metaEnabled = newState;
    this.controlsDrawer.draw();
  }

  private toNextFragment() {
    this.logger.log("debug", `Переходим к следующему фрагменту`);

    this.archiveControl?.toNextFragment();
  }

  private toPrevFragment() {
    this.logger.log("debug", `Переходим к предыдущему фрагменту`);

    this.archiveControl?.toPrevFragment();
  }

  private snap() {
    this.logger.log("debug", `Делаем скриншот`);

    const metaLayer = this.player.container.getElementsByTagName("canvas")[0];

    this.snapshotManager.snap(
      this.resolution?.width || 0,
      this.resolution?.height || 0,
      this.player.video,
      metaLayer
    );
  }

  private switchStats() {
    this.logger.log(
      "debug",
      `${this.isShowStats ? "Выключаем" : "включаем"} отображение статистики`
    );

    this.isShowStats = !this.isShowStats;

    if (!this.isShowStats) {
      this.statsDrawer.clear();
    }

    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.STATS]: this.isShowStats,
    });

    this.controlsDrawer.draw();
  }

  private switchExportMode = () => {
    this.logger.log("debug", `Переключаем режим экспорта`);

    if (this.isExport === false) {
      this.modeConnection.export?.();

      this.isExport = true;
    } else {
      this.modeConnection.cancelExport?.();

      this.isExport = false;
    }

    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.EXPORT]: this.isExport,
    });
    this.controlsDrawer.draw();
  };

  private resetExportMode = () => {
    this.logger.log("debug", `Обнуляем режим экспорта`);

    this.isExport = false;

    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.EXPORT]: this.isExport,
    });
    this.controlsDrawer.draw();
  };

  private onUpdateStats = (stats: Stats) => {
    this.logger.log(
      "trace",
      `Коллбэк на изменение статистики, новая статистика: ${JSON.stringify(
        stats
      )}`
    );

    if (!stats.resolution.width || !stats.resolution.height) {
      this.resolution = null;
    } else {
      this.resolution = {
        ...stats.resolution,
      };
    }

    if (!this.isShowStats) {
      return;
    }

    this.statsDrawer.draw(stats);
  };

  private onChangeSpeed(event: Event) {
    const target = event.target as HTMLInputElement;

    this.logger.log(
      "debug",
      `Скорость изменена, новая скорость: ${JSON.stringify(target.value)}`
    );

    this.speed = target.value;

    this.controlsDrawer.updateControlValues({
      [ControlName.SPEED]: this.speed,
    });
    this.controlsDrawer.draw();

    this.modeConnection.setSpeed?.(Number(this.speed));
  }

  private onChangeQuality(event: Event) {
    const target = event.target as HTMLInputElement;

    this.logger.log(
      "debug",
      `Качество изменено, новое качество: ${JSON.stringify(target.value)}`
    );

    // @ts-ignore
    this.quality = target.value;

    this.controlsDrawer.updateControlValues({
      [ControlName.QUALITY]: this.quality,
    });
    this.controlsDrawer.draw();

    this.modeConnection.reinitWithNewOptions?.(
      {
        ...this.options,
        constrains: {
          maxBitrate: quality[target.value as keyof typeof quality].bitrate,
        },
      },
      this.metaEnabled
    );
  }

  private onChangeSoundLevel(event: Event) {
    const target = event.target as HTMLInputElement;

    this.logger.log(
      "debug",
      `Громкость изменена, новая громкость: ${JSON.stringify(target.value)}`
    );

    this.soundLevel = target.value;

    this.player.setVolume(Number(this.soundLevel) / 100);

    if (this.soundLevel !== "0") {
      this.player.volumeOn();
    } else {
      this.oldSoundLevel = "100";
      this.player.volumeMute();
    }

    this.controlsDrawer.updateControlValues({
      [ControlName.SOUND]: this.soundLevel,
    });
    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.VOLUME]: this.soundLevel !== "0",
    });

    this.controlsDrawer.draw();
  }

  private changeScale(event: Event) {
    const target = event.target as HTMLInputElement;

    this.logger.log(
      "debug",
      `Масштаб таймлайна изменен, новый масштаб: ${JSON.stringify(
        target.value
      )}`
    );

    const newScale = target.value;
    if (!newScale) {
      return;
    }

    this.controlsDrawer.updateControlValues({
      [ControlName.SCALE]: newScale,
    });
    this.controlsDrawer.draw();

    this.eventBus.emit("set-timeline-scale", Number(newScale));
  }

  private onManualScaleChange = (scale: string) => {
    this.logger.log(
      "debug",
      `Коллбэк на изменение масштаба таймлайна сработал, новый масштаб: ${JSON.stringify(
        scale
      )}`
    );

    this.controlsDrawer.updateControlValues({
      [ControlName.SCALE]: scale,
    });
    this.controlsDrawer.draw();
  };

  private onSetTimelineScaleOptions = ([current, options]: [
    current: string,
    options: SelectOption[]
  ]) => {
    this.logger.log(
      "debug",
      `Устанавливаем варианты масштаба ${JSON.stringify(
        options
      )}, текущий вариант ${current}`
    );

    this.timelineScaleOptions = options;

    this.controlsDrawer.updateControlValues({
      [ControlName.SCALE]: current,
    });
    this.controlsDrawer.updateSelectOptions(
      ControlName.SCALE,
      this.timelineScaleOptions
    );

    this.controlsDrawer.draw();
  };

  private onMicMouseDown() {
    this.logger.log("debug", `Нажата кнопка микрофона`);

    const liveConnection = this.modeConnection as LiveVideoService;
    if (liveConnection) {
      liveConnection.mic.micCallbacks?.mousedown();
    }
  }

  private onMicMouseUp() {
    this.logger.log("debug", `Кнопку микрофона отпущена`);

    const liveConnection = this.modeConnection as LiveVideoService;
    if (liveConnection) {
      liveConnection.mic.micCallbacks?.mouseup();
    }
  }

  private onMicMouseLeave() {
    this.logger.log("debug", `Курсор мыши вышел за пределы кнопки микрофона`);

    const liveConnection = this.modeConnection as LiveVideoService;
    if (liveConnection) {
      liveConnection.mic.micCallbacks?.mouseleave();
    }
  }

  private onChangeMicState = (micState: boolean) => {
    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.MICROPHONE]: micState,
    });
    this.controlsDrawer.draw();
  };

  private wasSoundEnabled: boolean | undefined;
  // @ts-ignore
  private onPush2Talk = (push2TalkState: boolean) => {
    if (typeof this.wasSoundEnabled === "boolean") {
      this.wasSoundEnabled && this.switchVolumeState();
      this.wasSoundEnabled &&
        this.logger.log(
          "debug",
          `Возвращаем звук после выключения микрофона в режиме Push to talk`
        );
      this.wasSoundEnabled = undefined;
    } else {
      this.wasSoundEnabled = this.player.isVolumeOn;
      this.wasSoundEnabled && this.switchVolumeState();
      this.logger.log(
        "debug",
        this.wasSoundEnabled
          ? `Приглушаем звук на время включения микрофона в режиме Push to talk`
          : `Звук уже выключен,не требуется его приглушать на время работы режима Push to talk`
      );
    }
  };

  private restartConnection = () => {
    this.logger.log("debug", `Перезапускаем соединение`);

    this.modeConnection.reinitWithNewOptions?.(
      {
        ...this.options,
        constrains: {
          maxBitrate: quality[this.quality].bitrate,
        },
      },
      this.metaEnabled
    );
  };

  private setListeners() {
    this.logger.log("debug", `Устанавливаем слушателей`);

    this.eventBus.on("stats", this.onUpdateStats);
    this.eventBus.on("cancel-export", this.resetExportMode);
    this.eventBus.on("play-enabled", this.enablePlay);
    this.eventBus.on(
      "set-timeline-scale-options",
      this.onSetTimelineScaleOptions
    );
    this.eventBus.on("change-mic-state", this.onChangeMicState);
    this.eventBus.on("manual-scale-change", this.onManualScaleChange);
    this.eventBus.on("push2Talk", this.onPush2Talk);
    this.eventBus.on("restart-connection", this.restartConnection);
  }

  private clearListeners() {
    this.logger.log("debug", `Убираем слушателей`);

    this.eventBus.off("stats", this.onUpdateStats);
    this.eventBus.off("cancel-export", this.resetExportMode);
    this.eventBus.off("play-enabled", this.enablePlay);
    this.eventBus.off(
      "set-timeline-scale-options",
      this.onSetTimelineScaleOptions
    );
    this.eventBus.off("change-mic-state", this.onChangeMicState);
    this.eventBus.off("manual-scale-change", this.onManualScaleChange);
    this.eventBus.off("push2Talk", this.onPush2Talk);
    this.eventBus.off("restart-connection", this.restartConnection);
  }
}
