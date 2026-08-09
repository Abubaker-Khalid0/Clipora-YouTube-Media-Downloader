/**
 * showcaseVideos.ts — real video metadata for the landing-page product mock.
 *
 * Every field here was produced by running the link through the app's own
 * /api/analyze endpoint, so the titles, channels, durations and quality lists
 * are the same values a visitor would actually see. Nothing is invented.
 *
 * Thumbnails are loaded from i.ytimg.com, which is already allow-listed in
 * next.config.ts, so the mock shows the real frame rather than a fake gradient.
 *
 * To swap the set, re-run the analyzer for the new links and replace this array.
 */

export interface ShowcaseVideo {
  videoId: string
  title: string
  channel: string
  /** Human-readable length, e.g. "3:33". */
  duration: string
  /** Highest four resolutions the source actually publishes. */
  qualities: string[]
  /** Best audio stream label, e.g. "m4a/mp4a · 129kbps". */
  audio: string
}

export const SHOWCASE_VIDEOS: ShowcaseVideo[] = [
  {
    videoId: 'dQw4w9WgXcQ',
    title: 'Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)',
    channel: 'Rick Astley',
    duration: '3:33',
    qualities: ['2160p', '1440p', '1080p', '720p'],
    audio: 'm4a/mp4a · 129kbps',
  },
  {
    videoId: 'YQLmlNU2fAs',
    title: 'شبكات | أول محاولة من الذكاء الاصطناعي لخداع البشر!',
    channel: 'AlJazeera Arabic قناة الجزيرة',
    duration: '3:36',
    qualities: ['1080p', '720p', '480p', '360p'],
    audio: 'm4a/mp4a · 129kbps',
  },
  {
    videoId: 'aircAruvnKk',
    title: 'But what is a neural network? | Deep learning chapter 1',
    channel: '3Blue1Brown',
    duration: '18:40',
    qualities: ['1080p', '720p', '480p', '360p'],
    audio: 'webm/opus · 134kbps',
  },
  {
    videoId: 'jNQXAC9IVRw',
    title: 'Me at the zoo',
    channel: 'jawed',
    duration: '0:19',
    qualities: ['240p', '144p'],
    audio: 'm4a/mp4a · 129kbps',
  },
]

/** Thumbnail URL for a showcase entry. hqdefault exists for every video. */
export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}
