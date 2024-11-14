import { DatachannelMessageType } from "../../types/datachannel-listener";
import { Logger } from "../logger/logger.service";

export class DatachannelTransportBuilderService {
  private logger: Logger;

  constructor(id: string) {
    this.logger = new Logger(id, "DatachannelTransportBuilderService");
  }

  build(type: DatachannelMessageType, data?: unknown) {
    this.logger.log(
      "trace",
      `Подготавливаем сообщение для datachannel с типом ${type}`
    );
    const transferData: { type: DatachannelMessageType; data?: unknown } = {
      type,
    };
    if (data !== undefined && data !== null) {
      transferData.data = data;
    }

    this.logger.log(
      "trace",
      `Подготовлено сообщение: ${JSON.stringify(transferData)}`
    );

    return JSON.stringify(transferData);
  }
}
