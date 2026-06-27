import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
      include: [
        'src/lib/keyboard-navigation.ts',
        'src/lib/editor/SorobanAccessibilityAuditor.ts',
        'src/hooks/useKeyboardNavigation.ts',
        'src/hooks/useFocusTrap.ts',
        'src/hooks/useRovingTabindex.ts',
        'src/hooks/useAccessibilityAudit.ts',
        'src/components/ui/SkipLink.tsx',
        'src/components/ui/FocusTrap.tsx',
        'src/components/playground/AccessibilityAuditPanel.tsx',
      ],
    },
  },
});
