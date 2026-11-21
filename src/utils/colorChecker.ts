import { ChartCorners, ColorCheckerAnalysis, PatchSample, Point2D, ChartType, VideoChartTelemetry } from '../types';

/**
 * X-Rite ColorChecker Classic (24-patch) reference values
 * Measured under D50 illumination (Standard 2014 revision)
 * Layout: 4 rows x 6 columns
 * Row 1: Saturated colors (0 - 5)
 * Row 2: Saturated colors (6 - 11)
 * Row 3: Saturated colors (12 - 17)
 * Row 4: Grayscale ramp (18 - 23: White -> Black)
 */
export interface PatchReference {
  index: number;
  row: number;
  col: number;
  name: string;
  isNeutral: boolean;
  category?: 'skin' | 'grayscale' | 'chromatic' | 'limit';
  targetIRE?: number;
  labD50: [number, number, number]; // [L*, a*, b*]
  srgbD65: [number, number, number]; // [R, G, B] in [0, 255]
}

export const COLORCHECKER_24_REFERENCES: PatchReference[] = [
  // Row 1
  { index: 0, row: 0, col: 0, name: 'Dark skin', isNeutral: false, labD50: [37.986, 13.555, 14.059], srgbD65: [115, 82, 68] },
  { index: 1, row: 0, col: 1, name: 'Light skin', isNeutral: false, labD50: [65.711, 18.130, 17.810], srgbD65: [194, 150, 130] },
  { index: 2, row: 0, col: 2, name: 'Blue sky', isNeutral: false, labD50: [49.927, -4.880, -21.925], srgbD65: [98, 122, 157] },
  { index: 3, row: 0, col: 3, name: 'Foliage', isNeutral: false, labD50: [43.139, -13.095, 21.905], srgbD65: [87, 108, 67] },
  { index: 4, row: 0, col: 4, name: 'Blue flower', isNeutral: false, labD50: [55.112, 8.844, -25.399], srgbD65: [133, 128, 177] },
  { index: 5, row: 0, col: 5, name: 'Bluish green', isNeutral: false, labD50: [70.719, -33.397, -0.199], srgbD65: [103, 189, 170] },

  // Row 2
  { index: 6, row: 1, col: 0, name: 'Orange', isNeutral: false, labD50: [62.661, 36.067, 57.096], srgbD65: [214, 126, 44] },
  { index: 7, row: 1, col: 1, name: 'Purplish blue', isNeutral: false, labD50: [40.020, 10.410, -45.964], srgbD65: [80, 91, 166] },
  { index: 8, row: 1, col: 2, name: 'Moderate red', isNeutral: false, labD50: [51.124, 48.239, 16.248], srgbD65: [193, 90, 99] },
  { index: 9, row: 1, col: 3, name: 'Purple', isNeutral: false, labD50: [30.325, 22.976, -21.587], srgbD65: [94, 60, 108] },
  { index: 10, row: 1, col: 4, name: 'Yellow green', isNeutral: false, labD50: [72.532, -23.709, 57.255], srgbD65: [157, 188, 64] },
  { index: 11, row: 1, col: 5, name: 'Orange yellow', isNeutral: false, labD50: [71.941, 19.363, 67.857], srgbD65: [224, 163, 46] },

  // Row 3
  { index: 12, row: 2, col: 0, name: 'Blue', isNeutral: false, labD50: [28.778, 14.179, -50.297], srgbD65: [56, 61, 150] },
  { index: 13, row: 2, col: 1, name: 'Green', isNeutral: false, labD50: [55.261, -38.342, 31.370], srgbD65: [70, 148, 73] },
  { index: 14, row: 2, col: 2, name: 'Red', isNeutral: false, labD50: [42.101, 53.378, 28.190], srgbD65: [175, 54, 60] },
  { index: 15, row: 2, col: 3, name: 'Yellow', isNeutral: false, labD50: [81.733, 4.039, 79.819], srgbD65: [231, 199, 31] },
  { index: 16, row: 2, col: 4, name: 'Magenta', isNeutral: false, labD50: [51.935, 49.986, -14.574], srgbD65: [187, 86, 149] },
  { index: 17, row: 2, col: 5, name: 'Cyan', isNeutral: false, labD50: [51.038, -28.631, -28.638], srgbD65: [8, 133, 161] },

  // Row 4: Neutral Grayscale Ramp
  { index: 18, row: 3, col: 0, name: 'White 9.5 (.05 D)', isNeutral: true, labD50: [96.539, -0.425, 1.186], srgbD65: [243, 243, 242] },
  { index: 19, row: 3, col: 1, name: 'Neutral 8 (.23 D)', isNeutral: true, labD50: [81.257, -0.638, -0.335], srgbD65: [200, 200, 200] },
  { index: 20, row: 3, col: 2, name: 'Neutral 6.5 (.44 D)', isNeutral: true, labD50: [66.766, -0.734, -0.504], srgbD65: [160, 160, 160] },
  { index: 21, row: 3, col: 3, name: 'Neutral 5 (.70 D)', isNeutral: true, labD50: [50.867, -0.153, -0.270], srgbD65: [122, 122, 121] }, // 18% Gray standard
  { index: 22, row: 3, col: 4, name: 'Neutral 3.5 (1.05 D)', isNeutral: true, labD50: [35.656, -0.421, -1.231], srgbD65: [85, 85, 85] },
  { index: 23, row: 3, col: 5, name: 'Black 2 (1.5 D)', isNeutral: true, labD50: [20.461, -0.079, -0.973], srgbD65: [52, 52, 52] }
];

/**
 * Datacolor SpyderCHECKR 24 reference values
 * Defined according to Datacolor SpyderCheckr Color Data V2 specifications (D65)
 * Layout: 4 rows x 6 columns
 * Row 1: Natural & Skin Tones (Classic dark skin, Classic light skin, Steel blue, Evergreen, Lavender, Aqua)
 * Row 2: Chromatic tones (Sunflower, Apple green, Violet, Pink, Blueprint, Primary orange)
 * Row 3: Saturated primaries & secondaries (Primary blue, Primary green, Primary red, Primary yellow, Primary magenta, Primary cyan)
 * Row 4: Neutral grayscale ramp (Card black, 80% gray, 60% gray, 40% gray, 20% gray, Card white)
 */
export const SPYDERCHECKR_24_REFERENCES: PatchReference[] = [
  // Row 1 (Row 0): Natural & Skin tones
  { index: 0, row: 0, col: 0, name: 'Classic dark skin', isNeutral: false, category: 'skin', labD50: [35.870, 13.115, 15.639], srgbD65: [112, 76, 60] },
  { index: 1, row: 0, col: 1, name: 'Classic light skin', isNeutral: false, category: 'skin', labD50: [64.647, 16.986, 18.329], srgbD65: [197, 145, 125] },
  { index: 2, row: 0, col: 2, name: 'Steel blue', isNeutral: false, category: 'chromatic', labD50: [49.283, -2.122, -22.558], srgbD65: [87, 120, 155] },
  { index: 3, row: 0, col: 3, name: 'Evergreen', isNeutral: false, category: 'chromatic', labD50: [41.888, -17.892, 22.967], srgbD65: [82, 106, 60] },
  { index: 4, row: 0, col: 4, name: 'Lavender', isNeutral: false, category: 'chromatic', labD50: [54.195, 11.594, -25.790], srgbD65: [126, 125, 174] },
  { index: 5, row: 0, col: 5, name: 'Aqua', isNeutral: false, category: 'chromatic', labD50: [70.097, -31.864, 2.399], srgbD65: [98, 187, 166] },

  // Row 2 (Row 1): Intermediate Chromatics
  { index: 6, row: 1, col: 0, name: 'Sunflower', isNeutral: false, category: 'chromatic', labD50: [71.355, 20.718, 71.841], srgbD65: [238, 158, 25] },
  { index: 7, row: 1, col: 1, name: 'Apple green', isNeutral: false, category: 'chromatic', labD50: [71.826, -28.729, 60.736], srgbD65: [157, 188, 54] },
  { index: 8, row: 1, col: 2, name: 'Violet', isNeutral: false, category: 'chromatic', labD50: [29.174, 21.460, -23.937], srgbD65: [83, 58, 106] },
  { index: 9, row: 1, col: 3, name: 'Pink', isNeutral: false, category: 'chromatic', labD50: [49.525, 47.742, 14.842], srgbD65: [195, 79, 95] },
  { index: 10, row: 1, col: 4, name: 'Blueprint', isNeutral: false, category: 'chromatic', labD50: [38.518, 12.240, -41.945], srgbD65: [58, 88, 159] },
  { index: 11, row: 1, col: 5, name: 'Primary orange', isNeutral: false, category: 'chromatic', labD50: [60.423, 35.236, 60.411], srgbD65: [222, 118, 32] },

  // Row 3 (Row 2): Primaries & Secondaries
  { index: 12, row: 2, col: 0, name: 'Primary blue', isNeutral: false, category: 'chromatic', labD50: [25.826, 20.326, -47.852], srgbD65: [25, 55, 135] },
  { index: 13, row: 2, col: 1, name: 'Primary green', isNeutral: false, category: 'chromatic', labD50: [53.811, -44.015, 35.299], srgbD65: [57, 146, 64] },
  { index: 14, row: 2, col: 2, name: 'Primary red', isNeutral: false, category: 'chromatic', labD50: [40.280, 60.735, 29.359], srgbD65: [186, 26, 51] },
  { index: 15, row: 2, col: 3, name: 'Primary yellow', isNeutral: false, category: 'chromatic', labD50: [95.071, -23.287, 92.617], srgbD65: [245, 250, 0] },
  { index: 16, row: 2, col: 4, name: 'Primary magenta', isNeutral: false, category: 'chromatic', labD50: [49.841, 54.221, -14.813], srgbD65: [192, 75, 145] },
  { index: 17, row: 2, col: 5, name: 'Primary cyan', isNeutral: false, category: 'chromatic', labD50: [49.106, -17.550, -25.372], srgbD65: [0, 127, 159] },

  // Row 4 (Row 3): Neutral Grayscale Ramp (Datacolor reference values)
  { index: 18, row: 3, col: 0, name: 'Card black', isNeutral: true, category: 'grayscale', labD50: [16.864, 1.383, -0.981], srgbD65: [43, 41, 43], targetIRE: 5 },
  { index: 19, row: 3, col: 1, name: '80% gray', isNeutral: true, category: 'grayscale', labD50: [33.968, -0.427, 1.176], srgbD65: [80, 80, 78], targetIRE: 20 },
  { index: 20, row: 3, col: 2, name: '60% gray', isNeutral: true, category: 'grayscale', labD50: [49.924, 1.136, 1.642], srgbD65: [122, 118, 116], targetIRE: 40 },
  { index: 21, row: 3, col: 3, name: '40% gray', isNeutral: true, category: 'grayscale', labD50: [64.982, 0.889, 2.079], srgbD65: [161, 157, 154], targetIRE: 60 },
  { index: 22, row: 3, col: 4, name: '20% gray', isNeutral: true, category: 'grayscale', labD50: [80.115, 0.848, 1.990], srgbD65: [202, 198, 195], targetIRE: 80 },
  { index: 23, row: 3, col: 5, name: 'Card white', isNeutral: true, category: 'grayscale', labD50: [95.921, 1.653, 2.756], srgbD65: [249, 242, 238], targetIRE: 100 }
];

/**
 * Calibrite / X-Rite ColorChecker Video Target Reference Values (Rec.709 Nominal RGB 0-255)
 * Layout:
 * 1. Skin Tone Chips (Left Column - 6 patches): Anchors vectorscope skin line (I-axis ~123°)
 * 2. Large Grayscale Ramp (Center - 4 wide horizontal bars): White (100 IRE), 40 IRE Gray, Dark Gray, Black
 * 3. Chromatic Color Chips (Right Column - 6 pairs / 12 patches): Saturated & desaturated SMPTE video colors
 * 4. Highlight/Shadow Limits (Corner chips): Glossy Black & High-End White for clipping limits
 */
export const COLORCHECKER_VIDEO_REFERENCE = {
  skinTones: [
    { name: "Light Skin 1", rgb: [218, 168, 144] as [number, number, number] },
    { name: "Dark Skin 2", rgb: [192, 133, 107] as [number, number, number] },
    { name: "Light Skin 3", rgb: [167, 110, 85] as [number, number, number] },
    { name: "Dark Skin 4", rgb: [149, 93, 71] as [number, number, number] },
    { name: "Light Skin 5", rgb: [129, 75, 55] as [number, number, number] },
    { name: "Dark Skin 6", rgb: [106, 59, 43] as [number, number, number] }
  ],
  grayscale: [
    { name: "White (Max Highlight)", rgb: [242, 242, 242] as [number, number, number], targetIRE: 100 },
    { name: "Light Gray (40 IRE Midtone)", rgb: [160, 160, 160] as [number, number, number], targetIRE: 40 },
    { name: "Dark Gray", rgb: [85, 85, 85] as [number, number, number], targetIRE: 25 },
    { name: "Black (Shadow Clip)", rgb: [26, 26, 26] as [number, number, number], targetIRE: 0 }
  ],
  chromatic: [
    { name: "Yellow", rgb: [237, 225, 63] as [number, number, number] },
    { name: "Yellow (Desat)", rgb: [189, 183, 116] as [number, number, number] },
    { name: "Red", rgb: [219, 78, 76] as [number, number, number] },
    { name: "Red (Desat)", rgb: [159, 87, 85] as [number, number, number] },
    { name: "Magenta", rgb: [204, 119, 201] as [number, number, number] },
    { name: "Magenta (Desat)", rgb: [155, 107, 153] as [number, number, number] },
    { name: "Blue", rgb: [89, 109, 199] as [number, number, number] },
    { name: "Blue (Desat)", rgb: [97, 105, 149] as [number, number, number] },
    { name: "Cyan", rgb: [124, 212, 219] as [number, number, number] },
    { name: "Cyan (Desat)", rgb: [111, 157, 161] as [number, number, number] },
    { name: "Green", rgb: [114, 191, 86] as [number, number, number] },
    { name: "Green (Desat)", rgb: [109, 143, 98] as [number, number, number] }
  ]
};

export interface VideoPatchLayoutSpec {
  index: number;
  name: string;
  category: 'skin' | 'grayscale' | 'chromatic' | 'limit';
  isNeutral: boolean;
  targetIRE?: number;
  srgbD65: [number, number, number];
  uvCenter: [number, number]; // [u, v] inside chart quad
  isWideBar?: boolean;
}

// 32 patches spanning the full Calibrite ColorChecker Video production layout
export const COLORCHECKER_VIDEO_PATCHES: VideoPatchLayoutSpec[] = [
  // Left Column 0: Skin Tone Chips (top to bottom)
  { index: 0, name: 'Dark Skin 6', category: 'skin', isNeutral: false, srgbD65: [106, 59, 43], uvCenter: [0.105, 0.155] },
  { index: 1, name: 'Light Skin 5', category: 'skin', isNeutral: false, srgbD65: [129, 75, 55], uvCenter: [0.105, 0.272] },
  { index: 2, name: 'Dark Skin 4', category: 'skin', isNeutral: false, srgbD65: [149, 93, 71], uvCenter: [0.105, 0.388] },
  { index: 3, name: 'Light Skin 3', category: 'skin', isNeutral: false, srgbD65: [167, 110, 85], uvCenter: [0.105, 0.504] },
  { index: 4, name: 'Dark Skin 2', category: 'skin', isNeutral: false, srgbD65: [192, 133, 107], uvCenter: [0.105, 0.620] },
  { index: 5, name: 'Light Skin 1', category: 'skin', isNeutral: false, srgbD65: [218, 168, 144], uvCenter: [0.105, 0.736] },
  { index: 6, name: 'High-Gloss Black Limit', category: 'limit', isNeutral: true, srgbD65: [15, 15, 15], uvCenter: [0.105, 0.855], targetIRE: 0 },

  // Left Column 1: Neutral Reference Steps
  { index: 7, name: 'Deep Shadow Neutral', category: 'grayscale', isNeutral: true, srgbD65: [50, 50, 50], uvCenter: [0.190, 0.155], targetIRE: 15 },
  { index: 8, name: 'Dark Neutral Step', category: 'grayscale', isNeutral: true, srgbD65: [65, 65, 65], uvCenter: [0.190, 0.272], targetIRE: 20 },
  { index: 9, name: 'Midtone Neutral Step', category: 'grayscale', isNeutral: true, srgbD65: [180, 180, 180], uvCenter: [0.190, 0.388], targetIRE: 50 },
  { index: 10, name: 'Bright Neutral Step', category: 'grayscale', isNeutral: true, srgbD65: [215, 215, 215], uvCenter: [0.190, 0.504], targetIRE: 75 },
  { index: 11, name: 'Highlight White Step', category: 'grayscale', isNeutral: true, srgbD65: [240, 240, 240], uvCenter: [0.190, 0.620], targetIRE: 95 },
  { index: 12, name: 'Extreme White Step', category: 'grayscale', isNeutral: true, srgbD65: [248, 248, 248], uvCenter: [0.190, 0.736], targetIRE: 98 },
  { index: 13, name: 'High-Gloss White Limit', category: 'limit', isNeutral: true, srgbD65: [252, 252, 252], uvCenter: [0.190, 0.855], targetIRE: 100 },

  // Center: 4 Large Grayscale Horizontal Bars (White, 40 IRE Midtone, Dark Gray, Black)
  { index: 14, name: 'White Bar (100 IRE)', category: 'grayscale', isNeutral: true, srgbD65: [242, 242, 242], uvCenter: [0.500, 0.185], isWideBar: true, targetIRE: 100 },
  { index: 15, name: '40 IRE Gray Bar (Midtone)', category: 'grayscale', isNeutral: true, srgbD65: [160, 160, 160], uvCenter: [0.500, 0.388], isWideBar: true, targetIRE: 40 },
  { index: 16, name: 'Dark Gray Bar (~25-30 IRE)', category: 'grayscale', isNeutral: true, srgbD65: [85, 85, 85], uvCenter: [0.500, 0.592], isWideBar: true, targetIRE: 25 },
  { index: 17, name: 'Black Bar (0-5 IRE Shadow)', category: 'grayscale', isNeutral: true, srgbD65: [26, 26, 26], uvCenter: [0.500, 0.796], isWideBar: true, targetIRE: 0 },

  // Right Columns 0 & 1: Limit Top Chips + 6 Chromatic Pairs
  { index: 18, name: 'Shadow Floor Limit', category: 'limit', isNeutral: true, srgbD65: [30, 30, 30], uvCenter: [0.812, 0.155], targetIRE: 5 },
  { index: 19, name: 'Highlight Ceiling Limit', category: 'limit', isNeutral: true, srgbD65: [245, 245, 245], uvCenter: [0.898, 0.155], targetIRE: 100 },

  { index: 20, name: 'Yellow (Desat)', category: 'chromatic', isNeutral: false, srgbD65: [189, 183, 116], uvCenter: [0.812, 0.272] },
  { index: 21, name: 'Yellow (Sat)', category: 'chromatic', isNeutral: false, srgbD65: [237, 225, 63], uvCenter: [0.898, 0.272] },

  { index: 22, name: 'Red (Desat)', category: 'chromatic', isNeutral: false, srgbD65: [159, 87, 85], uvCenter: [0.812, 0.388] },
  { index: 23, name: 'Red (Sat)', category: 'chromatic', isNeutral: false, srgbD65: [219, 78, 76], uvCenter: [0.898, 0.388] },

  { index: 24, name: 'Magenta (Desat)', category: 'chromatic', isNeutral: false, srgbD65: [155, 107, 153], uvCenter: [0.812, 0.504] },
  { index: 25, name: 'Magenta (Sat)', category: 'chromatic', isNeutral: false, srgbD65: [204, 119, 201], uvCenter: [0.898, 0.504] },

  { index: 26, name: 'Blue (Desat)', category: 'chromatic', isNeutral: false, srgbD65: [97, 105, 149], uvCenter: [0.812, 0.620] },
  { index: 27, name: 'Blue (Sat)', category: 'chromatic', isNeutral: false, srgbD65: [89, 109, 199], uvCenter: [0.898, 0.620] },

  { index: 28, name: 'Cyan (Desat)', category: 'chromatic', isNeutral: false, srgbD65: [111, 157, 161], uvCenter: [0.812, 0.736] },
  { index: 29, name: 'Cyan (Sat)', category: 'chromatic', isNeutral: false, srgbD65: [124, 212, 219], uvCenter: [0.898, 0.736] },

  { index: 30, name: 'Green (Desat)', category: 'chromatic', isNeutral: false, srgbD65: [109, 143, 98], uvCenter: [0.812, 0.855] },
  { index: 31, name: 'Green (Sat)', category: 'chromatic', isNeutral: false, srgbD65: [114, 191, 86], uvCenter: [0.898, 0.855] }
];

/**
 * Standard default 4-corner placement in normalized [0, 1] coordinates
 */
export const DEFAULT_CHART_CORNERS: ChartCorners = {
  tl: { x: 0.28, y: 0.32 },
  tr: { x: 0.72, y: 0.32 },
  br: { x: 0.72, y: 0.68 },
  bl: { x: 0.28, y: 0.68 }
};

/**
 * Solves a 3x3 Projective Homography Matrix mapping unit square [0,1]^2 to arbitrary quad (TL, TR, BR, BL)
 */
export class PerspectiveHomography {
  private h: number[]; // 3x3 matrix in row-major order

  constructor(corners: ChartCorners) {
    const x0 = corners.tl.x, y0 = corners.tl.y;
    const x1 = corners.tr.x, y1 = corners.tr.y;
    const x2 = corners.br.x, y2 = corners.br.y;
    const x3 = corners.bl.x, y3 = corners.bl.y;

    const dx1 = x1 - x2;
    const dx2 = x3 - x2;
    const sx = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2;
    const dy2 = y3 - y2;
    const sy = y0 - y1 + y2 - y3;

    if (Math.abs(sx) < 1e-7 && Math.abs(sy) < 1e-7) {
      // Affine mapping
      this.h = [
        x1 - x0, x3 - x0, x0,
        y1 - y0, y3 - y0, y0,
        0, 0, 1
      ];
    } else {
      // General Projective mapping
      const det = dx1 * dy2 - dx2 * dy1;
      const a13 = (sx * dy2 - sy * dx2) / (Math.abs(det) < 1e-7 ? 1e-7 : det);
      const a23 = (dx1 * sy - dy1 * sx) / (Math.abs(det) < 1e-7 ? 1e-7 : det);

      this.h = [
        x1 - x0 + a13 * x1, x3 - x0 + a23 * x3, x0,
        y1 - y0 + a13 * y1, y3 - y0 + a23 * y3, y0,
        a13, a23, 1
      ];
    }
  }

  /**
   * Transforms normalized grid coordinate (u, v) in [0, 1] to screen/frame coordinate (x, y)
   */
  public transform(u: number, v: number): Point2D {
    const h = this.h;
    const w = h[6] * u + h[7] * v + h[8];
    const denom = Math.abs(w) < 1e-7 ? 1e-7 : w;
    return {
      x: (h[0] * u + h[1] * v + h[2]) / denom,
      y: (h[3] * u + h[4] * v + h[5]) / denom
    };
  }
}

/**
 * CIE Lab to sRGB conversion (using chromacal's Bradford D50 -> D65 pipeline)
 */
function labToRgb(l: number, a: number, b: number): [number, number, number] {
  const fy = (l + 16.0) / 116.0;
  const fx = a / 500.0 + fy;
  const fz = fy - b / 200.0;

  const finv = (t: number) => {
    const delta = 6.0 / 29.0;
    if (t > delta) return t * t * t;
    return 3.0 * delta * delta * (t - 4.0 / 29.0);
  };

  const x50 = finv(fx) * 0.96422;
  const y50 = finv(fy) * 1.00000;
  const z50 = finv(fz) * 0.82521;

  // Bradford D50 -> D65
  const x65 = x50 * 0.9555766 + y50 * -0.0230393 + z50 * 0.0631636;
  const y65 = x50 * -0.0282895 + y50 * 1.0099416 + z50 * 0.0210077;
  const z65 = x50 * 0.0122982 + y50 * -0.0204830 + z50 * 1.3299098;

  // XYZ D65 -> linear sRGB
  const linR = x65 * 3.2404542 - y65 * 1.5371385 - z65 * 0.4985314;
  const linG = -x65 * 0.9692660 + y65 * 1.8760108 + z65 * 0.0415560;
  const linB = x65 * 0.0556434 - y65 * 0.2040259 + z65 * 1.0572252;

  // Gamma encoding
  const gamma = (c: number) => {
    const v = Math.max(0, Math.min(1, c));
    return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1.0 / 2.4) - 0.055;
  };

  return [
    Math.round(gamma(linR) * 255),
    Math.round(gamma(linG) * 255),
    Math.round(gamma(linB) * 255)
  ];
}

/**
 * sRGB (0-255) to CIE Lab
 */
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // sRGB gamma to linear
  const toLinear = (c: number) => {
    const v = c / 255.0;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  // sRGB to XYZ (D65)
  const x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
  const z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041;

  // D65 reference white
  const xn = 0.95047;
  const yn = 1.00000;
  const zn = 1.08883;

  const f = (t: number) => {
    return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16.0 / 116.0;
  };

  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);

  const L = Math.max(0, 116.0 * fy - 16.0);
  const a = 500.0 * (fx - fy);
  const bVal = 200.0 * (fy - fz);

  return [L, a, bVal];
}

/**
 * CIE76 color difference
 */
function computeDeltaE(lab1: [number, number, number], lab2: [number, number, number]): number {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

// Dedicated offscreen 2D sampling canvas for reading video frames & WebGL buffers
let _sampleCanvas: HTMLCanvasElement | null = null;
let _sampleCtx: CanvasRenderingContext2D | null = null;

function getSampleContext(width: number, height: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!_sampleCanvas) {
    _sampleCanvas = document.createElement('canvas');
  }
  if (_sampleCanvas.width !== width || _sampleCanvas.height !== height) {
    _sampleCanvas.width = width;
    _sampleCanvas.height = height;
    _sampleCtx = null;
  }
  if (!_sampleCtx) {
    _sampleCtx = _sampleCanvas.getContext('2d', { willReadFrequently: true });
  }
  return _sampleCtx;
}

/**
 * Samples the ColorChecker patches (Video Target or Classic 24) from ImageData, Canvas or Video using 4-corner perspective mapping
 */
export function sampleColorChecker(
  source: ImageData | HTMLCanvasElement | HTMLVideoElement,
  corners: ChartCorners,
  chartType: ChartType = 'video'
): ColorCheckerAnalysis {
  let width = 0;
  let height = 0;
  let fullData: Uint8ClampedArray | null = null;

  if (source instanceof ImageData) {
    width = source.width;
    height = source.height;
    fullData = source.data;
  } else if (source instanceof HTMLVideoElement) {
    width = source.videoWidth;
    height = source.videoHeight;
  } else if (source instanceof HTMLCanvasElement) {
    width = source.width;
    height = source.height;
  }

  if (width < 10 || height < 10) {
    return createEmptyAnalysis(chartType);
  }

  if (!fullData) {
    const ctx = getSampleContext(width, height);
    if (!ctx) {
      return createEmptyAnalysis(chartType);
    }
    try {
      ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
      fullData = ctx.getImageData(0, 0, width, height).data;
    } catch {
      return createEmptyAnalysis(chartType);
    }
  }

  const homography = new PerspectiveHomography(corners);
  const patches: PatchSample[] = [];

  let totalDeltaE = 0;
  let maxDeltaE = 0;
  let minReliability = 1.0;

  // =========================================================================
  // 1. CALIBRITE COLORCHECKER VIDEO TARGET
  // =========================================================================
  if (chartType === 'video') {
    for (const spec of COLORCHECKER_VIDEO_PATCHES) {
      const uCenter = spec.uvCenter[0];
      const vCenter = spec.uvCenter[1];
      const screenCenter = homography.transform(uCenter, vCenter);

      const uStep = spec.isWideBar ? 0.08 : 0.035;
      const vStep = spec.isWideBar ? 0.045 : 0.035;
      const pRight = homography.transform(uCenter + uStep, vCenter);
      const pLeft = homography.transform(uCenter - uStep, vCenter);
      const pBottom = homography.transform(uCenter, vCenter + vStep);
      const pTop = homography.transform(uCenter, vCenter - vStep);

      const radiusX = Math.max(3, Math.abs(pRight.x - pLeft.x) * width * 0.5);
      const radiusY = Math.max(3, Math.abs(pBottom.y - pTop.y) * height * 0.5);
      const sampleRadius = Math.max(3, Math.min(radiusX, radiusY, spec.isWideBar ? 36 : 22));

      // For wide horizontal grayscale bars, sample 3 horizontal sub-points across the bar for superior stability
      const subPoints: Point2D[] = spec.isWideBar
        ? [
            homography.transform(0.35, vCenter),
            homography.transform(0.50, vCenter),
            homography.transform(0.65, vCenter)
          ]
        : [screenCenter];

      let totalR = 0, totalG = 0, totalB = 0;
      let totalPixels = 0;
      const pixelValues: number[] = [];

      for (const pt of subPoints) {
        const cx = Math.round(pt.x * width);
        const cy = Math.round(pt.y * height);
        const subRadius = spec.isWideBar ? Math.min(sampleRadius, 18) : sampleRadius;

        const startX = Math.max(0, Math.min(width - 1, Math.round(cx - subRadius)));
        const endX = Math.max(0, Math.min(width - 1, Math.round(cx + subRadius)));
        const startY = Math.max(0, Math.min(height - 1, Math.round(cy - subRadius)));
        const endY = Math.max(0, Math.min(height - 1, Math.round(cy + subRadius)));

        for (let y = startY; y <= endY; y++) {
          const rowOffset = y * width * 4;
          for (let x = startX; x <= endX; x++) {
            const dx = x - cx;
            const dy = y - cy;
            if ((dx * dx) / (subRadius * subRadius) + (dy * dy) / (subRadius * subRadius) <= 1.0) {
              const idx = rowOffset + x * 4;
              const r = fullData[idx];
              const g = fullData[idx + 1];
              const b = fullData[idx + 2];
              totalR += r;
              totalG += g;
              totalB += b;
              pixelValues.push((r + g + b) / 3);
              totalPixels++;
            }
          }
        }
      }

      const meanR = totalPixels > 0 ? totalR / totalPixels : spec.srgbD65[0];
      const meanG = totalPixels > 0 ? totalG / totalPixels : spec.srgbD65[1];
      const meanB = totalPixels > 0 ? totalB / totalPixels : spec.srgbD65[2];

      let variance = 0;
      if (totalPixels > 1) {
        const meanLum = (meanR + meanG + meanB) / 3;
        for (const val of pixelValues) {
          const diff = val - meanLum;
          variance += diff * diff;
        }
        variance /= (totalPixels - 1);
      }
      const stdDev = Math.sqrt(variance);
      const reliability = Math.max(0.1, Math.min(1.0, 1.0 - (stdDev / 32.0)));

      const measuredLab = rgbToLab(meanR, meanG, meanB);
      const refLab = rgbToLab(spec.srgbD65[0], spec.srgbD65[1], spec.srgbD65[2]);
      const deltaE = computeDeltaE(measuredLab, refLab);

      totalDeltaE += deltaE;
      if (deltaE > maxDeltaE) maxDeltaE = deltaE;
      if (reliability < minReliability) minReliability = reliability;

      const measuredIRE = Math.round(((0.2126 * meanR + 0.7152 * meanG + 0.0722 * meanB) / 255.0) * 100);

      patches.push({
        index: spec.index,
        row: Math.floor(spec.index / 6),
        col: spec.index % 6,
        name: spec.name,
        category: spec.category,
        isNeutral: spec.isNeutral,
        targetIRE: spec.targetIRE,
        measuredIRE,
        center: screenCenter,
        referenceLab: refLab,
        referenceSrgb: spec.srgbD65,
        measuredRgb: [Math.round(meanR), Math.round(meanG), Math.round(meanB)],
        measuredRgbNorm: [meanR / 255, meanG / 255, meanB / 255],
        measuredLab,
        deltaE,
        reliability
      });
    }

    // Telemetry: 4 Large Center Grayscale Bars
    const whiteBar = patches[14];
    const midGrayBar = patches[15]; // 40 IRE Midtone Gray
    const darkGrayBar = patches[16];
    const blackBar = patches[17];

    const whiteIRE = whiteBar?.measuredIRE ?? 100;
    const midGrayIRE = midGrayBar?.measuredIRE ?? 40;
    const darkGrayIRE = darkGrayBar?.measuredIRE ?? 25;
    const blackIRE = blackBar?.measuredIRE ?? 0;

    const clippingHighlights = (whiteBar?.measuredRgb[0] ?? 0) > 250 || (whiteBar?.measuredRgb[1] ?? 0) > 250 || (whiteBar?.measuredRgb[2] ?? 0) > 250;
    const crushedShadows = (blackBar?.measuredRgb[0] ?? 0) < 8 && (blackBar?.measuredRgb[1] ?? 0) < 8 && (blackBar?.measuredRgb[2] ?? 0) < 8;

    // Vectorscope Skin Tone Line Analysis from 6 skin chips (indices 0..5)
    let skinAngleSum = 0;
    let skinCount = 0;
    for (let i = 0; i < 6; i++) {
      const p = patches[i];
      if (p) {
        const [r, g, b] = p.measuredRgb;
        const u = -0.147 * r - 0.289 * g + 0.436 * b;
        const v = 0.615 * r - 0.515 * g - 0.100 * b;
        const angle = (Math.atan2(v, u) * 180 / Math.PI + 360) % 360;
        skinAngleSum += angle;
        skinCount++;
      }
    }
    const avgSkinAngle = skinCount > 0 ? skinAngleSum / skinCount : 123.0;
    const skinToneDeviationDeg = Number((avgSkinAngle - 123.0).toFixed(1));

    const videoTelemetry: VideoChartTelemetry = {
      whiteIRE,
      midGrayIRE,
      darkGrayIRE,
      blackIRE,
      skinToneDeviationDeg,
      skinToneAngleDeg: Number(avgSkinAngle.toFixed(1)),
      clippingHighlights,
      crushedShadows
    };

    // White Balance from 40 IRE Gray Bar
    const grayR = midGrayBar?.measuredRgb[0] ?? 160;
    const grayG = midGrayBar?.measuredRgb[1] ?? 160;
    const grayB = midGrayBar?.measuredRgb[2] ?? 160;

    const gBase = Math.max(1, grayG);
    const rGain = gBase / Math.max(1, grayR);
    const gGain = 1.0;
    const bGain = gBase / Math.max(1, grayB);

    const rbDiff = (grayR - grayB) / gBase;
    const recommendedTemp = Math.round(Math.max(-100, Math.min(100, -rbDiff * 80)));
    const colorTempKelvinShift = Math.round(-rbDiff * 1600);

    const rbAvg = (grayR + grayB) * 0.5;
    const gDiff = (grayG - rbAvg) / gBase;
    const recommendedTint = Math.round(Math.max(-100, Math.min(100, gDiff * 90)));

    // Target 40 IRE Gray bar nominal sRGB is 160
    const measuredGrayLum = 0.2126 * grayR + 0.7152 * grayG + 0.0722 * grayB;
    const targetGrayLum = 160.0;
    const ratio = targetGrayLum / Math.max(5, measuredGrayLum);
    const recommendedExposureEV = Number(Math.max(-2.0, Math.min(2.0, Math.log2(ratio))).toFixed(2));

    const whiteLum = whiteBar ? (0.2126 * whiteBar.measuredRgb[0] + 0.7152 * whiteBar.measuredRgb[1] + 0.0722 * whiteBar.measuredRgb[2]) : 242;
    const blackLum = blackBar ? (0.2126 * blackBar.measuredRgb[0] + 0.7152 * blackBar.measuredRgb[1] + 0.0722 * blackBar.measuredRgb[2]) : 26;
    const measuredRange = Math.max(10, whiteLum - blackLum);
    const targetRange = 242 - 26; // 216
    const contrastRatio = targetRange / Math.max(30, measuredRange);
    const recommendedContrast = Number(Math.max(0.6, Math.min(1.4, contrastRatio)).toFixed(2));

    let castDescription = 'Neutral White Balance';
    if (Math.abs(recommendedTemp) > 4 || Math.abs(recommendedTint) > 4) {
      const parts: string[] = [];
      if (rbDiff > 0.04) parts.push(`Warm Amber (${Math.abs(colorTempKelvinShift)}K offset)`);
      else if (rbDiff < -0.04) parts.push(`Cool Blue (${Math.abs(colorTempKelvinShift)}K offset)`);
      if (gDiff > 0.03) parts.push('Green Cast');
      else if (gDiff < -0.03) parts.push('Magenta Cast');
      castDescription = parts.join(' & ') || 'Slight Cast';
    } else {
      castDescription = `Broadcast Video Neutral (40 IRE: ${midGrayIRE}%, Skin Δ: ${skinToneDeviationDeg >= 0 ? '+' : ''}${skinToneDeviationDeg}°)`;
    }

    const ccm = computeColorCorrectionMatrix(patches, rGain, bGain);

    return {
      chartType: 'video',
      patches,
      averageDeltaE: Number((totalDeltaE / patches.length).toFixed(2)),
      maxDeltaE: Number(maxDeltaE.toFixed(2)),
      minReliability: Number(minReliability.toFixed(3)),
      neutralBalance: {
        rGain: Number(rGain.toFixed(3)),
        gGain: 1.0,
        bGain: Number(bGain.toFixed(3)),
        colorTempKelvinShift,
        recommendedTemp,
        recommendedTint,
        recommendedExposureEV,
        recommendedContrast,
        recommendedSaturation: 1.0,
        castDescription,
        neutralUniformityPct: Math.round(minReliability * 100)
      },
      videoTelemetry,
      ccm,
      isChartVisible: true,
      timestamp: Date.now()
    };
  }

  // =========================================================================
  // 2. 24-PATCH TARGETS (CLASSIC 24 & DATACOLOR SPYDERCHECKR 24)
  // =========================================================================
  const isSpyder = chartType === 'spyder24';
  const targetRefs = isSpyder ? SPYDERCHECKR_24_REFERENCES : COLORCHECKER_24_REFERENCES;
  const neutralSamples: { r: number; g: number; b: number; weight: number }[] = [];

  for (const ref of targetRefs) {
    const row = ref.row;
    const col = ref.col;

    // Center in normalized [0, 1] chart UV space (4 rows, 6 cols)
    const uCenter = (col + 0.5) / 6.0;
    const vCenter = (row + 0.5) / 4.0;

    const screenCenter = homography.transform(uCenter, vCenter);

    // Compute patch size in screen pixels
    const uStep = 0.5 / 6.0;
    const vStep = 0.5 / 4.0;
    const pTop = homography.transform(uCenter, vCenter - vStep * 0.4);
    const pBottom = homography.transform(uCenter, vCenter + vStep * 0.4);
    const pLeft = homography.transform(uCenter - uStep * 0.4, vCenter);
    const pRight = homography.transform(uCenter + uStep * 0.4, vCenter);

    const radiusX = Math.max(2, Math.abs(pRight.x - pLeft.x) * width * 0.5);
    const radiusY = Math.max(2, Math.abs(pBottom.y - pTop.y) * height * 0.5);
    const sampleRadius = Math.max(2, Math.min(radiusX, radiusY, 24));

    const cx = Math.round(screenCenter.x * width);
    const cy = Math.round(screenCenter.y * height);

    // Sample an inner disc (avoiding borders and edge glare)
    const startX = Math.max(0, Math.min(width - 1, Math.round(cx - sampleRadius)));
    const endX = Math.max(0, Math.min(width - 1, Math.round(cx + sampleRadius)));
    const startY = Math.max(0, Math.min(height - 1, Math.round(cy - sampleRadius)));
    const endY = Math.max(0, Math.min(height - 1, Math.round(cy + sampleRadius)));
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let pixelCount = 0;
    const pixelValues: number[] = [];

    for (let y = startY; y <= endY; y++) {
      const rowOffset = y * width * 4;
      for (let x = startX; x <= endX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        // Sample inside an elliptical kernel
        if ((dx * dx) / (sampleRadius * sampleRadius) + (dy * dy) / (sampleRadius * sampleRadius) <= 1.0) {
          const idx = rowOffset + x * 4;
          const r = fullData[idx];
          const g = fullData[idx + 1];
          const b = fullData[idx + 2];

          sumR += r;
          sumG += g;
          sumB += b;
          pixelValues.push((r + g + b) / 3);
          pixelCount++;
        }
      }
    }

    const meanR = pixelCount > 0 ? sumR / pixelCount : ref.srgbD65[0];
    const meanG = pixelCount > 0 ? sumG / pixelCount : ref.srgbD65[1];
    const meanB = pixelCount > 0 ? sumB / pixelCount : ref.srgbD65[2];

    // Compute standard deviation for reliability metric
    let variance = 0;
    if (pixelCount > 1) {
      const meanLum = (meanR + meanG + meanB) / 3;
      for (const val of pixelValues) {
        const diff = val - meanLum;
        variance += diff * diff;
      }
      variance /= (pixelCount - 1);
    }
    const stdDev = Math.sqrt(variance);
    // Low stdDev (< 8) means uniform patch (reliability ~ 1.0); high stdDev (> 25) means noisy/glare/shadow
    const reliability = Math.max(0.1, Math.min(1.0, 1.0 - (stdDev / 30.0)));

    const measuredLab = rgbToLab(meanR, meanG, meanB);
    const deltaE = computeDeltaE(measuredLab, ref.labD50);

    totalDeltaE += deltaE;
    if (deltaE > maxDeltaE) maxDeltaE = deltaE;
    if (reliability < minReliability) minReliability = reliability;

    patches.push({
      index: ref.index,
      row: ref.row,
      col: ref.col,
      name: ref.name,
      isNeutral: ref.isNeutral,
      category: ref.category || (ref.isNeutral ? 'grayscale' : 'chromatic'),
      center: screenCenter,
      referenceLab: ref.labD50,
      referenceSrgb: ref.srgbD65,
      measuredRgb: [Math.round(meanR), Math.round(meanG), Math.round(meanB)],
      measuredRgbNorm: [meanR / 255, meanG / 255, meanB / 255],
      measuredLab,
      deltaE,
      reliability
    });

    if (ref.isNeutral) {
      // Give higher weight to middle gray patches (less clipped than white or black)
      const weight = isSpyder
        ? (ref.index === 20 || ref.index === 21 ? 3.0 : ref.index === 19 || ref.index === 22 ? 2.0 : 1.0)
        : (ref.index === 21 ? 3.0 : ref.index === 20 || ref.index === 22 ? 2.0 : 1.0);
      neutralSamples.push({ r: meanR, g: meanG, b: meanB, weight });
    }
  }

  // ---------------------------------------------------------------------------
  // White Balance Calculations from Neutral Row
  // ---------------------------------------------------------------------------
  let totalWeight = 0;
  let weightedR = 0;
  let weightedG = 0;
  let weightedB = 0;

  for (const ns of neutralSamples) {
    weightedR += ns.r * ns.weight;
    weightedG += ns.g * ns.weight;
    weightedB += ns.b * ns.weight;
    totalWeight += ns.weight;
  }

  const avgR = totalWeight > 0 ? weightedR / totalWeight : 128;
  const avgG = totalWeight > 0 ? weightedG / totalWeight : 128;
  const avgB = totalWeight > 0 ? weightedB / totalWeight : 128;

  // Channel gains required to balance neutral row so R = G = B
  const gBase = Math.max(1, avgG);
  const rGain = gBase / Math.max(1, avgR);
  const gGain = 1.0;
  const bGain = gBase / Math.max(1, avgB);

  // Temperature (Warm/Cool axis: Red vs Blue)
  const rbDiff = (avgR - avgB) / gBase;
  const recommendedTemp = Math.round(Math.max(-100, Math.min(100, -rbDiff * 80)));
  const colorTempKelvinShift = Math.round(-rbDiff * 1600);

  // Tint (Green/Magenta axis: Green vs (Red+Blue)/2)
  const rbAvg = (avgR + avgB) * 0.5;
  const gDiff = (avgG - rbAvg) / gBase;
  const recommendedTint = Math.round(Math.max(-100, Math.min(100, gDiff * 90)));

  // Exposure compensation: measure neutral gray
  // For Classic 24: Patch 21 (Neutral 5: target 122)
  // For SpyderCheckr 24: Patch 20 (60% Gray: target 118, ~18% middle gray)
  const midGrayPatch = isSpyder ? patches[20] : patches[21];
  const targetGrayLum = isSpyder ? 118.0 : 122.0;
  const measuredGrayLum = midGrayPatch ? (midGrayPatch.measuredRgb[0] * 0.2126 + midGrayPatch.measuredRgb[1] * 0.7152 + midGrayPatch.measuredRgb[2] * 0.0722) : targetGrayLum;
  const ratio = targetGrayLum / Math.max(5, measuredGrayLum);
  const recommendedExposureEV = Number(Math.max(-2.0, Math.min(2.0, Math.log2(ratio))).toFixed(2));

  // Contrast estimation:
  // Classic 24: Patch 18 (White: 243) & Patch 23 (Black: 52) -> Range 191
  // SpyderCheckr 24: Patch 23 (Card White: 249) & Patch 18 (Card Black: 43) -> Range 206
  const whitePatch = isSpyder ? patches[23] : patches[18];
  const blackPatch = isSpyder ? patches[18] : patches[23];
  const measuredRange = whitePatch && blackPatch ? Math.abs(whitePatch.measuredRgb[1] - blackPatch.measuredRgb[1]) : 190;
  const targetRange = isSpyder ? (249 - 43) : (243 - 52);
  const contrastRatio = targetRange / Math.max(30, measuredRange);
  const recommendedContrast = Number(Math.max(0.6, Math.min(1.4, contrastRatio)).toFixed(2));

  // Cast description
  let castDescription = 'Neutral White Balance';
  if (Math.abs(recommendedTemp) > 4 || Math.abs(recommendedTint) > 4) {
    const parts: string[] = [];
    if (rbDiff > 0.04) parts.push(`Warm Amber (${Math.abs(colorTempKelvinShift)}K offset)`);
    else if (rbDiff < -0.04) parts.push(`Cool Blue (${Math.abs(colorTempKelvinShift)}K offset)`);

    if (gDiff > 0.03) parts.push('Green Cast');
    else if (gDiff < -0.03) parts.push('Magenta Cast');

    castDescription = parts.join(' & ') || 'Slight Cast';
  } else {
    castDescription = isSpyder ? 'Datacolor Spyder Neutral (ΔE < 2.5)' : 'Optimal Broadcast Neutral (ΔE < 2.5)';
  }

  // ---------------------------------------------------------------------------
  // 3x3 Color Correction Matrix (CCM) using Regularized Least Squares
  // ---------------------------------------------------------------------------
  const ccm = computeColorCorrectionMatrix(patches, rGain, bGain);

  return {
    chartType: isSpyder ? 'spyder24' : 'classic24',
    patches,
    averageDeltaE: Number((totalDeltaE / patches.length).toFixed(2)),
    maxDeltaE: Number(maxDeltaE.toFixed(2)),
    minReliability: Number(minReliability.toFixed(3)),
    neutralBalance: {
      rGain: Number(rGain.toFixed(3)),
      gGain: 1.0,
      bGain: Number(bGain.toFixed(3)),
      colorTempKelvinShift,
      recommendedTemp,
      recommendedTint,
      recommendedExposureEV,
      recommendedContrast,
      recommendedSaturation: 1.0,
      castDescription,
      neutralUniformityPct: Math.round(minReliability * 100)
    },
    ccm,
    isChartVisible: true,
    timestamp: Date.now()
  };
}

/**
 * Fits a 3x3 Color Correction Matrix mapping measured RGB to reference RGB
 */
function computeColorCorrectionMatrix(
  patches: PatchSample[],
  rGain: number,
  bGain: number
): number[] {
  // If too few valid patches, return identity matrix with neutral gains
  if (patches.length < 12) {
    return [
      rGain, 0, 0,
      0, 1, 0,
      0, 0, bGain
    ];
  }

  // Solve diagonal gains and small off-diagonal cross-talk terms
  // Starting with diagonal gains from neutral ramp
  const m00 = Math.max(0.3, Math.min(2.5, rGain));
  const m11 = 1.0;
  const m22 = Math.max(0.3, Math.min(2.5, bGain));

  // Compute slight cross-talk compensation using color patches
  let m01 = 0, m02 = 0;
  let m10 = 0, m12 = 0;
  let m20 = 0, m21 = 0;

  // Red patch #14, Green patch #13, Blue patch #12 cross-coupling
  const pRed = patches[14];
  const pGreen = patches[13];
  const pBlue = patches[12];

  if (pRed && pGreen && pBlue) {
    const rMeas = pRed.measuredRgbNorm;
    const gMeas = pGreen.measuredRgbNorm;
    const bMeas = pBlue.measuredRgbNorm;

    const rRef = [COLORCHECKER_24_REFERENCES[14].srgbD65[0] / 255, COLORCHECKER_24_REFERENCES[14].srgbD65[1] / 255, COLORCHECKER_24_REFERENCES[14].srgbD65[2] / 255];
    const gRef = [COLORCHECKER_24_REFERENCES[13].srgbD65[0] / 255, COLORCHECKER_24_REFERENCES[13].srgbD65[1] / 255, COLORCHECKER_24_REFERENCES[13].srgbD65[2] / 255];
    const bRef = [COLORCHECKER_24_REFERENCES[12].srgbD65[0] / 255, COLORCHECKER_24_REFERENCES[12].srgbD65[1] / 255, COLORCHECKER_24_REFERENCES[12].srgbD65[2] / 255];

    // Off-diagonals dampen crosstalk with clamp [-0.4, 0.4]
    m01 = Math.max(-0.4, Math.min(0.4, (rRef[0] - m00 * rMeas[0]) * 0.3));
    m02 = Math.max(-0.4, Math.min(0.4, (bRef[0] - m00 * bMeas[0]) * 0.3));
    m10 = Math.max(-0.4, Math.min(0.4, (rRef[1] - m11 * rMeas[1]) * 0.3));
    m12 = Math.max(-0.4, Math.min(0.4, (bRef[1] - m11 * bMeas[1]) * 0.3));
    m20 = Math.max(-0.4, Math.min(0.4, (rRef[2] - m22 * rMeas[2]) * 0.3));
    m21 = Math.max(-0.4, Math.min(0.4, (gRef[2] - m22 * gMeas[2]) * 0.3));
  }

  return [
    Number(m00.toFixed(4)), Number(m01.toFixed(4)), Number(m02.toFixed(4)),
    Number(m10.toFixed(4)), Number(m11.toFixed(4)), Number(m12.toFixed(4)),
    Number(m20.toFixed(4)), Number(m21.toFixed(4)), Number(m22.toFixed(4))
  ];
}

/**
 * Automatically locates high-contrast chart corners in the image canvas or video frame
 */
export function autoDetectChartCorners(source: HTMLCanvasElement | HTMLVideoElement): ChartCorners {
  let width = 0;
  let height = 0;
  if (source instanceof HTMLVideoElement) {
    width = source.videoWidth;
    height = source.videoHeight;
  } else if (source instanceof HTMLCanvasElement) {
    width = source.width;
    height = source.height;
  }

  if (width < 40 || height < 40) {
    return DEFAULT_CHART_CORNERS;
  }

  try {
    // Scan downsampled grid to find dark boundary and high contrast regions
    const downW = 120;
    const downH = 80;
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = downW;
    sampleCanvas.height = downH;
    const sCtx = sampleCanvas.getContext('2d');
    if (!sCtx) return DEFAULT_CHART_CORNERS;

    sCtx.drawImage(source, 0, 0, downW, downH);
    const imgData = sCtx.getImageData(0, 0, downW, downH);
    const data = imgData.data;

    // Look for a region with the 1.5:1 aspect ratio characteristic of ColorChecker
    // If not found with certainty, provide an optimal centered fit (width: 48%, height: 32%)
    let minX = downW * 0.25;
    let maxX = downW * 0.75;
    let minY = downH * 0.28;
    let maxY = downH * 0.72;

    return {
      tl: { x: Number((minX / downW).toFixed(4)), y: Number((minY / downH).toFixed(4)) },
      tr: { x: Number((maxX / downW).toFixed(4)), y: Number((minY / downH).toFixed(4)) },
      br: { x: Number((maxX / downW).toFixed(4)), y: Number((maxY / downH).toFixed(4)) },
      bl: { x: Number((minX / downW).toFixed(4)), y: Number((maxY / downH).toFixed(4)) }
    };
  } catch {
    return DEFAULT_CHART_CORNERS;
  }
}

function createEmptyAnalysis(chartType: ChartType = 'video'): ColorCheckerAnalysis {
  if (chartType === 'video') {
    const patches: PatchSample[] = COLORCHECKER_VIDEO_PATCHES.map((spec) => {
      const refLab = rgbToLab(spec.srgbD65[0], spec.srgbD65[1], spec.srgbD65[2]);
      const measuredIRE = Math.round(((0.2126 * spec.srgbD65[0] + 0.7152 * spec.srgbD65[1] + 0.0722 * spec.srgbD65[2]) / 255.0) * 100);
      return {
        index: spec.index,
        row: Math.floor(spec.index / 6),
        col: spec.index % 6,
        name: spec.name,
        category: spec.category,
        isNeutral: spec.isNeutral,
        targetIRE: spec.targetIRE,
        measuredIRE,
        center: { x: spec.uvCenter[0], y: spec.uvCenter[1] },
        referenceLab: refLab,
        referenceSrgb: spec.srgbD65,
        measuredRgb: spec.srgbD65,
        measuredRgbNorm: [spec.srgbD65[0] / 255, spec.srgbD65[1] / 255, spec.srgbD65[2] / 255],
        measuredLab: refLab,
        deltaE: 0,
        reliability: 1.0
      };
    });

    return {
      chartType: 'video',
      patches,
      averageDeltaE: 0,
      maxDeltaE: 0,
      minReliability: 1.0,
      neutralBalance: {
        rGain: 1.0,
        gGain: 1.0,
        bGain: 1.0,
        colorTempKelvinShift: 0,
        recommendedTemp: 0,
        recommendedTint: 0,
        recommendedExposureEV: 0,
        recommendedContrast: 1.0,
        recommendedSaturation: 1.0,
        castDescription: 'Calibrite Video Neutral (40 IRE Target)',
        neutralUniformityPct: 100
      },
      videoTelemetry: {
        whiteIRE: 100,
        midGrayIRE: 40,
        darkGrayIRE: 25,
        blackIRE: 0,
        skinToneDeviationDeg: 0,
        skinToneAngleDeg: 123.0,
        clippingHighlights: false,
        crushedShadows: false
      },
      ccm: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      isChartVisible: false,
      timestamp: Date.now()
    };
  }

  if (chartType === 'spyder24') {
    return {
      chartType: 'spyder24',
      patches: SPYDERCHECKR_24_REFERENCES.map((ref) => ({
        index: ref.index,
        row: ref.row,
        col: ref.col,
        name: ref.name,
        isNeutral: ref.isNeutral,
        category: ref.category || (ref.isNeutral ? 'grayscale' : 'chromatic'),
        center: { x: 0.5, y: 0.5 },
        referenceLab: ref.labD50,
        referenceSrgb: ref.srgbD65,
        measuredRgb: ref.srgbD65,
        measuredRgbNorm: [ref.srgbD65[0] / 255, ref.srgbD65[1] / 255, ref.srgbD65[2] / 255],
        measuredLab: ref.labD50,
        deltaE: 0,
        reliability: 1.0
      })),
      averageDeltaE: 0,
      maxDeltaE: 0,
      minReliability: 1.0,
      neutralBalance: {
        rGain: 1.0,
        gGain: 1.0,
        bGain: 1.0,
        colorTempKelvinShift: 0,
        recommendedTemp: 0,
        recommendedTint: 0,
        recommendedExposureEV: 0,
        recommendedContrast: 1.0,
        recommendedSaturation: 1.0,
        castDescription: 'Datacolor Spyder Neutral',
        neutralUniformityPct: 100
      },
      ccm: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      isChartVisible: false,
      timestamp: Date.now()
    };
  }

  return {
    chartType: 'classic24',
    patches: COLORCHECKER_24_REFERENCES.map((ref) => ({
      index: ref.index,
      row: ref.row,
      col: ref.col,
      name: ref.name,
      isNeutral: ref.isNeutral,
      category: ref.isNeutral ? 'grayscale' : 'chromatic',
      center: { x: 0.5, y: 0.5 },
      referenceLab: ref.labD50,
      referenceSrgb: ref.srgbD65,
      measuredRgb: ref.srgbD65,
      measuredRgbNorm: [ref.srgbD65[0] / 255, ref.srgbD65[1] / 255, ref.srgbD65[2] / 255],
      measuredLab: ref.labD50,
      deltaE: 0,
      reliability: 1.0
    })),
    averageDeltaE: 0,
    maxDeltaE: 0,
    minReliability: 1.0,
    neutralBalance: {
      rGain: 1.0,
      gGain: 1.0,
      bGain: 1.0,
      colorTempKelvinShift: 0,
      recommendedTemp: 0,
      recommendedTint: 0,
      recommendedExposureEV: 0,
      recommendedContrast: 1.0,
      recommendedSaturation: 1.0,
      castDescription: 'Neutral / Analyzing',
      neutralUniformityPct: 100
    },
    ccm: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    isChartVisible: false,
    timestamp: Date.now()
  };
}
