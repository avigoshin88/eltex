import { Logger } from "../logger/logger.service";
import { WebRTCService } from "../webrtc.service";
import { ConnectionOptions } from "../../types/connection-options";
import { ModeService } from "../../interfaces/mode";
import { DatachannelClientService } from "../datachannel/data-channel.service";
import {
  DatachannelEventListener,
  DatachannelEventListeners,
  DatachannelMessageType,
  DatachannelNativeEventListeners,
} from "../../types/datachannel-listener";
import { VideoPlayerService } from "../player/player.service";
import { RangeDto, RangeFragment } from "../../dto/ranges";
import { TimelineOverflowDrawer } from "../player/overflow-elements/timeline-drawer.service";
import { RangeMapperService } from "../range-mapper.service";
import { ArchiveControlService } from "../archive-control.service";
import { MetaOverflowDrawerService } from "../player/overflow-elements/meta-drawer.service";
import { TimelineClickCallback } from "../../types/timeline";
import { Nullable } from "../../types/global";
import { ExportURLDto } from "../../dto/export";
import { FileDownloader } from "../file-downloader.service";
import { EventBus } from "../event-bus.service";
import { RangeData } from "../../types/range";
import { Mode } from "../../constants/mode";
import { EnvService } from "../env.service";
import { ArchiveError } from "../../types/archive";
import { ArchiveTimeControlService } from "./archive/archive-time-control.service";

const preloadAfterErrorFrameTimeout = EnvService.getENVAsNumber(
  "VITE_PRELOAD_AFTER_ERROR_FRAME_TIMEOUT"
);

// const fetchRangesInterval = EnvService.getENVAsNumber(
//   "VITE_FETCH_RANGES_INTERVAL"
// );

function isFragmentLoadError(error?: Nullable<string>) {
  return error?.toUpperCase() === ArchiveError.NOT_FOUND;
}

export class ArchiveVideoService implements ModeService {
  private logger = new Logger("ArchiveVideoService");
  private eventBus: EventBus;

  private webRTCClient!: WebRTCService;
  private datachannelClient: DatachannelClientService;
  private readonly player: VideoPlayerService;

  private readonly timelineDrawer!: TimelineOverflowDrawer;
  private metaDrawer!: MetaOverflowDrawerService;

  private readonly rangeMapper = new RangeMapperService();
  private archiveControl: ArchiveControlService;

  private readonly fileDownloader = new FileDownloader();

  private nextProcessedRange: Nullable<RangeDto> = null;
  private isPreRequestRange = false;

  private isFirstRangesFetch = true;

  private renewStartTime: Nullable<number> = null;
  private renewFragment: Nullable<RangeData> = null;

  private setControl: (control: ArchiveControlService) => void;

  private fetchRangesIntervalId: Nullable<number> = null;

  private ranges: RangeDto[] = [];

  private archiveTimeControl!: ArchiveTimeControlService;

  private isStopUpdateTrackPosition = false;

  private currentPlayedSubFragment: Nullable<RangeDto> = null;

  private isNeedSetFragmentStartTimeAfterPreload = false;

  constructor(
    private id: string,
    options: ConnectionOptions,
    player: VideoPlayerService,
    setControl: (control: ArchiveControlService) => void,
    private onConnectionStateChangeCb: () => void
  ) {
    this.player = player;
    this.eventBus = EventBus.getInstance(this.id);

    this.datachannelClient = new DatachannelClientService(
      this.id,
      this.clearListeners.bind(this),
      this.onError.bind(this)
    );

    this.webRTCClient = new WebRTCService(
      this.id,
      Mode.ARCHIVE,
      options,
      this.datachannelClient,
      this.setSource.bind(this),
      onConnectionStateChangeCb
    );

    this.archiveControl = new ArchiveControlService(
      this.id,
      this.emitStartNewFragment.bind(this),
      this.supportConnect.bind(this)
    );

    this.timelineDrawer = new TimelineOverflowDrawer(
      this.id,
      this.player.container,
      this.onChangeCurrentTime.bind(this)
    );
    this.metaDrawer = new MetaOverflowDrawerService(this.player.videoContainer);

    this.setControl = setControl;

    this.setControl(this.archiveControl);
  }

  async init(metaEnabled: boolean): Promise<void> {
    await this.webRTCClient.setupPeerConnection({
      nativeListeners: {
        open: this.onOpenDatachannel.bind(this),
      },
      listeners: {
        [DatachannelMessageType.RANGES]: this.onRanges.bind(this),
        [DatachannelMessageType.DROP]: this.onDropComplete.bind(this),
        [DatachannelMessageType.KEY_FRAGMENT]:
          this.onKeyFragmentUpload.bind(this),
        [DatachannelMessageType.ARCHIVE_FRAGMENT]:
          this.onSaveArchiveFragment.bind(this),
        [DatachannelMessageType.PLAY]: this.onStreamPlay.bind(this),
        // ругается на unknown
        // @ts-ignore
        [DatachannelMessageType.URL]: this.onExportFragment.bind(this),
        // ругается на unknown
        // @ts-ignore
        [DatachannelMessageType.META]: metaEnabled
          ? this.metaDrawer.draw
          : undefined,
      },
    });

    this.archiveTimeControl = new ArchiveTimeControlService(
      this.id,
      this.webRTCClient
    );

    this.metaDrawer.init();
  }

  public async reinitWithNewOptions(
    options: ConnectionOptions,
    metaEnabled: boolean
  ) {
    this.renewStartTime = this.archiveTimeControl.getCurrentTimestamp();
    this.renewFragment = {
      ...this.archiveControl.getCurrentFragment(),
      type: "data",
    };

    this.logger.log(
      "info",
      "Перезапускаем live соединение с новыми параметрами:",
      JSON.stringify(options)
    );

    const metaDrawer = new MetaOverflowDrawerService(
      this.player.videoContainer
    );
    const datachannelClient = new DatachannelClientService(
      this.id,
      this.clearListeners.bind(this),
      this.onError.bind(this)
    );
    const webRTCClient = new WebRTCService(
      this.id,
      Mode.ARCHIVE,
      options,
      datachannelClient,
      this.setSource.bind(this),
      this.onConnectionStateChangeCb
    );
    const archiveTimeControl = new ArchiveTimeControlService(
      this.id,
      webRTCClient
    );

    metaDrawer.init();

    const datachannelListeners: {
      nativeListeners: DatachannelNativeEventListeners;
      listeners: DatachannelEventListeners;
    } = {
      listeners: {
        [DatachannelMessageType.DROP]: this.onDropComplete.bind(this),
        [DatachannelMessageType.KEY_FRAGMENT]:
          this.onKeyFragmentUpload.bind(this),
        [DatachannelMessageType.ARCHIVE_FRAGMENT]:
          this.onSaveArchiveFragment.bind(this),
        [DatachannelMessageType.PLAY]: this.onStreamPlay.bind(this),
        // ругается на unknown
        // @ts-ignore
        [DatachannelMessageType.URL]: this.onExportFragment.bind(this),
        // ругается на unknown
        // @ts-ignore
        [DatachannelMessageType.META]: metaEnabled
          ? metaDrawer.draw
          : undefined,
      },
      nativeListeners: {
        open: async () => {
          await this.reset(false);

          this.metaDrawer = metaDrawer;
          this.datachannelClient = datachannelClient;
          this.webRTCClient = webRTCClient;

          const archiveControl = new ArchiveControlService(
            this.id,
            this.emitStartNewFragment.bind(this),
            this.supportConnect.bind(this)
          );
          archiveControl.setRanges(this.ranges);

          archiveControl.setCurrentRange(
            this.renewStartTime!,
            this.renewFragment!,
            false
          );

          archiveControl.init();
          archiveControl.initSupportConnectInterval();

          this.archiveControl.clear();

          this.archiveControl = archiveControl;

          this.setControl(this.archiveControl);

          this.archiveTimeControl = archiveTimeControl;

          this.archiveControl.preloadRangeFragment();

          this.onOpenDatachannel();
        },
      },
    };

    this.webRTCClient.resetListeners();
    await webRTCClient.setupPeerConnection(datachannelListeners);
  }

  async reset(fullReset = true): Promise<void> {
    await this.webRTCClient.reset();
    this.datachannelClient.close();
    this.metaDrawer.destroy();
    this.clearFetchRangeInterval();
    this.archiveTimeControl.reset();

    if (fullReset) {
      this.archiveControl.clear();
      this.timelineDrawer.disableExportMode();
      this.timelineDrawer.clear();

      this.renewStartTime = null;
      this.renewFragment = null;
      this.isFirstRangesFetch = true;

      this.ranges = [];
    }
  }

  rerenderTrack = () => {
    if (this.isStopUpdateTrackPosition) {
      this.player.video.requestVideoFrameCallback(this.rerenderTrack);
      return;
    }

    if (!this.currentPlayedSubFragment) {
      this.player.video.requestVideoFrameCallback(this.rerenderTrack);
      return;
    }

    this.archiveTimeControl.calculate();
    this.timelineDrawer.draw(this.archiveTimeControl.getCurrentTimestamp());

    this.player.video.requestVideoFrameCallback(this.rerenderTrack);
  };

  export(): void {
    this.timelineDrawer.enableExportMode(this.exportFragment.bind(this));
  }

  cancelExport(): void {
    this.timelineDrawer.disableExportMode();
  }

  private async onOpenDatachannel() {
    this.setFetchRangesInterval();

    this.player.video.requestVideoFrameCallback(this.rerenderTrack);

    if (this.renewStartTime !== null && this.renewFragment !== null) {
      return;
    }

    this.datachannelClient.send(DatachannelMessageType.GET_RANGES);
  }

  private exportFragment(range: RangeDto) {
    this.datachannelClient.send(
      DatachannelMessageType.GET_EXPORT_FRAGMENT_URL,
      {
        start_time: range.start_time,
        duration: range.duration,
      }
    );
    this.timelineDrawer.disableExportMode();
    this.eventBus.emit("cancel-export");
  }

  private onExportFragment(data: ExportURLDto) {
    this.fileDownloader.download(data.url);
  }

  private onError(error: string) {
    this.logger.error("info", "Ошибка в запросе видео:", error);
  }

  private onRanges(data: unknown) {
    const { ranges: unsortedRanges } = data as { ranges: RangeDto[] };
    const ranges = unsortedRanges.sort((a, b) => a.start_time - b.start_time);

    this.ranges = ranges;

    this.timelineDrawer.setOptions(
      this.rangeMapper.calc(ranges),
      this.isFirstRangesFetch
    );

    if (this.isFirstRangesFetch) {
      this.archiveControl.setRanges(ranges);

      this.archiveControl.init();
      this.archiveControl.preloadRangeFragment();
      this.archiveControl.initSupportConnectInterval();

      this.isFirstRangesFetch = false;
    } else {
      this.archiveControl.updateRanges(
        ranges,
        this.archiveTimeControl.getCurrentTimestamp()
      );
    }
  }

  setSpeed(speed: number) {
    this.datachannelClient.send(DatachannelMessageType.SET_SPEED, { speed });

    this.player.pause();

    this.archiveControl.setSpeed(speed);
    this.archiveControl.setCurrentTime(
      this.archiveTimeControl.getCurrentTimestamp()
    );
    this.archiveTimeControl.setSpeed(speed);

    this.eventBus.emit("play-enabled");
  }

  private supportConnect() {
    this.datachannelClient.send(DatachannelMessageType.ARCHIVE_CONNECT_SUPPORT);
  }

  private emitStartNewFragment(
    fragment: RangeFragment,
    isPreRequestRange = false
  ) {
    this.isPreRequestRange = isPreRequestRange;
    this.nextProcessedRange = fragment;

    this.logger.log(
      "info",
      "Новый фрагмент",
      fragment,
      "isPreRequestRange",
      isPreRequestRange
    );

    if (this.isPreRequestRange) {
      this.logger.log(
        "info",
        DatachannelMessageType.GET_ARCHIVE_FRAGMENT,
        fragment
      );

      this.datachannelClient.send(DatachannelMessageType.GET_ARCHIVE_FRAGMENT, {
        start_time: fragment.start_time,
        duration: fragment.duration,
      });

      if (fragment.isLastFragment) {
        this.isNeedSetFragmentStartTimeAfterPreload = true;
        this.archiveControl.isNewRange = true;
      }

      return;
    }

    this.archiveControl.setFragmentIndex(fragment.fragmentIndex);

    this.archiveControl.isNewRange = true;
    this.currentPlayedSubFragment = fragment;
    this.archiveTimeControl.ignorePackets();

    this.datachannelClient.send(DatachannelMessageType.DROP_BUFFER);

    this.logger.log("info", "Начался новый фрагмент");
    this.logger.log("info", DatachannelMessageType.DROP_BUFFER, fragment);
  }

  private onChangeCurrentTime(
    ...[timestamp, range]: Parameters<TimelineClickCallback>
  ) {
    this.logger.log("info", "Изменение текущего времени", timestamp, range);

    this.pause();
    this.player.pause();

    this.archiveControl.setCurrentRange(timestamp, range);

    this.eventBus.emit("play-enabled");
  }

  private onDropComplete() {
    this.logger.log("info", "Очистка буфера завершена");

    if (!this.nextProcessedRange) {
      this.logger.warn("info", "Следующий диапазон пустой: нечего очищать");
      return;
    }

    this.logger.log("info", DatachannelMessageType.GET_KEY, {
      start_time: this.nextProcessedRange.start_time,
    });

    this.datachannelClient.send(DatachannelMessageType.GET_KEY, {
      start_time: this.nextProcessedRange.start_time,
    });
  }

  private onKeyFragmentUpload(
    _: Nullable<undefined>,
    error?: Nullable<string>
  ) {
    if (isFragmentLoadError(error)) {
      this.logger.error("info", "Ошибка загрузки ключевого фрагмента");

      this.archiveControl.setCurrentTime(
        this.archiveTimeControl.getCurrentTimestamp() +
          preloadAfterErrorFrameTimeout,
        false
      );
      return;
    }

    if (!this.nextProcessedRange) {
      this.logger.warn(
        "info",
        "Нечего загружать в буфер: следующий диапазон пустой"
      );
      return;
    }

    this.logger.log("info", "Загрузка ключевого фрагмента завершена");

    this.logger.log(
      "info",
      DatachannelMessageType.GET_ARCHIVE_FRAGMENT,
      this.nextProcessedRange
    );

    this.datachannelClient.send(DatachannelMessageType.GET_ARCHIVE_FRAGMENT, {
      start_time: this.nextProcessedRange.start_time,
      duration: this.nextProcessedRange.duration,
    });
  }

  private onSaveArchiveFragment(
    _: Nullable<undefined>,
    error?: Nullable<string>
  ) {
    if (isFragmentLoadError(error)) {
      this.logger.error("info", "Ошибка загрузки ключевого фрагмента");

      this.archiveControl.setCurrentTime(
        this.archiveTimeControl.getCurrentTimestamp() +
          preloadAfterErrorFrameTimeout,
        true
      );
      return;
    }

    if (this.isPreRequestRange) {
      this.isPreRequestRange = false;

      if (this.nextProcessedRange) {
        this.logger.log(
          "info",
          "Фрагмент стрима начался: ",
          this.nextProcessedRange
        );

        if (this.isNeedSetFragmentStartTimeAfterPreload) {
          this.isNeedSetFragmentStartTimeAfterPreload = false;
        }

        this.nextProcessedRange = null;
      }
    } else {
      this.play();
    }
  }

  private onStreamPlay() {
    this.logger.log("info", "Стрим начал воспроизведение");

    if (this.nextProcessedRange) {
      this.logger.log(
        "info",
        "Фрагмент стрима начался: ",
        this.nextProcessedRange
      );

      this.archiveTimeControl.setFragmentStartTimestamp(
        this.nextProcessedRange.start_time
      );
    }

    this.isStopUpdateTrackPosition = false;

    this.archiveControl.clearPreloadTimeout();
    this.archiveControl.scheduleNextPreload();

    this.player.play();
    this.nextProcessedRange = null;
  }

  private clearListeners() {
    this.archiveControl.clearIntervals();
  }

  play(isContinue = false) {
    this.logger.log("info", "Воспроизведение стрима", { isContinue });

    if (!isContinue) {
      this.logger.log("info", "Запуск стрима");

      this.datachannelClient.send(DatachannelMessageType.PLAY_STREAM);
    } else {
      this.archiveControl.resume();
    }
  }

  pause(rerender = true) {
    this.logger.log(
      "info",
      "Пауза стрима: ",
      this.archiveTimeControl.getCurrentTimestamp()
    );
    this.datachannelClient.send(DatachannelMessageType.STOP_STREAM);

    if (rerender) {
      this.logger.log("info", "Перерисовка трека");

      this.archiveControl.pause(this.archiveTimeControl.getCurrentTimestamp());
    }
  }

  stop() {
    this.logger.log("info", "Остановка стрима");
    this.datachannelClient.send(DatachannelMessageType.STOP_STREAM);

    const startTime = this.ranges[0].start_time;

    this.archiveTimeControl.ignorePackets();
    this.archiveControl.pause(startTime);

    this.timelineDrawer.draw(startTime);
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

  private setFetchRangesInterval() {
    // this.fetchRangesIntervalId = setInterval(() => {
    //   this.datachannelClient.send(DatachannelMessageType.GET_RANGES);
    // }, fetchRangesInterval);
  }

  private clearFetchRangeInterval() {
    if (this.fetchRangesIntervalId !== null) {
      clearInterval(this.fetchRangesIntervalId);

      this.fetchRangesIntervalId = null;
    }
  }

  get connectionState() {
    return this.webRTCClient.connectionState;
  }
}
