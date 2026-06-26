import { DocumentGateway } from '../gateways/document';
import type { Album, Listen } from './types';

const SHEET = 'Sheet1';
export const HEADER_ROW = ['Id', 'Name', 'Year', 'Artist', 'SpotifyId', 'Groups', 'Listens', 'Priority', 'Muted'];
export const FIRST_DATA_ROW = 2;

// Raw, sheet-shaped representation of one row: strings as they appear in cells,
// listens still encoded. Mutations round-trip through this so a write never
// touches columns it doesn't intend to change.
interface RawRow {
  id: string;
  name: string;
  year: string;
  artist: string;
  spotifyId: string;
  groups: string;
  listensCell: string;
  priority: string;
  muted: string;
}

function parseRawRow(values: string[]): RawRow {
  return {
    id: values[0] ?? '',
    name: values[1] ?? '',
    year: values[2] ?? '',
    artist: values[3] ?? '',
    spotifyId: values[4] ?? '',
    groups: values[5] ?? '',
    listensCell: values[6] ?? '',
    priority: values[7] ?? '',
    muted: values[8] ?? '',
  };
}

function rawRowToValues(row: RawRow): string[] {
  return [row.id, row.name, row.year, row.artist, row.spotifyId, row.groups, row.listensCell, row.priority, row.muted];
}

function rawRowToAlbum(row: RawRow): Album {
  return {
    id: row.id,
    name: row.name,
    year: row.year ? parseInt(row.year, 10) : null,
    artist: row.artist,
    spotifyId: row.spotifyId || null,
    groups: row.groups ? row.groups.split(',').map(g => g.trim()).filter(Boolean) : [],
    priority: row.priority ? parseFloat(row.priority) : 0,
    muted: row.muted.toUpperCase() === 'TRUE',
  };
}

function parseListensCell(cell: string, albumId: string): Listen[] {
  if (!cell.trim()) return [];
  return cell.split(',').map((entry, index) => {
    const dashIndex = entry.indexOf('-');
    const date = dashIndex === -1 ? entry : entry.slice(0, dashIndex);
    const rating = dashIndex === -1 ? '' : entry.slice(dashIndex + 1);
    return { albumId, index, date, rating };
  });
}

function encodeListens(listens: Listen[]): string {
  return listens.map(l => `${l.date}-${l.rating}`).join(',');
}

export function todayStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function rowRange(rowIndex: number): string {
  return `${SHEET}!A${rowIndex}:I${rowIndex}`;
}

export interface ParsedSheet {
  albums: Album[];
  listens: Listen[];
  rowIndex: Map<string, number>; // albumId -> sheet row (1-indexed, includes header offset)
}

export function parseSheet(rows: string[][]): ParsedSheet {
  const albums: Album[] = [];
  const listens: Listen[] = [];
  const rowIndex = new Map<string, number>();

  rows.forEach((values, i) => {
    const raw = parseRawRow(values);
    if (!raw.id) return;
    const sheetRow = i + FIRST_DATA_ROW;
    albums.push(rawRowToAlbum(raw));
    listens.push(...parseListensCell(raw.listensCell, raw.id));
    rowIndex.set(raw.id, sheetRow);
  });

  return { albums, listens, rowIndex };
}

// Single read of the whole sheet; albums/listens/rowIndex all derive from it.
export async function loadAlbums(gateway: DocumentGateway, spreadsheetId: string): Promise<ParsedSheet> {
  const rows = await gateway.getSheetValues(spreadsheetId, `${SHEET}!A${FIRST_DATA_ROW}:I`);
  return parseSheet(rows);
}

export type MutationResult = { ok: true } | { ok: false; reason: 'stale' };

// Reads just the one row, checks the cache is still valid, applies `mutator`, writes it back.
// This is the only per-write read — never the whole sheet.
async function mutateRow(
  gateway: DocumentGateway,
  spreadsheetId: string,
  rowIndex: number,
  expectedId: string,
  mutator: (row: RawRow) => RawRow
): Promise<MutationResult> {
  const values = await gateway.getSheetValues(spreadsheetId, rowRange(rowIndex));
  const row = parseRawRow(values[0] ?? []);
  if (row.id !== expectedId) return { ok: false, reason: 'stale' };
  await gateway.setSheetValues(spreadsheetId, rowRange(rowIndex), [rawRowToValues(mutator(row))]);
  return { ok: true };
}

export function addListen(
  gateway: DocumentGateway,
  spreadsheetId: string,
  rowIndex: number,
  albumId: string,
  rating: string = ''
): Promise<MutationResult> {
  return mutateRow(gateway, spreadsheetId, rowIndex, albumId, row => {
    const entry = `${todayStamp()}-${rating}`;
    return { ...row, listensCell: row.listensCell ? `${row.listensCell},${entry}` : entry };
  });
}

export function rateListen(
  gateway: DocumentGateway,
  spreadsheetId: string,
  rowIndex: number,
  albumId: string,
  listenIndex: number,
  rating: string
): Promise<MutationResult> {
  return mutateRow(gateway, spreadsheetId, rowIndex, albumId, row => {
    const listens = parseListensCell(row.listensCell, albumId);
    if (listens[listenIndex]) listens[listenIndex] = { ...listens[listenIndex], rating };
    return { ...row, listensCell: encodeListens(listens) };
  });
}

export function setMuted(
  gateway: DocumentGateway,
  spreadsheetId: string,
  rowIndex: number,
  albumId: string,
  muted: boolean
): Promise<MutationResult> {
  return mutateRow(gateway, spreadsheetId, rowIndex, albumId, row => ({ ...row, muted: muted ? 'TRUE' : 'FALSE' }));
}

export interface SpotifyMetadata {
  spotifyId: string;
  name?: string;
  artist?: string;
  year?: number | null;
}

// Overwrites spotifyId; fills name/artist/year only where currently blank.
export function setSpotifyMetadata(
  gateway: DocumentGateway,
  spreadsheetId: string,
  rowIndex: number,
  albumId: string,
  metadata: SpotifyMetadata
): Promise<MutationResult> {
  return mutateRow(gateway, spreadsheetId, rowIndex, albumId, row => ({
    ...row,
    spotifyId: metadata.spotifyId,
    name: row.name || metadata.name || '',
    artist: row.artist || metadata.artist || '',
    year: row.year || (metadata.year ? String(metadata.year) : ''),
  }));
}

// The sampling draw touches every unmuted album's priority at once by design,
// so this writes the whole Priority column in a single call rather than
// per-row verify+write.
export function writePriorities(
  gateway: DocumentGateway,
  spreadsheetId: string,
  lastRow: number,
  priorities: Map<string, number>,
  rowIndex: Map<string, number>
): Promise<void> {
  const idByRow = new Map<number, string>();
  for (const [id, row] of rowIndex) idByRow.set(row, id);

  const values: string[][] = [];
  for (let row = FIRST_DATA_ROW; row <= lastRow; row++) {
    const id = idByRow.get(row);
    const priority = id !== undefined ? priorities.get(id) : undefined;
    values.push([priority !== undefined ? String(priority) : '']);
  }
  return gateway.setSheetValues(spreadsheetId, `${SHEET}!H${FIRST_DATA_ROW}:H${lastRow}`, values);
}

function generateAlbumId(existingIds: Set<string>): string {
  let id: string;
  do {
    id = Array.from(crypto.getRandomValues(new Uint8Array(3)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } while (existingIds.has(id));
  return id;
}

export interface NewAlbum {
  name: string;
  year: number | null;
  artist: string;
  spotifyId: string | null;
  groups: string[];
}

export async function addAlbum(
  gateway: DocumentGateway,
  spreadsheetId: string,
  album: NewAlbum,
  existingIds: Set<string>
): Promise<Album> {
  const id = generateAlbumId(existingIds);
  const raw: RawRow = {
    id,
    name: album.name,
    year: album.year !== null ? String(album.year) : '',
    artist: album.artist,
    spotifyId: album.spotifyId ?? '',
    groups: album.groups.join(','),
    listensCell: '',
    priority: '0',
    muted: 'FALSE',
  };
  await gateway.appendSheetValues(spreadsheetId, `${SHEET}!A:I`, [rawRowToValues(raw)]);
  return rawRowToAlbum(raw);
}
