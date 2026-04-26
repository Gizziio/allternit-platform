# A://AGENTS-MULTI-390 — Build a Router-Based Multi-Agent System

**Outcome:** Orchestrated system selecting between tools, datasets, and workflows  
**Artifact:** Deployed multi-agent orchestrator with routing logic  
**Prerequisites:** A://AGENTS-ORCHESTRATION-303, A://AGENTS-TOOLS-301  
**Time:** 8-10 hours  
**Difficulty:** Advanced

---

## Problem

Single agents are limited:
- One capability per agent
- No specialization
- Inefficient for complex tasks
- Hard to extend

---

## What You're Building

A multi-agent system that:
1. Analyzes incoming requests
2. Routes to appropriate specialist agent
3. Orchestrates multi-step workflows
4. Handles agent handoffs
5. Synthesizes final output

**System Flow:**
```
Request → Router → Specialist Agent(s) → Synthesize → Response
```

---

## Stack

| Component | Recommendation | Alternative |
|-----------|---------------|-------------|
| Router | GPT-4 function calling | Custom classifier |
| Agents | Specialized prompts | Fine-tuned models |
| Orchestration | LangChain/LangGraph | Custom state machine |
| State | Redis | In-memory |
| Backend | Python/FastAPI | Node.js |

---

## Implementation

### Step 1: Agent Registry

```python
from typing import Dict, List, Callable, Any
from dataclasses import dataclass
from enum import Enum

class AgentType(Enum):
    RESEARCH = "research"
    CODING = "coding"
    ANALYSIS = "analysis"
    WRITING = "writing"
    CALCULATION = "calculation"

@dataclass
class Agent:
    name: str
    agent_type: AgentType
    description: str
    capabilities: List[str]
    handler: Callable[[Dict], Dict]
    
class AgentRegistry:
    def __init__(self):
        self.agents: Dict[str, Agent] = {}
    
    def register(self, agent: Agent):
        """Register an agent."""
        self.agents[agent.name] = agent
    
    def get(self, name: str) -> Agent:
        """Get agent by name."""
        return self.agents.get(name)
    
    def list_capabilities(self) -> Dict[str, List[str]]:
        """List all agent capabilities."""
        return {
            name: agent.capabilities
            for name, agent in self.agents.items()
        }
    
    def find_by_capability(self, capability: str) -> List[Agent]:
        """Find agents with specific capability."""
        return [
            agent for agent in self.agents.values()
            if capability in agent.capabilities
        ]

# Global registry
registry = AgentRegistry()
```

### Step 2: Router

```python
import openai
import json
from typing import Dict, List

class Router:
    def __init__(self, registry: AgentRegistry):
        self.registry = registry
        openai.api_key = os.getenv("OPENAI_API_KEY")
    
    def route(self, request: Dict) -> Dict:
        """Route request to appropriate agent(s)."""
        
        query = request.get("query", "")
        context = request.get("context", {})
        
        # Get available agents and capabilities
        agents_info = self._get_agents_info()
        
        prompt = f"""You are a router for a multi-agent system. Analyze the request and determine which agent(s) should handle it.

Available Agents:
{agents_info}

User Request: {query}

Context: {json.dumps(context)}

Determine:
1. Which agent is primary for this request
2. If multiple agents needed, specify sequence
3. What information to pass to each agent

Return JSON:
{{
    "primary_agent": "agent_name",
    "additional_agents": ["agent2", "agent3"],
    "routing_reason": "why this routing",
    "subtasks": [
        {{
            "agent": "agent_name",
            "task": "specific task for this agent",
            "input": "what to pass"
        }}
    ],
    "needs_synthesis": true/false
}}"""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        
        routing = json.loads(response.choices[0].message.content)
        
        # Execute routing
        return self._execute_routing(routing, request)
    
    def _get_agents_info(self) -> str:
        """Format agents info for prompt."""
        info = []
        for name, agent in self.registry.agents.items():
            info.append(f"- {name}: {agent.description}")
            info.append(f"  Capabilities: {', '.join(agent.capabilities)}")
        return "\n".join(info)
    
    def _execute_routing(self, routing: Dict, original_request: Dict) -> Dict:
        """Execute the routing plan."""
        
        results = []
        
        for subtask in routing.get("subtasks", []):
            agent_name = subtask["agent"]
            agent = self.registry.get(agent_name)
            
            if not agent:
                results.append({
                    "agent": agent_name,
                    "error": "Agent not found"
                })
                continue
            
            # Execute agent
            agent_input = {
                "task": subtask["task"],
                "input": subtask["input"],
                "original_request": original_request
            }
            
            try:
                result = agent.handler(agent_input)
                results.append({
                    "agent": agent_name,
                    "result": result
                })
            except Exception as e:
                results.append({
                    "agent": agent_name,
                    "error": str(e)
                })
        
        # Synthesize if needed
        if routing.get("needs_synthesis") and len(results) > 1:
            final = self._synthesize(results, original_request)
        else:
            final = results[0]["result"] if results else {}
        
        return {
            "routing": routing,
            "agent_results": results,
            "final_output": final
        }
    
    def _synthesize(self, results: List[Dict], original_request: Dict) -> Dict:
        """Synthesize results from multiple agents."""
        
        results_text = "\n\n".join([
            f"Agent: {r['agent']}\nResult: {json.dumps(r.get('result', {}))}"
            for r in results
        ])
        
        prompt = f"""Synthesize the following agent outputs into a coherent response.

Original Request: {original_request.get('query')}

Agent Results:
{results_text}

Provide a unified response that integrates all agent outputs."""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        
        return {
            "synthesized": True,
            "response": response.choices[0].message.content,
            "component_results": results
        }
```

### Step 3: Specialist Agents

```python
# Research Agent
def research_agent_handler(input_data: Dict) -> Dict:
    """Handle research tasks."""
    task = input_data.get("task", "")
    
    # Implementation would use web search, RAG, etc.
    # Simplified for example
    
    return {
        "agent": "research",
        "findings": f"Research results for: {task}",
        "sources": ["source1", "source2"]
    }

# Coding Agent
def coding_agent_handler(input_data: Dict) -> Dict:
    """Handle coding tasks."""
    task = input_data.get("task", "")
    
    # Implementation would generate/ review code
    
    return {
        "agent": "coding",
        "code": "# Generated code\nprint('hello')",
        "explanation": "This code does..."
    }

# Analysis Agent
def analysis_agent_handler(input_data: Dict) -> Dict:
    """Handle data analysis tasks."""
    task = input_data.get("task", "")
    
    return {
        "agent": "analysis",
        "insights": ["insight 1", "insight 2"],
        "recommendations": ["recommendation 1"]
    }

# Register agents
registry.register(Agent(
    name="research_agent",
    agent_type=AgentType.RESEARCH,
    description="Researches topics using web search and document retrieval",
    capabilities=["web_search", "document_analysis", "fact_checking"],
    handler=research_agent_handler
))

registry.register(Agent(
    name="coding_agent",
    agent_type=AgentType.CODING,
    description="Writes, reviews, and debugs code",
    capabilities=["code_generation", "code_review", "debugging"],
    handler=coding_agent_handler
))

registry.register(Agent(
    name="analysis_agent",
    agent_type=AgentType.ANALYSIS,
    description="Analyzes data and provides insights",
    capabilities=["data_analysis", "trend_identification", "reporting"],
    handler=analysis_agent_handler
))
```

### Step 4: Orchestrator API

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

router = Router(registry)

class Request(BaseModel):
    query: str
    context: Dict = {}
    session_id: str = None

@app.post("/process")
async def process_request(request: Request):
    """Process request through multi-agent system."""
    
    result = router.route({
        "query": request.query,
        "context": request.context
    })
    
    return result

@app.get("/agents")
async def list_agents():
    """List available agents."""
    return {
        "agents": [
            {
                "name": name,
                "type": agent.agent_type.value,
                "description": agent.description,
                "capabilities": agent.capabilities
            }
            for name, agent in registry.agents.items()
        ]
    }

@app.post("/agents/{agent_name}")
async def call_agent_directly(agent_name: str, input_data: Dict):
    """Call a specific agent directly."""
    agent = registry.get(agent_name)
    if not agent:
        return {"error": "Agent not found"}
    
    result = agent.handler(input_data)
    return result
```

---

## Capstone

Submit:
1. Working multi-agent system
2. Routing examples showing agent selection
3. Multi-step workflow demonstration
4. Synthesis quality evaluation

---

**Build this. Deploy it. Orchestrate intelligence.**
