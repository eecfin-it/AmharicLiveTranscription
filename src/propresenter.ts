import http from "http";

export interface ProPresenterConfig {
  host: string;
  port: number;
  messageId: string;
}

export class ProPresenter {
  private host: string;
  private port: number;
  private messageId: string;

  constructor(config: ProPresenterConfig) {
    this.host = config.host;
    this.port = config.port;
    this.messageId = config.messageId;
  }

  /* ── public API ──────────────────────────────────────── */

  /** Push text into the message's token fields and trigger it on-screen. */
  async showText(text: string): Promise<void> {
    const tokens = this.buildTokens(text);
    await this.request("PUT", `/v1/message/${this.messageId}/tokens`, tokens);
    await this.request("PUT", `/v1/message/${this.messageId}/trigger`);
  }

  /** Clear the message from screen. */
  async clearText(): Promise<void> {
    await this.request("DELETE", `/v1/message/${this.messageId}/trigger`);
  }

  /** Verify connectivity — resolves with version string, rejects on failure. */
  async ping(): Promise<string> {
    const body = await this.request("GET", "/v1/version");
    return body;
  }

  /* ── internals ───────────────────────────────────────── */

  private buildTokens(text: string): object {
    // ProPresenter message tokens: array of token objects with name "Text"
    // and a value containing text with colour information.
    return [
      {
        name: "Text",
        text: {
          text,
          color: { red: 1, green: 1, blue: 1, alpha: 1 }, // white
        },
      },
    ];
  }

  private request(
    method: string,
    path: string,
    body?: object
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : undefined;

      const options: http.RequestOptions = {
        hostname: this.host,
        port: this.port,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
        timeout: 3000,
      };

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(
              new Error(
                `ProPresenter ${method} ${path} → ${res.statusCode}: ${data}`
              )
            );
          }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`ProPresenter ${method} ${path} timed out`));
      });

      if (payload) req.write(payload);
      req.end();
    });
  }
}
