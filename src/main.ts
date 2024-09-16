import { ATTRIBUTE } from "./constants/attributes";
import { CONFIG_KEY } from "./constants/configKeys";
import { API } from "./services/api.service";
import { Env } from "./services/env.service";
import { VideoPlayerBuilderService } from "./services/player/player-builder.service";
import { VideoPlayerService } from "./services/player/player.service";

import "./style.css";
import { PlayerModeService } from "./services/player/player-mode.service";

class VideoPlayerElement extends HTMLElement {
  constructor() {
    super();
  }

  container!: HTMLDivElement;

  player = new VideoPlayerService();
  builder = new VideoPlayerBuilderService();

  modeService!: PlayerModeService;

  connectedCallback() {
    this.parseAttributes();
    this.initElement();
    // браузер вызывает этот метод при добавлении элемента в документ
    // (может вызываться много раз, если элемент многократно добавляется/удаляется)
  }

  disconnectedCallback() {
    // браузер вызывает этот метод при удалении элемента из документа
    // (может вызываться много раз, если элемент многократно добавляется/удаляется)
  }

  static get observedAttributes() {
    return [
      /* массив имён атрибутов для отслеживания их изменений */
      ATTRIBUTE.API_URL,
      ATTRIBUTE.APP,
      ATTRIBUTE.STREAM,
      ATTRIBUTE.ICE_SERVERS,
    ];
  }

  async attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | undefined
  ) {
    if (oldValue === null || oldValue === newValue) {
      return;
    }

    if (
      !(
        [ATTRIBUTE.API_URL, ATTRIBUTE.APP, ATTRIBUTE.STREAM] as string[]
      ).includes(name)
    ) {
      return;
    }

    Env.set(name, newValue ?? oldValue ?? "");

    await this.modeService.reset();
    this.initElement();
  }

  private parseAttributes() {
    API.init(this.parseAttribute(ATTRIBUTE.API_URL) as string);

    Env.set(CONFIG_KEY.STREAM, this.parseAttribute(ATTRIBUTE.STREAM) as string);
    Env.set(CONFIG_KEY.APP, this.parseAttribute(ATTRIBUTE.APP) as string);
    Env.set(
      CONFIG_KEY.API_URL,
      this.parseAttribute(ATTRIBUTE.API_URL) as string
    );
    Env.set(
      CONFIG_KEY.ICE_SERVERS,
      this.parseAttribute(ATTRIBUTE.ICE_SERVERS) as string
    );
  }

  private initElement() {
    const app = this.parseAttribute(ATTRIBUTE.APP);
    const stream = this.parseAttribute(ATTRIBUTE.STREAM);
    const iceServers = this.parseAttribute(ATTRIBUTE.ICE_SERVERS)
      ?.split(";")
      .map((urls) => ({
        urls,
      }));

    if (!app || !stream) throw Error("Атрибуты App и Stream обязательны");

    if (this.container) {
      this.removeChild(this.container);
    }

    const { container, videoContainer, video } = this.builder.createPlayer();

    this.container = container;

    this.player.init(this.container, videoContainer, video);

    this.appendChild(this.container);

    // TODO: Вынести в отдельный метод
    this.modeService = new PlayerModeService(
      {
        app,
        stream,
        config: {
          iceServers,
        },
      },
      this.player
    );
  }

  private parseAttribute(attribute: string, nullable?: boolean) {
    const value = this.getAttribute(attribute);

    if (!nullable && !value) {
      throw new Error(`Cannot find ${attribute} attribute value`);
    }

    return value;
  }
}

customElements.define("video-player", VideoPlayerElement);

declare global {
  interface HTMLElementTagNameMap {
    "video-player": VideoPlayerElement;
  }
}
