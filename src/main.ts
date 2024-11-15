import { ATTRIBUTE } from "./constants/attributes";
import { VideoPlayerService } from "./services/player/player.service";
import { PlayerModeService } from "./services/player/player-mode.service";
import { Mode } from "./constants/mode";
import { Logger, LogLevel } from "./services/logger/logger.service";
import { version } from "../package.json";
import "./style.css";

class VideoPlayerElement extends HTMLElement {
  constructor() {
    super();
  }

  private logger: Logger | undefined;

  container!: HTMLDivElement;

  player: VideoPlayerService | undefined;

  modeService: PlayerModeService | undefined;
  properties: Partial<Record<ATTRIBUTE, string | null | undefined>> = {};

  connectedCallback() {}

  disconnectedCallback() {
    this.clear();
    this.logger?.log("info", `Работа плеера закончена`);
  }

  static get observedAttributes() {
    return [
      ATTRIBUTE.ID,
      ATTRIBUTE.CAMERA_NAME,
      ATTRIBUTE.MODE,
      ATTRIBUTE.ICE_SERVERS,
      ATTRIBUTE.LOG_LEVEL,
    ];
  }

  private requiredAttrs = [
    ATTRIBUTE.ID,
    ATTRIBUTE.CAMERA_NAME,
    ATTRIBUTE.ICE_SERVERS,
    ATTRIBUTE.MODE,
  ];

  async attributeChangedCallback(
    name: ATTRIBUTE,
    oldValue: string | null,
    newValue: string | undefined
  ) {
    if (name === ATTRIBUTE.ID && !!newValue) {
      if (!this.logger) {
        this.logger = new Logger(
          newValue,
          "VideoPlayer Main Custom Element Service"
        );

        this.logger.log("info", `Инициализация плеера v${version}`);
      }

      if (!this.player) {
        this.player = new VideoPlayerService(newValue);
      }
    }

    this.logger?.log(
      "debug",
      `Атрибут ${name} изменен, предыдущее значение "${JSON.stringify(
        oldValue
      )}", новое значение "${JSON.stringify(newValue)}"`
    );

    if (oldValue === newValue && this.properties[name] === newValue) {
      this.logger?.log("debug", `Атрибут ${name} не изменен`);
      return;
    }

    this.properties[name] = newValue;

    switch (name) {
      case ATTRIBUTE.LOG_LEVEL:
        const id =
          this.properties[ATTRIBUTE.ID] || this.getAttribute(ATTRIBUTE.ID);

        id && Logger.setLogLevel(id, newValue as LogLevel);
        break;
      default:
        if (
          !this.requiredAttrs.filter((item) => !this.properties[item]).length
        ) {
          this.clear();
          this.initElement();
        }
        break;
    }
  }
  private initElement() {
    this.logger?.log("debug", `Пробуем инициализировать элемент`);

    if (!this.player) {
      return;
    }

    const id = this.properties[ATTRIBUTE.ID];
    const mode = this.properties[ATTRIBUTE.MODE];
    const cameraName = this.properties[ATTRIBUTE.CAMERA_NAME];
    const iceServersRaw = this.properties[ATTRIBUTE.ICE_SERVERS];

    if (!id || !mode || !cameraName || !iceServersRaw) {
      this.logger?.error(
        "info",
        `Не хватает следующих атрибутов: ${this.requiredAttrs
          .filter((item) => !this.properties[item])
          .join(", ")}, не удается инициализировать элемент`
      );
      return;
    }

    const iceServers = iceServersRaw.split(";").map((urls) => ({
      urls,
    }));

    if (this.container) {
      this.logger?.log(
        "trace",
        "Элемент уже был инициализирован, убираем старый плеер из DOM"
      );
      this.removeChild(this.container);
    }

    const { container } = this.player.init(cameraName);

    this.container = container;

    this.appendChild(this.container);

    // TODO: Вынести в отдельный метод
    this.modeService = new PlayerModeService(
      id,
      mode as Mode,
      {
        config: {
          iceServers,
        },
      },
      this.player
    );
    this.logger?.log("debug", "Элемент инициализирован");
  }

  private async clear() {
    this.logger?.log("trace", "Запускаем очистку сервиса");
    await this.modeService?.reset();
    this.logger?.log("trace", "Сервис очищен");
  }
}

customElements.define("video-player", VideoPlayerElement);

declare global {
  interface HTMLElementTagNameMap {
    "video-player": VideoPlayerElement;
  }
}
