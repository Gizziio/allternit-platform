import fetch from 'node-fetch';

export interface ReplayRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
}

export class NetworkReplayer {
  async replay(request: ReplayRequest) {
    console.log('[Replayer] Executing Network Replay: ' + request.url);
    
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body ? JSON.stringify(request.body) : undefined
    });

    if (!response.ok) {
      throw new Error('Replay failed: ' + response.statusText);
    }

    return await response.json();
  }
}
