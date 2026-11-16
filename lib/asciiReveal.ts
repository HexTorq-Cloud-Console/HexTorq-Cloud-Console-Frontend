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
