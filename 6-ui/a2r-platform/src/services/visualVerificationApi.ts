/**
 * Visual Verification API Service
 * 
 * Service for interacting with the visual verification backend.
 * Supports both REST and WebSocket connections for real-time updates.
 */

export type ArtifactType = 
  | 'ui_state' 
  | 'coverage_map' 
  | 'console_output' 
  | 'visual_diff' 
  | 'error_state';

export type VerificationStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Artifact {
  id: string;
  type: ArtifactType;
  confidence: number;
  timestamp: string;
  data: {
    imageUrl?: string;
    textContent?: string;
    jsonData?: unknown;
  };
  metadata: Record<string, unknown>;
  analysis?: {
    issues?: string[];
    warnings?: string[];
    recommendations?: string[];
  };
}

export interface VerificationResult {
  wihId: string;
  status: VerificationStatus;
  overallConfidence: number;
  threshold: number;
  artifacts: Artifact[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface TrendDataPoint {
  timestamp: string;
  confidence: number;
  wihId?: string;
}

export interface VerificationPolicy {
  enabled: boolean;
  providerType: 'file' | 'grpc';
  minVisualConfidence: number;
  requiredEvidenceTypes: ArtifactType[];
  evidenceTimeoutSeconds: number;
  allowBypassWithApproval: boolean;
  bypassApprovers: string[];
}

export interface BatchVerificationRequest {
  wihIds: string[];
  options?: {
    artifactTypes?: ArtifactType[];
    timeout?: number;
  };
}

export interface BatchVerificationResponse {
  results: VerificationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    pending: number;
  };
}

// API Configuration
const API_BASE_URL = process.env.REACT_APP_VERIFICATION_API_URL || '/api/verification';
const WS_URL = process.env.REACT_APP_VERIFICATION_WS_URL || 'ws://localhost:8080/verification';

// HTTP Client
async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// Visual Verification API
export const visualVerificationApi = {
  /**
   * Get verification status for a WIH
   */
  async getStatus(wihId: string): Promise<VerificationResult> {
    return apiClient<VerificationResult>(`/${wihId}`);
  },

  /**
   * Start verification for a WIH
   */
  async startVerification(
    wihId: string,
    options?: { artifactTypes?: ArtifactType[] }
  ): Promise<VerificationResult> {
    return apiClient<VerificationResult>(`/${wihId}/start`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  },

  /**
   * Cancel ongoing verification
   */
  async cancelVerification(wihId: string): Promise<void> {
    await apiClient(`/${wihId}/cancel`, {
      method: 'POST',
    });
  },

  /**
   * Request bypass for a failed verification
   */
  async requestBypass(
    wihId: string,
    reason: string,
    approver?: string
  ): Promise<void> {
    await apiClient(`/${wihId}/bypass`, {
      method: 'POST',
      body: JSON.stringify({ reason, approver }),
    });
  },

  /**
   * Get trend data for confidence history
   */
  async getTrendData(
    wihId: string,
    options?: { days?: number; limit?: number }
  ): Promise<TrendDataPoint[]> {
    const params = new URLSearchParams();
    if (options?.days) params.append('days', String(options.days));
    if (options?.limit) params.append('limit', String(options.limit));
    
    return apiClient<TrendDataPoint[]>(`/${wihId}/trend?${params}`);
  },

  /**
   * Get verification policy
   */
  async getPolicy(): Promise<VerificationPolicy> {
    return apiClient<VerificationPolicy>('/policy');
  },

  /**
   * Update verification policy (requires admin)
   */
  async updatePolicy(policy: Partial<VerificationPolicy>): Promise<VerificationPolicy> {
    return apiClient<VerificationPolicy>('/policy', {
      method: 'PUT',
      body: JSON.stringify(policy),
    });
  },

  /**
   * Start batch verification for multiple WIHs
   */
  async startBatchVerification(
    request: BatchVerificationRequest
  ): Promise<BatchVerificationResponse> {
    return apiClient<BatchVerificationResponse>('/batch', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get batch verification results
   */
  async getBatchResults(batchId: string): Promise<BatchVerificationResponse> {
    return apiClient<BatchVerificationResponse>(`/batch/${batchId}`);
  },

  /**
   * Get artifact data
   */
  async getArtifact(
    wihId: string,
    artifactId: string
  ): Promise<Blob> {
    const response = await fetch(
      `${API_BASE_URL}/${wihId}/artifacts/${artifactId}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch artifact: ${response.statusText}`);
    }
    
    return response.blob();
  },

  /**
   * Get artifact as data URL for preview
   */
  async getArtifactDataUrl(
    wihId: string,
    artifactId: string
  ): Promise<string> {
    const blob = await this.getArtifact(wihId, artifactId);
    return URL.createObjectURL(blob);
  },

  /**
   * Export verification report
   */
  async exportReport(
    wihId: string,
    format: 'json' | 'pdf' | 'html' = 'json'
  ): Promise<Blob> {
    const response = await fetch(
      `${API_BASE_URL}/${wihId}/export?format=${format}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to export report: ${response.statusText}`);
    }
    
    return response.blob();
  },

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; version: string }> {
    return apiClient('/health');
  },
};

// WebSocket Client for real-time updates
export class VerificationWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectInterval = 5000;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private wihId: string | null = null;

  constructor(private url: string = WS_URL) {}

  /**
   * Connect to WebSocket for a specific WIH
   */
  connect(wihId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (this.wihId === wihId) return;
      this.disconnect();
    }

    this.wihId = wihId;
    const wsUrl = `${this.url}/${wihId}`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[VerificationWebSocket] Connected');
      this.reconnectAttempts = 0;
      this.emit('connected', { wihId });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type, data.payload);
      } catch (err) {
        console.error('[VerificationWebSocket] Failed to parse message:', err);
      }
    };

    this.ws.onclose = () => {
      console.log('[VerificationWebSocket] Disconnected');
      this.emit('disconnected', {});
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[VerificationWebSocket] Error:', error);
      this.emit('error', error);
    };
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to an event type
   */
  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error('[VerificationWebSocket] Listener error:', err);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[VerificationWebSocket] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    
    setTimeout(() => {
      if (this.wihId) {
        console.log(`[VerificationWebSocket] Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect(this.wihId);
      }
    }, this.reconnectInterval * this.reconnectAttempts);
  }
}

// React Hook compatible WebSocket
export function useVerificationWebSocket(wihId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown>(null);
  const clientRef = useRef<VerificationWebSocketClient | null>(null);

  useEffect(() => {
    if (!wihId) return;

    clientRef.current = new VerificationWebSocketClient();
    
    const unsubscribeConnected = clientRef.current.on('connected', () => {
      setIsConnected(true);
    });
    
    const unsubscribeDisconnected = clientRef.current.on('disconnected', () => {
      setIsConnected(false);
    });
    
    const unsubscribeMessage = clientRef.current.on('update', (data) => {
      setLastMessage(data);
    });

    clientRef.current.connect(wihId);

    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubscribeMessage();
      clientRef.current?.disconnect();
    };
  }, [wihId]);

  return {
    isConnected,
    lastMessage,
    client: clientRef.current,
  };
}

export default visualVerificationApi;
