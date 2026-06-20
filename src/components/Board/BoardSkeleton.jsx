import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import kandooLogo from "../../assets/kandoo-head.png";
import kandooLogoSmiling from "../../assets/kandoo-smiling.png";

const CARD_CONFIGS = [
  { tasks: [72, 45, 88], delay: 0 },
  { tasks: [60, 80, 50, 65], delay: 0.18 },
  { tasks: [90, 55, 70, 40], delay: 0.34 },
];

function SkeletonBar({ width, delay = 0 }) {
  return (
    <motion.div
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        height: "0.65rem",
        width: `${width}%`,
        borderRadius: "0.375rem",
        background: "var(--theme-bg-hover)",
        transformOrigin: "left center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* shimmer sweep */}
      <motion.div
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.6, ease: "easeInOut", delay: delay + 0.4 }}
        style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
          width: "60%",
        }}
      />
    </motion.div>
  );
}

function SkeletonCard({ tasks, delay, rotateY = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 48, rotateY: rotateY - 4 }}
      animate={{ opacity: 1, y: 0, rotateY }}
      transition={{ duration: 0.55, delay, ease: [0.34, 1.06, 0.64, 1] }}
      style={{
        background: "var(--theme-bg-card)",
        border: "1px solid var(--theme-border)",
        borderRadius: "0.875rem",
        overflow: "hidden",
        flex: 1,
        minWidth: 0,
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        transformStyle: "preserve-3d",
      }}
    >
      {/* column header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.15 }}
        style={{
          padding: "0.625rem 0.875rem",
          background: "var(--theme-bg-hover)",
          borderBottom: "1px solid var(--theme-border)",
        }}
      >
        <SkeletonBar width={38} delay={delay + 0.18} />
      </motion.div>

      {/* tasks */}
      <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {tasks.map((w, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + 0.25 + i * 0.08, duration: 0.35, ease: "easeOut" }}
            style={{
              padding: "0.6rem 0.75rem",
              borderRadius: "0.5rem",
              background: "var(--theme-task-bg, var(--theme-bg-primary))",
              border: "1px solid var(--theme-task-border, var(--theme-border))",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            <SkeletonBar width={w} delay={delay + 0.3 + i * 0.08} />
            <SkeletonBar width={Math.round(w * 0.45)} delay={delay + 0.38 + i * 0.08} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function SlothMascot() {
  const [smiling, setSmiling] = useState(false);

  // swap to smiling face once cards have appeared
  useEffect(() => {
    const t = setTimeout(() => setSmiling(true), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.34, 1.2, 0.64, 1] }}
      style={{ position: "relative", width: 64, height: 64 }}
    >
      {/* glow behind mascot */}
      <motion.div
        animate={{ scale: [1, 1.18, 1], opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: "4px",
          borderRadius: "50%",
          background: "var(--theme-accent, #3b82f6)",
          filter: "blur(14px)",
          zIndex: 0,
        }}
      />
      {/* float */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "relative", zIndex: 1, width: 64, height: 64 }}
      >
        <AnimatePresence mode="wait">
          {!smiling ? (
            <motion.img
              key="neutral"
              src={kandooLogo}
              alt=""
              draggable={false}
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.9, rotate: -5 }}
              transition={{ duration: 0.25 }}
              style={{ width: "100%", height: "100%", objectFit: "contain", userSelect: "none" }}
            />
          ) : (
            <motion.img
              key="smile"
              src={kandooLogoSmiling}
              alt=""
              draggable={false}
              initial={{ opacity: 0, scale: 0.9, rotate: 5 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.3, ease: [0.34, 1.2, 0.64, 1] }}
              style={{ width: "100%", height: "100%", objectFit: "contain", userSelect: "none" }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default function BoardSkeleton({ message = "Opening your workspace…" }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      padding: "2rem 1.5rem 1.5rem",
      gap: "2rem",
    }}>
      {/* top progress bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: "2px",
        background: "var(--theme-bg-hover)",
        overflow: "hidden",
      }}>
        <motion.div
          animate={{ x: ["-100%", "120%"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute", inset: 0,
            width: "45%",
            background: "linear-gradient(90deg, transparent, var(--theme-accent, #3b82f6), transparent)",
            borderRadius: "2px",
          }}
        />
      </div>

      {/* mascot + message centered */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.875rem",
        paddingTop: "0.5rem",
      }}>
        <SlothMascot />
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          style={{
            fontSize: "0.8rem",
            color: "var(--theme-text-muted)",
            letterSpacing: "0.04em",
            margin: 0,
          }}
        >
          {message}
        </motion.p>

        {/* dot trail */}
        <div style={{ display: "flex", gap: "5px" }}>
          {[0, 0.2, 0.4].map((d, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1.0, repeat: Infinity, delay: d, ease: "easeInOut" }}
              style={{
                width: 5, height: 5,
                borderRadius: "50%",
                background: "var(--theme-accent, #3b82f6)",
                opacity: 0.4,
              }}
            />
          ))}
        </div>
      </div>

      {/* skeleton cards in 3D perspective */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        style={{
          perspective: "1200px",
          display: "flex",
          gap: "1rem",
          flex: 1,
          alignItems: "flex-start",
        }}
      >
        {CARD_CONFIGS.map(({ tasks, delay }, i) => {
          const rotateY = (i - 1) * 4; // -4, 0, +4 degrees
          return (
            <SkeletonCard
              key={i}
              tasks={tasks}
              delay={delay}
              rotateY={rotateY}
            />
          );
        })}
      </motion.div>
    </div>
  );
}
