export type ConnectionOptions = {
  app: string;
  stream: string;
  config: RTCConfiguration;
};

export type WebRTCConnectionOptions = ConnectionOptions & {
  videoElement: HTMLVideoElement;
};
