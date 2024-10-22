import {
  ButtonControlOptions,
  ControlName,
  ControlsOptions,
  RangeControlOptions,
  SelectControlOptions,
} from "../../../types/controls";
import { Nullable } from "../../../types/global";

type ButtonControl = Exclude<
  ControlName,
  ControlName.SPEED | ControlName.SOUND | ControlName.QUALITY
>;

type CommonButtonControl = Exclude<
  ButtonControl,
  | ControlName.MODE
  | ControlName.PLAY
  | ControlName.VOLUME
  | ControlName.EXPORT
  | ControlName.MICROPHONE
>;
type BinaryButtonControl = Exclude<ButtonControl, CommonButtonControl>;

const BINARY_BUTTON_ICONS: Record<
  BinaryButtonControl,
  { on: string; off: string }
> = {
  [ControlName.PLAY]: {
    on: "/play.svg",
    off: "/pause.svg",
  },
  [ControlName.VOLUME]: {
    on: "/volume-on.svg",
    off: "/volume-mute.svg",
  },
  [ControlName.MODE]: {
    on: "/live-mode.svg",
    off: "/archive-mode.svg",
  },
  [ControlName.EXPORT]: {
    on: "./cancel.svg",
    off: "./export.svg",
  },
  [ControlName.MICROPHONE]: {
    on: "/mic-on.svg",
    off: "/mic-off.svg",
  },
};

const COMMON_BUTTON_ICONS: Record<CommonButtonControl, string> = {
  [ControlName.SNAPSHOT]: "/snapshot.svg",
  // [ControlName.NEXT_FRAME]: "/stop.svg",
  // [ControlName.PREV_FRAME]: "/stop.svg",
  [ControlName.NEXT_FRAGMENT]: "/step-forward.svg",
  [ControlName.PREV_FRAGMENT]: "/step-backward.svg",
  // [ControlName.INFO]: "/stop.svg",
};

export class ControlsOverflowDrawerService {
  private readonly container!: HTMLDivElement;

  private hiddenButtons: Partial<Record<ControlName, boolean>> = {};
  private disabledButtons: Partial<Record<ControlName, boolean>> = {};
  private binaryButtonsState: Partial<Record<BinaryButtonControl, boolean>> =
    {};

  private controlValues: Partial<Record<ControlName, string>> = {};

  private options!: ControlsOptions;

  private controlsContainer: Nullable<HTMLDivElement> = null;

  constructor(container: HTMLDivElement, options: ControlsOptions) {
    this.container = container;
    this.options = options;
  }

  draw(): void {
    const controlsContainer = document.createElement("div");
    controlsContainer.className = "video-player__controls__container";

    if (!this.hiddenButtons[ControlName.MODE]) {
      controlsContainer.appendChild(this.makeControl(ControlName.MODE));
    }
    if (!this.hiddenButtons[ControlName.PREV_FRAGMENT]) {
      controlsContainer.appendChild(
        this.makeControl(ControlName.PREV_FRAGMENT)
      );
    }
    if (!this.hiddenButtons[ControlName.PLAY]) {
      controlsContainer.appendChild(this.makeControl(ControlName.PLAY));
    }
    if (!this.hiddenButtons[ControlName.VOLUME]) {
      controlsContainer.appendChild(this.makeControl(ControlName.VOLUME));
    }
    if (!this.hiddenButtons[ControlName.MICROPHONE]) {
      controlsContainer.appendChild(this.makeControl(ControlName.MICROPHONE));
    }
    if (!this.hiddenButtons[ControlName.NEXT_FRAGMENT]) {
      controlsContainer.appendChild(
        this.makeControl(ControlName.NEXT_FRAGMENT)
      );
    }
    if (!this.hiddenButtons[ControlName.SNAPSHOT]) {
      controlsContainer.appendChild(this.makeControl(ControlName.SNAPSHOT));
    }
    if (!this.hiddenButtons[ControlName.EXPORT]) {
      controlsContainer.appendChild(this.makeControl(ControlName.EXPORT));
    }
    if (!this.hiddenButtons[ControlName.SPEED]) {
      controlsContainer.appendChild(this.makeControl(ControlName.SPEED));
    }

    if (!this.hiddenButtons[ControlName.SOUND]) {
      controlsContainer.appendChild(this.makeControl(ControlName.SOUND));
    }
    if (!this.hiddenButtons[ControlName.QUALITY]) {
      controlsContainer.appendChild(this.makeControl(ControlName.QUALITY));
    }

    this.clear();
    this.controlsContainer = controlsContainer;
    this.container.appendChild(controlsContainer);
  }

  setHidden(hiddenButtons: Partial<Record<ControlName, boolean>>) {
    this.hiddenButtons = hiddenButtons;
  }

  setDisabled(disabledButtons: Partial<Record<ControlName, boolean>>) {
    this.disabledButtons = disabledButtons;
  }

  updateControlValues(values: Record<string, string>) {
    this.controlValues = {
      ...this.controlValues,
      ...values,
    };
  }

  setBinaryButtonsState(
    binaryButtonsState: Partial<Record<BinaryButtonControl, boolean>>
  ) {
    this.binaryButtonsState = binaryButtonsState;
  }

  updateBinaryButtonsState(
    binaryButtonsState: Partial<Record<BinaryButtonControl, boolean>>
  ) {
    this.binaryButtonsState = {
      ...this.binaryButtonsState,
      ...binaryButtonsState,
    };
  }

  private makeControl(name: ControlName): HTMLElement {
    const config = this.options[name];

    switch (config.type) {
      case "button":
        return this.makeButton(name as ButtonControl, config);

      case "select":
        return this.makeSelect(name as ControlName, config);

      case "range":
        return this.makeRange(name as ControlName, config);
    }
  }

  private makeButton(
    controlName: ButtonControl,
    config: ButtonControlOptions
  ): HTMLButtonElement {
    if (config.binary) {
      const name = controlName as BinaryButtonControl;
      const enabled = Boolean(this.binaryButtonsState?.[name]);

      return this.makeBaseButton(
        controlName,
        enabled ? BINARY_BUTTON_ICONS[name].on : BINARY_BUTTON_ICONS[name].off,
        config.listeners
      );
    }

    return this.makeBaseButton(
      controlName,
      COMMON_BUTTON_ICONS[controlName as CommonButtonControl],
      config.listeners
    );
  }

  private makeSelect(
    name: ControlName,
    config: SelectControlOptions
  ): HTMLSelectElement {
    const select = document.createElement("select");

    const options: HTMLOptionElement[] = [];

    for (const optionConfig of config.options) {
      const option = document.createElement("option");

      option.innerText = optionConfig.label;
      option.value = optionConfig.value;
      option.selected =
        option.value === (this.controlValues[name] ?? config.value);

      options.push(option);
    }

    select.append(...options);

    for (const event in config.listeners) {
      const eventName = event as keyof SelectControlOptions["listeners"];

      const listener = config.listeners[eventName];
      if (!listener) {
        continue;
      }

      select.addEventListener(eventName, listener);
    }

    return select;
  }

  private makeRange(
    name: ControlName,
    config: RangeControlOptions
  ): HTMLDivElement {
    const rangeContainer = document.createElement("div");

    const input = document.createElement("input");

    input.type = "range";

    input.value = this.controlValues[name] ?? config.value;

    for (const event in config.listeners) {
      const eventName = event as keyof ButtonControlOptions["listeners"];

      const listener = config.listeners[eventName];
      if (!listener) {
        continue;
      }

      input.addEventListener(eventName, listener);
    }

    rangeContainer.appendChild(input);

    const label = document.createElement("label");

    label.innerText = config.getLabel();

    rangeContainer.appendChild(label);

    return rangeContainer;
  }

  private makeBaseButton(
    name: ButtonControl,
    icon: string,
    listeners: ButtonControlOptions["listeners"]
  ) {
    const buttonContainer = document.createElement("button");
    const image = document.createElement("img");

    buttonContainer.className = "video-player__controls__button";
    buttonContainer.disabled = Boolean(this.disabledButtons[name]);

    image.src = icon;

    buttonContainer.appendChild(image);

    for (const event in listeners) {
      const eventName = event as keyof ButtonControlOptions["listeners"];

      const listener = listeners[eventName];
      if (!listener) {
        continue;
      }

      buttonContainer.addEventListener(eventName, listener);
    }

    return buttonContainer;
  }

  public clear() {
    if (!this.controlsContainer) {
      return;
    }

    this.container.removeChild(this.controlsContainer);
  }
}
