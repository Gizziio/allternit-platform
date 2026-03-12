/**
 * A2rOS Demo Page
 * 
 * Live demonstration of A2rchitect Super-Agent OS.
 * Shows the Program Dock, Console, and Program Launcher.
 */

"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Monitor, 
  Terminal, 
  LayoutGrid,
  Cpu,
  Zap,
  CheckCircle2,
  ArrowRight,
  Layers,
  Command,
  MessageSquare,
  GitBranch,
  Globe,
  FileText,
  Table,
  FolderOpen,
  Code,
  Presentation,
  Workflow
} from "lucide-react"
import { cn } from "@/lib/utils"

// Program icons mapping
const programIcons: Record<string, React.ReactNode> = {
  researchdoc: <FileText className="w-4 h-4" />,
  datagrid: <Table className="w-4 h-4" />,
  presentation: <Presentation className="w-4 h-4" />,
  codepreview: <Code className="w-4 h-4" />,
  assetmanager: <FolderOpen className="w-4 h-4" />,
  orchestrator: <Cpu className="w-4 h-4" />,
  workflowbuilder: <Workflow className="w-4 h-4" />,
  browserscreenshot: <Globe className="w-4 h-4" />,
}

// Program definitions
const programs = [
  { id: "researchdoc", name: "ResearchDoc", description: "Rich documents with citations & deep research", color: "bg-blue-500" },
  { id: "datagrid", name: "DataGrid", description: "Spreadsheet with formulas & CSV import", color: "bg-green-500" },
  { id: "presentation", name: "Presentation", description: "Slides with presenter notes", color: "bg-orange-500" },
  { id: "codepreview", name: "CodePreview", description: "Multi-file code browser", color: "bg-purple-500" },
  { id: "assetmanager", name: "AssetManager", description: "Image & file management", color: "bg-pink-500" },
  { id: "orchestrator", name: "Orchestrator", description: "MoA execution dashboard", color: "bg-red-500" },
  { id: "workflowbuilder", name: "WorkflowBuilder", description: "Visual DAG builder", color: "bg-cyan-500" },
  { id: "browserscreenshot", name: "Browser", description: "Web citations with screenshots", color: "bg-indigo-500" },
]

// Mock active programs
const mockActivePrograms = [
  { id: "researchdoc-1", type: "researchdoc", title: "Q1 Research Report", status: "active" },
  { id: "datagrid-1", type: "datagrid", title: "Sales Data 2024", status: "minimized" },
]

export default function A2rOSDemo() {
  const [activeConsoleTab, setActiveConsoleTab] = useState<"terminal" | "kanban" | "automation">("terminal")
  const [consoleOpen, setConsoleOpen] = useState(true)
  const [activePrograms, setActivePrograms] = useState(mockActivePrograms)

  const launchProgram = (programId: string) => {
    const program = programs.find(p => p.id === programId)
    if (!program) return
    
    const newProgram = {
      id: `${programId}-${Date.now()}`,
      type: programId,
      title: `${program.name} ${activePrograms.filter(p => p.type === programId).length + 1}`,
      status: "active"
    }
    setActivePrograms([...activePrograms, newProgram])
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Layers className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">A2rOS</h1>
              <Badge variant="secondary" className="text-xs">Super-Agent OS</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Program-based interface for agent-computer interaction
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>{activePrograms.length} programs active</span>
            </div>
            <Button 
              variant={consoleOpen ? "default" : "outline"}
              size="sm"
              onClick={() => setConsoleOpen(!consoleOpen)}
              className="gap-2"
            >
              <Terminal className="w-4 h-4" />
              Console
            </Button>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-muted/50 border-b px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center gap-6">
          <Badge variant="outline" className="gap-1 text-xs">
            <CheckCircle2 className="w-3 h-3" />
            Kernel Connected
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            <Zap className="w-3 h-3" />
            Rails Bridge Active
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            <Command className="w-3 h-3" />
            URI Handler Ready
          </Badge>
          <div className="flex-1" />
          <code className="text-xs text-muted-foreground">a2r://launch/researchdoc</code>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Program Launcher */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LayoutGrid className="w-5 h-5" />
                  Program Launcher
                </CardTitle>
                <CardDescription>
                  Launch specialized programs via URI scheme or direct invocation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-3">
                  {programs.map((program) => (
                    <button
                      key={program.id}
                      onClick={() => launchProgram(program.id)}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:border-primary hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0", program.color)}>
                        {programIcons[program.id]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{program.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{program.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
                
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <code className="text-xs">a2r://launch/{'{programId}'}?title=My%20Doc</code>
                </div>
              </CardContent>
            </Card>

            {/* Active Programs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Monitor className="w-5 h-5" />
                  Active Programs
                </CardTitle>
                <CardDescription>
                  Programs currently running in the workspace
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activePrograms.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No active programs. Launch one from above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activePrograms.map((program) => {
                      const programDef = programs.find(p => p.id === program.type)
                      return (
                        <div 
                          key={program.id}
                          className="flex items-center gap-3 p-3 rounded-lg border"
                        >
                          <div className={cn("w-2 h-2 rounded-full", program.status === "active" ? "bg-green-500" : "bg-yellow-500")} />
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", programDef?.color)}>
                            {programIcons[program.type]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{program.title}</div>
                            <div className="text-xs text-muted-foreground capitalize">{program.type} • {program.status}</div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              {program.status === "active" ? <span className="text-xs">−</span> : <span className="text-xs">□</span>}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500">
                              <span className="text-xs">×</span>
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Architecture */}
            <Card>
              <CardHeader>
                <CardTitle>Architecture</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <Layers className="w-8 h-8 text-primary" />
                    <div className="flex-1">
                      <h3 className="font-medium">A2rOS Shell</h3>
                      <p className="text-sm text-muted-foreground">Program dock, console toggle, layout manager</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <h3 className="font-medium">Program Launcher</h3>
                      <p className="text-sm text-muted-foreground">URI scheme handler, type registry</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <MessageSquare className="w-8 h-8 text-blue-500" />
                    <div className="flex-1">
                      <h3 className="font-medium">Chat Integration</h3>
                      <p className="text-sm text-muted-foreground">Program mention routing, preview cards</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <h3 className="font-medium">Kernel Bridge</h3>
                      <p className="text-sm text-muted-foreground">Rails WebSocket, command execution</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <GitBranch className="w-8 h-8 text-purple-500" />
                    <div className="flex-1">
                      <h3 className="font-medium">Sidecar Store</h3>
                      <p className="text-sm text-muted-foreground">Rails DAG sync, optimistic updates</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <h3 className="font-medium">Programs</h3>
                      <p className="text-sm text-muted-foreground">8 specialized renderers</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Console Panel */}
          <div className="space-y-6">
            {consoleOpen && (
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Terminal className="w-4 h-4" />
                    A2r Console
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Tabs */}
                  <div className="flex border-b">
                    {(["terminal", "kanban", "automation"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveConsoleTab(tab)}
                        className={cn(
                          "flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors",
                          activeConsoleTab === tab 
                            ? "bg-muted border-b-2 border-primary" 
                            : "text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  
                  {/* Tab Content */}
                  <div className="p-4 h-64 overflow-auto">
                    {activeConsoleTab === "terminal" && (
                      <div className="font-mono text-xs space-y-1">
                        <div className="text-green-500">$ kernel status</div>
                        <div className="text-muted-foreground">✓ Rails WebSocket connected</div>
                        <div className="text-muted-foreground">✓ Agent runtime ready</div>
                        <div className="text-muted-foreground">✓ 3 agents registered</div>
                        <div className="text-green-500 mt-2">$ agent list</div>
                        <div className="text-muted-foreground">• builder (busy)</div>
                        <div className="text-muted-foreground">• validator (idle)</div>
                        <div className="text-muted-foreground">• reviewer (idle)</div>
                        <div className="text-green-500 mt-2">$ _</div>
                      </div>
                    )}
                    
                    {activeConsoleTab === "kanban" && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground mb-2">TODO</div>
                        <div className="p-2 bg-muted rounded text-xs">Review PR #234</div>
                        <div className="p-2 bg-muted rounded text-xs">Update documentation</div>
                        
                        <div className="text-xs font-medium text-muted-foreground mt-3 mb-2">IN PROGRESS</div>
                        <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs">Implement auth flow</div>
                        
                        <div className="text-xs font-medium text-muted-foreground mt-3 mb-2">DONE</div>
                        <div className="p-2 bg-green-500/10 border border-green-500/30 rounded text-xs line-through opacity-60">Setup project</div>
                      </div>
                    )}
                    
                    {activeConsoleTab === "automation" && (
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium">Nightly Build</span>
                            <Badge variant="outline" className="text-xs">Running</Badge>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div className="bg-primary h-1.5 rounded-full" style={{ width: "60%" }} />
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">Step 3 of 5: Running tests...</div>
                        </div>
                        
                        <div className="p-3 border rounded-lg opacity-60">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium">Deploy to Staging</span>
                            <Badge variant="outline" className="text-xs">Pending</Badge>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div className="bg-muted-foreground h-1.5 rounded-full" style={{ width: "0%" }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Program Types */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Program Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Content</span>
                    <span className="font-medium">4 programs</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Data</span>
                    <span className="font-medium">2 programs</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Execution</span>
                    <span className="font-medium">2 programs</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Features */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Features</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    <span>URI scheme for program launching</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Chat-to-program bridge</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Agent terminal with kanban</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Real-time Rails sync</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Sidecar state management</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
