'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  Flame,
  GraduationCap,
  PlayCircle,
  Target,
  Trophy,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Certificate,
  Course,
  Enrollment,
  certificatesAPI,
  coursesAPI,
  enrollmentsAPI,
} from '@/lib/api';
import { getLearningJourney, LearningLevel, LearningTask } from '@/lib/learning-journey';
import { ErrorBoundary, ErrorFallback } from '@/components/ui';
import { DashboardSkeleton } from '@/components/ui';

type ProgressState = Record<string, boolean>;

const STORAGE_KEY = 'learning_dashboard_progress';

export default function DashboardPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<ProgressState>({});

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setCompletedTasks(JSON.parse(raw) as ProgressState);
      }
    } catch {
      setCompletedTasks({});
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(completedTasks));
  }, [completedTasks]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [courseData, certificateData, enrollmentData] = await Promise.all([
        coursesAPI.getAll(),
        user ? certificatesAPI.getByStudentId(user.id) : Promise.resolve([]),
        user ? enrollmentsAPI.getByStudentId(user.id) : Promise.resolve([]),
      ]);

      setCourses(courseData);
      setCertificates(certificateData);
      setEnrollments(enrollmentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      setCourses([]);
      setCertificates([]);
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!mounted) return;
      await loadData();
    }

    load();
    return () => {
      mounted = false;
    };
  }, [loadData]);

  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);

  const enrolledCourses = useMemo(
    () =>
      enrollments
        .map((enrollment) => ({
          enrollment,
          course: enrollment.course || courseMap.get(enrollment.courseId),
        }))
        .filter((entry): entry is { enrollment: Enrollment; course: Course } =>
          Boolean(entry.course)
        ),
    [enrollments, courseMap]
  );

  useEffect(() => {
    if (enrolledCourses.length === 0) {
      setActiveCourseId(null);
      return;
    }

    setActiveCourseId((current) =>
      current && enrolledCourses.some((entry) => entry.course.id === current)
        ? current
        : enrolledCourses[0]!.course.id
    );
  }, [enrolledCourses]);

  const activeCourse =
    enrolledCourses.find((entry) => entry.course.id === activeCourseId)?.course || null;
  const activeJourney = activeCourse ? getLearningJourney(activeCourse) : null;

  const taskCompletion = useMemo(() => {
    if (!activeJourney) {
      return { total: 0, done: 0 };
    }

    const allTasks = activeJourney.levels.flatMap((level) => level.tasks);
    const done = allTasks.filter((task) => completedTasks[task.id]).length;
    return { total: allTasks.length, done };
  }, [activeJourney, completedTasks]);

  const activeLevelIndex = useMemo(() => {
    if (!activeJourney) {
      return 0;
    }

    const firstIncomplete = activeJourney.levels.findIndex((level) =>
      level.tasks.some((task) => !completedTasks[task.id])
    );

    return firstIncomplete === -1 ? activeJourney.levels.length - 1 : firstIncomplete;
  }, [activeJourney, completedTasks]);

  const activeLevel = activeJourney?.levels[activeLevelIndex] || null;
  const dailyTasks = activeLevel?.tasks.slice(0, 3) || [];
  const completedCount = taskCompletion.done;
  const totalCount = taskCompletion.total;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const currentLevelNumber = activeLevelIndex + 1;

  const quickStats = [
    { label: 'Enrolled tracks', value: enrolledCourses.length, icon: BookOpen },
    { label: 'Finished tasks', value: completedCount, icon: CheckCircle2 },
    { label: 'Issued credentials', value: certificates.length, icon: GraduationCap },
  ];

  const toggleTask = (taskId: string) => {
    setCompletedTasks((current) => ({
      ...current,
      [taskId]: !current[taskId],
    }));
  };

  return (
    <ErrorBoundary>
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 lg:px-8" aria-busy={loading}>
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <span className="eyebrow">Student learning dashboard</span>
          <h1 className="text-4xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-5xl">
            Learn in levels, show up daily, and keep moving through your track.
          </h1>
          <p className="max-w-2xl text-base leading-8 text-[var(--muted)]">
            This is your study base after enrollment: read the content, watch guided lessons,
            complete today&apos;s tasks, and work upward level by level.
          </p>
          <div>
            <Link
              href="/admin/content"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/4 px-4 py-3 text-sm font-medium text-[var(--text-strong)]"
            >
              Open content admin
            </Link>
          </div>
        </div>

        <div className="surface-card overflow-hidden p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--brand-strong)] uppercase">
                Daily momentum
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--text-strong)]">
                {activeJourney?.levelLabel || 'No active track yet'}
              </h2>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                {activeJourney?.streakMessage ||
                  'Enroll in a course to unlock daily tasks, reading flow, and level progression.'}
              </p>
            </div>
            <div className="rounded-2xl bg-[rgba(240,100,45,0.14)] p-3 text-[var(--brand-strong)]">
              <Flame className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {quickStats.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-white/8 bg-white/4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/7 text-[var(--brand-strong)]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="mt-4 text-2xl font-semibold text-[var(--text-strong)]">
                    {loading ? '...' : item.value}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
    </ErrorBoundary>
  );
}

function TaskRow({
  task,
  checked,
  onToggle,
}: {
  task: LearningTask;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-start gap-4 rounded-2xl border px-4 py-4 text-left transition ${
        checked
          ? 'border-emerald-500/30 bg-emerald-500/10'
          : 'border-white/8 bg-white/4 hover:border-[rgba(240,100,45,0.25)]'
      }`}
    >
      <div
        className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border ${
          checked
            ? 'border-emerald-400 bg-emerald-400 text-black'
            : 'border-white/15 text-transparent'
        }`}
      >
        <CheckCircle2 className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[var(--text-strong)]">{task.title}</p>
          <span className="text-xs text-[var(--muted)]">{task.duration}</span>
        </div>
        <p className="mt-2 text-xs tracking-[0.18em] text-[var(--muted)] uppercase">{task.type}</p>
      </div>
    </button>
  );
}

function LevelCard({
  level,
  levelNumber,
  isCurrent,
  completedTasks,
}: {
  level: LearningLevel;
  levelNumber: number;
  isCurrent: boolean;
  completedTasks: ProgressState;
}) {
  const completed = level.tasks.filter((task) => completedTasks[task.id]).length;
  const total = level.tasks.length;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        isCurrent
          ? 'border-[rgba(240,100,45,0.35)] bg-[rgba(240,100,45,0.08)]'
          : 'border-white/8 bg-white/4'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-[var(--brand-strong)] uppercase">
            Level {levelNumber}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">{level.title}</h3>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{level.summary}</p>
        </div>
        {isCurrent && (
          <span className="rounded-full bg-[rgba(240,100,45,0.16)] px-3 py-1 text-xs font-medium text-[var(--text-strong)]">
            Current
          </span>
        )}
      </div>
      <p className="mt-4 text-xs text-[var(--muted)]">
        {completed}/{total} tasks finished
      </p>
    </div>
  );
}

function MilestoneCard({ label, copy }: { label: string; copy: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
      <p className="text-sm font-semibold text-[var(--text-strong)]">{label}</p>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{copy}</p>
    </div>
  );
}
