import { parseCsv } from "../csv";
import { normalizeStoreNumber } from "../format";

export type RosterEntry = {
  rowNumber: number;
  name: string;
  storeNumber: string;
  position: string;
  qualified: boolean;
};

export type RosterParseIssue = { row: number; message: string };

const NAME_HEADERS = ["name", "employee", "employee name", "trainer"];
const STORE_HEADERS = ["store", "store number", "restaurant", "restaurant #", "restaurant number"];
const POSITION_HEADERS = ["position", "job", "title"];
const QUALIFIED_HEADERS = ["qualified", "qualified trainer", "trainer qualified"];

function column(headers: string[], aliases: string[]) {
  for (const alias of aliases) {
    const index = headers.indexOf(alias);
    if (index >= 0) return index;
  }
  return -1;
}

export function parseDevelopmentReport(csv: string): {
  entries: RosterEntry[];
  issues: RosterParseIssue[];
  qualifiedColumn: boolean;
} {
  const table = parseCsv(csv);
  if (table.length < 2) {
    return {
      entries: [],
      issues: [{ row: 1, message: "Add a header row and at least one person." }],
      qualifiedColumn: false,
    };
  }
  const headers = table[0].map((header) => header.trim().toLowerCase());
  const nameCol = column(headers, NAME_HEADERS);
  const storeCol = column(headers, STORE_HEADERS);
  const positionCol = column(headers, POSITION_HEADERS);
  const qualifiedCol = column(headers, QUALIFIED_HEADERS);
  if (nameCol < 0 || storeCol < 0) {
    return {
      entries: [],
      issues: [{ row: 1, message: "The header needs Name and Store columns." }],
      qualifiedColumn: qualifiedCol >= 0,
    };
  }

  const cell = (row: string[], index: number) => (index >= 0 ? (row[index] ?? "").trim() : "");
  const entries: RosterEntry[] = [];
  const issues: RosterParseIssue[] = [];
  table.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const name = cell(row, nameCol);
    const storeNumber = normalizeStoreNumber(cell(row, storeCol));
    if (name.length < 2) {
      issues.push({ row: rowNumber, message: "Name is missing." });
      return;
    }
    if (!/^\d{5}$/.test(storeNumber)) {
      issues.push({ row: rowNumber, message: "Store needs to be a restaurant number." });
      return;
    }
    const qualifiedRaw = cell(row, qualifiedCol).toLowerCase();
    const qualified =
      qualifiedCol < 0 ? true : ["yes", "y", "true", "1", "qualified", "x"].includes(qualifiedRaw);
    entries.push({
      rowNumber,
      name: name.slice(0, 80),
      storeNumber,
      position: cell(row, positionCol).slice(0, 80),
      qualified,
    });
  });
  return { entries, issues, qualifiedColumn: qualifiedCol >= 0 };
}
