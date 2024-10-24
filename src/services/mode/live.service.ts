import {
  DatachannelEventListener,
  DatachannelMessageType,
} from "./../../types/datachannel-listener";
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
import { Mode } from "../../constants/mode";

export class LiveVideoService implements ModeService {
  private logger = new Logger(LiveVideoService.name);

  private webRTCClient: WebRTCService;
  private datachannelClient: DatachannelClientService;
  private readonly player: VideoPlayerService;

  private metaDrawer: MetaOverflowDrawerService;

  constructor(options: ConnectionOptions, player: VideoPlayerService) {
    this.player = player;
    this.metaDrawer = new MetaOverflowDrawerService(this.player.videoContainer);
    this.datachannelClient = new DatachannelClientService();
    this.webRTCClient = new WebRTCService(
      Mode.LIVE,
      options,
      this.datachannelClient,
      this.setSource.bind(this)
    );
    this.metaDrawer.init();
  }

  async init(metaEnabled: boolean): Promise<void> {
    const datachannelListeners: {
      nativeListeners: DatachannelNativeEventListeners;
      listeners: DatachannelEventListeners;
    } = {
      listeners: {
        // ругается на unknown
        // @ts-ignore
        [DatachannelMessageType.META]: metaEnabled
          ? this.metaDrawer.draw
          : undefined,
      },
      nativeListeners: {},
    };

    await this.webRTCClient.setupPeerConnection(datachannelListeners);
  }

  public async reinitWithNewOptions(
    options: ConnectionOptions,
    metaEnabled: boolean
  ) {
    this.logger.log(
      "info",
      "Перезапускаем live соединение с новыми параметрами:",
      JSON.stringify(options)
    );

    const metaDrawer = new MetaOverflowDrawerService(
      this.player.videoContainer
    );
    const datachannelClient = new DatachannelClientService();
    const webRTCClient = new WebRTCService(
      Mode.LIVE,
      options,
      datachannelClient,
      this.setSource.bind(this)
    );

    metaDrawer.init();

    const datachannelListeners: {
      nativeListeners: DatachannelNativeEventListeners;
      listeners: DatachannelEventListeners;
    } = {
      listeners: {
        // ругается на unknown
        // @ts-ignore
        [DatachannelMessageType.META]: metaEnabled
          ? metaDrawer.draw
          : undefined,
      },
      nativeListeners: {
        open: async () => {
          await this.reset();

          this.metaDrawer = metaDrawer;
          this.datachannelClient = datachannelClient;
          this.webRTCClient = webRTCClient;
        },
      },
    };

    this.webRTCClient.resetListeners();
    await webRTCClient.setupPeerConnection(datachannelListeners);
  }

  public get mic() {
    const { hasAccessToMicrophone, isMicEnabled, micCallbacks } =
      this.webRTCClient;
    return { hasAccessToMicrophone, isMicEnabled, micCallbacks };
  }

  async reset() {
    this.metaDrawer.destroy();
    this.datachannelClient.close();
    this.webRTCClient.reset();
  }

  setSource(stream: MediaStream) {
    this.player.setSource(stream);
    this.player.play();
  }

  toggleMeta(on: boolean) {
    this.datachannelClient.updateListener(
      DatachannelMessageType.META,
      on ? (this.metaDrawer.draw as DatachannelEventListener) : undefined
    );
  }
}
