import { OverflowElementDrawer } from "../../../interfaces/overflow-element-builder";

export class ControlsOverflowDrawerService implements OverflowElementDrawer {
  draw(container: HTMLDivElement): void {
    console.log('draw controls')
  }

  setOptions(options: unknown): void {
    throw new Error("Method not implemented.");
  }
}
