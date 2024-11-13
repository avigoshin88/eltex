import { RangeData } from "../../../../types/range";

export class TimelineMathService {
  public ranges: RangeData[] = [];

  constructor() {}

  public setRanges(ranges: RangeData[]) {
    this.ranges = ranges;
  }

  public get startTimestamp(): number {
    return this.ranges[0]?.start_time ?? 0;
  }

  public get endTimestamp(): number {
    return this.ranges[this.ranges.length - 1]?.end_time ?? 0;
  }

  public get duration(): number {
    return this.endTimestamp - this.startTimestamp;
  }

  public findNextDataRange(timestamp: number): RangeData | null {
    // Ищем следующий диапазон с типом "data" после указанного времени
    for (const range of this.ranges) {
      if (range.start_time > timestamp && range.type === "data") {
        return range;
      }
    }
    return null; // Если не найден диапазон
  }

  public findRangeByTimestamp(timestamp: number): RangeData | null {
    // Находим диапазон, который включает timestamp
    for (const range of this.ranges) {
      if (timestamp >= range.start_time && timestamp <= range.end_time) {
        return range;
      }
    }
    return null; // Если не найден диапазон
  }
}
