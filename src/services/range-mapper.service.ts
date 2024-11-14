import { RangeDto } from "../dto/ranges";
import { RangeData } from "../types/range";
import { Logger } from "./logger/logger.service";

export class RangeMapperService {
  private logger: Logger;

  constructor(id: string) {
    this.logger = new Logger(id, "RangeMapperService");
  }

  calc(ranges: RangeDto[]): RangeData[] {
    this.logger.log(
      "trace",
      `Обрабатываем полученные фрагменты архива: ${JSON.stringify(ranges)}`
    );

    const result: RangeData[] = [];

    // Добавляем первый элемент
    result.push({
      ...ranges[0],
      type: "data",
      start_time: ranges[0].start_time,
      end_time: ranges[0].end_time,
      duration: ranges[0].end_time - ranges[0].start_time,
    });

    // Заполняем интервалы между элементами
    for (let i = 1; i < ranges.length; i++) {
      const prevRange = result[result.length - 1];
      const currRange = ranges[i];

      // Вычисляем длительность интервала (между предыдущим концом и текущим началом)
      const intervalDuration = currRange.start_time - prevRange.end_time - 1;

      // Если интервал больше нуля, добавляем break
      if (intervalDuration > 0) {
        result.push({
          start_time: prevRange.end_time + 1,
          end_time: currRange.start_time - 1, // Корректируем конец интервала
          duration: intervalDuration,
          type: "break",
        });
      }

      // Добавляем текущий элемент с корректировкой времени
      result.push({
        ...currRange,
        type: "data",
        start_time: currRange.start_time,
        end_time: currRange.end_time,
        duration: currRange.end_time - currRange.start_time,
      });
    }

    return result;
  }
}
