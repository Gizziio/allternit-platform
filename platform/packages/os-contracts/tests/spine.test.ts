import { describe, expect, it } from 'vitest'
import {
  CONTRACT_SPINE_STATUS,
  CONTRACT_SPINE_VERSION,
  approvalSchema,
  artifactSchema,
  capabilitySchema,
  capabilityKindSchema,
  eventSchema,
  fabricEventSchema,
  fabricInvocationReceiptSchema,
  fabricTransportSchema,
  leaseSchema,
  nodeEndpointSchema,
  nodeIdentitySchema,
  nodeResourceSchema,
  programManifestSchema,
  receiptSchema,
  workloadSchema,
} from '../src/index'

const NOW = '2026-08-04T00:00:00.000Z'

function validWorkload() {
  return {
    id: 'wl-1',
    programId: 'allternit.office',
    kind: 'office.document.parse',
    status: 'succeeded',
    leaseIds: ['lease-1'],
    createdAt: NOW,
    updatedAt: NOW,
  }
}

describe('contract spine (DRAFT)', () => {
  it('is explicitly marked provisional', () => {
    expect(CONTRACT_SPINE_STATUS).toBe('DRAFT-pending-ADR-ratification')
    expect(CONTRACT_SPINE_VERSION).toContain('draft')
  })

  it('accepts a valid workload and rejects a bad status', () => {
    expect(() => workloadSchema.parse(validWorkload())).not.toThrow()
    expect(() => workloadSchema.parse({ ...validWorkload(), status: 'maybe' })).toThrow()
  })

  it('accepts a valid artifact with provenance and checksum', () => {
    const artifact = {
      id: 'art-1',
      workspaceId: 'ws-1',
      type: 'office-document',
      title: 'Spec',
      status: 'draft',
      version: 3,
      checksum: 'c81e728d9d4c2f63',
      checksumAlgo: 'fnv1a64',
      provenance: { workloadId: 'wl-1', programId: 'allternit.office' },
      createdAt: NOW,
      updatedAt: NOW,
    }
    expect(() => artifactSchema.parse(artifact)).not.toThrow()
    expect(() => artifactSchema.parse({ ...artifact, version: 0 })).toThrow()
    expect(() => artifactSchema.parse({ ...artifact, checksumAlgo: 'md5' })).toThrow()
  })

  it('accepts capabilities, leases, receipts, approvals, and events', () => {
    const capability = {
      id: 'cap-1',
      name: 'office.docx.edit',
      version: '1',
      kind: 'write',
      resource: 'artifact:office-document',
    }
    expect(() => capabilitySchema.parse(capability)).not.toThrow()
    expect(() => capabilitySchema.parse({ ...capability, kind: 'admin' })).toThrow()

    const lease = {
      id: 'lease-1',
      capabilityId: 'cap-1',
      grantee: 'allternit.office',
      issuedAt: NOW,
      status: 'active',
    }
    expect(() => leaseSchema.parse(lease)).not.toThrow()

    const receipt = {
      id: 'rcpt-1',
      workloadId: 'wl-1',
      status: 'succeeded',
      artifactIds: ['art-1'],
      issuedAt: NOW,
    }
    expect(() => receiptSchema.parse(receipt)).not.toThrow()

    const approval = { id: 'appr-1', workloadId: 'wl-1', prompt: 'Overwrite file?', status: 'pending' }
    expect(() => approvalSchema.parse(approval)).not.toThrow()

    const event = { id: 'evt-1', type: 'artifact.created', at: NOW, source: 'allternit.office', subject: 'art-1' }
    expect(() => eventSchema.parse(event)).not.toThrow()
  })

  it('accepts the program manifest shape used by programs/office', () => {
    const manifest = {
      programId: 'allternit.office',
      name: 'Documents & Office',
      version: '0.1.0',
      status: 'provisional',
      contractSpineVersion: CONTRACT_SPINE_VERSION,
      capabilities: [
        { id: 'cap-docx-edit', name: 'office.docx.edit', version: '1', kind: 'write', resource: 'artifact:office-document' },
      ],
      surfaces: [
        { kind: 'web-route', ref: '/docs' },
        { kind: 'desktop-window', ref: 'docs' },
        { kind: 'ios-view', ref: 'OfficeDocumentView' },
      ],
      sidecars: [{ name: 'office-engine', lifecycle: 'managed', healthPath: '/health' }],
    }
    expect(() => programManifestSchema.parse(manifest)).not.toThrow()
    // Non-provisional status without ratification must still validate as a
    // shape (ratified is a legal enum) — the *marking* discipline is social,
    // enforced by review, not the schema.
    expect(() => programManifestSchema.parse({ ...manifest, status: 'banana' })).toThrow()
  })

  it('accepts Fabric node identity, capability kinds, and invocation receipts', () => {
    expect(capabilityKindSchema.options).toContain('observe')
    expect(capabilityKindSchema.options).toContain('stream')

    const endpoint = {
      transport: 'tailscale',
      url: 'http://100.64.0.2:4096',
      priority: 10,
    }
    expect(() => nodeEndpointSchema.parse(endpoint)).not.toThrow()
    expect(() => nodeEndpointSchema.parse({ ...endpoint, transport: 'unknown' })).toThrow()

    const node = {
      nodeId: 'node-mac-studio',
      name: 'Mac Studio',
      runtimeType: 'desktop',
      platform: 'darwin-arm64',
      version: '0.1.0',
      endpoints: [endpoint],
      capabilities: [
        { id: 'cap-shell', name: 'harness.shell', version: '0.1.0', kind: 'execute', resource: 'shell' },
      ],
      resources: [{ kind: 'compute.cpu', name: 'cores', value: 16, unit: 'cores' }],
    }
    expect(() => nodeIdentitySchema.parse(node)).not.toThrow()

    const event = {
      id: 'evt-1',
      type: 'fabric.node.joined',
      at: NOW,
      source: 'fabric:tailscale',
      subject: node.nodeId,
    }
    expect(() => fabricEventSchema.parse(event)).not.toThrow()

    const receipt = {
      id: 'rcpt-1',
      at: NOW,
      capability: 'harness.shell',
      nodeId: node.nodeId,
      requestId: 'req-1',
      leaseId: 'lease-1',
      ok: true,
      inputKeys: ['command'],
      resource: 'shell',
    }
    expect(() => fabricInvocationReceiptSchema.parse(receipt)).not.toThrow()
    expect(() => fabricInvocationReceiptSchema.parse({ ...receipt, ok: 'yes' })).toThrow()
  })
})
