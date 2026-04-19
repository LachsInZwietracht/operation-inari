import QRCode from "qrcode";

/**
 * Generates a QR code as a PNG data URL from a URL string.
 */
export async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 256,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}
