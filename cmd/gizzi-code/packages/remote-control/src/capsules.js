/**
 * Capsule Remote Control
 * Controls Allternit capsules (containerized agents)
 */
export class CapsuleController {
    apiBaseUrl;
    authToken;
    constructor(options = {}) {
        this.apiBaseUrl = options.apiBaseUrl || "http://localhost:3000/api/v1";
        this.authToken = options.authToken;
    }
    async list() {
        const response = await fetch(`${this.apiBaseUrl}/capsules`, {
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to list capsules: ${response.statusText}`);
        }
        return response.json();
    }
    async get(id) {
        const response = await fetch(`${this.apiBaseUrl}/capsules/${id}`, {
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to get capsule: ${response.statusText}`);
        }
        return response.json();
    }
    async start(id) {
        const response = await fetch(`${this.apiBaseUrl}/capsules/${id}/start`, {
            method: "POST",
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to start capsule: ${response.statusText}`);
        }
    }
    async stop(id) {
        const response = await fetch(`${this.apiBaseUrl}/capsules/${id}/stop`, {
            method: "POST",
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to stop capsule: ${response.statusText}`);
        }
    }
    async restart(id) {
        const response = await fetch(`${this.apiBaseUrl}/capsules/${id}/restart`, {
            method: "POST",
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to restart capsule: ${response.statusText}`);
        }
    }
    async delete(id) {
        const response = await fetch(`${this.apiBaseUrl}/capsules/${id}`, {
            method: "DELETE",
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to delete capsule: ${response.statusText}`);
        }
    }
    async logs(id, tail) {
        const url = new URL(`${this.apiBaseUrl}/capsules/${id}/logs`);
        if (tail)
            url.searchParams.set("tail", tail.toString());
        const response = await fetch(url.toString(), {
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to get capsule logs: ${response.statusText}`);
        }
        return response.text();
    }
    async exec(id, command) {
        const response = await fetch(`${this.apiBaseUrl}/capsules/${id}/exec`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
            },
            body: JSON.stringify({ command }),
        });
        if (!response.ok) {
            throw new Error(`Failed to exec in capsule: ${response.statusText}`);
        }
        return response.json();
    }
}
export function createCapsuleController(options) {
    return new CapsuleController(options);
}
