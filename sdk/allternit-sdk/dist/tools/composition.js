/**
 * Tool Composition DSL
 *
 * Provides a declarative, composable DSL for defining tool execution
 * workflows. Supports sequence, parallel, condition, and loop primitives
 * that resolve against the active ToolRegistry.
 */
// ─── Builder API ─────────────────────────────────────────────────────────────
export function sequence(...steps) {
    return { type: 'sequence', steps };
}
export function parallel(...branches) {
    return { type: 'parallel', branches };
}
export function parallelWithConcurrency(concurrency, ...branches) {
    return { type: 'parallel', branches, concurrency };
}
export function condition(when, then, elseStep) {
    return { type: 'condition', when, then, else: elseStep };
}
export function loop(over, as, body, maxIterations) {
    return { type: 'loop', over, as, body, maxIterations };
}
export function toolCall(name, args, storeAs) {
    return { type: 'tool_call', name, arguments: args, storeAs };
}
// ─── Evaluator ───────────────────────────────────────────────────────────────
/**
 * Resolves a simple dotted expression (e.g. `user.name`) or bracket-indexed
 * path against a flat context object.  Supports `{{expr}}` templates in
 * string values.
 */
function resolveExpression(expr, ctx) {
    // Strip optional surrounding braces
    const cleaned = expr.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();
    const parts = cleaned.split('.');
    let current = ctx;
    for (const part of parts) {
        if (current == null || typeof current !== 'object')
            return undefined;
        const match = part.match(/^(\w+)\[(\d+)\]$/);
        if (match) {
            current = current[match[1]];
            if (Array.isArray(current)) {
                current = current[parseInt(match[2], 10)];
            }
            else {
                return undefined;
            }
        }
        else {
            current = current[part];
        }
    }
    return current;
}
/**
 * Resolves `{{expr}}` placeholders inside string values of an arguments object.
 */
function resolveArguments(args, ctx) {
    const resolved = {};
    for (const [key, value] of Object.entries(args)) {
        if (typeof value === 'string') {
            const templateRe = /\{\{([^}]+)\}\}/g;
            let match;
            let hasTemplate = false;
            let result = value;
            while ((match = templateRe.exec(value)) !== null) {
                hasTemplate = true;
                const resolved = resolveExpression(match[1], ctx);
                result = result.replace(match[0], resolved == null ? '' : String(resolved));
            }
            // If the entire value was a single template and resolved to a non-string,
            // return the raw value to preserve types (numbers, booleans, objects).
            if (hasTemplate) {
                const fullMatch = value.match(/^\{\{([^}]+)\}\}$/);
                if (fullMatch) {
                    const raw = resolveExpression(fullMatch[1], ctx);
                    resolved[key] = raw ?? result;
                }
                else {
                    resolved[key] = result;
                }
            }
            else {
                resolved[key] = value;
            }
        }
        else if (value && typeof value === 'object' && !Array.isArray(value)) {
            resolved[key] = resolveArguments(value, ctx);
        }
        else {
            resolved[key] = value;
        }
    }
    return resolved;
}
function isTruthy(value) {
    if (value == null)
        return false;
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return value !== 0;
    if (typeof value === 'string')
        return value.length > 0;
    if (Array.isArray(value))
        return value.length > 0;
    return true;
}
/**
 * Evaluates a composition workflow against a tool registry.
 *
 * The shared context accumulates tool results as the workflow progresses.
 * Template expressions (`{{key}}`) in arguments are resolved against this
 * context before each tool call.
 */
export async function executeComposition(registry, root, initialContext = {}) {
    const ctx = { ...initialContext };
    const errors = [];
    async function runStep(step) {
        switch (step.type) {
            case 'sequence':
                for (const child of step.steps) {
                    await runStep(child);
                }
                break;
            case 'parallel': {
                const concurrency = step.concurrency ?? step.branches.length;
                const queue = [...step.branches];
                const workers = [];
                const next = async () => {
                    while (queue.length > 0) {
                        const branch = queue.shift();
                        if (branch)
                            await runStep(branch);
                    }
                };
                for (let i = 0; i < concurrency; i++) {
                    workers.push(next());
                }
                await Promise.all(workers);
                break;
            }
            case 'condition': {
                const condValue = resolveExpression(step.when, ctx);
                if (isTruthy(condValue)) {
                    await runStep(step.then);
                }
                else if (step.else) {
                    await runStep(step.else);
                }
                break;
            }
            case 'loop': {
                const iterable = resolveExpression(step.over, ctx);
                if (!Array.isArray(iterable)) {
                    errors.push({ step: `loop over ${step.over}`, error: 'expression did not resolve to an array' });
                    return;
                }
                const max = step.maxIterations ?? 50;
                const items = iterable.slice(0, max);
                for (let i = 0; i < items.length; i++) {
                    ctx[step.as] = items[i];
                    ctx[`${step.as}_index`] = i;
                    await runStep(step.body);
                }
                break;
            }
            case 'tool_call': {
                const tool = registry.getTool(step.name);
                if (!tool) {
                    errors.push({ step: step.name, error: `tool "${step.name}" not found in registry` });
                    return;
                }
                if (!tool.execute) {
                    errors.push({ step: step.name, error: `tool "${step.name}" has no execute handler` });
                    return;
                }
                const resolvedArgs = resolveArguments(step.arguments, ctx);
                try {
                    if (tool.preExecute) {
                        const gate = await tool.preExecute(resolvedArgs, ctx);
                        if (!gate.proceed) {
                            errors.push({ step: step.name, error: gate.reason ?? 'blocked by preExecute' });
                            return;
                        }
                    }
                    const result = await tool.execute(resolvedArgs, ctx);
                    const storeKey = step.storeAs ?? `${step.name}_result`;
                    ctx[storeKey] = result;
                    if (tool.postExecute) {
                        await tool.postExecute(resolvedArgs, result, ctx);
                    }
                }
                catch (err) {
                    errors.push({
                        step: step.name,
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
                break;
            }
        }
    }
    await runStep(root);
    return {
        success: errors.length === 0,
        context: ctx,
        errors,
    };
}
