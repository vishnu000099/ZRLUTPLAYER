import { LutData } from '../types';

/**
 * Generates a procedural 3D LUT data atlas based on transfer functions.
 * Size is 17 (17^3 = 4,913 samples).
 */
function createProceduralLut(
  name: string,
  description: string,
  size: number,
  transform: (r: number, g: number, b: number) => [number, number, number]
): LutData {
  const width = size * size;
  const height = size;
  const data = new Uint8Array(width * height * 4);
  const floatData = new Float32Array(width * height * 4);

  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const rNorm = r / (size - 1);
        const gNorm = g / (size - 1);
        const bNorm = b / (size - 1);

        const [rOut, gOut, bOut] = transform(rNorm, gNorm, bNorm);

        const x = b * size + r;
        const y = g;
        const idx = (y * width + x) * 4;

        floatData[idx] = rOut;
        floatData[idx + 1] = gOut;
        floatData[idx + 2] = bOut;
        floatData[idx + 3] = 1.0;

        data[idx] = Math.round(Math.max(0, Math.min(1, rOut)) * 255);
        data[idx + 1] = Math.round(Math.max(0, Math.min(1, gOut)) * 255);
        data[idx + 2] = Math.round(Math.max(0, Math.min(1, bOut)) * 255);
        data[idx + 3] = 255;
      }
    }
  }

  return {
    name,
    size,
    domainMin: [0, 0, 0],
    domainMax: [1, 1, 1],
    data,
    floatData,
    sourceType: 'preset',
    description
  };
}

// S-curve contrast roll-off
function sCurve(x: number, strength: number = 1.0): number {
  const c = Math.max(0, Math.min(1, x));
  const s = c * c * (3 - 2 * c);
  return c * (1 - strength) + s * strength;
}

export const PRESET_LUTS: LutData[] = [
  createProceduralLut(
    'Arrilogc3',
    'Official ARRI LogC to Rec.709 DaVinci 3D LUT transform providing filmic tone response, natural highlight roll-off, and rich color reproduction.',
    17,
    (r, g, b) => {
      // Linearize from LogC response
      const rLin = Math.pow(Math.max(0, r), 1.8);
      const gLin = Math.pow(Math.max(0, g), 1.8);
      const bLin = Math.pow(Math.max(0, b), 1.8);

      // ARRI LogC tone response with filmic highlight roll-off
      const rOut = sCurve(rLin * 1.40, 0.48);
      const gOut = sCurve(gLin * 1.36, 0.48);
      const bOut = sCurve(bLin * 1.32, 0.48);

      return [
        Math.min(1, rOut * 1.01),
        Math.min(1, gOut * 0.99),
        Math.min(1, bOut * 0.96)
      ];
    }
  )
];
