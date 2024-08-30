import { Logger } from "../logger/logger.service";
import { WebRTCService } from "../webrtc.service";
import { ConnectionOptions } from "../../types/connection-options";
import { ModeService } from "../../interfaces/mode";

export class ArchiveVideoService implements ModeService {
  private logger = new Logger(ArchiveVideoService.name);

  private readonly webRTCClient!: WebRTCService;

  constructor(options: ConnectionOptions) {
    this.webRTCClient = new WebRTCService(options);
  }

  async init(): Promise<void> {
    this.webRTCClient.setupPeerConnection();

    this.webRTCClient.startTURN("archive").catch((turnError: Error) => {
      this.logger.error(
        "Не удается установить соединение через TURN, причина:",
        turnError.message
      );
    });
  }

  async reset(): Promise<void> {
    this.webRTCClient.reset();
  }
}
