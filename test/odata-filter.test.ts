import {describe, expect, it} from 'vitest';
import {buildODataFilter} from '../src/index.js';

interface Person {
	name: string;
	age: number;
	active: boolean;
	city: string | null;
	address?: {city: string; zip: string};
}

describe('buildODataFilter', () => {
	describe('comparison operators', () => {
		it('should handle eq with string', () => {
			const filter = buildODataFilter<Person>("name eq 'John'");
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
			expect(filter({name: 'Jane', age: 25, active: true, city: 'LA'})).toBe(false);
		});

		it('should handle eq with number', () => {
			const filter = buildODataFilter<Person>('age eq 30');
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
			expect(filter({name: 'John', age: 25, active: true, city: 'NYC'})).toBe(false);
		});

		it('should handle eq with boolean', () => {
			const filter = buildODataFilter<Person>('active eq true');
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
			expect(filter({name: 'John', age: 30, active: false, city: 'NYC'})).toBe(false);
		});

		it('should handle eq with unquoted datetime literal', () => {
			const date = new Date('2025-01-01T00:00:00Z');
			const filter = buildODataFilter<{createdAt: Date}>(`createdAt eq ${date.toISOString()}`);
			expect(filter({createdAt: date})).toBe(true);
			expect(filter({createdAt: new Date()})).toBe(false);
		});

		it('should handle datetime ordering (gt/lt) with Date property', () => {
			const pivot = new Date('2025-06-01T00:00:00Z');
			const filterGt = buildODataFilter<{createdAt: Date}>(`createdAt gt ${pivot.toISOString()}`);
			expect(filterGt({createdAt: new Date('2025-07-01T00:00:00Z')})).toBe(true);
			expect(filterGt({createdAt: new Date('2025-05-01T00:00:00Z')})).toBe(false);

			const filterLt = buildODataFilter<{createdAt: Date}>(`createdAt lt ${pivot.toISOString()}`);
			expect(filterLt({createdAt: new Date('2025-05-01T00:00:00Z')})).toBe(true);
			expect(filterLt({createdAt: new Date('2025-07-01T00:00:00Z')})).toBe(false);
		});

		it('should handle datetime eq when property is an ISO string', () => {
			const filter = buildODataFilter<{createdAt: string}>('createdAt eq 2025-01-01T00:00:00Z');
			expect(filter({createdAt: '2025-01-01T00:00:00Z'})).toBe(true);
			expect(filter({createdAt: '2025-06-01T00:00:00Z'})).toBe(false);
		});

		it('should handle eq with null', () => {
			const filter = buildODataFilter<Person>('city eq null');
			expect(filter({name: 'John', age: 30, active: true, city: null})).toBe(true);
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(false);
		});

		it('should handle ne', () => {
			const filter = buildODataFilter<Person>("name ne 'John'");
			expect(filter({name: 'Jane', age: 25, active: true, city: 'LA'})).toBe(true);
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(false);
		});

		it('should handle gt', () => {
			const filter = buildODataFilter<Person>('age gt 25');
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
			expect(filter({name: 'Jane', age: 25, active: true, city: 'LA'})).toBe(false);
		});

		it('should handle ge', () => {
			const filter = buildODataFilter<Person>('age ge 25');
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
			expect(filter({name: 'Jane', age: 25, active: true, city: 'LA'})).toBe(true);
			expect(filter({name: 'Bob', age: 20, active: true, city: 'LA'})).toBe(false);
		});

		it('should handle lt', () => {
			const filter = buildODataFilter<Person>('age lt 30');
			expect(filter({name: 'Jane', age: 25, active: true, city: 'LA'})).toBe(true);
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(false);
		});

		it('should handle le', () => {
			const filter = buildODataFilter<Person>('age le 30');
			expect(filter({name: 'Jane', age: 25, active: true, city: 'LA'})).toBe(true);
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
			expect(filter({name: 'Bob', age: 35, active: true, city: 'LA'})).toBe(false);
		});
	});

	describe('logical operators', () => {
		it('should handle and', () => {
			const filter = buildODataFilter<Person>("name eq 'John' and age gt 25");
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
			expect(filter({name: 'John', age: 20, active: true, city: 'NYC'})).toBe(false);
			expect(filter({name: 'Jane', age: 30, active: true, city: 'LA'})).toBe(false);
		});

		it('should handle or', () => {
			const filter = buildODataFilter<Person>("name eq 'John' or name eq 'Jane'");
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
			expect(filter({name: 'Jane', age: 25, active: true, city: 'LA'})).toBe(true);
			expect(filter({name: 'Bob', age: 35, active: true, city: 'LA'})).toBe(false);
		});

		it('should handle not', () => {
			const filter = buildODataFilter<Person>("not name eq 'John'");
			expect(filter({name: 'Jane', age: 25, active: true, city: 'LA'})).toBe(true);
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(false);
		});

		it('should handle complex logical combinations', () => {
			const filter = buildODataFilter<Person>("(name eq 'John' or name eq 'Jane') and age gt 20");
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
			expect(filter({name: 'Jane', age: 25, active: true, city: 'LA'})).toBe(true);
			expect(filter({name: 'John', age: 15, active: true, city: 'NYC'})).toBe(false);
			expect(filter({name: 'Bob', age: 30, active: true, city: 'LA'})).toBe(false);
		});
	});

	describe('nested properties', () => {
		it('should handle property paths with /', () => {
			const filter = buildODataFilter<Person>("address/city eq 'Seattle'");
			expect(
				filter({
					name: 'John',
					age: 30,
					active: true,
					city: 'NYC',
					address: {city: 'Seattle', zip: '98101'},
				}),
			).toBe(true);
			expect(
				filter({
					name: 'Jane',
					age: 25,
					active: true,
					city: 'LA',
					address: {city: 'Portland', zip: '97201'},
				}),
			).toBe(false);
		});
	});

	describe('array lambda operations', () => {
		it('should handle any on array properties', () => {
			const filter = buildODataFilter<{tags: string[]}>("tags/any(t: t eq 'urgent')");
			expect(filter({tags: ['urgent', 'todo']})).toBe(true);
			expect(filter({tags: ['todo', 'backlog']})).toBe(false);
			expect(filter({tags: []})).toBe(false);
		});

		it('should handle all on array properties', () => {
			const filter = buildODataFilter<{tags: string[]}>("tags/all(t: t ne 'deprecated')");
			expect(filter({tags: ['urgent', 'todo']})).toBe(true);
			expect(filter({tags: ['urgent', 'deprecated']})).toBe(false);
			expect(filter({tags: []})).toBe(true);
		});
	});

	describe('string functions', () => {
		it('should handle contains', () => {
			const filter = buildODataFilter<Person>("contains(name, 'oh')");
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
			expect(filter({name: 'Jane', age: 25, active: true, city: 'LA'})).toBe(false);
		});

		it('should handle startswith', () => {
			const filter = buildODataFilter<Person>("startswith(name, 'Jo')");
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
			expect(filter({name: 'Jane', age: 25, active: true, city: 'LA'})).toBe(false);
		});

		it('should handle endswith', () => {
			const filter = buildODataFilter<Person>("endswith(name, 'ne')");
			expect(filter({name: 'Jane', age: 25, active: true, city: 'LA'})).toBe(true);
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(false);
		});

		it('should handle tolower', () => {
			const filter = buildODataFilter<Person>("tolower(name) eq 'john'");
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
			expect(filter({name: 'JOHN', age: 30, active: true, city: 'NYC'})).toBe(true);
		});

		it('should handle toupper', () => {
			const filter = buildODataFilter<Person>("toupper(name) eq 'JOHN'");
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
		});

		it('should handle trim', () => {
			const filter = buildODataFilter<{value: string}>("trim(value) eq 'hello'");
			expect(filter({value: '  hello  '})).toBe(true);
			expect(filter({value: 'hello'})).toBe(true);
		});

		it('should handle length', () => {
			const filter = buildODataFilter<Person>('length(name) eq 4');
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
			expect(filter({name: 'Jane', age: 25, active: true, city: 'LA'})).toBe(true);
			expect(filter({name: 'Bob', age: 35, active: true, city: 'LA'})).toBe(false);
		});

		it('should handle contains with function in comparison', () => {
			const filter = buildODataFilter<Person>("contains(name, 'oh') eq true");
			expect(filter({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
			expect(filter({name: 'Jane', age: 25, active: true, city: 'LA'})).toBe(false);
		});
	});

	describe('parentheses', () => {
		it('should respect operator precedence with parentheses', () => {
			// Without parentheses: 'and' binds tighter than 'or'
			const filter1 = buildODataFilter<Person>("name eq 'Bob' or name eq 'John' and age gt 25");
			// Equivalent to: name eq 'Bob' or (name eq 'John' and age gt 25)
			expect(filter1({name: 'Bob', age: 20, active: true, city: 'LA'})).toBe(true);
			expect(filter1({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
			expect(filter1({name: 'John', age: 20, active: true, city: 'NYC'})).toBe(false);

			// With parentheses: override precedence
			const filter2 = buildODataFilter<Person>("(name eq 'Bob' or name eq 'John') and age gt 25");
			expect(filter2({name: 'Bob', age: 20, active: true, city: 'LA'})).toBe(false);
			expect(filter2({name: 'John', age: 30, active: true, city: 'NYC'})).toBe(true);
		});

		it('should handle nested parenthesized groups with and', () => {
			interface User {
				FirstName: string;
				LastName: string;
				UserName: string;
			}
			const filter = buildODataFilter<User>("(FirstName ne 'Mary' and LastName ne 'White') and UserName ne 'marywhite'");
			// All conditions met
			expect(filter({FirstName: 'John', LastName: 'Doe', UserName: 'johndoe'})).toBe(true);
			// FirstName is Mary → inner group fails
			expect(filter({FirstName: 'Mary', LastName: 'Doe', UserName: 'johndoe'})).toBe(false);
			// LastName is White → inner group fails
			expect(filter({FirstName: 'John', LastName: 'White', UserName: 'johndoe'})).toBe(false);
			// UserName is marywhite → outer condition fails
			expect(filter({FirstName: 'John', LastName: 'Doe', UserName: 'marywhite'})).toBe(false);
			// All conditions fail
			expect(filter({FirstName: 'Mary', LastName: 'White', UserName: 'marywhite'})).toBe(false);
		});

		it('should handle deeply nested parentheses', () => {
			interface User {
				a: number;
				b: number;
				c: number;
				d: number;
			}
			const filter = buildODataFilter<User>('((a eq 1 and b eq 2) or (c eq 3 and d eq 4))');
			expect(filter({a: 1, b: 2, c: 0, d: 0})).toBe(true);
			expect(filter({a: 0, b: 0, c: 3, d: 4})).toBe(true);
			expect(filter({a: 1, b: 0, c: 3, d: 0})).toBe(false);
		});
	});

	describe('edge cases', () => {
		it('shuold return false if property is not matching to data', () => {
			const filter = buildODataFilter<any>("name eq 'John'");
			expect(filter({age: 30})).toBe(false);
      expect(filter({name: null})).toBe(false);
      expect(filter({})).toBe(false);
		});
		it('should throw on malformed filter syntax', () => {
			expect(() => buildODataFilter('name eq John'), 'missing quotes around string literal').toThrow();
			expect(() => buildODataFilter("name = 'John'"), 'unsupported operator').toThrow();
			expect(() => buildODataFilter("contains name 'John'"), 'invalid function call syntax').toThrow();
			expect(() => buildODataFilter('(age gt 20'), 'missing closing parenthesis').toThrow();
			expect(() => buildODataFilter("and or name eq 'John'"), 'invalid logical token sequence').toThrow();
		});

		it('should handle negative numbers', () => {
			const filter = buildODataFilter<{temp: number}>('temp gt -10');
			expect(filter({temp: 5})).toBe(true);
			expect(filter({temp: -15})).toBe(false);
		});

		it('should handle decimal numbers', () => {
			const filter = buildODataFilter<{price: number}>('price lt 9.99');
			expect(filter({price: 5.5})).toBe(true);
			expect(filter({price: 10.0})).toBe(false);
		});

		it('should handle escaped single quotes in strings', () => {
			const filter = buildODataFilter<{name: string}>("name eq 'O''Brien'");
			expect(filter({name: "O'Brien"})).toBe(true);
		});

		it('should throw on invalid filter', () => {
			expect(() => buildODataFilter('invalid!!!')).toThrow();
		});

		it('should coerce objects with custom toString (e.g. ObjectId)', () => {
			class ObjectId {
				private id: string;
				public constructor(id: string) {
					this.id = id;
				}
				public toString() {
					return this.id;
				}
			}

			// eq: ObjectId property vs quoted string literal
			const filterId = buildODataFilter<{_id: ObjectId}>("_id eq '507f191e810c19729de860ea'");
			expect(filterId({_id: new ObjectId('507f191e810c19729de860ea')})).toBe(true);
			expect(filterId({_id: new ObjectId('000000000000000000000000')})).toBe(false);

			// ne: different id
			const filterNe = buildODataFilter<{_id: ObjectId}>("_id ne '000000000000000000000000'");
			expect(filterNe({_id: new ObjectId('507f191e810c19729de860ea')})).toBe(true);
			expect(filterNe({_id: new ObjectId('000000000000000000000000')})).toBe(false);

			// Plain objects without custom toString are NOT coerced
			const filterPlain = buildODataFilter<{obj: object}>("obj eq 'test'");
			expect(filterPlain({obj: {toString: Object.prototype.toString}})).toBe(false);
		});

		it('should throw on unsupported function', () => {
			const filter = buildODataFilter<{name: string}>("fakefn(name) eq 'test'");
			expect(() => filter({name: 'test'})).toThrow("Unsupported function 'fakefn'");
		});
	});
});
