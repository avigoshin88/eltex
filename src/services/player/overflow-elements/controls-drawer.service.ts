import { OverflowElementDrawer } from "../../../interfaces/overflow-element-builder";
import { ButtonCallbacks, ButtonType } from "../../../types/button-callback";

const icons: Record<ButtonType, string> = {
  [ButtonType.PLAY]: "/play.svg",
  [ButtonType.STOP]: "/stop.svg",
  // [ButtonType.PAUSE]: "/pause.svg",
  // [ButtonType.MUTE]: "/stop.svg",
  [ButtonType.EXPORT]: "/export.svg",
  [ButtonType.SCREENSHOT]: "/screenshot.svg",
  // [ButtonType.NEXT_FRAME]: "/stop.svg",
  // [ButtonType.PREV_FRAME]: "/stop.svg",
  [ButtonType.NEXT_FRAGMENT]: "/step-forward.svg",
  [ButtonType.PREV_FRAGMENT]: "/step-backward.svg",
  // [ButtonType.INFO]: "/stop.svg",
};

export class ControlsOverflowDrawerService implements OverflowElementDrawer {
  callbacks: ButtonCallbacks | null = null;
  disabledButtons: Partial<Record<ButtonType, boolean>> = {};

  draw(container: HTMLDivElement): void {
    const controlsContainer = document.createElement("div");
    controlsContainer.className = "video-player-controls-container";

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
    if (!this.disabledButtons[ButtonType.SCREENSHOT]) {
      controlsContainer.appendChild(this.makeButton(ButtonType.SCREENSHOT));
    }
    if (!this.disabledButtons[ButtonType.EXPORT]) {
      controlsContainer.appendChild(this.makeButton(ButtonType.EXPORT));
    }

    container.appendChild(controlsContainer);
  }

  setDisabled(disabledButtons: Partial<Record<ButtonType, boolean>>) {
    this.disabledButtons = disabledButtons;
  }

  private makeButton(type: ButtonType) {
    const buttonContainer = document.createElement("a");
    const image = document.createElement("img");

    image.src = icons[type];

    buttonContainer.appendChild(image);

    buttonContainer.onclick = this.callbacks![type];

    return buttonContainer;
  }

  setOptions(callbacks: ButtonCallbacks): void {
    this.callbacks = callbacks;
  }
}
