/**
 * activation/summit_oic.ts
 * Registers the Summit Academy OIC Tenant and its Agents into the Allternit Platform.
 */

async function registerTenant() {
  const KERNEL_URL = "http://127.0.0.1:3004";
  
  console.log("Registering Summit Academy OIC Tenant...");

  // 1. Register Agents for this Tenant
  const agents = [
    {
      id: "summit.canvas.module_builder",
      tenant_id: "summit_oic",
      name: "Summit Module Builder",
      version: "1.0.0",
      description: "Institutional agent for building Canvas modules.",
      system_prompt: "You are an expert instructional designer at Summit Academy OIC...",
      model_config: {
        provider: "anthropic",
        model_name: "claude-3-7-sonnet-20250219",
        temperature: 0.0
      },
      allowed_skills: ["summit.canvas.module_builder"],
      expertise_domains: ["education", "instructional-design"],
      created_at: Date.now(),
      updated_at: Date.now()
    }
  ];

  for (const agent of agents) {
    const res = await fetch(`${KERNEL_URL}/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agent)
    });
    if (res.ok) console.log(`✓ Registered Agent: ${agent.id}`);
    else console.error(`✗ Failed to register ${agent.id}: ${await res.text()}`);
  }

  console.log("Summit Academy OIC Activation Complete.");
}

registerTenant();
