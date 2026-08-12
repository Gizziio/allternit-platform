# Allternit Manufacturing — Master Plan

> **STATUS:** Strategic draft — ready for productization and execution planning.  
> **LAST UPDATED:** 2026-08-08

---

## 1. Executive Summary

Allternit Manufacturing is not a 3D-print farm. It is the physical manufacturing division of Allternit LLC: a digital microfactory that designs, prototypes, and produces hardware for both internal product lines and external customers.

The division solves three problems simultaneously:

1. **Internal manufacturing sovereignty** — Allternit can produce its own compute boxes, battery systems, enclosures, racks, robotics parts, and accessories without waiting on overseas suppliers.
2. **Cash-flow generation** — Excess machine capacity is sold to local businesses as Manufacturing-as-a-Service (MaaS).
3. **Rapid product iteration** — A same-day prototype lab shortens the feedback loop from weeks to hours.

The long-term goal is to build an **AI-driven manufacturing operating system** and, eventually, a **distributed manufacturing network** where certified partner shops run Allternit software and fulfill jobs locally.

---

## 2. Strategic Thesis

Allternit is already building:

- Sovereign AI infrastructure (Local Brain, Cloud Deploy, BYOC)
- Autonomous software (Swarm ADE, agent workflows, Rails coordination)
- Branded portable compute hardware
- A learning platform (A://Labs)

A manufacturing division tightens all of these into a single loop:

```
AI software  →  hardware design  →  local prototyping  →  production  →  field feedback  →  AI software
```

Owning manufacturing means:

- Faster time-to-market for hardware products.
- Lower unit costs at low-to-medium volumes.
- A defensible moat: competitors can buy printers, but they cannot easily replicate an integrated AI + hardware + manufacturing stack.
- A new product line: the factory software itself becomes licensable.

---

## 3. Six Operating Divisions

### Division 1 — Design Studio
Where products are born.

**Capabilities:**
- Industrial design
- CAD modeling (parametric and organic)
- Reverse engineering (3D scan → CAD)
- Product optimization for manufacturability
- Material selection consulting
- Design-for-assembly (DFA) and design-for-manufacturing (DFM) reviews
- **CAD-as-a-Service:** production CAD for clients who do not have in-house modeling

**CAD-as-a-Service verticals**

This can become higher-margin than printing. Examples:
- **Real estate developers** — site models, floor-plan 3D models, digital twin geometry, marketing renders, walkable splat environments
- **Product companies** — production-ready part files, enclosures, mounting hardware
- **Startups** — full design packages for crowdfunding/hardware MVPs
- **Machine shops & factories** — reverse-engineered replacement parts, fixture drawings
- **Robotics builders** — URDF/SDF-compatible assemblies, joint brackets, end-effectors

**Tools to evaluate:**
- FreeCAD (open-source parametric CAD)
- Blender (organic / visualization / MCP-controlled)
- Onshape (cloud-native CAD, team collaboration)
- Fusion 360 (integrated CAD/CAM)
- OpenSCAD / CadQuery (code-first CAD)
- **text-to-cad** — open-source text-to-CAD harness (https://github.com/earthtojake/text-to-cad)
- Blender MCP servers for agent-driven scene control

### Division 2 — Prototype Lab
Same-day iteration for Allternit products and customer projects.

**Typical loop:**
```
Morning idea  →  CAD  →  print  →  test  →  revise  →  print again  →  final prototype
```

**Use cases:**
- Compute box enclosure fits
- Battery pack layouts
- Cooling duct airflow tests
- Rack-mount prototypes
- Robotics joint brackets
- Sensor housings

### Division 3 — Digital Manufacturing (The Print Farm)
Organized by material and capability, not by printer brand.

| Farm | Materials | Typical Products |
|------|-----------|------------------|
| Farm A — General Purpose | PLA, PETG | Fast production, visual models, low-stress parts |
| Farm B — Industrial | PETG, ABS, ASA | Outdoor, automotive, heat-resistant parts |
| Farm C — Engineering | Nylon, carbon-fiber-filled, glass-filled, polycarbonate | Structural, wear-resistant, high-temp parts |
| Farm D — Precision Resin | Resins | Dental models, miniatures, jewelry, high-detail prototypes |
| Farm E — Large Format | Large-format FDM | Enclosures, panels, furniture-scale parts |

**Later additions:**
- CNC routing
- Laser cutting / engraving
- Vacuum forming
- Electronics assembly
- PCB prototyping
- Injection molding (for high-volume products)

### Division 4 — Product Manufacturing
Allternit’s own catalog of physical products.

**AI hardware accessories:**
- Compute box enclosures and shells
- Battery packs and holders
- Cooling systems and ducts
- Docking stations
- Cable organizers
- Rack accessories

**Networking:**
- Mini rack systems
- Router / switch mounts
- Fiber organizers

**Workshop & office:**
- Laptop stands
- Phone docks
- Camera mounts
- Tool holders
- Jig systems
- Drawer organizers

**Emerging categories:**
- Agriculture: irrigation parts, sensor housings
- Energy: battery enclosures, solar brackets, monitoring cases
- Robotics: frames, brackets, end-effectors
- Home automation: mounting brackets, enclosures

### Division 5 — Manufacturing Services
Higher-margin, recurring-revenue services.

**Offerings:**
- 24-hour prototype turnaround
- Emergency replacement parts
- Low-volume manufacturing (10–10,000 units)
- Reverse engineering
- CAD modeling and redesign
- Manufacturing optimization
- On-site engineering consulting

**Target verticals:**
- Machine shops: drill guides, fixtures, jigs, spacers, alignment tools
- HVAC: duct adapters, mounting brackets, sensor housings
- Electricians: junction box adapters, labeling fixtures, conduit tools
- Construction: concrete forms, layout templates, measuring tools, pipe spacers
- Medical (where regulations permit): orthotics, positioning fixtures, anatomy models
- Universities: robotics parts, custom mounts, sensor brackets, experiment hardware
- Manufacturing plants: same-day functional replacements for broken plastic parts
- Real estate developers: site models, floor-plan 3D models, digital twin geometry, marketing renders

### Division 6 — Hardware R&D
Supports the broader Allternit ecosystem.

**Projects:**
- Portable AI stations
- Battery systems
- AI kiosks
- Edge servers
- Robotics platforms
- IoT devices
- Custom electronics enclosures

---

## 4. Revenue Model

### Target Revenue Mix

| Revenue Source | Target % |
|----------------|----------|
| Internal product manufacturing | 25% |
| B2B industrial printing / MaaS | 25% |
| Engineering & CAD services | 20% |
| CAD-as-a-Service (real estate, product, robotics) | 15% |
| Software & licensing | 5% |
| Consumer / catalog products | 5% |
| Prototyping for startups | 5% |

*Note: Software & licensing starts at 0% and grows as the Manufacturing OS matures.*

### Revenue Ladder

| Level | Activity | Margin |
|-------|----------|--------|
| 1 | Print products | Low |
| 2 | Design products | Medium |
| 3 | Engineer products | Medium-High |
| 4 | Manufacture products | Medium |
| 5 | Automate factories | High |
| 6 | License factory software | Very High |

### Software & Licensing Revenue

Manufacturing software itself becomes a product:

| Product | Description | Stage |
|---------|-------------|-------|
| **Manufacturing OS** | Quoting, scheduling, QA, inventory, customer portal | Years 5–7 |
| **CAD-as-a-Service API** | Text-to-CAD, URDF/SDF generation, DFM checks | Years 3–5 |
| **Print Farm Management** | Fleet monitoring, failure detection, automated reordering | Years 2–4 |
| **Distributed Network License** | Certified partner shops run Allternit software | Years 7–10 |

This is why the division is not just a print shop. The software that orchestrates the factory can be sold to other factories, print farms, and microfactories.

---

## 5. CAD, 3D AI & Digital Twin Tool Stack

A modern manufacturing division does not need to start with expensive proprietary CAD. A stack of open-source, AI-augmented, and paid tools can cover the full pipeline.

### Parametric & Mechanical CAD

| Tool | Cost | Best For |
|------|------|----------|
| **FreeCAD** | Free / open-source | Parametric mechanical design, enclosures, brackets |
| **OpenSCAD** | Free / open-source | Code-first parts, parametric configs |
| **CadQuery** | Free / open-source | Python-driven CAD, automation, generation |
| **Onshape** | Paid (free edu) | Cloud collaboration, team-based product design |
| **Fusion 360** | Paid | Integrated CAD/CAM, organic + mechanical |
| **SolidWorks** | Paid | Enterprise mechanical design |

### 3D AI & Generative Tools

| Tool | Cost | Best For |
|------|------|----------|
| **text-to-cad** | Free / open-source | Text → STEP/STL/3MF/GLB/URDF/SDF/gcode |
| **Blender + MCP** | Free / open-source | Agent-controlled 3D scenes, renders, organic shapes |
| **LumaLabs AI** | Paid | Photorealistic 3D captures from photos |
| **PlayCanvas SuperSplat** | Free / open-source | Browser-based Gaussian splat digital twins |
| **Spline** | Freemium | Lightweight 3D web experiences |
| **Kaedim / Meshy / Tripo3D** | Paid | AI-generated meshes from images/text |

### Capture & Reverse Engineering

| Tool | Cost | Best For |
|------|------|----------|
| **Photogrammetry (Meshroom / Metashape)** | Free / paid | 3D models from photos |
| **3D scanners (Revopoint, Artec)** | Hardware | Accurate part replication |
| **LingBot-Depth / depth refinement** | Varies | Cleaner depth maps from RGB-D sensors |

### Slicing & Machine Control

| Tool | Cost | Best For |
|------|------|----------|
| **OrcaSlicer / Bambu Studio** | Free | FDM/Resin slicing, printer control |
| **PrusaSlicer** | Free | Reliable profiles, open ecosystem |

### Recommended Starting Stack

1. **FreeCAD** + **CadQuery** for mechanical design automation
2. **text-to-cad** for rapid concept generation and URDF/robotics exports
3. **Blender + MCP** for visualization, renders, and agent-driven modeling
4. **PlayCanvas SuperSplat** for real estate / digital twin walkthroughs
5. **OrcaSlicer** for printer control and gcode generation

---

## 6. Robotics & Hardware Design Resources

Saved research from Twitter bookmarks provides a head start on robotics hardware design.

### Open-Source Humanoid Robots

| Project | Price | Notes |
|---------|-------|-------|
| **Asimov 1** | ~$15K target DIY kit | Full open-source stack, DIY kit available |
| **Berkeley Humanoid Lite** | sub-$5K | Open-source 3D-printed humanoid |
| **HopeJR** | ~$3K | Fully open-source humanoid from Hugging Face |
| **ROBOTIS K0** | TBA | Full-size open-source humanoid platform |
| **Vibe A1** | starting at $649 | Mini humanoid |

### Interactive Component Reference

- **humanityslastmachine.com** — interactive breakdown of humanoid robot components: skeleton, motors, batteries, reducers, sensors, cost breakdowns, and sourcing. Click through real robots (Boston Dynamics, Apollo, etc.) and watch spec sheets update.

### Robotics CAD Media

- `/Users/joe/Desktop/Twitter Bookmarks - twitter-web-exporter/organized/tech/robotics-cad/` — saved videos (ctorobotics) covering robotics CAD workflows.

### Real Estate / Digital Twin Reference

- **PlayCanvas SuperSplat Walk Mode** — browser-based photorealistic digital twins of homes. Relevant for real estate CAD-as-a-Service.
  - Tweet: https://x.com/willeastcott/status/2036771869206995049

---

## 7. The Allternit Manufacturing Stack

A software-controlled pipeline:

```
Customer
    ↓
Website / Sales Portal
    ↓
AI Quoting Agent
    ↓
Engineering Review
    ↓
CAD / CAM Prep
    ↓
Production Queue
    ↓
Printer / Machine Assignment
    ↓
Camera Monitoring & Failure Detection
    ↓
Quality Inspection
    ↓
Inventory
    ↓
Packaging & Shipping
    ↓
Invoice & Accounting
    ↓
Customer Portal
```

### Core Software Components

| Component | Purpose | Candidate Tech |
|-----------|---------|----------------|
| CRM / Orders | Job intake, customer history | Custom or n8n + Postgres |
| AI Quoting | Estimate time, material, cost | Local LLM + geometry heuristics |
| CAD Pipeline | Model storage, version control, text-to-CAD | Git + CadQuery + text-to-CAD APIs |
| Print Queue | Schedule jobs across machines | Custom scheduler + Prusa/Orca APIs |
| Machine Monitoring | Camera-based failure detection | Computer vision on Local Brain |
| Quality Control | Dimensional checks, defect detection | CV + caliper integration |
| Inventory | Filament, parts, packaging | RFID / barcode + SQLite/Postgres |
| Shipping | Labels, carrier integration | ShipStation API, UPS/FedEx APIs |
| Invoicing | Billing, payments | Stripe, QuickBooks API |
| Customer Portal | Order status, reorder, quotes | Next.js surface |

---

## 8. AI Agent Roles

The factory is orchestrated by specialized agents:

| Agent | Responsibility |
|-------|----------------|
| **Sales Agent** | Receives requests, asks clarifying questions, generates quotes |
| **Engineering Agent** | Validates CAD, checks tolerances, suggests DFM improvements |
| **Manufacturing Agent** | Schedules printers, chooses filament, estimates completion |
| **Operations Agent** | Orders filament, tracks inventory, predicts shortages |
| **Quality Agent** | Uses computer vision to detect defects and reject bad parts |
| **Customer Agent** | Updates order status, sends shipping notifications, collects feedback |
| **Fleet Agent** | Monitors printer health, schedules maintenance, detects failures |

These agents map naturally onto Allternit’s existing agent infrastructure (Swarm ADE, Rails, Computer Use).

---

## 9. Factory Layout

Single-direction flow to minimize movement:

```
Receiving → Material Storage → Filament Dry Room → Printer Farm → Cleaning
    → Quality Control → Assembly → Packaging → Shipping
```

### Phase 1 — Starter Lab (Months 1–3)
- 3 printers (general-purpose FDM)
- 1 workbench
- 1 CAD workstation
- 1 filament rack + dry cabinet
- 1 shipping station
- 1 camera per printer

### Phase 2 — Mini Factory (Months 4–12)
- 10 printers (mixed FDM + 1 resin)
- Dedicated print room with ventilation
- Shelving + RFID inventory
- Automated labeling + barcode tracking
- Basic CRM/queue software

### Phase 3 — Automated Microfactory (Year 2+)
- 40 printers (mixed farms)
- Robot cart / conveyor
- AI scheduling
- Automated quality inspection
- Lights-out overnight operation

---

## 10. Build Phases

### Phase 1 — Validate (Months 1–3)
**Goal:** Prove cash flow and internal value.

- Buy 3 reliable FDM printers (e.g., Bambu Lab P1S or Prusa XL)
- Set up one print station
- Print first Allternit internal parts (compute box prototype, cable organizer)
- Take 3–5 B2B pilot customers
- Ship first paid orders
- Document time/material cost for every job

**Success metric:** $2k–$5k monthly revenue and 5+ internal prototypes delivered.

### Phase 2 — Scale (Months 4–12)
**Goal:** Build recurring revenue and specialization.

- Expand to 10 printers
- Add resin printer for precision parts
- Launch 3–5 standard service packages (prototype, replacement part, low-volume run)
- Hire one technician / operator
- Release internal manufacturing queue software
- Add one B2B retainer client

**Success metric:** $10k+ monthly revenue, 50% repeat customers.

### Phase 3 — Automate (Year 2)
**Goal:** Software-driven factory.

- 40 printers across material-specific farms
- AI scheduling and failure detection
- Automated quoting from uploaded STL/STEP
- Customer portal live
- First proprietary catalog products selling online

**Success metric:** $30k+ monthly revenue, 24-hour prototype SLA.

---

## 11. Ten-Year Roadmap

| Years | Focus | Milestones |
|-------|-------|------------|
| 1–2 | Profitable microfactory | 5–20 printers, B2B focus, internal hardware production |
| 3–5 | Expanded capabilities | CNC, laser, electronics assembly, proprietary product catalog |
| 5–7 | Manufacturing OS | Release Allternit Manufacturing OS for quoting, scheduling, QA, inventory |
| 7–10 | Distributed network | Certified partner shops run Allternit software; Allternit becomes orchestration layer |

---

## 12. Equipment & Materials Roadmap

### FDM Printers
- **Workhorse:** Bambu Lab P1S / X1 Carbon or Prusa XL
- **Budget starter:** Prusa MK4, Creality K1 Max
- **Large format:** Creality K1 Max, Voron 2.4

### Resin Printers
- **Desktop precision:** Elegoo Saturn 4 Ultra, Formlabs Form 4 (if budget allows)

### Materials
| Material | Use Case |
|----------|----------|
| PLA | Prototypes, indoor parts, low load |
| PETG | General purpose, outdoor, chemical resistance |
| ABS / ASA | Heat resistance, automotive, outdoor UV |
| Nylon | Wear parts, gears, structural |
| Carbon-fiber nylon | High stiffness, lightweight |
| Polycarbonate | Impact resistance, high temp |
| Resin | Detail, dental, miniatures |

### Post-Processing
- Wash + cure station
- Heat treatment oven (for nylon/ABS)
- Sanding / vapor smoothing station
- Ultrasonic cleaner

### Metrology
- Digital calipers
- Thread gauges
- Go/no-go fixtures
- Optical comparator (later)

---

## 13. Operating Procedures

### Standard Workflow
1. **Intake** — Customer submits request (file upload + description).
2. **Review** — Engineering checks geometry, tolerances, material suitability.
3. **Quote** — AI + human review generates price and lead time.
4. **Approval** — Customer approves quote and payment.
5. **Prep** — Slice model, assign printer, load filament.
6. **Print** — Machine runs with camera monitoring.
7. **Inspect** — Dimensional checks + visual QA.
8. **Finish** — Support removal, cleaning, post-curing if needed.
9. **Package** — Label, protect, prepare for shipment.
10. **Ship** — Generate label, hand to carrier.
11. **Follow-up** — Customer feedback, reorder prompt.

### Quality Tiers
| Tier | Description | Use Case |
|------|-------------|----------|
| Prototype | Functional, dimensional tolerance ±0.5mm | Internal R&D, fit checks |
| Production | Tighter tolerance, consistent finish | Customer parts, low-volume production |
| Precision | Inspection report, tighter control | Medical-adjacent, critical fit |

---

## 14. Integration with Allternit Ecosystem

| Allternit Product | Manufacturing Integration |
|-------------------|---------------------------|
| **Local Brain** | Runs CAD, slicing, queue, and vision QA offline |
| **Computer Use** | Monitors printers, captures failure images, interacts with printer UIs |
| **Swarm ADE** | Orchestrates sales, engineering, scheduling, QA, and customer agents |
| **Allternit Code** | Builds and maintains manufacturing software |
| **Canvas** | Documents procedures, specs, and customer reports |
| **Cowork** | Coordinates human operators and engineers |
| **A://Labs** | Trains team and certifies operators |
| **Cloud Deploy** | Hosts customer portal and manufacturing backend |

---

## 15. External References & Inspiration

The following bookmark collections on the Desktop contain relevant research:

- `/Users/joe/Desktop/Twitter Bookmarks - twitter-web-exporter/knowledge-base/01-allternit-feature-ideas.md`
  - Robotics industry compression, open-source humanoid robots (Asimov 1), local AI hardware, robotics learning roadmaps.
- `/Users/joe/Desktop/Twitter Bookmarks - twitter-web-exporter/knowledge-base/02-tools-and-repos.md`
  - Local AI hardware tools, MCP servers, embedded systems, vision agents.
- `/Users/joe/Desktop/Twitter Bookmarks - twitter-web-exporter/knowledge-base/04-ai-and-dev-general.md`
  - AI agents, computer vision, automation patterns.
- `/Users/joe/Desktop/Twitter Bookmarks - twitter-web-exporter/knowledge-base/05-personal.md`
  - Personal hardware/DIY projects and inspiration.

### Notable bookmarks already surfaced
- **Asimov 1** — open-source humanoid robot (DIY kit + BOM): https://asimov.inc/diy-kit
- **Top 5 open-source humanoid robots** — Asimov 1, Berkeley Humanoid Lite, HopeJR, ROBOTIS K0, Vibe A1: https://x.com/clankrmedia/status/2073686289392496881
- **humanityslastmachine.com** — interactive humanoid robot component breakdowns, cost sheets, sourcing.
- **text-to-cad** — open-source text-to-CAD harness (STEP, STL, URDF, SDF, gcode): https://github.com/earthtojake/text-to-cad
- **Blender MCP** — agent-controlled Blender scenes and renders.
- **PlayCanvas SuperSplat Walk Mode** — browser-based real estate digital twins: https://x.com/willeastcott/status/2036771869206995049
- **Robotics CAD media** — saved videos in `/Users/joe/Desktop/Twitter Bookmarks - twitter-web-exporter/organized/tech/robotics-cad/`.

### Open research tasks
- [x] Curate text-to-CAD tools and MCP servers from bookmarks.
- [ ] Collect print-farm business case studies and pricing models.
- [ ] Build a CAD/model library for Allternit compute boxes and accessories.
- [ ] Evaluate open-source manufacturing execution systems (MES).
- [ ] Survey open-source 3D-printer fleet management software.
- [ ] Build pricing model for real estate CAD-as-a-Service (site models, floor plans, digital twins).
- [ ] Evaluate paid CAD tools for team scale (Onshape vs Fusion 360 vs SolidWorks).

---

## 16. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Printer downtime | Maintain spare hotends, nozzles, belts; keep redundant capacity |
| Failed prints | Camera monitoring + AI failure detection; reprint policies |
| Material moisture | Dry cabinets + desiccant + filament tracking |
| Tolerance issues | Standardize machine profiles; qualify each printer |
| Regulatory (medical) | Stay in general industrial / consumer markets until compliance is established |
| Cash flow | Diversify revenue; avoid dependency on one client or product |

---

## 17. Success Metrics

| Metric | Phase 1 | Phase 2 | Phase 3 |
|--------|---------|---------|---------|
| Printers | 3 | 10 | 40 |
| Monthly revenue | $2k–$5k | $10k+ | $30k+ |
| Repeat customers | 20% | 50% | 60% |
| Internal prototypes / month | 5 | 15 | 40 |
| Average quote time | 24h | 4h | 15 min (AI) |
| First article lead time | 3 days | 24h | 4h |

---

## 18. Next Steps

1. **Approve this master plan** and decide on Phase 1 budget.
2. **Validate CAD-as-a-Service pricing** — reach out to 2–3 real estate developers or product companies.
3. **Select first printers** and order starter equipment.
4. **Reserve physical space** (print room, ventilation, power).
5. **Choose CAD/CAM toolchain** (FreeCAD + CadQuery + text-to-cad evaluation recommended).
6. **Build internal part backlog** — list every Allternit product that needs a printed component.
7. **Identify 5 pilot B2B customers** for replacement parts, prototypes, or CAD services.
8. **Create manufacturing queue software** MVP in Allternit codebase.
9. **Prototype text-to-cad pipeline** — generate one Allternit part from a text prompt.
10. **Draft A://Labs course** on building a digital microfactory.

---

## 19. Document Index

| Document | Purpose |
|----------|---------|
| `ALLTERNIT_MANUFACTURING_MASTER_PLAN.md` | This file. Strategic overview and 10-year roadmap. |
| `ALLTERNIT_MANUFACTURING_SOFTWARE_SPEC.md` *(planned)* | Queue, quoting, scheduling, agent architecture. |
| `ALLTERNIT_MANUFACTURING_EQUIPMENT_ROADMAP.md` *(planned)* | Printer selections, materials, post-processing, layout. |
| `ALLTERNIT_MANUFACTURING_PRODUCT_CATALOG.md` *(planned)* | Allternit-branded physical products and specs. |
| `ALLTERNIT_MANUFACTURING_OPERATIONS_MANUAL.md` *(planned)* | SOPs, quality tiers, safety, maintenance. |

---

*This plan is a living document. Update it as the division moves through phases.*
