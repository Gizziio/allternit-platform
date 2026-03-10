"use client";

import { useState, useCallback } from 'react';
import { useNodes } from './hooks/useNodes';
import { NodeList } from './components/NodeList';
import { AddNodeWizard } from './components/AddNodeWizard';
import { TerminalTabs } from './terminal/TerminalTabs';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Cloud, Server, Terminal, X } from 'lucide-react';

// Extend NodesView to include Cloud Deploy integration
interface NodesViewProps {
  initialTab?: 'nodes' | 'deploy' | 'terminal';
}

export function NodesView({ initialTab = 'nodes' }: NodesViewProps = {}) {
  const { nodes, connected, loading, error, refresh, deleteNode } = useNodes();
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [terminalNodeId, setTerminalNodeId] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleDelete = useCallback(async (nodeId: string) => {
    const success = await deleteNode(nodeId);
    if (success) {
      (addToast as any)({
        title: 'Node removed',
        description: 'The node has been successfully removed.',
      });
    } else {
      (addToast as any)({
        title: 'Error',
        description: 'Failed to remove node. Please try again.',
      });
    }
    setNodeToDelete(null);
  }, [deleteNode, addToast]);

  const handleTerminal = useCallback((nodeId: string) => {
    setTerminalNodeId(nodeId);
    setActiveTab('terminal');
  }, []);

  const handleCloseTerminal = useCallback(() => {
    setTerminalNodeId(null);
    setActiveTab('nodes');
  }, []);

  const handleDeployNew = useCallback(() => {
    // Navigate to Cloud Deploy view
    window.dispatchEvent(new CustomEvent('a2r:openView', { detail: { viewType: 'deploy' } }));
  }, []);

  return (
    <div className="container mx-auto p-6 h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'nodes' | 'deploy' | 'terminal')} className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Compute Nodes</h2>
            <p className="text-muted-foreground">
              Manage your compute infrastructure
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="nodes" className="gap-2">
                <Server className="h-4 w-4" />
                Nodes ({nodes.length})
              </TabsTrigger>
              {(TabsTrigger as any)({ value: "terminal", className: "gap-2", disabled: !terminalNodeId, children: [
                <Terminal key="icon" className="h-4 w-4" />,
                " Terminal",
                terminalNodeId && (
                  <span key="close"
                    onClick={(e: any) => {
                      e.stopPropagation();
                      handleCloseTerminal();
                    }}
                    className="ml-1 p-0.5 hover:bg-muted rounded"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )
              ]})}
              <TabsTrigger value="deploy" className="gap-2">
                <Cloud className="h-4 w-4" />
                Deploy New
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="nodes" className="flex-1">
          <NodeList
            nodes={nodes}
            connected={connected}
            loading={loading}
            error={error}
            onRefresh={refresh}
            onDelete={setNodeToDelete}
            onTerminal={handleTerminal}
            onAddNode={() => setShowAddWizard(true)}
            onDeployNew={handleDeployNew}
          />
        </TabsContent>

        <TabsContent value="terminal" className="flex-1 min-h-[500px]">
          {terminalNodeId ? (
            <TerminalTabs 
              initialNodeId={terminalNodeId} 
              className="h-full border rounded-lg overflow-hidden"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Terminal className="h-12 w-12 mb-4" />
              <p>Select a node to open a terminal</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="deploy">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-8">
            <div className="flex flex-col items-center justify-center text-center max-w-lg mx-auto">
              <Cloud className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Deploy New Instance</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Provision a new VPS on cloud providers like Hetzner, DigitalOcean, or AWS. 
                The instance will be automatically configured and connected to your control plane.
              </p>
              <Button onClick={handleDeployNew}>
                <Cloud className="h-4 w-4 mr-2" />
                Open Cloud Deploy
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AddNodeWizard
        open={showAddWizard}
        onClose={() => setShowAddWizard(false)}
      />

      <AlertDialog open={!!nodeToDelete} onOpenChange={() => setNodeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Node</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this node? This will disconnect it from the control plane.
              The node agent will need to be reconfigured to reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => nodeToDelete && handleDelete(nodeToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
