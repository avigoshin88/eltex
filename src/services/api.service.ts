import { CONFIG_KEY } from "../constants/configKeys";
import { Env } from "./env.service";

export class APIService {
  async get<T extends any>(url: string): Promise<T> {
    return this.processResponse(fetch(this.makeURL(url), { method: "GET" }));
  }

  async post<T extends any>(url: string, data?: unknown): Promise<T> {
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
    Env.set(CONFIG_KEY.API, this.processBaseApiUrl(baseUrl));
  }

  private async processResponse(request: Promise<Response>) {
    const response = await request;

    return response.json();
  }

  private makeBody(body: unknown) {
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
    return `${Env.get(CONFIG_KEY.API)}/${url}`;
  }
}

const api = new APIService();
export { api as API };
