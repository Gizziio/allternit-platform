"""Unit tests for core/element_table.py — the shadow element table."""

from __future__ import annotations

from core.accessibility_inspector import AccessibilityNode
from core.element_table import (
    DEFAULT_MAX_ELEMENTS,
    WHITELIST_OPERATIONS,
    build_element_table,
    coverage_gaps,
    operations_for_role,
)


def _node(role: str = "", name: str = "", children=None, interactive: bool = False,
          ref_id: str = "", value: str = "") -> AccessibilityNode:
    return AccessibilityNode(
        role=role, name=name, value=value, ref_id=ref_id,
        children=children or [], is_interactive=interactive,
    )


def _sample_tree() -> AccessibilityNode:
    return _node("AXWindow", "Browser", [
        _node("AXTextField", "Search query", interactive=True),
        _node("AXButton", "Search", interactive=True),
        _node("AXStaticText", "Results for: x"),
        _node("AXScrollArea", "Results", [
            _node("AXLink", "First result", interactive=True),
        ], interactive=True),
        _node(children=[_node()]),  # empty wrapper — never observed
    ])


class TestIndexing:
    def test_indexes_only_observed_elements(self):
        table = build_element_table(_sample_tree())
        # 6 nodes carry a role or name (root window included — it is
        # observed); the two empty wrappers are not observed.
        assert table.total_observed == 6
        assert len(table) == 6
        assert [row.index for row in table.rows] == [0, 1, 2, 3, 4, 5]

    def test_depth_first_order(self):
        table = build_element_table(_sample_tree())
        assert [row.name for row in table.rows] == [
            "Browser", "Search query", "Search", "Results for: x", "Results",
            "First result",
        ]

    def test_accepts_compact_dict_shape(self):
        tree = _sample_tree()
        from core.element_refs import RefMap

        refmap = RefMap()
        refmap.apply_to_tree(tree)
        compact = tree.to_dict(compact=True)
        table = build_element_table(compact)
        assert len(table) == 6
        # refmap-assigned refs ride along on the rows; the refmap only refs
        # interactive nodes, so the static-text row carries none (its prompt
        # identity falls back to the table index).
        assert all(row.ref_id.startswith("@e") for row in table.rows if row.operations)
        static_row = next(r for r in table.rows if r.role == "AXStaticText")
        assert static_row.ref_id == ""


class TestClosedOperationSet:
    def test_operations_are_whitelist_subset(self):
        for role in ("AXButton", "AXTextField", "AXLink", "AXScrollArea",
                     "AXCheckBox", "AXPopUpButton", "AXUnknown"):
            ops = operations_for_role(role)
            assert set(ops) <= WHITELIST_OPERATIONS

    def test_per_role_operations(self):
        assert "click" in operations_for_role("AXButton")
        assert "fill" in operations_for_role("AXTextField")
        assert "scrollTo" in operations_for_role("AXScrollArea")
        assert operations_for_role("AXStaticText") == ()

    def test_supported_and_target_options(self):
        table = build_element_table(_sample_tree())
        supported = table.supported_operations()
        assert "click" in supported and "fill" in supported
        fill_targets = table.target_options("fill")
        assert fill_targets == ["1"]  # only the text field (root is row 0)
        click_targets = table.target_options("click")
        assert "2" in click_targets  # the Search button
        assert "1" not in click_targets
        # Unknown operations are closed: no options.
        assert table.target_options("navigate") == []

    def test_default_cap_matches_reference_pattern(self):
        assert DEFAULT_MAX_ELEMENTS == 250


class TestPruning:
    def _wide_tree(self, interactive_count: int, static_count: int) -> AccessibilityNode:
        children = [
            _node("AXButton", f"Button {i}", interactive=True)
            for i in range(interactive_count)
        ]
        children += [
            _node("AXStaticText", f"Static {i}") for i in range(static_count)
        ]
        return _node("AXWindow", "Browser", children)

    def test_pruning_prefers_interactive(self):
        tree = self._wide_tree(interactive_count=100, static_count=200)
        table = build_element_table(tree, max_elements=150)
        assert table.total_observed == 301  # root window included
        assert len(table) == 150
        assert table.pruned_count == 151
        # Depth-first order restored: the named window leads, then buttons,
        # then the surviving statics.
        assert table.rows[0].name == "Browser"
        assert [r.name for r in table.rows[1:101]] == [f"Button {i}" for i in range(100)]
        # And the surviving statics are the first ones in depth-first order.
        static_rows = [r for r in table.rows if r.name.startswith("Static")]
        assert [r.name for r in static_rows] == [f"Static {i}" for i in range(49)]

    def test_pruning_preserves_depth_first_order_within_tier(self):
        tree = self._wide_tree(interactive_count=100, static_count=10)
        table = build_element_table(tree, max_elements=60)
        assert [row.name for row in table.rows] == [f"Button {i}" for i in range(60)]

    def test_named_elements_outrank_role_only(self):
        # role-only nodes (tier 3) drop before named nodes (tier 2); the named
        # window and caption survive the cap=2 cut, the unnamed group does not.
        children = [
            _node("AXGroup", ""),  # role-only, tier 3
            _node("AXStaticText", "caption"),  # named, tier 2
        ]
        table = build_element_table(_node("AXWindow", "W", children), max_elements=2)
        assert [row.name for row in table.rows] == ["W", "caption"]


class TestRenderingAndMatching:
    def test_prompt_line_format(self):
        table = build_element_table(_sample_tree())
        lines = table.to_prompt_text().splitlines()
        assert lines[0] == "[0] AXWindow: Browser"
        assert lines[1].endswith("AXTextField: Search query")
        assert "] " in lines[1] and lines[1].startswith("[")

    def test_match_target_by_name_ref_and_substring(self):
        tree = _sample_tree()
        from core.element_refs import RefMap

        refmap = RefMap()
        refmap.apply_to_tree(tree)
        table = build_element_table(tree.to_dict(compact=True))
        search_row = next(r for r in table.rows if r.name == "Search")
        assert table.match_target("@e" + search_row.ref_id[2:]) == search_row.index
        assert table.match_target("Search") == search_row.index
        assert table.match_target("") is None


class TestInputCoverage:
    """Input-coverage check: AX trees can under-report interactive inputs
    (reference finding — a search box surfaced only via DOM, not AX). The
    table must index everything AX DOES report, and expose what it does NOT
    as an explicit gap list instead of silently missing inputs."""

    # The full form-heavy control set a DOM snapshot of the page would show.
    DOM_EXPECTED_CONTROLS = [
        "Search", "Email", "Password", "Remember me", "Submit", "Forgot password",
    ]

    def _ax_tree_underreporting_search(self) -> AccessibilityNode:
        """AX skeleton of the same page — the search box is missing from AX
        (exactly the reference under-reporting case)."""
        return _node("AXWindow", "Browser", [
            _node("AXGroup", "Login form", [
                _node("AXTextField", "Email", interactive=True),
                _node("AXTextField", "Password", interactive=True),
                _node("AXCheckBox", "Remember me", interactive=True),
                _node("AXButton", "Submit", interactive=True),
                _node("AXLink", "Forgot password", interactive=True),
            ]),
            _node("AXStaticText", "Search is available on this page"),
        ])

    def test_every_observed_input_is_indexed(self):
        """No silent drops WITHIN the observation: every interactive node AX
        reports lands in the table with its closed operation set."""
        tree = self._ax_tree_underreporting_search()
        flat_interactive = []

        def walk(node):
            if node.is_interactive:
                flat_interactive.append(node.name)
            for child in node.children:
                walk(child)

        walk(tree)
        table = build_element_table(tree.to_dict(compact=True))
        indexed_interactive = [row.name for row in table.rows if row.operations]
        assert sorted(indexed_interactive) == sorted(flat_interactive)

    def test_underreported_input_surfaces_as_gap(self):
        """The DOM-visible search box missing from AX must appear in the gap
        list — not be fuzzy-matched away (the static text mentioning
        'Search' must NOT count as the search input)."""
        table = build_element_table(
            self._ax_tree_underreporting_search().to_dict(compact=True)
        )
        gaps = coverage_gaps(table, self.DOM_EXPECTED_CONTROLS)
        assert gaps == ["Search"]

    def test_full_coverage_reports_no_gaps(self):
        tree = _node("AXWindow", "Browser", [
            _node("AXTextField", "Search", interactive=True),
            _node("AXTextField", "Email", interactive=True),
            _node("AXTextField", "Password", interactive=True),
            _node("AXCheckBox", "Remember me", interactive=True),
            _node("AXButton", "Submit", interactive=True),
            _node("AXLink", "Forgot password", interactive=True),
        ])
        table = build_element_table(tree.to_dict(compact=True))
        assert coverage_gaps(table, self.DOM_EXPECTED_CONTROLS) == []
