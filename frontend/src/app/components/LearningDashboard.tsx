"use client";

import { useEffect, useMemo, useState } from "react";
import { allLessons, courses, storageKeys } from "../curriculum-data";
import { CompletionModal, launchCompletionConfetti } from "./CompletionCelebration";
import { ProgressRing } from "./ProgressRing";

const readList = (key: string) => {
  if (typeof window === "undefined") return [] as string[];
  try {
    return JSON.parse(window.localStorage.getItem(key) || "[]") as string[];
  } catch {
    return [];
  }
};

const saveList = (key: string, value: string[]) => {
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
};

export function LearningDashboard() {
  const [courseId, setCourseId] = useState(courses[0].id);
  const [lessonId, setLessonId] = useState(courses[0].lessons[0].id);
  const [completed, setCompleted] = useState<string[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const course = courses.find((item) => item.id === courseId) || courses[0];
  const lesson = course.lessons.find((item) => item.id === lessonId) || course.lessons[0];
  const lessonIndex = course.lessons.findIndex((item) => item.id === lesson.id);
  const lessonKey = `${course.id}:${lesson.id}`;
  const completedSet = useMemo(() => new Set(completed), [completed]);
  const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks]);
  const percent = Math.round((completedSet.size / allLessons.length) * 100);
  const savedLessons = allLessons.filter((item) => bookmarkSet.has(`${item.courseId}:${item.id}`));

  useEffect(() => {
    setCompleted(readList(storageKeys.completed));
    setBookmarks(readList(storageKeys.bookmarks));
  }, []);

  function toggleBookmark() {
    const next = bookmarkSet.has(lessonKey) ? bookmarks.filter((item) => item !== lessonKey) : [...bookmarks, lessonKey];
    setBookmarks(next);
    saveList(storageKeys.bookmarks, next);
  }

  function completeLesson() {
    const next = completedSet.has(lessonKey) ? completed : [...completed, lessonKey];
    setCompleted(next);
    saveList(storageKeys.completed, next);

    const alreadyShown = window.localStorage.getItem(storageKeys.celebrated) === "true";
    if (next.length === allLessons.length && !alreadyShown) {
      window.localStorage.setItem(storageKeys.celebrated, "true");
      launchCompletionConfetti();
      setModalOpen(true);
    }
  }

  function move(direction: -1 | 1) {
    const nextIndex = lessonIndex + direction;
    if (nextIndex >= 0 && nextIndex < course.lessons.length) setLessonId(course.lessons[nextIndex].id);
  }

  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-white">
      <section className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <header className="rounded-3xl border border-white/10 bg-white/10 p-8">
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-300">Web3 Student Lab</p>
          <h1 className="mt-3 text-4xl font-black">Curriculum Progress Dashboard</h1>
          <p className="mt-3 max-w-2xl text-slate-300">Track lessons, save study routes, and celebrate full course completion.</p>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400 transition-all duration-700" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 font-bold">{percent}% complete</p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {courses.map((item) => {
            const done = item.lessons.filter((entry) => completedSet.has(`${item.id}:${entry.id}`)).length;
            return (
              <button key={item.id} onClick={() => { setCourseId(item.id); setLessonId(item.lessons[0].id); }} className={`rounded-3xl border p-5 text-left ${item.id === course.id ? "border-emerald-300 bg-white/15" : "border-white/10 bg-white/5"}`}>
                <ProgressRing percentage={(done / item.lessons.length) * 100} accent={item.accent} />
                <h2 className="mt-4 text-2xl font-black">{item.title}</h2>
                <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                <p className="mt-3 text-sm font-bold text-emerald-200">{done}/{item.lessons.length} lessons</p>
              </button>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-3xl bg-white p-6 text-slate-950 lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-emerald-600">{course.title}</p>
                <h2 className="mt-2 text-3xl font-black">{lesson.title}</h2>
                <p className="mt-2 text-slate-600">{lesson.route}</p>
              </div>
              <button onClick={toggleBookmark} className="rounded-full bg-amber-100 px-4 py-2 font-bold text-amber-700">
                {bookmarkSet.has(lessonKey) ? "Starred" : "Star lesson"}
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {course.lessons.map((item, index) => {
                const key = `${course.id}:${item.id}`;
                return (
                  <button key={item.id} onClick={() => setLessonId(item.id)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50">
                    <span><strong>0{index + 1}</strong> {item.title}</span>
                    <span className="text-sm text-slate-500">{completedSet.has(key) ? "Completed" : item.duration}</span>
                  </button>
                );
              })}
            </div>

            <button onClick={completeLesson} className="mt-6 w-full rounded-2xl bg-emerald-500 px-5 py-4 font-black text-white">
              {completedSet.has(lessonKey) ? "Lesson completed" : "Mark lesson complete"}
            </button>
          </article>

          <aside className="rounded-3xl border border-white/10 bg-white/10 p-6">
            <h2 className="text-2xl font-black">Study base</h2>
            <p className="mt-1 text-sm text-slate-300">Bookmarked lesson routes</p>
            <div className="mt-5 space-y-3">
              {savedLessons.length === 0 ? <p className="text-sm text-slate-300">Star lessons to save them here.</p> : savedLessons.map((item) => (
                <a key={`${item.courseId}:${item.id}`} href={item.route} className="block rounded-2xl bg-white/10 p-4 hover:bg-white/15">
                  <p className="text-xs font-bold uppercase text-amber-200">{item.courseTitle}</p>
                  <p className="font-bold">{item.title}</p>
                </a>
              ))}
            </div>
          </aside>
        </section>
      </section>

      <footer className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-slate-950/95 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <button disabled={lessonIndex === 0} onClick={() => move(-1)} className="rounded-full border border-white/10 px-4 py-2 disabled:opacity-40">Previous</button>
          <div className="flex-1"><div className="h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-emerald-400 transition-all" style={{ width: `${((lessonIndex + 1) / course.lessons.length) * 100}%` }} /></div></div>
          <button disabled={lessonIndex === course.lessons.length - 1} onClick={() => move(1)} className="rounded-full bg-white px-4 py-2 font-bold text-slate-950 disabled:opacity-40">Next</button>
        </div>
      </footer>

      {modalOpen && <CompletionModal onClose={() => setModalOpen(false)} />}
    </main>
  );
}
