import { CONFIG_KEY } from "../constants/configKeys";
import { Env } from "./env.service";

export class APIService {
  async get<T extends any>(url: string): Promise<T> {
    return this.processResponse(fetch(this.makeURL(url), { method: "GET" }));
  }

  async post<D extends unknown, T extends any>(
    url: string,
    data?: D
  ): Promise<T> {
    return await this.processResponse(
      fetch(this.makeURL(url), {
        method: "POST",
        body: data ? this.makeBody(data) : undefined,
      })
    );
  }

  async put<T extends any>(url: string, data?: unknown): Promise<T> {
    return await this.processResponse(
      fetch(this.makeURL(url), {
        method: "PUT",
        body: data ? this.makeBody(data) : undefined,
      })
    );
  }

  init(baseUrl: string) {
    Env.set(CONFIG_KEY.API_URL, this.processBaseApiUrl(baseUrl));
  }

  private async processResponse(request: Promise<Response>) {
    const response = await request;

    const contentLength = response.headers.get("content-length");

    if (response.status === 204 || contentLength === "0") return;

    return response.json();
  }

  private makeBody<T>(body: T) {
    if (typeof body === "string") {
      return body;
    }

    return JSON.stringify(body);
  }

  private processBaseApiUrl(baseUrl: string) {
    let url = baseUrl;

    if (url.length === 0) {
      throw Error("API is required!");
    }

    if (!url.includes("http") || !url.includes("https")) {
      throw new Error("API protocol is required!");
    }

    return url[url.length - 1] === "/" ? baseUrl.slice(0, -1) : baseUrl;
  }

  private makeURL(url: string) {
    return `${Env.get(CONFIG_KEY.API_URL)}/${url}`;
  }
}

const api = new APIService();
export { api as API };
