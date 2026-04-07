/**
 * VM Remote Control
 * Controls Firecracker VMs and other virtual machines
 */
export class VMController {
    apiBaseUrl;
    authToken;
    constructor(options = {}) {
        this.apiBaseUrl = options.apiBaseUrl || "http://localhost:3000/api/v1";
        this.authToken = options.authToken;
    }
    async list() {
        const response = await fetch(`${this.apiBaseUrl}/vms`, {
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to list VMs: ${response.statusText}`);
        }
        return response.json();
    }
    async get(id) {
        const response = await fetch(`${this.apiBaseUrl}/vms/${id}`, {
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to get VM: ${response.statusText}`);
        }
        return response.json();
    }
    async start(id) {
        const response = await fetch(`${this.apiBaseUrl}/vms/${id}/start`, {
            method: "POST",
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to start VM: ${response.statusText}`);
        }
    }
    async stop(id) {
        const response = await fetch(`${this.apiBaseUrl}/vms/${id}/stop`, {
            method: "POST",
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to stop VM: ${response.statusText}`);
        }
    }
    async restart(id) {
        const response = await fetch(`${this.apiBaseUrl}/vms/${id}/restart`, {
            method: "POST",
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to restart VM: ${response.statusText}`);
        }
    }
    async delete(id) {
        const response = await fetch(`${this.apiBaseUrl}/vms/${id}`, {
            method: "DELETE",
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to delete VM: ${response.statusText}`);
        }
    }
    async logs(id, tail) {
        const url = new URL(`${this.apiBaseUrl}/vms/${id}/logs`);
        if (tail)
            url.searchParams.set("tail", tail.toString());
        const response = await fetch(url.toString(), {
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to get VM logs: ${response.statusText}`);
        }
        return response.text();
    }
    async connect(id, protocol = "ssh") {
        const response = await fetch(`${this.apiBaseUrl}/vms/${id}/connect`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
            },
            body: JSON.stringify({ protocol }),
        });
        if (!response.ok) {
            throw new Error(`Failed to connect to VM: ${response.statusText}`);
        }
        return response.json();
    }
}
export function createVMController(options) {
    return new VMController(options);
}
