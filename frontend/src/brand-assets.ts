/**
 * Single integration point for the official National University crest.
 * The official asset lives at frontend/public/nu-crest.png. To replace it, overwrite
 * that file (or point CREST_SRC elsewhere). Set CREST_SRC to undefined to fall back
 * to the labelled placeholder.
 * The crest is never redrawn or recolored in code.
 */
export const CREST_SRC:string|undefined="/nu-crest.png";
export const CREST_ALT="National University crest";
