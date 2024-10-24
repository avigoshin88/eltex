export class EnvService {
  static getENV(key: string): string {
    const value = import.meta.env[key];

    if (value === undefined) {
      throw new Error(`Переменная окружения ${key} не определена`);
    }

    return value;
  }

  static getENVAsNumber(key: string): number {
    const value = this.getENV(key);

    const numberValue = Number(value);

    if (isNaN(numberValue)) {
      throw new Error(
        `Переменная окружения ${key} не может быть переведена в число. Текущее значение: ${value}`
      );
    }

    return numberValue;
  }
}
