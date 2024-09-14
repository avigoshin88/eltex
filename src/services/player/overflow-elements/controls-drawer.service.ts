import { OverflowElementDrawer } from "../../../interfaces/overflow-element-builder";
import {
  ButtonCallback,
  ButtonCallbacks,
  ButtonCallbackType,
} from "../../../types/button-callback";

const icons: Record<ButtonCallbackType, string> = {
  [ButtonCallbackType.PLAY]: "/play.svg",
  [ButtonCallbackType.STOP]: "/stop.svg",
  [ButtonCallbackType.PAUSE]: "/pause.svg",
  [ButtonCallbackType.MUTE]: "/stop.svg",
  [ButtonCallbackType.EXPORT]: "/export.svg",
  [ButtonCallbackType.SCREENSHOT]: "/screenshot.svg",
  [ButtonCallbackType.NEXT_FRAME]: "/stop.svg",
  [ButtonCallbackType.PREV_FRAME]: "/stop.svg",
  [ButtonCallbackType.NEXT_FRAGMENT]: "/step-forward.svg",
  [ButtonCallbackType.PREV_FRAGMENT]: "/step-backward.svg",
  [ButtonCallbackType.INFO]: "/stop.svg",
};

export class ControlsOverflowDrawerService implements OverflowElementDrawer {
  callbacks: ButtonCallbacks = {};

  draw(container: HTMLDivElement): void {
    const controlsContainer = document.createElement("div");

    for (const type in this.callbacks) {
      const callback = this.callbacks[type as ButtonCallbackType];

      if (!callback) {
        continue;
      }

      controlsContainer.appendChild(
        this.makeButton(icons[type as ButtonCallbackType], callback)
      );
    }

    container.appendChild(controlsContainer);
  }

  private makeButton(iconLink: string, callback: ButtonCallback) {
    const buttonContainer = document.createElement("a");
    const image = document.createElement("img");

    image.src = iconLink;

    buttonContainer.appendChild(image);

    buttonContainer.onclick = callback;

    return buttonContainer;
  }

  setOptions(callbacks: ButtonCallbacks): void {
    this.callbacks = callbacks;
  }
}
