/**
 * Cowork Service Manager
 *
 * Manages the lifecycle of Cowork Controller and Mirror Sync services.
 * Auto-starts services when entering Cowork mode.
 */
export interface ServiceStatus {
    running: boolean;
    pid?: number;
    port: number;
    url?: string;
    error?: string;
}
export interface ServiceManagerState {
    controller: ServiceStatus;
    mirrorSync: ServiceStatus;
}
export declare const COWORK_PORTS: {
    readonly CONTROLLER: 3010;
    readonly MIRROR_API: 3001;
};
/**
 * Get local IP address for network sharing
 */
export declare function getLocalIPAddress(): Promise<string | null>;
/**
 * Start Cowork Controller service
 */
export declare function startCoworkController(): Promise<ServiceStatus>;
/**
 * Stop Cowork Controller service
 */
export declare function stopCoworkController(): Promise<void>;
/**
 * Check Mirror API status
 */
export declare function checkMirrorAPI(): Promise<ServiceStatus>;
/**
 * Get service status for both services
 */
export declare function getServiceStatus(): Promise<ServiceManagerState>;
/**
 * Ensure all services are running
 */
export declare function ensureServicesRunning(): Promise<ServiceManagerState>;
/**
 * Stop all services
 */
export declare function stopAllServices(): Promise<void>;
export declare const serviceManager: {
    startCoworkController: typeof startCoworkController;
    stopCoworkController: typeof stopCoworkController;
    checkMirrorAPI: typeof checkMirrorAPI;
    getServiceStatus: typeof getServiceStatus;
    ensureServicesRunning: typeof ensureServicesRunning;
    stopAllServices: typeof stopAllServices;
    getLocalIPAddress: typeof getLocalIPAddress;
    ports: {
        readonly CONTROLLER: 3010;
        readonly MIRROR_API: 3001;
    };
};
export default serviceManager;
//# sourceMappingURL=service-manager.d.ts.map