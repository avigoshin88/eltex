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

export class ArchiveVideoService implements ModeService {
  private logger = new Logger(ArchiveVideoService.name);

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
        "info",
        "Не удается установить соединение через TURN, причина:",
        turnError.message
      );
    });

    this.metaDrawer.init();
  }

  async reset(): Promise<void> {
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

    const currentTime = event.timeStamp;

    this.timelineDrawer.draw(currentTime);
  };

  private supportConnect() {
    this.datachannelClient.send(DatachannelMessageType.ARCHIVE_CONNECT_SUPPORT);
  }

  private emitStartNewFragment(fragment: RangeDto, isPreRequestRange = false) {
    this.isPreRequestRange = isPreRequestRange;

    if (this.isPreRequestRange) {
      this.datachannelClient.send(DatachannelMessageType.GET_ARCHIVE_FRAGMENT, {
        start_time: fragment.start_time,
        duration: fragment.duration,
      });

      return;
    }

    this.nextProcessedRange = fragment;

    this.datachannelClient.send(DatachannelMessageType.DROP_BUFFER);
  }

  private onChangeCurrentTime(
    ...[timestamp, range]: Parameters<TimelineClickCallback>
  ) {
    const customRange: RangeDto = {
      ...range,
      start_time: timestamp,
      duration: range.end_time - timestamp,
    };

    this.emitStartNewFragment(customRange);
  }

  private onDropComplete() {
    if (!this.nextProcessedRange) {
      return;
    }

    this.datachannelClient.send(DatachannelMessageType.GET_KEY, {
      start_time: this.nextProcessedRange.start_time,
    });
  }

  private onKeyFragmentUpload() {
    if (!this.nextProcessedRange) {
      return;
    }

    this.datachannelClient.send(DatachannelMessageType.GET_ARCHIVE_FRAGMENT, {
      start_time: this.nextProcessedRange.start_time,
      duration: this.nextProcessedRange.duration,
    });
  }

  private onSaveArchiveFragment() {
    if (this.isPreRequestRange) {
      this.isPreRequestRange = false;

      this.logger.log(
        "info",
        "Фрагмент стрима начался: ",
        this.nextProcessedRange
      );
      this.nextProcessedRange = null;

      return;
    }

    this.play();
  }

  private onStreamPlay() {
    if (this.nextProcessedRange) {
      this.logger.log(
        "info",
        "Фрагмент стрима начался: ",
        this.nextProcessedRange
      );
    }

    this.nextProcessedRange = null;
  }

  play() {
    this.datachannelClient.send(DatachannelMessageType.PLAY_STREAM);
  }

  stop() {
    this.datachannelClient.send(DatachannelMessageType.STOP_STREAM);
  }

  setSource(stream: MediaStream) {
    this.player.setSource(stream);
    this.player.play();
  }
}
