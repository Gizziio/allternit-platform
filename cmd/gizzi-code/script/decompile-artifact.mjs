#!/usr/bin/env node
// decompile-artifact.mjs — de-compile React Compiler build artifacts committed
// as source under src/cli/ui/ink-app/ back to ordinary TSX.
//
// Spec: docs/programs/gizzi/INK_APP_COMPILER_ARTIFACTS.md (§6.1 transformation
// rules). Operates on the CURRENT committed text (never a compiler re-run), so
// hand patches inside the compiled idiom are carried through.
//
// What it does, per file:
//   1. Verifies the artifact fingerprint (react/compiler-runtime import + $[n]
//      slots) and refuses non-artifacts.
//   2. Removes the `import { c as _c } from "react/compiler-runtime"` line.
//   3. Removes the `// biome-ignore-all assist/source/organizeImports:
//      ANT-ONLY ...` marker comment (artifact-only lint suppression).
//   4. Removes `const $ = _c(N);` and every memo-cache block:
//        let t1;
//        if ($[a] !== depA || $[b] === Symbol.for("react.memo_cache_sentinel")) {
//          t1 = <expr>;
//          $[a] = depA;
//          $[c] = t1;
//        } else {
//          t1 = $[c];
//        }
//      becomes `const t1 = <expr>;` — the cache-miss guard is dropped, so the
//      expression evaluates on every render (semantics-preserving: the cache
//      is a referential-transparency optimization; see spec §6.1 rule 1 and the
//      §8 risk register on hook order — every statement stays in compiled
//      evaluation order, and no hook call moves across a conditional return).
//      Branch-local statements (e.g. `const formatted = ...`) are kept in
//      order; cache-slot writes are dropped; multi-name blocks become one
//      const per name, in original order.
//   5. Renames compiler-flattened `function C(t0) { const {...} = t0; }` back
//      to `function C({ ... }: Props)` where a Props type exists in-file
//      (spec rule 3).
//   6. Removes the trailing `//# sourceMappingURL=data:...` line — it maps to
//      the compiled output and is artifact junk once the body is decompiled.
//
// What it deliberately does NOT do (hand-fix after running):
//   - Any `$[k]` read outside the standard memo-block if/else idiom (the run
//     report lists files where leftovers remain).
//   - Removing `// @ts-nocheck` headers — decided per file AFTER `tsc` runs
//     clean (spec rule 5). Use --strip-nocheck to remove them here instead.
//
//   Scanner note: the brace/statement scanners are string-aware but not
//   JSX-aware; a quote preceded by a word char/`>` (JSX text apostrophes like
//   `Gizzi's`) or with no same-line closer is treated as literal text so it
//   cannot desync brace-depth tracking.
//
// Usage:
//   node script/decompile-artifact.mjs [--strip-nocheck] <file.tsx> [...]
// Exit 0 even when hand-fixes are needed (they are reported); exit 1 only on
// hard failures (unreadable file, parse-impossible output).

import { readFileSync, writeFileSync } from "node:fs"

const args = process.argv.slice(2)
const stripNocheck = args.includes("--strip-nocheck")
const files = args.filter((a) => !a.startsWith("--"))

const FINGERPRINT = 'import { c as _c } from "react/compiler-runtime"'

// ── Low-level scanners (string/comment/template-aware) ────────────────────────

function scan(text, from, stop) {
  // Walk from `from`, tracking (){}[] depth and string/template/comment state.
  // Returns index of the first position where depth < 0 (i.e. the closer that
  // took us below the depth at `from`), or stop/length. opener at `from` must
  // be one of "([{" — we start just AFTER it with depth 1.
  let depth = 1
  let i = from
  const n = Math.min(text.length, stop ?? text.length)
  while (i < n) {
    const c = text[i]
    const next = text[i + 1]
    if (c === "'" || c === '"') {
      // JSX text apostrophes (e.g. `Gizzi's`) are not string openers. A quote
      // immediately preceded by a word char/`$`/`>` (JSX text or tag edge) or
      // with no closing quote on the same line is literal text — skip just it.
      const prev = i > 0 ? text[i - 1] : "\n"
      const nl = text.indexOf("\n", i + 1)
      const close = text.indexOf(c, i + 1)
      if (/[\w$)>]/.test(prev) || close === -1 || (nl !== -1 && close > nl)) {
        i++
        continue
      }
      i++
      while (i < n && text[i] !== c) {
        if (text[i] === "\\") i++
        i++
      }
      i++
      continue
    }
    if (c === "`") {
      i++
      while (i < n) {
        if (text[i] === "\\") {
          i += 2
          continue
        }
        if (text[i] === "`") break
        if (text[i] === "$" && text[i + 1] === "{") {
          i += 2
          let td = 1
          while (i < n && td > 0) {
            if (text[i] === "{") td++
            else if (text[i] === "}") td--
            i++
          }
          continue
        }
        i++
      }
      i++
      continue
    }
    if (c === "/" && next === "/") {
      i += 2
      while (i < n && text[i] !== "\n") i++
      continue
    }
    if (c === "/" && next === "*") {
      i += 2
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++
      i += 2
      continue
    }
    if (c === "(" || c === "{" || c === "[") depth++
    else if (c === ")" || c === "}" || c === "]") {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

function splitStatements(body) {
  // Split a brace-balanced block body into top-level statements (spans include
  // leading whitespace; the trailing `;` is included when present).
  const spans = []
  let start = 0
  let depth = 0
  let i = 0
  const n = body.length
  while (i < n) {
    const c = body[i]
    const next = body[i + 1]
    if (c === "'" || c === '"') {
      // Same JSX-text rule as scan(): word-char/`>`-preceded quotes or quotes
      // with no same-line closer are literal text, not string openers.
      const prev = i > 0 ? body[i - 1] : "\n"
      const nl = body.indexOf("\n", i + 1)
      const close = body.indexOf(c, i + 1)
      if (/[\w$)>]/.test(prev) || close === -1 || (nl !== -1 && close > nl)) {
        i++
        continue
      }
      i++
      while (i < n && body[i] !== c) {
        if (body[i] === "\\") i++
        i++
      }
      i++
      continue
    }
    if (c === "`") {
      i++
      while (i < n) {
        if (body[i] === "\\") {
          i += 2
          continue
        }
        if (body[i] === "`") break
        if (body[i] === "$" && body[i + 1] === "{") {
          i += 2
          let td = 1
          while (i < n && td > 0) {
            if (body[i] === "{") td++
            else if (body[i] === "}") td--
            i++
          }
          continue
        }
        i++
      }
      i++
      continue
    }
    if (c === "/" && next === "/") {
      i += 2
      while (i < n && body[i] !== "\n") i++
      continue
    }
    if (c === "/" && next === "*") {
      i += 2
      while (i < n && !(body[i] === "*" && body[i + 1] === "/")) i++
      i += 2
      continue
    }
    if (c === "(" || c === "{" || c === "[") depth++
    else if (c === ")" || c === "}" || c === "]") {
      depth--
      // Control-flow statements (if/for/while/labeled blocks) need no `;` —
      // split after their closing brace so a following `NAME = …;` result
      // assignment stays its own statement. Object literals never reach this
      // at span start (they are preceded by `= ` inside an assignment that
      // ends with `;`). Kept spans reassemble verbatim, so a split is safe.
      if (depth === 0 && c === "}") {
        const head = body.slice(start, i + 1).trimStart()
        if (/^(?:if|for|while|switch|do|else|try|catch|finally|bb\d+\s*:|[A-Za-z_$][\w$]*\s*:)/.test(head)) {
          spans.push(body.slice(start, i + 1))
          start = i + 1
        }
      }
    } else if (c === ";" && depth === 0) {
      spans.push(body.slice(start, i + 1))
      start = i + 1
    }
    i++
  }
  if (start < n) spans.push(body.slice(start))
  return spans
}

// ── Memo-cache block elimination ─────────────────────────────────────────────

const LET_LINE = /^([ \t]*)let ([A-Za-z_$][\w$]*);[ \t]*(\n|$)/
const IF_LINE = /^[ \t]*if \(/

function tryParseMemoBlock(text, pos) {
  // pos is at the start of a `let NAME;` line. Returns null unless this begins
  // a compiler memo-cache block (one or more `let NAME;` lines followed by
  // `if ($[...] ...) { ... } else { ... }`).
  let m = LET_LINE.exec(text.slice(pos))
  if (!m) return null
  const indent = m[1]
  const names = [m[2]]
  let p = pos + m[0].length
  while (true) {
    const lm = LET_LINE.exec(text.slice(p))
    if (!lm || lm[1] !== indent || lm[3] === "") break
    // greedily consume adjacent same-indent `let NAME;` lines — multi-name
    // memo blocks declare all their temps up front. Over-consumption is safe:
    // the full validation below rejects non-memo shapes, and the outer scan
    // retries from the next `let` line with a shorter name list.
    names.push(lm[2])
    p = p + lm[0].length
  }
  if (!IF_LINE.test(text.slice(p))) return null
  // condition
  const condOpen = text.indexOf("(", p)
  const condClose = scan(text, condOpen + 1)
  if (condClose < 0) return null
  const cond = text.slice(condOpen + 1, condClose)
  if (!cond.includes("$[")) return null
  // reject anything but a pure dep-guard comparison: no statements, no
  // assignments (=== / !== / == are fine — strip them before looking for =)
  const stripped = cond.replace(/!==|===|==|!=/g, "")
  if (/[=;]/.test(stripped)) return null
  let q = condClose + 1
  while (q < text.length && /[ \t]/.test(text[q])) q++
  if (text[q] !== "{") return null
  const ifClose = scan(text, q + 1)
  if (ifClose < 0) return null
  const ifBody = text.slice(q + 1, ifClose)
  q = ifClose + 1
  while (q < text.length && /[ \t\n]/.test(text[q])) q++
  const em = /^else[ \t]*\{/.exec(text.slice(q))
  if (!em) return null
  const elseOpen = q + text.slice(q).indexOf("{")
  const elseClose = scan(text, elseOpen + 1)
  if (elseClose < 0) return null
  const elseBody = text.slice(elseOpen + 1, elseClose)

  // Classify statements.
  const ifStmts = splitStatements(ifBody)
  const elseStmts = splitStatements(elseBody).map((s) => s.trim()).filter(Boolean)
  const nameSet = new Set(names)
  // else branch: strictly `NAME = $[k];` for each declared name, once each.
  const elseSeen = new Map()
  for (const s of elseStmts) {
    const sm = /^([A-Za-z_$][\w$]*) = \$\[\d+\];$/.exec(s)
    if (!sm || !nameSet.has(sm[1]) || elseSeen.has(sm[1])) return null
    elseSeen.set(sm[1], true)
  }
  if (elseSeen.size !== names.length) return null

  const resultAssigns = new Map()
  const destructureOnly = new Set() // assigned via `({...} = expr)`, needs `let` preserved
  for (const raw of ifStmts) {
    const trimmed = raw.trim()
    if (trimmed === "") continue
    const slotWrite = /^\$\[\d+\] = ([\s\S]*?);$/.exec(trimmed)
    if (slotWrite) continue // cache write — dropped
    // paren-wrapped destructuring assignment `({ a, b } = expr);` — the
    // compiler hoisted the declarations, so count the destructured names as
    // result assignments (the statement itself is kept in order below)
    const destructure = /^\(\s*\{([\s\S]*?)\}\s*=[\s\S]*\)\s*;?$/.exec(trimmed)
    if (destructure) {
      for (const part of destructure[1].split(",")) {
        const nm = /^([A-Za-z_$][\w$]*)/.exec(part.trim())
        if (nm && nameSet.has(nm[1])) {
          if (resultAssigns.has(nm[1])) return null
          resultAssigns.set(nm[1], true)
          destructureOnly.add(nm[1])
        }
      }
    }
    const assign = /^([A-Za-z_$][\w$]*) = ([\s\S]*?);?$/.exec(trimmed)
    if (assign && nameSet.has(assign[1])) {
      if (resultAssigns.has(assign[1])) return null
      resultAssigns.set(assign[1], true)
      destructureOnly.delete(assign[1])
    }
    // any other statement (const/let/if/...) is kept, in order, by the
    // replacement builder below
  }
  if (resultAssigns.size !== names.length) return null

  // Build replacement in the if-branch's original statement order: result
  // assignments become `const NAME = expr;`, branch-local statements are kept,
  // cache-slot writes are dropped. Names assigned only via the destructuring
  // statement keep their original `let NAME;` declaration (they cannot be
  // const — the destructure assigns them).
  const ordered = []
  for (const name of destructureOnly) {
    ordered.push(`${indent}let ${name};\n`)
  }
  for (const raw of ifStmts) {
    const trimmed = raw.trim()
    if (trimmed === "") continue
    const assign = /^([A-Za-z_$][\w$]*) = ([\s\S]*?);?$/.exec(trimmed)
    if (assign && nameSet.has(assign[1])) {
      ordered.push(dedentStmt(`${assign[1]} = ${assign[2]};`, indent, true))
    } else if (!/^\$\[\d+\] = ([\s\S]*?);$/.exec(trimmed)) {
      ordered.push(dedentStmt(raw, indent))
    }
  }
  const replacement = ordered.join("")
  return { start: pos, end: elseClose + 1, replacement, names }
}

function dedentStmt(raw, baseIndent, asConst = false) {
  // Remove the branch's extra indentation so the statement aligns at the
  // memo block's original indent, then optionally turn `NAME = expr;` into
  // `const NAME = expr;`.
  const lines = raw.replace(/\n$/, "").split("\n")
  const first = lines[0]
  const lead = /^[ \t]*/.exec(first)[0]
  const cut = Math.max(0, lead.length - baseIndent.length)
  const out = lines
    .map((l, idx) => {
      let d = l
      if (idx === 0) d = l.slice(cut)
      else if (l.startsWith(lead)) d = l.slice(cut)
      return d
    })
    .join("\n")
  let body = out
  if (asConst) body = out.replace(/^([A-Za-z_$][\w$]*) = /, "const $1 = ")
  return baseIndent + body.trimStart() + "\n"
}

function eliminateMemoBlocks(source) {
  let text = source
  let count = 0
  let guard = 0
  while (guard++ < 10000) {
    let replaced = false
    // find candidate `let NAME;` lines
    const re = /^[ \t]*let [A-Za-z_$][\w$]*;[ \t]*$/gm
    let mm
    while ((mm = re.exec(text)) !== null) {
      const parsed = tryParseMemoBlock(text, mm.index)
      if (parsed) {
        text = text.slice(0, parsed.start) + parsed.replacement + text.slice(parsed.end)
        count++
        replaced = true
        break
      }
    }
    if (!replaced) break
  }
  return { text, count }
}

// ── Duplicate-const rename pass ──────────────────────────────────────────────

function maskNonCode(text) {
  // Return a same-length copy with string/comment/template contents blanked
  // (replaced by spaces, newlines kept) so regexes see code tokens only.
  const out = text.split("")
  const n = text.length
  let i = 0
  while (i < n) {
    const c = text[i]
    const next = text[i + 1]
    if (c === "'" || c === '"') {
      // JSX-text rule (same as scan()): word-char/`>`-preceded quotes or
      // quotes with no same-line closer are literal text, not strings.
      const prev = i > 0 ? text[i - 1] : "\n"
      const nl = text.indexOf("\n", i + 1)
      const close = text.indexOf(c, i + 1)
      if (/[\w$)>]/.test(prev) || close === -1 || (nl !== -1 && close > nl)) {
        i++
        continue
      }
      const start = i
      i++
      while (i < n && text[i] !== c) {
        if (text[i] === "\\") i++
        i++
      }
      i++
      for (let k = start; k < Math.min(i, n); k++) if (out[k] !== "\n") out[k] = " "
      continue
    }
    if (c === "`") {
      const start = i
      i++
      while (i < n) {
        if (text[i] === "\\") {
          i += 2
          continue
        }
        if (text[i] === "`") break
        if (text[i] === "$" && text[i + 1] === "{") {
          // ${...} holds code — recurse on the inner range
          const innerOpen = i + 1
          let td = 1
          i += 2
          while (i < n && td > 0) {
            if (text[i] === "{") td++
            else if (text[i] === "}") td--
            i++
          }
          const inner = maskNonCode(text.slice(innerOpen + 1, i - 1))
          for (let k = 0; k < inner.length; k++) {
            if (inner[k] !== "\n") out[innerOpen + 1 + k] = " "
          }
          // keep the ${ and } visible for brace balance
          for (let k = start; k < innerOpen + 1; k++) if (out[k] !== "\n") out[k] = " "
          continue
        }
        i++
      }
      i++
      for (let k = start; k < Math.min(i, n); k++) if (out[k] !== "\n") out[k] = " "
      continue
    }
    if (c === "/" && next === "/") {
      const start = i
      i += 2
      while (i < n && text[i] !== "\n") i++
      for (let k = start; k < i; k++) out[k] = " "
      continue
    }
    if (c === "/" && next === "*") {
      const start = i
      i += 2
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++
      i += 2
      for (let k = start; k < Math.min(i, n); k++) if (out[k] !== "\n") out[k] = " "
      continue
    }
    i++
  }
  return out.join("")
}

function dedupeConstDecls(source) {
  // Memo-block inlining flattens compiler temps that reused a name across
  // cache regions in sibling scopes — e.g. two `let t8;` where one lived
  // inside an if-branch — producing duplicate `const t8` in one scope.
  // The input files are valid JS, so ANY same-scope duplicate const in the
  // output is script-created; rename the later binding and its reads.
  let text = source
  let total = 0
  for (let round = 0; round < 20; round++) {
    const mask = maskNonCode(text)
    const n = mask.length
    // brace matching per position
    const matchBrace = new Int32Array(n).fill(-1)
    const stack = []
    for (let i = 0; i < n; i++) {
      if (mask[i] === "{") stack.push(i)
      else if (mask[i] === "}") {
        const open = stack.pop()
        matchBrace[open] = i
        matchBrace[i] = open
      }
    }
    const rootEnd = n
    const scopeEnd = (scopeId) => (scopeId < 0 ? rootEnd : matchBrace[scopeId])
    // collect const declarations: name, position, scope, statement end
    const decls = []
    const declRe = /\bconst ([A-Za-z_$][\w$]*) =/g
    let dm
    while ((dm = declRe.exec(mask)) !== null) {
      const pos = dm.index
      // scope enclosing the decl: innermost brace before pos
      let scope = -1
      for (let j = pos - 1; j >= 0; j--) {
        if (mask[j] === "}") {
          j = matchBrace[j]
          continue
        }
        if (mask[j] === "{") {
          scope = j
          break
        }
      }
      // statement end: next `;` at the declaration's brace depth
      let depth = 0
      let k = pos
      let stmtEnd = -1
      while (k < n) {
        const ch = mask[k]
        if (ch === "{") depth++
        else if (ch === "}") {
          if (depth === 0) break
          depth--
        } else if (ch === ";" && depth === 0) {
          stmtEnd = k + 1
          break
        }
        k++
      }
      if (stmtEnd < 0) stmtEnd = k
      decls.push({ name: dm[1], pos, scope, stmtEnd })
    }
    // group by (scope, name), find duplicates
    const seen = new Map()
    let dup = null
    for (const d of decls) {
      const key = `${d.scope}:${d.name}`
      if (seen.has(key)) {
        dup = { first: seen.get(key), second: d }
        break
      }
      seen.set(key, d)
    }
    if (!dup) break
    // rename the later declaration and reads in (stmtEnd, scopeEnd),
    // skipping nested scopes that bind the same name (legal shadowing)
    const { name, stmtEnd, scope, pos: declPos } = dup.second
    const end = scopeEnd(scope)
    const shadowRanges = decls
      .filter((d) => d.name === name && d.pos > dup.second.pos && d.pos < end && d.scope !== scope)
      .map((d) => [d.pos, scopeEnd(d.scope)])
    let newName = `${name}_2`
    while (new RegExp(`\\b${newName}\\b`).test(text)) newName += "_"
    const nameRe = new RegExp(`\\b${name}\\b`, "g")
    let tail = text.slice(stmtEnd, end)
    tail = tail.replace(nameRe, (m, off) => {
      const abs = stmtEnd + off
      for (const [s, e] of shadowRanges) if (abs >= s && abs < e) return m
      return newName
    })
    let newText = text.slice(0, stmtEnd) + tail + text.slice(end)
    // rename the declaration binding itself (first occurrence at/after declPos)
    newText =
      newText.slice(0, declPos) +
      newText.slice(declPos).replace(new RegExp(`\\b${name}\\b`), newName)
    text = newText
    total++
  }
  return { text, renamed: total }
}

// ── t0 param rename (spec rule 3) ────────────────────────────────────────────

function renameT0Params(source) {
  const typeDefs = new Map() // typeName -> body text
  for (const tm of source.matchAll(/(?:^|\n)(?:export )?(?:type|interface) ([A-Za-z_$][\w$]*)[^=]*(?:= ?\{|\{)/g)) {
    const openIdx = tm.index + tm[0].lastIndexOf("{")
    const closeIdx = scan(source, openIdx + 1)
    if (closeIdx > 0) typeDefs.set(tm[1], source.slice(openIdx + 1, closeIdx))
  }
  const propsTypes = [...typeDefs.keys()].filter((t) => /Props?$/.test(t))
  let text = source
  let renamed = 0
  const re = /((?:export )?function ([A-Za-z_$][\w$]*))\(t0\) \{\n[ \t]*const \{\n([\s\S]*?)\n[ \t]*\} = t0;\n/g
  text = text.replace(re, (whole, fnDecl, fnName, inner) => {
    // destructured property names (handle `prop` and `prop: alias` forms)
    const destructured = [...inner.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*(?::|,|$)/gm)].map((m) => m[1])
    let propsType = null
    if (typeDefs.has(`${fnName}Props`)) propsType = `${fnName}Props`
    else if (typeDefs.has("Props")) propsType = "Props"
    else if (propsTypes.length === 1) propsType = propsTypes[0]
    // only annotate when every destructured name is a member of the type —
    // files with several components share names like `Props` across
    // incompatible shapes, and a wrong annotation is worse than none
    if (propsType) {
      const body = typeDefs.get(propsType)
      const missing = destructured.filter((d) => !new RegExp(`^\\s*${d}\\s*\\??\\s*:`, "m").test(body))
      if (missing.length > 0) propsType = null
    }
    if (!propsType) return whole
    renamed++
    return `${fnDecl}({\n${inner}\n}: ${propsType}) {\n`
  })
  return { text, renamed }
}

// ── Per-file driver ───────────────────────────────────────────────────────────

function transform(source) {
  const report = { memoBlocks: 0, renamedParams: 0, renamedConsts: 0, leftovers: [], fingerprint: false }
  if (!source.includes(FINGERPRINT)) {
    return { ok: false, reason: "fingerprint missing (react/compiler-runtime import not found)", report }
  }
  report.fingerprint = true
  let text = source

  // 2. runtime import
  text = text.replace(/^import \{ c as _c \} from "react\/compiler-runtime";\n/gm, "")
  // 3. ANT-ONLY biome marker (artifact-only)
  text = text.replace(/^\/\/ biome-ignore-all assist\/source\/organizeImports: ANT-ONLY[^\n]*\n/gm, "")
  // 4. cache-array allocation
  text = text.replace(/^[ \t]*const \$ = _c\(\d+\);\n/gm, "")

  // memo-cache blocks
  const eliminated = eliminateMemoBlocks(text)
  text = eliminated.text
  report.memoBlocks = eliminated.count

  // 4b. duplicate const declarations created by flattening sibling-scope
  // compiler temps that reused a name
  const dedup = dedupeConstDecls(text)
  text = dedup.text
  report.renamedConsts = dedup.renamed

  // 5. t0 rename
  const rn = renameT0Params(text)
  text = rn.text
  report.renamedParams = rn.renamed

  // 6. trailing sourcemap
  text = text.replace(/\n\/\/# sourceMappingURL=data:[^\n]*\n?$/, "\n")

  // leftover cache-slot references → hand-fix
  const leftoverRe = /\$\[\d+\]/g
  const lm = text.match(leftoverRe)
  report.leftovers = lm ? lm.length : 0

  if (stripNocheck) {
    text = text.replace(/^\/\/ @ts-nocheck\n/gm, "")
  }

  return { ok: true, text, report }
}

let failures = 0
let needsHandFix = 0
for (const file of files) {
  let source
  try {
    source = readFileSync(file, "utf8")
  } catch (err) {
    console.log(`FAIL ${file}: unreadable (${err.message})`)
    failures++
    continue
  }
  const result = transform(source)
  if (!result.ok) {
    console.log(`SKIP ${file}: ${result.reason}`)
    continue
  }
  const r = result.report
  const hand = r.leftovers > 0 ? ` HAND-FIX-NEEDED(leftover $[k] x${r.leftovers})` : ""
  if (r.leftovers > 0) needsHandFix++
  const dups = r.renamedConsts > 0 ? ` dupConstRenames=${r.renamedConsts}` : ""
  try {
    writeFileSync(file, result.text)
    console.log(`OK   ${file}: memoBlocks=${r.memoBlocks} t0renames=${r.renamedParams}${dups}${hand}`)
  } catch (err) {
    console.log(`FAIL ${file}: unwritable (${err.message})`)
    failures++
  }
}
console.log(`\n${files.length} file(s): ${failures} failures, ${needsHandFix} need hand-fix`)
process.exit(failures > 0 ? 1 : 0)
