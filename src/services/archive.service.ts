import { Logger } from "./logger/logger.service";
import { WebRTCService } from "./webrtc.service";
import { ConnectionOptions } from "../types/connection-options";

export class ArchiveVideoService {
  private logger = new Logger(ArchiveVideoService.name);

  private readonly webRTCClient!: WebRTCService;

  constructor(options: ConnectionOptions) {
    this.webRTCClient = new WebRTCService(options);
  }

  init() {
    this.webRTCClient.setupPeerConnection();

    this.webRTCClient.startTURN().catch((turnError: Error) => {
      this.logger.error(
        "Не удается установить соединение через TURN, причина:",
        turnError.message
      );
    });
  }
}
