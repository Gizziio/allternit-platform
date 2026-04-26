/**
 * Plugin Remote Control
 * Controls Allternit plugins
 */
export class PluginController {
    apiBaseUrl;
    authToken;
    constructor(options = {}) {
        this.apiBaseUrl = options.apiBaseUrl || "http://localhost:3000/api/v1";
        this.authToken = options.authToken;
    }
    async list() {
        const response = await fetch(`${this.apiBaseUrl}/plugins`, {
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to list plugins: ${response.statusText}`);
        }
        return response.json();
    }
    async get(id) {
        const response = await fetch(`${this.apiBaseUrl}/plugins/${id}`, {
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to get plugin: ${response.statusText}`);
        }
        return response.json();
    }
    async install(name, version) {
        const response = await fetch(`${this.apiBaseUrl}/plugins`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
            },
            body: JSON.stringify({ name, version }),
        });
        if (!response.ok) {
            throw new Error(`Failed to install plugin: ${response.statusText}`);
        }
        return response.json();
    }
    async uninstall(id) {
        const response = await fetch(`${this.apiBaseUrl}/plugins/${id}`, {
            method: "DELETE",
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to uninstall plugin: ${response.statusText}`);
        }
    }
    async enable(id) {
        const response = await fetch(`${this.apiBaseUrl}/plugins/${id}/enable`, {
            method: "POST",
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to enable plugin: ${response.statusText}`);
        }
    }
    async disable(id) {
        const response = await fetch(`${this.apiBaseUrl}/plugins/${id}/disable`, {
            method: "POST",
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to disable plugin: ${response.statusText}`);
        }
    }
    async update(id) {
        const response = await fetch(`${this.apiBaseUrl}/plugins/${id}/update`, {
            method: "POST",
            headers: this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`Failed to update plugin: ${response.statusText}`);
        }
        return response.json();
    }
}
export function createPluginController(options) {
    return new PluginController(options);
}
