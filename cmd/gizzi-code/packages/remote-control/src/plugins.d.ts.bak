/**
 * Plugin Remote Control
 * Controls A2R plugins
 */
import type { Plugin, RemoteControlOptions } from "./types";
export declare class PluginController {
    private apiBaseUrl;
    private authToken?;
    constructor(options?: RemoteControlOptions);
    list(): Promise<Plugin[]>;
    get(id: string): Promise<Plugin>;
    install(name: string, version?: string): Promise<Plugin>;
    uninstall(id: string): Promise<void>;
    enable(id: string): Promise<void>;
    disable(id: string): Promise<void>;
    update(id: string): Promise<Plugin>;
}
export declare function createPluginController(options?: RemoteControlOptions): PluginController;
//# sourceMappingURL=plugins.d.ts.map