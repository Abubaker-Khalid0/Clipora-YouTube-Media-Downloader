'use client'

import { type CSSProperties } from 'react'

/**
 * MaterialIcon — A wrapper for Google Material Symbols (Outlined).
 *
 * Usage:
 *   <MaterialIcon name="download" />
 *   <MaterialIcon name="content_cut" size={20} className="text-red-500" />
 *   <MaterialIcon name="search" filled />
 *
 * Icon names: https://fonts.google.com/icons
 */

interface MaterialIconProps {
  /** Material Symbol name (e.g. "download", "search", "content_cut") */
  name: string
  /** Size in pixels. Default: 20 */
  size?: number
  /** Whether to use filled variant. Default: false */
  filled?: boolean
  /** Font weight (100-700). Default: 400 */
  weight?: number
  /** Additional CSS classes */
  className?: string
  /** aria-hidden for decorative icons. Default: true */
  ariaHidden?: boolean
}

export function MaterialIcon({
  name,
  size = 20,
  filled = false,
  weight = 400,
  className = '',
  ariaHidden = true,
}: MaterialIconProps) {
  const style: CSSProperties = {
    fontSize: `${size}px`,
    fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}`,
    lineHeight: 1,
    width: `${size}px`,
    height: `${size}px`,
  }

  return (
    <span
      className={`material-symbols-outlined inline-flex items-center justify-center select-none ${className}`}
      style={style}
      aria-hidden={ariaHidden}
    >
      {name}
    </span>
  )
}
