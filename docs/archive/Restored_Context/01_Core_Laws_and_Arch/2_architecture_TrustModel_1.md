# /spec/TrustModel.md
# Trust Model — Security & Governance

This spec integrates the defense-in-depth and multi-tenancy requirements from the preserved architecture doc.

## Defense-in-depth security model
1) Settings hardening (toollists, path restrictions) fileciteturn5file0L77-L84  
2) Constitutional defense (command authority boundaries) fileciteturn5file0L79-L81  
3) Pre-execution validation (hook-based policy checks) fileciteturn5file0L80-L82  
4) Safe execution primitives (typed APIs, domain allowlists) fileciteturn5file0L81-L83  
5) SSRF/egress control (block metadata/private ranges) fileciteturn5file0L82-L83  
6) Secret scoping (least privilege, short-lived tokens) fileciteturn5file0L83-L84  
7) Audit chain (tamper-evident history events) fileciteturn5file0L84-L85  

## Multi-tenancy (hard requirements)
- Data isolation fileciteturn5file0L86-L90  
- Execution isolation fileciteturn5file0L87-L89  
- Secret isolation fileciteturn5file0L88-L90  
- Audit isolation fileciteturn5file0L89-L90  

## Tool Gateway requirement
Tool execution must depend on policy-engine and run through the gateway. fileciteturn5file0L45-L53
