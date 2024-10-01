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

export class PlayerModeService {
  private readonly logger = new Logger(PlayerModeService.name);

  private modeConnection!: ModeService;
  private options!: ConnectionOptions;
  private currentMode: Mode = Mode.LIVE;
  private player: VideoPlayerService;
  private archiveControl!: ArchiveControlService;
  private readonly snapshotManager = new SnapshotService();

  private statsDrawer!: StatsOverflowDrawerService;

  private isExport = false;
  private controlsDrawer!: ControlsOverflowDrawerService;

  private soundLevel = "100";
  private speed = "1.0";

  private resolution: Nullable<Stats["resolution"]> = null;
  private isShowStats = true;

  constructor(options: ConnectionOptions, player: VideoPlayerService) {
    this.options = { ...options };
    this.player = player;

    EventBus.on("stats", this.onUpdateStats.bind(this));

    this.statsDrawer = new StatsOverflowDrawerService(
      this.player.videoContainer
    );

    this.enable(Mode.ARCHIVE);
  }

  async switch() {
    await this.reset();
    if (this.currentMode === Mode.LIVE) {
      this.enable(Mode.ARCHIVE);
    } else {
      this.enable(Mode.LIVE);
    }
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
              label: "0.3",
              value: "0.3",
            },
            {
              label: "0.5",
              value: "0.5",
            },
            {
              label: "0.7",
              value: "0.7",
            },
            {
              label: "0.8",
              value: "0.8",
            },
            {
              label: "1.0",
              value: "1.0",
            },
          ],
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
    this.logger.log("Включение режима: ", newMode);

    if (this.currentMode === newMode) {
      this.logger.warn("Попытка включить включенный режим плеера", newMode);
    }

    switch (newMode) {
      case Mode.LIVE:
        this.modeConnection = new LiveVideoService(this.options, this.player);
        this.setupControlsDrawer();
        this.controlsDrawer.setHidden({
          [ControlName.PLAY]: true,
          [ControlName.EXPORT]: true,
          [ControlName.NEXT_FRAGMENT]: true,
          [ControlName.PREV_FRAGMENT]: true,
          [ControlName.SPEED]: true,
        });

        break;
      case Mode.ARCHIVE:
        this.modeConnection = new ArchiveVideoService(
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
    });
    this.controlsDrawer.draw();

    await this.modeConnection.init();
  }

  async reset() {
    await this.modeConnection.reset();

    this.isExport = false;

    this.soundLevel = "100";
    this.speed = "1.0";

    this.statsDrawer.clear();
  }

  private switchPlayState() {
    if (!this.player.isPlaying) {
      this.modeConnection.play?.();
      this.player.play();
    } else {
      this.modeConnection.stop?.();
      this.player.pause();
    }

    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.PLAY]: this.player.isPlaying,
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

  private toNextFragment() {
    this.archiveControl?.toNextFragment();
  }

  private toPrevFragment() {
    this.archiveControl?.toPrevFragment();
  }

  private snap() {
    this.snapshotManager.snap(
      this.player.video,
      this.resolution?.width,
      this.resolution?.height
    );
  }

  private switchStats() {
    this.isShowStats = !this.isShowStats;

    if (this.isShowStats) {
      // включиться сам
    } else {
      this.statsDrawer.clear();
    }

    this.controlsDrawer.updateBinaryButtonsState({
      [ControlName.STATS]: this.isShowStats,
    });

    this.controlsDrawer.draw();
  }

  private switchExportMode() {
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
  }

  private onUpdateStats(stats: Stats) {
    if (!this.isShowStats) {
      return;
    }

    this.statsDrawer.draw(stats);

    if (!stats.resolution.width || !stats.resolution.height) {
      this.resolution = null;
    } else {
      this.resolution = {
        ...stats.resolution,
      };
    }

    this.controlsDrawer.setDisabled({
      [ControlName.SNAPSHOT]: this.resolution === null,
    });

    this.controlsDrawer.draw();
  }

  private onChangeSpeed(event: Event) {
    const target = event.target as HTMLInputElement;

    this.speed = target.value;

    this.controlsDrawer.updateControlValues({
      [ControlName.SPEED]: this.speed,
    });
    this.controlsDrawer.draw();

    this.modeConnection.setSpeed?.(Number(this.speed));
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
}
