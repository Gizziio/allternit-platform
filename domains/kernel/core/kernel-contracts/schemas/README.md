# JSON Schemas

This directory contains JSON schemas for all kernel contracts.

The schemas are generated from the Rust types in the kernel-contracts crate using the `schemars` crate.

To generate the schemas, run:
```bash
cargo run --bin schema-generator
```

Or use the test in the kernel-contracts crate:
```bash
cargo test --package allternit-kernel-contracts --test schema_tests
```
