#!/usr/bin/env python3
import json
import sys
from collections import deque

def topological_sort(graph):
    nodes = {node['task_id']: node for node in graph['nodes']}
    adj = {node_id: [] for node_id in nodes}
    in_degree = {node_id: 0 for node_id in nodes}

    for edge in graph.get('edges', []):
        u, v = edge['from'], edge['to']
        if u in adj and v in adj:
            adj[u].append(v)
            in_degree[v] += 1

    queue = deque([u for u in nodes if in_degree[u] == 0])
    result = []

    while queue:
        u = queue.popleft()
        result.append(u)
        for v in adj[u]:
            in_degree[v] -= 1
            if in_degree[v] == 0:
                queue.append(v)

    if len(result) != len(nodes):
        print("Error: Cycle detected in graph", file=sys.stderr)
        sys.exit(1)
    
    return result

def main():
    if len(sys.argv) < 2:
        print("Usage: bin/graph-runner.py <graph.json>")
        sys.exit(1)
    
    with open(sys.argv[1]) as f:
        graph = json.load(f)
    
    order = topological_sort(graph)
    print(" ".join(order))

if __name__ == "__main__":
    main()
