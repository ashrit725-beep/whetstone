/**
 * Skeleton for the for-reviewers page: the same opening geometry, with the ink
 * taken out. Nothing here shimmers and nothing spins.
 */

import styles from '@/components/marketing/paper.module.css'

export default function Loading() {
  return (
    <section className="pad-inline py-16 md:py-24" aria-busy="true">
      <p className="sr-only" role="status">
        Loading…
      </p>

      <div className="mx-auto max-w-page">
        <span className={styles.skel} style={{ inlineSize: '10rem', blockSize: '0.6875rem' }} />

        <div className="mt-8 grid gap-8 md:grid-cols-12 md:gap-12">
          <div className="track-safe grid gap-3 md:col-span-7">
            <span className={styles.skel} style={{ inlineSize: '100%', blockSize: '3.5rem' }} />
            <span className={styles.skel} style={{ inlineSize: '72%', blockSize: '3.5rem' }} />
          </div>
          <div className="track-safe grid gap-2 md:col-span-5">
            {[0, 1, 2, 3].map((line) => (
              <span
                key={line}
                className={styles.skel}
                style={{ inlineSize: line === 3 ? '58%' : '100%', blockSize: '1.125rem' }}
              />
            ))}
          </div>
        </div>

        <div className="mt-16 grid gap-4">
          {[0, 1, 2, 3, 4].map((row) => (
            <span key={row} className={styles.skel} style={{ inlineSize: '100%', blockSize: '4rem' }} />
          ))}
        </div>
      </div>
    </section>
  )
}
