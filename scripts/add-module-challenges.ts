const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

// Map course code -> module name -> challenge title & description
const CHALLENGE_ASSIGNMENTS: Record<string, Record<string, { title: string; description: string }>> = {
  'ALABS-OPS-N8N': {
    'The Problem: Why n8n Over SaaS Automation': {
      title: 'Challenge: The TCO Spreadsheet',
      description: 'Build a simple spreadsheet comparing Zapier Professional (50K tasks/mo) vs. self-hosted n8n on a $20 VPS over 3 years. Include time estimates for maintenance. Present your conclusion.',
    },
    'n8n as Connector Layer': {
      title: 'Challenge: The Slack-to-Claude Bridge',
      description: 'Build an n8n workflow that listens for a Slack webhook, sends the message text to Claude, and posts Claude\'s reply back to the same Slack thread.',
    },
    'Self-Hosting & Scaling': {
      title: 'Challenge: The MCP Wrapper',
      description: 'Take any n8n workflow you have built. Add a webhook trigger that accepts a JSON payload and returns a structured JSON response. Document the input schema as if it were an MCP tool.',
    },
    'Bridge: How Allternit Uses n8n': {
      title: 'Challenge: Draw the Boundary',
      description: 'For a system you are familiar with, draw a diagram showing what should live in application code vs. what should live in n8n. Defend your boundary with at least three criteria.',
    },
  },
  'ALABS-CORE-COPILOT': {
    'The Problem: Manual Coding is the Bottleneck': {
      title: 'Challenge: The 10-Line Rule',
      description: 'Take a feature request. Write the first 10 lines manually, then use Copilot/Cursor to complete the rest. Stop every 20 lines to review. Document one drift you caught.',
    },
    'Prompting for Clean Code': {
      title: 'Challenge: The Clean-Up Round',
      description: 'Take a messy AI-generated function. In exactly 3 follow-up prompts, transform it into clean code that passes your project\'s linting and has full type coverage.',
    },
    'Extending Assistants with Tools': {
      title: 'Challenge: The Custom Tool',
      description: 'Write a small Node.js or Python script that validates your project\'s import rules. Run it from the terminal inside Cursor/Copilot Chat. Ask the AI to fix any violations it finds.',
    },
    'Bridge: Allternit\'s Cursor + Copilot Stack': {
      title: 'Challenge: Write Your .cursorrules',
      description: 'For a project of your choice, write a 20-line .cursorrules file covering: naming conventions, forbidden imports, and test expectations. Use it for one feature and measure the quality of AI suggestions.',
    },
  },
  'ALABS-CORE-PROMPTS': {
    'The Problem: Guesswork vs. Systematic Prompt Engineering': {
      title: 'Challenge: The One-Prompt Test',
      description: 'Pick a simple classification task. Write one "vibe" prompt and one "systematic" prompt. Run 10 examples through both. Score accuracy and consistency. The systematic prompt must win on both.',
    },
    'The Prompt Engineering Stack': {
      title: 'Challenge: Stack Upgrade',
      description: 'Pick a simple task (summarization, classification, or extraction). Write a v1 prompt in one sentence. Then write a v2 prompt using all four layers. Run 10 examples through both. The v2 prompt must score higher on consistency.',
    },
    'Python + OpenAI API Patterns': {
      title: 'Challenge: The Conversation Agent',
      description: 'Build a Python CLI chatbot that maintains a conversation history, summarizes old context when token limits approach, and always responds with a JSON object containing {response, sentiment, follow_up_suggested}.',
    },
    'System Prompt Design': {
      title: 'Challenge: The Support Bot Constitution',
      description: 'Write a system prompt for a customer support agent. It must: (1) never share internal pricing, (2) always offer to escalate technical issues, (3) respond in under 3 sentences, (4) confirm the user\'s emotion before answering. Test it with 5 adversarial inputs.',
    },
    'Developer Prompt Patterns': {
      title: 'Challenge: The Full Cycle',
      description: 'Pick a small feature (e.g., a password validator). Use exactly 5 prompts to: (1) generate the code, (2) explain it, (3) refactor it, (4) review it for security issues, (5) write tests for it. Submit the final code + test file.',
    },
  },
  'ALABS-AGENTS-ML': {
    'When to Use ML vs. LLMs vs. Rules': {
      title: 'Challenge: The Decision Matrix',
      description: 'Pick three real-world tasks. Fill out a matrix scoring each on: data availability, interpretability need, latency budget, and flexibility requirement. Recommend rules, ML, or LLM for each. Defend your choices.',
    },
    'Scikit-Learn Patterns': {
      title: 'Challenge: The Agent-Ready Model',
      description: 'Train a scikit-learn classifier on a public dataset. Achieve >80% accuracy. Save it as a .joblib file. Write a Python function load_model(path) → model that returns predictions given a dictionary input.',
    },
    'Feature Engineering for Structured Data': {
      title: 'Challenge: The Feature Pipeline',
      description: 'Starting from a messy CSV with missing values and mixed types, build a scikit-learn Pipeline that handles all preprocessing automatically. Train a model and show that it works on a held-out test row without manual preprocessing.',
    },
    'Bridge: Wrapping ML Models as MCP Tools': {
      title: 'Challenge: Wrap Your Model',
      description: 'Take the model you trained in the previous module. Wrap it as an MCP tool with a JSONSchema input and a structured output. Test it from an LLM agent context.',
    },
  },
  'ALABS-OPS-RAG': {
    'RAG Architecture': {
      title: 'Challenge: The Local Indexer',
      description: 'Build a script that takes a folder of text files, chunks them, embeds them with a local model, and stores them in a FAISS index. Query the index and print the top-3 most relevant chunks for a given question.',
    },
    'Local LLM Inference': {
      title: 'Challenge: The Offline Swap',
      description: 'Take any Python script that uses the OpenAI API. Modify it to call a local Ollama endpoint instead. Run it successfully with Wi-Fi disabled.',
    },
    'Semantic Search Implementation': {
      title: 'Challenge: The Search Benchmark',
      description: 'Create 10 question-answer pairs from a document you index. Test semantic search with two different chunk sizes (200 and 500 tokens). Score how many times the correct chunk appears in the top-3 results. Report which chunk size wins and why.',
    },
    'Agentic RAG': {
      title: 'Challenge: Multi-Hop Question',
      description: 'Pick two PDFs with overlapping topics. Ask: "What changed between Document A and Document B on topic X?" Implement an agentic RAG loop that answers correctly and cites both sources.',
    },
  },
  'ALABS-OPS-VISION': {
    'OpenCV + Python Foundations': {
      title: 'Challenge: The Preprocessor',
      description: 'Write a Python script that takes an image, converts it to grayscale, applies adaptive thresholding, finds contours, and draws red bounding boxes around every contour with an area > 1000 pixels. Save the result.',
    },
    'Feature Detection & Tracking': {
      title: 'Challenge: The Feature Matcher',
      description: 'Write a script that loads two images, detects ORB features in both, matches them using a brute-force matcher, and draws the top 10 matches. Save the output image.',
    },
    'Face & Object Detection with Deep Learning': {
      title: 'Challenge: The Object Counter',
      description: 'Write a script that uses a local YOLO or MobileNet model to detect and count the number of people in a video file. Output the count per frame and the total unique appearances.',
    },
    'Bridge: Connecting OpenCV to Agent Systems': {
      title: 'Challenge: The Login Bot',
      description: 'Build a script that captures a login screen, uses OpenCV + OCR to locate the username field, password field, and submit button, and outputs a step-by-step action plan in JSON. (Do not actually enter credentials.)',
    },
  },
  'ALABS-AGENTS-AGENTS': {
    'Agent Architecture Patterns': {
      title: 'Challenge: The ReAct Agent',
      description: 'Implement a ReAct loop for a simple task: "Find the population of France, then calculate what percentage of the world population that is." Your agent must use at least two distinct tools and show its reasoning trace.',
    },
    'Tool-Using Agents': {
      title: 'Challenge: The MCP Tool',
      description: 'Implement a simple MCP server with one tool: "get_current_time". Then build a Python client that asks an LLM a question requiring the current time, extracts the tool call, invokes your MCP server, and returns the answer.',
    },
    'Code-Generation Agents': {
      title: 'Challenge: The Self-Healing Coder',
      description: 'Build a loop that: (1) sends a spec to an LLM, (2) writes the code to a file, (3) runs a linter, (4) if errors exist, feeds them back to the LLM, (5) repeats until the linter passes or 3 attempts are exhausted.',
    },
    'Multi-Agent Orchestration': {
      title: 'Challenge: The Specialist Router',
      description: 'Build a router agent with 3 specialist agents (e.g., Math, Creative, Technical). The router analyzes the user query and delegates to the correct specialist. If the specialist\'s confidence is <0.7, escalate to a human. Log every delegation decision.',
    },
  },
  'ALABS-ADV-PLUGINSDK': {
    'Module 1: Plugin SDK Architecture': {
      title: 'Challenge: Build Your First Plugin Tool',
      description: 'Using the Allternit Plugin SDK, create a plugin that exposes one tool. The tool must accept a JSON payload, perform a simple transformation (e.g., uppercase all string values), and return a structured result. Submit your plugin manifest, the TypeScript source file, and a short README explaining how PluginHost loads it.',
    },
    'Module 2: Adapters & PluginHost': {
      title: 'Challenge: Implement a Custom Adapter',
      description: 'Implement a custom PluginHost adapter for a new transport layer (e.g., WebSocket, Server-Sent Events, or gRPC). Your adapter must: (1) implement the PluginHost interface, (2) handle connection lifecycle (connect, disconnect, reconnect), (3) support message serialization/deserialization, (4) include error handling for network failures, and (5) provide a simple test harness that demonstrates sending a tool call and receiving a response. Submit the adapter implementation, interface definitions, and test output.',
    },
    'Module 3: Publishing, Manifests & Distribution': {
      title: 'Challenge: Design a Plugin Marketplace API',
      description: 'Design and implement a minimal plugin marketplace backend. Your solution must: (1) define the JSON schema for plugin manifests (name, version, entry point, permissions, dependencies), (2) implement POST /publish that validates manifests and stores them, (3) implement GET /plugins with filtering by category, version compatibility, and permissions, (4) implement a simple approval workflow (submitted → pending → approved/rejected), (5) include rate limiting on publish endpoint. Submit the API spec (OpenAPI-style), server implementation, and a test script that exercises all endpoints.',
    },
    'Bridge: How Allternit Uses the Plugin SDK': {
      title: 'Challenge: Instrument the Plugin Loader',
      description: 'Add structured logging and metrics collection to the Allternit plugin loading pipeline. Your solution must: (1) log each stage of plugin loading (discovery, validation, adapter selection, execution) with timestamps, (2) collect metrics on load time, validation success rate, and adapter type distribution, (3) build a simple HTML dashboard that displays real-time metrics, (4) handle errors gracefully without breaking the loader, (5) include a test that verifies metrics are collected correctly. Submit the instrumented loader code, dashboard HTML, and test output.',
    },
  },
  'ALABS-ADV-WORKFLOW': {
    'Module 1: The Workflow Engine': {
      title: 'Challenge: Map a Real-World Workflow',
      description: 'Pick a multi-step business process you know well (e.g., onboarding a new hire, processing a refund). Draw the DAG with at least 5 nodes. Label each node with its inputs and outputs. Identify which nodes can execute in parallel and which require sequential ordering. Submit your diagram plus a 200-word rationale.',
    },
    'Module 2: The Scheduler & Execution Model': {
      title: 'Challenge: Build a Retry-Aware Scheduler',
      description: 'Extend the Allternit Scheduler with exponential backoff retry logic. Your implementation must: (1) track retry counts per task in a Map, (2) implement exponential backoff with jitter (base delay × 2^attempt + random(0-1000ms)), (3) accept a maxRetries config option (default 3), (4) fire an onRetry hook with { taskId, attempt, nextDelay }, (5) include a test that simulates a task failing twice then succeeding. Submit the wrapper code, test output, and a brief design note on why you chose your backoff strategy.',
    },
    'Bridge: How Allternit Orchestrates with Workflows': {
      title: 'Challenge: Build an Onboarding Workflow',
      description: 'Design a 6-node workflow for new user onboarding. Your workflow must include: (1) email welcome node, (2) profile setup node, (3) tutorial assignment node, (4) team invite node, (5) analytics tracking node, (6) completion notification node. Include error handling for the email node (what if SMTP is down?). Write the workflow definition, custom node executors, and a test that verifies the full flow. Submit the workflow JSON, node implementations, test output, and a diagram of the DAG.',
    },
  },
  'ALABS-ADV-ADAPTERS': {
    'Module 1: Provider Adapters & Unified APIs': {
      title: 'Challenge: Design a Resilient Adapter',
      description: 'Pick an external API (e.g., Stripe, SendGrid, a weather API). Write a design document for an Allternit provider adapter that includes: (1) the unified method signature your adapter exposes, (2) a rate-limiting strategy with back-off, (3) a failover plan for 5xx errors, and (4) a simple TypeScript interface file. Submit the design doc and the interface.',
    },
    'Module 2: Resilience Patterns': {
      title: 'Challenge: Build a Circuit Breaker Dashboard',
      description: 'Implement a circuit breaker for an external API call and build a simple HTML dashboard that visualizes its state in real-time. Your solution must: (1) implement the CircuitBreaker class with CLOSED/OPEN/HALF-OPEN states, (2) expose a /status endpoint that returns current state, failure count, and last failure time, (3) create a dashboard that polls /status every 2 seconds and updates a visual indicator, (4) include a button to simulate failures and observe the state transition. Submit the circuit breaker code, dashboard HTML, and a screen recording or screenshots of the state transitions.',
    },
    'Bridge: How Allternit Integrates External APIs': {
      title: 'Challenge: Build a Multi-Provider AI Gateway',
      description: 'Create an adapter that routes AI requests to OpenAI, Anthropic, or a local model based on availability and cost. Your solution must: (1) implement a MultiProviderGateway class with configurable provider chain, (2) include health checks for each provider, (3) track cost per provider and route to cheapest available, (4) normalize responses across providers, (5) implement fallback chain when providers fail, (6) write tests simulating provider outages. Submit the gateway implementation, configuration schema, and test results.',
    },
  },
};

async function canvasApi(method: string, pathStr: string, body?: any) {
  const url = `${BASE_URL}${pathStr}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${CANVAS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);
  const resp = await fetch(url, options);
  if (!resp.ok && resp.status !== 204) {
    const text = await resp.text();
    throw new Error(`Canvas API ${method} ${pathStr} failed: ${resp.status} ${text}`);
  }
  if (resp.status === 204) return null;
  return await resp.json();
}

async function getMyCourses() {
  const courses: any[] = [];
  let page = 1;
  while (true) {
    const resp = await fetch(`${BASE_URL}/courses?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${CANVAS_TOKEN}` }
    });
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) break;
    courses.push(...data);
    page++;
    if (page > 5) break;
  }
  return courses.filter(c => c.course_code?.startsWith('ALABS-'));
}

async function addChallengeAssignment(courseId: number, moduleId: number, title: string, description: string, position: number) {
  // Create assignment
  const assignment = await canvasApi('POST', `/courses/${courseId}/assignments`, {
    assignment: {
      name: title,
      description: `<div style="font-family: system-ui, sans-serif; line-height: 1.6;"><p>${description}</p><p><strong>Submission:</strong> Upload your work as a file or paste a link to your repository/document.</p></div>`,
      submission_types: ['online_url', 'online_upload', 'online_text_entry'],
      points_possible: 10,
      published: true,
      assignment_group_id: null,
    }
  }) as any;
  
  // Add to module
  await canvasApi('POST', `/courses/${courseId}/modules/${moduleId}/items`, {
    module_item: {
      title: title,
      type: 'Assignment',
      content_id: assignment.id,
      position,
      published: true,
    }
  });
  
  return assignment.id;
}

async function processCourse(courseId: number, courseCode: string) {
  console.log(`\n--- Adding challenges to ${courseCode} ---`);
  const modules = await canvasApi('GET', `/courses/${courseId}/modules?per_page=100`) as any[];
  const challenges = CHALLENGE_ASSIGNMENTS[courseCode];
  
  if (!challenges) {
    console.log(`  ⚠️ No challenges defined`);
    return;
  }
  
  let added = 0;
  let skipped = 0;
  
  for (const mod of modules) {
    const challenge = challenges[mod.name];
    if (!challenge) continue;
    
    // Check if challenge already exists
    const items = await canvasApi('GET', `/courses/${courseId}/modules/${mod.id}/items?per_page=100`) as any[];
    const hasChallenge = items.some(i => i.type === 'Assignment' && i.title.includes('Challenge:'));
    
    if (hasChallenge) {
      console.log(`  ⏭️ Skipping ${mod.name} (challenge already exists)`);
      skipped++;
      continue;
    }
    
    const maxPos = items.length > 0 ? Math.max(...items.map(i => i.position || 0)) : 0;
    await addChallengeAssignment(courseId, mod.id, challenge.title, challenge.description, maxPos + 1);
    console.log(`  ✅ Added challenge to ${mod.name}`);
    added++;
  }
  
  console.log(`  Total: ${added} added, ${skipped} skipped`);
}

const ADV_COURSES = [
  { code: 'ALABS-ADV-PLUGINSDK', id: 14612851 },
  { code: 'ALABS-ADV-WORKFLOW', id: 14612861 },
  { code: 'ALABS-ADV-ADAPTERS', id: 14612869 },
];

async function main() {
  const courses = await getMyCourses();
  console.log(`Adding module challenges to ${courses.length} courses...\n`);
  
  for (const course of courses.sort((a, b) => a.course_code.localeCompare(b.course_code))) {
    await processCourse(course.id, course.course_code);
  }
  
  // ADV courses use a generic course_code in Canvas; process them by known ID
  console.log(`\nAdding module challenges to ${ADV_COURSES.length} ADV courses...\n`);
  for (const course of ADV_COURSES) {
    await processCourse(course.id, course.code);
  }
  
  console.log('\n✅ Module challenge assignments complete!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
