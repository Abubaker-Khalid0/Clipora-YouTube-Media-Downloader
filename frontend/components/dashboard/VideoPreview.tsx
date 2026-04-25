'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { Play, Clock, User as UserIcon } from 'lucide-react'

interface VideoPreviewProps {
  videoId?: string
  thumbnailUrl: string | null
  title: string
  channelName: string
  duration: string
  durationSeconds?: number
  isLoading?: boolean
  trimEnabled?: boolean
  trimStart?: number
  trimEnd?: number
}

export function VideoPreview({ 
  thumbnailUrl, 
  title, 
  channelName, 
  duration,
  isLoading = false 
}: VideoPreviewProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl aspect-video overflow-hidden relative bg-slate-100">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 animate-[shimmer_2s_infinite]" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-2xl overflow-hidden aspect-video bg-slate-900 relative group shadow-2xl shadow-slate-300/40 ring-1 ring-black/5"
    >
      {/* Thumbnail */}
      {thumbnailUrl ? (
        <Image
          src={thumbnailUrl}
          alt={title}
          fill
          unoptimized
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-slate-800" />
      )}

      {/* Play button overlay — hidden by default, visible on hover */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
        <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/20 transform scale-90 group-hover:scale-100 transition-transform duration-300">
          <Play className="w-7 h-7 text-white ml-1" fill="white" />
        </div>
      </div>

      {/* Bottom gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Metadata overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <h3 className="font-bold text-white text-base mb-2.5 line-clamp-2 leading-snug drop-shadow-sm">
          {title}
        </h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-white/75">
            <UserIcon className="w-3.5 h-3.5" />
            {channelName}
          </span>
          <span className="flex items-center gap-1.5 text-white/75">
            <Clock className="w-3.5 h-3.5" />
            {duration}
          </span>
        </div>
      </div>

      {/* Duration badge */}
      <div className="absolute top-3 right-3">
        <span className="bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-lg">
          {duration}
        </span>
      </div>
    </motion.div>
  )
}
