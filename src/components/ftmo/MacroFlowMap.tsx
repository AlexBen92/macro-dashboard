'use client';
import { motion } from 'framer-motion';
import type { FlowNode, FlowEdge } from '@/lib/ftmo/types';
import { FLOW_NODE_POSITIONS } from '@/lib/ftmo/constants';

function formatPrice(id: string, price: number): string {
  if (price === 0) return '--';
  if (id === 'GOLD' || id === 'XAUUSD') return price.toFixed(0);
  if (id === 'OIL') return price.toFixed(2);
  if (id === 'VIX' || id === '10Y' || id === 'DXY') return price.toFixed(1);
  if (id === 'USDJPY') return price.toFixed(2);
  return price.toFixed(4);
}

export default function MacroFlowMap({
  nodes, edges, alerts,
}: { nodes: FlowNode[]; edges: FlowEdge[]; alerts: string[] }) {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  return (
    <div className="relative">
      <svg viewBox="0 0 600 400" className="w-full h-auto" style={{ minHeight: 300 }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const from = nodeMap[edge.from];
          const to = nodeMap[edge.to];
          if (!from || !to) return null;

          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const perpX = -dy * 0.15;
          const perpY = dx * 0.15;
          const ctrlX = midX + perpX;
          const ctrlY = midY + perpY;

          const strokeColor = edge.causalDirection === 'positive' ? '#00e5ff' : '#ff006e';
          const baseOpacity = Math.abs(edge.correlation) > 0.5 ? 0.15 : 0.08;

          return (
            <g key={i}>
              {/* Base edge (always visible, faint) */}
              <path
                d={`M${from.x},${from.y} Q${ctrlX},${ctrlY} ${to.x},${to.y}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={Math.abs(edge.correlation) * 2}
                opacity={baseOpacity}
              />
              {/* Active pulse */}
              {edge.isActive && (
                <motion.path
                  d={`M${from.x},${from.y} Q${ctrlX},${ctrlY} ${to.x},${to.y}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={Math.abs(edge.correlation) * 3.5}
                  initial={{ pathLength: 0, opacity: 0.1 }}
                  animate={{ pathLength: 1, opacity: 0.7 }}
                  transition={{ delay: edge.lagMinutes / 120, duration: 0.8, ease: 'easeOut' }}
                  filter="url(#glow)"
                />
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const changeColor = node.change24h > 0 ? '#4ade80' : node.change24h < 0 ? '#ff006e' : '#556680';
          const bgColor = node.change24h > 0 ? 'rgba(74,222,128,0.15)' : node.change24h < 0 ? 'rgba(255,0,110,0.15)' : 'rgba(85,102,128,0.1)';

          return (
            <g key={node.id}>
              {/* Pulse ring */}
              {node.pulseIntensity > 0.3 && (
                <motion.circle
                  cx={node.x} cy={node.y}
                  r={node.size + 4}
                  fill="none"
                  stroke={changeColor}
                  strokeWidth={1.5}
                  initial={{ r: node.size, opacity: 0.8 }}
                  animate={{ r: node.size + 10, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              {/* Main circle */}
              <motion.circle
                cx={node.x} cy={node.y}
                r={node.size}
                fill={bgColor}
                stroke={changeColor}
                strokeWidth={2}
                animate={{
                  r: node.pulseIntensity > 0.5
                    ? [node.size, node.size * 1.12, node.size]
                    : node.size,
                }}
                transition={{ duration: 1.5, repeat: node.pulseIntensity > 0.5 ? Infinity : 0 }}
              />
              {/* Label */}
              <text x={node.x} y={node.y - 6} textAnchor="middle" fill="#e8e8f0" fontSize="11" fontFamily="monospace" fontWeight="700">
                {node.label}
              </text>
              {/* Price */}
              <text x={node.x} y={node.y + 7} textAnchor="middle" fill={changeColor} fontSize="9.5" fontFamily="monospace" fontWeight="600">
                {formatPrice(node.id, node.price)}
              </text>
              {/* Change */}
              <text x={node.x} y={node.y + 18} textAnchor="middle" fill={changeColor} fontSize="7.5" fontFamily="monospace" opacity={0.8}>
                {node.change24h >= 0 ? '+' : ''}{node.change24h.toFixed(2)}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* Correlation break alerts */}
      {alerts.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {alerts.slice(0, 3).map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-mono text-[0.78rem] px-3 py-1.5 rounded bg-[#ffaa00]/5 border-l-2 border-[#ffaa00] text-[#ffaa00]"
            >
              ⚠ {a}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
