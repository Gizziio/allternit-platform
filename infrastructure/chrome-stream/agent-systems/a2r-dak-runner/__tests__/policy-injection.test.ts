/**
 * Policy Injection Integration Tests
 * 
 * Tests for policy marker generation, injection, and validation.
 */

import { PolicyInjector, createInjectionMarker, validatePolicyMarkers } from '../src/policy/injection';
import { PolicyBundle, InjectionPoint } from '../src/policy/types';

describe('Policy Injection Integration', () => {
  let injector: PolicyInjector;
  
  const mockBundle: PolicyBundle = {
    bundle_id: 'pb_test_001',
    version: '1.0.0',
    name: 'Test Policy Bundle',
    policies: [
      {
        policy_id: 'pol_001',
        version: '1.0.0',
        name: 'Test Policy',
        enabled: true,
        scope: {},
        rules: [],
        default_effect: 'DENY',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]
  };

  beforeEach(() => {
    injector = new PolicyInjector({
      bundle_id: 'pb_test_001',
      auto_inject: false,
      injection_points: ['session_start', 'dag_load', 'node_entry'],
      marker_output_dir: '.a2r/test-markers'
    });
  });

  describe('Marker Generation', () => {
    it('should create valid injection markers', async () => {
      await injector.loadBundle(mockBundle);
      
      const context = {
        session_id: 'sess_001',
        dag_id: 'dag_001',
        agent_id: 'agent_001',
        timestamp: new Date(),
        original_context: {}
      };

      const marker = await injector.inject('dag_load', context);

      expect(marker.marker_id).toMatch(/^marker-/);
      expect(marker.marker_version).toBe('v1');
      expect(marker.policy_bundle_id).toBe('pb_test_001');
      expect(marker.injection_point).toBe('dag_load');
      expect(marker.context_hash).toBeTruthy();
    });

    it('should compute consistent context hashes', async () => {
      const context = {
        session_id: 'sess_001',
        dag_id: 'dag_001',
        agent_id: 'agent_001',
        timestamp: new Date(),
        original_context: {}
      };

      const marker1 = createInjectionMarker(mockBundle, context, 'dag_load');
      const marker2 = createInjectionMarker(mockBundle, context, 'dag_load');

      expect(marker1.context_hash).toBe(marker2.context_hash);
    });

    it('should include all policy IDs in marker', async () => {
      const multiPolicyBundle: PolicyBundle = {
        ...mockBundle,
        policies: [
          { ...mockBundle.policies[0], policy_id: 'pol_001' },
          { ...mockBundle.policies[0], policy_id: 'pol_002' },
          { ...mockBundle.policies[0], policy_id: 'pol_003' }
        ]
      };

      const context = {
        session_id: 'sess_001',
        dag_id: 'dag_001',
        agent_id: 'agent_001',
        timestamp: new Date(),
        original_context: {}
      };

      const marker = createInjectionMarker(multiPolicyBundle, context, 'dag_load');

      expect(marker.injected_policies).toHaveLength(3);
      expect(marker.injected_policies).toContain('pol_001');
      expect(marker.injected_policies).toContain('pol_002');
      expect(marker.injected_policies).toContain('pol_003');
    });
  });

  describe('Marker Validation', () => {
    it('should validate required injection points', () => {
      const context = {
        _policy_markers: [
          { injection_point: 'session_start' },
          { injection_point: 'dag_load' }
        ]
      };

      const result = validatePolicyMarkers(context, ['session_start', 'dag_load']);

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should detect missing injection points', () => {
      const context = {
        _policy_markers: [
          { injection_point: 'session_start' }
        ]
      };

      const result = validatePolicyMarkers(context, ['session_start', 'dag_load', 'node_entry']);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('dag_load');
      expect(result.missing).toContain('node_entry');
    });

    it('should handle empty context', () => {
      const result = validatePolicyMarkers({}, ['session_start']);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('session_start');
    });
  });

  describe('Injection Points', () => {
    it('should inject at session_start', async () => {
      await injector.loadBundle(mockBundle);
      
      const marker = await injector.injectForSession('sess_001', 'agent_001');

      expect(marker.injection_point).toBe('session_start');
      expect(marker.session_id).toBe('sess_001');
    });

    it('should inject at dag_load', async () => {
      await injector.loadBundle(mockBundle);
      
      const marker = await injector.injectForDAG('dag_001', 'sess_001', 'agent_001');

      expect(marker.injection_point).toBe('dag_load');
      expect(marker.dag_id).toBe('dag_001');
    });

    it('should inject at node_entry', async () => {
      await injector.loadBundle(mockBundle);
      
      const marker = await injector.injectForNode('dag_001', 'node_001', 'sess_001', 'agent_001');

      expect(marker.injection_point).toBe('node_entry');
      expect(marker.node_id).toBe('node_001');
    });
  });

  describe('Bundle Verification', () => {
    it('should verify bundle hash if provided', async () => {
      const bundleWithHash = {
        ...mockBundle,
        bundle_hash: 'invalid_hash'
      };

      await expect(injector.loadBundle(bundleWithHash))
        .rejects.toThrow('Bundle hash mismatch');
    });

    it('should reject invalid bundles', async () => {
      const invalidBundle = {
        bundle_id: '',
        policies: null
      } as unknown as PolicyBundle;

      await expect(injector.loadBundle(invalidBundle))
        .rejects.toThrow('Invalid policy bundle');
    });
  });
});
