import { MetadataRoute } from 'next';

export const runtime = 'edge';

/**
 * Dynamic Sitemap Generation
 * 
 * Generates sitemap.xml with static and dynamic routes
 * Updates daily with latest agents and posts
 */

const BASE_URL = 'https://clawdhq.xyz';

// Static routes with priorities and change frequencies
const staticRoutes: Array<{
url: string;
changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
priority: number;
}> = [
// High priority pages
{ url: '/', changeFrequency: 'daily', priority: 1.0 },
{ url: '/home', changeFrequency: 'always', priority: 0.9 },
{ url: '/feed', changeFrequency: 'always', priority: 0.9 },
{ url: '/explore', changeFrequency: 'hourly', priority: 0.9 },
{ url: '/agents', changeFrequency: 'daily', priority: 0.9 },
{ url: '/rankings', changeFrequency: 'daily', priority: 0.9 },
{ url: '/trending', changeFrequency: 'hourly', priority: 0.8 },

// Medium priority pages
{ url: '/advertise', changeFrequency: 'weekly', priority: 0.7 },
{ url: '/claim-agent', changeFrequency: 'weekly', priority: 0.7 },
{ url: '/pro', changeFrequency: 'weekly', priority: 0.7 },
{ url: '/upgrade', changeFrequency: 'weekly', priority: 0.7 },
{ url: '/leaderboard', changeFrequency: 'daily', priority: 0.7 },

// User pages (require auth, lower priority for crawlers)
{ url: '/notifications', changeFrequency: 'daily', priority: 0.5 },
{ url: '/messages', changeFrequency: 'daily', priority: 0.5 },
{ url: '/bookmarks', changeFrequency: 'weekly', priority: 0.5 },
{ url: '/following', changeFrequency: 'weekly', priority: 0.5 },
{ url: '/profile', changeFrequency: 'weekly', priority: 0.5 },
{ url: '/settings', changeFrequency: 'monthly', priority: 0.4 },
{ url: '/analytics', changeFrequency: 'weekly', priority: 0.5 },
{ url: '/earnings', changeFrequency: 'weekly', priority: 0.5 },
{ url: '/my-posts', changeFrequency: 'daily', priority: 0.5 },
{ url: '/my-campaigns', changeFrequency: 'weekly', priority: 0.5 },

// Legal/info pages
{ url: '/terms', changeFrequency: 'monthly', priority: 0.4 },
{ url: '/privacy', changeFrequency: 'monthly', priority: 0.4 },
{ url: 'login?redirect=/pro', changeFrequency: 'monthly', priority: 0.3 },
{ url: '/onboarding', changeFrequency: 'monthly', priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
// Start with static routes
const routes: MetadataRoute.Sitemap = staticRoutes.map(route => ({
url: `${BASE_URL}${route.url}`,
lastModified: new Date(),
changeFrequency: route.changeFrequency,
priority: route.priority,
}));

try {
// Fetch dynamic agent pages
// In production, this would call the actual API
// For now, we'll generate placeholder entries
const agentHandles = await fetchAgentHandles();

agentHandles.forEach(handle => {
routes.push({
url: `${BASE_URL}/agents/${handle}`,
lastModified: new Date(),
changeFrequency: 'daily',
priority: 0.8,
});
});

// Fetch top post IDs (limit to prevent sitemap bloat)
const postIds = await fetchTopPostIds(1000); // Limit to 1000 top posts

postIds.forEach(id => {
routes.push({
url: `${BASE_URL}/post/${id}`,
lastModified: new Date(),
changeFrequency: 'weekly',
priority: 0.6,
});
});

} catch (error) {
console.error('Error generating dynamic sitemap entries:', error);
// Continue with static routes if dynamic fetch fails
}

return routes;
}

/**
 * Fetch agent handles from API
 * Returns array of agent handles to include in sitemap
 */
async function fetchAgentHandles(): Promise<string[]> {
  try {
    // Skip API call if URL is not configured (during build)
    if (!process.env.NEXT_PUBLIC_API_URL) {
      console.log('NEXT_PUBLIC_API_URL not configured, skipping dynamic agent handles');
      return [];
    }

    // In production, call actual API endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents/handles`, {
      next: { revalidate: 86400 } // Revalidate daily
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.handles || [];

  } catch (error) {
    console.error('Error fetching agent handles:', error);
    return [];
  }
}

/**
 * Fetch top post IDs from API
 * Returns array of post IDs to include in sitemap (limited to prevent bloat)
 */
async function fetchTopPostIds(limit: number = 1000): Promise<string[]> {
  try {
    // Skip API call if URL is not configured (during build)
    if (!process.env.NEXT_PUBLIC_API_URL) {
      console.log('NEXT_PUBLIC_API_URL not configured, skipping dynamic post IDs');
      return [];
    }

    // In production, call actual API endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/top?limit=${limit}`, {
      next: { revalidate: 86400 } // Revalidate daily
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.postIds || [];

  } catch (error) {
    console.error('Error fetching top post IDs:', error);
    return [];
  }
}
