/**
 * ChatStorage - Persistent Chat Session Management
 *
 * Stores chat sessions, messages, and folders in IndexedDB
 * for persistence across browser sessions.
 */

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    audioUrl?: string;
    duration?: number;
    intent?: string;
    capsuleId?: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  folderId: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessage?: string;
}

export interface ChatFolder {
  id: string;
  name: string;
  icon: string;
  order: number;
  createdAt: Date;
}

const DB_NAME = 'a2rchitech_chats';
const DB_VERSION = 1;

class ChatStorageService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB connection
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open ChatStorage database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('ChatStorage initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionsStore.createIndex('folderId', 'folderId', { unique: false });
          sessionsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Create messages store
        if (!db.objectStoreNames.contains('messages')) {
          const messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
          messagesStore.createIndex('sessionId', 'sessionId', { unique: false });
          messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create folders store
        if (!db.objectStoreNames.contains('folders')) {
          const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
          foldersStore.createIndex('order', 'order', { unique: false });
        }

        console.log('ChatStorage database schema created');
      };
    });

    await this.initPromise;

    // Create default folders if they don't exist
    await this.ensureDefaultFolders();
  }

  /**
   * Ensure default folders exist
   */
  private async ensureDefaultFolders(): Promise<void> {
    const folders = await this.getFolders();
    if (folders.length === 0) {
      const defaultFolders: ChatFolder[] = [
        { id: 'all', name: 'All Chats', icon: '💬', order: 0, createdAt: new Date() },
        { id: 'projects', name: 'Projects', icon: '📁', order: 1, createdAt: new Date() },
        { id: 'research', name: 'Research', icon: '🔬', order: 2, createdAt: new Date() },
      ];

      for (const folder of defaultFolders) {
        await this.createFolder(folder);
      }
    }
  }

  // ==================== FOLDERS ====================

  async getFolders(): Promise<ChatFolder[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['folders'], 'readonly');
      const store = transaction.objectStore('folders');
      const request = store.index('order').getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async createFolder(folder: ChatFolder): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['folders'], 'readwrite');
      const store = transaction.objectStore('folders');
      const request = store.put(folder);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFolder(folderId: string): Promise<void> {
    await this.init();

    // Move sessions in this folder to 'all'
    const sessions = await this.getSessionsByFolder(folderId);
    for (const session of sessions) {
      session.folderId = 'all';
      await this.updateSession(session);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['folders'], 'readwrite');
      const store = transaction.objectStore('folders');
      const request = store.delete(folderId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== SESSIONS ====================

  async getSessions(): Promise<ChatSession[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.index('updatedAt').getAll();

      request.onsuccess = () => {
        const sessions = (request.result || []).map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        }));
        // Sort by updatedAt descending
        sessions.sort((a: ChatSession, b: ChatSession) =>
          b.updatedAt.getTime() - a.updatedAt.getTime()
        );
        resolve(sessions);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSessionsByFolder(folderId: string): Promise<ChatSession[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.index('folderId').getAll(folderId);

      request.onsuccess = () => {
        const sessions = (request.result || []).map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        }));
        sessions.sort((a: ChatSession, b: ChatSession) =>
          b.updatedAt.getTime() - a.updatedAt.getTime()
        );
        resolve(sessions);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.get(sessionId);

      request.onsuccess = () => {
        if (request.result) {
          resolve({
            ...request.result,
            createdAt: new Date(request.result.createdAt),
            updatedAt: new Date(request.result.updatedAt),
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async createSession(title: string, folderId: string = 'all'): Promise<ChatSession> {
    await this.init();
    const session: ChatSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      folderId,
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.put(session);

      request.onsuccess = () => resolve(session);
      request.onerror = () => reject(request.error);
    });
  }

  async updateSession(session: ChatSession): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.put({
        ...session,
        updatedAt: new Date(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.init();

    // Delete all messages in the session
    const messages = await this.getMessages(sessionId);
    for (const msg of messages) {
      await this.deleteMessage(msg.id);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.delete(sessionId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== MESSAGES ====================

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const request = store.index('sessionId').getAll(sessionId);

      request.onsuccess = () => {
        const messages = (request.result || []).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        // Sort by timestamp ascending
        messages.sort((a: ChatMessage, b: ChatMessage) =>
          a.timestamp.getTime() - b.timestamp.getTime()
        );
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: ChatMessage['metadata']
  ): Promise<ChatMessage> {
    await this.init();

    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      role,
      content,
      timestamp: new Date(),
      metadata,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages', 'sessions'], 'readwrite');

      // Add message
      const messagesStore = transaction.objectStore('messages');
      messagesStore.put(message);

      // Update session
      const sessionsStore = transaction.objectStore('sessions');
      const sessionRequest = sessionsStore.get(sessionId);

      sessionRequest.onsuccess = () => {
        if (sessionRequest.result) {
          const session = sessionRequest.result;
          session.messageCount = (session.messageCount || 0) + 1;
          session.lastMessage = content.substring(0, 100);
          session.updatedAt = new Date();

          // Auto-generate title from first user message if needed
          if (role === 'user' && (!session.title || session.title === 'New Chat')) {
            session.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
          }

          sessionsStore.put(session);
        }
      };

      transaction.oncomplete = () => resolve(message);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      const request = store.delete(messageId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== SEARCH ====================

  async searchSessions(query: string): Promise<ChatSession[]> {
    const sessions = await this.getSessions();
    const lowerQuery = query.toLowerCase();

    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(lowerQuery) ||
        (s.lastMessage && s.lastMessage.toLowerCase().includes(lowerQuery))
    );
  }

  // ==================== EXPORT/IMPORT ====================

  async exportSession(sessionId: string): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const messages = await this.getMessages(sessionId);
    return { session, messages };
  }

  async importSession(
    data: { session: ChatSession; messages: ChatMessage[] },
    targetFolderId?: string
  ): Promise<ChatSession> {
    const newSession = await this.createSession(
      data.session.title,
      targetFolderId || data.session.folderId
    );

    for (const msg of data.messages) {
      await this.addMessage(newSession.id, msg.role, msg.content, msg.metadata);
    }

    return newSession;
  }
}

// Export singleton instance
export const chatStorage = new ChatStorageService();

// Also export class for testing
export { ChatStorageService };