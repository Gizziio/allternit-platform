import { describe, expect, it } from 'vitest';
import {
  dropTargetState,
  findRootNodeId,
  organizeDagNodes,
  parseLabelsInput,
  reparentCandidates,
  selectDags,
  type OrganizedDoneRow,
  type OrganizedNodeRow,
} from './organize';
import type { RailsDagNode, RailsDagsDto } from '@/lib/rails/use-rails-dags';

function node(partial: Partial<RailsDagNode> & { node_id: string }): RailsDagNode {
  return {
    parent_node_id: null,
    title: partial.node_id,
    status: 'NEW',
    ready: false,
    assignee: null,
    current_wih_id: null,
    labels: [],
    description: null,
    priority: null,
    ...partial,
  };
}

function dto(dags: RailsDagsDto['dags']): RailsDagsDto {
  return { dags, active_wihs: [] };
}

describe('organizeDagNodes', () => {
  it('orders children frontier-first: READY → RUNNING → FAILED → NEW → DONE, title within status', () => {
    const input = dto([
      {
        dag_id: 'dag1',
        root_title: 'Root',
        nodes: [
          node({ node_id: 'root' }),
          node({ node_id: 'b-new', parent_node_id: 'root', status: 'NEW' }),
          node({ node_id: 'a-ready', parent_node_id: 'root', status: 'READY' }),
          node({ node_id: 'z-ready', parent_node_id: 'root', status: 'READY' }),
          node({ node_id: 'c-done', parent_node_id: 'root', status: 'DONE' }),
          node({ node_id: 'd-failed', parent_node_id: 'root', status: 'FAILED' }),
          node({ node_id: 'e-running', parent_node_id: 'root', status: 'RUNNING' }),
        ],
        ready_count: 2,
        done_count: 1,
      },
    ]);
    const [out] = organizeDagNodes(input);
    const ids = out.rows
      .filter((r): r is OrganizedNodeRow => r.kind === 'node')
      .map((r) => r.node.node_id);
    expect(ids).toEqual(['root', 'a-ready', 'z-ready', 'e-running', 'd-failed', 'b-new']);
  });

  it('treats nodes whose parent is missing (filtered view) as roots', () => {
    const input = dto([
      {
        dag_id: 'dag1',
        root_title: null,
        nodes: [
          node({ node_id: 'orphan', parent_node_id: 'gone', status: 'READY' }),
          node({ node_id: 'also-ready', status: 'READY' }),
        ],
        ready_count: 2,
        done_count: 0,
      },
    ]);
    const [out] = organizeDagNodes(input);
    const roots = out.rows.filter(
      (r): r is OrganizedNodeRow => r.kind === 'node' && r.depth === 1
    );
    expect(roots.map((r) => r.node.node_id).sort()).toEqual(['also-ready', 'orphan']);
  });

  it('caps depth at 3 (deeper nodes flattened to depth 3)', () => {
    const nodes: RailsDagNode[] = [
      node({ node_id: 'n1' }),
      node({ node_id: 'n2', parent_node_id: 'n1', status: 'READY' }),
      node({ node_id: 'n3', parent_node_id: 'n2', status: 'READY' }),
      node({ node_id: 'n4', parent_node_id: 'n3', status: 'READY' }),
      node({ node_id: 'n5', parent_node_id: 'n4', status: 'READY' }),
    ];
    const [out] = organizeDagNodes(dto([{ dag_id: 'd', root_title: null, nodes, ready_count: 4, done_count: 0 }]));
    const depths = Object.fromEntries(
      out.rows
        .filter((r): r is OrganizedNodeRow => r.kind === 'node')
        .map((r) => [r.node.node_id, r.depth])
    );
    expect(depths).toEqual({ n1: 1, n2: 2, n3: 3, n4: 3, n5: 3 });
  });

  it('collapses DONE children into a count row with the done nodes attached', () => {
    const input = dto([
      {
        dag_id: 'dag1',
        root_title: 'Root',
        nodes: [
          node({ node_id: 'root' }),
          node({ node_id: 'done-a', parent_node_id: 'root', status: 'DONE' }),
          node({ node_id: 'done-b', parent_node_id: 'root', status: 'DONE' }),
          node({ node_id: 'open', parent_node_id: 'root', status: 'READY' }),
        ],
        ready_count: 1,
        done_count: 2,
      },
    ]);
    const [out] = organizeDagNodes(input);
    const doneRows = out.rows.filter((r): r is OrganizedDoneRow => r.kind === 'done');
    expect(doneRows).toHaveLength(1);
    expect(doneRows[0].count).toBe(2);
    expect(doneRows[0].parentKey).toBe('root');
    expect(doneRows[0].nodes.map((n) => n.node_id).sort()).toEqual(['done-a', 'done-b']);
    // The open child still renders as a normal row.
    const open = out.rows.find(
      (r): r is OrganizedNodeRow => r.kind === 'node' && r.node.node_id === 'open'
    );
    expect(open).toBeDefined();
  });

  it('collapses DONE roots under the __roots__ toggle', () => {
    const input = dto([
      {
        dag_id: 'dag1',
        root_title: null,
        nodes: [node({ node_id: 'done-root', status: 'DONE' })],
        ready_count: 0,
        done_count: 1,
      },
    ]);
    const [out] = organizeDagNodes(input);
    expect(out.rows.every((r) => r.kind === 'done')).toBe(true);
    const doneRow = out.rows[0] as OrganizedDoneRow;
    expect(doneRow.parentKey).toBe('__roots__');
    expect(doneRow.count).toBe(1);
  });
});

describe('selectDags / maxDags', () => {
  const dags = [
    {
      dag_id: 'stale',
      root_title: null,
      nodes: [node({ node_id: 's1', status: 'READY' })],
      ready_count: 1,
      done_count: 0,
    },
    {
      dag_id: 'mine-running',
      root_title: null,
      nodes: [node({ node_id: 'm1', status: 'RUNNING', assignee: 'web-user' })],
      ready_count: 0,
      done_count: 0,
    },
    {
      dag_id: 'rich',
      root_title: null,
      nodes: [
        node({ node_id: 'r1', status: 'READY' }),
        node({ node_id: 'r2', status: 'READY' }),
        node({ node_id: 'r3', status: 'READY' }),
      ],
      ready_count: 3,
      done_count: 0,
    },
  ];

  it('puts dags with my RUNNING nodes first, then most ready_count', () => {
    expect(selectDags(dags, 3, 'web-user').map((d) => d.dag_id)).toEqual([
      'mine-running',
      'rich',
      'stale',
    ]);
  });

  it('caps client-side at maxDags', () => {
    const [out] = organizeDagNodes(dto(dags), { agentId: 'web-user', maxDags: 2 });
    expect(out.dag.dag_id).toBe('mine-running');
    const all = organizeDagNodes(dto(dags), { agentId: 'web-user', maxDags: 2 });
    expect(all).toHaveLength(2);
    expect(all[1].dag.dag_id).toBe('rich');
  });

  it('ignores RUNNING nodes assigned to other agents', () => {
    const other = dags.map((d) =>
      d.dag_id === 'mine-running'
        ? { ...d, nodes: d.nodes.map((n) => ({ ...n, assignee: 'someone-else' })) }
        : d
    );
    expect(selectDags(other, 1, 'web-user')[0].dag_id).toBe('rich');
  });
});


describe('findRootNodeId', () => {
  const dag = (nodes: RailsDagNode[]) => ({
    dag_id: 'dag1',
    root_title: null,
    nodes,
    ready_count: 0,
    done_count: 0,
  });

  it('returns the parentless node id', () => {
    expect(
      findRootNodeId(
        dag([
          node({ node_id: 'child', parent_node_id: 'root' }),
          node({ node_id: 'root' }),
        ])
      )
    ).toBe('root');
  });

  it('returns null when every node has a parent (filtered view)', () => {
    expect(findRootNodeId(dag([node({ node_id: 'child', parent_node_id: 'gone' })]))).toBeNull();
  });

  it('is deterministic when multiple parentless nodes exist', () => {
    expect(
      findRootNodeId(dag([node({ node_id: 'b-root' }), node({ node_id: 'a-root' })]))
    ).toBe('a-root');
  });

  it('treats empty-string parents as parentless', () => {
    expect(findRootNodeId(dag([node({ node_id: 'root', parent_node_id: '' })]))).toBe('root');
  });
});

describe('reparentCandidates', () => {
  // root ── a ── a1 ── a1x
  //      └ b
  const tree: RailsDagNode[] = [
    node({ node_id: 'root' }),
    node({ node_id: 'a', parent_node_id: 'root', status: 'READY' }),
    node({ node_id: 'b', parent_node_id: 'root', status: 'READY' }),
    node({ node_id: 'a1', parent_node_id: 'a', status: 'READY' }),
    node({ node_id: 'a1x', parent_node_id: 'a1', status: 'READY' }),
  ];

  it('excludes the node itself and its own descendants', () => {
    const ids = reparentCandidates(tree, 'a').map((n) => n.node_id);
    expect(ids).not.toContain('a');
    expect(ids).not.toContain('a1');
    expect(ids).not.toContain('a1x');
  });

  it('includes the root, sibling branches, and unrelated nodes', () => {
    const ids = reparentCandidates(tree, 'a').map((n) => n.node_id);
    expect(ids).toEqual(['root', 'b']);
  });

  it('walks multi-level chains: descendants of a1 are blocked when moving a1', () => {
    const ids = reparentCandidates(tree, 'a1').map((n) => n.node_id);
    expect(ids).toEqual(['root', 'a', 'b']);
  });

  it('blocks descendants even when children precede parents in the array', () => {
    const shuffled: RailsDagNode[] = [
      node({ node_id: 'a1x', parent_node_id: 'a1', status: 'READY' }),
      node({ node_id: 'a1', parent_node_id: 'a', status: 'READY' }),
      node({ node_id: 'a', parent_node_id: 'root', status: 'READY' }),
      node({ node_id: 'root' }),
    ];
    const ids = reparentCandidates(shuffled, 'a').map((n) => n.node_id);
    expect(ids).toEqual(['root']);
  });

  it('returns every other node when moving a leaf', () => {
    const ids = reparentCandidates(tree, 'a1x').map((n) => n.node_id);
    expect(ids).toEqual(['root', 'a', 'b', 'a1']);
  });

  it('returns an empty list for a single-node dag', () => {
    expect(reparentCandidates([node({ node_id: 'only' })], 'only')).toEqual([]);
  });

  it('keeps orphans (missing parent) as valid candidates', () => {
    const ids = reparentCandidates(
      [node({ node_id: 'root' }), node({ node_id: 'orphan', parent_node_id: 'gone' })],
      'root'
    ).map((n) => n.node_id);
    expect(ids).toEqual(['orphan']);
  });

  it('treats an unknown nodeId as blocking nothing', () => {
    const ids = reparentCandidates(tree, 'nope').map((n) => n.node_id);
    expect(ids).toEqual(['root', 'a', 'b', 'a1', 'a1x']);
  });
});

describe('dropTargetState', () => {
  // root ── a ── a1 ── a1x
  //      └ b
  const nodes: RailsDagNode[] = [
    node({ node_id: 'root' }),
    node({ node_id: 'a', parent_node_id: 'root', status: 'READY' }),
    node({ node_id: 'b', parent_node_id: 'root', status: 'READY' }),
    node({ node_id: 'a1', parent_node_id: 'a', status: 'READY' }),
    node({ node_id: 'a1x', parent_node_id: 'a1', status: 'READY' }),
  ];

  it('marks dropping onto self invalid', () => {
    expect(dropTargetState('a', 'a', nodes, 'dag1')).toBe('invalid');
  });

  it('marks dropping onto a descendant invalid', () => {
    expect(dropTargetState('a', 'a1', nodes, 'dag1')).toBe('invalid');
    expect(dropTargetState('a', 'a1x', nodes, 'dag1')).toBe('invalid');
  });

  it('marks dropping onto a parent, ancestor, or sibling valid-under', () => {
    expect(dropTargetState('a1', 'a', nodes, 'dag1')).toBe('valid-under');
    expect(dropTargetState('a1', 'root', nodes, 'dag1')).toBe('valid-under');
    expect(dropTargetState('a1', 'b', nodes, 'dag1')).toBe('valid-under');
  });

  it('marks dropping onto any other row valid-under for a leaf', () => {
    expect(dropTargetState('a1x', 'b', nodes, 'dag1')).toBe('valid-under');
    expect(dropTargetState('a1x', 'a', nodes, 'dag1')).toBe('valid-under');
  });

  it('marks the dag header (null target) valid-root', () => {
    expect(dropTargetState('a1', null, nodes, 'dag1')).toBe('valid-root');
    expect(dropTargetState('root', null, nodes, 'dag1')).toBe('valid-root');
  });

  it('marks everything invalid when the dragged node is unknown', () => {
    expect(dropTargetState('nope', 'root', nodes, 'dag1')).toBe('invalid');
    expect(dropTargetState('nope', null, nodes, 'dag1')).toBe('invalid');
  });
});

describe('parseLabelsInput', () => {
  it('trims, drops empties, and dedupes preserving order', () => {
    expect(parseLabelsInput('a, b ,a')).toEqual(['a', 'b']);
  });

  it('returns an empty array for empty or whitespace input', () => {
    expect(parseLabelsInput('')).toEqual([]);
    expect(parseLabelsInput('   , ,')).toEqual([]);
  });

  it('keeps single labels and internal spaces intact', () => {
    expect(parseLabelsInput('urgent, follow up')).toEqual(['urgent', 'follow up']);
  });
});
