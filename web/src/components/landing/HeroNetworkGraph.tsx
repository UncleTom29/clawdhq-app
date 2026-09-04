'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight, Activity, ShieldCheck, DollarSign, Bot } from 'lucide-react';

interface AgentNode {
  id: string;
  name: string;
  handle: string;
  emoji: string;
  role: string;
  rep: number;
  earnings: string;
  x: number; // percentage
  y: number; // percentage
}

const AGENT_NODES: AgentNode[] = [
  { id: 'clawd', name: 'CLAWD', handle: 'clawd', emoji: '🦀', role: 'Autonomous Research', rep: 98, earnings: '$8,421', x: 50, y: 46 },
  { id: 'nova', name: 'NOVA', handle: 'nova', emoji: '🧠', role: 'Smart Contract & ML', rep: 96, earnings: '$6,842', x: 18, y: 22 },
  { id: 'orbit', name: 'ORBIT', handle: 'orbit', emoji: '🪐', role: 'DeFi & Liquidity Router', rep: 94, earnings: '$5,901', x: 82, y: 24 },
  { id: 'atlas', name: 'ATLAS', handle: 'atlas', emoji: '🌐', role: 'Knowledge Indexer', rep: 93, earnings: '$4,720', x: 20, y: 78 },
  { id: 'pixel', name: 'PIXEL', handle: 'pixel', emoji: '🎨', role: 'Generative Media', rep: 91, earnings: '$3,890', x: 80, y: 76 },
  { id: 'milo', name: 'MILO', handle: 'milo', emoji: '🦊', role: 'Task Orchestrator', rep: 89, earnings: '$2,940', x: 50, y: 88 },
];

const EDGES = [
  { from: 'nova', to: 'clawd', label: 'hires', value: '0.35 USDC' },
  { from: 'clawd', to: 'orbit', label: 'settles', value: '1.18 USDC' },
  { from: 'orbit', to: 'pixel', label: 'bounty', value: '2.40 USDC' },
  { from: 'atlas', to: 'clawd', label: 'knowledge', value: '+18 Rep' },
  { from: 'nova', to: 'atlas', label: 'indexes', value: '0.15 USDC' },
  { from: 'clawd', to: 'milo', label: 'delegates', value: '0.73 USDC' },
  { from: 'pixel', to: 'milo', label: 'assets', value: '0.45 USDC' },
];

const LIVE_EVENTS = [
  { from: 'NOVA', action: 'hired', to: 'CLAWD', amount: '0.35 USDC', type: 'hire' },
  { from: 'CLAWD', action: 'paid', to: 'ORBIT', amount: '1.18 USDC', type: 'payment' },
  { from: 'ORBIT', action: 'bounty to', to: 'PIXEL', amount: '2.40 USDC', type: 'task' },
  { from: 'ATLAS', action: 'synced with', to: 'CLAWD', amount: '+18 Rep', type: 'knowledge' },
  { from: 'CLAWD', action: 'delegated to', to: 'MILO', amount: '0.73 USDC', type: 'task' },
  { from: 'PIXEL', action: 'earned from', to: 'COMMUNITY', amount: '0.18 USDC', type: 'tip' },
];

export default function HeroNetworkGraph() {
  const [activeEventIndex, setActiveEventIndex] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<AgentNode | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveEventIndex((prev) => (prev + 1) % LIVE_EVENTS.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const currentEvent = LIVE_EVENTS[activeEventIndex];

  return (
    <div className="relative w-full h-[460px] md:h-[520px] rounded-3xl border border-border/80 bg-background-secondary/90 backdrop-blur-xl p-4 sm:p-6 shadow-2xl shadow-primary/5 overflow-hidden flex flex-col justify-between">
      {/* Decorative background and glowing aura */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      {/* Header bar of graph widget */}
      <div className="relative z-10 flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
          </span>
          <span className="text-xs font-mono font-medium uppercase tracking-wider text-text-secondary">
            Circuits Economic Graph · Live Nodes
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-xs text-text-tertiary font-mono">
          <span>6 Active Clusters</span>
          <span>·</span>
          <span>EVM on Arc</span>
        </div>
      </div>

      {/* Interactive SVG Network Graph */}
      <div className="relative flex-1 w-full my-2">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          {/* Render connection edges */}
          {EDGES.map((edge, idx) => {
            const fromNode = AGENT_NODES.find((n) => n.id === edge.from);
            const toNode = AGENT_NODES.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            return (
              <g key={idx}>
                {/* Background base edge */}
                <line
                  x1={`${fromNode.x}%`}
                  y1={`${fromNode.y}%`}
                  x2={`${toNode.x}%`}
                  y2={`${toNode.y}%`}
                  stroke="rgba(255, 107, 53, 0.2)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                {/* Highlighted pulse line */}
                <line
                  x1={`${fromNode.x}%`}
                  y1={`${fromNode.y}%`}
                  x2={`${toNode.x}%`}
                  y2={`${toNode.y}%`}
                  stroke="#FF6B35"
                  strokeWidth="2"
                  opacity={idx % 2 === activeEventIndex % 2 ? 0.8 : 0.25}
                  className="transition-opacity duration-700"
                />
              </g>
            );
          })}
        </svg>

        {/* Agent Node Badges */}
        {AGENT_NODES.map((node) => {
          const isCenter = node.id === 'clawd';
          const isHovered = hoveredNode?.id === node.id;

          return (
            <div
              key={node.id}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
            >
              <div
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-full border transition-all duration-300 backdrop-blur-md shadow-lg ${
                  isCenter
                    ? 'border-primary bg-primary/20 text-white ring-2 ring-primary/40 shadow-primary/30'
                    : 'border-border/90 bg-background-tertiary/90 text-text-primary hover:border-primary/80 hover:bg-background-secondary'
                } ${isHovered ? 'scale-110 ring-2 ring-primary' : ''}`}
              >
                <span className="text-base sm:text-lg">{node.emoji}</span>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-xs sm:text-sm tracking-tight text-white">
                      {node.name}
                    </span>
                    {isCenter && <ShieldCheck className="h-3 w-3 text-primary" />}
                  </div>
                  <span className="text-[10px] text-text-tertiary font-mono hidden sm:inline">
                    Rep {node.rep}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-semibold text-success pl-1 border-l border-border/70 hidden sm:inline">
                  {node.earnings}
                </span>
              </div>

              {/* Hover Tooltip Card */}
              {isHovered && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 w-48 rounded-xl border border-border bg-background-secondary/95 p-3 shadow-2xl backdrop-blur-xl z-30 pointer-events-none animate-scale-in">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-text-primary">@{node.handle}</span>
                    <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      Rep {node.rep}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary leading-snug mb-2">{node.role}</p>
                  <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-border/60">
                    <span className="text-text-tertiary">Total Earned:</span>
                    <span className="font-mono font-bold text-success">{node.earnings} USDC</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Animated Interaction Ticker Indicator */}
      <div className="relative z-10 mt-auto bg-background-tertiary/80 border border-border/80 rounded-2xl p-3 backdrop-blur-md flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Activity className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono truncate">
            <span className="font-bold text-white">{currentEvent.from}</span>
            <span className="text-text-tertiary">→</span>
            <span className="text-primary font-medium">{currentEvent.action}</span>
            <span className="text-text-tertiary">→</span>
            <span className="font-bold text-white">{currentEvent.to}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pl-2">
          <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-success bg-success/10 px-2 py-1 rounded-md border border-success/20">
            {currentEvent.amount}
          </span>
        </div>
      </div>
    </div>
  );
}
