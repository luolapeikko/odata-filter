import type { AstNode, ComparisonOperator, Token, TokenType } from "./tokenTypes";

const COMPARISON_OPS = new Set<string>(['eq', 'ne', 'gt', 'ge', 'lt', 'le']);
const LOGICAL_OPS = new Set<string>(['and', 'or']);

/**
 * Parser class that takes an array of tokens and produces an Abstract Syntax Tree (AST) representing the OData filter expression.
 */
export class Parser {
    private pos = 0;
    private tokens: Token[];

    public constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    public parse(): AstNode {
        const node = this.parseOr();
        if (this.pos < this.tokens.length) {
            throw new Error(`Unexpected token '${this.tokens[this.pos]?.value}' at position ${this.pos}`);
        }
        return node;
    }

    private peek(): Token | undefined {
        return this.tokens[this.pos];
    }

    private advance(): Token {
        const token = this.tokens[this.pos++];
        if (!token) {
            throw new Error('Unexpected end of input');
        }
        return token;
    }

    private expect(type: TokenType, value?: string): Token {
        const token = this.peek();
        if (!token || token.type !== type || (value !== undefined && token.value !== value)) {
            throw new Error(`Expected ${value ?? type} but got ${token ? `'${token.value}'` : 'end of input'}`);
        }
        return this.advance();
    }

    private isReservedKeyword(value: string): boolean {
        return COMPARISON_OPS.has(value) || LOGICAL_OPS.has(value) || value === 'not';
    }

    // OrExpression = AndExpression ('or' AndExpression)*
    private parseOr(): AstNode {
        let left = this.parseAnd();
        while (this.peek()?.type === 'identifier' && this.peek()?.value === 'or') {
            this.advance(); // consume 'or'
            const right = this.parseAnd();
            left = {kind: 'logical', operator: 'or', left, right};
        }
        return left;
    }

    // AndExpression = NotExpression ('and' NotExpression)*
    private parseAnd(): AstNode {
        let left = this.parseNot();
        while (this.peek()?.type === 'identifier' && this.peek()?.value === 'and') {
            this.advance(); // consume 'and'
            const right = this.parseNot();
            left = {kind: 'logical', operator: 'and', left, right};
        }
        return left;
    }

    // NotExpression = 'not' NotExpression | Comparison
    private parseNot(): AstNode {
        if (this.peek()?.type === 'identifier' && this.peek()?.value === 'not') {
            this.advance(); // consume 'not'
            const operand = this.parseNot();
            return {kind: 'not', operand};
        }
        return this.parseComparison();
    }

    // Comparison = Primary (CompOp ComparisonValue)?
    private parseComparison(): AstNode {
        const left = this.parsePrimary();
        const token = this.peek();
        if (token?.type === 'identifier' && COMPARISON_OPS.has(token.value)) {
            const operator = this.advance().value as ComparisonOperator;
            const right = this.parseComparisonValue();
            return {kind: 'comparison', operator, left, right};
        }
        return left;
    }

    private parseComparisonValue(): AstNode {
        const token = this.peek();
        if (!token) {
            throw new Error('Unexpected end of input');
        }

        if (token.type === 'string' || token.type === 'number' || token.type === 'datetime' || token.type === 'boolean' || token.type === 'null') {
            return this.parsePrimary();
        }

        if (token.type === 'identifier') {
            if (this.tokens[this.pos + 1]?.type === 'lparen' && !this.isReservedKeyword(token.value)) {
                return this.parseFunctionCall();
            }
            throw new Error(`Invalid comparison value '${token.value}'. String literals must be quoted.`);
        }

        if (token.type === 'lparen') {
            return this.parsePrimary();
        }

        throw new Error(`Unexpected token '${token.value}' in comparison value`);
    }

    // Primary = Literal | FunctionCall | PropertyPath | '(' Expression ')'
    private parsePrimary(): AstNode {
        const token = this.peek();
        if (!token) {
            throw new Error('Unexpected end of input');
        }

        // Parenthesized expression
        if (token.type === 'lparen') {
            this.advance(); // consume '('
            const node = this.parseOr();
            this.expect('rparen');
            return node;
        }

        // String literal
        if (token.type === 'string') {
            this.advance();
            return {kind: 'literal', value: token.value};
        }

        // Number literal
        if (token.type === 'number') {
            this.advance();
            return {kind: 'literal', value: parseFloat(token.value)};
        }

        // Datetime literal (kept as ISO string)
        if (token.type === 'datetime') {
            this.advance();
            return {kind: 'literal', value: token.value};
        }

        // Boolean literal
        if (token.type === 'boolean') {
            this.advance();
            return {kind: 'literal', value: token.value === 'true'};
        }

        // Null literal
        if (token.type === 'null') {
            this.advance();
            return {kind: 'literal', value: null};
        }

        // Identifier: could be function call or property path
        if (token.type === 'identifier') {
            // Check if it's a function call (identifier followed by '(')
            if (this.tokens[this.pos + 1]?.type === 'lparen' && !COMPARISON_OPS.has(token.value) && !LOGICAL_OPS.has(token.value) && token.value !== 'not') {
                return this.parseFunctionCall();
            }
            return this.parsePropertyPathOrLambda();
        }

        throw new Error(`Unexpected token '${token.value}'`);
    }

    // FunctionCall = identifier '(' ArgumentList ')'
    private parseFunctionCall(): AstNode {
        const name = this.advance().value; // function name
        this.expect('lparen');
        const args: AstNode[] = [];
        if (this.peek()?.type !== 'rparen') {
            args.push(this.parseOr());
            while (this.peek()?.type === 'comma') {
                this.advance(); // consume ','
                args.push(this.parseOr());
            }
        }
        this.expect('rparen');
        return {kind: 'functionCall', name, args};
    }

    // PropertyPath = identifier ('/' identifier)*
    private parsePropertyPathOrLambda(): AstNode {
        const first = this.expect('identifier').value;
        if (this.isReservedKeyword(first)) {
            throw new Error(`Unexpected keyword '${first}'`);
        }
        const path: string[] = [first];
        while (this.peek()?.type === 'slash') {
            this.advance(); // consume '/'
            const segment = this.expect('identifier').value;
            if (segment === 'any' || segment === 'all') {
                this.expect('lparen');
                const variable = this.expect('identifier').value;
                this.expect('colon');
                const predicate = this.parseOr();
                this.expect('rparen');
                return {
                    kind: 'lambda',
                    path,
                    operator: segment,
                    variable,
                    predicate,
                };
            }
            if (this.isReservedKeyword(segment)) {
                throw new Error(`Unexpected keyword '${segment}'`);
            }
            path.push(segment);
        }
        return {kind: 'property', path};
    }
}
