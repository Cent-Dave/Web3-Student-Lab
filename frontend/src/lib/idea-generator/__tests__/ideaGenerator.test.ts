import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FILTERS,
  toggleTech,
  validateFilters,
  buildGeneratorParams,
  generateLocalIdea,
  type IdeaFilters,
} from '../ideaGenerator';

describe('ideaGenerator', () => {
  it('toggles a technology in and out of the stack', () => {
    expect(toggleTech(['React'], 'Rust')).toEqual(['React', 'Rust']);
    expect(toggleTech(['React', 'Rust'], 'React')).toEqual(['Rust']);
  });

  it('validates filters and rejects an empty tech stack', () => {
    expect(validateFilters(DEFAULT_FILTERS).valid).toBe(true);
    const bad = validateFilters({ ...DEFAULT_FILTERS, techStack: [] });
    expect(bad.valid).toBe(false);
    expect(bad.errors.length).toBeGreaterThan(0);
  });

  it('maps filters to backend generator params', () => {
    const params = buildGeneratorParams(DEFAULT_FILTERS);
    expect(params.difficulty).toBe('Intermediate');
    expect(params.theme).toContain('DeFi');
    expect(params.techStack).toEqual(DEFAULT_FILTERS.techStack);
  });

  it('synthesises a deterministic, relevant fallback idea', () => {
    const filters: IdeaFilters = { difficulty: 'Advanced', domain: 'NFT', techStack: ['IPFS'] };
    const a = generateLocalIdea(filters);
    const b = generateLocalIdea(filters);
    expect(a).toEqual(b); // deterministic
    expect(a.difficulty).toBe('Advanced');
    expect(a.recommendedTech).toEqual(['IPFS']);
    expect(a.title.length).toBeGreaterThan(0);
  });
});
