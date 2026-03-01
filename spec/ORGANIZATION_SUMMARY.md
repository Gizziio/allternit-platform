# Specification Organization Summary

## Completed Organization
The following specification files and directories have been moved to the `finished/` directory:

- Full system specifications (Kernel, Security, Messaging, Workflows, etc.)
- Completed implementation reports (Userland, etc.)
- Frozen contracts and interfaces that have been implemented

## Ongoing Specifications
The following specification files and directories have been moved to the `ongoing/` directory:

- Architecture documents (2_architecture/)
- Analysis documents (analysis/)
- System design documents (3_systems/ - orchestration, retrieval, robotics, ui)
- Examples (4_examples/)
- Work-in-progress specifications (capsule/, userland/, etc.)
- Framework registry and invariants
- Data fabric specifications
- Agent quick start guide

## Remaining in Root
- Core contracts (1_contracts/) - kept in place as they may still be evolving
- Schemas directory - kept in place as it contains core JSON schemas
- Deltas directory - kept in place as it may contain change specifications
- Other core infrastructure specs that are actively referenced

## Purpose
This organization separates stable, completed specifications from those that are still evolving as part of active development. The `finished/` directory contains frozen specifications that serve as reference documentation, while the `ongoing/` directory contains specifications that are still being refined and updated as the system evolves.