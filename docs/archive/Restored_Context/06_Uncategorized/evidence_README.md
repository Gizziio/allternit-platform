# Evidence

Evidence is structured proof for UI/flow changes.

## Directory layout
`evidence/{headSha}/{flowName}/manifest.json`

## Requirements
- manifest.json must validate against spec/Contracts/Evidence.schema.json
- manifest.headSha must equal {headSha} directory name
- artifacts referenced by manifest must exist and have matching sha256
- freshness policy enforced via spec/RiskPolicy.json
