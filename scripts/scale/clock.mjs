/**
 * When things happen.
 *
 * Every timestamp the population writes comes from here, so there is one
 * answer to "what does a day on Whetstone look like" rather than a dozen
 * `between(1, 160) * DAY` guesses that each clamp to the present on their own.
 * That clamping is what used to stack fourteen thousand reviews on one
 * millisecond: any date that ran past the present was moved to exactly the
 * present, and a lot of dates ran past it.
 *
 * Three rules replace it.
 *
 *   Growth. The community did not arrive at once. People joined and projects
 *   were posted along a curve that was slow for a year and picked up about
 *   four months ago, which is when most small communities find their people.
 *   The last few weeks are close to level, so a four-week chart shows steady
 *   days with a gentle rise rather than a cliff.
 *
 *   Rhythm. Days are not all alike. Weekends are quieter than weekdays, and
 *   the small hours in Europe and the Americas are quieter than the
 *   afternoons, so a review lands at a time of day somebody was awake.
 *
 *   Things that have not happened yet do not exist. A reply drawn for next
 *   Tuesday is not written today instead; it is simply not written. That is
 *   why the newest project has one review and not thirty, and why the count
 *   of reviews per day runs smoothly right up to the present instead of
 *   bunching into it. `settle()` is only for the rare row that has to exist
 *   and has to have a date, and it redraws inside the time available rather
 *   than pinning to the edge of it.
 */

export const MINUTE = 60_000
export const HOUR = 3_600_000
export const DAY = 86_400_000

/** How long the community has existed. */
const SPAN = 540 * DAY

/**
 * Relative busyness by UTC weekday, Sunday first. Sunday evening is when a
 * lot of hobby work gets looked at, so it sits above Saturday.
 */
const WEEKDAY = [0.86, 1, 1, 0.98, 0.96, 0.9, 0.78]

/**
 * Relative busyness by UTC hour. The membership is mostly European and North
 * American, so the day peaks in the European afternoon, which is also the
 * American morning, and bottoms out around 04:00 UTC.
 */
const HOURLY = Array.from({ length: 24 }, (_, h) => {
  const d = Math.min(Math.abs(h - 16), 24 - Math.abs(h - 16))
  return 0.22 + 0.78 * Math.exp(-(d * d) / (2 * 5.2 * 5.2))
})

/**
 * The two curves the population grows along: a slow ramp across the whole
 * span, and a steeper wave that crests shortly before the present. `share` is
 * how much of the total the wave carries; `mid` is how many days before the
 * present it was at half height, and `width` how many days it took to rise.
 */
const CURVES = {
  /** Sign-ups. People arrive a little ahead of the work they do. */
  people: { share: 0.62, mid: 150, width: 42 },
  /** Projects and the threads people start. */
  work: { share: 0.8, mid: 85, width: 25 },
}

export function makeClock(now, rnd) {
  const NOW = now
  const EPOCH = NOW - SPAN

  const rhythm = (t) => {
    const d = new Date(t)
    return WEEKDAY[d.getUTCDay()] * HOURLY[d.getUTCHours()]
  }
  /** Keep a moment with the probability the rhythm gives its day and hour. */
  const onRhythm = (t) => rnd() < rhythm(t)

  const exp = (meanMs) => -Math.log(1 - rnd()) * meanMs
  /** ln(1 + e^x), the running total of a rate that rises along a logistic. */
  const softplus = (x) => (x > 30 ? x : Math.log1p(Math.exp(x)))

  /** One draw from a growth curve, ignoring rhythm. */
  const drawCurve = ({ share, mid, width }) => {
    if (rnd() >= share) {
      // The ramp: the rate rises linearly from nothing at the start.
      return EPOCH + Math.sqrt(rnd()) * SPAN
    }
    // The wave: a rate that rises along a logistic and levels off. Its total
    // up to any moment is a softplus, so a uniform draw on that total,
    // inverted, lands where the activity was.
    const midAt = NOW - mid * DAY
    const w = width * DAY
    const s = softplus((EPOCH - midAt) / w) + rnd() * (softplus((NOW - midAt) / w) - softplus((EPOCH - midAt) / w))
    return midAt + w * (s + Math.log(-Math.expm1(-s)))
  }

  return {
    /** A moment somebody joined, or started something, along a growth curve. */
    grown(curveName) {
      const curve = CURVES[curveName]
      for (let i = 0; i < 40; i++) {
        const t = Math.floor(drawCurve(curve))
        if (t < NOW && onRhythm(t)) return t
      }
      return Math.floor(drawCurve(curve))
    },

    /**
     * A moment some time after `from`, shaped like the gap between two
     * things of this kind. May land past the present: the caller decides
     * whether that means "not yet" (almost always) or needs `settle()`.
     */
    after(from, kind) {
      const shape = GAPS[kind]
      for (let i = 0; i < 30; i++) {
        const t = Math.floor(from + shape(exp, rnd))
        if (t > NOW || onRhythm(t)) return t
      }
      return Math.floor(from + shape(exp, rnd))
    },

    /**
     * For a row that must exist: `want` if it has already happened, otherwise
     * a fresh moment between `lo` and the present, so rows that would have
     * run over spread across the time there was rather than meeting at its
     * edge. With no time at all, a few minutes before the present.
     */
    settle(lo, want) {
      if (want <= NOW) return Math.floor(want)
      if (lo >= NOW - MINUTE) return NOW - Math.floor(MINUTE + rnd() * 20 * MINUTE)
      for (let i = 0; i < 20; i++) {
        const t = Math.floor(lo + rnd() * (NOW - lo))
        if (onRhythm(t)) return t
      }
      return Math.floor(lo + rnd() * (NOW - lo))
    },
  }
}

/**
 * How long after one thing the next one of its kind tends to come. Each is a
 * mixture: most of it soon, some of it after a while, a little of it much
 * later, which is how attention actually decays.
 */
const GAPS = {
  /** A review, after the project was posted. */
  note: (exp, rnd) => {
    const r = rnd()
    if (r < 0.46) return HOUR + exp(2.5 * DAY)
    if (r < 0.82) return HOUR + exp(12 * DAY)
    return (20 + rnd() * 130) * DAY
  },
  /** Agreement with a note, a point or a post. */
  vote: (exp, rnd) => {
    const r = rnd()
    if (r < 0.6) return 10 * MINUTE + exp(18 * HOUR)
    if (r < 0.9) return HOUR + exp(4 * DAY)
    return (7 + rnd() * 53) * DAY
  },
  /** A creator's first answer to a note. Most answer the same day or not at all. */
  reply: (exp, rnd) => {
    const r = rnd()
    if (r < 0.55) return 20 * MINUTE + exp(10 * HOUR)
    if (r < 0.9) return HOUR + exp(2.5 * DAY)
    return (5 + rnd() * 15) * DAY
  },
  /** The other side answering back. */
  answer: (exp, rnd) => (rnd() < 0.6 ? 15 * MINUTE + exp(14 * HOUR) : HOUR + exp(3 * DAY)),
  /** The next post in a thread. */
  post: (exp, rnd) => {
    const r = rnd()
    if (r < 0.5) return 5 * MINUTE + exp(5 * HOUR)
    if (r < 0.9) return HOUR + exp(1.5 * DAY)
    return DAY + exp(6 * DAY)
  },
  /** A suggestion opened from something a review said. */
  suggestion: (exp) => HOUR + exp(6 * DAY),
  /** A suggestion's status moving on. */
  triage: (exp) => DAY + exp(14 * DAY),
  /** The next build after the last one. */
  build: (exp, rnd) => (9 + rnd() * 61) * DAY,
  /** Somebody backing a suggestion. */
  backing: (exp, rnd) => (rnd() < 0.7 ? HOUR + exp(3 * DAY) : (5 + rnd() * 80) * DAY),
}

/**
 * Everyone, in the order they joined, so "somebody who was already here at
 * this moment" is one binary search and one draw. Picking a person first and
 * then clamping the date to their join date was the other source of dates
 * that all agreed with each other a little too well.
 *
 * `busy` is how much a person does relative to everyone else. A draw can be
 * weighted by it, which is what makes a small core do most of the reviewing
 * and voting, the way it does in any community, while a draw for somebody to
 * post a project stays even.
 */
export function makeRoster(people, rnd) {
  const byJoin = people.slice().sort((a, b) => a.joined - b.joined)
  const cumulative = []
  let total = 0
  for (const person of byJoin) {
    total += person.busy ?? 1
    cumulative.push(total)
  }
  const joinedCount = (t) => {
    let lo = 0
    let hi = byJoin.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (byJoin[mid].joined <= t) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  return {
    /** Anybody who had been a member for at least an hour at `t`, or null. */
    presentAt(t) {
      const n = joinedCount(t - HOUR)
      return n === 0 ? null : byJoin[Math.floor(rnd() * n)]
    },
    /** The same, but the busy are likelier to be the one who turns up. */
    activeAt(t) {
      const n = joinedCount(t - HOUR)
      if (n === 0) return null
      const target = rnd() * cumulative[n - 1]
      let lo = 0
      let hi = n - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (cumulative[mid] < target) lo = mid + 1
        else hi = mid
      }
      return byJoin[lo]
    },
  }
}
