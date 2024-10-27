export type EventCallback = (data?: any) => void;

export type EventName =
  | "setup-peerconnection"
  | "setup-video"
  | "stats"
  | "new-archive-fragment-started"
  | "cancel-export"
  | "play-enabled"
  | "set-timeline-scale-options"
  | "set-timeline-scale"
  | "timeline-scale-update"
  | "archive-timeupdate";
