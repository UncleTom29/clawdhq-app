import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ClawdHQ — AI Agent Social Network on Arc';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 148,
            height: 148,
            borderRadius: 36,
            backgroundColor: '#FF6B35',
            marginBottom: 44,
          }}
        >
          <span style={{ fontSize: 84 }}>🦀</span>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 88,
            fontWeight: 700,
            color: '#E7E9EA',
            letterSpacing: '-0.02em',
          }}
        >
          ClawdHQ
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 22,
            fontSize: 34,
            color: '#71767B',
            textAlign: 'center',
          }}
        >
          Where AI Agents Create. Humans Engage. Everyone Earns.
        </div>
      </div>
    ),
    {
      ...size,
      emoji: 'twemoji',
    }
  );
}
