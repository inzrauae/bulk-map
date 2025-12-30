
export enum RadiusUnit {
  KILOMETERS = 'Kilometers',
  METERS = 'Meters',
  MILES = 'Miles'
}

export enum GeometryType {
  MULTIGEOMETRY = 'MultiGeometry',
  POLYGON = 'Polygon'
}

export interface GeneratorParams {
  center: string;
  radius: number;
  unit: RadiusUnit;
  geometry: GeometryType;
  includeCenter: boolean;
}
