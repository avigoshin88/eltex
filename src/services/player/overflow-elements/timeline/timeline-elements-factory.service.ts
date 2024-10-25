import { RangeType } from "../../../../types/range";

export class TimelineElementsFactoryService {
  constructor() {}

  makeScrollContainer(): HTMLDivElement {
    const scrollContainer = document.createElement("div");

    scrollContainer.style.width = "100%";
    scrollContainer.style.overflowX = "auto";

    return scrollContainer;
  }

  makeTimelineContainer(): HTMLDivElement {
    const timelineContainer = document.createElement("div");

    timelineContainer.classList.add("video-player__timeline");

    timelineContainer.style.overflowX = "hidden";
    timelineContainer.style.whiteSpace = "nowrap";

    return timelineContainer;
  }

  makeTrack(): HTMLDivElement {
    const track = document.createElement("div");

    track.id = "track";
    track.classList.add("video-player__timeline__track");

    return track;
  }

  makeRange(
    rangeStartPosition: number,
    rangeWidth: number,
    type: RangeType
  ): HTMLDivElement {
    const rangeBlock = document.createElement("div");

    rangeBlock.classList.add("video-player__timeline__range");
    rangeBlock.style.left = `${rangeStartPosition}px`;
    rangeBlock.style.width = `${rangeWidth}px`;
    rangeBlock.setAttribute("data-range-type", type);

    return rangeBlock;
  }

  makeDivision(position: number, label?: string): HTMLDivElement {
    const division = document.createElement("div");
    division.classList.add("video-player__timeline__period");
    division.style.left = `${position}px`;

    if (label) {
      const timeLabel = document.createElement("span");
      timeLabel.classList.add("video-player__timeline__period__text");
      timeLabel.innerText = label;

      division.classList.add("video-player__timeline__period_with_text");
      division.appendChild(timeLabel);
    }

    return division;
  }

  makeTempLabel(label: string): HTMLSpanElement {
    const tempLabel = document.createElement("span");

    tempLabel.classList.add("video-player__timeline__period__text");
    tempLabel.style.visibility = "hidden";
    tempLabel.style.position = "absolute";
    tempLabel.innerText = label;

    return tempLabel;
  }
}
