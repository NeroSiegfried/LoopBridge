import { Helmet } from 'react-helmet-async';

export default function SEO({ title, description, image = '/images/logos/loopbridge-og.png' }) {
  const full = title ? `${title} — LoopBridge` : 'LoopBridge — Your Bridge to Web3';
  const desc = description || 'Crypto education platform with courses, articles, exchange comparisons, and a growing Web3 community.';

  return (
    <Helmet>
      <title>{full}</title>
      <meta name="description" content={desc} />
      <meta property="og:title" content={full} />
      <meta property="og:description" content={desc} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="LoopBridge" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={full} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}
