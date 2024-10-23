import { ConnectionOptions } from "../types/connection-options";

export interface ModeService {
  init(): Promise<void>;
  reset(): Promise<void>;
  setSource(stream: MediaStream): void;

  play?(isContinue?: boolean): void;
  pause?: () => void;
  stop?(): void;

  export?(): void;
  cancelExport?(): void;
  setSpeed?(speed: number): void;

  reinitWithNewOptions?(options: ConnectionOptions): void;
}
