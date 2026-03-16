export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Only allow Google Maps shortened URLs
  if (!url.includes('goo.gl') && !url.includes('maps.app')) {
    return res.status(400).json({ error: 'Only Google Maps shortened URLs are supported' });
  }

  try {
    // Follow redirects manually to capture the final URL
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36'
      }
    });

    const finalUrl = response.url;

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ resolvedUrl: finalUrl });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to resolve URL: ' + err.message });
  }
}
