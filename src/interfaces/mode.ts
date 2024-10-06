export interface ModeService {
  init(): Promise<void>;
  reset(): Promise<void>;
  setSource(stream: MediaStream): void;

  play?(isContinue?: boolean): void;
  stop?(): void;

  export?(): void;
  cancelExport?(): void;
  setSpeed?(speed: number): void;
}
