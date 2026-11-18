"use client"

export {
  motion,
  AnimatePresence,
  useSpring,
  useTransform,
  useMotionValue,
  useReducedMotion,
  MotionConfig,
  type Transition,
  type Variants,
} from "motion/react"

/** Shared duration / easing tokens mirrored from globals.css motion vars. */
export const motionTokens = {
  fast: 0.15,
  base: 0.2,
  slow: 0.5,
  ease: [0.2, 0, 0, 1] as const,
  /** House reveal curve — ReUI `cubic-bezier(0.22, 1, 0.36, 1)`. */
  springEase: [0.22, 1, 0.36, 1] as const,
} as const

/**
 * Width / height springs (dock rail). Bounce 0; reduced-motion callers
 * should swap this for `{ duration: 0 }`.
 */
export const layoutSpring = {
  type: "spring",
  visualDuration: 0.25,
  bounce: 0,
} as const

/** Thread swap and launcher inner fade. Exit stays ≤150ms. */
export const fadeSwap = {
  duration: motionTokens.fast,
  ease: motionTokens.springEase,
} as const

/**
 * Corner launcher: the window scales from bottom-right. Do not use
 * layout size morph — that squashes the thread into the chip.
 */
export const cornerPop = {
  duration: 0.22,
  ease: motionTokens.springEase,
} as const

export const cornerPanelVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0 },
} as const

export const cornerFabVariants = {
  hidden: { opacity: 0, scale: 0.82 },
  visible: { opacity: 1, scale: 1 },
} as const

export const fadeOnlyVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
} as const

/** Overlay backdrop fade. */
export const overlayBackdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
} as const

/** Centered dialog / confirm panel. */
export const overlayPanelVariants = {
  hidden: { opacity: 0, scale: 0.97, y: -4 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: -2 },
} as const

/** Default transition for overlay enter/exit. */
export const overlayTransition = {
  duration: motionTokens.base,
  ease: motionTokens.ease,
} as const
