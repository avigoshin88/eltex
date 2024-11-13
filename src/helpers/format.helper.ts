import { format } from "date-fns";

export function formatTime(time: number, scale: number): string {
  const date = new Date(time);

  if (scale >= 0.00001) {
    // Малый масштаб: часы, минуты, секунды
    return format(date, "HH:mm:ss");
  } else if (scale >= 0.000001) {
    // Средний масштаб: день, месяц, часы, минуты
    return format(date, "dd.MM HH:mm");
  } else if (scale >= 0.00000001) {
    // Большой масштаб: день, месяц
    return format(date, "dd.MM");
  } else {
    // Очень большой масштаб: год
    return format(date, "yyyy");
  }
}


export function formatPhantomTime(time: number): string {
  const date = new Date(time);
  return format(date, "dd.MM.yyyy HH:mm:ss");
}