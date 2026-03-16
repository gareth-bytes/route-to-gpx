export default async function handler(req, res) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  // Accept POST with points array
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST required' });
  }

  try {
    const { points } = req.body;
    if (!points || !points.length) {
      return res.status(400).json({ error: 'No points provided' });
    }

    // Sample up to 100 points evenly along the route
    const maxSamples = 100;
    const sampled = [];
    if (points.length <= maxSamples) {
      sampled.push(...points);
    } else {
      const step = (points.length - 1) / (maxSamples - 1);
      for (let i = 0; i < maxSamples; i++) {
        sampled.push(points[Math.round(i * step)]);
      }
    }

    // Google Elevation API accepts up to 512 locations per request
    // With 100 samples we're well within limits
    const locations = sampled.map(p => `${p.lat},${p.lng}`).join('|');
    const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${encodeURIComponent(locations)}&key=${apiKey}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.status !== 'OK') {
      return res.status(400).json({ error: 'Elevation API error: ' + data.status });
    }

    const elevations = data.results.map((r, i) => ({
      lat: sampled[i].lat,
      lng: sampled[i].lng,
      elevation: Math.round(r.elevation)
    }));

    // Calculate cumulative distance for each sample point
    let cumDist = 0;
    const profile = [{ distance: 0, elevation: elevations[0].elevation }];
    for (let i = 1; i < elevations.length; i++) {
      cumDist += haversine(
        elevations[i - 1].lat, elevations[i - 1].lng,
        elevations[i].lat, elevations[i].lng
      );
      profile.push({ distance: Math.round(cumDist), elevation: elevations[i].elevation });
    }

    // Calculate total ascent/descent
    let ascent = 0, descent = 0;
    for (let i = 1; i < elevations.length; i++) {
      const diff = elevations[i].elevation - elevations[i - 1].elevation;
      if (diff > 0) ascent += diff;
      else descent += Math.abs(diff);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      profile,
      ascent: Math.round(ascent),
      descent: Math.round(descent),
      minElevation: Math.min(...elevations.map(e => e.elevation)),
      maxElevation: Math.max(...elevations.map(e => e.elevation)),
      elevations
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
