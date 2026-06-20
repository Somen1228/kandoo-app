import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { createPortal } from 'react-dom';

// Draw the cropped area onto a canvas and return a Blob
async function getCroppedBlob(imageSrc, croppedAreaPixels) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const size = croppedAreaPixels.width;
  canvas.width  = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    image,
    croppedAreaPixels.x, croppedAreaPixels.y,
    croppedAreaPixels.width, croppedAreaPixels.height,
    0, 0, size, size,
  );

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

export default function AvatarCropper({ imageSrc, onDone, onCancel }) {
  const [crop, setCrop]           = useState({ x: 0, y: 0 });
  const [zoom, setZoom]           = useState(1);
  const [croppedArea, setCroppedArea] = useState(null);
  const [applying, setApplying]   = useState(false);

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedArea(areaPixels);
  }, []);

  const apply = async () => {
    if (!croppedArea) return;
    setApplying(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea);
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      await onDone(file);
    } finally {
      setApplying(false);
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.82)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Crop area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          style={{
            containerStyle: { borderRadius: 0 },
            cropAreaStyle: { border: '2px solid var(--accent, #6c63ff)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)' },
          }}
        />
      </div>

      {/* Controls */}
      <div style={{
        flexShrink: 0, padding: '16px 24px',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* Zoom slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', width: 36 }}>Zoom</span>
          <input
            type="range" min={1} max={3} step={0.01}
            value={zoom} onChange={e => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent, #6c63ff)', cursor: 'pointer' }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 20px', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent', color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer', fontSize: '0.84rem',
            }}>
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={applying}
            style={{
              padding: '9px 24px', borderRadius: 10,
              border: 'none', background: 'var(--accent, #6c63ff)',
              color: 'white', cursor: 'pointer',
              fontSize: '0.84rem', fontWeight: 600,
              opacity: applying ? 0.6 : 1,
            }}>
            {applying ? 'Uploading…' : 'Set as photo'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
