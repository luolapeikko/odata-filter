import type {Token} from './tokenTypes';

const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const whiteSpaceChars = new Set([' ', '\t', '\r', '\n']);

function charTokens(char: string, tokens: Token[]): number {
	switch (char) {
		case '(':
			tokens.push({type: 'lparen', value: '('});
			return 1;
		case ')':
			tokens.push({type: 'rparen', value: ')'});
			return 1;
		case ',':
			tokens.push({type: 'comma', value: ','});
			return 1;
		case '/':
			tokens.push({type: 'slash', value: '/'});
			return 1;
		case ':':
			tokens.push({type: 'colon', value: ':'});
			return 1;
		default:
			return 0;
	}
}

function tokenizeString(input: string, tokens: Token[], index: number): number {
	index++; // skip opening quote
	let str = '';
	while (index < input.length) {
		const c = input[index];
		if (c === "'" && input[index + 1] === "'") {
			str += "'"; // escaped single quote
			index += 2;
		} else if (c === "'") {
			break;
		} else {
			str += c ?? '';
			index++;
		}
	}
	if (index >= input.length) {
		throw new Error('Unterminated string literal');
	}
	index++; // skip closing quote
	tokens.push({type: 'string', value: str});
	return index;
}

function tokenizeDateTime(input: string, tokens: Token[], index: number): number {
	const datetimeCandidate = input.slice(index, index + 35);
	const datetimeMatch = datetimeCandidate.match(ISO_DATETIME_REGEX);
	if (datetimeMatch) {
		tokens.push({type: 'datetime', value: datetimeMatch[0]});
		return datetimeMatch[0].length;
	}
	return 0;
}

function tokenizeNumber(char: string, input: string, tokens: Token[], index: number): number {
	let num = '';
	if (char === '-') {
		num += '-';
		index++;
	}
	while (index < input.length) {
		const c = input[index];
		if (!c || !((c >= '0' && c <= '9') || c === '.')) {
			break;
		}
		num += c;
		index++;
	}
	tokens.push({type: 'number', value: num});
	return index;
}

function tokenizeIdentifier(input: string, tokens: Token[], index: number): number {
	let ident = '';
	while (index < input.length) {
		const c = input[index];
		if (!c || !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_')) {
			break;
		}
		ident += c;
		index++;
	}
	if (ident === 'true' || ident === 'false') {
		tokens.push({type: 'boolean', value: ident});
	} else if (ident === 'null') {
		tokens.push({type: 'null', value: 'null'});
	} else {
		tokens.push({type: 'identifier', value: ident});
	}
	return index;
}

const looseDateTimePattern = /\d{4}-\d{2}-\d{2}T/;

/**
 * Tokenize an OData filter string into an array of tokens.
 * @param input The OData filter string.
 * @returns An array of tokens representing the filter string.
 */
export function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	// Pre-scan once: if no ISO datetime pattern exists in the input we can skip scanning
	const mayContainDatetime = looseDateTimePattern.test(input);

	while (i < input.length) {
		const char = input[i];
		// Skip whitespace
		if (!char || whiteSpaceChars.has(char)) {
			i++;
			continue;
		}

		// Check for single-character tokens like parentheses, commas, etc.
		const consumed = charTokens(char, tokens);
		if (consumed > 0) {
			i += consumed;
			continue;
		}

		// String literal
		if (char === "'") {
			i = tokenizeString(input, tokens, i);
			continue;
		}

		// DateTime literal in ISO 8601 format
		if (mayContainDatetime) {
			const consumed = tokenizeDateTime(input, tokens, i);
			if (consumed > 0) {
				i += consumed;
				continue;
			}
		}

		// Number literal (including negative)
		const nextChar = input[i + 1];
		if ((char >= '0' && char <= '9') || (char === '-' && nextChar !== undefined && nextChar >= '0' && nextChar <= '9')) {
			i = tokenizeNumber(char, input, tokens, i);
			continue;
		}

		// Identifiers / keywords
		if ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_') {
			i = tokenizeIdentifier(input, tokens, i);
			continue;
		}

		throw new Error(`Unexpected character '${char}' at position ${i}`);
	}

	return tokens;
}
