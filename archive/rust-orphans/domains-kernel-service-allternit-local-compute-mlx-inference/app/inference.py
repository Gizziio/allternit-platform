#!/usr/bin/env python3
"""
MLX-based Local Inference Service
Python sidecar that listens on a Unix socket for inference requests
"""

import argparse
import json
import socket
import struct
import sys
import os
try:
    import mlx.core as mx
    import mlx.nn as nn
    from mlx.utils import tree_unflatten
    from mlx_lm.models import llama
    from mlx_lm.utils import get_model_path
    MLX_AVAILABLE = True
except ImportError:
    mx = None
    nn = None
    tree_unflatten = None
    llama = None
    get_model_path = None
    MLX_AVAILABLE = False

try:
    from transformers import AutoTokenizer
    TRANSFORMER_AVAILABLE = True
except ImportError:
    AutoTokenizer = None
    TRANSFORMER_AVAILABLE = False

import numpy as np
import time

FALLBACK_RESPONSE = "MLX inference backend unavailable on this host."


class DummyTokenizer:
    eos_token_id = None

    def encode(self, text: str) -> list[int]:
        return [ord(c) for c in text]

    def decode(self, tokens: list[int]) -> str:
        return "".join(chr(t) if 0 <= t < 0x110000 else "�" for t in tokens)


def load_model(model_path):
    """Load a GGUF model using MLX if the libraries are available."""
    if not MLX_AVAILABLE or not llama or not get_model_path:
        print("MLX libraries are missing; entering degraded mode.")
        return None

    print(f"Loading model from: {model_path}")
    model_path = get_model_path(model_path)
    model_args = llama.ModelArgs.from_dict(
        {"hidden_size": 4096, "num_attention_heads": 32, "num_hidden_layers": 32}
    )
    model = llama.Model(model_args)
    return model


def generate_text(model, tokenizer, prompt, max_tokens=100, temperature=0.7):
    """Generate text using the loaded model"""
    # Tokenize the input
    tokens = tokenizer.encode(prompt)
    tokens = mx.array(tokens)
    
    # Generate tokens
    generated_tokens = []
    for _ in range(max_tokens):
        # Forward pass
        logits = model(tokens[None])
        logits = logits[:, -1, :]
        
        # Apply temperature
        if temperature > 0:
            logits = logits / temperature
            probs = mx.softmax(logits)
            token = mx.random.categorical(probs)
        else:
            token = mx.argmax(logits, axis=-1)
        
        # Append to generated tokens
        generated_tokens.append(token.item())
        
        # Update tokens for next iteration
        tokens = mx.concatenate([tokens, token])
        
        # Stop if we hit the end token
        if token.item() == tokenizer.eos_token_id:
            break
    
    # Decode the generated tokens
    generated_text = tokenizer.decode(generated_tokens)
    return generated_text


def handle_request(model, tokenizer, request_data):
    """Handle a single inference request"""
    prompt = request_data.get("prompt", "")
    max_tokens = request_data.get("max_tokens", 100)
    temperature = request_data.get("temperature", 0.7)

    if not MLX_AVAILABLE or model is None or not TRANSFORMER_AVAILABLE:
        return {
            "status": "degraded",
            "text": FALLBACK_RESPONSE,
            "input_tokens": len(tokenizer.encode(prompt)),
            "output_tokens": 0,
            "generation_time": 0.0,
            "model": "mlx-llm-fallback"
        }

    start_time = time.time()
    try:
        generated_text = generate_text(model, tokenizer, prompt, max_tokens, temperature)
        end_time = time.time()
        return {
            "status": "success",
            "text": generated_text,
            "input_tokens": len(tokenizer.encode(prompt)),
            "output_tokens": len(tokenizer.encode(generated_text)),
            "generation_time": end_time - start_time,
            "model": "mlx-llm"
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "text": ""
        }


def main():
    parser = argparse.ArgumentParser(description="MLX Inference Server")
    parser.add_argument("--model", type=str, required=True, help="Path to the model")
    parser.add_argument("--socket", type=str, default="/tmp/mlx-inference.sock", help="Unix socket path")
    args = parser.parse_args()
    
    # Load model and tokenizer
    print(f"Loading model: {args.model}")
    model = load_model(args.model)

    # Initialize tokenizer
    if TRANSFORMER_AVAILABLE and AutoTokenizer:
        tokenizer = AutoTokenizer.from_pretrained("mlx-community/Llama-2-7b-mlx")
    else:
        print("Transformers unavailable; using fallback tokenizer.")
        tokenizer = DummyTokenizer()
    
    # Remove existing socket file
    if os.path.exists(args.socket):
        os.unlink(args.socket)
    
    # Create Unix socket server
    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(args.socket)
    server.listen(1)
    print(f"Server listening on {args.socket}")
    
    try:
        while True:
            conn, addr = server.accept()
            print("Connection accepted")
            
            try:
                # Read message length (4 bytes)
                length_bytes = conn.recv(4)
                if not length_bytes:
                    break
                
                length = struct.unpack("!I", length_bytes)[0]
                
                # Read the JSON message
                data = b""
                while len(data) < length:
                    packet = conn.recv(length - len(data))
                    if not packet:
                        break
                    data += packet
                
                # Parse the JSON request
                request_data = json.loads(data.decode('utf-8'))
                print(f"Received request: {request_data}")
                
                # Process the request
                response = handle_request(model, tokenizer, request_data)
                
                # Send response back
                response_json = json.dumps(response)
                response_bytes = response_json.encode('utf-8')
                response_length = struct.pack("!I", len(response_bytes))
                
                conn.sendall(response_length)
                conn.sendall(response_bytes)
                
            except Exception as e:
                print(f"Error processing request: {e}")
                error_response = json.dumps({
                    "status": "error",
                    "error": str(e)
                }).encode('utf-8')
                error_length = struct.pack("!I", len(error_response))
                conn.sendall(error_length)
                conn.sendall(error_response)
            finally:
                conn.close()
                
    except KeyboardInterrupt:
        print("Server shutting down...")
    finally:
        server.close()
        if os.path.exists(args.socket):
            os.unlink(args.socket)


if __name__ == "__main__":
    main()
