# A://INSTITUTE — Architecture Document

**Version:** 1.0  
**Date:** 2026-04-08  
**Status:** Production  
**Derived from:** Vision.md, Requirements.md

---

## 1. System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    EXPERIENCE LAYER                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │   Web    │ │  Admin   │ │  Search  │ │ Profile  │       │
│  │   App    │ │  Studio  │ │   API    │ │   API    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│                    CONTENT SYSTEM                            │
│  Courses • Tutorials • UseCases • Paths • Credentials       │
├─────────────────────────────────────────────────────────────┤
│                   GENERATION SYSTEM                          │
│  Ingest → Parse → Classify → Outline → Generate             │
├─────────────────────────────────────────────────────────────┤
│                    REVIEW SYSTEM                             │
│  Structure • Practicality • Correctness • Brand • Unique    │
├─────────────────────────────────────────────────────────────┤
│                  VERIFICATION SYSTEM                         │
│  Submit → Auto-check → Review → Decide → Register           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Service Architecture

### 2.1 Web App (Next.js)

**Responsibilities:**
- Server-side rendering for SEO
- Client-side navigation
- Template-based page rendering
- Authentication

**Routes:**
```
/                    → Start/Home
/paths               → Paths index
/paths/:id           → Path detail
/use-cases           → Use cases index
/use-cases/:id       → Use case detail
/build               → Build/tutorials index
/build/:id           → Tutorial detail
/proof               → Proof gallery
/credentials         → Credentials overview
/credentials/:id     → Credential detail
/library             → Library index
/me                  → Learner dashboard
/me/submissions      → Submissions
```

### 2.2 Admin Studio (Next.js)

**Responsibilities:**
- Content management
- Review queue
- User management
- Analytics

**Routes:**
```
/admin/content       → Content CRUD
/admin/review        → Review queue
/admin/submissions   → Submission review
/admin/users         → User management
/admin/analytics     → Dashboard
```

### 2.3 Content API (REST/GraphQL)

**Responsibilities:**
- CRUD for all content types
- Relationship resolution
- Publishing state management
- Versioning

**Key Endpoints:**
```
GET    /api/content/courses
GET    /api/content/courses/:id
POST   /api/content/courses
PUT    /api/content/courses/:id
DELETE /api/content/courses/:id

GET    /api/content/tutorials
GET    /api/content/use-cases
GET    /api/content/paths
GET    /api/content/credentials

GET    /api/search?q=...&filter=...
```

### 2.4 Generation Service

**Responsibilities:**
- Source pack ingestion
- Draft generation
- Metadata enrichment
- Queue management

**Jobs:**
```
ingest-source        → Normalize raw input
extract-structure    → Concepts, workflows, skills
generate-course      → Course draft with modules
generate-tutorial    → Tutorial from workflow
generate-use-case    → Use case from problem
generate-rubric      → Evaluation criteria
```

### 2.5 Review Service

**Responsibilities:**
- Gate evaluation
- Review assignment
- Comment storage
- Decision tracking

**Checks:**
```
gate-structure       → Required fields present
gate-practicality    → Buildable outcomes
gate-correctness     → Technical accuracy
gate-brand           → Voice and terminology
gate-unique          → Duplicate detection
```

### 2.6 Credential Service

**Responsibilities:**
- Submission intake
- Automated validation
- Review coordination
- Badge issuance
- Registry management

**Flow:**
```
POST /submissions
  → auto-checks
  → assign reviewer
  → review against rubric
  → decision (pass/revise/reject)
  → issue credential or return
  → update registry
```

---

## 3. Data Model

### 3.1 Core Entities

```typescript
// User
interface User {
  id: string;
  email: string;
  role: 'learner' | 'reviewer' | 'admin';
  profile: Profile;
  progress: Progress[];
  submissions: Submission[];
  credentials: CredentialAward[];
  createdAt: Date;
}

// Course
interface Course {
  id: string;
  slug: string;
  title: string;
  layer: 'core' | 'ops' | 'agents';
  domain: string;
  level: number;
  outcome: string;
  description: string;
  audience: string[];
  prerequisites: string[];
  modules: Module[];
  tutorials: string[]; // Tutorial IDs
  useCases: string[];  // UseCase IDs
  capstone: ArtifactSpec;
  credentialId: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  metadata: CourseMetadata;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date;
}

// Module
interface Module {
  id: string;
  courseId: string;
  title: string;
  order: number;
  lessons: Lesson[];
  outcome: string;
}

// Lesson
interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  order: number;
  content: ContentBlock[];
  resources: Resource[];
  estimatedMinutes: number;
}

// Tutorial
interface Tutorial {
  id: string;
  slug: string;
  title: string;
  layer: 'core' | 'ops' | 'agents';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  problem: string;
  buildGoal: string;
  stack: string[];
  steps: TutorialStep[];
  failureModes: string[];
  evaluation: string[];
  artifactType: string;
  courseIds: string[];
  status: 'draft' | 'review' | 'published' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

// UseCase
interface UseCase {
  id: string;
  slug: string;
  title: string;
  role: string;
  industry: string;
  task: string;
  problem: string;
  inputs: string[];
  process: string[];
  outputs: string[];
  linkedTutorials: string[];
  linkedCourses: string[];
  status: 'draft' | 'review' | 'published' | 'archived';
}

// Path
interface Path {
  id: string;
  slug: string;
  name: string;
  description: string;
  audience: string[];
  courses: string[];
  tutorials: string[];
  duration: string;
  outcome: string;
  credentialTarget: string;
  firstProject: string;
  status: 'draft' | 'review' | 'published' | 'archived';
}

// Credential
interface Credential {
  id: string;
  slug: string;
  title: string;
  level: number;
  layer: 'core' | 'ops' | 'agents' | 'verified';
  requirements: string[];
  courseIds: string[];
  rubricId: string;
  verificationMode: 'completion' | 'artifact_review' | 'artifact_plus_demo' | 'full';
  publicRegistry: boolean;
  status: 'draft' | 'review' | 'published' | 'archived';
}

// Rubric
interface Rubric {
  id: string;
  credentialId: string;
  criteria: RubricCriterion[];
  passingScore: number;
}

interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  levels: {
    exceeds: string;
    meets: string;
    below: string;
  };
}

// Submission
interface Submission {
  id: string;
  userId: string;
  credentialId: string;
  artifactId: string;
  status: 'draft' | 'submitted' | 'in_review' | 'revision_requested' | 'approved' | 'rejected';
  autoChecks: AutoCheckResult;
  review?: Review;
  submittedAt: Date;
  reviewedAt?: Date;
}

// Artifact
interface Artifact {
  id: string;
  userId: string;
  submissionId: string;
  type: string;
  title: string;
  description: string;
  links: { label: string; url: string }[];
  files: string[]; // Storage paths
  screenshots: string[];
  demoUrl?: string;
  repoUrl?: string;
}

// Review
interface Review {
  id: string;
  submissionId: string;
  reviewerId: string;
  rubricScores: RubricScore[];
  totalScore: number;
  decision: 'pass' | 'revise' | 'reject';
  feedback: string;
  revisionNotes?: string;
  createdAt: Date;
}

// Source Pack
interface SourcePack {
  id: string;
  title: string;
  sourceType: 'docs' | 'url' | 'repo' | 'transcript' | 'notes';
  sources: SourceDocument[];
  status: 'ingesting' | 'processing' | 'ready' | 'error';
  extractedConcepts?: string[];
  extractedWorkflows?: string[];
  generatedDrafts?: string[];
  createdAt: Date;
}
```

### 3.2 Relationships

```
User 1--* Progress *--1 Course
User 1--* Submission *--1 Credential
User 1--* CredentialAward *--1 Credential

Path 1--* Course
Course 1--* Module
Module 1--* Lesson
Course *--* Tutorial
Course *--* UseCase
Course *--1 Credential

Credential 1--1 Rubric
Submission 1--1 Artifact
Submission 1--* Review

SourcePack 1--* SourceDocument
SourcePack 1--* Course (generated)
SourcePack 1--* Tutorial (generated)
```

---

## 4. Storage Strategy

### 4.1 Relational Database (PostgreSQL)

**Tables:**
- users
- profiles
- courses
- modules
- lessons
- tutorials
- use_cases
- paths
- credentials
- rubrics
- submissions
- artifacts
- reviews
- progress
- source_packs
- source_documents

### 4.2 Object Storage (S3/Cloudflare R2)

**Buckets:**
- `artifacts/` — Learner submissions
- `screenshots/` — Artifact screenshots
- `downloads/` — Library assets
- `sources/` — Source pack uploads

### 4.3 Search Index (Elasticsearch/Typesense)

**Indices:**
- `courses` — Full-text + facets
- `tutorials` — Full-text + facets
- `use_cases` — Full-text + facets
- `library` — Full-text + tags

### 4.4 Vector Store (Pinecone/Qdrant)

**Collections:**
- `source_chunks` — For generation context
- `content_semantic` — For semantic search

### 4.5 Cache (Redis)

**Keys:**
- `content:{type}:{id}` — Published content
- `search:{hash}` — Search results
- `session:{id}` — User sessions

---

## 5. API Design

### 5.1 Content API

```yaml
# OpenAPI 3.0 spec excerpt
paths:
  /courses:
    get:
      summary: List courses
      parameters:
        - name: layer
          in: query
          schema:
            enum: [core, ops, agents]
        - name: status
          in: query
          schema:
            enum: [draft, review, published, archived]
        - name: search
          in: query
          schema:
            type: string
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Course'
    
    post:
      summary: Create course
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CourseInput'
      responses:
        201:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Course'

  /courses/{id}:
    get:
      summary: Get course by ID
      responses:
        200:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Course'
    
    put:
      summary: Update course
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CourseInput'
    
    delete:
      summary: Delete course (soft delete to archived)
```

### 5.2 Search API

```yaml
paths:
  /search:
    get:
      summary: Search across content
      parameters:
        - name: q
          in: query
          required: true
        - name: type
          in: query
          schema:
            enum: [courses, tutorials, use_cases, all]
        - name: filters
          in: query
          schema:
            type: object
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  results:
                    type: array
                  facets:
                    type: object
                  total:
                    type: integer
```

### 5.3 Credential API

```yaml
paths:
  /submissions:
    post:
      summary: Submit artifact for credential
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SubmissionInput'
    
    get:
      summary: List my submissions
      
  /submissions/{id}:
    get:
      summary: Get submission status
      
  /submissions/{id}/review:
    post:
      summary: Submit review (reviewer only)
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ReviewInput'
              
  /registry:
    get:
      summary: Public credential registry
      parameters:
        - name: credential
          in: query
        - name: user
          in: query
```

---

## 6. Security Architecture

### 6.1 Authentication

- JWT-based auth
- Refresh token rotation
- OAuth providers (GitHub, Google)

### 6.2 Authorization

```typescript
// Role-based access
const permissions = {
  learner: ['read:content', 'create:submission', 'read:own'],
  reviewer: ['read:content', 'read:submissions', 'create:review'],
  admin: ['*']
};
```

### 6.3 Data Protection

- Encryption at rest (AES-256)
- TLS 1.3 in transit
- PII hashed/anonymized in logs

---

## 7. Deployment Architecture

### 7.1 Infrastructure

```
┌─────────────────────────────────────────┐
│              Cloudflare                 │
│         CDN + DDoS + WAF                │
└─────────────────────────────────────────┘
                   │
┌─────────────────────────────────────────┐
│              Vercel/Render              │
│    Web App │ Admin Studio │ API         │
└─────────────────────────────────────────┘
                   │
┌─────────────────────────────────────────┐
│              Supabase/AWS               │
│    PostgreSQL │ Redis │ Object Storage │
└─────────────────────────────────────────┘
                   │
┌─────────────────────────────────────────┐
│        Typesense / Pinecone             │
│        Search │ Vector Store            │
└─────────────────────────────────────────┘
```

### 7.2 CI/CD Pipeline

```
main branch
  → lint
  → test
  → build
  → deploy to staging
  → e2e tests
  → deploy to production
```

### 7.3 Monitoring

- Error tracking: Sentry
- Performance: Datadog/Vercel Analytics
- Uptime: Pingdom/UptimeRobot
- Logs: Logtail/Datadog

---

## 8. Scalability Plan

### Phase 1 (MVP): 0-1,000 learners
- Single web instance
- Single database
- Cached static content
- Manual review queue

### Phase 2: 1,000-10,000 learners
- Horizontal scaling for web
- Read replicas for database
- CDN for all assets
- Async job processing

### Phase 3: 10,000-100,000 learners
- Multi-region deployment
- Database sharding consideration
- Advanced caching strategies
- Automated review assistance

---

**This architecture enables the Vision. AcceptanceTests.md defines how we verify it works.**
