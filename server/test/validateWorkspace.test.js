import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkspaceBoards } from '../src/utils/validateWorkspace.js';

const validBoard = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  title: 'Project',
  cards: [],
};

test('accepts a valid workspace', () => {
  assert.equal(validateWorkspaceBoards([validBoard]), null);
});

test('rejects malformed board identifiers', () => {
  assert.match(validateWorkspaceBoards([{ ...validBoard, id: 'not-a-uuid' }]), /UUID/);
});

test('rejects oversized card collections', () => {
  assert.match(validateWorkspaceBoards([{ ...validBoard, cards: Array(501).fill({}) }]), /500-card/);
});

