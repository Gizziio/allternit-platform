import React from "react";
import { useNavigate } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { ListPage, EmptyState, CodeTemplateBlock } from "@/components/console-ui";

interface ComingSoonPageProps {
  title: string;
  description: string;
  cta?: { label: string; to: string };
  codeTemplate?: { language: string; code: string };
}

/**
 * Phase 1 stub factory: every future console page renders as a designed
 * empty state (Anthropic list pattern) until its phase lands real logic.
 */
export function ComingSoonPage({
  title,
  description,
  cta,
  codeTemplate,
}: ComingSoonPageProps): React.ReactNode {
  const navigate = useNavigate();

  return (
    <ListPage
      title={title}
      subtitle="Console preview"
      emptyState={
        <div className="space-y-6">
          <EmptyState
            icon={<HugeiconsIcon icon={Rocket01Icon} size={32} />}
            title={`${title} is on the way`}
            caption={description}
            ctaLabel={cta?.label}
            onCtaClick={cta ? () => navigate(cta.to) : undefined}
          />
          {codeTemplate && (
            <div className="mx-auto max-w-xl">
              <CodeTemplateBlock language={codeTemplate.language} code={codeTemplate.code} />
            </div>
          )}
        </div>
      }
    />
  );
}
