import { MetaDto } from "../../../../dto/meta";

const svgns = "http://www.w3.org/2000/svg";
const green = "rgb(18, 117, 49)";
const greenWithOpacity = "rgb(18, 117, 49, 0.2)";
const fontSize = 18;
const fontMargin = -4;
const textFilter = `
  <defs>
    <filter x="0" y="0" width="1" height="1" id="solid">
      <feFlood flood-color="${green}" result="bg" />
      <feMerge>
        <feMergeNode in="bg"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
`;

export default class MetaOverflowDrawerService {
  private readonly container!: HTMLDivElement;
  private svg = document.createElementNS(svgns, "svg");

  constructor(container: HTMLDivElement) {
    this.container = container;
  }

  init = () => {
    this.svg.style.position = "absolute";
    this.svg.style.top = "0";
    this.svg.style.left = "0";
    this.svg.style.width = "100%";
    this.svg.style.height = "100%";
    this.svg.style.pointerEvents = "none";
    this.svg.innerHTML = textFilter;

    this.container.appendChild(this.svg);
  };

  clear = () => {
    this.svg.innerHTML = textFilter;
  };

  destroy = () => {
    this.clear();
    this.container.removeChild(this.svg);
  };

  draw = (meta: MetaDto): void => {
    const svgWidth = this.svg.scrollWidth;
    const svgHeight = this.svg.scrollHeight;

    const objects = meta.objects.map((obj) => {
      const g = document.createElementNS(svgns, "g");

      const rect = document.createElementNS(svgns, "rect");
      rect.setAttribute("x", String(obj.x * svgWidth));
      rect.setAttribute("y", String(obj.y * svgHeight));
      rect.setAttribute("width", String(obj.w * svgWidth));
      rect.setAttribute("height", String(obj.h * svgHeight));
      rect.setAttribute("stroke", green);
      rect.setAttribute("stroke-width", "3");
      rect.setAttribute("fill", "none");

      const text = document.createElementNS(svgns, "text");
      text.innerHTML = obj.title;
      text.setAttribute("fill", "white");
      text.setAttribute("x", String(obj.x * svgWidth));
      text.setAttribute("y", String(obj.y * svgHeight + fontMargin));
      text.setAttribute("font-size", String(fontSize));
      text.setAttribute("filter", "url(#solid)");

      g.appendChild(text);
      g.appendChild(rect);

      return g;
    });

    const lines = meta.lines.map((line) => {
      const g = document.createElementNS(svgns, "g");

      const l = document.createElementNS(svgns, "line");

      l.setAttribute("x1", String(line.x1 * svgWidth));
      l.setAttribute("y1", String(line.y1 * svgHeight));
      l.setAttribute("x2", String(line.x2 * svgWidth));
      l.setAttribute("y2", String(line.y2 * svgHeight));
      l.setAttribute("stroke", green);
      l.setAttribute("stroke-width", "3");

      const text = document.createElementNS(svgns, "text");
      text.innerHTML = line.name;
      text.setAttribute("fill", "white");
      text.setAttribute("x", String(line.x1 * svgWidth));
      text.setAttribute("y", String(line.y1 * svgHeight + fontMargin));
      text.setAttribute("font-size", String(fontSize));
      text.setAttribute("filter", "url(#solid)");

      g.appendChild(l);
      g.appendChild(text);

      return g;
    });

    const zones = meta.zones.map((zone) => {
      const g = document.createElementNS(svgns, "g");

      const polygon = document.createElementNS(svgns, "polygon");

      polygon.setAttribute(
        "points",
        zone.points
          .map((point) => `${point.x * svgWidth},${point.y * svgHeight}`)
          .join(" ")
      );
      polygon.setAttribute("fill", greenWithOpacity);
      polygon.setAttribute("stroke", green);
      polygon.setAttribute("stroke-width", "3");

      const text = document.createElementNS(svgns, "text");
      text.innerHTML = zone.name;
      text.setAttribute("fill", "white");
      text.setAttribute("x", String(zone.points[0].x * svgWidth));
      text.setAttribute("y", String(zone.points[0].y * svgHeight + fontMargin));
      text.setAttribute("font-size", String(fontSize));
      text.setAttribute("filter", "url(#solid)");

      g.appendChild(text);
      g.appendChild(polygon);

      return g;
    });

    this.clear();

    this.svg.append(...zones, ...lines, ...objects);
  };
}
