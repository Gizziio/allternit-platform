"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useNodeToken } from '../hooks/useNodes';
import {
  Copy,
  Check,
  HardDrives,
  Terminal,
  CircleNotch,
  ArrowsClockwise,
} from '@phosphor-icons/react';

interface AddNodeWizardProps {
  open: boolean;
  onClose: () => void;
}

export function AddNodeWizard({ open, onClose }: AddNodeWizardProps) {
  const { tokenData, loading, generateToken, clearToken } = useNodeToken();
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const handleGenerate = () => {
    generateToken();
  };

  const handleClose = () => {
    clearToken();
    setCopiedCommand(false);
    setCopiedToken(false);
    onClose();
  };

  const copyCommand = () => {
    if (tokenData?.install_command) {
      navigator.clipboard.writeText(tokenData.install_command);
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    }
  };

  const copyToken = () => {
    if (tokenData?.token) {
      navigator.clipboard.writeText(tokenData.token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrives size={20} />
            Add New Node
          </DialogTitle>
          <DialogDescription>
            Generate an installation token to connect a new node to your Allternit control plane.
          </DialogDescription>
        </DialogHeader>

        {!tokenData ? (
          <div className="space-y-4 py-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="bg-green-50">✓</Badge>
                  Linux, macOS, or Windows machine
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="bg-green-50">✓</Badge>
                  Docker installed (recommended)
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="bg-green-50">✓</Badge>
                  Outbound internet access (port 443)
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-center py-4">
              <Button 
                onClick={handleGenerate} 
                disabled={loading}
                size="lg"
                className="gap-2"
              >
                {loading ? (
                  <>
                    <CircleNotch className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ArrowsClockwise size={16} />
                    Generate Install Token
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Node ID</Label>
                <code className="text-xs bg-background px-2 py-1 rounded">
                  {tokenData.node_id}
                </code>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Auth Token</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={copyToken}
                    className="h-6 gap-1"
                  >
                    {copiedToken ? (
                      <>
                        <Check size={12} />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <code className="block text-xs bg-background px-2 py-1.5 rounded break-all font-mono">
                  {tokenData.token}
                </code>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Terminal size={16} />
                Installation Command
              </Label>
              <div className="relative">
                <pre className="text-xs bg-slate-950 text-slate-50 p-3 rounded-md overflow-x-auto font-mono">
                  {tokenData.install_command}
                </pre>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={copyCommand}
                  className="absolute top-2 right-2 gap-1"
                >
                  {copiedCommand ? (
                    <>
                      <Check size={12} />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="py-3">
                <p className="text-sm text-blue-800">
                  <strong>Next steps:</strong> Run the installation command on your target machine. 
                  The node will automatically connect and appear in your dashboard.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          {tokenData ? (
            <>
              <Button variant="outline" onClick={handleGenerate} disabled={loading}>
                <ArrowsClockwise className="h-4 w-4 mr-2" />
                Generate New Token
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
