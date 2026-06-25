type ProgressRingProps = {
  percentage: number;
  accent: string;
};

export function ProgressRing({ percentage, accent }: ProgressRingProps) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const normalized = Math.min(100, Math.max(0, percentage));
  const offset = circumference - (normalized / 100) * circumference;

  return (
    <div className="relative grid size-24 place-items-center">
      <svg className="size-24 -rotate-90" viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(15, 23, 42, 0.1)" strokeWidth="10" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={accent}
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <span className="absolute text-lg font-black text-slate-950">{Math.round(normalized)}%</span>
    </div>
  );
}
