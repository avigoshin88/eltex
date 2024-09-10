export enum DatachannelMessageType {
  META = "meta",
  GET_RANGES = "get_ranges",
  RANGES = "ranges",
  GET_ARCHIVE_FRAGMENT = "get_archive_fragment",
}

export type DatachannelEventListener = (data?: unknown) => void | Promise<void>;

export type DatachannelEventListeners = Partial<
  Record<DatachannelMessageType, DatachannelEventListener>
>;

export type DatachannelNativeEventListener = (
  event: RTCDataChannelEventMap[keyof RTCDataChannelEventMap]
) => void | Promise<void>;

export type DatachannelNativeEventListeners = Partial<
  Record<
    Exclude<keyof RTCDataChannelEventMap, "message">,
    DatachannelNativeEventListener
  >
>;
