'use client'

/**
 * HeroParallax — rows of project cards that drift at different rates as the
 * page scrolls, with the headline resolving over them.
 *
 * Adapted from the Aceternity original. What changed and why:
 *  - No 3D rotateX/perspective tilt. The cards are real project covers; tilting
 *    them makes the artwork unreadable, which defeats "projects are the focus".
 *  - Rows translate on X only, and the sheet lifts on Y. Both are transforms,
 *    so nothing triggers layout.
 *  - `useReducedMotion` short-circuits every spring to a static end state, so a
 *    reduced-motion visitor gets the finished composition with no movement.
 *  - Springs are stiff and lightly damped (stiffness 240, damping 40) so the
 *    drift settles quickly rather than floating, which is what makes the
 *    original read as a demo.
 */

import { useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from 'motion/react'

export interface ParallaxProject {
  slug: string
  title: string
  ask: string
  cover: string
  grit: number
}

export interface HeroParallaxProps {
  projects: readonly ParallaxProject[]
  children: React.ReactNode
}

export function HeroParallax({ projects, children }: HeroParallaxProps) {
  const rows = [projects.slice(0, 5), projects.slice(5, 10), projects.slice(10, 15)]
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const spring = { stiffness: 240, damping: 40, bounce: 0 }

  const xL = useSpring(useTransform(scrollYProgress, [0, 1], [0, 420]), spring)
  const xR = useSpring(useTransform(scrollYProgress, [0, 1], [0, -420]), spring)
  const lift = useSpring(useTransform(scrollYProgress, [0, 0.25], [40, 0]), spring)
  const fade = useSpring(useTransform(scrollYProgress, [0, 0.22], [0.35, 1]), spring)

  return (
    <div
      ref={ref}
      className="relative flex h-[190vh] flex-col self-auto overflow-hidden py-24 antialiased"
    >
      <div className="pad-inline relative z-10">{children}</div>

      <motion.div
        aria-hidden={reduced ? undefined : 'false'}
        style={reduced ? undefined : { y: lift, opacity: fade }}
        className="mt-24"
      >
        <Row projects={rows[0] ?? []} x={reduced ? null : xL} />
        <Row projects={rows[1] ?? []} x={reduced ? null : xR} reverse />
        <Row projects={rows[2] ?? []} x={reduced ? null : xL} />
      </motion.div>
    </div>
  )
}

function Row({
  projects,
  x,
  reverse = false,
}: {
  projects: readonly ParallaxProject[]
  x: MotionValue<number> | null
  reverse?: boolean
}) {
  if (projects.length === 0) return null
  return (
    <motion.div
      style={x ? { x } : undefined}
      className={`mb-6 flex gap-6 ${reverse ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {projects.map((p) => (
        <Card key={p.slug} project={p} />
      ))}
    </motion.div>
  )
}

function Card({ project }: { project: ParallaxProject }) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
      className="group/card relative h-[16rem] w-[22rem] flex-none"
    >
      <Link
        href={`/p/${project.slug}`}
        className="block h-full rounded-xs border border-rule-2 bg-paper-hi p-3 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink"
      >
        <div className="relative h-[9.5rem] overflow-hidden rounded-xs bg-paper-sub">
          <Image
            src={project.cover}
            alt=""
            fill
            sizes="22rem"
            className="object-cover"
          />
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <span className="text-md text-ink">{project.title}</span>
          <span className="text-2xs tnum text-ink-3">{project.grit}</span>
        </div>
        <p className="voice mt-1 line-clamp-2 text-sm">{project.ask}</p>
      </Link>
    </motion.div>
  )
}
