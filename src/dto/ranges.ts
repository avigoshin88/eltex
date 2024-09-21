export interface RangeDto {
  start_time: number;
  end_time: number;
  duration: number;
}

// TODO: DEPRECATED
/**
 * DEPRECATED
 */
export enum RangePeriod {
  "week" = "week",
  "day" = "day",
  "16hours" = "16hours",
  "12hours" = "12hours",
  "6hours" = "6hours",
  "1hour" = "1hour",
  "30min" = "30min",
  "10min" = "10min",
  "5min" = "5min",
  "1min" = "1min",
}
