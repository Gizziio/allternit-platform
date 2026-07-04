# allternit-protocol

Shared protocol types for communication between Allternit nodes and the
control plane. Defines the WebSocket message envelope, job formats, and common
control-plane types.

## Usage

```rust
use allternit_protocol::{Message, MessagePayload};

let msg = Message::new(MessagePayload::NodeRegister { ... });
```

## License

MIT OR Apache-2.0
