export enum ButtonCallbackType {
  PLAY = "play",
  STOP = "stop",
  // PAUSE = "pause",
  // MUTE = "mute",
  EXPORT = "export",
  SCREENSHOT = "screenshot",
  // NEXT_FRAME = "next_frame",
  // PREV_FRAME = "prev_frame",
  NEXT_FRAGMENT = "next_fragment",
  PREV_FRAGMENT = "prev_fragment",
  // INFO = "info",
}

export type ButtonCallback = () => void;

export type ButtonCallbacks = Record<ButtonCallbackType, ButtonCallback>;
