export default async function handler(req, res) {
  const { origin, destination, waypoints, mode } = req.query;

  if (!origin || !destination) {
    return res.status(400).json({ error: 'Missing origin or destination' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Google Maps API key not configured on server' });
  }

  try {
    const params = new URLSearchParams({
      origin,
      destination,
      mode: (mode || 'bicycling').toLowerCase(),
      key: apiKey,
      units: 'metric'
    });

    if (waypoints) {
      params.set('waypoints', waypoints);
    }

    const resp = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`
    );
    const data = await resp.json();

    if (data.status !== 'OK') {
      const msgs = {
        REQUEST_DENIED: 'API key issue on server — contact the site owner.',
        ZERO_RESULTS: 'No route found between those locations.',
        NOT_FOUND: 'Could not find one of the locations.',
        OVER_QUERY_LIMIT: 'API rate limit hit — try again in a moment.',
        MAX_WAYPOINTS_EXCEEDED: 'Too many waypoints (max 25).'
      };
      return res.status(400).json({
        error: msgs[data.status] || 'Route calculation failed: ' + data.status
      });
    }

    // Extract the route points by decoding the polyline from each step
    const points = [];
    let totalDist = 0;
    let totalDur = 0;

    for (const leg of data.routes[0].legs) {
      totalDist += leg.distance.value;
      totalDur += leg.duration.value;

      for (const step of leg.steps) {
        if (step.polyline && step.polyline.points) {
          const decoded = decodePolyline(step.polyline.points);
          points.push(...decoded);
        }
      }
    }

    // Fallback to overview polyline
    if (points.length === 0 && data.routes[0].overview_polyline) {
      const decoded = decodePolyline(data.routes[0].overview_polyline.points);
      points.push(...decoded);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      points,
      distanceMeters: totalDist,
      durationSeconds: totalDur
    });

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}

// Decode Google's encoded polyline format
function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}
