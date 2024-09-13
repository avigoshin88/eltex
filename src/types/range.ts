import { RangeDto } from "../dto/ranges";

export type RangeType = "data" | "break";

export interface RangeData extends RangeDto {
  type: RangeType;
}
