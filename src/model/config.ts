import { DocumentGateway } from '../gateways/document';

// Device IDs are stored as a comma-separated string in Sheet1!K1.
const DEVICES_CELL = 'Sheet1!K1';

export async function loadSpotifyDeviceIds(gateway: DocumentGateway, spreadsheetId: string): Promise<string[]> {
  try {
    const rows = await gateway.getSheetValues(spreadsheetId, DEVICES_CELL);
    const cell = rows[0]?.[0] ?? '';
    return cell ? cell.split(',').map(s => s.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function saveSpotifyDeviceIds(gateway: DocumentGateway, spreadsheetId: string, ids: string[]): Promise<void> {
  await gateway.setSheetValues(spreadsheetId, DEVICES_CELL, [[ids.join(',')]]);
}
