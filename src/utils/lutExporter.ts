import { ColorAdjustments, LutData, LutInterpolationMode } from '../types';
import {
  applyColorAdjustmentsCpu,
  sampleLutTrilinearCpu,
  executeColorGradeCpu
} from '../color/colorPipeline';

export const EXPORT_LUT_PASSWORD = '0554318462';

// Re-export for any modules that import from lutExporter
export { applyColorAdjustmentsCpu };
export const sampleLutTrilinear = sampleLutTrilinearCpu;

export interface GenerateLutOptions {
  baseLut: LutData | null;
  lutEnabled: boolean;
  adjustments: ColorAdjustments;
  lutSize?: number; // Standard 33 or 17
  title?: string;
  interpolationMode?: LutInterpolationMode;
}

/**
 * Generates an industry-standard .cube file text with baked grading and 3D LUT
 */
export function generateGradedCubeText(options: GenerateLutOptions): string {
  const {
    baseLut,
    lutEnabled,
    adjustments,
    lutSize = 33,
    title = 'Graded_Look',
    interpolationMode = 'tetrahedral'
  } = options;

  const header = [
    '# Created by Nikon ZR Player & Colorist Suite',
    `# Base 3D LUT: ${baseLut ? baseLut.name : 'None (Primary Grade Only)'}`,
    `# LUT Mix Strength: ${lutEnabled && baseLut ? `${Math.round(adjustments.lutStrength * 100)}%` : 'Bypassed (0%)'}`,
    `# Interpolation Mode: ${interpolationMode === 'tetrahedral' ? 'Tetrahedral (Pro 4-Simplex)' : 'Trilinear (8-Tap)'}`,
    `# Adjustments: Exposure=${adjustments.exposure > 0 ? `+${adjustments.exposure.toFixed(2)}` : adjustments.exposure.toFixed(2)} EV, Contrast=${Math.round(adjustments.contrast * 100)}%, Saturation=${Math.round(adjustments.saturation * 100)}%`,
    `# Temperature=${adjustments.temperature}, Tint=${adjustments.tint}, Highlights=${adjustments.highlights}, Shadows=${adjustments.shadows}`,
    `TITLE "${title.replace(/["\r\n]/g, '')}"`,
    `LUT_3D_SIZE ${lutSize}`,
    'DOMAIN_MIN 0.0 0.0 0.0',
    'DOMAIN_MAX 1.0 1.0 1.0',
    ''
  ].join('\n');

  const rows: string[] = [];
  const maxIdx = lutSize - 1;

  // Adobe .cube standard order:
  // outer: B, middle: G, inner: R
  for (let b = 0; b < lutSize; b++) {
    const bin = b / maxIdx;
    for (let g = 0; g < lutSize; g++) {
      const gin = g / maxIdx;
      for (let r = 0; r < lutSize; r++) {
        const rin = r / maxIdx;

        // Unified Color Grade: primary adjustments -> 3D LUT -> strength blend
        const [finalR, finalG, finalB] = executeColorGradeCpu(
          [rin, gin, bin],
          adjustments,
          baseLut,
          lutEnabled,
          interpolationMode
        );

        rows.push(`${finalR.toFixed(6)} ${finalG.toFixed(6)} ${finalB.toFixed(6)}`);
      }
    }
  }

  return header + rows.join('\n') + '\n';
}

/**
 * Triggers a browser download of the generated .cube file
 */
export function downloadCubeFile(cubeText: string, filename: string): void {
  const cleanName = filename.endsWith('.cube') ? filename : `${filename}.cube`;
  const blob = new Blob([cubeText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
