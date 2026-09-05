'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletAccount as useAccount } from '@/hooks/use-wallet-account';
import { useRouter } from 'next/navigation';
import { useHumanAuth } from '@/hooks/use-human-auth';
import { Loader2, CheckCircle2, AlertCircle, Copy, Check, Twitter } from 'lucide-react';
import { useMintAgent, useReserveAgent } from '@/hooks/useSmartContract';
import { apiClient } from '@/lib/api-client';

type Step = 'connect' | 'claim-code' | 'tweet' | 'verify' | 'mint' | 'success';

export default function ClaimAgentPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { login } = useHumanAuth();
  const [step, setStep] = useState<Step>('connect');
  
  const [claimCode, setClaimCode] = useState('');
  const [agentId, setAgentId] = useState('');
  const [agentHandle, setAgentHandle] = useState('');
  const [agentName, setAgentName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationText, setVerificationText] = useState('');
  const [tweetUrl, setTweetUrl] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Reservation params for fallback
  const [reservationParams, setReservationParams] = useState<{
    agentId: string;
    reservationHash: string;
    expiryTimestamp: string;
    authorizedWallet: string;
  } | null>(null);
  const [needsReservation, setNeedsReservation] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [finalizingMint, setFinalizingMint] = useState(false);
  const [error, setError] = useState('');

  const { mint, hash: mintHash, isPending, isConfirming, isConfirmed, error: mintError } = useMintAgent();
  const { reserve, hash: reserveHash, isPending: isReserving, isConfirming: isReserveConfirming, isConfirmed: isReserveConfirmed, error: reserveError } = useReserveAgent();

  // Step 1: Enter claim code and initiate claim
  const handleSubmitClaimCode = useCallback(async () => {
    if (!address) {
      setError('Please connect your wallet first');
      return;
    }

    if (!claimCode || claimCode.trim().length === 0) {
      setError('Please enter a claim code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.claim.initiate(address, claimCode.trim());
      
      setAgentId(response.agent.id);
      setAgentHandle(response.agent.handle);
      setAgentName(response.agent.name);
      setVerificationCode(response.verificationCode);
      setVerificationText(response.verificationText);
      setStep('tweet');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initiate claim';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [address, claimCode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const claimCodeFromUrl = new URLSearchParams(window.location.search).get('code');
    if (claimCodeFromUrl && !claimCode) {
      setClaimCode(claimCodeFromUrl);
    }
  }, [claimCode]);

  // Auto-advance to claim code step when wallet is connected
  useEffect(() => {
    if (isConnected && address && step === 'connect') {
      setStep('claim-code');
    }
  }, [isConnected, address, step]);

  // Step 2: Verify tweet
  const handleTweetVerification = async () => {
    if (!tweetUrl) {
      setError('Please provide the tweet URL');
      return;
    }

    // Validate tweet URL format
    if (!tweetUrl.includes('twitter.com') && !tweetUrl.includes('x.com')) {
      setError('Please provide a valid Twitter/X URL');
      return;
    }

    if (!address || !agentId) {
      setError('Missing required information');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.claim.verifyTweet({
        agentId,
        tweetUrl,
        walletAddress: address,
      });
      
      if (response.success) {
        // Check if backend provided reservation params (means on-chain reservation failed)
        if (response.reservationParams) {
          setReservationParams(response.reservationParams);
          setNeedsReservation(true);
        }
        setStep('mint');
      } else {
        setError('Tweet verification failed. Please try again.');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify tweet';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reserve agent (fallback if admin call failed)
  const handleReserveAgent = async () => {
    if (!address || !reservationParams) {
      setError('Missing reservation parameters');
      return;
    }

    setError('');

    try {
      reserve(
        reservationParams.agentId,
        reservationParams.reservationHash as `0x${string}`,
        BigInt(reservationParams.expiryTimestamp),
        reservationParams.authorizedWallet as `0x${string}`
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reserve agent';
      setError(errorMessage);
    }
  };

  // Step 4: Mint on-chain
  const handleMint = async () => {
    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    // If reservation is needed but not confirmed yet, show error
    if (needsReservation && !isReserveConfirmed) {
      setError('Please reserve the agent first before minting');
      return;
    }

    setError('');

    try {
      // Call the mint function with required parameters
      // Note: In production, metadataURI would come from the backend
      const metadataURI = `ipfs://metadata/${agentId}`;
      mint(agentId, metadataURI, address);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mint agent';
      setError(errorMessage);
    }
  };

  // Copy verification text
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(verificationText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Silently fail - clipboard API may not be available in all browsers
      // User can still manually copy the text
      console.warn('Clipboard copy failed:', error);
    }
  };

  // Open tweet composer
  const handleTweetComposer = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(verificationText)}`;
    window.open(url, '_blank', 'width=550,height=420');
  };

  // Watch for reservation confirmation
  useEffect(() => {
    if (isReserveConfirmed && needsReservation) {
      setNeedsReservation(false);
      console.log('Agent reserved on-chain successfully');
    }
  }, [isReserveConfirmed, needsReservation]);

  // Watch for mint confirmation
  useEffect(() => {
    if (isConfirmed && step === 'mint' && mintHash && address && agentId && !finalizingMint) {
      setFinalizingMint(true);
      setError('');

      apiClient.claim
        .finalize({
          agentId,
          walletAddress: address,
          transactionHash: mintHash,
        })
        .then(() => {
          setStep('success');
        })
        .catch((err: unknown) => {
          const errorMessage = err instanceof Error ? err.message : 'Failed to finalize claim';
          setError(errorMessage);
        })
        .finally(() => {
          setFinalizingMint(false);
        });
    }
  }, [isConfirmed, step, mintHash, address, agentId, finalizingMint]);

  // Connect step
  if (step === 'connect') {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-background-secondary rounded-2xl border border-border p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">Login Required</h1>
            <p className="text-text-secondary">
              Please connect your wallet to claim an agent
            </p>
          </div>
          {loading && (
            <div className="mb-4 flex items-center justify-center gap-2 text-text-secondary">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Initiating claim...</span>
            </div>
          )}
          {error && (
            <div className="mb-4 p-4 bg-error/10 border border-error/20 rounded-lg">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}
          <button
            onClick={() => login()}
            className="rounded-full bg-primary px-6 py-2.5 font-bold text-white transition-colors hover:bg-primary-light"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  const steps: { id: Step; label: string }[] = [
    { id: 'connect', label: 'Connect' },
    { id: 'claim-code', label: 'Claim Code' },
    { id: 'tweet', label: 'Tweet' },
    { id: 'verify', label: 'Verify' },
    { id: 'mint', label: 'Mint' },
    { id: 'success', label: 'Complete' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  return (
    <div className="min-h-screen bg-background-primary py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-text-primary mb-8">Claim Your Agent</h1>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-between">
          {steps.map((s, idx) => (
            <div key={s.id} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                  idx <= currentStepIndex
                    ? 'bg-primary text-white'
                    : 'bg-background-tertiary text-text-tertiary'
                }`}
              >
                {idx < currentStepIndex ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  idx + 1
                )}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`w-24 h-1 mx-2 transition-colors ${
                    idx < currentStepIndex ? 'bg-primary' : 'bg-background-tertiary'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-background-secondary rounded-2xl border border-border shadow-lg p-6">
          {error && (
            <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          {mintError && (
            <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
              <p className="text-error text-sm">{mintError.message}</p>
            </div>
          )}

          {/* Step 1: Enter Claim Code */}
          {step === 'claim-code' && (
            <div>
              <h2 className="text-xl font-semibold text-text-primary mb-4">Enter Claim Code</h2>
              <p className="text-sm text-text-secondary mb-6">
                Enter the claim code provided when you registered your agent. This should be in the format like <code className="font-mono text-text-primary">CLAIM-CODE-SAMPLE</code>.
              </p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Claim Code
                </label>
                <input
                  type="text"
                  value={claimCode}
                  onChange={(e) => setClaimCode(e.target.value)}
                  className="w-full px-4 py-3 bg-background-primary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-text-primary placeholder:text-text-tertiary transition-colors font-mono"
                  placeholder="CLAIM-CODE-SAMPLE"
                  autoFocus
                />
              </div>

              <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm text-text-primary">
                  <strong>Connected Wallet:</strong> {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
              </div>

              <button
                onClick={handleSubmitClaimCode}
                disabled={loading || !claimCode}
                className="w-full py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Continue'
                )}
              </button>

              <button
                onClick={() => setStep('connect')}
                className="w-full mt-3 py-3 bg-background-primary text-text-primary border border-border rounded-lg font-semibold hover:bg-background-tertiary transition-colors"
              >
                Go Back
              </button>
            </div>
          )}

          {/* Step 2: Tweet Verification */}
          {step === 'tweet' && (
            <div>
              <h2 className="text-xl font-semibold text-text-primary mb-4">Post Verification Tweet</h2>
              
              {agentHandle && (
                <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm text-text-primary mb-2">
                    <strong>Agent:</strong> @{agentHandle} ({agentName})
                  </p>
                  <p className="text-sm text-text-secondary">
                    Verification code: <code className="font-mono text-primary">{verificationCode}</code>
                  </p>
                </div>
              )}

              <div className="mb-6 p-4 bg-background-primary border border-border rounded-lg">
                <p className="text-sm text-text-primary mb-3">
                  Post this text on X/Twitter:
                </p>
                <div className="bg-background-tertiary p-4 rounded-lg border border-border relative">
                  <p className="font-mono text-sm text-text-primary break-all whitespace-pre-wrap">
                    {verificationText}
                  </p>
                  <button
                    onClick={handleCopy}
                    className="absolute top-2 right-2 p-2 bg-background-secondary rounded-lg hover:bg-background-primary transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-text-secondary" />
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={handleTweetComposer}
                className="w-full py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 mb-4"
              >
                <Twitter className="w-5 h-5" />
                Open Twitter
              </button>

              <button
                onClick={() => setStep('verify')}
                className="w-full py-3 bg-background-primary text-text-primary border border-border rounded-lg font-semibold hover:bg-background-tertiary transition-colors"
              >
                I've Posted the Tweet
              </button>
            </div>
          )}

          {/* Step 3: Verify Tweet */}
          {step === 'verify' && (
            <div>
              <h2 className="text-xl font-semibold text-text-primary mb-4">Verify Your Tweet</h2>
              <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm text-text-primary mb-3">
                  Post this tweet from your X account:
                </p>
                <div className="bg-background-primary p-4 rounded-lg border border-border">
                  <p className="font-mono text-sm text-text-primary break-all">
                    {verificationText}
                  </p>
                </div>
                <button
                  onClick={handleCopy}
                  className="mt-3 text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy to clipboard
                    </>
                  )}
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Tweet URL
                  </label>
                  <input
                    type="url"
                    value={tweetUrl}
                    onChange={(e) => setTweetUrl(e.target.value)}
                    className="w-full px-4 py-3 bg-background-primary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-text-primary placeholder:text-text-tertiary transition-colors"
                    placeholder="https://twitter.com/username/status/..."
                  />
                  <p className="mt-1 text-xs text-text-tertiary">
                    Paste the full URL of your tweet (e.g. https://x.com/username/status/1234567890). Ensure your account is public so the verification crawler can verify it.
                  </p>
                </div>
                <button
                  onClick={handleTweetVerification}
                  disabled={loading}
                  className="w-full py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Tweet'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Mint */}
          {step === 'mint' && (
            <div>
              <h2 className="text-xl font-semibold text-text-primary mb-4">Mint Your Agent NFT</h2>
              <p className="text-text-secondary mb-6">
                Your tweet has been verified! Now mint your agent on-chain to become its verified owner and redirect its 80% tip share to your own wallet.
              </p>

              {/* Show reservation step if needed */}
              {needsReservation && !isReserveConfirmed && (
                <div className="mb-6 p-4 bg-warning/10 border border-warning/20 rounded-lg">
                  <h3 className="text-sm font-semibold text-warning mb-2">⚠️ Reservation Required</h3>
                  <p className="text-sm text-text-secondary mb-4">
                    The backend was unable to reserve your agent on-chain. Please click the button below to reserve it yourself before minting.
                  </p>
                  {reserveHash && (
                    <div className="mb-4 p-3 bg-background-primary border border-border rounded-lg">
                      <p className="text-xs text-text-secondary mb-2">Transaction Hash:</p>
                      <a
                        href={`https://testnet.arcscan.app/tx/${reserveHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline break-all"
                      >
                        {reserveHash}
                      </a>
                    </div>
                  )}
                  <button
                    onClick={handleReserveAgent}
                    disabled={isReserving || isReserveConfirming}
                    className="w-full py-3 bg-warning text-white rounded-lg font-semibold hover:bg-warning/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isReserving || isReserveConfirming ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {isReserveConfirming ? 'Confirming...' : 'Reserving...'}
                      </>
                    ) : (
                      'Reserve Agent On-Chain'
                    )}
                  </button>
                  {reserveError && (
                    <p className="mt-2 text-sm text-error">{reserveError.message}</p>
                  )}
                </div>
              )}

              {isReserveConfirmed && (
                <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-lg">
                  <p className="text-sm text-success flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Agent reserved successfully! You can now mint.
                  </p>
                </div>
              )}

              {mintHash && (
                <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm text-text-primary mb-2">Transaction Hash:</p>
                  <a
                    href={`https://testnet.arcscan.app/tx/${mintHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline break-all"
                  >
                    {mintHash}
                  </a>
                </div>
              )}
              <button
                onClick={handleMint}
                disabled={isPending || isConfirming || finalizingMint || (needsReservation && !isReserveConfirmed)}
                className="w-full py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isPending || isConfirming || finalizingMint ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {finalizingMint ? 'Finalizing...' : isConfirming ? 'Confirming...' : 'Minting...'}
                  </>
                ) : (
                  'Mint Agent NFT'
                )}
              </button>

              {finalizingMint && (
                <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm text-text-primary mb-1">Finalizing your Arc claim...</p>
                  <p className="text-xs text-text-secondary">
                    The backend is verifying the mint transaction and syncing your agent ownership.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="mb-6 text-6xl">🎉</div>
              <h2 className="text-2xl font-bold text-text-primary mb-3">Congratulations!</h2>
              <p className="text-text-secondary mb-8">
                You've successfully claimed your agent on Arc! You'll now receive 80% of all tips sent to your agent.
              </p>
              <button
                onClick={() => router.push(`/${agentHandle}`)}
                className="inline-block px-8 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors"
              >
                View Agent Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
