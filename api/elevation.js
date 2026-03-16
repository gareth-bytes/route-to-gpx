export default async function handler(req, res) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  try {
    const { points } = req.body;
    if (!points || !points.length) return res.status(400).json({ error: 'No points provided' });

    // Sample up to 200 points evenly for better interpolation accuracy
    const maxSamples = 200;
    const sampleIndices = [];
    if (points.length <= maxSamples) {
      for (let i = 0; i < points.length; i++) sampleIndices.push(i);
    } else {
      const step = (points.length - 1) / (maxSamples - 1);
      for (let i = 0; i < maxSamples; i++) sampleIndices.push(Math.round(i * step));
    }

    const sampled = sampleIndices.map(i => points[i]);
    const locations = sampled.map(p => `${p.lat},${p.lng}`).join('|');

    // Google Elevation API - may need multiple calls if >512 locations
    const batchSize = 512;
    let allElevations = [];

    for (let b = 0; b < sampled.length; b += batchSize) {
      const batch = sampled.slice(b, b + batchSize);
      const locs = batch.map(p => `${p.lat},${p.lng}`).join('|');
      const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${encodeURIComponent(locs)}&key=${apiKey}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status !== 'OK') {
        return res.status(400).json({ error: 'Elevation API error: ' + data.status });
      }
      allElevations.push(...data.results.map(r => Math.round(r.elevation)));
    }

    // Calculate cumulative distance for ALL original points
    const cumDists = [0];
    for (let i = 1; i < points.length; i++) {
      cumDists.push(cumDists[i - 1] + haversine(
        points[i - 1].lat, points[i - 1].lng,
        points[i].lat, points[i].lng
      ));
    }

    // Build sample table: index in original array -> elevation
    const sampleTable = sampleIndices.map((origIdx, i) => ({
      origIdx,
      cumDist: cumDists[origIdx],
      elevation: allElevations[i]
    }));

    // Interpolate elevation for EVERY point in the original array
    const allPointElevations = [];
    let si = 0; // current position in sampleTable

    for (let i = 0; i < points.length; i++) {
      const dist = cumDists[i];

      // Advance sample pointer
      while (si < sampleTable.length - 1 && sampleTable[si + 1].cumDist < dist) si++;

      if (si >= sampleTable.length - 1) {
        allPointElevations.push(sampleTable[sampleTable.length - 1].elevation);
      } else if (sampleTable[si].cumDist >= dist) {
        allPointElevations.push(sampleTable[si].elevation);
      } else {
        // Linear interpolation between sample[si] and sample[si+1]
        const d0 = sampleTable[si].cumDist;
        const d1 = sampleTable[si + 1].cumDist;
        const e0 = sampleTable[si].elevation;
        const e1 = sampleTable[si + 1].elevation;
        const frac = (d1 - d0) > 0 ? (dist - d0) / (d1 - d0) : 0;
        allPointElevations.push(Math.round(e0 + frac * (e1 - e0)));
      }
    }

    // Build profile from sampled points (for the chart)
    const profile = sampleTable.map(s => ({
      distance: Math.round(s.cumDist),
      elevation: s.elevation
    }));

    // Calculate ascent/descent from the interpolated data
    let ascent = 0, descent = 0;
    // Use sampled points to avoid noise from interpolation
    for (let i = 1; i < sampleTable.length; i++) {
      const diff = sampleTable[i].elevation - sampleTable[i - 1].elevation;
      if (diff > 0) ascent += diff;
      else descent += Math.abs(diff);
    }

    const minElev = Math.min(...allElevations);
    const maxElev = Math.max(...allElevations);

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      profile,
      allPointElevations,
      ascent: Math.round(ascent),
      descent: Math.round(descent),
      minElevation: minElev,
      maxElevation: maxElev
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
