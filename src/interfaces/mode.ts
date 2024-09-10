export interface ModeService {
  init(): Promise<void>;
  reset(): Promise<void>;
  setSource(stream: MediaStream): void;
}
