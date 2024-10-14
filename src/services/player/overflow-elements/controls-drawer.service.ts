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
  | ControlName.STATS
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
  [ControlName.STATS]: {
    on: "/stats-on.svg",
    off: "/stats-off.svg",
  },
};

const COMMON_BUTTON_ICONS: Record<CommonButtonControl, string> = {
  [ControlName.SNAPSHOT]: "/snapshot.svg",
  [ControlName.NEXT_FRAGMENT]: "/step-forward.svg",
  [ControlName.PREV_FRAGMENT]: "/step-backward.svg",
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
  private controls: Partial<Record<ControlName, HTMLElement>> = {};

  constructor(container: HTMLDivElement, options: ControlsOptions) {
    this.container = container;
    this.options = options;
  }

  draw(): void {
    if (!this.controlsContainer) {
      this.controlsContainer = document.createElement("div");
      this.controlsContainer.className = "video-player__controls__container";
      this.container.appendChild(this.controlsContainer);
    }

    for (const controlName in this.options) {
      if (this.hiddenButtons[controlName as ControlName]) {
        continue;
      }

      if (!this.controls[controlName as ControlName]) {
        const controlElement = this.makeControl(controlName as ControlName);
        this.controls[controlName as ControlName] = controlElement;
        this.controlsContainer.appendChild(controlElement);
      } else {
        this.updateControl(controlName as ControlName);
      }
    }
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

  private updateControl(name: ControlName) {
    const control = this.controls[name];
    if (!control) return;

    const config = this.options[name];

    switch (config.type) {
      case "button":
        this.updateButton(control as HTMLButtonElement, name as ButtonControl, config);
        break;

      case "select":
        this.updateSelect(control as HTMLSelectElement, name as ControlName, config);
        break;

      case "range":
        this.updateRange(control as HTMLDivElement, name as ControlName, config);
        break;
    }
  }

  private makeButton(
    controlName: ButtonControl,
    config: ButtonControlOptions
  ): HTMLButtonElement {
    const button = document.createElement("button");
    this.updateButton(button, controlName, config);
    return button;
  }

  private updateButton(
    button: HTMLButtonElement,
    controlName: ButtonControl,
    config: ButtonControlOptions
  ) {
    button.className = "video-player__controls__button";
    button.disabled = Boolean(this.disabledButtons[controlName]);

    const image = button.querySelector("img") || document.createElement("img");
    if (!button.contains(image)) {
      button.appendChild(image);
    }

    if (config.binary) {
      const name = controlName as BinaryButtonControl;
      const enabled = Boolean(this.binaryButtonsState?.[name]);
      image.src = enabled ? BINARY_BUTTON_ICONS[name].on : BINARY_BUTTON_ICONS[name].off;
    } else {
      image.src = COMMON_BUTTON_ICONS[controlName as CommonButtonControl];
    }

    for (const event in config.listeners) {
      const eventName = event as keyof ButtonControlOptions["listeners"];
      const listener = config.listeners[eventName];
      if (listener) {
        button.addEventListener(eventName, listener);
      }
    }
  }

  private makeSelect(
    name: ControlName,
    config: SelectControlOptions
  ): HTMLSelectElement {
    const select = document.createElement("select");
    this.updateSelect(select, name, config);
    return select;
  }

  private updateSelect(
    select: HTMLSelectElement,
    name: ControlName,
    config: SelectControlOptions
  ) {
    select.innerHTML = "";

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
      if (listener) {
        select.addEventListener(eventName, listener);
      }
    }
  }

  private makeRange(
    name: ControlName,
    config: RangeControlOptions
  ): HTMLDivElement {
    const rangeContainer = document.createElement("div");
    this.updateRange(rangeContainer, name, config);
    return rangeContainer;
  }

  private updateRange(
    rangeContainer: HTMLDivElement,
    name: ControlName,
    config: RangeControlOptions
  ) {
    rangeContainer.innerHTML = "";

    const input = document.createElement("input");
    input.type = "range";
    input.value = this.controlValues[name] ?? config.value;

    for (const event in config.listeners) {
      const eventName = event as keyof ButtonControlOptions["listeners"];
      const listener = config.listeners[eventName];
      if (listener) {
        input.addEventListener(eventName, listener);
      }
    }

    rangeContainer.appendChild(input);

    const label = document.createElement("label");
    label.innerText = config.getLabel();
    rangeContainer.appendChild(label);
  }

  public clear() {
    if (!this.controlsContainer) {
      return;
    }

    this.container.removeChild(this.controlsContainer);
    this.controlsContainer = null;
    this.controls = {};
  }
}
