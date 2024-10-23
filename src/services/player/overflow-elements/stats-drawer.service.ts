import { Nullable } from "../../../types/global";
import { Stats } from "../../../types/video";

export class StatsOverflowDrawerService {
  private readonly container!: HTMLDivElement;

  private statsContainer: Nullable<HTMLDivElement> = null;
  private bitrate: Nullable<HTMLSpanElement> = null;
  private resolutionWidth: Nullable<HTMLSpanElement> = null;
  private resolutionHeight: Nullable<HTMLSpanElement> = null;
  private videoCodec: Nullable<HTMLSpanElement> = null;
  private audioCodec: Nullable<HTMLSpanElement> = null;
  private frameRate: Nullable<HTMLSpanElement> = null;

  constructor(container: HTMLDivElement) {
    this.container = container;
  }

  draw(stats: Stats) {
    if (!this.statsContainer) {
      this.createElements(stats);
    } else {
      this.updateElements(stats);
    }
  }

  clear() {
    if (this.statsContainer === null) {
      return;
    }

    this.container.removeChild(this.statsContainer);

    this.statsContainer = null;

    this.bitrate = null;
    this.resolutionWidth = null;
    this.resolutionHeight = null;
    this.videoCodec = null;
    this.audioCodec = null;
    this.frameRate = null;
  }

  private createElements(stats: Stats) {
    const statsContainer = document.createElement("div");

    statsContainer.classList.add("video-player__stats__container");

    const [bitrateRow, bitrateLabel, bitrateValues] = this.makeRow("Bitrate", [
      String(stats.bitrate),
    ]);
    const [resolutionRow, resolutionLabel, resolutionValues] = this.makeRow(
      "Resolution",
      [String(stats.resolution.width), String(stats.resolution.height)]
    );
    const [codecsRow, codecsLabel, codecsValues] = this.makeRow("Codecs", [
      stats.videoCodec,
      stats.audioCodec,
    ]);
    const [frameRateRow, frameRateLabel, frameRateValues] = this.makeRow(
      "Frame rate",
      [String(stats.frameRate)]
    );

    this.bitrate = bitrateValues[0];
    this.resolutionWidth = resolutionValues[0];
    this.resolutionHeight = resolutionValues[1];
    this.videoCodec = codecsValues[0];
    this.audioCodec = codecsValues[1];
    this.frameRate = frameRateValues[0];

    statsContainer.append(bitrateRow, resolutionRow, codecsRow, frameRateRow);

    this.statsContainer = statsContainer;

    this.container.append(statsContainer);
  }

  private updateElements(stats: Stats) {
    this.bitrate!.innerText = String(stats.bitrate);
    this.resolutionWidth!.innerText = String(stats.resolution.width);
    this.resolutionHeight!.innerText = String(stats.resolution.height);
    this.videoCodec!.innerText = stats.videoCodec;
    this.audioCodec!.innerText = stats.audioCodec;
    this.frameRate!.innerText = String(stats.frameRate);
  }

  private makeRow(
    label: string,
    values: string[],
    valueSeparator = " / "
  ): [row: HTMLDivElement, label: HTMLSpanElement, values: HTMLSpanElement[]] {
    const row = document.createElement("div");

    row.classList.add("video-player__stats__row");

    const labelElement = document.createElement("span");

    labelElement.classList.add(
      "video-player__stats__text",
      "video-player__stats__text-label"
    );
    labelElement.innerText = label;

    const valuesContainer = document.createElement("div");

    valuesContainer.classList.add("video-player__stats__row__values");

    const valueElements: HTMLSpanElement[] = values.map((value) => {
      const valueElement = document.createElement("span");

      valueElement.classList.add(
        "video-player__stats__text",
        "video-player__stats__text-value"
      );
      valueElement.innerText = value;

      return valueElement;
    });

    valuesContainer.append(...valueElements);

    row.append(labelElement, valuesContainer);

    return [row, labelElement, valueElements];
  }
}
