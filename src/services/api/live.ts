import { API } from "../api.service";
import { ConnectionType } from "./common";

/**
 * Ответ на запрос на получение SDP-offer-a
 * @param code Код ошибки
 * - 0 - все успешно
 * @param sdp SDP-offer клиента
 */
type GetSDPOfferResponse = {
  code: number;
  sdp: string;
};

/**
 * Запрос на получение SDP-offer-a (Только для p2p)
 * @param app app потока
 * @param stream stream id потока
 * @returns Promise GetSDPOfferResponse
 */
export const getSDPOffer = async (
  app: string,
  stream: string
): Promise<GetSDPOfferResponse> => {
  return await API.get(`index/api/webrtc?app=${app}&stream=${stream}`);
};

/**
 * Только для P2P (STUN)
 * Запрос на получение SDP-offer-а
 * @param app app потока
 * @param stream stream id потока
 */
export const requestSDPOfferExchangeP2P = async (
  app: string,
  stream: string,
  offer: string
): Promise<never> => {
  return await API.post(
    `index/api/webrtc?app=${app}&stream=${stream}&type=play_analytic`,
    offer
  );
};

export type Candidate = Record<string, string | number>;

/**
 * Только для P2P (STUN)
 * @param app app потока
 * @param stream stream id потока
 * @param type  {@link Connection}
 * @param candidate
 */
export const requestPutCandidate = async (
  app: string,
  stream: string,
  type: ConnectionType,
  candidate: Candidate
): Promise<never> => {
  return await API.put(
    `index/api/webrtc/candidate?app=${app}&stream=${stream}&type=${type}`,
    { app, stream, type, candidate }
  );
};
