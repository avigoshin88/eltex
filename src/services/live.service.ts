import { Logger } from "./logger/logger.service";
import { WebRTCService } from "./webrtc.service";
import { ConnectionOptions } from "../types/connection-options";

export class LiveVideoService {
  private logger = new Logger(LiveVideoService.name);

  private readonly webRTCClient!: WebRTCService;

  constructor(options: ConnectionOptions) {
    this.webRTCClient = new WebRTCService(options);
  }

  init() {
    this.webRTCClient.setupPeerConnection();

    this.webRTCClient.startP2P().catch((p2pError: Error) => {
      this.logger.error(
        "Не удается установить соединение через P2P, причина:",
        p2pError.message
      );

      this.logger.log("Пробуем соединиться через TURN");
      this.webRTCClient.reset();
      this.webRTCClient.setupPeerConnection();

      this.webRTCClient.startTURN().catch((turnError: Error) => {
        this.logger.error(
          "Не удается установить соединение через TURN, причина:",
          turnError.message
        );
      });
    });
  }
}
