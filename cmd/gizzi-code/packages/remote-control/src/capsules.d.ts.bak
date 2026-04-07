/**
 * Capsule Remote Control
 * Controls A2R capsules (containerized agents)
 */
import type { Capsule, RemoteControlOptions } from "./types";
export declare class CapsuleController {
    private apiBaseUrl;
    private authToken?;
    constructor(options?: RemoteControlOptions);
    list(): Promise<Capsule[]>;
    get(id: string): Promise<Capsule>;
    start(id: string): Promise<void>;
    stop(id: string): Promise<void>;
    restart(id: string): Promise<void>;
    delete(id: string): Promise<void>;
    logs(id: string, tail?: number): Promise<string>;
    exec(id: string, command: string): Promise<{
        stdout: string;
        stderr: string;
        exitCode: number;
    }>;
}
export declare function createCapsuleController(options?: RemoteControlOptions): CapsuleController;
//# sourceMappingURL=capsules.d.ts.map