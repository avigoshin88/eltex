import { Mode } from "../../constants/mode";
import { ModeService } from "../../interfaces/mode";
import { ConnectionOptions } from "../../types/connection-options";
import { Logger } from "../logger/logger.service";
import { ArchiveVideoService } from "../mode/archive.service";
import { LiveVideoService } from "../mode/live.service";
import { VideoPlayerService } from "./player.service";

export class PlayerModeService {
  private readonly logger = new Logger(PlayerModeService.name);

  private modeConnection!: ModeService;
  private options!: ConnectionOptions;
  private currentMode: Mode = Mode.LIVE;
  private player: VideoPlayerService;

  constructor(options: ConnectionOptions, player: VideoPlayerService) {
    this.options = { ...options };
    this.player = player;

    this.enable(Mode.ARCHIVE);
  }

  async switch() {
    await this.clearCurrent();
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
        break;
      case Mode.ARCHIVE:
        this.modeConnection = new ArchiveVideoService(
          this.options,
          this.player
        );
        break;
    }

    this.currentMode = newMode;

    await this.modeConnection.init();
  }

  private async clearCurrent() {
    await this.modeConnection.reset();
  }
}
