import type {AstNode} from './tokenTypes';

function isStandardToString(v: object): boolean {
	return (v as {toString?: unknown}).toString === Object.prototype.toString;
}

/** Returns true for non-null objects with a custom toString(), excluding Date (handled separately). */
function isCustomObject(v: unknown): boolean {
	return v !== null && typeof v === 'object' && !(v instanceof Date) && !isStandardToString(v);
}

function resolveProperty(data: Record<string, unknown>, path: string[]): unknown {
	let current: unknown = data;
	for (const segment of path) {
		if (current === null || current === undefined || typeof current !== 'object') {
			return undefined;
		}
		current = (current as Record<string, unknown>)[segment];
	}
	return current;
}

const SUPPORTED_FUNCTIONS: Record<string, (args: unknown[]) => unknown> = {
	contains: (args) => {
		const [haystack, needle] = args;
		if (typeof haystack !== 'string' || typeof needle !== 'string') {
			return false;
		}
		return haystack.includes(needle);
	},
	startswith: (args) => {
		const [str, prefix] = args;
		if (typeof str !== 'string' || typeof prefix !== 'string') {
			return false;
		}
		return str.startsWith(prefix);
	},
	endswith: (args) => {
		const [str, suffix] = args;
		if (typeof str !== 'string' || typeof suffix !== 'string') {
			return false;
		}
		return str.endsWith(suffix);
	},
	tolower: (args) => {
		const [str] = args;
		if (typeof str !== 'string') {
			return str;
		}
		return str.toLowerCase();
	},
	toupper: (args) => {
		const [str] = args;
		if (typeof str !== 'string') {
			return str;
		}
		return str.toUpperCase();
	},
	trim: (args) => {
		const [str] = args;
		if (typeof str !== 'string') {
			return str;
		}
		return str.trim();
	},
	length: (args) => {
		const [str] = args;
		if (typeof str !== 'string') {
			return 0;
		}
		return str.length;
	},
	concat: (args) => {
		const [a, b] = args;
		if (typeof a !== 'string' || typeof b !== 'string') {
			return '';
		}
		return a + b;
	},
	indexof: (args) => {
		const [str, search] = args;
		if (typeof str !== 'string' || typeof search !== 'string') {
			return -1;
		}
		return str.indexOf(search);
	},
	substring: (args) => {
		const [str, start, len] = args;
		if (typeof str !== 'string' || typeof start !== 'number') {
			return '';
		}
		return len !== undefined ? str.substring(start, start + (len as number)) : str.substring(start);
	},
};

function toMs(v: unknown): number {
	if (v instanceof Date) {
		return v.getTime();
	}
	if (typeof v === 'string') {
		return new Date(v).getTime();
	}
	return Number.NaN;
}

/**
 * Returns result of possibly coercing a value to a string.
 * @param value The value to potentially coerce to a string.
 * @returns An object indicating whether coercion was performed and the resulting value if applicable.
 */
function coerceToStringResult(value: unknown): {ok: true; value: string} | {ok: false} {
	// Coerce objects with custom toString() to string (like MongoDB ObjectId instance)
	if (isCustomObject(value)) {
		return {ok: true, value: String(value)};
	}
	return {ok: false};
}

/**
 * Evaluate the AST against the provided data object, returning the result of the evaluation.
 * @param node The AST node to evaluate.
 * @param data The data object to evaluate against.
 * @returns The result of the evaluation.
 */
export function evaluate(node: AstNode, data: Record<string, unknown>): unknown {
	switch (node.kind) {
		case 'literal':
			return node.value;

		case 'property':
			return resolveProperty(data, node.path);

		case 'comparison': {
			let left = evaluate(node.left, data);
			let right = evaluate(node.right, data);
			const leftCoercionRes = coerceToStringResult(left);
			const rightCoercionRes = coerceToStringResult(right);
			// Tier 1: Coerce Date instances — convert both sides to ms
			if (left instanceof Date || right instanceof Date) {
				left = toMs(left);
				right = toMs(right);
			} else if (leftCoercionRes.ok || rightCoercionRes.ok) {
				// Tier 2: Objects with a custom coerce to string
				left = leftCoercionRes.ok ? leftCoercionRes.value : left;
				right = rightCoercionRes.ok ? rightCoercionRes.value : right;
			}
			const operator = node.operator;
			switch (operator) {
				case 'eq':
					return left === right;
				case 'ne':
					return left !== right;
				case 'gt':
					return (left as number) > (right as number);
				case 'ge':
					return (left as number) >= (right as number);
				case 'lt':
					return (left as number) < (right as number);
				case 'le':
					return (left as number) <= (right as number);
				default:
					throw new Error(`Unsupported operator '${operator satisfies never}'`);
			}
		}

		case 'lambda': {
			const collection = resolveProperty(data, node.path);
			if (!Array.isArray(collection)) {
				return false;
			}
			if (node.operator === 'any') {
				return collection.some((item) =>
					Boolean(
						evaluate(node.predicate, {
							...data,
							[node.variable]: item,
						}),
					),
				);
			}
			return collection.every((item) =>
				Boolean(
					evaluate(node.predicate, {
						...data,
						[node.variable]: item,
					}),
				),
			);
		}

		case 'logical': {
			const left = evaluate(node.left, data);
			const right = evaluate(node.right, data);
			if (node.operator === 'and') {
				return Boolean(left) && Boolean(right);
			}
			return Boolean(left) || Boolean(right);
		}

		case 'not':
			return !evaluate(node.operand, data);

		case 'functionCall': {
			const fn = SUPPORTED_FUNCTIONS[node.name];
			if (!fn) {
				throw new Error(`Unsupported function '${node.name}'`);
			}
			const args = node.args.map((arg) => evaluate(arg, data));
			return fn(args);
		}
	}
}
