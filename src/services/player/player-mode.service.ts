import { Mode } from "../../constants/mode";
import { ModeService } from "../../interfaces/mode";
import { ButtonType } from "../../types/button-callback";
import { ConnectionOptions } from "../../types/connection-options";
import { ArchiveControlService } from "../archive-control.service";
import { Logger } from "../logger/logger.service";
import { ArchiveVideoService } from "../mode/archive.service";
import { LiveVideoService } from "../mode/live.service";
import { SnapshotService } from "../snapshot.service";
import { ControlsOverflowDrawerService } from "./overflow-elements/controls-drawer.service";
import { VideoPlayerService } from "./player.service";

export class PlayerModeService {
  private readonly logger = new Logger(PlayerModeService.name);

  private modeConnection!: ModeService;
  private options!: ConnectionOptions;
  private currentMode: Mode = Mode.LIVE;
  private player: VideoPlayerService;
  private archiveControl!: ArchiveControlService;
  private readonly snapshotManager = new SnapshotService();

  private readonly controlsDrawer = new ControlsOverflowDrawerService();

  constructor(options: ConnectionOptions, player: VideoPlayerService) {
    this.options = { ...options };
    this.player = player;

    this.controlsDrawer.setOptions({
      [ButtonType.MODE]: this.switch.bind(this),
      [ButtonType.PLAY]: this.player.play.bind(this.player),
      [ButtonType.STOP]: this.player.stop.bind(this.player),
      [ButtonType.NEXT_FRAGMENT]: this.toNextFragment.bind(this),
      [ButtonType.PREV_FRAGMENT]: this.toPrevFragment.bind(this),
      [ButtonType.EXPORT]: () => {},
      [ButtonType.SNAPSHOT]: this.snap.bind(this),
    });

    this.enable(Mode.ARCHIVE);
  }

  async switch() {
    await this.clear();
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
        this.controlsDrawer.setDisabled({
          [ButtonType.EXPORT]: true,
          [ButtonType.NEXT_FRAGMENT]: true,
          [ButtonType.PREV_FRAGMENT]: true,
        });

        break;
      case Mode.ARCHIVE:
        this.modeConnection = new ArchiveVideoService(
          this.options,
          this.player,
          (archiveControl) => (this.archiveControl = archiveControl)
        );
        this.controlsDrawer.setDisabled({});

        break;
    }

    this.currentMode = newMode;

    this.controlsDrawer.setBinaryButtonsState({
      [ButtonType.MODE]: newMode === Mode.LIVE,
    });
    this.controlsDrawer.draw(this.player.container);
    await this.modeConnection.init();
  }

  async clear() {
    await this.modeConnection.reset();
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
      window.innerWidth,
      window.innerHeight
    );
  }
}
