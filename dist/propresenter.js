"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProPresenter = void 0;
const http_1 = __importDefault(require("http"));
class ProPresenter {
    constructor(config) {
        this.host = config.host;
        this.port = config.port;
        this.messageId = config.messageId;
    }
    /* ── public API ──────────────────────────────────────── */
    /** Push text into the message's token fields and trigger it on-screen. */
    async showText(text) {
        const tokens = this.buildTokens(text);
        await this.request("PUT", `/v1/message/${this.messageId}/tokens`, tokens);
        await this.request("PUT", `/v1/message/${this.messageId}/trigger`);
    }
    /** Clear the message from screen. */
    async clearText() {
        await this.request("DELETE", `/v1/message/${this.messageId}/trigger`);
    }
    /** Verify connectivity — resolves with version string, rejects on failure. */
    async ping() {
        const body = await this.request("GET", "/v1/version");
        return body;
    }
    /* ── internals ───────────────────────────────────────── */
    buildTokens(text) {
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
    request(method, path, body) {
        return new Promise((resolve, reject) => {
            const payload = body ? JSON.stringify(body) : undefined;
            const options = {
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
            const req = http_1.default.request(options, (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    }
                    else {
                        reject(new Error(`ProPresenter ${method} ${path} → ${res.statusCode}: ${data}`));
                    }
                });
            });
            req.on("error", reject);
            req.on("timeout", () => {
                req.destroy();
                reject(new Error(`ProPresenter ${method} ${path} timed out`));
            });
            if (payload)
                req.write(payload);
            req.end();
        });
    }
}
exports.ProPresenter = ProPresenter;
//# sourceMappingURL=propresenter.js.map