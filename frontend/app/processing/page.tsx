'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Copy, AlertCircle } from 'lucide-react'
import SparkleSpinner from '../components/SparkleSpinner'

const C = {
  bg: '#0D0B0A',
  surface: '#161310',
  border: '#2A2520',
  gold: '#D4A96A',
  goldDim: '#9A7A4A',
  text: '#F5F0E8',
  muted: '#7A6E64',
  muted2: '#4A4440'
}

const STEPS = ['Analyzing video', 'Building ballet context', 'Generating subtitles']

function ProcessingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const jobId = searchParams.get('job_id') || ''

  const [progress, setProgress] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [status, setStatus] = useState('queued')

  // Smooth fake progress up to 95%
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 95) {
          clearInterval(interval)
          return 95
        }
        return p + 1
      })
    }, 150)
    return () => clearInterval(interval)
  }, [])

  // Poll API for job status
  useEffect(() => {
    if (!jobId) return

    let pollInterval: NodeJS.Timeout

    const checkJob = async () => {
      try {
        const res = await fetch(`/api/job/${jobId}`)
        if (!res.ok) throw new Error('Failed to fetch job status')
        const data = await res.json()
        
        setStatus(data.status)
        
        if (data.status === 'processing') {
          setStepIndex(1)
        } else if (data.status === 'done' && data.subtitle_track) {
          setProgress(100)
          setStepIndex(3)
          clearInterval(pollInterval)
          localStorage.setItem(`subtitles_${data.subtitle_track.video_id}`, JSON.stringify(data.subtitle_track))
          // Redirect after a brief delay so they see 100%
          setTimeout(() => {
            router.push(`/results?video_id=${data.subtitle_track.video_id}&job_id=${jobId}`)
          }, 800)
        } else if (data.status === 'failed') {
          clearInterval(pollInterval)
          setErrorMsg(data.error || 'Job processing failed')
        }
      } catch (err: any) {
        console.error(err)
      }
    }

    // Run first check immediately
    checkJob()
    
    pollInterval = setInterval(checkJob, 3000)
    return () => clearInterval(pollInterval)
  }, [jobId, router])

  const r = 55
  const circ = 2 * Math.PI * r
  const offset = circ - (progress / 100) * circ

  const copy = () => {
    navigator.clipboard.writeText(jobId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 480 }}>
      {/* Loading Spinner */}
      <div style={{ marginBottom: 16, filter: 'drop-shadow(0 0 6px rgba(212,169,106,0.6))' }}>
        <SparkleSpinner size={36} color="#D4A96A" />
      </div>

      <h2 style={{
        fontFamily: 'Cinzel, Cormorant Garamond, Georgia, serif',
        fontSize: 32, fontWeight: 300, color: C.text, marginBottom: 8, textAlign: 'center'
      }}>
        {status === 'failed' ? 'Processing Failed' : 'Processing Your Video'}
      </h2>

      <p style={{ fontSize: 13, color: C.muted, marginBottom: 48, textAlign: 'center' }}>
        {status === 'failed' ? 'An error occurred during subtitle generation.' : 'This may take a few moments'}
      </p>

      {status === 'failed' ? (
        <div style={{
          width: '100%', padding: 16, borderRadius: 8,
          backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444', fontSize: 13, marginBottom: 32, textAlign: 'center'
        }}>
          <AlertCircle size={20} style={{ margin: '0 auto 8px' }} />
          <p style={{ margin: '4px 0 12px 0' }}>{errorMsg}</p>
          <button onClick={() => router.push('/')} style={{
            display: 'block', margin: '16px auto 0', padding: '8px 16px',
            backgroundColor: '#ef4444', color: '#fff', border: 'none',
            borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12
          }}>
            Back to Home
          </button>
        </div>
      ) : (
        <>
          {/* Progress Ring */}
          <div style={{ position: 'relative', width: 160, height: 160, marginBottom: 48 }}>
            <div style={{
              position: 'absolute', inset: -30, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(212,169,106,0.12) 0%, transparent 70%)',
              filter: 'blur(12px)', pointerEvents: 'none', zIndex: 0,
            }} />
            <svg width="160" height="160" viewBox="0 0 160 160" style={{ position: 'relative', zIndex: 1 }}>
              <circle cx="80" cy="80" r={r} fill="none" stroke={C.border} strokeWidth="4" />
              <circle
                cx="80" cy="80" r={r} fill="none"
                stroke={C.gold} strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                transform="rotate(-90 80 80)"
                style={{
                  transition: 'stroke-dashoffset 0.25s ease',
                  filter: 'drop-shadow(0 0 8px rgba(212,169,106,0.7))',
                }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', zIndex: 2,
            }}>
              <span style={{
                fontFamily: 'Cinzel, Cormorant Garamond, Georgia, serif',
                fontSize: 34, fontWeight: 300, color: C.gold, lineHeight: 1,
              }}>{progress}%</span>
              <span style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                {status === 'queued' ? 'Queued...' : 'Processing...'}
              </span>
            </div>
          </div>

          {/* Steps */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 48 }}>
            {STEPS.map((label, i) => {
              const done = stepIndex > i
              const active = stepIndex === i
              const pending = stepIndex < i
              return (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 8,
                  backgroundColor: active ? C.surface : 'transparent',
                  border: `1px solid ${active ? C.border : 'transparent'}`,
                  transition: 'all 0.3s',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: done ? C.gold : 'transparent',
                    border: pending ? `1.5px solid ${C.muted2}` : done ? 'none' : active ? 'none' : `1.5px solid ${C.goldDim}`,
                  }}>
                    {done && <Check size={13} color="#1a1510" strokeWidth={3} />}
                    {active && <SparkleSpinner size={22} color="#D4A96A" />}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: pending ? C.muted2 : C.text, marginBottom: 2 }}>{label}</p>
                    <p style={{ fontSize: 11, color: done ? C.gold : active ? C.muted : C.muted2 }}>
                      {done ? 'Completed' : active ? 'In progress...' : 'Pending'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Job ID */}
          {jobId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontFamily: 'JetBrains Mono, Courier New, monospace',
                fontSize: 12, color: C.muted,
              }}>Job ID: {jobId}</span>
              <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                {copied
                  ? <Check size={13} color={C.gold} />
                  : <Copy size={13} color={C.muted} />}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function ProcessingPage() {
  return (
    <main style={{
      backgroundColor: C.bg, minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 16px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <Suspense fallback={<SparkleSpinner size={36} color="#D4A96A" />}>
        <ProcessingContent />
      </Suspense>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}
