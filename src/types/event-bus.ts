export type EventCallback = (data?: any) => void;

export type EventName =
  | "setup-peerconnection"
  | "setup-video"
  | "stats"
  | "new-archive-fragment-started"
  | "cancel-export"
  | "play-enabled";
