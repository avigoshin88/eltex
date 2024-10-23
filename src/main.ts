import { ATTRIBUTE } from "./constants/attributes";
import { VideoPlayerService } from "./services/player/player.service";

import "./style.css";
import { PlayerModeService } from "./services/player/player-mode.service";
import { CustomEvents } from "./services/custom-events.service";
import { Mode } from "./constants/mode";

class VideoPlayerElement extends HTMLElement {
  constructor() {
    super();
  }

  options: Partial<Record<(typeof ATTRIBUTE)[keyof typeof ATTRIBUTE], string>> =
    {};

  container!: HTMLDivElement;

  player = new VideoPlayerService();

  modeService!: PlayerModeService;

  connectedCallback() {
    this.initElement();
  }

  disconnectedCallback() {
    this.clear();
  }

  static get observedAttributes() {
    return [
      ATTRIBUTE.ID,
      ATTRIBUTE.CAMERA_NAME,
      ATTRIBUTE.MODE,
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

    this.options = { ...this.options, [name]: newValue };

    if (oldValue !== null) {
      this.clear();
    }
  }

  private initElement() {
    const id = this.options[ATTRIBUTE.ID];
    const mode = this.options[ATTRIBUTE.MODE];
    const cameraName = this.options[ATTRIBUTE.CAMERA_NAME];
    const iceServersRaw = this.options[ATTRIBUTE.ICE_SERVERS];

    if (
      id == null ||
      mode == null ||
      cameraName == null ||
      iceServersRaw == null
    ) {
      return;
    }

    CustomEvents.setId(id);

    const iceServers = iceServersRaw.split(";").map((urls) => ({
      urls,
    }));

    if (this.container) {
      this.removeChild(this.container);
    }

    const { container } = this.player.init();

    this.container = container;

    this.appendChild(this.container);

    // TODO: Вынести в отдельный метод
    this.modeService = new PlayerModeService(
      mode as Mode,
      {
        config: {
          iceServers,
        },
      },
      this.player
    );
  }

  private async clear() {
    await this.modeService.reset();
  }
}

customElements.define("video-player", VideoPlayerElement);

declare global {
  interface HTMLElementTagNameMap {
    "video-player": VideoPlayerElement;
  }
}
