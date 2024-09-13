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

export class ArchiveVideoService implements ModeService {
  private logger = new Logger(ArchiveVideoService.name);

  private readonly webRTCClient!: WebRTCService;
  private readonly datachannelClient: DatachannelClientService;
  private readonly player: VideoPlayerService;

  private readonly timelineDrawer = new TimelineOverflowDrawer();
  private readonly rangeMapper = new RangeMapperService();

  constructor(options: ConnectionOptions, player: VideoPlayerService) {
    this.player = player;

    this.datachannelClient = new DatachannelClientService();

    this.webRTCClient = new WebRTCService(
      options,
      this.datachannelClient,
      this.setSource.bind(this)
    );
  }

  async init(): Promise<void> {
    this.webRTCClient.setupPeerConnection({
      nativeListeners: {
        open: this.onOpenDatachannel.bind(this),
      },
      listeners: {
        [DatachannelMessageType.RANGES]: this.onRanges.bind(this),
      },
    });

    this.webRTCClient.startTURN("archive").catch((turnError: Error) => {
      this.logger.error(
        "Не удается установить соединение через TURN, причина:",
        turnError.message
      );
    });
  }

  async reset(): Promise<void> {
    this.webRTCClient.reset();
  }

  private async onOpenDatachannel() {
    this.datachannelClient.send(DatachannelMessageType.GET_RANGES);
  }

  private onRanges(data: unknown) {
    const { ranges: unsortedRanges } = data as { ranges: RangeDto[] };

    const ranges = unsortedRanges.sort((a, b) => a.start_time - b.start_time);

    this.timelineDrawer.setOptions(this.rangeMapper.calc(ranges));
    this.timelineDrawer.draw(this.player.container);

    const firstRange = ranges[0];
    this.datachannelClient.send(DatachannelMessageType.GET_ARCHIVE_FRAGMENT, {
      start_time: firstRange.start_time,
      duration: firstRange.duration,
    });
  }

  // private

  setSource(stream: MediaStream) {
    this.player.setSource(stream);
    this.player.play();
  }
}
