export type ConnectionOptions = {
  app: string;
  stream: string;
  config: RTCConfiguration;
  constrains?: {
    maxBitrate: number;
  };
};
