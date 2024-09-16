export enum ButtonType {
  MODE = "mode",
  PLAY = "play",
  VOLUME = "volume",
  EXPORT = "export",
  SNAPSHOT = "snapshot",
  // NEXT_FRAME = "next_frame",
  // PREV_FRAME = "prev_frame",
  NEXT_FRAGMENT = "next_fragment",
  PREV_FRAGMENT = "prev_fragment",
  // INFO = "info",
}

export type ButtonCallback = () => void;

export type ButtonCallbacks = Record<ButtonType, ButtonCallback>;
