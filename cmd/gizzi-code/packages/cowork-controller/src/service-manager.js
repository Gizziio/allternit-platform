/**
 * Cowork Service Manager
 *
 * Manages the lifecycle of Cowork Controller and Mirror Sync services.
 * Auto-starts services when entering Cowork mode.
 */
import { spawn, ChildProcess } from "child_process";
import { Log } from "@/runtime/util/log";
import path from "path";
const log = Log.create({ service: "cowork.service-manager" });
// Port assignments
export const COWORK_PORTS = {
    CONTROLLER: 3010,
    MIRROR_API: 3001,
};
// Service process references
let controllerProcess = null;
let mirrorSyncProcess = null;
/**
 * Check if a port is in use
 */
async function isPortInUse(port) {
    return new Promise((resolve) => {
        const cmd = `lsof -i:${port} 2>/dev/null | grep LISTEN || true`;
        const child = spawn("sh", ["-c", cmd], { stdio: ["ignore", "pipe", "ignore"] });
        let output = "";
        child.stdout?.on("data", (data) => output += data.toString());
        child.on("close", () => resolve(output.length > 0));
        child.on("error", () => resolve(false));
        setTimeout(() => { try {
            child.kill();
        }
        catch { } resolve(false); }, 2000);
    });
}
/**
 * Get local IP address for network sharing
 */
export async function getLocalIPAddress() {
    return new Promise((resolve) => {
        const cmd = "ifconfig | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | head -1";
        const child = spawn("sh", ["-c", cmd], { stdio: ["ignore", "pipe", "ignore"] });
        let output = "";
        child.stdout?.on("data", (data) => output += data.toString().trim());
        child.on("close", () => {
            const ip = output.trim();
            resolve(ip || null);
        });
        child.on("error", () => resolve(null));
        setTimeout(() => resolve(null), 3000);
    });
}
/**
 * Start Cowork Controller service
 */
export async function startCoworkController() {
    // Check if already running
    const alreadyRunning = await isPortInUse(COWORK_PORTS.CONTROLLER);
    if (alreadyRunning) {
        log.info("Cowork Controller already running on port", { port: COWORK_PORTS.CONTROLLER });
        return {
            running: true,
            port: COWORK_PORTS.CONTROLLER,
            url: `http://localhost:${COWORK_PORTS.CONTROLLER}`,
        };
    }
    try {
        // Start the controller
        const controllerPath = path.join(__dirname, "..", "src", "bin", "start.ts");
        controllerProcess = spawn("bun", ["run", controllerPath], {
            detached: true,
            stdio: "ignore",
            env: {
                ...process.env,
                COWORK_CONTROLLER_PORT: String(COWORK_PORTS.CONTROLLER),
            },
        });
        if (!controllerProcess.pid) {
            throw new Error("Failed to spawn Cowork Controller");
        }
        controllerProcess.unref();
        // Wait for it to start
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // Verify it's running
        const isRunning = await isPortInUse(COWORK_PORTS.CONTROLLER);
        if (!isRunning) {
            throw new Error("Cowork Controller failed to start");
        }
        log.info("Cowork Controller started", { pid: controllerProcess.pid, port: COWORK_PORTS.CONTROLLER });
        return {
            running: true,
            pid: controllerProcess.pid,
            port: COWORK_PORTS.CONTROLLER,
            url: `http://localhost:${COWORK_PORTS.CONTROLLER}`,
        };
    }
    catch (error) {
        log.error("Failed to start Cowork Controller", { error });
        return {
            running: false,
            port: COWORK_PORTS.CONTROLLER,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
/**
 * Stop Cowork Controller service
 */
export async function stopCoworkController() {
    if (controllerProcess) {
        try {
            process.kill(-controllerProcess.pid, "SIGTERM");
            log.info("Cowork Controller stopped", { pid: controllerProcess.pid });
        }
        catch (error) {
            log.error("Failed to stop Cowork Controller", { error });
        }
        controllerProcess = null;
    }
    // Kill any process on the port
    try {
        spawn("sh", ["-c", `lsof -ti:${COWORK_PORTS.CONTROLLER} | xargs kill -9 2>/dev/null || true`], {
            stdio: "ignore",
        });
    }
    catch { }
}
/**
 * Check Mirror API status
 */
export async function checkMirrorAPI() {
    const isRunning = await isPortInUse(COWORK_PORTS.MIRROR_API);
    if (isRunning) {
        return {
            running: true,
            port: COWORK_PORTS.MIRROR_API,
            url: `http://localhost:${COWORK_PORTS.MIRROR_API}`,
        };
    }
    return {
        running: false,
        port: COWORK_PORTS.MIRROR_API,
        error: "Mirror API not running",
    };
}
/**
 * Get service status for both services
 */
export async function getServiceStatus() {
    const [controller, mirrorSync] = await Promise.all([
        (async () => {
            const running = await isPortInUse(COWORK_PORTS.CONTROLLER);
            return {
                running,
                port: COWORK_PORTS.CONTROLLER,
                url: running ? `http://localhost:${COWORK_PORTS.CONTROLLER}` : undefined,
            };
        })(),
        checkMirrorAPI(),
    ]);
    return { controller, mirrorSync };
}
/**
 * Ensure all services are running
 */
export async function ensureServicesRunning() {
    log.info("Ensuring Cowork services are running...");
    // Start controller if needed
    const controllerStatus = await startCoworkController();
    // Check mirror API (external service)
    const mirrorStatus = await checkMirrorAPI();
    const state = {
        controller: controllerStatus,
        mirrorSync: mirrorStatus,
    };
    if (controllerStatus.running) {
        log.info("Cowork Controller ready", { url: controllerStatus.url });
    }
    else {
        log.error("Cowork Controller failed to start", { error: controllerStatus.error });
    }
    return state;
}
/**
 * Stop all services
 */
export async function stopAllServices() {
    await stopCoworkController();
    log.info("All Cowork services stopped");
}
// Export singleton
export const serviceManager = {
    startCoworkController,
    stopCoworkController,
    checkMirrorAPI,
    getServiceStatus,
    ensureServicesRunning,
    stopAllServices,
    getLocalIPAddress,
    ports: COWORK_PORTS,
};
export default serviceManager;
