'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Link2, Upload, Sparkles, Shield, CloudUpload } from 'lucide-react'
import Stage from './components/Stage'

const C = {
  bg: '#0D0B0A', surface: '#161310', surface2: '#1C1916',
  border: '#2A2520', gold: '#D4A96A', goldDim: '#9A7A4A',
  cream: '#E8D9B8', text: '#F5F0E8', muted: '#7A6E64', muted2: '#4A4440',
}

export default function LandingPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'url' | 'file'>('url')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const formData = new FormData()
      if (title.trim()) {
        formData.append('title', title.trim())
      }
      
      if (activeTab === 'url') {
        if (!url.trim()) {
          setErrorMsg('Please enter a YouTube URL')
          setLoading(false)
          return
        }
        let targetUrl = url.trim()
        if (targetUrl.includes('/shorts/')) {
          const parts = targetUrl.split('/shorts/')
          const videoId = parts[parts.length - 1].split(/[?#]/)[0]
          if (videoId.length === 11) {
            targetUrl = `https://www.youtube.com/watch?v=${videoId}`
          }
        }
        formData.append('video_url', targetUrl)
      } else {
        const file = fileRef.current?.files?.[0]
        if (!file) {
          setErrorMsg('Please select a video file')
          setLoading(false)
          return
        }
        formData.append('file', file)
      }

      const res = await fetch('/api/analyse', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to submit video')
      }

      const data = await res.json()
      if (data.status === 'cached' && data.subtitle_track) {
        localStorage.setItem(`subtitles_${data.subtitle_track.video_id}`, JSON.stringify(data.subtitle_track))
        router.push(`/results?video_id=${data.subtitle_track.video_id}`)
      } else if (data.job_id) {
        router.push(`/processing?job_id=${data.job_id}`)
      } else {
        throw new Error('No job ID returned')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Stage>
      <div className="card">
        {/* ── Logo ── */}
        <div className="brand">
          <img
            src="/assets/ballet-dancer.png"
            alt="Motion Lore dancer"
            className="brand-icon"
          />
          <h1 className="brand-title">MOTION LORE</h1>
          <p className="brand-sub">AI‑POWERED BALLET SUBTITLE GENERATOR</p>
        </div>

        <p className="tagline">
          Upload a ballet video or paste a YouTube link<br />
          and we&apos;ll generate accurate, context‑aware subtitles.
        </p>

        {/* ── Tabs ── */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'url' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('url')}
          >
            <Link2 size={13} style={{ marginRight: 6 }} />
            YouTube URL
          </button>
          <button
            className={`tab ${activeTab === 'file' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('file')}
          >
            <Upload size={13} style={{ marginRight: 6 }} />
            Upload File
          </button>
        </div>

        <div className="input-area">
          {activeTab === 'url' ? (
            <div>
              <input
                type="url"
                className="url-input"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
              <div className="divider"><span>or</span></div>
              <DropZone
                dragging={dragging}
                fileName={fileName}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => {
                  e.preventDefault()
                  setDragging(false)
                  const f = e.dataTransfer.files[0]
                  if (f) {
                    setFileName(f.name)
                    if (fileRef.current) {
                      const dataTransfer = new DataTransfer()
                      dataTransfer.items.add(f)
                      fileRef.current.files = dataTransfer.files
                    }
                  }
                }}
                onClick={() => fileRef.current?.click()}
              />
            </div>
          ) : (
            <DropZone
              dragging={dragging}
              fileName={fileName}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault()
                setDragging(false)
                const f = e.dataTransfer.files[0]
                if (f) {
                  setFileName(f.name)
                  if (fileRef.current) {
                    const dataTransfer = new DataTransfer()
                    dataTransfer.items.add(f)
                    fileRef.current.files = dataTransfer.files
                  }
                }
              }}
              onClick={() => fileRef.current?.click()}
            />
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".mp4,.mov,.avi"
            style={{ display: 'none' }}
            onChange={e => setFileName(e.target.files?.[0]?.name || '')}
          />
        </div>

        {/* ── Title field ── */}
        <div className="field-group">
          <label className="field-label">TITLE (OPTIONAL)</label>
          <input
            type="text"
            className="url-input"
            placeholder="e.g. Swan Lake Act II"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <p className="field-hint">leave blank if unknown</p>
        </div>

        {/* ── Error message ── */}
        {errorMsg && (
          <div className="error-box">
            {errorMsg}
          </div>
        )}

        {/* ── CTA ── */}
        <button className="cta" onClick={handleSubmit} disabled={loading}>
          <Sparkles size={16} />
          {loading ? 'Submitting Video...' : 'Generate Subtitles'}
        </button>

        {/* ── Privacy note ── */}
        <p className="privacy">
          <Shield size={12} style={{ marginRight: 6 }} />
          Your data is private and never stored.
        </p>

      </div>

      <style jsx>{`
        /* ── Card shell ── */
        .card {
          width: 100%;
          max-width: 580px;
          background: rgba(10, 7, 5, 0.82);
          border: 1px solid rgba(201, 169, 110, 0.25);
          border-radius: 12px;
          padding: 2rem 2.25rem 1.75rem;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(201,169,110,0.12);
        }

        /* ── Brand block ── */
        .brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          margin-bottom: 0.75rem;
        }

        .brand-icon {
          width: 110px;
          height: 110px;
          object-fit: contain;
          filter: sepia(1) saturate(0.6) brightness(1.1);
        }

        .brand-title {
          font-family: 'Cinzel', 'Georgia', 'Times New Roman', serif;
          font-size: 2rem;
          font-weight: 300;
          letter-spacing: 0.25em;
          color: #C9A96E;
          margin: 0;
          line-height: 1;
        }

        .brand-sub {
          font-size: 0.6rem;
          letter-spacing: 0.2em;
          color: rgba(201, 169, 110, 0.6);
          margin: 0;
        }

        /* ── Tagline ── */
        .tagline {
          text-align: center;
          font-size: 0.875rem;
          color: rgba(240, 230, 200, 0.7);
          line-height: 1.6;
          margin: 0 0 1.5rem;
        }

        /* ── Tabs ── */
        .tabs {
          display: flex;
          border-bottom: 1px solid rgba(201, 169, 110, 0.15);
          margin-bottom: 1.25rem;
          gap: 0;
        }

        .tab {
          display: flex;
          align-items: center;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          padding: 0.5rem 1rem 0.75rem;
          font-size: 0.8125rem;
          color: rgba(240, 230, 200, 0.45);
          cursor: pointer;
          margin-bottom: -1px;
          transition: color 0.2s, border-color 0.2s;
          font-family: inherit;
        }

        .tab:hover {
          color: rgba(240, 230, 200, 0.8);
        }

        .tab--active {
          color: #C9A96E;
          border-bottom-color: #C9A96E;
        }

        /* ── Input area ── */
        .input-area {
          margin-bottom: 1.25rem;
        }

        .url-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(201, 169, 110, 0.2);
          border-radius: 6px;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: rgba(240, 230, 200, 0.9);
          outline: none;
          transition: border-color 0.2s, background 0.2s;
          box-sizing: border-box;
          font-family: inherit;
        }

        .url-input::placeholder {
          color: rgba(240, 230, 200, 0.25);
        }

        .url-input:focus {
          border-color: rgba(201, 169, 110, 0.55);
          background: rgba(255,255,255,0.06);
        }

        /* ── Divider ── */
        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0.75rem 0;
          color: rgba(240, 230, 200, 0.25);
          font-size: 0.75rem;
        }

        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(201, 169, 110, 0.12);
        }

        /* ── Title field ── */
        .field-group {
          margin-bottom: 1.25rem;
        }

        .field-label {
          display: block;
          font-size: 0.6rem;
          letter-spacing: 0.15em;
          color: rgba(201, 169, 110, 0.55);
          margin-bottom: 0.5rem;
        }

        .field-hint {
          margin: 0.35rem 0 0;
          font-size: 0.7rem;
          color: rgba(240, 230, 200, 0.25);
        }

        /* ── Error box ── */
        .error-box {
          color: #ef4444;
          background-color: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 10px 14px;
          border-radius: 7px;
          font-size: 13px;
          margin-bottom: 16px;
          text-align: center;
        }

        /* ── CTA button ── */
        .cta {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #C9A96E;
          color: #1a0f05;
          border: none;
          border-radius: 6px;
          padding: 0.875rem 1rem;
          font-size: 0.9375rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          margin-bottom: 1rem;
          font-family: inherit;
        }

        .cta:hover:not(:disabled) {
          background: #d9bc84;
        }

        .cta:active:not(:disabled) {
          transform: scale(0.985);
        }

        .cta:disabled {
          background: #4a4440;
          color: #7a6e64;
          cursor: not-allowed;
        }

        /* ── Privacy ── */
        .privacy {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          color: rgba(240, 230, 200, 0.3);
          margin: 0;
        }
      `}</style>
    </Stage>
  )
}

function DropZone({
  dragging,
  fileName,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
}: {
  dragging: boolean
  fileName: string
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onClick: () => void
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '2rem 1rem',
        borderRadius: 8,
        cursor: 'pointer',
        border: `1px dashed ${dragging ? '#C9A96E' : 'rgba(201, 169, 110, 0.25)'}`,
        backgroundColor: dragging ? 'rgba(201, 169, 110, 0.04)' : 'transparent',
        transition: 'all 0.2s',
        color: 'rgba(240, 230, 200, 0.35)',
      }}
    >
      <CloudUpload size={28} style={{ strokeWidth: 1.5, color: '#C9A96E' }} />
      {fileName ? (
        <span style={{ fontSize: 13, color: '#C9A96E', fontWeight: 500 }}>{fileName}</span>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 14, color: 'rgba(240, 230, 200, 0.65)' }}>
            Drag &amp; drop a video file here
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(240, 230, 200, 0.3)' }}>
            MP4, MOV, AVI up to 2GB
          </p>
        </>
      )}
    </div>
  )
}
