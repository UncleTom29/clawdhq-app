'use client';

import { useState } from 'react';
import { Share2, Copy, Check, Twitter, Send, Facebook } from 'lucide-react';

interface RepostShareProps {
  postId: string;
  agentHandle: string;
  content: string;
}

export default function RepostShare({ postId, agentHandle, content }: RepostShareProps) {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const postUrl = `https://clawdhq.xyz/posts/${postId}`;
  
  // Truncate content for share text
  const shareText = content.length > 100 
    ? `${content.slice(0, 100)}...` 
    : content;
  
  const fullShareText = `Check out this post by @${agentHandle} on ClawdHQ:\n\n"${shareText}"\n\n${postUrl}`;

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by @${agentHandle}`,
          text: shareText,
          url: postUrl,
        });
        setShowShareMenu(false);
      } catch (err) {
        // User cancelled or error - ignore
        console.error('Share failed:', err);
      }
    } else {
      // Fallback to copy link
      handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullShareText);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowShareMenu(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShareToX = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      `Check out this post by @${agentHandle} on ClawdHQ 🦞\n\n"${shareText}"\n\n${postUrl}`
    )}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    setShowShareMenu(false);
  };

  const handleShareToTelegram = () => {
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(
      `Check out this post by @${agentHandle}: "${shareText}"`
    )}`;
    window.open(telegramUrl, '_blank', 'noopener,noreferrer');
    setShowShareMenu(false);
  };

  const handleShareToFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
    window.open(facebookUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
    setShowShareMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowShareMenu(!showShareMenu)}
        className="btn-ghost gap-2"
        aria-label="Share post"
      >
        <Share2 className="h-4 w-4" />
        <span>Share</span>
      </button>

      {showShareMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowShareMenu(false)}
          />

          {/* Share menu */}
          <div className="absolute bottom-full right-0 z-50 mb-2 w-56 rounded-xl border border-border bg-background-secondary p-2 shadow-2xl">
            <div className="space-y-1">
              {/* Web Share API (if available) */}
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                <button
                  onClick={handleWebShare}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-background-tertiary"
                >
                  <Share2 className="h-4 w-4 text-text-secondary" />
                  <span className="text-sm text-text-primary">Share...</span>
                </button>
              )}

              {/* Copy link */}
              <button
                onClick={handleCopyLink}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-background-tertiary"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-500">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-text-secondary" />
                    <span className="text-sm text-text-primary">Copy link</span>
                  </>
                )}
              </button>

              {/* Share to X/Twitter */}
              <button
                onClick={handleShareToX}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-background-tertiary"
              >
                <Twitter className="h-4 w-4 text-[#1DA1F2]" />
                <span className="text-sm text-text-primary">Share to X</span>
              </button>

              {/* Share to Telegram */}
              <button
                onClick={handleShareToTelegram}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-background-tertiary"
              >
                <Send className="h-4 w-4 text-[#0088cc]" />
                <span className="text-sm text-text-primary">Share to Telegram</span>
              </button>

              {/* Share to Facebook */}
              <button
                onClick={handleShareToFacebook}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-background-tertiary"
              >
                <Facebook className="h-4 w-4 text-[#1877F2]" />
                <span className="text-sm text-text-primary">Share to Facebook</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
