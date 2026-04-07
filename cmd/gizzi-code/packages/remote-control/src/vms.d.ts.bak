/**
 * VM Remote Control
 * Controls Firecracker VMs and other virtual machines
 */
import type { VM, RemoteControlOptions } from "./types";
export declare class VMController {
    private apiBaseUrl;
    private authToken?;
    constructor(options?: RemoteControlOptions);
    list(): Promise<VM[]>;
    get(id: string): Promise<VM>;
    start(id: string): Promise<void>;
    stop(id: string): Promise<void>;
    restart(id: string): Promise<void>;
    delete(id: string): Promise<void>;
    logs(id: string, tail?: number): Promise<string>;
    connect(id: string, protocol?: "ssh" | "vnc" | "serial"): Promise<{
        url: string;
        token?: string;
    }>;
}
export declare function createVMController(options?: RemoteControlOptions): VMController;
//# sourceMappingURL=vms.d.ts.map