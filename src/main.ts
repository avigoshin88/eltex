import { ATTRIBUTE } from "./constants/attributes";
import { CONFIG_KEY } from "./constants/configKeys";
import { API } from "./services/api.service";
import { Env } from "./services/env.service";
import { VideoPlayerBuilderService } from "./services/player/player-builder.service";
import { VideoPlayerService } from "./services/player/player.service";

import "./style.css";
import { PlayerModeService } from "./services/player/player-mode.service";
import { PlayerStatsService } from "./services/player/player-stats.service";

class VideoPlayerElement extends HTMLElement {
  constructor() {
    super();
  }

  container!: HTMLDivElement;

  player = new VideoPlayerService();
  builder = new VideoPlayerBuilderService();
  playerStats = new PlayerStatsService();

  modeService!: PlayerModeService;

  connectedCallback() {}

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

    if (
      !(
        [
          ATTRIBUTE.API_URL,
          ATTRIBUTE.APP,
          ATTRIBUTE.STREAM,
          ATTRIBUTE.ICE_SERVERS,
        ] as string[]
      ).includes(name)
    ) {
      return;
    }

    Env.set(name, newValue ?? oldValue);

    if (oldValue !== null) {
      this.clear();
    }
    this.initElement();
  }

  private initElement() {
    const apiUrl = Env.get(CONFIG_KEY.API_URL);
    const app = Env.get(CONFIG_KEY.APP);
    const stream = Env.get(CONFIG_KEY.STREAM);
    const iceServersRaw = Env.get(CONFIG_KEY.ICE_SERVERS);

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
