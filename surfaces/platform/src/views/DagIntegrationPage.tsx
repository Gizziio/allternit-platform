/**
 * DAG Integration Views Page
 * 
 * Provides access to all P4 DAG integration views:
 * - Swarm Dashboard
 * - IVKGE Panel
 * - Multimodal Input
 * - Tambo Studio
 */

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SwarmDashboard } from "@/views/SwarmDashboard"
import { IVKGEPanel } from "@/views/IVKGEPanel"
import { MultimodalInput } from "@/views/MultimodalInput"
import { TamboStudio } from "@/views/TamboStudio"

type DagView = "swarm" | "ivkge" | "multimodal" | "tambo"

export function DagIntegrationPage() {
  const [activeView, setActiveView] = useState<DagView>("swarm")

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">P4 DAG Integration</h1>
        <p className="text-muted-foreground">
          Advanced features: Swarm monitoring, visual extraction, multimodal streaming, and UI generation
        </p>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as DagView)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="swarm">Swarm</TabsTrigger>
          <TabsTrigger value="ivkge">IVKGE</TabsTrigger>
          <TabsTrigger value="multimodal">Multimodal</TabsTrigger>
          <TabsTrigger value="tambo">Tambo</TabsTrigger>
        </TabsList>

        {/* Swarm Dashboard */}
        <TabsContent value="swarm" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Swarm Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <SwarmDashboard />
            </CardContent>
          </Card>
        </TabsContent>

        {/* IVKGE Panel */}
        <TabsContent value="ivkge" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>IVKGE Panel</CardTitle>
            </CardHeader>
            <CardContent>
              <IVKGEPanel />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Multimodal Input */}
        <TabsContent value="multimodal" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Multimodal Input</CardTitle>
            </CardHeader>
            <CardContent>
              <MultimodalInput />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tambo Studio */}
        <TabsContent value="tambo" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Tambo Studio</CardTitle>
            </CardHeader>
            <CardContent>
              <TamboStudio />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default DagIntegrationPage;
