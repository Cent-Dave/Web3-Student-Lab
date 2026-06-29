'use client';

import { useState, useEffect } from 'react';
import { DatabaseManager, RoadmapNodeRecord } from '@/lib/storage/DatabaseManager';

const DEFAULT_NODES = [
  {
    id: 1,
    title: 'Foundations',
    desc: 'Ledger basics, accounts, and trustlines.',
    status: 'COMPLETED',
    x: '50%',
    y: '10%',
  },
  {
    id: 2,
    title: 'Assets & SDEX',
    desc: 'Issuing tokens and liquidity pools.',
    status: 'IN_PROGRESS',
    x: '30%',
    y: '35%',
  },
  {
    id: 3,
    title: 'Soroban 101',
    desc: 'Rust smart contracts and WASM.',
    status: 'LOCKED',
    x: '70%',
    y: '35%',
  },
  {
    id: 4,
    title: 'Advanced DeFi',
    desc: 'Flash loans and cross-chain hooks.',
    status: 'LOCKED',
    x: '50%',
    y: '60%',
  },
  {
    id: 5,
    title: 'Protocol Expert',
    desc: 'Core architecture and consensus.',
    status: 'LOCKED',
    x: '50%',
    y: '85%',
  },
];

export default function RoadmapPage() {
  const [nodes, setNodes] = useState(DEFAULT_NODES);
  const [activeNode, setActiveNode] = useState(DEFAULT_NODES[1]);
  const [db] = useState(() => new DatabaseManager());
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initDb = async () => {
      try {
        const storedNodes = await db.listRoadmapNodes();
        if (storedNodes.length > 0) {
          // Merge stored status with default nodes
          const mergedNodes = DEFAULT_NODES.map(defaultNode => {
            const stored = storedNodes.find(n => n.id === defaultNode.id);
            return stored ? { ...defaultNode, status: stored.status } : defaultNode;
          });
          setNodes(mergedNodes);
          
          // Set active node to the first in-progress node, or the stored node 2
          const inProgressNode = mergedNodes.find(n => n.status === 'IN_PROGRESS');
          if (inProgressNode) setActiveNode(inProgressNode);
        } else {
          // Initialize DB with default nodes
          await Promise.all(DEFAULT_NODES.map(node => 
            db.upsertRoadmapNode({ id: node.id, status: node.status, updatedAt: Date.now() })
          ));
        }
      } catch (error) {
        console.error('Failed to load roadmap from DB:', error);
      } finally {
        setIsInitializing(false);
      }
    };
    initDb();
  }, [db]);

  const handleNodeAction = async () => {
    if (activeNode.status === 'IN_PROGRESS') {
      const updatedNode = { ...activeNode, status: 'COMPLETED' };
      const newNodes = nodes.map(n => n.id === activeNode.id ? updatedNode : n);
      setNodes(newNodes);
      setActiveNode(updatedNode);
      await db.upsertRoadmapNode({ id: activeNode.id, status: 'COMPLETED', updatedAt: Date.now() });
    }
  };

  if (isInitializing) {
    return <div className="min-h-[calc(100vh-80px)] bg-black text-white flex items-center justify-center">Loading Roadmap Index...</div>;
  }
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
          <p className="text-xs tracking-[0.3em] text-gray-500 uppercase">
            Module Hierarchy & Skill Acquisition Tree (Indexed)
          </p>
        </div>

        <div className="relative flex aspect-[4/5] w-full max-w-4xl items-center justify-center overflow-hidden rounded-[3rem] border border-white/5 bg-zinc-950/20 p-12 shadow-inner md:aspect-video">
          {/* Connecting Lines (SVG) */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-20">
            <line
              x1="50%"
              y1="10%"
              x2="30%"
              y2="35%"
              stroke="white"
              strokeWidth="1"
              strokeDasharray="4"
            />
            <line
              x1="50%"
              y1="10%"
              x2="70%"
              y2="35%"
              stroke="white"
              strokeWidth="1"
              strokeDasharray="4"
            />
            <line
              x1="30%"
              y1="35%"
              x2="50%"
              y2="60%"
              stroke="white"
              strokeWidth="1"
              strokeDasharray="4"
            />
            <line
              x1="70%"
              y1="35%"
              x2="50%"
              y2="60%"
              stroke="white"
              strokeWidth="1"
              strokeDasharray="4"
            />
            <line
              x1="50%"
              y1="60%"
              x2="50%"
              y2="85%"
              stroke="white"
              strokeWidth="1"
              strokeDasharray="4"
            />
          </svg>

          {/* Nodes */}
          {nodes.map((node) => (
            <button
              key={node.id}
              onClick={() => setActiveNode(node)}
              className={`group absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 transform items-center justify-center rounded-full border-4 transition-all duration-500 ${
                activeNode.id === node.id ? 'z-20 scale-125' : 'z-10 bg-black'
              } ${
                node.status === 'COMPLETED'
                  ? 'border-green-500 bg-green-500/10'
                  : node.status === 'IN_PROGRESS'
                    ? 'animate-pulse border-red-600 bg-red-600/10'
                    : 'border-zinc-800 bg-zinc-900 opacity-60'
              }`}
              style={{ left: node.x, top: node.y }}
            >
              <div
                className={`h-3 w-3 rounded-full ${
                  node.status === 'COMPLETED'
                    ? 'bg-green-500 shadow-[0_0_10px_#22c55e]'
                    : node.status === 'IN_PROGRESS'
                      ? 'bg-red-500 shadow-[0_0_10px_#ef4444]'
                      : 'bg-zinc-700'
                }`}
              ></div>

              {/* Tooltip Label */}
              <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100">
                <span className="rounded border border-white/10 bg-zinc-900 px-2 py-1 text-[9px] font-black tracking-widest uppercase">
                  {node.title}
                </span>
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
              onClick={handleNodeAction}
              className={`w-full py-3 text-[10px] font-black tracking-widest uppercase transition-all ${
                activeNode.status === 'LOCKED'
                  ? 'cursor-not-allowed bg-zinc-800 text-gray-600'
                  : 'bg-red-600 text-white hover:bg-red-500 active:scale-95'
              }`}
            >
              {activeNode.status === 'COMPLETED'
                ? 'Review Protocol'
                : activeNode.status === 'IN_PROGRESS'
                  ? 'Complete Node'
                  : 'Node Locked'}
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
