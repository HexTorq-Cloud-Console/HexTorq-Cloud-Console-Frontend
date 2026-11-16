// Shared ASCII reveal settings.
//
// `speed` is a playback multiplier on top of the library's own duration:
// a lower value plays the decode wave slower. Keeping it in one constant
// means every reveal in the console moves at the same pace and the pace can
// be tuned in a single place.
export const ASCII_REVEAL = {
  preset: 'dither',
  origin: 'top-left',
  speed: 0.35,
} as const;

// The console shell (sidebar and page content) gets the slow, cinematic
// wave: it plays once per route change, so it has to read as a deliberate
// reveal rather than a flash.
export const ASCII_REVEAL_SHELL = {
  preset: 'dither',
  origin: 'top-left',
  duration: 'cinematic',
  speed: 0.45,
} as const;
