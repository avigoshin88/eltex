import { Mode } from "../../constants/mode";
import { ModeService } from "../../interfaces/mode";
import { ControlName } from "../../types/controls";
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
  private readonly logger = new Logger(PlayerModeService.name);
  private customEventsService: CustomEventsService;
  private eventBus: EventBus;

  private modeConnection!: ModeService;
  private options!: ConnectionOptions;
  private currentMode: Mode = Mode.LIVE;
  private player: VideoPlayerService;
  private archiveControl!: ArchiveControlService;
  private readonly snapshotManager = new SnapshotService();

  private readonly playerStats: PlayerStatsService;

  private statsDrawer!: StatsOverflowDrawerService;

  private isExport = false;
  private controlsDrawer!: ControlsOverflowDrawerService;

  private soundLevel = "100";
  private speed = "1.0";
  private quality: keyof typeof quality = "fhd";

  private resolution: Nullable<Stats["resolution"]> = null;
  private isShowStats = false;
  private metaEnabled = false;

  constructor(
    private id: string,
    mode: Mode,
    options: ConnectionOptions,
    player: VideoPlayerService
  ) {
    this.options = { ...options };
    this.player = player;
    this.customEventsService = CustomEventsService.getInstance(this.id);
    this.eventBus = EventBus.getInstance(this.id);
    this.playerStats = new PlayerStatsService(this.id);

    this.playerStats.init();

    this.eventBus.emit("setup-video", this.player.video);

    this.setListeners();

    this.statsDrawer = new StatsOverflowDrawerService(
      this.player.videoContainer
    );

    this.enable(mode);
  }

  switch() {
    this.customEventsService.emit(
      "mode-changed",
      this.currentMode === Mode.LIVE ? Mode.ARCHIVE : Mode.LIVE
    );
  }

  setupControlsDrawer() {
    this.controlsDrawer?.clear();

    this.controlsDrawer = new ControlsOverflowDrawerService(
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
      }
    );
  }

  async enable(newMode: Mode) {
    this.modeConnection?.reset();
    this.logger.log("info", "Включение режима: ", newMode);

    if (this.currentMode === newMode) {
      this.logger.warn(
        "info",
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
          options.constrains = {
            maxBitrate: quality[this.quality].bitrate,
          };
        }

        this.modeConnection = new LiveVideoService(
          this.id,
          options,
          this.player
        );
        this.setupControlsDrawer();
        this.controlsDrawer.setHidden({
          [ControlName.PLAY]: true,
          [ControlName.EXPORT]: true,
          [ControlName.STOP]: true,
          [ControlName.NEXT_FRAGMENT]: true,
          [ControlName.PREV_FRAGMENT]: true,
          [ControlName.SPEED]: true,
        });

        break;
      case Mode.ARCHIVE:
        this.modeConnection = new ArchiveVideoService(
          this.id,
          this.options,
          this.player,
          (archiveControl) => (this.archiveControl = archiveControl)
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
    this.playerStats.reset();

    this.clearListeners();

    this.isExport = false;

    this.soundLevel = "100";
    this.speed = "1.0";

    this.metaEnabled = true;

    this.statsDrawer.clear();

    await this.modeConnection.reset();
  }

  private switchPlayState() {
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
    if (this.player.isPlaying) {
      return;
    }

    this.player.play();

    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.PLAY]: this.player.isPlaying,
    });
    this.controlsDrawer.draw();
  };

  private stop() {
    this.modeConnection.stop?.();
    this.player.pause();

    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.PLAY]: false,
    });
    this.controlsDrawer.draw();
  }

  private switchVolumeState() {
    if (!this.player.isVolumeOn) {
      this.player.volumeOn();
    } else {
      this.player.volumeMute();
    }

    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.VOLUME]: this.player.isVolumeOn,
    });
    this.controlsDrawer.draw();
  }

  private switchMetaState() {
    const newState = !this.metaEnabled;

    this.modeConnection.toggleMeta(newState);

    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.META]: newState,
    });

    this.metaEnabled = newState;
    this.controlsDrawer.draw();
  }

  private toNextFragment() {
    this.archiveControl?.toNextFragment();
  }

  private toPrevFragment() {
    this.archiveControl?.toPrevFragment();
  }

  private snap() {
    const metaLayer = this.player.container.getElementsByTagName("canvas")[0];

    this.snapshotManager.snap(
      this.resolution?.width || 0,
      this.resolution?.height || 0,
      this.player.video,
      metaLayer
    );
  }

  private switchStats() {
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
    this.isExport = false;

    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.EXPORT]: this.isExport,
    });
    this.controlsDrawer.draw();
  };

  private onUpdateStats = (stats: Stats) => {
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

    this.controlsDrawer.setDisabled({
      [ControlName.SNAPSHOT]: this.resolution === null,
    });

    this.controlsDrawer.draw();
  };

  private onChangeSpeed(event: Event) {
    const target = event.target as HTMLInputElement;

    this.speed = target.value;

    this.controlsDrawer.updateControlValues({
      [ControlName.SPEED]: this.speed,
    });
    this.controlsDrawer.draw();

    this.modeConnection.setSpeed?.(Number(this.speed));
  }

  private onChangeQuality(event: Event) {
    const target = event.target as HTMLInputElement;

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

    this.soundLevel = target.value;

    this.player.setVolume(Number(this.soundLevel) / 100);

    this.controlsDrawer.updateControlValues({
      [ControlName.SOUND]: this.soundLevel,
    });
    this.controlsDrawer.draw();
  }

  private onMicMouseDown() {
    const liveConnection = this.modeConnection as LiveVideoService;
    if (liveConnection) {
      liveConnection.mic.micCallbacks?.mousedown();

      this.controlsDrawer.updateBinaryButtonsState({
        [ControlName.MICROPHONE]: liveConnection.mic.isMicEnabled,
      });
      this.controlsDrawer.draw();
    }
  }

  private onMicMouseUp() {
    const liveConnection = this.modeConnection as LiveVideoService;
    if (liveConnection) {
      liveConnection.mic.micCallbacks?.mouseup();

      this.controlsDrawer.updateBinaryButtonsState({
        [ControlName.MICROPHONE]: liveConnection.mic.isMicEnabled,
      });
      this.controlsDrawer.draw();
    }
  }

  private onMicMouseLeave() {
    const liveConnection = this.modeConnection as LiveVideoService;
    if (liveConnection) {
      liveConnection.mic.micCallbacks?.mouseleave();

      this.controlsDrawer.updateBinaryButtonsState({
        [ControlName.MICROPHONE]: liveConnection.mic.isMicEnabled,
      });
      this.controlsDrawer.draw();
    }
  }

  private setListeners() {
    this.eventBus.on("stats", this.onUpdateStats);
    this.eventBus.on("cancel-export", this.resetExportMode);
    this.eventBus.on("play-enabled", this.enablePlay);
  }

  private clearListeners() {
    this.eventBus.off("stats", this.onUpdateStats);
    this.eventBus.off("cancel-export", this.resetExportMode);
    this.eventBus.off("play-enabled", this.enablePlay);
  }
}
