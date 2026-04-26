# Allternit Manufacturing Strategy

Date: 2026-04-07

## Thesis

Allternit should not begin by trying to become a custom AI chip company.

That path is too capital-intensive, too long-cycle, and too dependent on advanced silicon design, foundry access, packaging, validation, and channel relationships to fit an SBA 7(a)-aligned first manufacturing move.

The stronger move is:

1. Use the existing Allternit software platform as the control plane.
2. Launch a manufacturing arm around AI infrastructure appliances and retrofit automation systems.
3. Build profit and lender credibility through assembly, integration, deployment, monitoring, and service revenue.
4. Only explore custom silicon later, after Allternit has repeatable revenue, customer data, and a justified hardware architecture.

## What The Codebase Already Gives You

### Core strengths

The current codebase is not a manufacturing system yet, but it does contain the right primitives for becoming a hardware and robotics control plane:

- Multi-provider AI harness and SDK in [/Users/macbook/packages/sdk/src/index.ts](/Users/macbook/packages/sdk/src/index.ts#L1)
- AI gateway and streaming backend in [/Users/macbook/src/runtime/server/routes/ai-gateway.ts](/Users/macbook/src/runtime/server/routes/ai-gateway.ts#L1)
- Agent orchestration and workflow abstractions in [/Users/macbook/Desktop/Allternit-Platform-Source/src/lib/agents/agent.service.ts](/Users/macbook/Desktop/Allternit-Platform-Source/src/lib/agents/agent.service.ts#L1)
- Desktop and shell UX for operators in [/Users/macbook/Desktop/Allternit-Platform-Source/src/app/shell/page.tsx](/Users/macbook/Desktop/Allternit-Platform-Source/src/app/shell/page.tsx#L1)
- Infrastructure UI patterns for remote systems and telemetry in [/Users/macbook/Desktop/Allternit-Platform-Source/src/components/infrastructure/VpsMetricsDashboard.tsx](/Users/macbook/Desktop/Allternit-Platform-Source/src/components/infrastructure/VpsMetricsDashboard.tsx#L1)
- A broad agent platform direction documented in [/Users/macbook/Desktop/Allternit-Platform-Source/src/lib/agents/README.md](/Users/macbook/Desktop/Allternit-Platform-Source/src/lib/agents/README.md#L1)

In plain terms: Allternit already looks like a software operating layer for deployed compute, agents, and workflows.

That is exactly the right foundation for:

- edge AI boxes
- managed local inference appliances
- industrial retrofit kits
- robot-cell orchestration
- hardware fleet monitoring

### Gaps that matter before manufacturing

The codebase also shows clear production gaps:

- The AI gateway still uses legacy imports and mock-style auth paths in [/Users/macbook/src/runtime/server/routes/ai-gateway.ts](/Users/macbook/src/runtime/server/routes/ai-gateway.ts#L8) and [/Users/macbook/src/runtime/server/routes/ai-gateway.ts](/Users/macbook/src/runtime/server/routes/ai-gateway.ts#L141)
- The platform docs explicitly say the frontend is ahead of backend service verification in [/Users/macbook/Desktop/Allternit-Platform-Source/docs/BACKEND_SERVICES_CHECKLIST.md](/Users/macbook/Desktop/Allternit-Platform-Source/docs/BACKEND_SERVICES_CHECKLIST.md#L1)
- The component audit says test coverage is very low and integration remains incomplete in [/Users/macbook/Desktop/Allternit-Platform-Source/docs/COMPONENT_GAPS.md](/Users/macbook/Desktop/Allternit-Platform-Source/docs/COMPONENT_GAPS.md#L1)
- Infrastructure metrics are partly simulated today, for example random network I/O placeholders in [/Users/macbook/Desktop/Allternit-Platform-Source/src/components/infrastructure/VpsMetricsDashboard.tsx](/Users/macbook/Desktop/Allternit-Platform-Source/src/components/infrastructure/VpsMetricsDashboard.tsx#L81)

That means Allternit is currently closer to:

- control plane UI
- agent runtime platform
- orchestration shell

than to:

- hardened device fleet manager
- manufacturing execution system
- field-service platform
- quality/compliance stack

## Strategic Conclusion

The best manufacturing entry is not "make AI chips."

The best manufacturing entry is a three-layer business:

1. Allternit Compute
   Pre-configured AI compute appliances with local models, remote management, and vertical software.

2. Allternit Automation
   Retrofit AI/robotics systems for existing machinery and repetitive production tasks.

3. Allternit Ops
   Monitoring, OTA updates, workflow deployment, analytics, uptime support, and service contracts.

This lets you manufacture and profit without taking on wafer-scale R&D risk.

## Best Initial Product Wedges

### Wedge 1: Edge AI compute boxes

Build small-footprint AI appliances for:

- private local inference
- factory vision
- warehouse intelligence
- on-prem copilots
- regulated environments
- air-gapped deployments

What you sell:

- a boxed appliance
- models preloaded and tuned for the customer
- remote management
- support and updates
- workflow integrations

This is the fastest path from software company to manufacturer.

### Wedge 2: Retrofit vision and automation kits

Build add-on systems for existing machinery:

- camera + edge AI inspection kits
- failure detection kits
- operator guidance systems
- robotic palletizing / case-packing integrations
- cobot tenders for repetitive cells

This is usually easier to sell than net-new robotics because customers already own the line and only need throughput, labor relief, quality gains, or uptime.

### Wedge 3: Managed robot-cell deployments

Package:

- robot arm or cobot
- vision system
- gripper/end effector
- safety package
- local compute box
- Allternit orchestration software

Sell it as a managed system with monthly software/support revenue.

## Inspiration From Current Companies

### Tiny Corp / tinybox

Why it matters:

- It proves that a small company can package AI compute into a distinctive appliance instead of waiting to invent new silicon.
- The model is hardware plus opinionated software plus direct positioning.

What to copy:

- clear form factor
- simple SKU strategy
- pre-integrated stack
- direct buyer narrative around local AI and performance per dollar

What not to copy:

- overly broad hardware ambition too early
- brand built around enthusiast buyers only

Source:

- tinygrad says it sells a computer called the tinybox and lists shipping configurations and specs: https://tinygrad.org/

### Tenstorrent

Why it matters:

- It shows the long-term vision for vertically integrated AI compute.
- It is a useful inspiration for architecture and packaging ambition, not for your first financing phase.

What to copy:

- systems thinking
- dense compute packaging
- hardware + software stack mentality

What not to copy now:

- custom processor development as your first commercial product

Source:

- Tenstorrent describes Galaxy as a rack-mounted AI compute system built on an Ethernet-based mesh of 32 Wormhole processors: https://tenstorrent.com/en/hardware/galaxy

### Groq

Why it matters:

- It shows how differentiated AI hardware can become valuable when attached to clear deployment models.
- It also shows that on-prem inference matters for regulated and air-gapped environments.

What to copy:

- on-prem deployment option
- inference-focused positioning
- regulated-market narrative

Source:

- Groq says the LPU powering GroqCloud can be deployed on-prem with GroqRack for regulated or air-gapped environments: https://groq.com/groqcloud

### NVIDIA Jetson

Why it matters:

- This is the most realistic early hardware base for robotics, machine vision, and edge AI products.
- You can build profitable manufactured systems on top of modules like these without inventing your own chip.

What to copy:

- module-based product line
- developer-kit-to-production path
- robotics + computer vision + GenAI positioning

Source:

- NVIDIA says Jetson Orin developer kits and modules are for generative AI, robotics, and computer vision, with Orin module variants spanning different power/performance ranges: https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/

### Hailo

Why it matters:

- Hailo is a strong example of AI accelerators designed specifically for edge deployment.
- It is especially relevant if you want compact, lower-power, production-grade inference appliances and vision kits.

What to copy:

- edge-first economics
- privacy-preserving on-device inference
- modular accelerator SKU strategy

Source:

- Hailo says it develops AI processors specifically for edge AI and lists accelerators and modules across robotics, security, and physical AI applications: https://hailo.ai/

### Bright Machines

Why it matters:

- This is the strongest strategic inspiration for Allternit Automation.
- Their core idea is software-defined manufacturing: an AI software layer that configures, monitors, and manages machines and operations.

What to copy:

- software-defined manufacturing
- cell-level automation before full factory replacement
- assembly and inspection focus

Source:

- Bright Machines says its microfactories combine software, machine learning, computer vision, and adaptive robotics into a software-defined manufacturing approach: https://www.brightmachines.com/news/bright-machines-delivers-first-software-defined-microfactory/

### Intrinsic

Why it matters:

- Intrinsic represents the "software layer for industrial robotics" thesis.
- That aligns closely with where Allternit software is strongest.

What to copy:

- capabilities-based robotics software
- motion/perception abstractions
- hardware-agnostic orchestration

Source:

- Intrinsic describes ready-to-use capabilities for perception, motion planning, and sensor-based controls: https://www.intrinsic.ai/

### Universal Robots

Why it matters:

- Cobots are one of the most realistic ways to enter robotics without building full custom robots from scratch.
- They fit small and midsize factories and repetitive workflows well.

What to copy:

- fast deployment
- flexibility across use cases
- reuse across batches and changeovers

Source:

- Universal Robots positions its e-Series cobots around productivity, flexibility, and repetitive-task automation: https://www.universal-robots.com/

### Formic

Why it matters:

- Formic is important because it changes the business model, not just the hardware.
- This is likely closer to how Allternit should sell automation than pure CapEx equipment sales.

What to copy:

- fixed monthly automation pricing
- support + maintenance + uptime bundled
- software plus hardware plus service
- low-friction adoption for manufacturers

Source:

- Formic says its Full Service Automation provides equipment, service, and software for one fixed monthly price, with $0 CapEx and 24/7 support: https://formic.co/
- Formic fact sheet describes the model as automation delivered with equipment, support, maintenance, and software: https://www.datocms-assets.com/43704/1770915939-formic-fact-sheet-2025-9.pdf

## Recommended Allternit Product Architecture

### Product line A: Allternit Forge Node

A compact AI compute appliance for industrial and enterprise edge deployment.

Example use cases:

- local copilots
- document and knowledge retrieval
- private agent execution
- machine vision inference
- operator stations
- on-prem workflow automation

Likely first hardware stack:

- NVIDIA Jetson, Hailo, or x86 + GPU/NPU configuration
- rugged mini enclosure
- local SSD
- optional cameras/sensors
- remote admin plane
- preinstalled Allternit runtime

### Product line B: Allternit Forge Cell

A packaged automation cell:

- cobot or industrial arm
- vision
- local compute node
- workflow engine
- monitoring and service dashboard

Likely first use cases:

- palletizing
- case packing
- pick-and-place
- visual inspection
- operator assist

### Product line C: Allternit Forge Retrofit

Add AI and automation to existing machinery:

- computer vision QA
- predictive maintenance
- anomaly detection
- digital work instructions
- safety and event logging

This is probably the highest-probability near-term revenue line.

## What To Build In Software Next

To become a manufacturing and hardware company, the platform needs new system layers.

### Must-build platform capabilities

1. Device registry
   Track serial number, BOM version, firmware version, deployed models, customer site, warranty, service history.

2. Provisioning and imaging
   Factory image creation, secure onboarding, device identity, secrets bootstrap.

3. OTA and fleet management
   Roll out OS updates, model updates, configuration changes, rollback policies.

4. Real telemetry
   Replace simulated metrics with actual CPU, memory, disk, network, thermals, camera health, accelerators, error codes.

5. Manufacturing records
   Build traveler, assembly checklist, QC signoff, burn-in logs, shipment release.

6. Field service workflow
   RMAs, diagnostics, remote support sessions, replacement workflows.

7. Customer deployment templates
   Vertical-specific packaged configurations for warehouse, packaging, inspection, private AI, and robotics.

### Recommended new modules

- `src/lib/devices`
- `src/lib/fleet`
- `src/lib/provisioning`
- `src/lib/ota`
- `src/lib/manufacturing`
- `src/lib/qc`
- `src/lib/robotics`
- `src/components/fleet`
- `src/components/manufacturing`
- `src/components/service`

## Commercial Path To Profitability

### Stage 1: Integrator-manufacturer

Do this first:

- buy compute modules and standard components
- design enclosure, image, software, and packaging
- assemble in-house or via contract manufacturer
- sell high-margin integrated systems and recurring support

Revenue mix:

- hardware gross margin
- installation fees
- recurring software subscriptions
- support / uptime contracts
- professional services

### Stage 2: Contract-manufactured branded systems

After the first repeatable customers:

- move to repeatable SKUs
- lock BOMs
- shift more assembly to a CM
- create burn-in and QC process
- certify and insure the product line

### Stage 3: Selective custom boards

Only after the business proves demand:

- custom carrier boards
- custom IO boards
- sensor fusion modules
- robot controller boards

This is where real hardware IP begins.

### Stage 4: Silicon exploration

Only much later:

- accelerator module
- ASIC partnership
- packaging or chiplet strategy

This should be treated as a long-term R&D horizon, not the first business plan.

## SBA 7(a) Loan Fit

### What the official SBA pages say

The SBA states that 7(a) loans can be used for:

- short- and long-term working capital
- purchasing and installation of machinery and equipment
- supplies
- multiple-purpose loans

Official sources:

- 7(a) loans overview: https://www.sba.gov/funding-programs/loans/7a-loans
- 7(a) terms and eligibility: https://www.sba.gov/partners/lenders/7a-loan-program/terms-conditions-eligibility

The SBA also says 504 loans are for major fixed assets and cannot be used for working capital or inventory.

Official source:

- 504 loans: https://www.sba.gov/funding-programs/loans/504-loans

### Practical implication for Allternit

For your stated goal, the clean financing story is:

- 7(a) for working capital, inventory, payroll, machinery installation, launch operations, and mixed use
- potentially 504 later for major fixed assets like facility buildout or long-life equipment

### Eligibility framing

SBA says eligible 7(a) borrowers must:

- be an operating business
- operate for profit
- be located in the U.S.
- be small under SBA size requirements
- be creditworthy and able to repay

Official source:

- https://www.sba.gov/partners/lenders/7a-loan-program/terms-conditions-eligibility

Important inference:

- A public benefit corporation is still a for-profit corporation, so PBC status itself should not be the issue. The key issue is whether Allternit is operated for profit, meets SBA size standards, and can demonstrate repayment ability.

### Manufacturing size standards

SBA size standards vary by NAICS code. For relevant manufacturing categories, the eCFR table shows examples such as:

- 334111 Electronic Computer Manufacturing: 1,250 employees
- 334118 Computer Terminal and Other Computer Peripheral Equipment Manufacturing: 1,000 employees
- 334413 Semiconductor and Related Device Manufacturing: 1,250 employees
- 333998 All Other Miscellaneous General Purpose Machinery Manufacturing: 700 employees
- 333993 Packaging Machinery Manufacturing: 600 employees

Official source:

- https://www.ecfr.gov/current/title-13/chapter-I/part-121

This matters because your loan package should choose the NAICS story carefully. You do not want to position Allternit primarily as speculative R&D. You want it positioned as an operating U.S. business manufacturing and deploying AI infrastructure systems and automation equipment.

## What Lenders Will Need To See

For a strong 7(a) manufacturing working-capital case, Allternit needs:

1. Clear product definition
   Not "AI chips someday." Instead: named SKUs, target customer, BOM range, price, margin.

2. Revenue model
   Hardware margin plus recurring software/support revenue.

3. Use of proceeds
   Inventory, assembly equipment, tooling, certifications, early hires, working capital, installation costs.

4. Repayment logic
   Signed pilots, LOIs, channel pipeline, or at minimum a believable sales funnel and gross margin structure.

5. Management execution narrative
   Why this team can build, integrate, deploy, and service these systems.

6. Manufacturing plan
   In-house assembly vs CM, QA steps, lead times, vendors, burn-in, warranty reserve.

## Recommended 18-Month Plan

### Phase 0: 0-90 days

- Decide first wedge: compute box or retrofit automation
- Choose one vertical
- Lock first 2-3 SKUs
- Build lender-ready operating model
- Create BOMs and margin model
- Build customer discovery pipeline

### Phase 1: 3-6 months

- Build pilot units
- Add device registry, telemetry, provisioning, OTA
- Secure pilot customers
- Establish CM and key supplier relationships
- Build QC and service procedures

### Phase 2: 6-12 months

- Convert pilots into deployments
- Launch support contracts
- Create repeatable installation playbooks
- Add financing-friendly KPIs: backlog, deployed units, MRR/ARR, gross margin, uptime

### Phase 3: 12-18 months

- Expand SKU family
- Add robotics/retrofit line
- Pursue 7(a) or follow-on financing using real deployment data
- Evaluate selective custom board design

## Immediate Recommendation

If the goal is to become manufacturing-capable and profitable while staying compatible with a 7(a) working-capital loan narrative, Allternit should:

1. Start with AI infrastructure appliances and retrofit automation, not custom AI chips.
2. Use the current software platform as the orchestration layer.
3. Build recurring revenue around deployment, support, and fleet operations.
4. Position the business as a U.S. manufacturer/integrator of AI infrastructure and automation systems.
5. Treat custom silicon as a later strategic option, not the opening act.

## Source Links

- SBA 7(a): https://www.sba.gov/funding-programs/loans/7a-loans
- SBA 7(a) terms and eligibility: https://www.sba.gov/partners/lenders/7a-loan-program/terms-conditions-eligibility
- SBA Lender Match: https://www.sba.gov/funding-programs/loans/lender-match-connects-you-lenders
- SBA 504: https://www.sba.gov/funding-programs/loans/504-loans
- SBA size standards / eCFR: https://www.ecfr.gov/current/title-13/chapter-I/part-121
- tinygrad / tinybox: https://tinygrad.org/
- Tenstorrent Galaxy: https://tenstorrent.com/en/hardware/galaxy
- GroqCloud / GroqRack: https://groq.com/groqcloud
- NVIDIA Jetson Orin: https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/
- Hailo: https://hailo.ai/
- Bright Machines microfactories: https://www.brightmachines.com/news/bright-machines-delivers-first-software-defined-microfactory/
- Intrinsic: https://www.intrinsic.ai/
- Universal Robots: https://www.universal-robots.com/
- Formic: https://formic.co/
- Formic fact sheet: https://www.datocms-assets.com/43704/1770915939-formic-fact-sheet-2025-9.pdf
