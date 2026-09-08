import { useRef } from 'react'

export function VSplit({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number
  min: number
  max: number
  onChange: (next: number) => void
  label: string
}) {
  const start = useRef({ x: 0, width: value })

  return (
    <div
      className="vsplit"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          onChange(Math.max(min, value - 16))
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          onChange(Math.min(max, value + 16))
        }
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        start.current = { x: e.clientX, width: value }
        e.currentTarget.setPointerCapture(e.pointerId)
        document.documentElement.dataset.resizing = '1'
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
        const next = start.current.width + (e.clientX - start.current.x)
        onChange(Math.min(max, Math.max(min, Math.round(next))))
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId)
        delete document.documentElement.dataset.resizing
      }}
      onPointerCancel={() => {
        delete document.documentElement.dataset.resizing
      }}
    />
  )
}
