/**
 * Landing skeleton.
 *
 * The same 7/5 split, the same hero padding and the same panel edge, with the
 * ink taken out. The headline block is sized in `em` inside a box set to the
 * hero's own type ramp, so one pair of numbers tracks the whole clamp rather
 * than drifting at one width.
 */

import styles from '@/components/marketing/paper.module.css'

export default function LandingLoading() {
  return (
    <section className="pad-inline pt-12 pb-16 md:pt-16 md:pb-24" aria-busy="true">
      <p className="sr-only" role="status">
        Loading the Whetstone home page…
      </p>

      <div className="mx-auto grid max-w-page gap-16 md:grid-cols-12 md:gap-12">
        <div className="track-safe md:col-span-7">
          <div className={`${styles.heroTitle} grid gap-2`}>
            <span className={styles.skel} style={{ inlineSize: '3.1em', blockSize: '0.8em' }} />
            <span className={styles.skel} style={{ inlineSize: '5.4em', blockSize: '0.8em' }} />
          </div>

          <div className="mt-8 grid gap-2">
            <span className={styles.skel} style={{ inlineSize: '100%', blockSize: '1.125rem' }} />
            <span className={styles.skel} style={{ inlineSize: '92%', blockSize: '1.125rem' }} />
            <span className={styles.skel} style={{ inlineSize: '64%', blockSize: '1.125rem' }} />
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <span className={styles.skel} style={{ inlineSize: '11rem', blockSize: '56px' }} />
            <span className={styles.skel} style={{ inlineSize: '13rem', blockSize: '56px' }} />
          </div>

          <ul className={`${styles.stats} mt-16`}>
            {[0, 1, 2].map((cell) => (
              <li key={cell}>
                <span className={styles.skel} style={{ inlineSize: '4rem', blockSize: '2.375rem' }} />
                <span
                  className={`${styles.skel} mt-2`}
                  style={{ inlineSize: '80%', blockSize: '0.6875rem' }}
                />
              </li>
            ))}
          </ul>
        </div>

        <div className="track-safe md:col-span-5">
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.skel} style={{ inlineSize: '11rem', blockSize: '0.6875rem' }} />
              <span className={styles.skel} style={{ inlineSize: '6rem', blockSize: '0.6875rem' }} />
            </div>
            {[0, 1, 2].map((row) => (
              <div key={row} className={styles.panelRow}>
                <span className={styles.skel} style={{ inlineSize: '9rem', blockSize: '1.75rem' }} />
                <span
                  className={`${styles.skel} mt-3`}
                  style={{ inlineSize: '100%', blockSize: '1.125rem' }}
                />
                <span
                  className={`${styles.skel} mt-2`}
                  style={{ inlineSize: '70%', blockSize: '1.125rem' }}
                />
                <span
                  className={`${styles.skel} mt-4`}
                  style={{ inlineSize: '12rem', blockSize: '0.6875rem' }}
                />
              </div>
            ))}
            <div className={styles.panelFoot}>
              <span className={styles.skel} style={{ inlineSize: '9rem', blockSize: '0.8125rem' }} />
              <span className={styles.skel} style={{ inlineSize: '4rem', blockSize: '0.8125rem' }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
