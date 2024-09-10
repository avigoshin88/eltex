import { API } from "../api.service";

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

export type LiveConnectionType = Exclude<
  ConnectionType,
  "p2p" | "push" | "archive"
>;

export type ArchiveConnectionType = Exclude<
  ConnectionType,
  "p2p" | "p2p_play" | "play" | "push"
>;

type RequestSDPOfferExchangeTURNResponse = {
  code: number;
  id?: string;
  sdp?: string;
  type?: RTCSdpType;
  msg?: string;
};

/**
 * Только для TURN
 * Запрос на обмен SDP-offer-ами
 * @param app app потока
 * @param stream stream id потока
 * @returns RequestSDPOfferExchangeTURNResponse
 */
export const requestSDPOfferExchangeTURN = async (
  app: string,
  stream: string,
  type: ConnectionType,
  offer: string
): Promise<RequestSDPOfferExchangeTURNResponse> => {
  return await API.post(
    `index/api/webrtc?app=${app}&stream=${stream}&type=${type}`,
    offer
  );
};
