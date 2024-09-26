export interface ModeService {
  init(): Promise<void>;
  reset(): Promise<void>;
  setSource(stream: MediaStream): void;

  play?(): Promise<void>;
  stop?(): Promise<void>;

  export?(): void;
  cancelExport?(): void;
  setSpeed?(speed: number): void;
}
