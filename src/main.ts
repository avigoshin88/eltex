import { ATTRIBUTE } from "./constants/attributes";
import { CONFIG_KEY } from "./constants/configKeys";
import { API } from "./services/api.service";
import { Env } from "./services/env.service";
import { LiveVideoService } from "./services/live.service";
import { VideoPlayerBuilderService } from "./services/player/player-builder.service";
import { VideoPlayerService } from "./services/player/player.service";

import "./style.css";

class VideoPlayerElement extends HTMLElement {
  constructor() {
    super();
  }

  video!: HTMLVideoElement;
  container!: HTMLDivElement;

  player = new VideoPlayerService();
  builder = new VideoPlayerBuilderService();
  live!: LiveVideoService;

  connectedCallback() {
    this.parseAttributes();
    this.initElement();
    this.live.init();
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
    ];
  }

  attributeChangedCallback(
    name: string,
    oldValue: string,
    newValue: string | undefined
  ) {
    if (
      !(
        [ATTRIBUTE.API_URL, ATTRIBUTE.APP, ATTRIBUTE.STREAM] as string[]
      ).includes(name)
    ) {
      return;
    }

    Env.set(name, newValue ?? oldValue ?? "");

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
  }

  private initElement() {
    const app = this.parseAttribute(ATTRIBUTE.APP);
    const stream = this.parseAttribute(ATTRIBUTE.STREAM);

    if (!app || !stream) throw Error("Атрибуты App и Stream обязательны");

    if (this.container) {
      this.removeChild(this.container);
    }

    const { container, video } = this.builder.createPlayer();

    this.container = container;
    this.video = video;

    this.player.init(this.video);

    this.appendChild(this.container);

    this.live = new LiveVideoService({
      playerElement: this.video,
      app,
      stream,
    });
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
