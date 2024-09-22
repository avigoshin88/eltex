import { Mode } from "../../constants/mode";
import { ModeService } from "../../interfaces/mode";
import { ControlName } from "../../types/controls";
import { ConnectionOptions } from "../../types/connection-options";
import { Nullable } from "../../types/global";
import { VideoStats } from "../../types/video";
import { ArchiveControlService } from "../archive-control.service";
import { Logger } from "../logger/logger.service";
import { ArchiveVideoService } from "../mode/archive.service";
import { LiveVideoService } from "../mode/live.service";
import { SnapshotService } from "../snapshot.service";
import { ControlsOverflowDrawerService } from "./overflow-elements/controls-drawer.service";
import { PlayerStatsService } from "./player-stats.service";
import { VideoPlayerService } from "./player.service";

export class PlayerModeService {
  private readonly logger = new Logger(PlayerModeService.name);

  private modeConnection!: ModeService;
  private options!: ConnectionOptions;
  private currentMode: Mode = Mode.LIVE;
  private player: VideoPlayerService;
  private archiveControl!: ArchiveControlService;
  private readonly snapshotManager = new SnapshotService();
  private readonly playerStats!: PlayerStatsService;

  private readonly controlsDrawer!: ControlsOverflowDrawerService;

  constructor(options: ConnectionOptions, player: VideoPlayerService) {
    this.options = { ...options };
    this.player = player;

    this.playerStats = new PlayerStatsService(
      this.player.video,
      this.onUpdateStats.bind(this)
    );

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
            click: () => {},
          },
        },
        [ControlName.SNAPSHOT]: {
          type: "button",
          listeners: {
            click: this.snap.bind(this),
          },
        },
        [ControlName.SPEED]: {
          type: "select",
          listeners: {
            change: (e) => {},
          },
          defaultValue: "1",
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
              label: "1",
              value: "1",
            },
          ],
        },
      }
    );
    this.controlsDrawer.setDisabled({
      [ControlName.SNAPSHOT]: true,
    });

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

  async enable(newMode: Mode) {
    this.logger.log("Включение режима: ", newMode);

    if (this.currentMode === newMode) {
      this.logger.warn("Попытка включить включенный режим плеера", newMode);
    }

    switch (newMode) {
      case Mode.LIVE:
        this.modeConnection = new LiveVideoService(this.options, this.player);
        this.controlsDrawer.setHidden({
          [ControlName.EXPORT]: true,
          [ControlName.NEXT_FRAGMENT]: true,
          [ControlName.PREV_FRAGMENT]: true,
        });

        break;
      case Mode.ARCHIVE:
        this.modeConnection = new ArchiveVideoService(
          this.options,
          this.player,
          (archiveControl) => (this.archiveControl = archiveControl)
        );
        this.controlsDrawer.setHidden({});

        break;
    }

    this.currentMode = newMode;

    this.controlsDrawer.setBinaryButtonsState({
      [ControlName.MODE]: newMode === Mode.LIVE,
      [ControlName.PLAY]: this.player.isPlaying,
      [ControlName.VOLUME]: this.player.isVolumeOn,
    });
    this.controlsDrawer.draw();

    await this.modeConnection.init();
  }

  async reset() {
    await this.modeConnection.reset();
  }

  private switchPlayState() {
    if (!this.player.isPlaying) {
      this.player.play();
    } else {
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
      this.playerStats.stats?.width,
      this.playerStats.stats?.height
    );
  }

  private onUpdateStats(stats: Nullable<VideoStats>) {
    this.controlsDrawer.setDisabled({
      [ControlName.SNAPSHOT]: stats === null,
    });

    this.controlsDrawer.draw();
  }
}
