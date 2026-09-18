/**
 * The one platform question the chrome asks: does this reader's keyboard say
 * ⌘ or Ctrl? The server answers it from the request so the palette's key cap
 * is right on the first paint, and the client asks it again of `navigator`.
 * Both read this pattern, so the two answers cannot drift apart.
 *
 * iPadOS in desktop mode reports "Macintosh", which is the right answer: a
 * hardware keyboard on an iPad carries ⌘.
 */
export const APPLE_UA = /Mac|iPhone|iPad|iPod/
