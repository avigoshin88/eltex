import {
  ButtonControlOptions,
  ControlName,
  ControlsOptions,
  RangeControlOptions,
  SelectControlOptions,
} from "../../../types/controls";
import { Nullable } from "../../../types/global";
import { Logger } from "../../logger/logger.service";

type ButtonControl = Exclude<
  ControlName,
  | ControlName.SPEED
  | ControlName.SOUND
  | ControlName.QUALITY
  | ControlName.SCALE
>;

type CommonButtonControl = Exclude<
  ButtonControl,
  | ControlName.MODE
  | ControlName.PLAY
  | ControlName.VOLUME
  | ControlName.EXPORT
  | ControlName.MICROPHONE
  | ControlName.STATS
  | ControlName.META
>;
type BinaryButtonControl = Exclude<ButtonControl, CommonButtonControl>;

const BINARY_BUTTON_ICONS: Record<
  BinaryButtonControl,
  { on: string; off: string }
> = {
  [ControlName.PLAY]: {
    on: "/pause.svg",
    off: "/play.svg",
  },
  [ControlName.VOLUME]: {
    on: "/volume-on.svg",
    off: "/volume-mute.svg",
  },
  [ControlName.MODE]: {
    on: "/archive-mode.svg",
    off: "/live-mode.svg",
  },
  [ControlName.EXPORT]: {
    on: "/cancel.svg",
    off: "/export.svg",
  },
  [ControlName.MICROPHONE]: {
    on: "/mic-on.svg",
    off: "/mic-off.svg",
  },
  [ControlName.STATS]: {
    on: "/stats-on.svg",
    off: "/stats-off.svg",
  },
  [ControlName.META]: {
    on: "/meta-on.svg",
    off: "/meta-off.svg",
  },
};

const COMMON_BUTTON_ICONS: Record<CommonButtonControl, string> = {
  [ControlName.STOP]: "/stop.svg",
  [ControlName.SNAPSHOT]: "/snapshot.svg",
  [ControlName.NEXT_FRAGMENT]: "/step-forward.svg",
  [ControlName.PREV_FRAGMENT]: "/step-backward.svg",
};

const CONTROLS_ORDER: ControlName[] = [
  ControlName.MODE,
  ControlName.PREV_FRAGMENT,
  ControlName.PLAY,
  ControlName.STOP,
  ControlName.NEXT_FRAGMENT,
  ControlName.MICROPHONE,
  ControlName.VOLUME,
  ControlName.META,
  ControlName.EXPORT,
  ControlName.SNAPSHOT,
  ControlName.STATS,
  ControlName.SOUND,
  ControlName.SPEED,
  ControlName.QUALITY,
  ControlName.SCALE,
];

export class ControlsOverflowDrawerService {
  private logger: Logger;
  private readonly container!: HTMLDivElement;

  private hiddenButtons: Partial<Record<ControlName, boolean>> = {};
  private disabledButtons: Partial<Record<ControlName, boolean>> = {};
  private binaryButtonsState: Partial<Record<BinaryButtonControl, boolean>> =
    {};

  private controlValues: Partial<Record<ControlName, string>> = {};

  private options!: ControlsOptions;

  private controlsContainer: Nullable<HTMLDivElement> = null;
  private controls: Partial<Record<ControlName, HTMLElement>> = {};

  constructor(id: string, container: HTMLDivElement, options: ControlsOptions) {
    this.logger = new Logger(id, "ControlsOverflowDrawerService");
    this.container = container;
    this.options = options;
  }

  draw(): void {
    this.logger.log("trace", "Отрисовываем кнопки управления плеером");

    if (!this.controlsContainer) {
      this.logger.log(
        "trace",
        "Контейнер для кнопок управления отсутствует, создаем"
      );

      this.controlsContainer = document.createElement("div");
      this.controlsContainer.className = "video-player__controls__container";
      this.container.appendChild(this.controlsContainer);

      this.logger.log("trace", "Контейнер для кнопок управления добавлен");
    }

    for (const controlName of CONTROLS_ORDER) {
      if (this.hiddenButtons[controlName]) {
        continue;
      }

      if (!this.controls[controlName]) {
        const controlElement = this.makeControl(controlName);
        this.controls[controlName] = controlElement;
        this.controlsContainer.appendChild(controlElement);
      } else {
        this.updateControl(controlName);
      }
    }

    this.logger.log("trace", "Отрисовка кнопок управления плеером закончена");
  }

  setHidden(hiddenButtons: Partial<Record<ControlName, boolean>>) {
    this.logger.log(
      "trace",
      `Скрываем следующие кнопки: ${Object.keys(hiddenButtons)
        .filter((b) => hiddenButtons[b as ControlName])
        .join(", ")}`
    );

    this.hiddenButtons = hiddenButtons;
  }

  setDisabled(disabledButtons: Partial<Record<ControlName, boolean>>) {
    this.logger.log(
      "trace",
      `Устанавливаем disabled состояние на следующие кнопки: ${Object.keys(
        disabledButtons
      )
        .filter((b) => disabledButtons[b as ControlName])
        .join(", ")}`
    );

    this.disabledButtons = disabledButtons;
  }

  updateControlValues(values: Record<string, string>) {
    this.logger.log(
      "trace",
      `Обновляем значения кнопок управления, новые значения: ${JSON.stringify(
        values
      )}`
    );

    this.controlValues = {
      ...this.controlValues,
      ...values,
    };
  }

  updateSelectOptions(
    controlName: ControlName,
    options: SelectControlOptions["options"]
  ) {
    this.logger.log(
      "trace",
      `Обновляем опции селекта ${controlName}, новые значения: ${JSON.stringify(
        options
      )}`
    );

    const control = this.controls[controlName];

    if (!control) {
      this.logger.error("trace", `Селект ${controlName} отсутствует`);
      return;
    }

    if (control instanceof HTMLSelectElement) {
      const config = this.options[controlName] as SelectControlOptions;
      config.options = options;
      this.updateSelect(control, controlName, config);
    }
  }

  setBinaryButtonsState(
    binaryButtonsState: Partial<Record<BinaryButtonControl, boolean>>
  ) {
    this.logger.log(
      "trace",
      `Устанавливаем бинарные значения кнопок: ${JSON.stringify(
        binaryButtonsState
      )}`
    );

    this.binaryButtonsState = binaryButtonsState;
  }

  updateBinaryButtonsState(
    binaryButtonsState: Partial<Record<BinaryButtonControl, boolean>>
  ) {
    this.logger.log(
      "trace",
      `Обновляем бинарные значения кнопок: ${JSON.stringify(
        binaryButtonsState
      )}`
    );

    this.binaryButtonsState = {
      ...this.binaryButtonsState,
      ...binaryButtonsState,
    };
  }

  private makeControl(name: ControlName): HTMLElement {
    this.logger.log("trace", `Создаем кнопку ${name}`);

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
    this.logger.log("trace", `Пробуем обновить состояние кнопки ${name}`);

    const control = this.controls[name];

    if (!control) {
      this.logger.error("trace", `Кнопка ${name} отсутствует`);

      return;
    }

    const config = this.options[name];

    switch (config.type) {
      case "button":
        if (
          this.shouldUpdateButton(
            control as HTMLButtonElement,
            name as ButtonControl,
            config
          )
        ) {
          this.logger.log(
            "trace",
            `Кнопка ${name} требует обновления, обновляем`
          );
          this.updateButton(
            control as HTMLButtonElement,
            name as ButtonControl,
            config
          );
        } else this.logger.log("trace", `Кнопка ${name} не требует обновления`);
        break;

      case "select":
        if (
          this.shouldUpdateSelect(
            control as HTMLSelectElement,
            name as ControlName,
            config
          )
        ) {
          this.logger.log(
            "trace",
            `Селект ${name} требует обновления, обновляем`
          );
          this.updateSelect(
            control as HTMLSelectElement,
            name as ControlName,
            config
          );
        } else this.logger.log("trace", `Селект ${name} не требует обновления`);
        break;

      case "range":
        if (
          this.shouldUpdateRange(
            control as HTMLDivElement,
            name as ControlName,
            config
          )
        ) {
          this.logger.log("trace", `Обновляем ползунок ${name}`);
          this.updateRange(
            control as HTMLDivElement,
            name as ControlName,
            config
          );
        } else
          this.logger.log("trace", `Ползунок ${name} не требует обновления`);
        break;
    }
  }

  private shouldUpdateButton(
    button: HTMLButtonElement,
    controlName: ButtonControl,
    config: ButtonControlOptions
  ): boolean {
    this.logger.log(
      "trace",
      `Проверяем, требуется ли обновление кнопке ${controlName}`
    );

    const image = button.querySelector("img");
    if (!image) {
      this.logger.log(
        "trace",
        `В кнопке ${controlName} отсутствовала картинка, обновление требуется`
      );

      return true;
    }

    if (config.binary) {
      const name = controlName as BinaryButtonControl;
      const enabled = Boolean(this.binaryButtonsState?.[name]);
      const currentSrc = enabled
        ? BINARY_BUTTON_ICONS[name].on
        : BINARY_BUTTON_ICONS[name].off;

      this.logger.log(
        "trace",
        `В кнопке ${controlName} обновление${
          image.src !== currentSrc ? "" : " не"
        } требуется`
      );

      return image.src !== currentSrc;
    } else {
      this.logger.log(
        "trace",
        `В кнопке ${controlName} обновление${
          image.src !== COMMON_BUTTON_ICONS[controlName as CommonButtonControl]
            ? ""
            : " не"
        } требуется`
      );

      return (
        image.src !== COMMON_BUTTON_ICONS[controlName as CommonButtonControl]
      );
    }
  }

  private shouldUpdateSelect(
    select: HTMLSelectElement,
    name: ControlName,
    config: SelectControlOptions
  ): boolean {
    this.logger.log(
      "trace",
      `Проверяем, требуется ли обновление селекту ${name}`
    );
    const currentValue = this.controlValues[name] ?? config.value;

    this.logger.log(
      "trace",
      `В селекте ${name} обновление${
        select.value !== currentValue ? "" : " не"
      } требуется`
    );

    return select.value !== currentValue;
  }

  private shouldUpdateRange(
    range: HTMLDivElement,
    name: ControlName,
    config: RangeControlOptions
  ): boolean {
    this.logger.log(
      "trace",
      `Проверяем, требуется ли обновление ползунку ${name}`
    );
    const currentValue = this.controlValues[name] ?? config.value;

    const label = range.getElementsByTagName("label")[0];

    if (!label) {
      this.logger.log("trace", `В ползунке ${name} обновление требуется`);
      return true;
    }

    this.logger.log(
      "trace",
      `В ползунке ${name} обновление${
        label.innerHTML !== currentValue ? "" : " не"
      } требуется`
    );

    return label.innerHTML !== config.getLabel();
  }

  private makeButton(
    controlName: ButtonControl,
    config: ButtonControlOptions
  ): HTMLButtonElement {
    this.logger.log("trace", `Создаем кнопку ${controlName}`);

    const button = document.createElement("button");

    this.updateButton(button, controlName, config);

    return button;
  }

  private updateButton(
    button: HTMLButtonElement,
    controlName: ButtonControl,
    config: ButtonControlOptions
  ) {
    this.logger.log("trace", `Обновляем кнопку ${controlName}`);

    button.className = "video-player__controls__button";
    button.disabled = Boolean(this.disabledButtons[controlName]);

    const image = button.querySelector("img") || document.createElement("img");
    if (!button.contains(image)) {
      button.appendChild(image);
    }

    if (config.binary) {
      const name = controlName as BinaryButtonControl;
      const enabled = Boolean(this.binaryButtonsState?.[name]);
      image.src = enabled
        ? BINARY_BUTTON_ICONS[name].on
        : BINARY_BUTTON_ICONS[name].off;
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
    this.logger.log("trace", `Создаем селект ${name}`);

    const select = document.createElement("select");

    this.updateSelect(select, name, config);

    return select;
  }

  private updateSelect(
    select: HTMLSelectElement,
    name: ControlName,
    config: SelectControlOptions
  ) {
    this.logger.log("trace", `Обновляем селект ${name}`);

    select.innerHTML = "";

    const options: HTMLOptionElement[] = [];

    const defaultOption = document.createElement("option");

    defaultOption.innerText = config.placeholderLabel || "-";
    defaultOption.value = "";
    defaultOption.disabled = true;
    defaultOption.selected = !config.value;

    options.push(defaultOption);

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
    this.logger.log("trace", `Создаем ползунок ${name}`);

    const rangeContainer = document.createElement("div");

    this.updateRange(rangeContainer, name, config);

    return rangeContainer;
  }

  private updateRange(
    rangeContainer: HTMLDivElement,
    name: ControlName,
    config: RangeControlOptions
  ) {
    this.logger.log("trace", `Обновляем ползунок ${name}`);

    const label = rangeContainer.getElementsByTagName("label")[0];
    const input = rangeContainer.getElementsByTagName("input")[0];

    if (label && input) {
      label.innerText = config.getLabel();
      input.value = this.controlValues[name] ?? config.value;
    } else {
      const range = document.createElement("input");
      range.type = "range";
      range.value = this.controlValues[name] ?? config.value;

      for (const event in config.listeners) {
        const eventName = event as keyof ButtonControlOptions["listeners"];
        const listener = config.listeners[eventName];
        if (listener) {
          range.addEventListener(eventName, listener);
        }
      }

      const label = document.createElement("label");
      label.innerText = config.getLabel();

      rangeContainer.innerHTML = "";
      rangeContainer.appendChild(range);
      rangeContainer.appendChild(label);
    }
  }

  public clear() {
    this.logger.log("trace", `Удаляем кнопки управления и очищаем сервис`);

    if (!this.controlsContainer) {
      this.logger.log(
        "trace",
        `Кнопки управления уже отсутствуют, очистка не требуется`
      );
      return;
    }

    this.container.removeChild(this.controlsContainer);
    this.controlsContainer = null;
    this.controls = {};
  }
}
