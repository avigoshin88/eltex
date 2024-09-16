export interface RangeDto {
  start_time: number;
  end_time: number;
  duration: number;
}

export const RangePeriod = {
  "7days": "7days",
  "1day": "1day",
  "24hours": "24hours",
  "12hours": "12hours",
  "6hours": "6hours",
  "1hour": "1hour",
  "30min": "30min",
  "10min": "10min",
  "5min": "5min",
} as const;
