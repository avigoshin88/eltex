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
import MetaOverflowDrawerService from "../player/overflow-elements/meta-drawer.service";
import { Mode } from "../../constants/mode";

export class LiveVideoService implements ModeService {
  private logger: Logger;

  private webRTCClient: WebRTCService;
  private datachannelClient: DatachannelClientService;
  private readonly player: VideoPlayerService;

  private metaDrawer: MetaOverflowDrawerService;

  constructor(
    private id: string,
    options: ConnectionOptions,
    player: VideoPlayerService,
    private onConnectionStateChangeCb: () => void
  ) {
    this.logger = new Logger(id, "LiveVideoService");

    this.logger.log("debug", "Инициализация конструктора");

    this.player = player;
    this.metaDrawer = new MetaOverflowDrawerService(
      id,
      this.player.videoContainer
    );
    this.datachannelClient = new DatachannelClientService(id);
    this.webRTCClient = new WebRTCService(
      id,
      Mode.LIVE,
      options,
      this.datachannelClient,
      this.setSource.bind(this),
      onConnectionStateChangeCb
    );
    this.metaDrawer.init();
  }

  async init(metaEnabled: boolean): Promise<void> {
    this.logger.log("debug", "Инициализация live соединения");
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
      "debug",
      "Перезапускаем live соединение с новыми параметрами:",
      JSON.stringify(options)
    );

    const metaDrawer = new MetaOverflowDrawerService(
      this.id,
      this.player.videoContainer
    );
    const datachannelClient = new DatachannelClientService(this.id);
    const webRTCClient = new WebRTCService(
      this.id,
      Mode.LIVE,
      options,
      datachannelClient,
      this.setSource.bind(this),
      this.onConnectionStateChangeCb
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

          this.logger.log(
            "debug",
            "Live соединение с новыми параметрами запущено"
          );
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
    this.logger.log("debug", "Сбрасываем Live соединение");
    this.metaDrawer.destroy();
    this.datachannelClient.close();
    this.webRTCClient.reset();
    this.logger.log("debug", "Live соединение сброшено");
  }

  setSource(stream: MediaStream) {
    this.logger.log(
      "debug",
      "Устанавливаем источник Live соединения в видеоплеер"
    );
    this.player.setSource(stream);
    this.player.play();
  }

  toggleMeta(on: boolean) {
    this.logger.log(
      "debug",
      `Переключаем отображение метаданных в режим ${
        on ? "включено" : "выключено"
      }`
    );
    this.datachannelClient.updateListener(
      DatachannelMessageType.META,
      on ? (this.metaDrawer.draw as DatachannelEventListener) : undefined
    );
  }

  get connectionState() {
    return this.webRTCClient.connectionState;
  }
}
