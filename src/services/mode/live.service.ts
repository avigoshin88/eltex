import { Logger } from "../logger/logger.service";
import { WebRTCService } from "../webrtc.service";
import { ConnectionOptions } from "../../types/connection-options";
import { ModeService } from "../../interfaces/mode";
import {
  DatachannelNativeEventListeners,
  DatachannelEventListeners,
} from "../../types/datachannel-listener";
import { DatachannelClientService } from "../datachannel/data-channel.service";
import { VideoPlayerService } from "../player/player.service";

export class LiveVideoService implements ModeService {
  private logger = new Logger(LiveVideoService.name);

  private readonly webRTCClient!: WebRTCService;
  private readonly datachannelClient: DatachannelClientService;
  private readonly player: VideoPlayerService;

  constructor(options: ConnectionOptions, player: VideoPlayerService) {
    this.player = player;
    this.datachannelClient = new DatachannelClientService();
    this.webRTCClient = new WebRTCService(
      { ...options, videoElement: this.player.video },
      this.datachannelClient
    );
  }

  async init(): Promise<void> {
    const datachannelListeners: {
      nativeListeners: DatachannelNativeEventListeners;
      listeners: DatachannelEventListeners;
    } = {
      listeners: {},
      nativeListeners: {},
    };

    this.webRTCClient.setupPeerConnection(datachannelListeners);

    this.webRTCClient.startP2P().catch((p2pError: Error) => {
      this.logger.error(
        "Не удается установить соединение через P2P, причина:",
        p2pError.message
      );

      this.logger.log("Пробуем соединиться через TURN");
      this.webRTCClient.reset();
      this.webRTCClient.setupPeerConnection(datachannelListeners);

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
