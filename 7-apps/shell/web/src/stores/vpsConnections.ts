import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface VPSConnection {
  id: string
  name: string
  host: string
  apiKey: string
  status: 'connected' | 'disconnected' | 'error'
  lastConnected?: string
}

interface VPSStore {
  connections: VPSConnection[]
  activeConnection: VPSConnection | null
  addConnection: (conn: Omit<VPSConnection, 'id'>) => void
  removeConnection: (id: string) => void
  setActiveConnection: (conn: VPSConnection | null) => void
  testConnection: (conn: VPSConnection) => Promise<boolean>
}

export const useVPSStore = create<VPSStore>()(
  persist(
    (set, get) => ({
      connections: [],
      activeConnection: null,

      addConnection: (conn) => {
        const newConn = { ...conn, id: crypto.randomUUID() }
        set((state) => ({
          connections: [...state.connections, newConn]
        }))
      },

      removeConnection: (id) => {
        set((state) => ({
          connections: state.connections.filter(c => c.id !== id),
          activeConnection: state.activeConnection?.id === id
            ? null
            : state.activeConnection
        }))
      },

      setActiveConnection: (conn) => {
        set({ activeConnection: conn })
        if (conn) {
          sessionStorage.setItem('a2r-active-vps', JSON.stringify(conn))
        } else {
          sessionStorage.removeItem('a2r-active-vps')
        }
      },

      testConnection: async (conn) => {
        try {
          const response = await fetch(`${conn.host}/health`, {
            headers: { 'Authorization': `Bearer ${conn.apiKey}` }
          })
          return response.ok
        } catch {
          return false
        }
      }
    }),
    {
      name: 'a2r-vps-connections',
      partialize: (state) => ({ connections: state.connections })
    }
  )
)
