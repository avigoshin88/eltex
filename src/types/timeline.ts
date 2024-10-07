import { RangeDto } from "../dto/ranges";
import { RangeData } from "./range";

export type TimelineClickCallback = (
  timestamp: number,
  range: RangeData
) => void;

export type ExportRangeCallback = (range: RangeDto) => void;
