import assert from 'node:assert/strict';
import { parseRepoUrl } from '../src/github.mjs';
assert.deepEqual(parseRepoUrl('https://github.com/octocat/Hello-World'), { owner: 'octocat', repo: 'Hello-World' });
assert.deepEqual(parseRepoUrl('https://github.com/octocat/Hello-World.git'), { owner: 'octocat', repo: 'Hello-World' });
assert.throws(() => parseRepoUrl('https://gitlab.com/octocat/Hello-World'));
assert.throws(() => parseRepoUrl('https://github.com/octocat'));
console.log('Chat2git smoke tests passed.');
