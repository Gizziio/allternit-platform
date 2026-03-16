/**
 * Receipts Viewer - P5.1.2
 * View and manage execution receipts
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ReceiptsViewer() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Receipts Viewer</h1>
        <p className="text-muted-foreground">Execution receipts and evidence</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backend Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Backend: <code className="bg-muted px-2 py-1 rounded">2-governance/evidence-management/receipts-schema</code>
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Status: ✅ Backend implemented, UI placeholder
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default ReceiptsViewer;
