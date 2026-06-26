import { useCallback, useEffect, useRef, useState } from 'react'
import { buildDistortionFrames } from '../../logic/distortion'
import type { Album } from '../../model/types'

const K = 20
const MIN_DELAY_MS = 25
const MAX_DELAY_MS = 220

// Cosine-eased delay: fast at step 0, slow at step K-1.
function frameDelay(step: number): number {
  const t = step / (K - 1)
  return MIN_DELAY_MS + (MAX_DELAY_MS - MIN_DELAY_MS) * (1 - Math.cos(Math.PI * t)) / 2
}

export interface DrawAnimationState {
  displayTitle: string
  isAnimating: boolean
}

export function useDrawAnimation(): {
  animState: DrawAnimationState
  startAnimation: (drawn: Album, topK: Album[]) => void
} {
  const [animState, setAnimState] = useState<DrawAnimationState>({
    displayTitle: '',
    isAnimating: false,
  })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startAnimation = useCallback((drawn: Album, topK: Album[]) => {
    if (timerRef.current) clearTimeout(timerRef.current)

    // Donor titles: all topK albums except the drawn one, used as distortion source
    const donorTitles = topK.map(a => a.name)
    const frames = buildDistortionFrames(drawn.name, donorTitles, K)
    // frames[0] = original, frames[K-1] = most distorted
    // We show frames in reverse: K-1 → 0, revealing the drawn album

    let playStep = 0 // how many frames we've displayed so far

    function tick() {
      if (playStep >= K) {
        setAnimState({ displayTitle: drawn.name, isAnimating: false })
        return
      }
      const frameIdx = K - 1 - playStep
      const words = frames[frameIdx].filter(Boolean)
      setAnimState({ displayTitle: words.join(' ') || drawn.name, isAnimating: playStep < K - 1 })
      timerRef.current = setTimeout(tick, frameDelay(playStep))
      playStep++
    }

    tick()
  }, [])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return { animState, startAnimation }
}
