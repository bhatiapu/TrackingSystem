import * as XLSX from 'xlsx';

export interface ParsedTicketRow {
  type: 'story' | 'defect' | 'task';
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  storyPoints?: number;
  labels?: string[];
  assigneeEmail?: string;
  sprintName?: string;
}

export function parseExcelTickets(buffer: Buffer): { stories: ParsedTicketRow[]; defects: ParsedTicketRow[] } {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const stories: ParsedTicketRow[] = [];
  const defects: ParsedTicketRow[] = [];

  if (workbook.SheetNames.includes('Stories')) {
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets['Stories']);
    for (const row of rows) {
      if (!row['Title']) continue;
      stories.push({
        type: 'story',
        title: row['Title'],
        description: row['Description'],
        acceptanceCriteria: row['Acceptance Criteria'],
        priority: (row['Priority']?.toLowerCase() as any) || 'medium',
        storyPoints: row['Story Points'] ? parseInt(row['Story Points']) : undefined,
        labels: row['Labels'] ? row['Labels'].split(',').map((l) => l.trim()) : [],
        assigneeEmail: row['Assignee Email'],
        sprintName: row['Sprint'],
      });
    }
  }

  if (workbook.SheetNames.includes('Defects')) {
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets['Defects']);
    for (const row of rows) {
      if (!row['Title']) continue;
      defects.push({
        type: 'defect',
        title: row['Title'],
        description: row['Description'],
        stepsToReproduce: row['Steps To Reproduce'],
        expectedResult: row['Expected Result'],
        actualResult: row['Actual Result'],
        priority: (row['Priority']?.toLowerCase() as any) || 'medium',
        labels: row['Labels'] ? row['Labels'].split(',').map((l) => l.trim()) : [],
        assigneeEmail: row['Assignee Email'],
        sprintName: row['Sprint'],
      });
    }
  }

  return { stories, defects };
}

export function generateTemplate(): Buffer {
  const workbook = XLSX.utils.book_new();

  // Stories sheet
  const storiesData = [
    ['Title', 'Description', 'Acceptance Criteria', 'Priority', 'Story Points', 'Labels', 'Assignee Email', 'Sprint'],
    ['As a user, I want to login', 'User should be able to login with email and password', 'Given/When/Then...', 'high', '5', 'auth,security', 'dev@example.com', 'Sprint 1'],
  ];
  const storiesSheet = XLSX.utils.aoa_to_sheet(storiesData);
  storiesSheet['!cols'] = [{ wch: 40 }, { wch: 50 }, { wch: 50 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, storiesSheet, 'Stories');

  // Defects sheet
  const defectsData = [
    ['Title', 'Description', 'Steps To Reproduce', 'Expected Result', 'Actual Result', 'Priority', 'Labels', 'Assignee Email', 'Sprint'],
    ['Login button not working', 'Clicking login button shows no response', '1. Navigate to /login\n2. Click login', 'User is logged in', 'Nothing happens', 'critical', 'auth,bug', 'dev@example.com', 'Sprint 1'],
  ];
  const defectsSheet = XLSX.utils.aoa_to_sheet(defectsData);
  defectsSheet['!cols'] = [{ wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 30 }, { wch: 30 }, { wch: 12 }, { wch: 20 }, { wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, defectsSheet, 'Defects');

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}
