import { DocumentGateway } from '../gateways/document';
import { HEADER_ROW } from './albums';

// Wipes Sheet1 and writes the current header row. No existing data is worth
// preserving (POC-only "Title" column), so this is a full reinitialize rather
// than an incremental migration.
export async function initializeSheet(gateway: DocumentGateway, spreadsheetId: string): Promise<void> {
  await gateway.clearSheetValues(spreadsheetId, 'Sheet1');
  await gateway.setSheetValues(spreadsheetId, 'Sheet1!A1:I1', [HEADER_ROW]);
}
