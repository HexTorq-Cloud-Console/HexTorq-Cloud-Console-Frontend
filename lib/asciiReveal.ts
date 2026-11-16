// Shared ASCII reveal settings.
//
// `speed` is a playback multiplier on top of the library's own duration:
// a lower value plays the decode wave slower. Keeping it in one constant
// means every reveal in the console moves at the same pace and the pace can
// be tuned in a single place.
//
// The `cinematic` duration is deliberately NOT used: it sets an infinite wave
// (`maxWave: 1/0`), so the canvas never settles and the page keeps
// repainting in the background. The bounded default duration is used instead
// and the pace is slowed with `speed`.
export const ASCII_REVEAL = {
  preset: 'dither',
  origin: 'top-left',
  speed: 0.45,
} as const;

// The sidebar is a small surface, so a full ASCII decode there stays cheap
// and gives the console its signature reveal.
export const ASCII_REVEAL_SHELL = {
  preset: 'dither',
  origin: 'top-left',
  speed: 0.55,
} as const;
