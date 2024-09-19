import { RangeDto } from "../dto/ranges";
import { RangeData } from "../types/range";

export class RangeMapperService {
  calc(ranges: RangeDto[]): RangeData[] {
    const result: RangeData[] = [];

    // Добавляем первый элемент без интервала
    result.push({ ...ranges[0], type: "data" });

    // Заполняем интервалы между элементами
    for (let i = 1; i < ranges.length; i++) {
      const prevRange = result[result.length - 1];
      const currRange = ranges[i];

      // Вычисляем длительность интервала
      const intervalDuration = currRange.start_time - (prevRange.end_time || 0);

      // Если интервал не нулевой, добавляем break
      if (intervalDuration > 0) {
        result.push({
          start_time: prevRange.end_time || 0,
          end_time: (prevRange.end_time || 0) + intervalDuration,
          duration: intervalDuration,
          type: "break",
        });
      }

      // Добавляем текущий элемент
      result.push({ ...currRange, type: "data" });
    }

    return result;
  }
}
