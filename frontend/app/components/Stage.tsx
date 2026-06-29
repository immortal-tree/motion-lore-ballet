'use client'

import { useRef, useCallback, ReactNode } from 'react'
import Image from 'next/image'

export default function Stage({ children }: { children: ReactNode }) {
  const curtainLRef = useRef<HTMLDivElement>(null)
  const curtainRRef = useRef<HTMLDivElement>(null)
  const dancerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const x = (e.clientX / window.innerWidth) - 0.5 // -0.5 → 0.5
      const y = (e.clientY / window.innerHeight) - 0.5
      const distFromCenter = Math.abs(x) // 0 (center) → 0.5 (edges)

      if (curtainLRef.current)
        curtainLRef.current.style.transform = `translateX(${(0.25 - distFromCenter) * 80}px) translateY(${y * 6}px)`
      if (curtainRRef.current)
        curtainRRef.current.style.transform = `translateX(${(distFromCenter - 0.25) * 80}px) translateY(${y * 6}px)`
      if (dancerRef.current)
        dancerRef.current.style.transform = `translateX(${x * 14}px) translateY(${y * -8}px)`
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    const ease = (el: HTMLDivElement | null) => {
      if (!el) return
      el.style.transition = 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      el.style.transform = 'translateX(0px) translateY(0px)'
      setTimeout(() => {
        if (el) el.style.transition = ''
      }, 820)
    }
    ease(curtainLRef.current)
    ease(curtainRRef.current)
    ease(dancerRef.current)
  }, [])

  return (
    <div
      className="stage-root"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Layer 1: Backdrop ── */}
      <div className="layer layer-backdrop">
        <Image
          src="/assets/stage/layer-1-backdrop.png"
          alt=""
          fill
          style={{ objectFit: 'cover', objectPosition: 'center top' }}
          priority
        />
      </div>


      {/* ── Layer 3: Dancer ── */}
      <div className="layer layer-dancer" ref={dancerRef}>
        <Image
          src="/assets/stage/layer-5-dancer-main.png"
          alt="Ballet dancer on stage"
          fill
          style={{ objectFit: 'contain', objectPosition: 'center bottom' }}
          priority
        />
      </div>

      {/* ── Layer 4: Left Curtain ── */}
      <div className="layer layer-curtain-left" ref={curtainLRef}>
        <Image
          src="/assets/stage/layer-3-curtain-left.png"
          alt=""
          fill
          style={{ objectFit: 'fill', objectPosition: 'left top' }}
          priority
        />
      </div>

      {/* ── Layer 5: Right Curtain ── */}
      <div className="layer layer-curtain-right" ref={curtainRRef}>
        <Image
          src="/assets/stage/layer-3-curtain-right.png"
          alt=""
          fill
          style={{ objectFit: 'fill', objectPosition: 'right top' }}
          priority
        />
      </div>

      {/* ── Layer 6: Valance ── */}
      <div className="layer layer-valance">
        <Image
          src="/assets/stage/layer-4-valance.png"
          alt=""
          fill
          style={{ objectFit: 'fill', objectPosition: 'center top' }}
          priority
        />
      </div>

      {/* ── Layer 7: UI Card ── */}
      <div className="layer layer-ui">
        {children}
      </div>

      <style jsx global>{`
        .stage-root {
          position: relative;
          width: 100%;
          height: 100vh;
          overflow: hidden;
          background: #0a0705;
        }

        .layer {
          position: absolute;
          inset: 0;
          will-change: transform;
        }

        .layer-backdrop {
          z-index: 1;
          top: -80px;
          left: -5%;
          width: 110%;
          height: calc(100% + 120px);
        }


        .layer-dancer {
          z-index: 3;
          top: 35%;
          left: -8%;
          right: 48%;
          bottom: -5%;
          transition: transform 0.05s linear;
          filter: drop-shadow(4px 8px 16px rgba(0,0,0,0.6));
        }

        .layer-curtain-left {
          z-index: 6;
          width: 30%;
          left: -6%;
          right: auto;
          top: -60px;
          height: calc(100% + 60px);
          transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          transform-origin: left center;
          filter: drop-shadow(8px 0 24px rgba(0,0,0,0.7));
        }

        .layer-curtain-right {
          z-index: 6;
          width: 30%;
          right: -6%;
          left: auto;
          top: -60px;
          height: calc(100% + 60px);
          transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          transform-origin: right center;
          filter: drop-shadow(-8px 0 24px rgba(0,0,0,0.7));
        }

        .layer-valance {
          z-index: 5;
          bottom: auto;
          top: -240px;
          height: calc(55% + 240px);
          filter: drop-shadow(0 12px 24px rgba(0,0,0,0.8));
        }

        .layer-ui {
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          height: 100%;
          width: 100%;
          padding: 16px;
          box-sizing: border-box;
        }

        .layer-ui > * {
          pointer-events: all;
        }

        .stage-root::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 6;
          background: radial-gradient(
            ellipse 60% 50% at 50% 60%,
            transparent 30%,
            rgba(0,0,0,0.45) 100%
          );
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}
