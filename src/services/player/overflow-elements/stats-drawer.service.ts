import { Nullable } from "../../../types/global";
import { Stats } from "../../../types/video";
import { Logger } from "../../logger/logger.service";

export class StatsOverflowDrawerService {
  private logger: Logger;

  private statsContainer: Nullable<HTMLDivElement> = null;
  private bitrate: Nullable<HTMLSpanElement> = null;
  private resolutionWidth: Nullable<HTMLSpanElement> = null;
  private resolutionHeight: Nullable<HTMLSpanElement> = null;
  private videoCodec: Nullable<HTMLSpanElement> = null;
  private audioCodec: Nullable<HTMLSpanElement> = null;
  private frameRate: Nullable<HTMLSpanElement> = null;

  constructor(id: string, private readonly container: HTMLDivElement) {
    this.logger = new Logger(id, "StatsOverflowDrawerService");
  }

  draw(stats: Stats) {
    if (!this.statsContainer) {
      this.createElements(stats);
    } else {
      this.updateElements(stats);
    }
  }

  clear() {
    this.logger.log("trace", "Очищаем сервис отрисовки статистики");

    if (this.statsContainer === null) {
      this.logger.log(
        "trace",
        "Контейнер статистики отсутствует, очистка не требуется"
      );
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

    this.logger.log("trace", "Сервис отрисовки статистики очищен");
  }

  private createElements(stats: Stats) {
    this.logger.log(
      "trace",
      `Создаем контейнер со статистикой, начальная статистика: ${JSON.stringify(
        stats
      )}`
    );

    const statsContainer = document.createElement("div");

    statsContainer.classList.add("video-player__stats__container");

    const { row: bitrateRow, values: bitrateValues } = this.makeRow("Bitrate", [
      String(stats.bitrate),
    ]);
    const { row: resolutionRow, values: resolutionValues } = this.makeRow(
      "Resolution",
      [String(stats.resolution.width), String(stats.resolution.height)]
    );
    const { row: codecsRow, values: codecsValues } = this.makeRow("Codecs", [
      stats.videoCodec,
      stats.audioCodec,
    ]);
    const { row: frameRateRow, values: frameRateValues } = this.makeRow(
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
    this.logger.log("trace", `Обновляем статистику: ${JSON.stringify(stats)}`);

    this.bitrate!.innerText = String(stats.bitrate);
    this.resolutionWidth!.innerText = String(stats.resolution.width);
    this.resolutionHeight!.innerText = String(stats.resolution.height);
    this.videoCodec!.innerText = stats.videoCodec;
    this.audioCodec!.innerText = stats.audioCodec;
    this.frameRate!.innerText = String(stats.frameRate);
  }

  private makeRow(
    label: string,
    values: string[]
  ): {
    row: HTMLDivElement;
    label: HTMLSpanElement;
    values: HTMLSpanElement[];
  } {
    this.logger.log(
      "trace",
      `Создаем строку для отображения данных статистики ${label}`
    );

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

    return { row, label: labelElement, values: valueElements };
  }
}
