import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
	vus: __ENV.A2RCHITECH_VUS ? parseInt(__ENV.A2RCHITECH_VUS, 10) : 10,
	duration: __ENV.A2RCHITECH_DURATION || '30s'
};

const BASE_URL = __ENV.A2RCHITECH_BASE_URL || ('http://' + '127.0.0.1' + ':3000');
const IDENTITY = __ENV.A2RCHITECH_IDENTITY || 'api-service';
const TENANT = __ENV.A2RCHITECH_TENANT || 'default';

const workflowYaml = `version: "1.0"
workflow:
  id: "load-test-workflow"
  name: "Load Test Workflow"
  description: "Minimal workflow for load testing"
  tenant_id: "default"
  phases_used: ["Observe"]
  nodes:
    - id: "node-1"
      name: "Observe"
      phase: "Observe"
      skill_id: "skill.echo"
      description: "Placeholder"
      inputs: []
      outputs: ["result"]
`;

export default function () {
	const headers = {
		'Content-Type': 'application/json',
		'x-identity-id': IDENTITY,
		'x-tenant-id': TENANT
	};

	const health = http.get(`${BASE_URL}/health`, { headers });
	check(health, {
		'health ok': (res) => res.status === 200
	});

	const validatePayload = JSON.stringify({ yaml: workflowYaml, tenant_id: TENANT });
	const validate = http.post(`${BASE_URL}/api/workflows/validate`, validatePayload, { headers });
	check(validate, {
		'validate ok': (res) => res.status === 200
	});

	const compilePayload = JSON.stringify({ yaml: workflowYaml, tenant_id: TENANT });
	const compile = http.post(`${BASE_URL}/api/workflows/compile`, compilePayload, { headers });
	check(compile, {
		'compile ok': (res) => res.status === 200
	});

	sleep(1);
}
