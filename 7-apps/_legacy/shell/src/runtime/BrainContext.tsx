import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

// Simple hash function for deduplication
function hashCode(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

export type BrainType = 'api' | 'cli' | 'local';

export interface BrainConfig {
    id: string;
    name: string;
    brain_type: BrainType;
    model?: string;
    endpoint?: string;
    api_key_env?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    requirements: any[];
}

export interface BrainProfile {
    config: BrainConfig;
    capabilities: string[];
    cost_tier: number;
    privacy_level: 'local_only' | 'cloud_ok';
}

export interface BrainSession {
    id: string;
    brain_id: string;
    brain_name: string;
    status: 'created' | 'running' | 'exited' | 'error';
    workspace_dir: string;
    created_at: number;
}

export interface BrainSessionState {
    session: BrainSession;
    events: BrainEvent[];
    isStreaming: boolean;
}

export type BrainEvent =
    | { type: 'session.created', payload: { session_id: string }, event_id?: string }
    | { type: 'session.status', payload: { status: string }, event_id?: string }
    | { type: 'chat.delta', payload: { text: string }, event_id?: string }
    | { type: 'chat.message.completed', payload: { text: string }, event_id?: string }
    | { type: 'terminal.delta', payload: { data: string, stream: string }, event_id?: string }
    | { type: 'tool.call', payload: { tool_id: string, call_id: string, args: string }, event_id?: string }
    | { type: 'tool.result', payload: { tool_id: string, call_id: string, result: string }, event_id?: string }
    | { type: 'error', payload: { message: string, code?: string }, event_id?: string }
    | { type: 'integration.profile.registered', payload: { profile_id: string }, event_id?: string }
    | { type: 'integration.pty.initializing', payload: { command: string }, event_id?: string }
    | { type: 'integration.pty.ready', payload: { pid: number }, event_id?: string }
    | { type: 'integration.dispatcher.connected', payload: {}, event_id?: string }
    | { type: 'integration.tools.verified', payload: { count: number }, event_id?: string }
    | { type: 'integration.context.synced', payload: {}, event_id?: string }
    | { type: 'integration.complete', payload: {}, event_id?: string };

interface BrainContextType {
    profiles: BrainProfile[];
    sessions: BrainSessionState[];
    activeSessionId: string | null;
    activeSession: BrainSession | null;
    activeEvents: BrainEvent[];
    isLoading: boolean;
    error: string | null;
    refreshProfiles: () => Promise<void>;
    createSession: (config: BrainConfig) => Promise<BrainSession>;
    setActiveSession: (sessionId: string) => void;
    setActiveSessionId: (sessionId: string | null) => void;
    sendInput: (sessionId: string, input: string) => Promise<void>;
    closeSession: (sessionId: string) => Promise<void>;
    routeBrain: (intent: string, preferredType?: BrainType) => Promise<any>;
}

const BrainContext = createContext<BrainContextType | undefined>(undefined);

export const BrainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [profiles, setProfiles] = useState<BrainProfile[]>([]);
    const [sessions, setSessions] = useState<BrainSessionState[]>([]);
    const [activeSessionIdState, setActiveSessionIdState] = useState<string | null>(null);
    const [activeSession, setActiveSessionState] = useState<BrainSession | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());
    
    // Track processed event IDs to prevent duplicates
    const processedEventsRef = useRef<Map<string, Set<string>>>(new Map());

    // Get active events for current session
    const activeEvents = activeSessionIdState
        ? sessions.find(s => s.session.id === activeSessionIdState)?.events || []
        : [];

    // Expose both names for the active session ID
    const activeSessionId = activeSessionIdState;

    const refreshProfiles = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3004/v1/brain/profiles');
            if (res.ok) {
                setProfiles(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch brain profiles:', err);
        }
    }, []);

    const startStreaming = useCallback((sessionId: string) => {
        // Close existing source for this session if any
        const existing = eventSourcesRef.current.get(sessionId);
        if (existing) {
            existing.close();
        }

        console.log('[BrainContext] Starting SSE stream for session:', sessionId);
        const es = new EventSource(`http://localhost:3004/v1/sessions/${sessionId}/events`);
        eventSourcesRef.current.set(sessionId, es);

        es.onopen = () => {
            console.log('[BrainContext] SSE connected for session:', sessionId);
        };

        es.onmessage = (event) => {
            try {
                const brainEvent: BrainEvent = JSON.parse(event.data);
                console.log('[BrainContext] Event from', sessionId, ':', brainEvent.type);
                
                // Deduplication: generate event ID and check if already processed
                let eventId = brainEvent.event_id;
                if (!eventId) {
                    // Generate event ID from event content
                    const content = JSON.stringify({
                        type: brainEvent.type,
                        payload: brainEvent.payload
                    });
                    eventId = `${sessionId}-${hashCode(content)}`;
                }
                
                // Check if already processed
                let processedEvents = processedEventsRef.current.get(sessionId);
                if (!processedEvents) {
                    processedEvents = new Set();
                    processedEventsRef.current.set(sessionId, processedEvents);
                }
                
                if (processedEvents.has(eventId)) {
                    console.log('[BrainContext] Skipping duplicate event:', brainEvent.type);
                    return;
                }
                processedEvents.add(eventId);
                
                // Limit processed events to prevent memory leaks (keep last 1000)
                if (processedEvents.size > 1000) {
                    const entries = Array.from(processedEvents.entries());
                    entries.slice(0, 500).forEach(([id]) => processedEvents.delete(id));
                }
                
                setSessions(prev => prev.map(s => {
                    if (s.session.id === sessionId) {
                        return { ...s, events: [...s.events, brainEvent] };
                    }
                    return s;
                }));
            } catch (err) {
                console.error('[BrainContext] Failed to parse event:', err);
            }
        };

        es.onerror = (err) => {
            console.log('[BrainContext] SSE error for session:', sessionId);
            // Update session status
            setSessions(prev => prev.map(s => {
                if (s.session.id === sessionId) {
                    return { ...s, isStreaming: false };
                }
                return s;
            }));
        };
    }, []);

    const createSession = useCallback(async (config: BrainConfig) => {
        setIsLoading(true);
        try {
            const res = await fetch('http://localhost:3004/v1/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config }),
            });
            if (!res.ok) throw new Error('Failed to create session');
            
            const session: BrainSession = await res.json();
            console.log('[BrainContext] Created session:', session.id, 'brain:', session.brain_id);
            
            const newSessionState: BrainSessionState = {
                session,
                events: [],
                isStreaming: true,
            };
            
            setSessions(prev => [...prev, newSessionState]);
            setActiveSessionIdState(session.id);
            setActiveSessionState(session);
            startStreaming(session.id);
            
            return session;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [startStreaming]);

    const switchToSession = useCallback((sessionId: string) => {
        console.log('[BrainContext] Switching to session:', sessionId);
        setActiveSessionIdState(sessionId);

        // Restart streaming if not active
        const session = sessions.find(s => s.session.id === sessionId);
        if (session && !session.isStreaming) {
            startStreaming(sessionId);
            setSessions(prev => prev.map(s => {
                if (s.session.id === sessionId) {
                    return { ...s, isStreaming: true };
                }
                return s;
            }));
        }
        
        // Update active session object
        const sessionObj = sessions.find(s => s.session.id === sessionId)?.session || null;
        setActiveSessionState(sessionObj);
    }, [sessions, startStreaming]);

    const setActiveSessionIdHandler = useCallback((sessionId: string | null) => {
        if (sessionId === null) {
            console.log('[BrainContext] Clearing active session');
            setActiveSessionIdState(null);
            setActiveSessionState(null);
            return;
        }
        switchToSession(sessionId);
    }, [switchToSession]);

    const sendInput = useCallback(async (sessionId: string, input: string) => {
        console.log('[BrainContext] Sending input to', sessionId, ':', input.substring(0, 50));
        try {
            await fetch(`http://localhost:3004/v1/sessions/${sessionId}/input`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            });
        } catch (err) {
            console.error('[BrainContext] Failed to send input:', err);
        }
    }, []);

    const closeSession = useCallback(async (sessionId: string) => {
        console.log('[BrainContext] Closing session:', sessionId);

        // Close event source
        const es = eventSourcesRef.current.get(sessionId);
        if (es) {
            es.close();
            eventSourcesRef.current.delete(sessionId);
        }

        // Remove from state
        setSessions(prev => prev.filter(s => s.session.id !== sessionId));

        // If this was active session, switch to another or null
        if (activeSessionIdState === sessionId) {
            const remaining = sessions.filter(s => s.session.id !== sessionId);
            setActiveSessionIdState(remaining.length > 0 ? remaining[0].session.id : null);
        }
    }, [activeSessionIdState, sessions]);

    const routeBrain = useCallback(async (intent: string, preferredType?: BrainType) => {
        try {
            const res = await fetch('http://localhost:3004/v1/brain/route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intent, preferred_type: preferredType }),
            });
            if (res.ok) return await res.json();
        } catch (err) {
            console.error('Failed to route brain:', err);
        }
        return null;
    }, []);

    useEffect(() => {
        refreshProfiles();
        return () => {
            eventSourcesRef.current.forEach(es => es.close());
            eventSourcesRef.current.clear();
        };
    }, [refreshProfiles]);

    return (
        <BrainContext.Provider value={{
            profiles,
            sessions,
            activeSessionId,
            activeSession,
            activeEvents,
            isLoading,
            error,
            refreshProfiles,
            createSession,
            setActiveSession: switchToSession,
            setActiveSessionId: setActiveSessionIdHandler,
            sendInput,
            closeSession,
            routeBrain,
        }}>
            {children}
        </BrainContext.Provider>
    );
};

export const useBrain = () => {
    const context = useContext(BrainContext);
    if (context === undefined) {
        throw new Error('useBrain must be used within a BrainProvider');
    }
    return context;
};
