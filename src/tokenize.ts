import type {Token} from './tokenTypes';

const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const whiteSpaceChars = new Set([' ', '\t', '\r', '\n']);

/**
 * Tokenize an OData filter string into an array of tokens.
 * @param input The OData filter string.
 * @returns An array of tokens representing the filter string.
 */
export function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;

	while (i < input.length) {
		const char = input[i];
		// Skip whitespace
		if (!char || whiteSpaceChars.has(char)) {
			i++;
			continue;
		}

		// Parentheses
		if (char === '(') {
			tokens.push({type: 'lparen', value: '('});
			i++;
			continue;
		}
		if (char === ')') {
			tokens.push({type: 'rparen', value: ')'});
			i++;
			continue;
		}

		// Comma
		if (char === ',') {
			tokens.push({type: 'comma', value: ','});
			i++;
			continue;
		}

		// Forward slash (property path separator)
		if (char === '/') {
			tokens.push({type: 'slash', value: '/'});
			i++;
			continue;
		}

		// Colon (lambda separator)
		if (char === ':') {
			tokens.push({type: 'colon', value: ':'});
			i++;
			continue;
		}

		// String literal
		if (char === "'") {
			i++; // skip opening quote
			let str = '';
			while (i < input.length) {
				const c = input[i];
				if (c === "'" && input[i + 1] === "'") {
					str += "'"; // escaped single quote
					i += 2;
				} else if (c === "'") {
					break;
				} else {
					str += c ?? '';
					i++;
				}
			}
			if (i >= input.length) {
				throw new Error('Unterminated string literal');
			}
			i++; // skip closing quote
			tokens.push({type: 'string', value: str});
			continue;
		}

		const datetimeCandidate = input.slice(i, i + 35);
		const datetimeMatch = datetimeCandidate.match(ISO_DATETIME_REGEX);
		if (datetimeMatch) {
			tokens.push({type: 'datetime', value: datetimeMatch[0]});
			i += datetimeMatch[0].length;
			continue;
		}

		// Number literal (including negative)
		const nextChar = input[i + 1];
		if ((char >= '0' && char <= '9') || (char === '-' && nextChar !== undefined && nextChar >= '0' && nextChar <= '9')) {
			let num = '';
			if (char === '-') {
				num += '-';
				i++;
			}
			while (i < input.length) {
				const c = input[i];
				if (!c || !((c >= '0' && c <= '9') || c === '.')) {
					break;
				}
				num += c;
				i++;
			}
			tokens.push({type: 'number', value: num});
			continue;
		}

		// Identifiers / keywords
		if ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_') {
			let ident = '';
			while (i < input.length) {
				const c = input[i];
				if (!c || !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_')) {
					break;
				}
				ident += c;
				i++;
			}
			if (ident === 'true' || ident === 'false') {
				tokens.push({type: 'boolean', value: ident});
			} else if (ident === 'null') {
				tokens.push({type: 'null', value: 'null'});
			} else {
				tokens.push({type: 'identifier', value: ident});
			}
			continue;
		}

		throw new Error(`Unexpected character '${char}' at position ${i}`);
	}

	return tokens;
}
