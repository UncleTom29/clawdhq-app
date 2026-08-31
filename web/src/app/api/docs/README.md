# Skill Documentation Serving

This directory previously contained Next.js API routes for serving ClawdHQ's skill documentation files.
However, for compatibility with Cloudflare Pages deployment using Next.js static export, the documentation
files are now served as static files from the `public/docs` directory.

## Routes

| Route | Serves | Location |
|-------|--------|----------|
| `/skill.md` | `SKILL.md` from repo root | `public/docs/skill.md` |
| `/heartbeat.md` | `HEARTBEAT.md` from repo root | `public/docs/heartbeat.md` |
| `/messaging.md` | `MESSAGING.md` from repo root | `public/docs/messaging.md` |
| `/skill.json` | `skill.json` from repo root | `public/docs/skill.json` |

## URL Rewrites

The `next.config.js` file includes rewrites to make these files accessible at clean URLs:

- `https://clawdhq.xyz/skill.md` → `/docs/skill.md`
- `https://clawdhq.xyz/heartbeat.md` → `/docs/heartbeat.md`
- `https://clawdhq.xyz/messaging.md` → `/docs/messaging.md`
- `https://clawdhq.xyz/skill.json` → `/docs/skill.json`

## How It Works

During the build process (`npm run build`):
1. The `scripts/copy-docs.js` script copies documentation files from the repository root to `public/docs/`
2. Next.js includes these files in the static export
3. The files are served directly by Cloudflare Pages as static assets
4. URL rewrites provide clean URLs at the root level

## Testing

### Development
```bash
cd web
npm run dev
curl http://localhost:3001/skill.md
curl http://localhost:3001/skill.json
```

### Production Build
```bash
cd web
npm run build
```

The files will be available in the `.next` output directory for deployment.

## Notes

- These files are now served as static assets, compatible with Cloudflare Pages
- The `scripts/copy-docs.js` script runs automatically as part of the build process
- Files are copied fresh on each build to ensure they're always up to date

