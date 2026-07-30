'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  LearningMetrics,
  TimeSpentPoint,
  buildCompletionBreakdown,
  buildMetricCards,
  evaluateAchievements,
} from '@/lib/analytics/performanceMetrics';
import { ChartDataTable, type ColumnDef } from '@/components/analytics/ChartDataTable';
import AchievementBadges from './AchievementBadges';

export interface PerformanceMetricsDashboardProps {
  metrics: LearningMetrics;
  timeSpent: TimeSpentPoint[];
  isLoading?: boolean;
  error?: Error | null;
  /** When true, a banner notes that fallback (mock) data is being shown. */
  isFallback?: boolean;
}

/** Shared Recharts tooltip styling, matching the existing analytics charts. */
const TOOLTIP_STYLE = {
  backgroundColor: '#09090b',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#fff',
};

const BAR_CHART_SUMMARY = 'Bar chart of daily study time in minutes over the recent period.';

const BAR_TABLE_COLUMNS: ColumnDef[] = [
  { key: 'date', label: 'Date' },
  { key: 'minutes', label: 'Minutes' },
];

const PIE_CHART_SUMMARY = 'Pie chart of completed versus remaining courses.';

const PIE_TABLE_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Category' },
  { key: 'value', label: 'Courses' },
];

export default function PerformanceMetricsDashboard({
  metrics,
  timeSpent,
  isLoading = false,
  error = null,
  isFallback = false,
}: PerformanceMetricsDashboardProps) {
  const [showBarTable, setShowBarTable] = useState(false);
  const [showPieTable, setShowPieTable] = useState(false);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="flex min-h-[300px] items-center justify-center"
      >
        <span className="text-text-secondary text-sm font-bold tracking-widest uppercase">
          Loading performance metrics…
        </span>
      </div>
    );
  }

  const cards = buildMetricCards(metrics);
  const completion = buildCompletionBreakdown(metrics);
  const badges = evaluateAchievements(metrics);

  return (
    <div className="space-y-8">
      {/* Fallback / error banner */}
      {(error || isFallback) && (
        <div
          role="alert"
          className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-500"
        >
          Live analytics are unavailable right now — showing sample data so you
          can still explore the dashboard.
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-bg-secondary border-border-theme rounded-2xl border p-6 transition-all hover:border-red-500/50"
          >
            <p className="text-text-secondary mb-2 text-xs font-bold tracking-widest uppercase">
              {card.label}
            </p>
            <p
              className="text-foreground font-mono text-3xl font-black"
              aria-label={`${card.label}: ${card.value}. ${card.hint}`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Time spent bar chart */}
        <div className="bg-bg-secondary border-border-theme rounded-2xl border p-6">
          <h3 className="text-foreground mb-6 flex items-center gap-3 text-lg font-black tracking-widest uppercase">
            <span className="h-3 w-3 rounded-sm bg-red-600" aria-hidden="true"></span>
            Time Spent
          </h3>
          <div role="img" aria-label={BAR_CHART_SUMMARY}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={timeSpent}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="#a1a1aa" style={{ fontSize: '12px' }} />
                <YAxis stroke="#a1a1aa" style={{ fontSize: '12px' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="minutes" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4">
            <button
              onClick={() => setShowBarTable((v) => !v)}
              aria-expanded={showBarTable}
              aria-controls="bar-chart-table"
              className="text-xs font-bold tracking-widest uppercase text-gray-400 hover:text-white transition-colors"
            >
              {showBarTable ? 'Hide data table' : 'Show data table'}
            </button>
          </div>
          {showBarTable && (
            <div className="mt-3">
              <ChartDataTable
                columns={BAR_TABLE_COLUMNS}
                data={timeSpent}
                caption="Daily study time in minutes."
                id="bar-chart-table"
              />
            </div>
          )}
        </div>

        {/* Completion rate pie chart */}
        <div className="bg-bg-secondary border-border-theme rounded-2xl border p-6">
          <h3 className="text-foreground mb-6 flex items-center gap-3 text-lg font-black tracking-widest uppercase">
            <span className="h-3 w-3 rounded-sm bg-red-600" aria-hidden="true"></span>
            Completion Rate
          </h3>
          <div role="img" aria-label={PIE_CHART_SUMMARY}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={completion}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {completion.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4">
            <button
              onClick={() => setShowPieTable((v) => !v)}
              aria-expanded={showPieTable}
              aria-controls="pie-chart-table"
              className="text-xs font-bold tracking-widest uppercase text-gray-400 hover:text-white transition-colors"
            >
              {showPieTable ? 'Hide data table' : 'Show data table'}
            </button>
          </div>
          {showPieTable && (
            <div className="mt-3">
              <ChartDataTable
                columns={PIE_TABLE_COLUMNS}
                data={completion}
                caption="Course completion rate breakdown."
                id="pie-chart-table"
              />
            </div>
          )}
        </div>
      </div>

      {/* Achievement badges */}
      <AchievementBadges badges={badges} />
    </div>
  );
}
