
import { RadiusUnit, GeneratorParams } from '../types';

const EARTH_RADIUS_KM = 6371;

const toRadians = (deg: number) => (deg * Math.PI) / 180;
const toDegrees = (rad: number) => (rad * 180) / Math.PI;

export const generateKmlCircle = (params: GeneratorParams): string => {
  const { center, radius, unit, includeCenter } = params;

  // Parse Center
  const coords = center.split(',').map(c => parseFloat(c.trim()));
  if (coords.length < 2 || isNaN(coords[0]) || isNaN(coords[1])) {
    throw new Error('Invalid center coordinates. Please use format: latitude,longitude');
  }

  const [lat1, lon1] = coords;

  // Normalize radius to KM
  let dist = radius;
  if (unit === RadiusUnit.METERS) dist = radius / 1000;
  if (unit === RadiusUnit.MILES) dist = radius * 1.60934;

  const points: string[] = [];

  // If includeCenter is checked, add the center as the first point
  if (includeCenter) {
    points.push(`${lon1.toFixed(8)},${lat1.toFixed(8)}`);
  }

  const lat1Rad = toRadians(lat1);
  const lon1Rad = toRadians(lon1);
  const d_R = dist / EARTH_RADIUS_KM;

  // Generate 360 points + 1 to close the loop
  for (let bearing = 0; bearing <= 360; bearing++) {
    const bearingRad = toRadians(bearing);

    const lat2Rad = Math.asin(
      Math.sin(lat1Rad) * Math.cos(d_R) +
      Math.cos(lat1Rad) * Math.sin(d_R) * Math.cos(bearingRad)
    );

    const lon2Rad = lon1Rad + Math.atan2(
      Math.sin(bearingRad) * Math.sin(d_R) * Math.cos(lat1Rad),
      Math.cos(d_R) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
    );

    const lat2 = toDegrees(lat2Rad);
    const lon2 = toDegrees(lon2Rad);

    points.push(`${lon2.toFixed(8)},${lat2.toFixed(8)}`);
  }

  return points.join(' ');
};
