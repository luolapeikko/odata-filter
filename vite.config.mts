/// <reference types="vitest" />

import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		reporters: ['verbose', 'github-actions'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			reporter: ['text', 'lcov'],
		},
		include: ['./**/*.test.ts'],
		exclude: ['dist', 'node_modules'],
	},
});
