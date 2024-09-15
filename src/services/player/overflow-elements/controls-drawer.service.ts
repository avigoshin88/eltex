import { OverflowElementDrawer } from "../../../interfaces/overflow-element-builder";
import {
  ButtonCallback,
  ButtonCallbacks,
  ButtonCallbackType,
} from "../../../types/button-callback";

const icons: Record<ButtonCallbackType, string> = {
  [ButtonCallbackType.PLAY]: "/play.svg",
  [ButtonCallbackType.STOP]: "/stop.svg",
  // [ButtonCallbackType.PAUSE]: "/pause.svg",
  // [ButtonCallbackType.MUTE]: "/stop.svg",
  [ButtonCallbackType.EXPORT]: "/export.svg",
  [ButtonCallbackType.SCREENSHOT]: "/screenshot.svg",
  // [ButtonCallbackType.NEXT_FRAME]: "/stop.svg",
  // [ButtonCallbackType.PREV_FRAME]: "/stop.svg",
  [ButtonCallbackType.NEXT_FRAGMENT]: "/step-forward.svg",
  [ButtonCallbackType.PREV_FRAGMENT]: "/step-backward.svg",
  // [ButtonCallbackType.INFO]: "/stop.svg",
};

export class ControlsOverflowDrawerService implements OverflowElementDrawer {
  callbacks: ButtonCallbacks | null = null;

  draw(container: HTMLDivElement): void {
    const controlsContainer = document.createElement("div");
    controlsContainer.className = "video-player-controls-container";

    controlsContainer.appendChild(
      this.makeButton(ButtonCallbackType.PREV_FRAGMENT)
    );
    controlsContainer.appendChild(this.makeButton(ButtonCallbackType.PLAY));
    controlsContainer.appendChild(this.makeButton(ButtonCallbackType.STOP));
    controlsContainer.appendChild(
      this.makeButton(ButtonCallbackType.NEXT_FRAGMENT)
    );
    controlsContainer.appendChild(
      this.makeButton(ButtonCallbackType.SCREENSHOT)
    );
    controlsContainer.appendChild(this.makeButton(ButtonCallbackType.EXPORT));

    container.appendChild(controlsContainer);
  }

  private makeButton(type: ButtonCallbackType) {
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
