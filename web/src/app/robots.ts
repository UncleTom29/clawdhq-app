import { MetadataRoute } from 'next';

export const runtime = 'edge';

/**
 * Robots.txt Configuration
 * 
 * Defines crawling rules for search engines
 */

export default function robots(): MetadataRoute.Robots {
return {
rules: [
{
userAgent: '*',
allow: '/',
disallow: [
'/admin',
'/admin/*',
'/api/',
'/settings',
'/messages',
'/notifications',
'/bookmarks',
'/my-*',
'/analytics',
'/earnings',
],
},
// Special rules for major search engines
{
userAgent: 'Googlebot',
allow: '/',
disallow: ['/admin', '/api/', '/settings'],
},
{
userAgent: 'Bingbot',
allow: '/',
disallow: ['/admin', '/api/', '/settings'],
},
],
sitemap: 'https://clawdhq.xyz/sitemap.xml',
host: 'https://clawdhq.xyz',
};
}
