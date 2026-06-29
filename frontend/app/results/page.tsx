'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, ChevronDown, ChevronUp, Play, Volume2, Download, ArrowLeft, Pause } from 'lucide-react'
import SparkleSpinner from '../components/SparkleSpinner'

const C = {
  bg: '#0D0B0A', surface: '#161310', surface2: '#1C1916',
  border: '#2A2520', gold: '#D4A96A', goldDim: '#9A7A4A',
  cream: '#E8D9B8', text: '#F5F0E8', muted: '#7A6E64', muted2: '#4A4440',
}

const TAG: Record<string, { bg: string; color: string }> = {
  PANTOMIME: { bg: '#3D2B1A', color: '#D4A96A' },
  EMOTION:   { bg: '#1A1F3D', color: '#7A9BD4' },
  NARRATIVE: { bg: '#1A2D1F', color: '#6DBF8A' },
}

function extractYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11) ? match[2] : null
}

function formatTime(ms: number) {
  const totalSecs = Math.floor(ms / 1000)
  const hrs = Math.floor(totalSecs / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)
  const secs = totalSecs % 60
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
}

function ResultsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const videoId = searchParams.get('video_id') || ''
  const jobId = searchParams.get('job_id') || ''

  const [track, setTrack] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [contextOpen, setContextOpen] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentTimeMs, setCurrentTimeMs] = useState(0)

  // Refs — must be declared before any early returns
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const ytPlayerRef = useRef<any>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!videoId) {
      setErrorMsg('No video ID provided')
      setLoading(false)
      return
    }

    const loadSubtitles = async () => {
      try {
        const localData = localStorage.getItem(`subtitles_${videoId}`)
        if (localData) {
          setTrack(JSON.parse(localData))
          setLoading(false)
          return
        }

        const res = await fetch(`/api/subtitles/${videoId}`)
        if (!res.ok) throw new Error('Failed to load subtitles')
        const data = await res.json()
        setTrack(data)
        localStorage.setItem(`subtitles_${videoId}`, JSON.stringify(data))
      } catch (err: any) {
        setErrorMsg(err.message || 'Error loading subtitles')
      } finally {
        setLoading(false)
      }
    }

    loadSubtitles()
  }, [videoId])

  const youtubeIdForEffect = track?.source_url ? extractYouTubeId(track.source_url) : null

  // Load YouTube IFrame API and create player once we know the youtubeId
  useEffect(() => {
    if (!youtubeIdForEffect || !playerContainerRef.current) return

    const initPlayer = () => {
      if (ytPlayerRef.current) ytPlayerRef.current.destroy()
      ytPlayerRef.current = new (window as any).YT.Player(playerContainerRef.current, {
        videoId: youtubeIdForEffect,
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e: any) => {
            const YT = (window as any).YT
            if (e.data === YT.PlayerState.PLAYING) {
              setPlaying(true)
              pollRef.current = setInterval(() => {
                const t = ytPlayerRef.current?.getCurrentTime?.()
                if (typeof t === 'number') setCurrentTimeMs(Math.floor(t * 1000))
              }, 250)
            } else {
              setPlaying(false)
              if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
            }
          },
        },
      })
    }

    if ((window as any).YT?.Player) {
      initPlayer()
    } else {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
      ;(window as any).onYouTubeIframeAPIReady = initPlayer
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      ytPlayerRef.current?.destroy()
      ytPlayerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeIdForEffect])

  const downloadSRT = () => {
    if (!track) return
    let srt = ''
    track.cues.forEach((cue: any, index: number) => {
      const formatSRTTime = (ms: number) => {
        const totalSecs = Math.floor(ms / 1000)
        const hrs = Math.floor(totalSecs / 3600)
        const mins = Math.floor((totalSecs % 3600) / 60)
        const secs = totalSecs % 60
        const millis = ms % 1000
        const pad = (num: number, len = 2) => String(num).padStart(len, '0')
        return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(millis, 3)}`
      }
      srt += `${index + 1}\n`
      srt += `${formatSRTTime(cue.start_ms)} --> ${formatSRTTime(cue.end_ms)}\n`
      const gesture = cue.gesture_type ? cue.gesture_type.toUpperCase() : 'NARRATIVE'
      srt += `[${gesture}] ${cue.text}\n\n`
    })

    const blob = new Blob([srt], { type: 'text/srt' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${track.title || 'subtitles'}.srt`
    a.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  const downloadJSON = () => {
    if (!track) return
    const blob = new Blob([JSON.stringify(track, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${track.title || 'subtitles'}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  const togglePlay = useCallback(() => {
    if (youtubeIdForEffect) {
      const player = ytPlayerRef.current
      if (!player) return
      if (playing) player.pauseVideo()
      else player.playVideo()
    } else if (videoRef.current) {
      if (playing) videoRef.current.pause()
      else videoRef.current.play()
    }
  }, [playing, youtubeIdForEffect])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <SparkleSpinner size={48} color="#D4A96A" />
        <p style={{ marginTop: 16, color: C.muted, fontSize: 14 }}>Loading subtitles...</p>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', padding: 24, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', textAlign: 'center' }}>
        <p>{errorMsg}</p>
        <button onClick={() => router.push('/')} style={{ marginTop: 16, padding: '8px 16px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Back to Home
        </button>
      </div>
    )
  }

  const cues = track?.cues || []
  const youtubeId = track?.source_url ? extractYouTubeId(track.source_url) : null

  // Auto-advance active subtitle row based on video time
  const activeRow = (() => {
    if (cues.length === 0) return 0
    const idx = cues.findLastIndex((c: any) => currentTimeMs >= c.start_ms)
    return idx >= 0 ? idx : 0
  })()

  const currentCue = cues[activeRow] || { text: '' }
  const setting = track?.ballet_context?.setting || 'N/A'
  const tone = track?.ballet_context?.tone || 'N/A'
  const characters = track?.ballet_context?.characters?.map((c: any) => c.name).join(', ') || 'N/A'
  const duration = cues.length > 0 ? formatTime(cues[cues.length - 1].end_ms) : '00:00:00'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px 48px' }}>
      {/* Back button */}
      <button onClick={() => router.push('/')} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12, color: C.muted, background: 'none', border: 'none',
        cursor: 'pointer', marginBottom: 24, fontFamily: 'inherit',
      }}>
        <ArrowLeft size={13} /> New video
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => setContextOpen(o => !o)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 500, color: C.text,
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <BookOpen size={15} color={C.gold} />
          Ballet Context
          {contextOpen ? <ChevronUp size={14} color={C.muted} /> : <ChevronDown size={14} color={C.muted} />}
        </button>

        {/* Export */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setExportOpen(o => !o)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 14px', borderRadius: 7,
            backgroundColor: C.surface, border: `1px solid ${C.border}`,
            color: C.text, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <Download size={13} /> Export <ChevronDown size={12} color={C.muted} />
          </button>
          {exportOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 4px)',
              backgroundColor: C.surface2, border: `1px solid ${C.border}`,
              borderRadius: 7, overflow: 'hidden', zIndex: 50, width: 148,
            }}>
              <button onClick={downloadSRT} style={{
                width: '100%', textAlign: 'left', padding: '11px 14px',
                fontSize: 13, color: C.text, background: 'none',
                border: 'none', borderBottom: `1px solid ${C.border}`,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Export as SRT
              </button>
              <button onClick={downloadJSON} style={{
                width: '100%', textAlign: 'left', padding: '11px 14px',
                fontSize: 13, color: C.text, background: 'none',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Export as JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      {contextOpen && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
          padding: '16px 20px', borderRadius: 8, marginBottom: 16,
          backgroundColor: C.surface, border: `1px solid ${C.border}`,
        }}>
          {[
            { label: 'Title', value: track?.title || 'Untitled Performance' },
            { label: 'Setting', value: setting },
            { label: 'Tone', value: tone },
            { label: 'Characters', value: characters },
          ].map(({ label, value }) => (
            <div key={label}>
              <p style={{ fontSize: 11, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
              <p style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Video Player */}
      <div style={{
        borderRadius: 10, overflow: 'hidden', marginBottom: 12,
        border: `1px solid ${C.border}`, backgroundColor: '#090807',
      }}>
        {/* Video area */}
        <div style={{
          position: 'relative', height: 360,
          background: 'linear-gradient(160deg, #0D1520 0%, #090807 55%, #10080C 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {youtubeId ? (
            <div
              ref={playerContainerRef}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
          ) : jobId ? (
            <video
              ref={videoRef}
              src={`/api/video/${jobId}`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
              controls
              onTimeUpdate={() => {
                const v = videoRef.current
                if (v) setCurrentTimeMs(Math.floor(v.currentTime * 1000))
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          ) : (
            <svg width="70" height="100" viewBox="0 0 70 100" fill="none" style={{ opacity: 0.15 }}>
              <circle cx="35" cy="9" r="8" fill={C.gold} />
              <line x1="35" y1="17" x2="35" y2="50" stroke={C.gold} strokeWidth="2.5"/>
              <line x1="35" y1="30" x2="12" y2="20" stroke={C.gold} strokeWidth="2.5"/>
              <line x1="35" y1="30" x2="60" y2="18" stroke={C.gold} strokeWidth="2.5"/>
              <line x1="35" y1="50" x2="18" y2="80" stroke={C.gold} strokeWidth="2.5"/>
              <line x1="35" y1="50" x2="52" y2="80" stroke={C.gold} strokeWidth="2.5"/>
              <line x1="18" y1="80" x2="6" y2="68" stroke={C.gold} strokeWidth="2"/>
              <line x1="52" y1="80" x2="66" y2="92" stroke={C.gold} strokeWidth="2"/>
            </svg>
          )}

          {/* Subtitle overlay */}
          {currentCue.text && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '64px 32px 16px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.82))',
              textAlign: 'center',
              zIndex: 10,
              pointerEvents: 'none',
            }}>
              <p style={{
                fontFamily: 'Cormorant Garamond, Georgia, serif',
                fontSize: 20, fontWeight: 400, fontStyle: 'italic',
                color: C.text, textShadow: '0 2px 12px rgba(0,0,0,0.9)',
                lineHeight: 1.4, margin: 0,
              }}>
                {currentCue.text}
              </p>
            </div>
          )}
        </div>

        {/* Controls — only shown when no YouTube iframe (YouTube has its own controls) */}
        {!youtubeId && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px', borderTop: `1px solid ${C.border}`,
            backgroundColor: C.surface,
          }}>
            <button onClick={togglePlay} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              {playing ? <Pause size={16} fill={C.text} color={C.text} /> : <Play size={16} fill={C.text} color={C.text} />}
            </button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Volume2 size={15} color={C.text} />
            </button>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.muted, flexShrink: 0 }}>
              {cues.length > 0 ? formatTime(cues[activeRow].start_ms) : '00:00:00'}
            </span>

            {/* Scrubber */}
            <div style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: C.border, position: 'relative', cursor: 'pointer' }}>
              <div style={{
                width: cues.length > 0 ? `${((activeRow + 1) / cues.length) * 100}%` : '0%',
                height: '100%', borderRadius: 2, backgroundColor: C.gold
              }} />
            </div>

            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.muted, flexShrink: 0 }}>
              {duration}
            </span>
          </div>
        )}
      </div>

      {/* Subtitles list */}
      <div style={{
        borderRadius: 10, overflow: 'hidden',
        border: `1px solid ${C.border}`, backgroundColor: C.surface
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '100px 120px 1fr', gap: 12,
          padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
          backgroundColor: '#120F0D',
        }}>
          {['TIME', 'TYPE', 'TRANSCRIPT'].map(h => (
            <span key={h} style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, letterSpacing: '0.08em' }}>{h}</span>
          ))}
        </div>

        {/* Table Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 280, overflowY: 'auto' }}>
          {cues.map((sub: any, i: number) => {
            const tag = (sub.gesture_type || 'NARRATIVE').toUpperCase()
            const tagStyle = TAG[tag] || { bg: '#2A2520', color: C.muted }
            return (
              <div key={i} onClick={() => {
                const seekSecs = sub.start_ms / 1000
                if (ytPlayerRef.current?.seekTo) {
                  ytPlayerRef.current.seekTo(seekSecs, true)
                } else if (videoRef.current) {
                  videoRef.current.currentTime = seekSecs
                }
                setCurrentTimeMs(sub.start_ms)
              }}
                style={{
                  display: 'grid', gridTemplateColumns: '100px 120px 1fr', gap: 12,
                  padding: '12px 16px', cursor: 'pointer',
                  backgroundColor: activeRow === i ? C.surface2 : i % 2 === 0 ? C.surface : 'transparent',
                  borderBottom: i < cues.length - 1 ? `1px solid ${C.border}` : 'none',
                  transition: 'background-color 0.15s',
                }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: activeRow === i ? C.gold : C.muted }}>
                  {formatTime(sub.start_ms)}
                </span>
                <div>
                  <span style={{
                    display: 'inline-block', fontSize: 9.5, fontWeight: 700,
                    letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 4,
                    backgroundColor: tagStyle.bg, color: tagStyle.color,
                  }}>{tag}</span>
                </div>
                <span style={{ fontSize: 13, color: activeRow === i ? C.text : 'rgba(245,240,232,0.65)', lineHeight: 1.4 }}>
                  {sub.text}
                </span>
              </div>
            )
          })}
          {cues.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 13 }}>
              No subtitles generated.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <main style={{
      backgroundColor: C.bg, minHeight: '100vh',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '0',
    }}>
      <Suspense fallback={
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <SparkleSpinner size={48} color="#D4A96A" />
        </div>
      }>
        <ResultsContent />
      </Suspense>
    </main>
  )
}
