import { LutData } from '../types';

export function parseCubeText(text: string, name: string): LutData {
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const rows: [number, number, number][] = [];

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    const key = parts[0].toUpperCase();

    if (key === 'TITLE') continue;
    if (key === 'LUT_3D_SIZE') {
      size = parseInt(parts[1], 10);
      continue;
    }
    if (key === 'DOMAIN_MIN') {
      domainMin = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
      continue;
    }
    if (key === 'DOMAIN_MAX') {
      domainMax = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
      continue;
    }
    if (key === 'LUT_1D_SIZE') {
      throw new Error('This player supports 3D .cube LUTs (LUT_3D_SIZE). 1D LUTs are not supported.');
    }

    if (parts.length >= 3 && parts.slice(0, 3).every(v => Number.isFinite(Number(v)))) {
      rows.push([Number(parts[0]), Number(parts[1]), Number(parts[2])]);
    }
  }

  if (!Number.isInteger(size) || size < 2 || size > 128) {
    throw new Error(`Missing or invalid LUT_3D_SIZE. Found size=${size}. Expected between 2 and 128.`);
  }

  const expectedCount = size * size * size;
  if (rows.length < expectedCount) {
    throw new Error(`Incomplete LUT data: expected ${expectedCount} RGB samples, found ${rows.length}.`);
  }

  // 2D atlas: width = size * size, height = size.
  // Each blue slice is laid out horizontally. Red is horizontal inner axis, Green is vertical axis.
  const width = size * size;
  const height = size;
  const data = new Uint8Array(width * height * 4);
  const floatData = new Float32Array(width * height * 4);

  let rowIndex = 0;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const rgb = rows[rowIndex++];
        const x = b * size + r;
        const y = g;
        const idx = (y * width + x) * 4;

        // Store exact 32-bit floating point RGB values for true 10-bit+ interpolation
        floatData[idx] = rgb[0];
        floatData[idx + 1] = rgb[1];
        floatData[idx + 2] = rgb[2];
        floatData[idx + 3] = 1.0;

        // Store 8-bit quantized fallback
        data[idx] = Math.round(Math.max(0, Math.min(1, rgb[0])) * 255);
        data[idx + 1] = Math.round(Math.max(0, Math.min(1, rgb[1])) * 255);
        data[idx + 2] = Math.round(Math.max(0, Math.min(1, rgb[2])) * 255);
        data[idx + 3] = 255;
      }
    }
  }

  return {
    name,
    size,
    domainMin,
    domainMax,
    data,
    floatData,
    rawCubeText: text,
    sourceType: 'custom',
    description: `3D .cube file · ${size}³ matrix`
  };
}

