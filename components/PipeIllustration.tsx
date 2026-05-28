'use client';

import { motion } from 'framer-motion';

const gradients = [
  { id: 'pipe1', stops: ['#E2E8F0', '#94A3B8', '#CBD5E1', '#64748B', '#475569'] },
  { id: 'pipe2', stops: ['#CBD5E1', '#64748B', '#94A3B8', '#475569', '#334155'] },
  { id: 'pipe3', stops: ['#F1F5F9', '#94A3B8', '#E2E8F0', '#64748B', '#475569'] },
  { id: 'pipe4', stops: ['#94A3B8', '#475569', '#64748B', '#334155', '#1E293B'] },
  { id: 'pipe5', stops: ['#E2E8F0', '#64748B', '#CBD5E1', '#475569', '#334155'] },
];

const pipeData = [
  { y: 30, w: 540, h: 26, grad: 'pipe1', delay: 0 },
  { y: 72, w: 480, h: 22, grad: 'pipe2', delay: 0.08 },
  { y: 110, w: 560, h: 30, grad: 'pipe3', delay: 0.16 },
  { y: 158, w: 510, h: 24, grad: 'pipe4', delay: 0.24 },
  { y: 198, w: 530, h: 28, grad: 'pipe5', delay: 0.32 },
  { y: 242, w: 490, h: 22, grad: 'pipe1', delay: 0.40 },
  { y: 280, w: 550, h: 32, grad: 'pipe2', delay: 0.48 },
  { y: 328, w: 520, h: 26, grad: 'pipe3', delay: 0.56 },
  { y: 370, w: 540, h: 24, grad: 'pipe4', delay: 0.64 },
];

const easeOut = [0.16, 1, 0.3, 1] as const;

const highlightVar = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({
    opacity: 1,
    transition: { duration: 0.8, delay: 0.5 + i * 0.08, ease: easeOut },
  }),
};

export default function PipeIllustration() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
      <svg
        viewBox="0 0 600 420"
        fill="none"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {gradients.map((g) => (
            <linearGradient
              key={g.id}
              id={g.id}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              {g.stops.map((stop, i) => (
                <stop
                  key={i}
                  offset={`${(i / (g.stops.length - 1)) * 100}%`}
                  stopColor={stop}
                />
              ))}
            </linearGradient>
          ))}
          <filter id="pipeShadow" x="-5%" y="-10%" width="110%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.08" />
          </filter>
          <linearGradient id="maskGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="10%" stopColor="#fff" stopOpacity="1" />
            <stop offset="90%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="fadeMask">
            <rect x="0" y="0" width="600" height="420" fill="url(#maskGrad)" />
          </mask>
        </defs>

        <g opacity="0.5" mask="url(#fadeMask)">
          {pipeData.map((pipe, i) => (
            <g key={i}>
              <rect
                x={(600 - pipe.w) / 2}
                y={pipe.y}
                width={pipe.w}
                height={pipe.h}
                rx={pipe.h / 2}
                fill={`url(#${pipe.grad})`}
                filter="url(#pipeShadow)"
              />
              <motion.rect
                custom={i}
                variants={highlightVar}
                initial="hidden"
                animate="visible"
                x={(600 - pipe.w) / 2 + pipe.w * 0.15}
                y={pipe.y + pipe.h * 0.15}
                width={pipe.w * 0.7}
                height={pipe.h * 0.25}
                rx={pipe.h * 0.125}
                fill="white"
                opacity={0.15}
              />
            </g>
          ))}
        </g>

        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 1.2, ease: easeOut }}
          opacity="0.15"
        >
          {[0, 1, 2].map((row) => (
            <g key={row}>
              {[0, 1, 2, 3, 4].map((col) => {
                const cx = 100 + col * 110 + (row % 2) * 55;
                const cy = 80 + row * 140;
                return (
                  <g key={`${row}-${col}`}>
                    <circle cx={cx} cy={cy} r={18} fill="#64748B" />
                    <circle cx={cx} cy={cy} r={14} fill="#334155" />
                    <circle cx={cx} cy={cy} r={10} fill="#1E293B" />
                    <circle cx={cx - 3} cy={cy - 3} r={6} fill="white" opacity={0.1} />
                  </g>
                );
              })}
            </g>
          ))}
        </motion.g>
      </svg>
    </div>
  );
}
