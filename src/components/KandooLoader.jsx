import kandooLogo from "../assets/kandoo-head.png";
import kandooLogoSmiling from "../assets/kandoo-smiling.png";

// Bounce + face-swap loader. Pass `fullscreen` to fill the viewport
// with the themed background and an optional message below the logo.
function KandooLoader({ fullscreen = false, message, size = 72 }) {
  const stage = (
    <div className="kandoo-loader">
      <div className="kandoo-loader-stage" style={{ width: size + 24, height: size + 38 }}>
        <div className="kandoo-loader-bouncer" style={{ width: size, height: size }}>
          <img src={kandooLogo}        alt="" className="kandoo-loader-face kandoo-loader-face-neutral" draggable={false} />
          <img src={kandooLogoSmiling} alt="" className="kandoo-loader-face kandoo-loader-face-smile"   draggable={false} />
        </div>
        <div className="kandoo-loader-shadow" style={{ width: size * 0.78 }} />
      </div>
      {message && (
        <div
          className="kandoo-loader-message"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          {message}
        </div>
      )}
      <style>{`
        .kandoo-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1rem 0;
        }
        .kandoo-loader-stage {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
        }
        .kandoo-loader-bouncer {
          position: relative;
          animation: kandooBounce 1.1s cubic-bezier(0.5, 0, 0.5, 1) infinite;
          filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.15));
        }
        .kandoo-loader-face {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          user-select: none;
        }
        .kandoo-loader-face-neutral {
          animation: kandooFaceNeutral 1.1s steps(1, end) infinite;
        }
        .kandoo-loader-face-smile {
          animation: kandooFaceSmile 1.1s steps(1, end) infinite;
        }
        .kandoo-loader-shadow {
          height: 8px;
          margin-top: 6px;
          border-radius: 50%;
          background: var(--theme-accent, #3b82f6);
          opacity: 0.35;
          filter: blur(3px);
          animation: kandooShadow 1.1s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        }
        .kandoo-loader-message {
          margin-top: 1rem;
          font-size: 0.875rem;
          letter-spacing: 0.02em;
          opacity: 0.85;
          animation: kandooFadeIn 0.4s ease-out;
        }

        @keyframes kandooBounce {
          0%, 100% { transform: translateY(0)     scale(1.02, 0.96); }
          15%      { transform: translateY(-6px)  scale(1, 1); }
          50%      { transform: translateY(-34px) scale(0.96, 1.04); }
          85%      { transform: translateY(-6px)  scale(1, 1); }
        }
        @keyframes kandooFaceNeutral {
          0%, 35%   { opacity: 1; }
          36%, 64%  { opacity: 0; }
          65%, 100% { opacity: 1; }
        }
        @keyframes kandooFaceSmile {
          0%, 35%   { opacity: 0; }
          36%, 64%  { opacity: 1; }
          65%, 100% { opacity: 0; }
        }
        @keyframes kandooShadow {
          0%, 100% { transform: scaleX(1);   opacity: 0.35; }
          50%      { transform: scaleX(0.5); opacity: 0.15; }
        }
        @keyframes kandooFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 0.85; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .kandoo-loader-bouncer,
          .kandoo-loader-face-neutral,
          .kandoo-loader-face-smile,
          .kandoo-loader-shadow { animation: none; }
          .kandoo-loader-face-smile { opacity: 0; }
        }
      `}</style>
    </div>
  );

  if (!fullscreen) return stage;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--theme-bg-primary)',
        zIndex: 1000,
      }}
    >
      {stage}
    </div>
  );
}

export default KandooLoader;
