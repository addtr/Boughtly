import React from 'react';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors } from '../theme/theme';

interface SparklineProps {
  values: number[];
  width: number;
  height: number;
  color?: string;
  showDots?: boolean;
  strokeWidth?: number;
}

/** Minimal price-history line. Flat line for a single point. */
export function Sparkline({
  values,
  width,
  height,
  color = colors.primary,
  showDots = false,
  strokeWidth = 2.5,
}: SparklineProps) {
  if (values.length === 0) return null;
  const pad = strokeWidth * 2 + (showDots ? 3 : 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;

  const pts = values.map((v, i) => {
    const x = pad + i * stepX + (values.length === 1 ? (width - pad * 2) / 2 : 0);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return { x, y };
  });

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots &&
        pts.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === pts.length - 1 ? 5 : 3.5}
            fill={i === pts.length - 1 ? colors.coral : color}
          />
        ))}
    </Svg>
  );
}
