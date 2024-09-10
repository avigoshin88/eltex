import { RangeDto } from "../../../dto/range";
import { OverflowElementDrawer } from "../../../interfaces/overflow-element-builder";

export class TimelineOverflowDrawer implements OverflowElementDrawer {
  draw(container: HTMLDivElement): void {
    throw new Error("Method not implemented.");
  }

  setOptions(ranges: RangeDto[]): void {
    throw new Error("Method not implemented.");
  }
}
