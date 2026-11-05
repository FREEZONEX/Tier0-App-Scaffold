"use client"

export {
  motion,
  AnimatePresence,
  useSpring,
  useTransform,
  useMotionValue,
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
