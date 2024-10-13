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
