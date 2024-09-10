import { DatachannelMessageType } from "../../types/datachannel-listener";

export class DatachannelTransportBuilderService {
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
