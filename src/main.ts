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

  modeService!: PlayerModeService;
  private isMounted = false;

  connectedCallback() {
    const id = this.getAttribute(ATTRIBUTE.ID) || "";
    const logLevel = this.getAttribute(ATTRIBUTE.LOG_LEVEL) || "";

    if (!id) throw Error();

    this.logger = new Logger(
      id,
      "VideoPlayer Main Custom Element Service",
      logLevel as LogLevel | undefined
    );
    this.player = new VideoPlayerService(id);

    this.logger.log("info", `Инициализация плеера v${version}`);

    this.initElement();
    this.isMounted = true;
  }

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

  async attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | undefined
  ) {
    if (!this.isMounted) return;

    this.logger?.log(
      "debug",
      `Атрибут ${name} изменен, предыдущее значение "${JSON.stringify(
        oldValue
      )}", новое значение "${JSON.stringify(newValue)}"`
    );

    if (oldValue === newValue) {
      this.logger?.log(
        "trace",
        `Новое значение атрибута ${name} не изменилось, оставляем все как есть`
      );
      return;
    }

    if (name === ATTRIBUTE.LOG_LEVEL) {
      const id = this.getAttribute(ATTRIBUTE.ID);

      id && Logger.setLogLevel(id, newValue as LogLevel);
    } else {
      this.clear();
      this.initElement();
    }
  }

  private initElement() {
    this.logger?.log("debug", `Пробуем инициализировать элемент`);

    if (!this.player) {
      return;
    }

    const id = this.getAttribute(ATTRIBUTE.ID);
    const mode = this.getAttribute(ATTRIBUTE.MODE);
    const cameraName = this.getAttribute(ATTRIBUTE.CAMERA_NAME);
    const iceServersRaw = this.getAttribute(ATTRIBUTE.ICE_SERVERS);

    if (
      id === null ||
      mode === null ||
      cameraName === null ||
      iceServersRaw === null
    ) {
      const requiredAttributes = { id, mode, cameraName, iceServersRaw };

      this.logger?.error(
        "info",
        `Не хватает следующих атрибутов: ${Object.keys(requiredAttributes)
          .filter(
            (item) =>
              !requiredAttributes[item as keyof typeof requiredAttributes]
          )
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
    await this.modeService.reset();
    this.logger?.log("trace", "Сервис очищен");
  }
}

customElements.define("video-player", VideoPlayerElement);

declare global {
  interface HTMLElementTagNameMap {
    "video-player": VideoPlayerElement;
  }
}
