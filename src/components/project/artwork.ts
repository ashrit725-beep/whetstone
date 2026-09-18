/**
 * The real artwork some projects carry.
 *
 * Four of the seeded projects have actual files on disk in
 * `public/media/covers/`, supplied by the owner and cropped from their own
 * renders. They are keyed by slug rather than by project type on purpose: a
 * piece of art belongs to one project, and handing the same still to all four
 * games would be a picture of somebody else's work on your page.
 *
 * Every entry carries the size it is drawn at, so the layout reserves the
 * exact box and nothing shifts when the image lands, and a written alt that
 * describes the picture rather than naming the file. The Brinehollow files are
 * stored at twice that size so they stay sharp on a high-density screen, and
 * with the player controls the source render had drawn over the still taken
 * out: a play button on a picture that plays nothing is a broken control.
 *
 * Projects not listed here have no artwork, and the stage composes their space
 * from rule, type and ink density instead. That is a designed state, not a
 * fallback.
 */

export interface Artwork {
  readonly src: string
  readonly width: number
  readonly height: number
  readonly alt: string
  readonly caption?: string
}

export interface ProjectArtwork {
  readonly hero: Artwork
  readonly plates: readonly Artwork[]
}

const ARTWORK: Readonly<Record<string, ProjectArtwork>> = {
  brinehollow: {
    hero: {
      src: '/media/covers/media-game-hero.webp',
      width: 424,
      height: 182,
      alt: 'Brinehollow, the opening vista: a small figure with a pack stands on a cliff path looking out over ruined stone towers, waterfalls and floating islands in daylight.',
      caption: 'The opening vista.',
    },
    plates: [
      {
        src: '/media/covers/cover-game.webp',
        width: 150,
        height: 150,
        alt: 'Cover art: the same figure seen from behind on a sunlit clearing path, with a ruined tower ahead framed by trees.',
      },
      {
        src: '/media/covers/media-game-a.webp',
        width: 146,
        height: 55,
        alt: 'Forest interior: a narrow lit path between mossy trunks with a distant figure walking away.',
      },
      {
        src: '/media/covers/media-game-b.webp',
        width: 146,
        height: 55,
        alt: 'Underground hall: a single lamp above a flooded stone corridor lined with pillars.',
      },
    ],
  },
  tallyroot: {
    hero: {
      src: '/media/covers/cover-dashboard.png',
      width: 150,
      height: 150,
      alt: 'Tallyroot dashboard render: a dark left rail beside a white panel of summary tiles and two bar charts.',
    },
    plates: [],
  },
  ferryman: {
    hero: {
      src: '/media/covers/cover-mobile.png',
      width: 150,
      height: 150,
      alt: 'Ferryman on a phone: a pale reading screen headed “Small steps, brighter days” above a photograph of a lake.',
    },
    plates: [],
  },
  'kestrel-deck': {
    hero: {
      src: '/media/covers/cover-hardware.png',
      width: 150,
      height: 150,
      alt: 'Kestrel Deck industrial render: a matte white rounded enclosure photographed against a plain pale backdrop.',
    },
    plates: [],
  },
}

export function artworkFor(slug: string): ProjectArtwork | null {
  return ARTWORK[slug] ?? null
}
