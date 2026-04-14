#!/usr/bin/env python3
"""
MLX-based Local Inference Service
Python sidecar that runs quantized Llama 3 models on Apple Silicon via MLX
"""

import argparse
import json
import socket
import sys
import time
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, Tuple
import glob


def main():
    parser = argparse.ArgumentParser(description="MLX-based Local Inference Service")
    parser.add_argument(
        "--model-path",
        type=str,
        required=True,
        help="Path to the MLX model weights and tokenizer"
    )
    parser.add_argument(
        "--socket-path",
        type=str,
        default="/tmp/mlx_inference.sock",
        help="Unix socket path for communication"
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=100,
        help="Default max tokens to generate"
    )
    
    args = parser.parse_args()
    
    # Import MLX and related libraries here to avoid issues if not available
    try:
        import mlx.core as mx
        import mlx.nn as nn
        from mlx.utils import tree_unflatten
        from sentencepiece import SentencePieceProcessor
        import numpy as np
    except ImportError as e:
        print(f"[ERROR] Missing required dependencies: {e}")
        print("[HINT] Install with: pip install mlx sentencepiece numpy")
        sys.exit(1)
    
    # Define classes inside main to avoid import issues
    @dataclass
    class ModelArgs:
        dim: int
        n_layers: int
        head_dim: int
        hidden_dim: int
        n_heads: int
        n_kv_heads: int
        norm_eps: float
        vocab_size: int
        rope_theta: float
        rope_traditional: bool = True


    class Attention(nn.Module):
        def __init__(self, args: ModelArgs):
            super().__init__()
            self.args = args

            self.n_heads: int = args.n_heads
            self.n_kv_heads: int = args.n_kv_heads

            self.repeats = self.n_heads // self.n_kv_heads

            self.scale = self.args.head_dim**-0.5

            self.wq = nn.Linear(args.dim, args.n_heads * args.head_dim, bias=False)
            self.wk = nn.Linear(args.dim, self.n_kv_heads * args.head_dim, bias=False)
            self.wv = nn.Linear(args.dim, self.n_kv_heads * args.head_dim, bias=False)
            self.wo = nn.Linear(args.n_heads * args.head_dim, args.dim, bias=False)
            self.rope = nn.RoPE(
                args.head_dim, traditional=args.rope_traditional, base=args.rope_theta
            )

        def __call__(
            self,
            x: mx.array,
            mask: Optional[mx.array] = None,
            cache: Optional[Tuple[mx.array, mx.array]] = None,
        ) -> Tuple[mx.array, Tuple[mx.array, mx.array]]:
            B, L, D = x.shape

            queries, keys, values = self.wq(x), self.wk(x), self.wv(x)

            # Prepare the queries, keys and values for the attention computation
            queries = queries.reshape(B, L, self.n_heads, -1).transpose(0, 2, 1, 3)
            keys = keys.reshape(B, L, self.n_kv_heads, -1).transpose(0, 2, 1, 3)
            values = values.reshape(B, L, self.n_kv_heads, -1).transpose(0, 2, 1, 3)

            def repeat(a):
                a = mx.concatenate([mx.expand_dims(a, 2)] * self.repeats, axis=2)
                return a.reshape([B, self.n_heads, L, -1])

            keys, values = map(repeat, (keys, values))

            if cache is not None:
                key_cache, value_cache = cache
                queries = self.rope(queries, offset=key_cache.shape[2])
                keys = self.rope(keys, offset=key_cache.shape[2])
                keys = mx.concatenate([key_cache, keys], axis=2)
                values = mx.concatenate([value_cache, values], axis=2)
            else:
                queries = self.rope(queries)
                keys = self.rope(keys)

            scores = (queries * self.scale) @ keys.transpose(0, 1, 3, 2)
            if mask is not None:
                scores += mask
            scores = mx.softmax(scores.astype(mx.float32), axis=-1).astype(scores.dtype)
            output = (scores @ values).transpose(0, 2, 1, 3).reshape(B, L, -1)
            return self.wo(output), (keys, values)


    class FeedForward(nn.Module):
        def __init__(self, args):
            super().__init__()

            self.w1 = nn.Linear(args.dim, args.hidden_dim, bias=False)
            self.w2 = nn.Linear(args.hidden_dim, args.dim, bias=False)
            self.w3 = nn.Linear(args.dim, args.hidden_dim, bias=False)

        def __call__(self, x) -> mx.array:
            return self.w2(nn.silu(self.w1(x)) * self.w3(x))


    class TransformerBlock(nn.Module):
        def __init__(self, args):
            super().__init__()
            self.n_heads = args.n_heads
            self.dim = args.dim
            self.attention = Attention(args)
            self.feed_forward = FeedForward(args)
            self.attention_norm = nn.RMSNorm(args.dim, eps=args.norm_eps)
            self.ffn_norm = nn.RMSNorm(args.dim, eps=args.norm_eps)
            self.args = args

        def __call__(
            self,
            x: mx.array,
            mask: Optional[mx.array] = None,
            cache: Optional[Tuple[mx.array, mx.array]] = None,
        ) -> Tuple[mx.array, Tuple[mx.array, mx.array]]:
            r, cache = self.attention(self.attention_norm(x), mask, cache)
            h = x + r
            r = self.feed_forward(self.ffn_norm(h))
            out = h + r
            return out, cache


    class Llama(nn.Module):
        def __init__(self, args):
            super().__init__()
            self.args = args
            self.vocab_size = args.vocab_size
            self.tok_embeddings = nn.Embedding(args.vocab_size, args.dim)
            self.layers = [TransformerBlock(args) for _ in range(args.n_layers)]
            self.norm = nn.RMSNorm(args.dim, eps=args.norm_eps)
            self.output = nn.Linear(args.dim, args.vocab_size, bias=False)

        def __call__(self, x):
            mask = nn.MultiHeadAttention.create_additive_causal_mask(x.shape[1])
            mask = mask.astype(self.tok_embeddings.weight.dtype)

            x = self.tok_embeddings(x)
            for l in self.layers:
                x, _ = l(x, mask)
            x = self.norm(x)
            return self.output(x)

        def generate(self, x, temp=1.0):
            def sample(logits):
                if temp == 0:
                    return mx.argmax(logits, axis=-1)
                else:
                    return mx.random.categorical(logits * (1 / temp))

            cache = []

            # Make an additive causal mask. We will need that to process the prompt.
            mask = nn.MultiHeadAttention.create_additive_causal_mask(x.shape[1])
            mask = mask.astype(self.tok_embeddings.weight.dtype)

            # First we process the prompt x the same was as in __call__ but
            # save the caches in cache
            x = self.tok_embeddings(x)
            for l in self.layers:
                x, c = l(x, mask=mask)
                # We store the per layer cache in a simple python list
                cache.append(c)
            x = self.norm(x)
            # We only care about the last logits that generate the next token
            y = self.output(x[:, -1])
            y = sample(y)

            # y now has size [1]
            # Since MLX is lazily evaluated nothing is computed yet.
            # Calling y.item() would force the computation to happen at
            # this point but we can also choose not to do that and let the
            # user choose when to start the computation.
            yield y

            # Now we parsed the prompt and generated the first token we
            # need to feed it back into the model and loop to generate the
            # rest.
            while True:
                # Unsqueezing the last dimension to add a sequence length
                # dimension of 1
                x = y[:, None]

                x = self.tok_embeddings(x)
                for i in range(len(cache)):
                    # We are overwriting the arrays in the cache list. When
                    # the computation will happen, MLX will be discarding the
                    # old cache the moment it is not needed anymore.
                    x, cache[i] = self.layers[i](x, mask=None, cache=cache[i])
                x = self.norm(x)
                y = sample(self.output(x[:, -1]))

                yield y


    def sanitize_config(config, weights):
        config.pop("model_type", None)
        n_heads = config["n_heads"]
        if "n_kv_heads" not in config:
            config["n_kv_heads"] = n_heads
        if "head_dim" not in config:
            config["head_dim"] = config["dim"] // n_heads
        if "hidden_dim" not in config:
            config["hidden_dim"] = weights["layers.0.feed_forward.w1.weight"].shape[0]
        if config.get("vocab_size", -1) < 0:
            config["vocab_size"] = weights["output.weight"].shape[-1]
        if "rope_theta" not in config:
            config["rope_theta"] = 10000
        unused = ["multiple_of", "ffn_dim_multiplier"]
        for k in unused:
            config.pop(k, None)
        return config


    def load_model(model_path):
        """Load the MLX model from the specified path"""
        model_path = Path(model_path)

        # Load weights
        unsharded_weights_path = Path(model_path / "weights.npz")
        if unsharded_weights_path.is_file():
            print(f"[INFO] Loading model from {unsharded_weights_path}")
            weights = mx.load(str(unsharded_weights_path))
        else:
            sharded_weights_glob = str(model_path / "weights.*.npz")
            weight_files = glob.glob(sharded_weights_glob)
            print(f"[INFO] Loading model from {sharded_weights_glob}")

            if len(weight_files) == 0:
                raise FileNotFoundError(f"No weights found in {model_path}")

            weights = {}
            for wf in weight_files:
                weights.update(mx.load(wf).items())

        # Load config
        with open(model_path / "config.json", "r") as f:
            config = sanitize_config(json.loads(f.read()), weights)
            quantization = config.pop("quantization", None)
        
        # Create model
        model = Llama(ModelArgs(**config))
        if quantization is not None:
            nn.quantize(model, **quantization)
        model.update(tree_unflatten(list(weights.items())))
        
        # Load tokenizer
        tokenizer = SentencePieceProcessor(model_file=str(model_path / "tokenizer.model"))
        
        return model, tokenizer


    def generate_response(model, tokenizer, prompt: str, max_tokens: int = 100, temp: float = 0.0):
        """Generate a response from the model given a prompt"""
        # Tokenize the prompt
        tokens = [tokenizer.bos_id()] + tokenizer.encode(prompt)
        x = mx.array([tokens])
        
        # Generate tokens
        generated_tokens = []
        
        for token in model.generate(x, temp):
            generated_tokens.append(token)
            
            if len(generated_tokens) >= max_tokens:
                break
                
            # Evaluate periodically to get actual values
            if len(generated_tokens) % 10 == 0:
                mx.eval(generated_tokens)

        # Evaluate all tokens
        mx.eval(generated_tokens)
        
        # Decode the generated tokens
        generated_ids = [t.item() for t in generated_tokens]
        response = tokenizer.decode(generated_ids)
        
        return response


    def handle_request(model, tokenizer, request_data: dict) -> dict:
        """Handle a single inference request"""
        try:
            prompt = request_data.get("prompt", "")
            max_tokens = request_data.get("max_tokens", 100)
            temperature = request_data.get("temperature", 0.0)
            
            response = generate_response(model, tokenizer, prompt, max_tokens, temperature)
            
            return {
                "success": True,
                "response": response,
                "model": "mlx-llama",
                "tokens_used": len(tokenizer.encode(prompt + response))
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response": None
            }

    # Load the model
    print(f"[INFO] Loading MLX model from {args.model_path}")
    model, tokenizer = load_model(args.model_path)
    print("[INFO] Model loaded successfully")
    
    # Create Unix socket
    socket_path = Path(args.socket_path)
    if socket_path.exists():
        socket_path.unlink()  # Remove existing socket file
    
    server_socket = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server_socket.bind(str(socket_path))
    server_socket.listen(1)
    
    print(f"[INFO] MLX Inference Service listening on {args.socket_path}")
    
    try:
        while True:
            conn, addr = server_socket.accept()
            print("[INFO] New connection accepted")
            
            try:
                # Receive request
                data = conn.recv(4096).decode('utf-8').strip()
                if not data:
                    continue
                    
                request = json.loads(data)
                
                # Handle the request
                response = handle_request(model, tokenizer, request)
                
                # Send response
                conn.send(json.dumps(response).encode('utf-8'))
                
            except Exception as e:
                print(f"[ERROR] Error handling request: {e}")
                error_response = {"success": False, "error": str(e)}
                try:
                    conn.send(json.dumps(error_response).encode('utf-8'))
                except:
                    pass  # Ignore errors during error response
            finally:
                try:
                    conn.close()
                except:
                    pass  # Ignore errors during cleanup
                
    except KeyboardInterrupt:
        print("\n[INFO] Shutting down MLX Inference Service...")
    finally:
        try:
            server_socket.close()
        except:
            pass
        if socket_path.exists():
            socket_path.unlink()


if __name__ == "__main__":
    main()