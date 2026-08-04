/**
 * DAG Integration Page
 *
 * A unified index into the full DAG suite. Replaces the stale four-tab
 * wrapper with direct navigation tiles to every registered DAG view.
 */

import {
  Activity,
  Box,
  Cpu,
  FileText,
  GitMerge,
  Globe,
  LayoutGrid,
  ListChecks,
  Lock,
  Scale,
  ScanEye,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TreePine,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNav } from "@/nav/useNav";
import type { ViewType } from "@/nav/nav.types";

interface DagSuiteTile {
  viewType: ViewType;
  title: string;
  description: string;
  icon: LucideIcon;
}

const DAG_SECTIONS: { title: string; items: DagSuiteTile[] }[] = [
  {
    title: "Orchestration & Execution",
    items: [
      {
        viewType: "swarm",
        title: "Swarm Dashboard",
        description: "Multi-agent swarm monitoring and control.",
        icon: Users,
      },
      {
        viewType: "policy",
        title: "Policy Manager",
        description: "Author and manage runtime execution policies.",
        icon: Scale,
      },
      {
        viewType: "task-executor",
        title: "Task Executor",
        description: "Launch, schedule, and inspect DAG tasks.",
        icon: ListChecks,
      },
      {
        viewType: "directive",
        title: "Directive Compiler",
        description: "Compile high-level directives into DAG plans.",
        icon: GitMerge,
      },
      {
        viewType: "evaluation",
        title: "Evaluation Harness",
        description: "Run benchmarks and evaluate agent outputs.",
        icon: Sparkles,
      },
      {
        viewType: "gc-agents",
        title: "GC Agents",
        description: "Archive, index maintenance, and garbage collection.",
        icon: TreePine,
      },
    ],
  },
  {
    title: "Knowledge & Design",
    items: [
      {
        viewType: "ontology",
        title: "Ontology Viewer",
        description: "Browse entity and relation ontologies.",
        icon: ScrollText,
      },
      {
        viewType: "ivkge",
        title: "IVKGE Panel",
        description: "Visual knowledge graph extraction.",
        icon: FileText,
      },
      {
        viewType: "multimodal",
        title: "Multimodal Input",
        description: "Stream and process vision, audio, and text.",
        icon: Video,
      },
      {
        viewType: "tambo",
        title: "UI Forge",
        description: "Generate and refine UI components.",
        icon: LayoutGrid,
      },
    ],
  },
  {
    title: "Security & Governance",
    items: [
      {
        viewType: "security",
        title: "Security Dashboard",
        description: "Audit security posture and active threats.",
        icon: ShieldCheck,
      },
      {
        viewType: "policy-gating",
        title: "Policy Gating",
        description: "Gate executions against live policy checks.",
        icon: ShieldAlert,
      },
      {
        viewType: "receipts",
        title: "Receipts Viewer",
        description: "Inspect signed execution receipts.",
        icon: ScanEye,
      },
      {
        viewType: "purpose",
        title: "Purpose Binding",
        description: "Bind data use to declared purposes.",
        icon: Lock,
      },
    ],
  },
  {
    title: "Browser & Execution",
    items: [
      {
        viewType: "browserview",
        title: "Browser View",
        description: "Embedded browser execution surface.",
        icon: Globe,
      },
      {
        viewType: "dag-wih",
        title: "DAG WIH",
        description: "World-in-the-loop execution harness.",
        icon: Box,
      },
      {
        viewType: "checkpointing",
        title: "Checkpointing",
        description: "Save and resume execution checkpoints.",
        icon: Cpu,
      },
    ],
  },
  {
    title: "Observability",
    items: [
      {
        viewType: "observability",
        title: "Observability Dashboard",
        description: "Traces, metrics, and DAG telemetry.",
        icon: Activity,
      },
    ],
  },
];

function openView(viewType: ViewType): void {
  useNav.getState().dispatch({ type: "OPEN_VIEW", viewType });
}

export function DagIntegrationPage(): React.ReactNode {
  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">DAG Suite</h1>
        <p className="text-muted-foreground">
          Graph-structured execution, policy, observability, and governance tools.
        </p>
      </div>

      {DAG_SECTIONS.map((section) => (
        <section key={section.title} className="space-y-4">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.viewType} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                      </div>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                    </div>
                    <CardDescription className="pt-2">{item.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openView(item.viewType)}
                    >
                      Open
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default DagIntegrationPage;
