import { ATTRIBUTE } from "./constants/attributes";
import { CONFIG_KEY } from "./constants/configKeys";
import { Env } from "./services/env.service";
import { VideoPlayerService } from "./services/player.service";

import "./style.css";

class VideoPlayerElement extends HTMLElement {
  constructor() {
    super();
  }

  player = new VideoPlayerService();

  connectedCallback() {
    this.parseAttributes();

    this.player.init();

    // браузер вызывает этот метод при добавлении элемента в документ
    // (может вызываться много раз, если элемент многократно добавляется/удаляется)

    this.innerHTML = `<video></video>`;
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
    this.player.init();
  }

  private parseAttributes() {
    Env.set(CONFIG_KEY.API, this.parseAttribute(ATTRIBUTE.API) as string);
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

(function () {
  customElements.define("video-player", VideoPlayerElement);

  if (import.meta.env.DEV) {
    document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
      <video-player API="123123"/>
    `;
  }
})();
