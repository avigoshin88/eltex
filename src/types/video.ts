export type Stats = {
  /**
   * in kb/s
   */
  bitrate: number;
  resolution: {
    width: number;
    height: number;
  };

  videoCodec: string;
  audioCodec: string;

  frameRate: number;
};
