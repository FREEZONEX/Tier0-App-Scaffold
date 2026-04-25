"use client"

import { useEffect, useRef } from "react"
import { useSpring, useTransform } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface AnimatedNumberProps {
  value: number
  format?: (n: number) => string
  className?: string
}

const defaultFormat = (n: number) =>
  Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function AnimatedNumber({ value, format = defaultFormat, className }: AnimatedNumberProps) {
  const spring = useSpring(0, { stiffness: 80, damping: 20 })
  const display = useTransform(spring, (v) => format(v))
  const ref = useRef<HTMLSpanElement>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      spring.jump(value)
      initialized.current = true
    } else {
      spring.set(value)
    }
  }, [value, spring])

  useEffect(() => {
    const unsubscribe = display.on("change", (v) => {
      if (ref.current) ref.current.textContent = v
    })
    return unsubscribe
  }, [display])

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {format(value)}
    </span>
  )
}
