import { Logger } from "../logger/logger.service";
import { WebRTCService } from "../webrtc.service";
import { ConnectionOptions } from "../../types/connection-options";
import { ModeService } from "../../interfaces/mode";
import { DatachannelClientService } from "../datachannel/data-channel.service";
import {
  DatachannelEventListeners,
  DatachannelMessageType,
  DatachannelNativeEventListeners,
} from "../../types/datachannel-listener";
import { VideoPlayerService } from "../player/player.service";
import { RangeDto } from "../../dto/ranges";
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

export class ArchiveVideoService implements ModeService {
  private logger = new Logger("ArchiveVideoService");

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

  private isLoaded = false;

  private virtualTimeOffset: number = 0;

  private renewStartTime: Nullable<number> = null;
  private renewFragment: Nullable<RangeData> = null;

  private setControl: (control: ArchiveControlService) => void;

  private ranges: RangeDto[] = [];

  constructor(
    options: ConnectionOptions,
    player: VideoPlayerService,
    setControl: (control: ArchiveControlService) => void
  ) {
    this.player = player;

    this.player.video.onloadeddata = this.onLoadedChange.bind(this);
    this.player.video.ontimeupdate = this.onTimeUpdate.bind(this);

    this.datachannelClient = new DatachannelClientService(
      this.clearListeners.bind(this)
    );

    this.webRTCClient = new WebRTCService(
      Mode.ARCHIVE,
      options,
      this.datachannelClient,
      this.setSource.bind(this)
    );

    this.archiveControl = new ArchiveControlService(
      this.emitStartNewFragment.bind(this),
      this.supportConnect.bind(this)
    );

    this.timelineDrawer = new TimelineOverflowDrawer(
      this.player.container,
      this.onChangeCurrentTime.bind(this)
    );
    this.metaDrawer = new MetaOverflowDrawerService(this.player.videoContainer);

    EventBus.on(
      "new-archive-fragment-started",
      this.onNewArchiveFragmentStarted.bind(this)
    );

    this.setControl = setControl;

    this.setControl(this.archiveControl);
  }

  async init(): Promise<void> {
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
        [DatachannelMessageType.META]: this.metaDrawer.draw,
      },
    });

    this.metaDrawer.init();
  }

  public async reinitWithNewOptions(options: ConnectionOptions) {
    this.renewStartTime = this.timelineDrawer.getCurrentTimestamp();
    this.renewFragment = {
      ...this.archiveControl.currentFragment,
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
    const datachannelClient = new DatachannelClientService();
    const webRTCClient = new WebRTCService(
      Mode.ARCHIVE,
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
        [DatachannelMessageType.META]: metaDrawer.draw,
      },
      nativeListeners: {
        open: async () => {
          await this.reset(false);

          this.metaDrawer = metaDrawer;
          this.datachannelClient = datachannelClient;
          this.webRTCClient = webRTCClient;

          const archiveControl = new ArchiveControlService(
            this.emitStartNewFragment.bind(this),
            this.supportConnect.bind(this)
          );
          archiveControl.setRanges(this.ranges);

          archiveControl.setCurrentRange(
            this.renewStartTime!,
            this.renewFragment!,
            false
          );

          this.virtualTimeOffset = this.player.video.currentTime;

          archiveControl.init();

          this.archiveControl.clear();

          this.archiveControl = archiveControl;

          this.setControl(this.archiveControl);

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

    if (fullReset) {
      this.virtualTimeOffset = 0;

      this.archiveControl.clear();
      this.timelineDrawer.disableExportMode();
      this.timelineDrawer.clear();

      this.renewStartTime = null;
      this.renewFragment = null;

      this.ranges = [];
    }
  }

  export(): void {
    this.timelineDrawer.enableExportMode(this.exportFragment.bind(this));
  }

  cancelExport(): void {
    this.timelineDrawer.disableExportMode();
  }

  public getVirtualCurrentTime(currentVideoTime: number): number {
    return currentVideoTime - this.virtualTimeOffset;
  }

  private onNewArchiveFragmentStarted(range: RangeDto) {
    const startTime = range.start_time;

    this.timelineDrawer.setCustomTrackTimestamp(startTime);
    this.timelineDrawer.draw(startTime);
  }

  private async onOpenDatachannel() {
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
    EventBus.emit("cancel-export");
  }

  private onExportFragment(data: ExportURLDto) {
    this.fileDownloader.download(data.url);
  }

  private onRanges(data: unknown) {
    const { ranges: unsortedRanges } = data as { ranges: RangeDto[] };

    const ranges = unsortedRanges.sort((a, b) => a.start_time - b.start_time);

    this.ranges = ranges;

    this.archiveControl.setRanges(ranges);
    this.archiveControl.init();
    this.archiveControl.preloadRangeFragment();

    this.timelineDrawer.setOptions(this.rangeMapper.calc(ranges));
    this.timelineDrawer.draw(
      this.getVirtualCurrentTime(this.player.video.currentTime)
    );
  }

  private onLoadedChange() {
    this.isLoaded = true;
  }

  setSpeed(speed: number) {
    this.datachannelClient.send(DatachannelMessageType.SET_SPEED, { speed });
  }

  private onTimeUpdate = (event: Event) => {
    if (!this.isLoaded) {
      return;
    }

    const currentTime = (event.target as HTMLVideoElement).currentTime;

    this.timelineDrawer.draw(this.getVirtualCurrentTime(currentTime));
  };

  private supportConnect() {
    this.datachannelClient.send(DatachannelMessageType.ARCHIVE_CONNECT_SUPPORT);
  }

  private emitStartNewFragment(fragment: RangeDto, isPreRequestRange = false) {
    this.isPreRequestRange = isPreRequestRange;

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

      return;
    }

    this.nextProcessedRange = fragment;

    this.datachannelClient.send(DatachannelMessageType.DROP_BUFFER);

    this.logger.log(
      "info",
      "============== Начался новый фрагмент =============="
    );
    this.logger.log("info", DatachannelMessageType.DROP_BUFFER, fragment);
  }

  private onChangeCurrentTime(
    ...[timestamp, range]: Parameters<TimelineClickCallback>
  ) {
    this.logger.log("info", "Изменение текущего времени", timestamp, range);

    this.player.pause();
    this.archiveControl.setCurrentRange(timestamp, range);

    this.virtualTimeOffset = this.player.video.currentTime;

    EventBus.emit("play-enabled");

    this.timelineDrawer.draw(
      this.getVirtualCurrentTime(this.player.video.currentTime)
    );
  }

  private onDropComplete() {
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

  private onKeyFragmentUpload() {
    if (!this.nextProcessedRange) {
      this.logger.warn(
        "info",
        "Нечего загружать в буфер: следующий диапазон пустой"
      );
      return;
    }

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

  private onSaveArchiveFragment() {
    if (this.isPreRequestRange) {
      this.isPreRequestRange = false;

      if (this.nextProcessedRange) {
        this.logger.log(
          "info",
          "Фрагмент стрима начался: ",
          this.nextProcessedRange
        );

        this.nextProcessedRange = null;
      }
    } else {
      this.play();
    }
  }

  private onStreamPlay() {
    if (this.nextProcessedRange) {
      this.logger.log(
        "info",
        "Фрагмент стрима начался: ",
        this.nextProcessedRange
      );
    }

    this.archiveControl.scheduleNextPreload();

    this.player.play();
    this.nextProcessedRange = null;
  }

  private clearListeners() {
    this.archiveControl.clearIntervals();
  }

  play(isContinue = false) {
    this.logger.log("info", "Воспроизведение стрима");

    if (!isContinue) {
      this.datachannelClient.send(DatachannelMessageType.PLAY_STREAM);
    } else {
      this.archiveControl.resume();
    }
  }

  pause() {
    this.logger.log("info", "Пауза стрима");
    this.datachannelClient.send(DatachannelMessageType.STOP_STREAM);

    this.archiveControl.pause(this.timelineDrawer.getCurrentTimestamp());
  }

  stop() {
    this.logger.log("info", "Остановка стрима");
    this.datachannelClient.send(DatachannelMessageType.STOP_STREAM);

    const startTime = this.ranges[0].start_time;

    this.archiveControl.pause(startTime);

    const currentTime = this.player.video.currentTime;

    this.timelineDrawer.setCustomTrackTimestamp(startTime);

    this.virtualTimeOffset = currentTime;
    this.timelineDrawer.draw(this.getVirtualCurrentTime(currentTime));
  }

  setSource(stream: MediaStream) {
    this.player.setSource(stream);
    this.player.play();
  }
}
