import { DatachannelMessageType } from "../../types/datachannel-listener";
import { Logger } from "../logger/logger.service";

export class DatachannelTransportBuilderService {
  private logger: Logger;

  constructor(id: string) {
    this.logger = new Logger(id, "DatachannelTransportBuilderService");
  }

  build(type: DatachannelMessageType, data?: unknown) {
    const transferData: { type: DatachannelMessageType; data?: unknown } = {
      type,
    };
    if (data !== undefined && data !== null) {
      transferData.data = data;
    }

    return JSON.stringify(transferData);
  }
}
