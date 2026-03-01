import uuid
import datetime
import hashlib
from fastapi import FastAPI, HTTPException
from typing import Dict, Any, List
import uvicorn
import os
import json

app = FastAPI(title='A2R Model Router')

# Load policy (G0200)
# Adjust relative path assuming execution from services/router/src
POLICY_PATH = os.environ.get('ROUTER_POLICY_PATH', '../../../.a2r/artifacts/G0200/router-policy-contract.json')

def load_policy():
    try:
        # Resolve absolute path if relative
        if not os.path.isabs(POLICY_PATH):
            base_dir = os.path.dirname(os.path.abspath(__file__))
            path = os.path.join(base_dir, POLICY_PATH)
        else:
            path = POLICY_PATH
            
        if os.path.exists(path):
            with open(path, 'r') as f:
                return json.load(f)
        return {'allowlist': [], 'caps': {}, 'budgets': {}, 'routing_rules': []}
    except Exception:
        return {'allowlist': [], 'caps': {}, 'budgets': {}, 'routing_rules': []}

policy = load_policy()

@app.get('/health')
async def health():
    return {'status': 'ok'}

@app.get('/api/router/policies')
async def get_policies():
    return policy

@app.post('/api/router/route')
async def route_request(intent: str, complexity: str = 'medium'):
    # Simple rule engine implementation (G0201)
    rules = policy.get('example_policy', {}).get('routing_rules', [])
    
    selected_model = 'gpt-4o' # fallback
    reason = 'default'
    
    for rule in rules:
        if rule.get('if_intent') == intent:
            selected_model = rule['then_use_model']
            reason = 'intent_match'
            break
        if rule.get('if_complexity') == complexity:
            selected_model = rule['then_use_model']
            reason = 'complexity_match'
            break
            
    # G0202: Generate Receipt
    receipt = {
        'receipt_id': str(uuid.uuid4()),
        'timestamp': datetime.datetime.utcnow().isoformat() + 'Z',
        'request': {'intent': intent, 'complexity': complexity},
        'decision': {'model': selected_model, 'reason': reason},
        'policy_version': policy.get('version', 'unknown')
    }
    
    # Save receipt (mock persistence)
    # In real impl, write to .a2r/receipts/
    
    return {'model': selected_model, 'reason': reason, 'receipt_id': receipt['receipt_id']}

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8002))
    uvicorn.run(app, host='0.0.0.0', port=port)
