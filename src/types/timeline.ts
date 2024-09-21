import { RangeData } from "./range";

export type TimelineClickCallback = (
  timestamp: number,
  range: RangeData
) => void;
