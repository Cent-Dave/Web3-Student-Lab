'use client';

import { useState, useEffect, useMemo } from 'react';
import { RoadmapView } from '@/components/roadmap';
import { coursesAPI } from '@/lib/api';
import type { Course } from '@/lib/api';
import { Skeleton } from '@/components/common/Skeleton';
import { Map, MapPin } from 'lucide-react';

export default function RoadmapPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadCourses() {
      try {
        const data = await coursesAPI.getAll();
        if (!mounted) return;
        setCourses(data);
        if (data.length > 0) {
          setSelectedCourseId(data[0]!.id);
        }
      } catch (err) {
        if (!mounted) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load courses'
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadCourses();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  return (
    <div className="relative min-h-[calc(100vh-80px)] bg-black overflow-hidden font-mono selection:bg-red-500/30 pb-24">
      {/* Abstract Background Glows */}
      <div className="absolute top-[10%] left-[10%] w-[30%] h-[30%] rounded-full bg-[radial-gradient(circle,rgba(220,38,38,0.1),transparent_70%)] blur-[100px] pointer-events-none" />
      
      <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] font-black tracking-widest uppercase shadow-[0_0_20px_rgba(220,38,38,0.2)] mb-6">
            <Map className="w-3.5 h-3.5" />
            <span>Learning Trajectory</span>
          </div>
          <h1 className="mb-4 text-5xl sm:text-7xl font-black tracking-tighter text-white uppercase leading-[1.05]">
            INTERACTIVE <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">ROADMAP</span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-gray-400 font-light border-l-2 border-red-500/50 pl-4">
            Visualize your learning journey through structured levels. Track
            completed modules, see what&apos;s available next, and navigate your
            curriculum path.
          </p>
        </div>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-14 w-full max-w-xs rounded-2xl bg-white/5 border border-white/10" />
            <div className="flex min-h-[500px] items-center justify-center rounded-[2rem] border border-white/5 bg-zinc-950/60 backdrop-blur-md">
              <div className="flex flex-col items-center gap-6">
                <Skeleton className="h-10 w-64 bg-white/5 rounded-xl" />
                <Skeleton className="h-4 w-48 bg-white/5" />
                <Skeleton className="h-64 w-[30rem] max-w-[90vw] rounded-[2rem] bg-white/5" />
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 rounded-[2rem] border border-red-500/30 bg-red-500/10 p-12 backdrop-blur-md shadow-[0_0_30px_rgba(220,38,38,0.15)]">
            <p className="text-lg font-black uppercase tracking-widest text-red-500">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-2xl bg-red-600 px-8 py-4 text-xs font-black tracking-[0.2em] text-white uppercase transition-all hover:bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:scale-105"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <>
            <div className="mb-10 bg-zinc-950/60 border border-white/5 p-6 rounded-[2rem] backdrop-blur-md inline-block">
              <label
                htmlFor="course-select"
                className="mb-3 block text-[10px] font-black tracking-[0.2em] text-red-500 uppercase flex items-center gap-2"
              >
                <MapPin className="w-3.5 h-3.5" />
                Select Learning Path
              </label>
              <div className="relative">
                <select
                  id="course-select"
                  value={selectedCourseId ?? ''}
                  onChange={(e) => setSelectedCourseId(e.target.value || null)}
                  className="w-full sm:w-80 appearance-none rounded-2xl border border-white/10 bg-black px-6 py-4 text-sm font-bold text-white transition-all focus:border-red-500/50 focus:outline-none focus:ring-4 focus:ring-red-500/10 cursor-pointer shadow-inner"
                  aria-label="Select a course to view its roadmap"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-6 text-gray-500">
                  <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] overflow-hidden border border-white/5 bg-zinc-950/40 backdrop-blur-md shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
              <RoadmapView course={selectedCourse} key={selectedCourseId} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
