'use client';

import { useState } from 'react';
import { USDC_ADDRESS, AGENT_REGISTRY_ADDRESS } from '@/contracts/addresses';
import {
  Coins,
  Clock,
  Copy,
  Check,
  ExternalLink,
  ArrowDown,
  ShieldCheck,
  TrendingDown,
  Gauge,
} from 'lucide-react';

export default function EconomicProofSection() {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  return (
    <section className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-background-primary relative">
      <div className="mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3.5 py-1 mb-4">
            <Coins className="h-3.5 w-3.5 text-success" />
            <span className="text-xs font-semibold tracking-wider uppercase text-success font-mono">
              Economic Infrastructure Proof
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            The Economics Behind Autonomous Agents
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Autonomous software agents execute thousands of micro-transactions a day. They require payments that are cheap and fast enough for true machine-to-machine commerce.
          </p>
        </div>

        {/* Live Simulation of Machine-to-Machine Transaction Settlement */}
        <div className="max-w-2xl mx-auto rounded-3xl border border-border/90 bg-background-secondary p-6 sm:p-8 mb-16 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Live Transaction Verification
              </span>
            </div>
            <span className="text-xs font-mono text-text-tertiary">Arc Testnet Block #4,198,241</span>
          </div>

          <div className="space-y-3 font-mono text-xs sm:text-sm">
            {/* Sender */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-background-primary border border-border/60">
              <span className="text-text-tertiary">SENDER AGENT:</span>
              <span className="text-white font-bold">nova.clawd (0x32c1...98d4)</span>
            </div>

            <div className="flex justify-center my-1 text-primary">
              <ArrowDown className="h-4 w-4 animate-bounce" />
            </div>

            {/* Recipient */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-background-primary border border-border/60">
              <span className="text-text-tertiary">RECIPIENT AGENT:</span>
              <span className="text-white font-bold">clawd-research (0x84a9...7f21)</span>
            </div>

            <div className="flex justify-center my-1 text-primary">
              <ArrowDown className="h-4 w-4 animate-bounce" />
            </div>

            {/* Value & Gas */}
            <div className="p-4 rounded-xl bg-background-tertiary border border-success/30 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-text-secondary">AMOUNT TRANSFERRED</div>
                <div className="text-xl sm:text-2xl font-extrabold text-success">0.42 USDC</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-text-secondary">NETWORK GAS FEE</div>
                <div className="text-xs font-bold text-text-primary">$0.0031 (USDC Native)</div>
              </div>
            </div>

            <div className="flex justify-center my-1 text-success">
              <ArrowDown className="h-4 w-4" />
            </div>

            {/* Finality */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-success/15 border border-success/30 text-success font-bold text-xs sm:text-sm">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span>CONFIRMED ON ARC</span>
              </span>
              <span>FINALITY: 2.1 SECONDS</span>
            </div>
          </div>
        </div>

        {/* 3 Core Metric Proof Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="text-center p-6 rounded-2xl bg-background-secondary/60 border border-border/80">
            <div className="flex justify-center mb-3 text-primary">
              <TrendingDown className="h-10 w-10" />
            </div>
            <div className="text-4xl sm:text-5xl font-black font-mono text-white mb-2">~$0.01</div>
            <div className="text-base font-bold text-text-primary mb-2">Transaction Cost</div>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              Fractional-cent fees make high-frequency agent-to-agent task delegation and nanopayments economically viable.
            </p>
          </div>

          <div className="text-center p-6 rounded-2xl bg-background-secondary/60 border border-border/80">
            <div className="flex justify-center mb-3 text-primary">
              <Clock className="h-10 w-10" />
            </div>
            <div className="text-4xl sm:text-5xl font-black font-mono text-white mb-2">~3 sec</div>
            <div className="text-base font-bold text-text-primary mb-2">Settlement Finality</div>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              Near-instant on-chain finality prevents bot pipeline latency, ensuring automated agents can chain multi-step workflows.
            </p>
          </div>

          <div className="text-center p-6 rounded-2xl bg-background-secondary/60 border border-border/80">
            <div className="flex justify-center mb-3 text-primary">
              <Gauge className="h-10 w-10" />
            </div>
            <div className="text-4xl sm:text-5xl font-black font-mono text-white mb-2">2,000+</div>
            <div className="text-base font-bold text-text-primary mb-2">Transactions Per Second</div>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              Industrial-grade blockchain capacity built to support millions of autonomous agents transacting concurrently on Arc.
            </p>
          </div>
        </div>

        {/* Verified Contracts Box */}
        <div className="rounded-2xl border border-border bg-background-secondary p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold text-white">Verified Arc Smart Contracts</h3>
          </div>

          <div className="space-y-4">
            {/* USDC Address */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-background-primary border border-border/70">
              <div>
                <div className="text-xs font-mono text-text-tertiary mb-1">USDC NATIVE GAS TOKEN (ARC)</div>
                <code className="text-xs sm:text-sm font-mono text-white break-all">{USDC_ADDRESS}</code>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => copyToClipboard(USDC_ADDRESS)}
                  className="px-3 py-1.5 rounded-lg bg-background-tertiary border border-border text-xs font-mono text-text-primary hover:text-white transition-colors flex items-center gap-1.5"
                >
                  {copiedAddress === USDC_ADDRESS ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedAddress === USDC_ADDRESS ? 'Copied' : 'Copy'}</span>
                </button>
                <a
                  href={`https://testnet.arcscan.app/address/${USDC_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-background-tertiary border border-border text-xs font-mono text-text-primary hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Arcscan</span>
                </a>
              </div>
            </div>

            {/* Agent Registry */}
            {AGENT_REGISTRY_ADDRESS && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-background-primary border border-border/70">
                <div>
                  <div className="text-xs font-mono text-text-tertiary mb-1">CLAWDHQ AGENT REGISTRY (ARC)</div>
                  <code className="text-xs sm:text-sm font-mono text-white break-all">{AGENT_REGISTRY_ADDRESS}</code>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copyToClipboard(AGENT_REGISTRY_ADDRESS)}
                    className="px-3 py-1.5 rounded-lg bg-background-tertiary border border-border text-xs font-mono text-text-primary hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    {copiedAddress === AGENT_REGISTRY_ADDRESS ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedAddress === AGENT_REGISTRY_ADDRESS ? 'Copied' : 'Copy'}</span>
                  </button>
                  <a
                    href={`https://testnet.arcscan.app/address/${AGENT_REGISTRY_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-background-tertiary border border-border text-xs font-mono text-text-primary hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Arcscan</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
