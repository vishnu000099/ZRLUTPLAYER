import { LutData } from '../types';
import { parseCubeText } from './cubeParser';

export interface CatalogLutItem {
  id: string;
  name: string;
  category:
    | 'Nikon'
    | 'Canon'
    | 'Lumix'
    | 'DJI Drone'
    | 'High Contrast'
    | 'Medium Contrast'
    | 'Low Contrast'
    | 'No Contrast';
  contrast: 'High' | 'Medium' | 'Low' | 'None' | 'Standard';
  rolloff: 'Hard (R1)' | 'Medium (R2)' | 'Soft (R3)' | 'Very Soft (R4)' | 'Standard';
  fileUrl?: string; // Relative to public/
  description: string;
  size: number;
}

export const CATALOG_LUTS: CatalogLutItem[] = [
  // Dedicated DJI Drone 3D LUTs (Air / Mavic / Mini Series)
  {
    id: 'dji_air_3_dlog_m',
    name: 'DJI Air 3 D-Log M to Rec.709',
    category: 'DJI Drone',
    contrast: 'Standard',
    rolloff: 'Standard',
    fileUrl: '/luts/DJI/DJI_Air_3_D-Log_M_to_Rec709.cube',
    description: 'Official DJI Air 3 33³ 3D LUT transforming 10-bit D-Log M aerial footage to natural Rec.709 colors.',
    size: 33
  },
  {
    id: 'dji_air_3s_dlog_m',
    name: 'DJI Air 3S D-Log M to Rec.709',
    category: 'DJI Drone',
    contrast: 'Standard',
    rolloff: 'Standard',
    fileUrl: '/luts/DJI/DJI_Air_3S_D-Log_M_to_Rec709.cube',
    description: 'Official DJI Air 3S 1-inch sensor D-Log M to Rec.709 transform with rich landscape tonal range.',
    size: 33
  },
  {
    id: 'dji_mavic_4_pro_dlog_m',
    name: 'DJI Mavic 4 Pro D-Log M to Rec.709',
    category: 'DJI Drone',
    contrast: 'Standard',
    rolloff: 'Standard',
    fileUrl: '/luts/DJI/DJI_Mavic_4_Pro_D-Log_M_to_Rec709.cube',
    description: 'DJI Mavic 4 Pro 10-bit D-Log M transform to Rec.709 with balanced contrast and smooth highlight rolloff.',
    size: 33
  },
  {
    id: 'dji_mavic_4_pro_dlog',
    name: 'DJI Mavic 4 Pro D-Log to Rec.709',
    category: 'DJI Drone',
    contrast: 'Standard',
    rolloff: 'Standard',
    fileUrl: '/luts/DJI/DJI_Mavic_4_Pro_D-Log_to_Rec709.cube',
    description: 'Full dynamic range D-Log gamma to standard Rec.709 conversion for flagship aerial cinematography.',
    size: 33
  },
  {
    id: 'dji_mavic_4_pro_dlog_vivid',
    name: 'DJI Mavic 4 Pro D-Log to Rec.709 Vivid',
    category: 'DJI Drone',
    contrast: 'High',
    rolloff: 'Medium (R2)',
    fileUrl: '/luts/DJI/DJI_Mavic_4_Pro_D-Log_to_Rec709_Vivid.cube',
    description: 'Vivid aerial grade with saturated skies, water, and foliage for dramatic golden hour drone shots.',
    size: 33
  },
  {
    id: 'dji_mini_4_pro_dlog_m',
    name: 'DJI Mini 4 Pro D-Log M to Rec.709',
    category: 'DJI Drone',
    contrast: 'Standard',
    rolloff: 'Standard',
    fileUrl: '/luts/DJI/DJI_Mini_4_Pro_D-Log_M_to_Rec709.cube',
    description: 'Official DJI Mini 4 Pro sub-249g drone D-Log M to Rec.709 colorimetric transform.',
    size: 33
  },
  {
    id: 'dji_mini_5_pro_dlog_m',
    name: 'DJI Mini 5 Pro D-Log M to Rec.709',
    category: 'DJI Drone',
    contrast: 'Standard',
    rolloff: 'Standard',
    fileUrl: '/luts/DJI/DJI_Mini_5_Pro_D-Log_M_to_Rec709.cube',
    description: 'Next-gen Mini 5 Pro D-Log M aerial footage conversion to standard Rec.709 broadcast profile.',
    size: 33
  },

  // Dedicated Canon 3D LUTs (65³ Grid)
  {
    id: 'canon_clog2_to_canon709_65',
    name: 'Canon Cinema Gamut C-Log 2 to Canon 709',
    category: 'Canon',
    contrast: 'Standard',
    rolloff: 'Standard',
    fileUrl: '/luts/Canon/CinemaGamut_CanonLog2-to-Canon709_65_Ver.1.0.cube',
    description: 'Official Canon 65³ 3D LUT converting Cinema Gamut / Canon Log 2 to standard Canon 709 with wide 16-stop dynamic range retention.',
    size: 65
  },
  {
    id: 'canon_clog3_to_canon709_65',
    name: 'Canon Cinema Gamut C-Log 3 to Canon 709',
    category: 'Canon',
    contrast: 'Standard',
    rolloff: 'Standard',
    fileUrl: '/luts/Canon/CinemaGamut_CanonLog3-to-Canon709_65_Ver.1.0.cube',
    description: 'Official Canon 65³ 3D LUT converting Cinema Gamut / Canon Log 3 to standard Canon 709 with balanced contrast and smooth shadow roll-off.',
    size: 65
  },

  // Dedicated Panasonic Lumix 3D LUTs
  {
    id: 'lumix_arrilogc3',
    name: 'Arrilogc3',
    category: 'Lumix',
    contrast: 'Standard',
    rolloff: 'Standard',
    fileUrl: '/luts/Lumix/ARRI_LogC2Video_709_davinci3d_33.cube',
    description: 'Official ARRI LogC to Rec.709 DaVinci 3D LUT (33³ matrix) providing filmic tone curve, natural highlight roll-off, and rich color reproduction.',
    size: 33
  },
  {
    id: 'lumix_vlog_to_v709_official',
    name: 'Lumix V-Log to V-709 Standard',
    category: 'Lumix',
    contrast: 'Standard',
    rolloff: 'Standard',
    fileUrl: '/luts/Lumix/VLog_to_V709_forV35_ver100.cube',
    description: 'Official Panasonic Lumix 33³ 3D LUT converting V-Log/V-Gamut to standard broadcast V-709 colorimetry.',
    size: 33
  },
  {
    id: 'lumix_rec709_medium_soft',
    name: 'Lumix V-Log to Rec.709 Medium Contrast Soft',
    category: 'Lumix',
    contrast: 'Medium',
    rolloff: 'Soft (R3)',
    fileUrl: '/luts/Lumix/REC709_MEDIUM_CONTRAST_Soft_VLog.cube',
    description: 'Lumix V-Log to Rec.709 with medium contrast and gentle soft highlight roll-off curve.',
    size: 33
  },
  {
    id: 'lumix_arri_logc_classic709',
    name: 'Lumix ARRI LogC to Classic 709',
    category: 'Lumix',
    contrast: 'Medium',
    rolloff: 'Medium (R2)',
    fileUrl: '/luts/Lumix/ARRI_LogC2Video_Classic709_VLog.cube',
    description: 'Cinematic emulation mapping V-Log footage through ARRI LogC Classic 709 filmic tone response.',
    size: 33
  },
  {
    id: 'lumix_llog_natural',
    name: 'Lumix L-Log to Natural V-Log',
    category: 'Lumix',
    contrast: 'Standard',
    rolloff: 'Standard',
    fileUrl: '/luts/Lumix/L-Log_to_Natural_VLog.cube',
    description: 'Leica / Lumix L-Log transform tuned for clean natural contrast and balanced neutrality.',
    size: 33
  },
  {
    id: 'lumix_llog_classic',
    name: 'Lumix L-Log to Classic V-Log',
    category: 'Lumix',
    contrast: 'Medium',
    rolloff: 'Medium (R2)',
    fileUrl: '/luts/Lumix/L-Log_to_Classic_VLog.cube',
    description: 'Leica / Lumix L-Log transform with classic warm filmic contrast and gentle shadow toe.',
    size: 33
  },
  {
    id: 'lumix_flog2c_classic_chrome',
    name: 'Lumix / Fuji Classic Chrome Profile',
    category: 'Lumix',
    contrast: 'High',
    rolloff: 'Hard (R1)',
    fileUrl: '/luts/Lumix/FLog2C_to_CLASSIC-CHROME_VLog.cube',
    description: 'Documentary film look featuring subdued saturation and deep shadow contrast.',
    size: 33
  },
  {
    id: 'lumix_flog2c_reala_ace',
    name: 'Lumix / Fuji Reala Ace Profile',
    category: 'Lumix',
    contrast: 'Medium',
    rolloff: 'Medium (R2)',
    fileUrl: '/luts/Lumix/FLog2C_to_REALA-ACE_VLog.cube',
    description: 'Rich, faithful color rendition with nuanced skin tones and natural highlight rendition.',
    size: 33
  },
  {
    id: 'lumix_flog2c_acros',
    name: 'Lumix / Fuji Acros B&W Monochrome',
    category: 'Lumix',
    contrast: 'High',
    rolloff: 'Hard (R1)',
    fileUrl: '/luts/Lumix/FLog2C_to_ACROS_VLog.cube',
    description: 'High-fidelity monochrome transform delivering smooth gradations and deep rich blacks.',
    size: 33
  },

  // Official Nikon Factory 3D LUT
  {
    id: 'nikon_nlog_bt2020_to_rec709_size33',
    name: 'Nikon N-Log BT.2020 to Rec.709 BT.1886',
    category: 'Nikon',
    contrast: 'Medium',
    rolloff: 'Medium (R2)',
    fileUrl: '/luts/Nikon/N-Log_BT2020_to_REC709_BT1886_size_33.cube',
    description: 'Official Nikon 33³ 3D LUT mapping N-Log / BT.2020 gamut to Rec.709 BT.1886 with medium contrast and R2 roll-off.',
    size: 33
  },

  // High Contrast
  {
    id: 'ipp2_high_r1',
    name: 'Rec.709 High Contrast · R1 Hard Rolloff',
    category: 'High Contrast',
    contrast: 'High',
    rolloff: 'Hard (R1)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20HIGH_CONTRAST%20and%20R_1_Hard%20size_33%20v1.13.cube',
    description: 'REDWideGamut / Log3G10 to Rec.709 BT.1886 with high punchy contrast and hard highlight clip.',
    size: 33
  },
  {
    id: 'ipp2_high_r2',
    name: 'Rec.709 High Contrast · R2 Medium Rolloff',
    category: 'High Contrast',
    contrast: 'High',
    rolloff: 'Medium (R2)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20HIGH_CONTRAST%20and%20R_2_Medium%20size_33%20v1.13.cube',
    description: 'High contrast curve with balanced natural highlight roll-off.',
    size: 33
  },
  {
    id: 'ipp2_high_r3',
    name: 'Rec.709 High Contrast · R3 Soft Rolloff',
    category: 'High Contrast',
    contrast: 'High',
    rolloff: 'Soft (R3)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20HIGH_CONTRAST%20and%20R_3_Soft%20size_33%20v1.13.cube',
    description: 'High contrast curve with gentle gradual highlight preservation.',
    size: 33
  },
  {
    id: 'ipp2_high_r4',
    name: 'Rec.709 High Contrast · R4 Very Soft Rolloff',
    category: 'High Contrast',
    contrast: 'High',
    rolloff: 'Very Soft (R4)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20HIGH_CONTRAST%20and%20R_4_VerySoft%20size_33%20v1.13.cube',
    description: 'High contrast curve with maximum highlight cushion and gentle roll-off.',
    size: 33
  },

  // Medium Contrast
  {
    id: 'ipp2_med_r1',
    name: 'Rec.709 Medium Contrast · R1 Hard Rolloff',
    category: 'Medium Contrast',
    contrast: 'Medium',
    rolloff: 'Hard (R1)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20MEDIUM_CONTRAST%20and%20R_1_Hard%20size_33%20v1.13.cube',
    description: 'Standard medium cinema contrast with crisp hard highlight rolloff.',
    size: 33
  },
  {
    id: 'ipp2_med_r2',
    name: 'Rec.709 Medium Contrast · R2 Medium Rolloff',
    category: 'Medium Contrast',
    contrast: 'Medium',
    rolloff: 'Medium (R2)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20MEDIUM_CONTRAST%20and%20R_2_Medium%20size_33%20v1.13.cube',
    description: 'Versatile commercial/narrative medium contrast curve with natural highlight falloff.',
    size: 33
  },
  {
    id: 'ipp2_med_r3',
    name: 'Rec.709 Medium Contrast · R3 Soft Rolloff',
    category: 'Medium Contrast',
    contrast: 'Medium',
    rolloff: 'Soft (R3)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20MEDIUM_CONTRAST%20and%20R_3_Soft%20size_33%20v1.13.cube',
    description: 'Medium contrast curve with smooth highlight graduation.',
    size: 33
  },
  {
    id: 'ipp2_med_r4',
    name: 'Rec.709 Medium Contrast · R4 Very Soft Rolloff',
    category: 'Medium Contrast',
    contrast: 'Medium',
    rolloff: 'Very Soft (R4)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20MEDIUM_CONTRAST%20and%20R_4_VerySoft%20size_33%20v1.13.cube',
    description: 'Medium contrast curve with maximum soft highlight protection.',
    size: 33
  },

  // Low Contrast
  {
    id: 'ipp2_low_r1',
    name: 'Rec.709 Low Contrast · R1 Hard Rolloff',
    category: 'Low Contrast',
    contrast: 'Low',
    rolloff: 'Hard (R1)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20LOW_CONTRAST%20and%20R_1_Hard%20size_33%20v1.13.cube',
    description: 'Low contrast curve for preserving shadow depth and high dynamic range.',
    size: 33
  },
  {
    id: 'ipp2_low_r2',
    name: 'Rec.709 Low Contrast · R2 Medium Rolloff',
    category: 'Low Contrast',
    contrast: 'Low',
    rolloff: 'Medium (R2)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20LOW_CONTRAST%20and%20R_2_Medium%20size_33%20v1.13.cube',
    description: 'Low contrast base grade with balanced midtones and smooth highlights.',
    size: 33
  },
  {
    id: 'ipp2_low_r3',
    name: 'Rec.709 Low Contrast · R3 Soft Rolloff',
    category: 'Low Contrast',
    contrast: 'Low',
    rolloff: 'Soft (R3)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20LOW_CONTRAST%20and%20R_3_Soft%20size_33%20v1.13.cube',
    description: 'Soft low-contrast curve designed for wide exposure latitude.',
    size: 33
  },
  {
    id: 'ipp2_low_r4',
    name: 'Rec.709 Low Contrast · R4 Very Soft Rolloff',
    category: 'Low Contrast',
    contrast: 'Low',
    rolloff: 'Very Soft (R4)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20LOW_CONTRAST%20and%20R_4_VerySoft%20size_33%20v1.13.cube',
    description: 'Maximum low-contrast DR retention with extremely soft highlight compression.',
    size: 33
  },

  // No Contrast
  {
    id: 'ipp2_no_r1',
    name: 'Rec.709 No Contrast · R1 Hard Rolloff',
    category: 'No Contrast',
    contrast: 'None',
    rolloff: 'Hard (R1)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20NO_CONTRAST%20and%20R_1_Hard%20size_33%20v1.13.cube',
    description: 'Linear tone mapping without contrast S-curve; pure technical transform.',
    size: 33
  },
  {
    id: 'ipp2_no_r2',
    name: 'Rec.709 No Contrast · R2 Medium Rolloff',
    category: 'No Contrast',
    contrast: 'None',
    rolloff: 'Medium (R2)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20NO_CONTRAST%20and%20R_2_Medium%20size_33%20v1.13.cube',
    description: 'Unbent tone response with medium highlight roll-off.',
    size: 33
  },
  {
    id: 'ipp2_no_r3',
    name: 'Rec.709 No Contrast · R3 Soft Rolloff',
    category: 'No Contrast',
    contrast: 'None',
    rolloff: 'Soft (R3)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20NO_CONTRAST%20and%20R_3_Soft%20size_33%20v1.13.cube',
    description: 'Neutral transfer curve with gentle highlight knee.',
    size: 33
  },
  {
    id: 'ipp2_no_r4',
    name: 'Rec.709 No Contrast · R4 Very Soft Rolloff',
    category: 'No Contrast',
    contrast: 'None',
    rolloff: 'Very Soft (R4)',
    fileUrl: '/luts/REC709/RWG_Log3G10%20to%20REC709_BT1886%20with%20NO_CONTRAST%20and%20R_4_VerySoft%20size_33%20v1.13.cube',
    description: 'Neutral transfer curve with softest possible highlight shoulder.',
    size: 33
  }
];

// Memory cache for parsed 3D LUTs
const lutCache = new Map<string, LutData>();

export async function fetchAndParseCatalogLut(item: CatalogLutItem): Promise<LutData> {
  if (lutCache.has(item.id)) {
    return lutCache.get(item.id)!;
  }

  if (!item.fileUrl) {
    throw new Error(`No file URL specified for ${item.name}`);
  }

  const response = await fetch(item.fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to load ${item.name}: HTTP ${response.status}`);
  }

  const text = await response.text();
  const parsed = parseCubeText(text, item.name);
  parsed.description = item.description;

  lutCache.set(item.id, parsed);
  return parsed;
}
