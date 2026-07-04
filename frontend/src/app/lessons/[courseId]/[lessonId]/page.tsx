'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import LessonWorkspace from '@/components/lesson/LessonWorkspace';
import { useParams, notFound } from 'next/navigation';
import { courses } from '@/app/curriculum-data';

export default function LessonDetailPage() {
  const params = useParams();
  const courseId = params?.courseId as string;
  const lessonId = params?.lessonId as string;

  const course = courses.find((c) => c.id === courseId);
  const lesson = course?.lessons.find((l) => l.id === lessonId);

  if (!course || !lesson) {
    return notFound();
  }

  return (
    <div className="bg-background text-foreground relative min-h-screen overflow-hidden pb-20 transition-colors duration-200">
      {/* Background glows */}
      <div className="pointer-events-none absolute top-0 right-0 h-[800px] w-[800px] rounded-full bg-red-600/5 blur-[150px]"></div>
      <div className="pointer-events-none absolute bottom-0 left-0 h-[600px] w-[600px] rounded-full bg-red-600/5 blur-[120px]"></div>

      {/* Navigation */}
      <nav className="bg-bg-secondary/80 border-border-theme relative sticky top-0 z-20 border-b backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center gap-4">
            <Link
              href="/"
              className="text-text-secondary hover:text-foreground flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-bold tracking-widest uppercase">Back to Dashboard</span>
            </Link>
            <span className="text-foreground flex items-center gap-2 text-2xl font-black tracking-tighter uppercase">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
              {course.title}
            </span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12 border-l-4 border-red-600 py-2 pl-6"
        >
          <h1 className="text-foreground mb-3 text-4xl font-black tracking-tight uppercase md:text-5xl">
            {lesson.title}
          </h1>
          <p className="text-text-secondary text-lg font-light tracking-wide">
            Follow the lesson below and experiment in the live editor.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <LessonWorkspace title={lesson.title} starterCode={lesson.starterCode || ""}>
            {lesson.content?.map((paragraph, idx) => (
              <p key={idx} className="mb-4">
                {paragraph}
              </p>
            ))}
          </LessonWorkspace>
        </motion.div>
      </main>
    </div>
  );
}
