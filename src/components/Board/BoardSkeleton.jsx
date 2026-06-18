import KandooLoader from "../KandooLoader";

function SkeletonBar({ width = '100%', height = '0.75rem', className = '' }) {
  return (
    <div
      className={`skeleton-pulse rounded ${className}`}
      style={{
        width,
        height,
        background: 'var(--theme-bg-hover)',
      }}
    />
  );
}

function SkeletonCard({ tasks = 3 }) {
  return (
    <div
      className="rounded shadow-sm overflow-hidden"
      style={{
        background: 'var(--theme-bg-card)',
        border: '1px solid var(--theme-border)',
        minWidth: '18rem',
        marginBottom: '1rem',
      }}
    >
      <div className="px-3 py-2" style={{ background: 'var(--theme-bg-hover)' }}>
        <SkeletonBar width="40%" height="0.875rem" />
      </div>
      <div className="p-3 flex flex-col gap-2">
        {Array.from({ length: tasks }).map((_, i) => (
          <div
            key={i}
            className="p-2 rounded"
            style={{
              background: 'var(--theme-task-bg)',
              border: '1px solid var(--theme-task-border)',
            }}
          >
            <SkeletonBar width={`${60 + (i * 13) % 35}%`} className="mb-2" />
            <SkeletonBar width="30%" height="0.625rem" />
          </div>
        ))}
      </div>
    </div>
  );
}

function BoardSkeleton({ message }) {
  return (
    <div className="pl-10">
      <KandooLoader message={message} />
      <div
        className="container"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))',
          gap: '1rem',
          padding: '1rem',
        }}
      >
        <SkeletonCard tasks={3} />
        <SkeletonCard tasks={2} />
        <SkeletonCard tasks={4} />
      </div>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
        .skeleton-pulse {
          animation: skeletonPulse 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default BoardSkeleton;
