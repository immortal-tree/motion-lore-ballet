'use client'

export default function SparkleSpinner({ size = 48, color = '#D4A96A' }: { 
  size?: number
  color?: string 
}) {
  const spokes = 12
  const cx = size / 2
  const cy = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ animation: 'sparkleSpin 1.8s linear infinite' }}
    >
      <style>{`
        @keyframes sparkleSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {Array.from({ length: spokes }).map((_, i) => {
        const angle = (i / spokes) * 360
        const rad = (angle * Math.PI) / 180
        // Alternate long and short spokes like the image
        const isLong = i % 3 === 0
        const isMed = i % 3 === 1
        const innerR = size * 0.28
        const outerR = isLong ? size * 0.47 : isMed ? size * 0.38 : size * 0.32
        const opacity = isLong ? 1 : isMed ? 0.7 : 0.4

        const x1 = cx + innerR * Math.cos(rad)
        const y1 = cy + innerR * Math.sin(rad)
        const x2 = cx + outerR * Math.cos(rad)
        const y2 = cy + outerR * Math.sin(rad)

        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color}
            strokeWidth={isLong ? 1.5 : 1}
            strokeLinecap="round"
            opacity={opacity}
          />
        )
      })}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={1.5} fill={color} />
    </svg>
  )
}
