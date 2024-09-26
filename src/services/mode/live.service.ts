import { DatachannelMessageType } from "./../../types/datachannel-listener";
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
import { MetaOverflowDrawerService } from "../player/overflow-elements/meta-drawer.service";

export class LiveVideoService implements ModeService {
  private logger = new Logger(LiveVideoService.name);

  private readonly webRTCClient!: WebRTCService;
  private readonly datachannelClient: DatachannelClientService;
  private readonly player: VideoPlayerService;

  private readonly metaDrawer: MetaOverflowDrawerService;

  constructor(options: ConnectionOptions, player: VideoPlayerService) {
    this.player = player;
    this.metaDrawer = new MetaOverflowDrawerService(this.player.videoContainer);
    this.datachannelClient = new DatachannelClientService();
    this.webRTCClient = new WebRTCService(
      options,
      this.datachannelClient,
      this.setSource.bind(this)
    );
    this.metaDrawer.init();
  }

  async init(): Promise<void> {
    const datachannelListeners: {
      nativeListeners: DatachannelNativeEventListeners;
      listeners: DatachannelEventListeners;
    } = {
      listeners: {
        // ругается на unknown
        // @ts-ignore
        [DatachannelMessageType.META]: this.metaDrawer.draw,
      },
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
        this.webRTCClient.reset();
        this.logger.error(
          "Не удается установить соединение через TURN, причина:",
          turnError.message
        );
      });
    });
  }

  public get mic() {
    const { hasAccessToMicrophone, isMicEnabled, micCallbacks } =
      this.webRTCClient;
    return { hasAccessToMicrophone, isMicEnabled, micCallbacks };
  }

  async reset(): Promise<void> {
    this.webRTCClient.reset();
    this.metaDrawer.destroy();
  }

  setSource(stream: MediaStream) {
    this.player.setSource(stream);
    this.player.play();
  }
}
