# Mascot generation prompts

The expression masters were produced with the built-in image-generation edit workflow using `src-tauri/icons/icon-v2.png` as the edit target.

## Shared edit constraints

Change only the mascot's eyes, brows, and mouth. Preserve the exact silhouette, three hair tufts, proportions, cream face, rust eye patches, golden fur, gradients, and thick navy outline. Keep the centered front-facing composition and padding. Use a perfectly flat `#00ff00` chroma-key background with no shadow, glow, reflection, symbols, text, watermark, accessories, interface chrome, or green in the subject.

## Expression deltas

- **Success:** Open bright eyes with small highlights, a broad happy open smile, and a tiny visible tongue.
- **Loading:** Open eyes looking slightly upward, gently concentrated brows, and a small determined closed smile.
- **Error:** Soft open eyes, raised inner brows, and a small downturned apologetic mouth; no tears.
- **Warning:** Eyes looking slightly sideways, one eyebrow raised, and a small asymmetric uncertain mouth; puzzled rather than angry.
- **Online:** Friendly open eyes, relaxed brows, and a confident warm closed smile, distinct from Success.
- **Offline:** Heavy half-closed eyelids angled downward and a small neutral mouth; sleepy rather than sad.

Chroma-key removal used the installed image-generation helper with border sampling, a soft matte, thresholds `12/220`, and despill. Masters were normalized to 1024 px and runtime copies to 384 px.
