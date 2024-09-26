export enum ControlName {
  MODE = "mode",
  PLAY = "play",
  VOLUME = "volume",
  MICROPHONE = "microphone",
  EXPORT = "export",
  SNAPSHOT = "snapshot",
  SPEED = "speed",
  // NEXT_FRAME = "next_frame",
  // PREV_FRAME = "prev_frame",
  NEXT_FRAGMENT = "next_fragment",
  PREV_FRAGMENT = "prev_fragment",
}

export type ControlType = "button" | "select";

export enum CallbackType {
  CLICK = "click",
  CHANGE = "change",
  MOUSE_UP = "mouseup",
  MOUSE_DOWN = "mousedown",
  MOUSE_ENTER = "mouseenter",
  MOUSE_LEAVE = "mouseleave",
  MOUSE_MOVE = "mousemove",
}

export type SelectValue = string;

export type ButtonListener = EventListenerOrEventListenerObject;
export type SelectListener = EventListener;

export type SelectOption = {
  label: string;
  value: SelectValue;
};

export type ControlListeners<T> = Partial<Record<CallbackType, T>>;

export type Control = {
  type: ControlType;
  listeners: ControlListeners<ButtonListener | SelectListener>;
};

export type ButtonControlOptions = Control & {
  type: "button";
  binary?: boolean;
  listeners: ControlListeners<ButtonListener>;
};

export type BinaryButtonControlOptions = ButtonControlOptions & {
  binary: true;
};

export type SelectControlOptions = Control & {
  type: "select";
  listeners: ControlListeners<SelectListener>;

  defaultValue: SelectValue;
  options: SelectOption[];
};

export type ControlsOptions = {
  [ControlName.MODE]: BinaryButtonControlOptions;
  [ControlName.PLAY]: BinaryButtonControlOptions;
  [ControlName.VOLUME]: BinaryButtonControlOptions;
  [ControlName.MICROPHONE]: BinaryButtonControlOptions;

  [ControlName.NEXT_FRAGMENT]: ButtonControlOptions;
  [ControlName.PREV_FRAGMENT]: ButtonControlOptions;
  
  [ControlName.SNAPSHOT]: ButtonControlOptions;
  [ControlName.EXPORT]: BinaryButtonControlOptions;

  [ControlName.SPEED]: SelectControlOptions;
};
