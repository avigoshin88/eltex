import { Nullable } from "./global";

export enum DatachannelMessageType {
  META = "meta",

  /**
   * Request: GET_RANGES
   *
   * Получить ranges
   */
  GET_RANGES = "get_ranges",

  /**
   * Response: GET_RANGES
   *
   * Получены ranges
   */
  RANGES = "ranges",

  /**
   * Request: GET_ARCHIVE_FRAGMENT
   *
   * Запросить стрим фрагмента
   */
  GET_ARCHIVE_FRAGMENT = "get_archive_fragment",
  /**
   * Response: GET_ARCHIVE_FRAGMENT
   *
   * Стрим фрагмента сохранен
   */
  ARCHIVE_FRAGMENT = "archive_fragment",

  /**
   * Request: GET_KEY
   *
   * Предзагрузка фрагмента
   */
  GET_KEY = "get_key",
  /**
   * Response: GET_KEY
   *
   * Ответ на предзагрузку фрагмента
   */
  KEY_FRAGMENT = "key_fragment",

  /**
   * Request: SET_SPEED
   *
   * Установить скорость воспроизведения
   */
  SET_SPEED = "set_speed",
  /**
   * Response: SET_SPEED
   *
   * Ответ на установку скорости
   */
  SPEED = "speed",

  STOP_STREAM = "stop_stream",

  /**
   * Request: PLAY_STREAM
   *
   * Начать стрим
   */
  PLAY_STREAM = "play_stream",
  /**
   * Request: GET_ARCHIVE_FRAGMENT
   *
   * Ответ на начало стрима
   */
  PLAY = "play",

  /**
   * Request: DROP_BUFFER
   *
   * Сбросить буфер для воспроизведения
   */
  DROP_BUFFER = "drop_buffer",
  /**
   * Response: DROP_BUFFER
   *
   * Буфер сброшен
   */
  DROP = "drop",

  /**
   * Request: GET_EXPORT_FRAGMENT_URL
   *
   * Запросить фрагмент для скачивания
   */
  GET_EXPORT_FRAGMENT_URL = "get_url",
  /**
   * Response: GET_EXPORT_FRAGMENT_URL
   *
   * Фрагмент для скачивания
   */
  URL = "url",

  /**
   * Request: ARCHIVE_CONNECT_SUPPORT
   *
   * Фиктивный запрос на поддержание подключения
   */
  ARCHIVE_CONNECT_SUPPORT = "archive_connect_support",
}

export type DatachannelEventListener<T = any> = (
  data?: Nullable<T>,
  error?: Nullable<string>
) => void | Promise<void>;

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
