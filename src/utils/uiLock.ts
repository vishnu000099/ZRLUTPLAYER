/**
 * UI lock code for the Export Video panel and the .CUBE LUT export dialog.
 *
 * IMPORTANT: this is a convenience UI lock, NOT a security control.
 * The code ships inside the application bundle and can be read by anyone who
 * inspects the app's files. It does not encrypt, sign or otherwise protect the
 * application, its LUTs or exported files, and it must not be described as doing so.
 */
export const UI_LOCK_CODE = '0554318462';
