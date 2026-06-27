import { useCallback, useState } from 'react';
import { generatorAPI, type ProjectIdea } from '@/lib/api';
import {
  DEFAULT_FILTERS,
  buildGeneratorParams,
  generateLocalIdea,
  validateFilters,
  type IdeaFilters,
} from '@/lib/idea-generator/ideaGenerator';

/**
 * useIdeaGenerator — orchestrates idea generation.
 *
 * Integrates with the existing API infrastructure via {@link generatorAPI}
 * (server-side OpenAI). Layered fallbacks satisfy the "proper error handling and
 * fallbacks" requirement:
 *   1. Validate filters locally — never spend an AI call on bad input.
 *   2. Call the AI endpoint with the mapped parameters.
 *   3. On any failure, deterministically synthesise an idea from domain
 *      templates so the user always gets a relevant result (`isFallback`).
 */
export interface UseIdeaGeneratorResult {
  idea: ProjectIdea | null;
  isGenerating: boolean;
  error: string | null;
  /** True when the displayed idea came from the local template fallback. */
  isFallback: boolean;
  /** Validation errors for the supplied filters (empty when valid). */
  generate: (filters: IdeaFilters) => Promise<void>;
}

export function useIdeaGenerator(): UseIdeaGeneratorResult {
  const [idea, setIdea] = useState<ProjectIdea | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  const generate = useCallback(async (filters: IdeaFilters = DEFAULT_FILTERS) => {
    const validation = validateFilters(filters);
    if (!validation.valid) {
      setError(validation.errors.join(' '));
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const result = await generatorAPI.generateIdea(buildGeneratorParams(filters));
      setIdea(result);
      setIsFallback(false);
    } catch {
      // Graceful degradation: synthesise locally from domain templates.
      setIdea(generateLocalIdea(filters));
      setIsFallback(true);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { idea, isGenerating, error, isFallback, generate };
}
