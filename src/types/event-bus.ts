export type EventCallback = (data?: any) => void;

export type EventName =
  | "setup-peerconnection"
  | "setup-video"
  | "stats"
  | "new-archive-fragment-started"
  | "cancel-export"
  | "play-enabled"
  | "current-video-codec"
  | "set-timeline-scale-options"
  | "set-timeline-scale"
  | "manual-scale-change"
  | "timeline-scale-update"
  | "archive-timeupdate"
  | "change-mic-state"
  | "need-to-force-scroll-to-track"
  | "push2Talk"
  | "restart-connection";
