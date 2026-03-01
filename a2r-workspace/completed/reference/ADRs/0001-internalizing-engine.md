# 0001. Internalizing Legacy Engine into A2R Layered Architecture

Date: 2026-02-04

## Status
Accepted

## Context
We need to internalize the legacy execution engine into A2R first-party code to ensure interface stability before migrating to Rust.

## Decision
Implement a TypeScript ExecutionEngine, PolicyEngine, and RuntimeBridge following the 0-6 layered architecture.

## Consequences
- Clean separation of concerns.
- No dependency on vendor code in UI/Apps.
- Clear path for Rust optimization.
