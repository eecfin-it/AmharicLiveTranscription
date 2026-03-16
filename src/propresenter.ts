import http from "http";

export interface ProPresenterConfig {
  baseUrl: string;
  messageName: string;
  themeSlideName: string;
}

export class ProPresenter {
  private baseUrl: string;
  private messageName: string;
  private themeSlideName: string;
  private messageId = "";
  private themeId = "";
  private themeName = "";

  constructor(config: ProPresenterConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.messageName = config.messageName;
    this.themeSlideName = config.themeSlideName;
  }

  /* ── public API ──────────────────────────────────────── */

  /**
   * Find an existing message by name, or create one.
   * Then resolve the theme slide by name and apply it.
   * Must be called before showText/clearText.
   */
  async ensureMessage(): Promise<{
    messageId: string;
    messageName: string;
    themeName: string;
    created: boolean;
  }> {
    // 1. Find or create the message
    const body = await this.request("GET", "/v1/messages");
    const messages: any[] = body ? JSON.parse(body) : [];
    const existing = messages.find(
      (m: any) => m.id?.name === this.messageName
    );

    let created = false;
    if (existing) {
      this.messageId = existing.id.uuid;
      this.themeId = existing.theme?.uuid ?? "";
      this.themeName = existing.theme?.name ?? "";
    } else {
      const createdBody = await this.request("POST", "/v1/messages", {
        id: { name: this.messageName },
        message: "",
        tokens: [],
        theme: { name: "", uuid: "" },
      });
      if (!createdBody) {
        throw new Error(
          "ProPresenter returned empty response when creating message"
        );
      }
      const msg = JSON.parse(createdBody);
      this.messageId = msg.id.uuid;
      this.themeId = msg.theme?.uuid ?? "";
      this.themeName = msg.theme?.name ?? "";
      created = true;
    }

    // 2. Resolve and apply theme slide if configured
    if (this.themeSlideName) {
      const slide = await this.findThemeSlide(this.themeSlideName);
      if (slide) {
        this.themeId = slide.uuid;
        this.themeName = slide.name;
        // Apply theme to message
        await this.request("PUT", `/v1/message/${this.messageId}`, {
          id: { name: this.messageName, uuid: this.messageId },
          message: "",
          tokens: [],
          theme: { name: this.themeName, uuid: this.themeId },
        });
      }
    }

    return {
      messageId: this.messageId,
      messageName: this.messageName,
      themeName: this.themeName,
      created,
    };
  }

  /** Update message text and trigger it on the main/stream output. */
  async showText(text: string): Promise<void> {
    await this.request("PUT", `/v1/message/${this.messageId}`, {
      id: { name: this.messageName, uuid: this.messageId },
      message: text,
      tokens: [],
      theme: { name: this.themeName, uuid: this.themeId },
    });
    await this.request(
      "POST",
      `/v1/message/${this.messageId}/trigger`,
      []
    );
  }

  /** Clear the message from screen. */
  async clearText(): Promise<void> {
    await this.request("GET", `/v1/message/${this.messageId}/clear`);
  }

  /** Verify connectivity — resolves with version string, rejects on failure. */
  async ping(): Promise<string> {
    const body = await this.request("GET", "/version");
    return body;
  }

  /* ── internals ───────────────────────────────────────── */

  /**
   * Search all themes for a slide matching the given name.
   * Returns { uuid, name } or null if not found.
   */
  private async findThemeSlide(
    slideName: string
  ): Promise<{ uuid: string; name: string } | null> {
    const body = await this.request("GET", "/v1/themes");
    if (!body) return null;
    const data = JSON.parse(body);
    for (const group of data.groups ?? []) {
      for (const theme of group.themes ?? []) {
        for (const slide of theme.slides ?? []) {
          if (slide.id?.name === slideName) {
            return { uuid: slide.id.uuid, name: slide.id.name };
          }
        }
      }
    }
    return null;
  }

  private request(
    method: string,
    path: string,
    body?: object
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const payload = body ? JSON.stringify(body) : undefined;

      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
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
