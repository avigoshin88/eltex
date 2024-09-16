import { ButtonCallbacks, ButtonType } from "../../../types/button-callback";
import { Nullable } from "../../../types/global";

type CommonButtonType = Exclude<
  ButtonType,
  ButtonType.MODE | ButtonType.PLAY | ButtonType.VOLUME
>;
type BinaryButtonType = Exclude<ButtonType, CommonButtonType>;

const binaryIcons: Record<BinaryButtonType, { on: string; off: string }> = {
  [ButtonType.PLAY]: {
    on: "/play.svg",
    off: "/pause.svg",
  },
  [ButtonType.VOLUME]: {
    on: "/volume-on.svg",
    off: "/volume-mute.svg",
  },
  [ButtonType.MODE]: {
    on: "/live-mode.svg",
    off: "/archive-mode.svg",
  },
};

const icons: Record<CommonButtonType, string> = {
  // [ButtonType.MUTE]: "/stop.svg",
  [ButtonType.EXPORT]: "/export.svg",
  [ButtonType.SNAPSHOT]: "/snapshot.svg",
  // [ButtonType.NEXT_FRAME]: "/stop.svg",
  // [ButtonType.PREV_FRAME]: "/stop.svg",
  [ButtonType.NEXT_FRAGMENT]: "/step-forward.svg",
  [ButtonType.PREV_FRAGMENT]: "/step-backward.svg",
  // [ButtonType.INFO]: "/stop.svg",
};

export class ControlsOverflowDrawerService {
  private readonly container!: HTMLDivElement;

  private callbacks: Nullable<ButtonCallbacks> = null;
  private disabledButtons: Partial<Record<ButtonType, boolean>> = {};
  private binaryButtonsState: Partial<Record<BinaryButtonType, boolean>> = {};

  private controlsContainer: Nullable<HTMLDivElement> = null;

  constructor(container: HTMLDivElement, callbacks: ButtonCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  draw(): void {
    const controlsContainer = document.createElement("div");
    controlsContainer.className = "video-player-controls-container";

    if (!this.disabledButtons[ButtonType.MODE]) {
      controlsContainer.appendChild(
        this.makeBinaryButton(
          ButtonType.MODE,
          Boolean(this.binaryButtonsState?.[ButtonType.MODE])
        )
      );
    }
    if (!this.disabledButtons[ButtonType.PREV_FRAGMENT]) {
      controlsContainer.appendChild(this.makeButton(ButtonType.PREV_FRAGMENT));
    }
    if (!this.disabledButtons[ButtonType.PLAY]) {
      controlsContainer.appendChild(
        this.makeBinaryButton(
          ButtonType.PLAY,
          Boolean(this.binaryButtonsState?.[ButtonType.PLAY])
        )
      );
    }
    if (!this.disabledButtons[ButtonType.VOLUME]) {
      controlsContainer.appendChild(
        this.makeBinaryButton(
          ButtonType.VOLUME,
          Boolean(this.binaryButtonsState?.[ButtonType.VOLUME])
        )
      );
    }
    if (!this.disabledButtons[ButtonType.NEXT_FRAGMENT]) {
      controlsContainer.appendChild(this.makeButton(ButtonType.NEXT_FRAGMENT));
    }
    if (!this.disabledButtons[ButtonType.SNAPSHOT]) {
      controlsContainer.appendChild(this.makeButton(ButtonType.SNAPSHOT));
    }
    if (!this.disabledButtons[ButtonType.EXPORT]) {
      controlsContainer.appendChild(this.makeButton(ButtonType.EXPORT));
    }

    this.clear();
    this.controlsContainer = controlsContainer;
    this.container.appendChild(controlsContainer);
  }

  setDisabled(disabledButtons: Partial<Record<ButtonType, boolean>>) {
    this.disabledButtons = disabledButtons;
  }

  setBinaryButtonsState(
    binaryButtonsState: Partial<Record<BinaryButtonType, boolean>>
  ) {
    this.binaryButtonsState = binaryButtonsState;
  }

  updateBinaryButtonsState(
    binaryButtonsState: Partial<Record<BinaryButtonType, boolean>>
  ) {
    this.binaryButtonsState = {
      ...this.binaryButtonsState,
      ...binaryButtonsState,
    };
  }

  private makeButton(type: CommonButtonType) {
    return this.makeBaseButton(type, icons[type]);
  }

  private makeBinaryButton(type: BinaryButtonType, enabled: boolean) {
    return this.makeBaseButton(
      type,
      enabled ? binaryIcons[type].on : binaryIcons[type].off
    );
  }

  private makeBaseButton(type: ButtonType, icon: string) {
    const buttonContainer = document.createElement("a");
    const image = document.createElement("img");

    image.src = icon;

    buttonContainer.appendChild(image);

    buttonContainer.onclick = this.callbacks![type];

    return buttonContainer;
  }

  private clear() {
    if (!this.controlsContainer) {
      return;
    }

    this.container.removeChild(this.controlsContainer);
  }
}
