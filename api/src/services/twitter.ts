const TWITTER_API_BASE_URL = 'https://api.twitter.com/2';
const TWITTER_SYNDICATION_BASE_URL = 'https://cdn.syndication.twimg.com';
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || '';

export class TwitterVerificationError extends Error {
    code: string;
    status: number;

    constructor(code: string, message: string, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

export interface VerifiedTweet {
    id: string;
    text: string;
    authorId: string | null;
    authorHandle: string | null;
    authorName: string | null;
    authorAvatar: string | null;
}

function requireTwitterToken() {
    if (!TWITTER_BEARER_TOKEN) {
        throw new TwitterVerificationError(
            'TWITTER_NOT_CONFIGURED',
            'TWITTER_BEARER_TOKEN is required for claim verification.',
            503,
        );
    }
}

function normalizeTweet(tweet: any, includes?: any): VerifiedTweet {
    const user = includes?.users?.find((item: any) => item.id === tweet.author_id) ?? null;

    return {
        id: String(tweet.id),
        text: String(tweet.text || ''),
        authorId: tweet.author_id ? String(tweet.author_id) : null,
        authorHandle: user?.username ? String(user.username) : null,
        authorName: user?.name ? String(user.name) : null,
        authorAvatar: user?.profile_image_url ? String(user.profile_image_url) : null,
    };
}

async function twitterFetch(path: string) {
    requireTwitterToken();

    const response = await fetch(`${TWITTER_API_BASE_URL}${path}`, {
        headers: {
            Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new TwitterVerificationError(
            'TWITTER_REQUEST_FAILED',
            errorText || 'Twitter API request failed.',
            response.status,
        );
    }

    return response.json() as Promise<any>;
}

async function fetchTweetFromSyndication(tweetId: string) {
    const response = await fetch(`${TWITTER_SYNDICATION_BASE_URL}/tweet-result?id=${encodeURIComponent(tweetId)}&token=x`);

    if (!response.ok) {
        const errorText = await response.text();
        throw new TwitterVerificationError(
            'TWITTER_REQUEST_FAILED',
            errorText || 'Tweet could not be loaded from public syndication.',
            response.status,
        );
    }

    const data = await response.json() as any;
    if (!data?.id_str || !data?.text) {
        throw new TwitterVerificationError('TWEET_NOT_FOUND', 'Tweet could not be loaded from X.', 404);
    }

    return {
        id: String(data.id_str),
        text: String(data.text),
        authorId: data.user?.id_str ? String(data.user.id_str) : null,
        authorHandle: data.user?.screen_name ? String(data.user.screen_name) : null,
        authorName: data.user?.name ? String(data.user.name) : null,
        authorAvatar: data.user?.profile_image_url_https ? String(data.user.profile_image_url_https) : null,
    } satisfies VerifiedTweet;
}

export function extractTweetId(tweetUrl: string) {
    const match = tweetUrl.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i);
    return match?.[1] || null;
}

export async function fetchTweetFromUrl(tweetUrl: string) {
    const tweetId = extractTweetId(tweetUrl);
    if (!tweetId) {
        throw new TwitterVerificationError(
            'INVALID_TWEET_URL',
            'Tweet URL must look like https://x.com/user/status/1234567890.',
        );
    }

    if (TWITTER_BEARER_TOKEN) {
        try {
            const data = await twitterFetch(
                `/tweets/${tweetId}?tweet.fields=text,author_id,created_at&expansions=author_id&user.fields=username,name,profile_image_url`,
            );

            if (!data?.data) {
                throw new TwitterVerificationError('TWEET_NOT_FOUND', 'Tweet could not be loaded from X.', 404);
            }

            return normalizeTweet(data.data, data.includes);
        } catch (error) {
            if (!(error instanceof TwitterVerificationError)) {
                throw error;
            }
        }
    }

    return fetchTweetFromSyndication(tweetId);
}

export async function searchRecentVerificationTweet(verificationCode: string, agentHandle: string) {
    const query = `"${verificationCode}" ("@${agentHandle}" OR "${agentHandle}" OR "@ClawdHQ")`;
    const params = new URLSearchParams({
        query,
        max_results: '10',
        'tweet.fields': 'text,author_id,created_at',
        expansions: 'author_id',
        'user.fields': 'username,name,profile_image_url',
        sort_order: 'recency',
    });

    const data = await twitterFetch(`/tweets/search/recent?${params.toString()}`);
    const tweet = data?.data?.[0];

    if (!tweet) {
        return null;
    }

    return normalizeTweet(tweet, data.includes);
}

export function ensureTweetContainsClaimProof(params: {
    tweetText: string;
    verificationCode: string;
    agentHandle: string;
}) {
    const normalizedText = params.tweetText.toLowerCase();
    const normalizedHandle = params.agentHandle.toLowerCase();
    const normalizedCode = params.verificationCode.toLowerCase();

    if (!normalizedText.includes(normalizedCode)) {
        throw new TwitterVerificationError(
            'VERIFICATION_CODE_MISSING',
            `Tweet does not contain verification code "${params.verificationCode}".`,
        );
    }

    if (!normalizedText.includes(normalizedHandle) && !normalizedText.includes('@clawdhq')) {
        throw new TwitterVerificationError(
            'AGENT_HANDLE_MISSING',
            `Tweet must mention ${params.agentHandle} or @ClawdHQ.`,
        );
    }
}
