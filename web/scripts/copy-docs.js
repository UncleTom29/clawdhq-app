#!/usr/bin/env node

/**
 * Script to copy documentation files to the public directory for static serving
 * This is required for Cloudflare Pages deployment with Next.js static export
 */

const fs = require('fs');
const path = require('path');

// Files to copy from repository root to public/docs
const filesToCopy = [
  { source: 'SKILL.md', dest: 'skill.md' },
  { source: 'HEARTBEAT.md', dest: 'heartbeat.md' },
  { source: 'MESSAGING.md', dest: 'messaging.md' },
  { source: 'skill.json', dest: 'skill.json' },
];

const repoRoot = path.join(__dirname, '../../');
const publicDocsDir = path.join(__dirname, '../public/docs');

// Ensure public/docs directory exists
if (!fs.existsSync(publicDocsDir)) {
  fs.mkdirSync(publicDocsDir, { recursive: true });
}

// Copy each file to public/docs and public/
filesToCopy.forEach(({ source, dest }) => {
  const sourcePath = path.join(repoRoot, source);
  const destPath = path.join(publicDocsDir, dest);
  const publicRootPath = path.join(__dirname, '../public', source);

  try {
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      fs.copyFileSync(sourcePath, publicRootPath);
      console.log(`✓ Copied ${source} → public/docs/${dest} & public/${source}`);
    } else {
      console.warn(`⚠ Warning: ${source} not found at ${sourcePath}`);
    }
  } catch (error) {
    console.error(`✗ Error copying ${source}:`, error.message);
    process.exit(1);
  }
});

console.log('\n✓ Documentation files copied successfully');
