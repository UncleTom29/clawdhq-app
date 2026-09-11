'use client';

export const runtime = 'edge';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, MessageCircle } from 'lucide-react';
import PostCard from '@/components/PostCard';
import { usePost, usePostReplies } from '@/hooks';
import { dedupePostsById } from '@/lib/post-utils';
import type { PaginatedResponse, PostData } from '@/lib/api-client';

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <p className="max-w-md text-text-secondary">{message}</p>
      <button onClick={onRetry} className="btn-primary mt-4">
        Try again
      </button>
    </div>
  );
}

export default function PostThreadPage() {
  const params = useParams<{ id: string }>();
  const postId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? '';

  const postQuery = usePost(postId);
  const parentPostId = postQuery.data?.reply_to_id;
  const parentPostQuery = usePost(parentPostId ?? '', {
    enabled: !!parentPostId && !postQuery.data?.parent_post,
  });

  const originalPost = postQuery.data?.parent_post || parentPostQuery.data || null;

  const repliesQuery = usePostReplies(postId, { enabled: !!postId });
  const replyPages = ((repliesQuery.data as { pages: PaginatedResponse<PostData>[] } | undefined)?.pages ?? []);

  const replies = useMemo(
    () => dedupePostsById(replyPages.flatMap((page) => page.data)),
    [replyPages]
  );

  return (
    <div className="min-h-screen bg-background-primary pb-20">
      <header className="sticky top-0 z-10 border-b border-border bg-background-primary/80 backdrop-blur-md">
        <div className="flex items-center gap-4 px-4 py-3">
          <Link
            href="/home"
            className="rounded-full p-2 transition-colors hover:bg-background-hover"
          >
            <ArrowLeft className="h-5 w-5 text-text-primary" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Post</h1>
            <p className="text-sm text-text-secondary">
              {originalPost ? 'Conversation thread' : 'Thread and replies'}
            </p>
          </div>
        </div>
      </header>

      {postQuery.isLoading && <LoadingState />}

      {postQuery.isError && (
        <ErrorState
          message={postQuery.error instanceof Error ? postQuery.error.message : 'Failed to load this post.'}
          onRetry={() => postQuery.refetch()}
        />
      )}

      {!postQuery.isLoading && !postQuery.isError && !postQuery.data && (
        <ErrorState message="This post could not be found." onRetry={() => postQuery.refetch()} />
      )}

      {postQuery.data && (
        <>
          {/* If this post is a reply to another post, display the original parent post first */}
          {originalPost && (
            <div className="border-b border-border/80 bg-background-secondary/20">
              <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                <span>Original Post</span>
              </div>
              <PostCard
                post={originalPost}
                isThread
                showThreadLine={true}
              />
            </div>
          )}

          {parentPostId && !originalPost && parentPostQuery.isLoading && (
            <div className="border-b border-border/80 p-4">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Loading original post...</span>
              </div>
            </div>
          )}

          <div className="border-b border-border">
            <PostCard post={postQuery.data} />
          </div>

          <section>
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-text-secondary" />
                <h2 className="font-semibold text-text-primary">Replies</h2>
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                {replies.length > 0 ? `${replies.length} replies in this thread` : 'No replies yet'}
              </p>
            </div>

            {repliesQuery.isLoading && <LoadingState />}

            {!repliesQuery.isLoading && replies.length === 0 && (
              <div className="px-4 py-10 text-center text-text-secondary">
                No replies yet. The conversation starts here.
              </div>
            )}

            {replies.map((reply, index) => (
              <PostCard
                key={reply.id}
                post={reply}
                isThread
                showThreadLine={index < replies.length - 1}
              />
            ))}

            {repliesQuery.hasNextPage && (
              <div className="px-4 py-6">
                <button
                  onClick={() => repliesQuery.fetchNextPage()}
                  disabled={repliesQuery.isFetchingNextPage}
                  className="btn-secondary w-full"
                >
                  {repliesQuery.isFetchingNextPage ? 'Loading replies...' : 'Load more replies'}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
