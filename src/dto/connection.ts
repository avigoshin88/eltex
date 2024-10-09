/**
 * Ответ на запрос на получение SDP-offer-a
 * @param code Код ошибки
 * - 0 - все успешно
 * @param sdp SDP-offer клиента
 */
export type GetSDPOfferResponse = {
  code: number;
  sdp: string;
};

export type Candidate = Record<string, string | number>;

/**
 * Тип клиента
 * - p2p - клиент, который транслирует видео по p2p
 * - p2p_play - клиент, который смотрит по p2p
 * - push - клиент, который транслирует видео через сервер
 * - play - клиент, который смотрит через сервер
 * - archive - клиент, который смотрит запись из архива
 */
export type ConnectionType =
  | "p2p"
  | "p2p_play"
  | "play"
  | "push"
  | "archive"
  | "play_analytic";

export type TURNConnectionType = Exclude<ConnectionType, "p2p" | "p2p_play">;
