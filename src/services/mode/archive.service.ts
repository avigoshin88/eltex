import { Logger } from "../logger/logger.service";
import { WebRTCService } from "../webrtc.service";
import { ConnectionOptions } from "../../types/connection-options";
import { ModeService } from "../../interfaces/mode";
import { DatachannelClientService } from "../datachannel/data-channel.service";
import { DatachannelMessageType } from "../../types/datachannel-listener";
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

export class ArchiveVideoService implements ModeService {
  private logger = new Logger("ArchiveVideoService");

  private readonly webRTCClient!: WebRTCService;
  private readonly datachannelClient: DatachannelClientService;
  private readonly player: VideoPlayerService;

  private readonly timelineDrawer!: TimelineOverflowDrawer;
  private readonly metaDrawer!: MetaOverflowDrawerService;

  private readonly rangeMapper = new RangeMapperService();
  private readonly archiveControl!: ArchiveControlService;

  private readonly fileDownloader = new FileDownloader();

  private nextProcessedRange: Nullable<RangeDto> = null;
  private isPreRequestRange = false;

  private isLoaded = false;

  private virtualTimeOffset: number = 0;

  constructor(
    options: ConnectionOptions,
    player: VideoPlayerService,
    setControl: (control: ArchiveControlService) => void
  ) {
    this.player = player;

    this.player.video.onloadeddata = this.onLoadedChange.bind(this);
    this.player.video.ontimeupdate = this.onTimeUpdate.bind(this);

    this.datachannelClient = new DatachannelClientService();

    this.webRTCClient = new WebRTCService(
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

    setControl(this.archiveControl);
  }

  async init(): Promise<void> {
    this.webRTCClient.setupPeerConnection({
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

    this.webRTCClient.startTURN("archive").catch((turnError: Error) => {
      this.logger.error(
        "Не удается установить соединение через TURN, причина:",
        turnError.message
      );
    });

    this.metaDrawer.init();
  }

  async reset(): Promise<void> {
    this.virtualTimeOffset = 0;

    this.archiveControl.clear();
    this.webRTCClient.reset();
    this.timelineDrawer.disableExportMode();
    this.timelineDrawer.clear();

    this.metaDrawer.destroy();
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
  }

  private onExportFragment(data: ExportURLDto) {
    this.fileDownloader.download(data.url);
  }

  private onRanges(data: unknown) {
    const { ranges: unsortedRanges } = data as { ranges: RangeDto[] };

    const ranges = unsortedRanges.sort((a, b) => a.start_time - b.start_time);

    this.archiveControl.setRanges(ranges);
    this.archiveControl.init();

    this.timelineDrawer.setOptions(this.rangeMapper.calc(ranges));
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
      this.logger.log(DatachannelMessageType.GET_ARCHIVE_FRAGMENT, fragment);

      this.datachannelClient.send(DatachannelMessageType.GET_ARCHIVE_FRAGMENT, {
        start_time: fragment.start_time,
        duration: fragment.duration,
      });

      return;
    }

    this.nextProcessedRange = fragment;

    this.datachannelClient.send(DatachannelMessageType.DROP_BUFFER);

    this.logger.log("============== Начался новый фрагмент ==============");
    this.logger.log(DatachannelMessageType.DROP_BUFFER, fragment);
  }

  private onChangeCurrentTime(
    ...[timestamp, range]: Parameters<TimelineClickCallback>
  ) {
    this.logger.log("Изменение текущего времени", timestamp, range);

    this.player.pause();
    this.archiveControl.setCurrentRange(timestamp, range);

    this.virtualTimeOffset = this.player.video.currentTime;
  }

  private onDropComplete() {
    if (!this.nextProcessedRange) {
      this.logger.warn("onDropComplete: nextProcessedRange is empty");
      return;
    }

    this.logger.log(DatachannelMessageType.GET_KEY, {
      start_time: this.nextProcessedRange.start_time,
    });

    this.datachannelClient.send(DatachannelMessageType.GET_KEY, {
      start_time: this.nextProcessedRange.start_time,
    });
  }

  private onKeyFragmentUpload() {
    if (!this.nextProcessedRange) {
      this.logger.warn("onKeyFragmentUpload: nextProcessedRange is empty");
      return;
    }

    this.logger.log(
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
        this.logger.log("Фрагмент стрима начался: ", this.nextProcessedRange);

        this.nextProcessedRange = null;
      }
    } else {
      this.play();
    }
  }

  private onStreamPlay() {
    if (this.nextProcessedRange) {
      this.logger.log("Фрагмент стрима начался: ", this.nextProcessedRange);
    }

    this.player.play();
    this.nextProcessedRange = null;
  }

  play() {
    this.logger.log("==========", DatachannelMessageType.PLAY, "==========");
    this.datachannelClient.send(DatachannelMessageType.PLAY_STREAM);
  }

  stop() {
    this.logger.log(DatachannelMessageType.STOP_STREAM);
    this.datachannelClient.send(DatachannelMessageType.STOP_STREAM);
  }

  setSource(stream: MediaStream) {
    this.player.setSource(stream);
    this.player.play();
  }
}
