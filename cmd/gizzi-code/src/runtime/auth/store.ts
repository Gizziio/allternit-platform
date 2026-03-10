import { Log } from "@/shared/util/log";
import { Config } from "@/runtime/context/config/config";
import { Credential } from "./credentials";
import { Identifier } from "@/shared/id/id";

export namespace AuthStore {
  const log = Log.create({ service: "auth.store" });

  export async function getCredential(id: string): Promise<Credential | null> {
    const credentials = await listCredentials();
    return credentials.find(c => c.id === id) || null;
  }

  export async function getCredentialsByProvider(provider: string): Promise<Credential[]> {
    const credentials = await listCredentials();
    return credentials.filter(c => c.provider === provider);
  }

  export async function listCredentials(): Promise<Credential[]> {
    const config = await Config.get();
    // Assuming config.auth is a record of credentials by some internal key or list
    return Object.values(config.auth || {}) as Credential[];
  }

  export async function saveCredential(input: Omit<Credential, "id">): Promise<string> {
    const id = Identifier.generate("cred"); // Generate a stable fingerprint
    const credential: Credential = { ...input, id };
    
    log.info("Saving credential", { provider: credential.provider, method: credential.method, id });
    
    // Logic to update config.auth[id] = credential
    return id;
  }
}
