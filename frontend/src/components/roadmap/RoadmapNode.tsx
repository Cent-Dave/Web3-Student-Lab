'use client';

import { type KeyboardEvent, useCallback } from 'react';
import type { RoadmapNodeData, NodePosition } from '@/lib/types/roadmap';
import {
  getNodeColor,
  getNodeBgColor,
  getAccessibleLabel,
} from '@/lib/roadmap-utils';
import { CheckCircle2, Lock, Play, AlertCircle } from 'lucide-react';

interface RoadmapNodeProps {
  node: RoadmapNodeData;
  position: NodePosition;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (nodeId: string) => void;
  onHover: (nodeId: string | null) => void;
}

const STATUS_ICONS = {
  completed: CheckCircle2,
  in_progress: Play,
  available: AlertCircle,
  locked: Lock,
} as const;

export function RoadmapNode({
  node,
  position,
  isSelected,
  isHovered,
  onSelect,
  onHover,
}: RoadmapNodeProps) {
  const color = getNodeColor(node.status);
  const bgColor = getNodeBgColor(node.status);
  const accessibleLabel = getAccessibleLabel(node);
  const Icon = STATUS_ICONS[node.status];

  const handleClick = useCallback(() => {
    onSelect(node.id);
  }, [node.id, onSelect]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(node.id);
      }
    },
    [node.id, onSelect]
  );

  const handleMouseEnter = useCallback(() => {
    onHover(node.id);
  }, [node.id, onHover]);

  const handleMouseLeave = useCallback(() => {
    onHover(null);
  }, [onHover]);

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={accessibleLabel}
      aria-current={isSelected ? 'step' : undefined}
      aria-disabled={node.status === 'locked'}
      tabIndex={0}
      className={`group absolute flex flex-col items-center justify-center rounded-xl border-2 transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-strong)] ${
        isSelected
          ? 'z-30 scale-110 shadow-xl'
          : isHovered
            ? 'z-20 scale-105'
            : 'z-10'
      } ${
        node.status === 'locked'
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer'
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: 160,
        height: 80,
        borderColor: isSelected ? color : `${color}40`,
        backgroundColor: isSelected ? bgColor : 'rgba(0,0,0,0.3)',
        transform: `translate(${isSelected ? -4 : 0}px, ${isSelected ? -4 : 0}px)`,
      }}
    >
      <Icon
        className="mb-1"
        size={18}
        color={color}
        aria-hidden="true"
      />
      <span
        className="text-center text-xs font-semibold leading-tight tracking-wide"
        style={{ color }}
      >
        {node.title}
      </span>
      {node.status === 'in_progress' && (
        <span className="mt-1 text-[10px] font-medium text-white/60">
          {node.progress}%
        </span>
      )}
    </button>
  );
}
