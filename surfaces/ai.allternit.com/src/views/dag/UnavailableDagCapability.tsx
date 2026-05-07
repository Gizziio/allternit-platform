import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UnavailableDagCapabilityProps {
  title: string;
  description: string;
  backendPath: string;
}

export function UnavailableDagCapability({
  title,
  description,
  backendPath,
}: UnavailableDagCapabilityProps) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Capability Unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This surface is not exposed in the production shell until the frontend contract is implemented and validated end-to-end.
          </p>
          <p className="text-sm text-muted-foreground">
            Backend reference: <code className="bg-muted px-2 py-1 rounded">{backendPath}</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
