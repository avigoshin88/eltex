import { Logger } from "../logger/logger.service";
import { WebRTCService } from "../webrtc.service";
import { ConnectionOptions } from "../../types/connection-options";
import { ModeService } from "../../interfaces/mode";
import { VideoConverterService } from "../video-converter.service";
import { debounce } from "remeda";
import Player from "video.js/dist/types/player";
import { DatachannelClientService } from "../datachannel/data-channel.service";
import { DatachannelMessageType } from "../../types/datachannel-listener";
import { VideoPlayerService } from "../player/player.service";

export class ArchiveVideoService implements ModeService {
  private logger = new Logger(ArchiveVideoService.name);

  private readonly webRTCClient!: WebRTCService;
  private readonly datachannelClient: DatachannelClientService;

  private combinedStream: MediaStream | null = null;

  private readonly player: VideoPlayerService;

  private readonly converter: VideoConverterService =
    new VideoConverterService();
  private processor!: ReturnType<typeof debounce<() => Promise<void>>>;

  constructor(options: ConnectionOptions, player: VideoPlayerService) {
    this.player = player;

    this.datachannelClient = new DatachannelClientService();

    this.webRTCClient = new WebRTCService(
      { ...options, videoElement: this.player.video },
      this.datachannelClient,
      (...args) => this.addVideoStream(...args)
    );
  }

  async init(): Promise<void> {
    // @ts-ignore
    this.processor = debounce(this.processStream.bind(this), {});

    this.webRTCClient.setupPeerConnection({
      nativeListeners: {
        open: this.onOpenDatachannel.bind(this),
      },
      listeners: {
        connection: this.onConnection.bind(this),
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

  private onConnection(data: unknown) {
    console.log(data);
  }

  public async addVideoStream(
    stream: MediaStream,
    track: MediaStreamTrack
  ): Promise<void> {
    if (!this.combinedStream) {
      this.combinedStream = new MediaStream();
    }

    stream.getTracks().forEach((track) => {
      this.combinedStream!.addTrack(track);
    });

    if (this.combinedStream.getTracks().length > 10) {
      this.logger.warn("Объединенный поток содержит более 10 траков");
    }

    this.processor.call();
  }

  private async processStream() {
    await this.processCombinedStream(await this.combineStreams());
  }

  private async combineStreams(): Promise<MediaStream> {
    if (!this.combinedStream) {
      throw new Error("No streams added yet");
    }

    const combinedMediaStream = new MediaStream(
      this.combinedStream.getTracks()
    );
    this.combinedStream = null; // Очищаем комбинированный поток после объединения
    return combinedMediaStream;
  }

  // Метод для обработки объединенного потока
  private async processCombinedStream(
    combinedStream: MediaStream
  ): Promise<void> {
    const blob = await this.converter.convertMediaStreamToBlob(combinedStream);
    console.log("🚀 ~ ArchiveVideoService ~ blob:", blob);
    // this.player.play();
    // this.video.srcObject = combinedStream;
    // this.video.preload = "auto";
    // this.video.play();
    // Например, можно использовать этот метод в методе init()
  }
}
