export type ConnectionOptions = {
  config: RTCConfiguration;
  constrains?: {
    maxBitrate: number;
  };
};
