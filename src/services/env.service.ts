class EnvService {
  private readonly config = new Map<string, string>();

  set(key: string, value: string) {
    this.config.set(key, value);
  }

  get(key: string) {
    return this.config.get(key);
  }
}

const env = new EnvService();

export { env as Env };
