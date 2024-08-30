import { Logger } from "../logger/logger.service";
import { WebRTCService } from "../webrtc.service";
import { ConnectionOptions } from "../../types/connection-options";
import { ModeService } from "../../interfaces/mode";

export class LiveVideoService implements ModeService {
  private logger = new Logger(LiveVideoService.name);

  private readonly webRTCClient!: WebRTCService;

  constructor(options: ConnectionOptions) {
    this.webRTCClient = new WebRTCService(options);
  }

  async init(): Promise<void> {
    this.webRTCClient.setupPeerConnection();

    this.webRTCClient.startP2P().catch((p2pError: Error) => {
      this.logger.error(
        "Не удается установить соединение через P2P, причина:",
        p2pError.message
      );

      this.logger.log("Пробуем соединиться через TURN");
      this.webRTCClient.reset();
      this.webRTCClient.setupPeerConnection();

      this.webRTCClient.startTURN("play").catch((turnError: Error) => {
        this.logger.error(
          "Не удается установить соединение через TURN, причина:",
          turnError.message
        );
      });
    });
  }

  async reset(): Promise<void> {
    this.webRTCClient.reset();
  }
}
