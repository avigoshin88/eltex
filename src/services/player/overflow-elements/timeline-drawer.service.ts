import { RangeDto } from "../../../dto/range";
import { OverflowElementDrawer } from "../../../interfaces/overflow-element-builder";

export class TimelineOverflowDrawer implements OverflowElementDrawer {
  draw(container: HTMLDivElement): void {}

  setOptions(ranges: RangeDto[]): void {}
}
