import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach } from "vitest"

const state = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  listenMock: vi.fn(),
  setWindowSizeMock: vi.fn(),
  currentMonitorMock: vi.fn(),
  getVersionMock: vi.fn(),
  resolveResourceMock: vi.fn(),
  setTrayIconMock: vi.fn(),
  setTrayIconAsTemplateMock: vi.fn(),
  startBatchMock: vi.fn(),
  savePluginSettingsMock: vi.fn(),
  loadPluginSettingsMock: vi.fn(),
  loadAutoUpdateIntervalMock: vi.fn(),
  saveAutoUpdateIntervalMock: vi.fn(),
  loadThemeModeMock: vi.fn(),
  saveThemeModeMock: vi.fn(),
  loadDisplayModeMock: vi.fn(),
  saveDisplayModeMock: vi.fn(),
  loadTrayIconStyleMock: vi.fn(),
  saveTrayIconStyleMock: vi.fn(),
  loadTrayShowPercentageMock: vi.fn(),
  saveTrayShowPercentageMock: vi.fn(),
  renderTrayBarsIconMock: vi.fn(),
  probeHandlers: null as null | { onResult: (output: any) => void; onBatchComplete: () => void },
}))

const dndState = vi.hoisted(() => ({
  latestOnDragEnd: null as null | ((event: any) => void),
}))

const updaterState = vi.hoisted(() => ({
  checkMock: vi.fn(async () => null),
  relaunchMock: vi.fn(async () => undefined),
}))

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children, onDragEnd }: { children: ReactNode; onDragEnd?: (event: any) => void }) => {
    dndState.latestOnDragEnd = onDragEnd ?? null
    return <div>{children}</div>
  },
  closestCenter: vi.fn(),
  PointerSensor: class {},
  KeyboardSensor: class {},
  useSensor: vi.fn((_sensor: any, options?: any) => ({ sensor: _sensor, options })),
  useSensors: vi.fn((...sensors: any[]) => sensors),
}))

vi.mock("@dnd-kit/sortable", () => ({
  arrayMove: (items: any[], from: number, to: number) => {
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
  },
  SortableContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}))

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}))

// Mock the Electron/Tauri shim layer
vi.mock("@/a2r-usage/ui/platform/a2rUsageShim", () => ({
  invoke: state.invokeMock,
  isTauri: () => false,
  listen: state.listenMock,
  getCurrentWindow: () => ({ 
    setSize: (size: { width: number; height: number }) => state.setWindowSizeMock(size.width, size.height)
  }),
  PhysicalSize: class {
    width: number
    height: number
    constructor(width: number, height: number) {
      this.width = width
      this.height = height
    }
  },
  currentMonitor: state.currentMonitorMock,
  getVersion: state.getVersionMock,
  resolveResource: state.resolveResourceMock,
  TrayIcon: class {
    static getById = vi.fn(() => Promise.resolve({
      setIcon: state.setTrayIconMock,
      setIconAsTemplate: state.setTrayIconAsTemplateMock,
    }))
  },
}))

vi.mock("@/a2r-usage/ui/lib/tray-bars-icon", () => ({
  getTrayIconSizePx: () => 36,
  renderTrayBarsIcon: state.renderTrayBarsIconMock,
}))

vi.mock("@/a2r-usage/ui/hooks/use-probe-events", () => ({
  useProbeEvents: (handlers: { onResult: (output: any) => void; onBatchComplete: () => void }) => {
    state.probeHandlers = handlers
    return { startBatch: state.startBatchMock }
  },
}))

vi.mock("@/a2r-usage/ui/hooks/use-app-update", () => ({
  useAppUpdate: () => ({
    updateInfo: null,
    checkForUpdates: vi.fn(),
    installUpdate: vi.fn(),
  }),
}))

vi.mock("@/a2r-usage/ui/lib/settings", async () => {
  const actual = await vi.importActual<typeof import("@/a2r-usage/ui/lib/settings")>("@/a2r-usage/ui/lib/settings")
  return {
    ...actual,
    loadPluginSettings: state.loadPluginSettingsMock,
    savePluginSettings: state.savePluginSettingsMock,
    loadAutoUpdateInterval: state.loadAutoUpdateIntervalMock,
    saveAutoUpdateInterval: state.saveAutoUpdateIntervalMock,
    loadThemeMode: state.loadThemeModeMock,
    saveThemeMode: state.saveThemeModeMock,
    loadDisplayMode: state.loadDisplayModeMock,
    saveDisplayMode: state.saveDisplayModeMock,
    loadTrayIconStyle: state.loadTrayIconStyleMock,
    saveTrayIconStyle: state.saveTrayIconStyleMock,
    loadTrayShowPercentage: state.loadTrayShowPercentageMock,
    saveTrayShowPercentage: state.saveTrayShowPercentageMock,
  }
})

vi.mock("@aptabase/tauri", () => ({
  track: vi.fn(),
}))

// Import after mocks
import App from "@/a2r-usage/ui/App"

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    state.invokeMock.mockResolvedValue(null)
    state.listenMock.mockResolvedValue(() => {})
    state.currentMonitorMock.mockResolvedValue({ size: { width: 1920, height: 1080 } })
    state.getVersionMock.mockResolvedValue("1.0.0-test")
    state.loadPluginSettingsMock.mockResolvedValue([])
    state.loadAutoUpdateIntervalMock.mockResolvedValue(60)
    state.loadThemeModeMock.mockResolvedValue("system")
    state.loadDisplayModeMock.mockResolvedValue("panel")
    state.loadTrayIconStyleMock.mockResolvedValue("bars")
    state.loadTrayShowPercentageMock.mockResolvedValue(true)
    state.renderTrayBarsIconMock.mockReturnValue("mock-icon-data")
  })

  it("renders without crashing", async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/overview/i)).toBeInTheDocument()
    })
  })

  it("loads plugin settings on mount", async () => {
    state.loadPluginSettingsMock.mockResolvedValue([
      { id: "plugin1", name: "Plugin 1", enabled: true },
    ])
    
    render(<App />)
    
    await waitFor(() => {
      expect(state.loadPluginSettingsMock).toHaveBeenCalled()
    })
  })

  it("applies theme mode changes", async () => {
    state.loadThemeModeMock.mockResolvedValue("dark")
    
    render(<App />)
    
    await waitFor(() => {
      expect(state.loadThemeModeMock).toHaveBeenCalled()
    })
  })

  it("starts batch probe on interval", async () => {
    state.loadAutoUpdateIntervalMock.mockResolvedValue(30)
    
    render(<App />)
    
    await waitFor(() => {
      expect(state.startBatchMock).toHaveBeenCalled()
    })
  })
})
