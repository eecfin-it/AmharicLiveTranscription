export interface ProPresenterConfig {
    host: string;
    port: number;
    messageId: string;
}
export declare class ProPresenter {
    private host;
    private port;
    private messageId;
    constructor(config: ProPresenterConfig);
    /** Push text into the message's token fields and trigger it on-screen. */
    showText(text: string): Promise<void>;
    /** Clear the message from screen. */
    clearText(): Promise<void>;
    /** Verify connectivity — resolves with version string, rejects on failure. */
    ping(): Promise<string>;
    private buildTokens;
    private request;
}
//# sourceMappingURL=propresenter.d.ts.map