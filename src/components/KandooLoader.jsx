import { motion } from "framer-motion";
import { kandooMascots } from "../assets/kandoo/mascots";

const RIPPLE_COUNT = 3;

function Ripple() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {Array.from({ length: RIPPLE_COUNT }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0.6, opacity: 0.5 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{
            duration: 2.2,
            delay: i * 0.7,
            repeat: Infinity,
            ease: "easeOut",
          }}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "2px solid var(--theme-accent, #3b82f6)",
          }}
        />
      ))}
    </div>
  );
}

function OrbitDot({ radius, delay }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "linear", delay }}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <motion.div
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 1.8, repeat: Infinity, delay: delay * 0.5, ease: "easeInOut" }}
        style={{
          position: "absolute",
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "var(--theme-accent, #3b82f6)",
          transform: `translateX(${radius}px)`,
          boxShadow: "0 0 6px 2px var(--theme-accent, #3b82f6)",
        }}
      />
    </motion.div>
  );
}

function SlothCore({ size }) {
  const orbitRadius = size * 0.68;

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.34, 1.26, 0.64, 1] }}
      style={{
        position: "relative",
        width: size + orbitRadius * 2,
        height: size + orbitRadius * 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* ripple rings — centred on the mascot */}
      <div
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "visible",
        }}
      >
        <Ripple />
      </div>

      {/* orbiting dots */}
      <div
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: "50%",
        }}
      >
        <OrbitDot radius={orbitRadius} delay={0} />
        <OrbitDot radius={orbitRadius} delay={1.17} />
        <OrbitDot radius={orbitRadius} delay={2.33} />
      </div>

      {/* glow blob */}
      <motion.div
        animate={{ scale: [1, 1.25, 1], opacity: [0.22, 0.45, 0.22] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          width: size * 0.9,
          height: size * 0.9,
          borderRadius: "50%",
          background: "var(--theme-accent, #3b82f6)",
          filter: "blur(20px)",
        }}
      />

      {/* floating sloth */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "relative", width: size, height: size, zIndex: 1 }}
      >
        <motion.img
          src={kandooMascots.loading}
          alt=""
          draggable={false}
          animate={{ rotate: [-1.5, 1.5, -1.5], scale: [1, 1.025, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            userSelect: "none",
            filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.18))",
          }}
        />
      </motion.div>

      {/* squash shadow */}
      <motion.div
        animate={{ scaleX: [1, 0.55, 1], opacity: [0.28, 0.1, 0.28] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          bottom: orbitRadius * 0.3,
          width: size * 0.55,
          height: 10,
          borderRadius: "50%",
          background: "var(--theme-accent, #3b82f6)",
          filter: "blur(5px)",
        }}
      />
    </motion.div>
  );
}

function LoaderContent({ message, size }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        padding: "2rem",
      }}
    >
      <SlothCore size={size} />

      {message && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.625rem",
          }}
        >
          <span
            style={{
              fontSize: "0.825rem",
              color: "var(--theme-text-muted)",
              letterSpacing: "0.04em",
            }}
          >
            {message}
          </span>

          {/* pulsing dots */}
          <div style={{ display: "flex", gap: "5px" }}>
            {[0, 0.2, 0.4].map((d, i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.3, 0.8] }}
                transition={{ duration: 1.0, repeat: Infinity, delay: d, ease: "easeInOut" }}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--theme-accent, #3b82f6)",
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function KandooLoader({ fullscreen = false, message, size = 80 }) {
  if (!fullscreen) return <LoaderContent message={message} size={size} />;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--theme-bg-primary)",
        zIndex: 1000,
        overflow: "hidden",
      }}
    >
      {/* scanning progress bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: "var(--theme-bg-hover)",
          overflow: "hidden",
        }}
      >
        <motion.div
          animate={{ x: ["-100%", "120%"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            inset: 0,
            width: "45%",
            background: "linear-gradient(90deg, transparent, var(--theme-accent, #3b82f6), transparent)",
          }}
        />
      </div>

      {/* subtle background radial */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 55% 55% at 50% 50%, color-mix(in srgb, var(--theme-accent, #3b82f6) 7%, transparent) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <LoaderContent message={message} size={size} />
    </div>
  );
}
