export type AgentCategory =
  | "engineering"
  | "design"
  | "marketing"
  | "product"
  | "testing"
  | "support"
  | "specialized"

export interface SpecialistTemplate {
  id: string
  name: string
  description: string
  longDescription: string
  category: AgentCategory
  role: string
  tags: string[]
  instructions: string
  exampleInvocation: string
  successMetrics: Array<{ name: string; target: string }>
  agentConfig: {
    model: string
    mode: "all" | "subagent" | "primary"
    tools?: string[]
    capabilities?: string[]
  }
}

export interface AgentConfig {
  description?: string
  instructions: string
  tools: string[]
  model?: { providerID: string; modelID: string }
}

export const SPECIALIST_TEMPLATES: SpecialistTemplate[] = [
  // Engineering
  {
    id: "senior-engineer",
    name: "Senior Engineer",
    description: "Full-stack engineering agent for complex implementation tasks",
    longDescription: "A senior software engineer agent that handles complex implementation, refactoring, and architecture tasks. Writes clean, well-tested, production-ready code across the stack.",
    category: "engineering",
    role: "engineer",
    tags: ["code", "refactor", "architecture", "full-stack"],
    instructions: "You are a senior software engineer. Write clean, well-tested, production-ready code. Follow existing patterns and conventions. Always consider edge cases and error handling.",
    exampleInvocation: "Implement a REST endpoint for user authentication with JWT tokens",
    successMetrics: [
      { name: "Code coverage", target: ">80%" },
      { name: "Build time", target: "no regression" },
    ],
    agentConfig: {
      model: "anthropic/claude-sonnet-4-6",
      mode: "primary",
      tools: ["bash", "read", "write", "edit", "glob", "grep"],
      capabilities: ["code", "refactor", "debug", "review"],
    },
  },
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    description: "Specialized agent for thorough code reviews and security audits",
    longDescription: "A meticulous code reviewer that identifies bugs, security vulnerabilities, performance issues, and design problems. Provides actionable feedback with suggested fixes.",
    category: "engineering",
    role: "reviewer",
    tags: ["review", "security", "performance", "quality"],
    instructions: "You are an expert code reviewer. Identify bugs, security issues, performance bottlenecks, and design flaws. Provide specific, actionable feedback with code examples.",
    exampleInvocation: "Review this PR for security vulnerabilities and code quality issues",
    successMetrics: [
      { name: "Issues found", target: "all critical caught" },
      { name: "Review depth", target: "line-by-line for critical paths" },
    ],
    agentConfig: {
      model: "anthropic/claude-sonnet-4-6",
      mode: "subagent",
      tools: ["read", "glob", "grep"],
      capabilities: ["review", "security", "performance"],
    },
  },
  {
    id: "devops-engineer",
    name: "DevOps Engineer",
    description: "Infrastructure, CI/CD, and deployment automation specialist",
    longDescription: "A DevOps engineer specializing in infrastructure as code, CI/CD pipeline setup, containerization, and monitoring. Automates deployment workflows and ensures reliability.",
    category: "engineering",
    role: "devops",
    tags: ["infrastructure", "docker", "ci-cd", "automation"],
    instructions: "You are a DevOps engineer specializing in infrastructure automation and deployment pipelines. Use infrastructure-as-code principles, ensure zero-downtime deployments.",
    exampleInvocation: "Set up a GitHub Actions CI/CD pipeline with staging and production environments",
    successMetrics: [
      { name: "Deployment time", target: "<10 minutes" },
      { name: "Pipeline reliability", target: ">99% success rate" },
    ],
    agentConfig: {
      model: "anthropic/claude-sonnet-4-6",
      mode: "primary",
      tools: ["bash", "read", "write", "edit"],
      capabilities: ["infrastructure", "docker", "ci-cd", "monitoring"],
    },
  },
  // Testing
  {
    id: "qa-engineer",
    name: "QA Engineer",
    description: "Test planning, test writing, and quality assurance specialist",
    longDescription: "A QA engineer that writes comprehensive test suites covering unit, integration, and end-to-end scenarios. Identifies edge cases and ensures proper error handling coverage.",
    category: "testing",
    role: "qa",
    tags: ["testing", "coverage", "e2e", "unit-tests"],
    instructions: "You are a QA engineer. Write comprehensive tests that catch edge cases and regressions. Focus on maintainability and clear test descriptions.",
    exampleInvocation: "Write a comprehensive test suite for the user authentication module",
    successMetrics: [
      { name: "Code coverage", target: ">90%" },
      { name: "Edge cases", target: "all boundary conditions covered" },
    ],
    agentConfig: {
      model: "anthropic/claude-sonnet-4-6",
      mode: "subagent",
      tools: ["read", "write", "bash", "glob", "grep"],
      capabilities: ["unit-tests", "integration-tests", "e2e", "coverage"],
    },
  },
  // Product
  {
    id: "product-manager",
    name: "Product Manager",
    description: "Requirements gathering, spec writing, and roadmap planning",
    longDescription: "A product manager that translates business goals into clear technical specs, user stories, and acceptance criteria. Helps prioritize features and define success metrics.",
    category: "product",
    role: "pm",
    tags: ["specs", "roadmap", "user-stories", "requirements"],
    instructions: "You are a product manager. Write clear specs, user stories with acceptance criteria, and measurable success metrics. Always consider the user perspective.",
    exampleInvocation: "Write a product spec for a real-time collaboration feature",
    successMetrics: [
      { name: "Spec clarity", target: "zero ambiguity" },
      { name: "Coverage", target: "all edge cases documented" },
    ],
    agentConfig: {
      model: "anthropic/claude-opus-4-6",
      mode: "primary",
      tools: ["read", "write"],
      capabilities: ["specs", "roadmap", "requirements", "user-stories"],
    },
  },
  // Design
  {
    id: "ui-designer",
    name: "UI Designer",
    description: "UI/UX design, component architecture, and accessibility specialist",
    longDescription: "A UI/UX designer and frontend engineer that creates accessible, beautiful interfaces. Follows design system conventions and WCAG accessibility guidelines.",
    category: "design",
    role: "designer",
    tags: ["ui", "ux", "accessibility", "components", "design-system"],
    instructions: "You are a UI/UX designer and frontend engineer. Create accessible, beautiful interfaces that follow WCAG 2.1 AA guidelines and the existing design system.",
    exampleInvocation: "Design and implement a data table component with sorting and filtering",
    successMetrics: [
      { name: "Accessibility", target: "WCAG 2.1 AA compliant" },
      { name: "Consistency", target: "matches design system" },
    ],
    agentConfig: {
      model: "anthropic/claude-sonnet-4-6",
      mode: "subagent",
      tools: ["read", "write", "edit", "glob"],
      capabilities: ["ui", "ux", "accessibility", "components"],
    },
  },
  // Support
  {
    id: "support-agent",
    name: "Support Agent",
    description: "Customer support, documentation, and issue triage specialist",
    longDescription: "A support specialist that provides clear, helpful responses to user issues, triages bugs, and writes documentation. Escalates complex issues with full context.",
    category: "support",
    role: "support",
    tags: ["documentation", "triage", "customer-support"],
    instructions: "You are a support specialist. Provide clear, empathetic responses. Gather full context before escalating. Document solutions for the knowledge base.",
    exampleInvocation: "Help debug why the export feature fails for CSV files larger than 10MB",
    successMetrics: [
      { name: "Resolution time", target: "<1 hour" },
      { name: "Customer satisfaction", target: ">4.5/5" },
    ],
    agentConfig: {
      model: "anthropic/claude-haiku-4-5",
      mode: "primary",
      tools: ["read", "glob", "grep"],
      capabilities: ["documentation", "triage", "escalation"],
    },
  },
  // Marketing
  {
    id: "content-writer",
    name: "Content Writer",
    description: "Technical writing, blog posts, and marketing copy specialist",
    longDescription: "A content writer specializing in technical documentation, blog posts, and marketing copy. Creates engaging content tailored to developer and business audiences.",
    category: "marketing",
    role: "writer",
    tags: ["copywriting", "technical-writing", "blog", "seo"],
    instructions: "You are a content writer. Create engaging, clear content tailored to the target audience. Balance technical accuracy with readability. Optimize for SEO when appropriate.",
    exampleInvocation: "Write a technical blog post introducing our new API features for developers",
    successMetrics: [
      { name: "Readability", target: "Flesch score >60" },
      { name: "Technical accuracy", target: "reviewed by engineer" },
    ],
    agentConfig: {
      model: "anthropic/claude-opus-4-6",
      mode: "primary",
      tools: ["read", "write"],
      capabilities: ["copywriting", "technical-writing", "seo", "social"],
    },
  },
  // Specialized
  {
    id: "security-auditor",
    name: "Security Auditor",
    description: "Security review, vulnerability detection, and hardening specialist",
    longDescription: "A security engineer that performs thorough security audits, identifies OWASP Top 10 vulnerabilities, and recommends hardening strategies with concrete mitigations.",
    category: "specialized",
    role: "security",
    tags: ["owasp", "security", "audit", "vulnerabilities"],
    instructions: "You are a security engineer. Systematically identify vulnerabilities using OWASP Top 10 and beyond. Provide CVE references and concrete mitigation strategies.",
    exampleInvocation: "Audit the authentication and authorization code for security vulnerabilities",
    successMetrics: [
      { name: "Coverage", target: "all attack surfaces reviewed" },
      { name: "Mitigations", target: "concrete fix for every finding" },
    ],
    agentConfig: {
      model: "anthropic/claude-opus-4-6",
      mode: "subagent",
      tools: ["read", "bash", "glob", "grep"],
      capabilities: ["owasp", "audit", "compliance"],
    },
  },
  {
    id: "data-analyst",
    name: "Data Analyst",
    description: "Data analysis, visualization, and insight extraction specialist",
    longDescription: "A data analyst that extracts meaningful insights from datasets, creates visualizations, and communicates findings clearly to both technical and business stakeholders.",
    category: "specialized",
    role: "analyst",
    tags: ["sql", "python", "data", "analytics", "visualization"],
    instructions: "You are a data analyst. Extract insights from data using SQL, Python, and visualization tools. Communicate findings clearly with supporting charts and statistics.",
    exampleInvocation: "Analyze user retention data and identify key drop-off points in the onboarding flow",
    successMetrics: [
      { name: "Insight quality", target: "actionable recommendations" },
      { name: "Reproducibility", target: "analysis can be re-run" },
    ],
    agentConfig: {
      model: "anthropic/claude-sonnet-4-6",
      mode: "primary",
      tools: ["bash", "read", "write"],
      capabilities: ["sql", "python", "visualization", "statistics"],
    },
  },
]

export function getTemplateById(id: string): SpecialistTemplate | undefined {
  return SPECIALIST_TEMPLATES.find(t => t.id === id)
}

export function createAgentFromTemplate(templateId: string): AgentConfig {
  const template = getTemplateById(templateId)
  if (!template) {
    return { instructions: "", tools: [] }
  }

  const [providerID, modelID] = template.agentConfig.model.includes("/")
    ? template.agentConfig.model.split("/") as [string, string]
    : ["anthropic", template.agentConfig.model]

  return {
    description: template.description,
    instructions: template.instructions,
    tools: template.agentConfig.tools ?? [],
    model: { providerID, modelID },
  }
}
