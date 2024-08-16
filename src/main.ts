import { ATTRIBUTE } from "./constants/attributes";
import { CONFIG_KEY } from "./constants/configKeys";
import { API } from "./services/api.service";
import { Env } from "./services/env.service";
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
    ];
  }

  attributeChangedCallback(
    name: string,
    oldValue: string,
    newValue: string | undefined
  ) {
    if (
      !(
        [ATTRIBUTE.API, ATTRIBUTE.CONNECTION, ATTRIBUTE.MODE] as string[]
      ).includes(name)
    ) {
      return;
    }

    Env.set(name, newValue ?? oldValue ?? "");

    this.initElement();
  }

  private initElement() {
    if (this.container) {
      this.removeChild(this.container);
    }

    const { container, video } = this.builder.createPlayer();

    this.container = container;
    this.video = video;

    this.player.init(this.video);

    this.appendChild(this.container);
  }

  private parseAttributes() {
    API.init(this.parseAttribute(ATTRIBUTE.API) as string);
    Env.set(CONFIG_KEY.MODE, this.parseAttribute(ATTRIBUTE.MODE) as string);

    const connection = this.parseAttribute(ATTRIBUTE.CONNECTION, true);

    if (connection) {
      Env.set(CONFIG_KEY.API, connection);
    }
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

if (import.meta.env.DEV) {
  const { VITE_API: API } = import.meta.env;

  document.getElementById(
    "app"
  )!.innerHTML = `<video-player API="${API}" mode="LIVE" connection="STUN"/>`;
}
