import { ButtonCallbacks, ButtonType } from "../../../types/button-callback";

type CommonButtonType = Exclude<ButtonType, ButtonType.MODE>;
type BinaryButtonType = Exclude<ButtonType, CommonButtonType>;

const binaryIcons: Record<BinaryButtonType, { on: string; off: string }> = {
  [ButtonType.MODE]: {
    on: "/live-mode.svg",
    off: "/archive-mode.svg",
  },
};

const icons: Record<CommonButtonType, string> = {
  [ButtonType.PLAY]: "/play.svg",
  [ButtonType.STOP]: "/stop.svg",
  // [ButtonType.PAUSE]: "/pause.svg",
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
  private container!: HTMLDivElement;

  private callbacks: ButtonCallbacks | null = null;
  private disabledButtons: Partial<Record<ButtonType, boolean>> = {};
  private binaryButtonsState: Partial<Record<BinaryButtonType, boolean>> = {};

  constructor(container: HTMLDivElement) {
    this.container = container;
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
      controlsContainer.appendChild(this.makeButton(ButtonType.PLAY));
    }
    if (!this.disabledButtons[ButtonType.STOP]) {
      controlsContainer.appendChild(this.makeButton(ButtonType.STOP));
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
    this.container.appendChild(controlsContainer);
  }

  setDisabled(disabledButtons: Partial<Record<ButtonType, boolean>>) {
    this.disabledButtons = disabledButtons;
  }

  setOptions(callbacks: ButtonCallbacks): void {
    this.callbacks = callbacks;
  }

  setBinaryButtonsState(
    binaryButtonsState: Partial<Record<BinaryButtonType, boolean>>
  ) {
    this.binaryButtonsState = binaryButtonsState;
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
    const controlsContainer = document.getElementsByClassName(
      "video-player-controls-container"
    )[0];
    if (!controlsContainer) {
      return;
    }

    this.container.removeChild(controlsContainer);
  }
}
