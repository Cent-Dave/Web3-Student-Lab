'use client';

import { useState } from 'react';
import { useIdeaGenerator } from '@/hooks/useIdeaGenerator';
import {
  DEFAULT_FILTERS,
  DIFFICULTY_LEVELS,
  DOMAINS,
  TECH_STACK_OPTIONS,
  toggleTech,
  type Difficulty,
  type Domain,
  type IdeaFilters,
} from '@/lib/idea-generator/ideaGenerator';

/**
 * IdeaGeneratorPanel — the interactive Hackathon Idea Generator.
 *
 * Captures filters (difficulty, domain, technology stack), then asks
 * {@link useIdeaGenerator} to produce an idea via the AI backend (with a local
 * template fallback). Purely presentational beyond local filter state — all
 * generation logic lives in the hook/lib.
 *
 * Accessibility (WCAG 2.1):
 *  - Every control has an associated <label> / fieldset+legend.
 *  - The tech-stack multi-select uses checkboxes inside a labelled group, with
 *    aria-pressed-free semantics (native checkbox state is announced).
 *  - Errors use role="alert"; the generating state uses aria-busy + role=status.
 */
export default function IdeaGeneratorPanel() {
  const [filters, setFilters] = useState<IdeaFilters>(DEFAULT_FILTERS);
  const { idea, isGenerating, error, isFallback, generate } = useIdeaGenerator();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generate(filters);
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Filters */}
      <form
        onSubmit={handleSubmit}
        aria-label="Idea generator filters"
        className="bg-bg-secondary border-border-theme space-y-6 rounded-2xl border p-6"
      >
        <div>
          <label
            htmlFor="difficulty"
            className="text-text-secondary mb-2 block text-xs font-bold tracking-widest uppercase"
          >
            Difficulty Level
          </label>
          <select
            id="difficulty"
            value={filters.difficulty}
            onChange={(e) =>
              setFilters((f) => ({ ...f, difficulty: e.target.value as Difficulty }))
            }
            className="bg-background border-border-theme text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-red-500"
          >
            {DIFFICULTY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="domain"
            className="text-text-secondary mb-2 block text-xs font-bold tracking-widest uppercase"
          >
            Domain Template
          </label>
          <select
            id="domain"
            value={filters.domain}
            onChange={(e) => setFilters((f) => ({ ...f, domain: e.target.value as Domain }))}
            className="bg-background border-border-theme text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-red-500"
          >
            {DOMAINS.map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="border-border-theme rounded-lg border p-4">
          <legend className="text-text-secondary px-2 text-xs font-bold tracking-widest uppercase">
            Technology Stack
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {TECH_STACK_OPTIONS.map((tech) => {
              const checked = filters.techStack.includes(tech);
              return (
                <label
                  key={tech}
                  className="text-foreground flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setFilters((f) => ({ ...f, techStack: toggleTech(f.techStack, tech) }))
                    }
                    className="accent-red-600"
                  />
                  {tech}
                </label>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isGenerating}
          className="w-full rounded-xl bg-red-600 py-4 text-xs font-black tracking-[0.3em] text-white uppercase transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-700"
        >
          {isGenerating ? 'Synthesizing…' : 'Generate Idea'}
        </button>
      </form>

      {/* Result */}
      <div
        className="bg-bg-secondary border-border-theme rounded-2xl border p-6"
        aria-live="polite"
      >
        {isGenerating ? (
          <div role="status" aria-busy="true" className="text-text-secondary text-sm">
            Generating a relevant idea…
          </div>
        ) : idea ? (
          <article>
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-sm bg-red-600 px-3 py-1 text-[10px] font-black tracking-widest text-white uppercase">
                {idea.difficulty}
              </span>
              {isFallback && (
                <span
                  className="text-[10px] font-bold tracking-widest text-yellow-500 uppercase"
                  title="AI service unavailable — generated from local templates"
                >
                  Offline template
                </span>
              )}
            </div>
            <h2 className="text-foreground mb-3 text-2xl font-black tracking-tight uppercase">
              {idea.title}
            </h2>
            <p className="text-text-secondary mb-6 text-sm leading-relaxed">{idea.description}</p>

            <h3 className="text-text-secondary mb-2 text-xs font-bold tracking-widest uppercase">
              Recommended Tech
            </h3>
            <ul className="mb-6 flex flex-wrap gap-2" aria-label="Recommended technologies">
              {idea.recommendedTech.map((tech) => (
                <li
                  key={tech}
                  className="border-border-theme text-foreground rounded-full border px-3 py-1 text-xs"
                >
                  {tech}
                </li>
              ))}
            </ul>

            <h3 className="text-text-secondary mb-2 text-xs font-bold tracking-widest uppercase">
              Key Features
            </h3>
            <ul className="text-text-secondary list-inside list-disc space-y-1 text-sm">
              {idea.keyFeatures.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </article>
        ) : (
          <p className="text-text-secondary text-sm">
            Choose your filters and generate a hackathon idea to get started.
          </p>
        )}
      </div>
    </div>
  );
}
