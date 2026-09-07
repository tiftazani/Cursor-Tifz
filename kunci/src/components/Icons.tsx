import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function glyph({ size = 18, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  }
}

export function IconKey(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <circle cx="8" cy="12" r="3.2" />
      <path d="M11 12h10m-3-3v6" />
    </svg>
  )
}

export function IconLock(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconStar(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6 6.9 19.2l1-5.7-4.1-4 5.7-.8z" />
    </svg>
  )
}

export function IconCopy(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5h10" />
    </svg>
  )
}

export function IconEye(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

export function IconEyeOff(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <path d="M3 3l18 18M10.5 10.6a2.5 2.5 0 0 0 3 3M9.9 5.1A11 11 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-4.2 4.6M6.1 6.6A18 18 0 0 0 2 12s4 7 10 7c1.2 0 2.3-.2 3.4-.6" />
    </svg>
  )
}

export function IconGlobe(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  )
}

export function IconApp(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function IconNote(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <path d="M7 4h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M14 4v5h5M8 13h8M8 17h5" />
    </svg>
  )
}

export function IconShield(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <path d="M12 3l8 3v6c0 5-3.4 8.4-8 9.5C7.4 20.4 4 17 4 12V6l8-3z" />
    </svg>
  )
}

export function IconClock(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function IconDownload(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <path d="M12 4v12m0 0l-4-4m4 4l4-4M5 19h14" />
    </svg>
  )
}

export function IconSpark(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3.5 3.5M14.5 14.5L18 18M18 6l-3.5 3.5M9.5 14.5L6 18" />
    </svg>
  )
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7 1 1.1 1.7 1.1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

export function IconFill(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <path d="M4 19h16M8 19V8l4-4 4 4v11" />
      <path d="M10 12h4" />
    </svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />
    </svg>
  )
}

export function IconOtp(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <path d="M5 12l5 5 9-9" />
    </svg>
  )
}

export function IconChevronLeft(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

export function IconMore(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconShare(props: IconProps) {
  return (
    <svg {...glyph(props)}>
      <path d="M12 4v10" />
      <path d="M8 8l4-4 4 4" />
      <path d="M6 13v6h12v-6" />
    </svg>
  )
}
