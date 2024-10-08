import { ATTRIBUTE } from "./constants/attributes";
import { API } from "./services/api.service";
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
    this.initElement();
  }

  disconnectedCallback() {
    this.clear();
  }

  static get observedAttributes() {
    return [
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
    if (newValue === undefined || oldValue === newValue) {
      return;
    }

    if (oldValue !== null) {
      this.clear();
    }
  }

  private initElement() {
    const apiUrl = this.getAttribute(ATTRIBUTE.API_URL);
    const app = this.getAttribute(ATTRIBUTE.APP);
    const stream = this.getAttribute(ATTRIBUTE.STREAM);
    const iceServersRaw = this.getAttribute(ATTRIBUTE.ICE_SERVERS);

    if (
      apiUrl == null ||
      app == null ||
      stream == null ||
      iceServersRaw == null
    ) {
      return;
    }

    API.init(apiUrl);

    const iceServers = iceServersRaw.split(";").map((urls) => ({
      urls,
    }));

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

  private clear() {
    this.modeService.reset();
    this.player.destroy();
  }
}

customElements.define("video-player", VideoPlayerElement);

declare global {
  interface HTMLElementTagNameMap {
    "video-player": VideoPlayerElement;
  }
}
