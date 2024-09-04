export interface OverflowElementDrawer {
  draw(container: HTMLDivElement): void | Promise<void>;
}
