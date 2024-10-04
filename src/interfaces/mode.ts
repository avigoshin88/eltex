import { ConnectionOptions } from "../types/connection-options";

export interface ModeService {
  init(): Promise<void>;
  reset(): Promise<void>;
  setSource(stream: MediaStream): void;

  play?(): void;
  stop?(): void;

  export?(): void;
  cancelExport?(): void;
  setSpeed?(speed: number): void;

  reinitWithNewOptions?(options: ConnectionOptions): void;
}
