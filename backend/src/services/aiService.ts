import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

// ─── Generate a full ticket from a brief description ─────────────────────────
export async function generateTicket(
  type: 'story' | 'defect' | 'task',
  briefDescription: string,
  projectContext?: string
): Promise<Record<string, unknown>> {
  const systemPrompt = type === 'story'
    ? `You are an agile business analyst. Given a brief description, generate a complete User Story as JSON with these fields:
{
  "title": "As a [role], I want [feature] so that [benefit]",
  "description": "detailed description",
  "acceptanceCriteria": "Given/When/Then acceptance criteria (multi-line)",
  "priority": "critical|high|medium|low",
  "storyPoints": number (Fibonacci: 1,2,3,5,8,13),
  "labels": ["label1", "label2"],
  "suggestedBranch": "feature/short-name"
}
Return ONLY valid JSON, no markdown.`
    : type === 'defect'
    ? `You are a QA engineer. Given a brief defect description, generate a complete Bug Report as JSON:
{
  "title": "concise bug title",
  "description": "full description of the issue",
  "stepsToReproduce": "numbered steps",
  "expectedResult": "what should happen",
  "actualResult": "what actually happens",
  "priority": "critical|high|medium|low",
  "labels": ["label1"],
  "suggestedBranch": "fix/short-name"
}
Return ONLY valid JSON, no markdown.`
    : `You are a developer. Generate a task ticket as JSON:
{
  "title": "concise task title",
  "description": "detailed description of the work",
  "acceptanceCriteria": "definition of done",
  "priority": "critical|high|medium|low",
  "storyPoints": number,
  "labels": [],
  "suggestedBranch": "chore/short-name"
}
Return ONLY valid JSON, no markdown.`;

  const userMessage = projectContext
    ? `Project context: ${projectContext}\n\nBrief description: ${briefDescription}`
    : `Brief description: ${briefDescription}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return JSON.parse(stripMarkdownJson(text));
}

// ─── Enrich an existing ticket ────────────────────────────────────────────────
export async function enrichTicket(
  ticket: Record<string, unknown>,
  field: 'acceptanceCriteria' | 'stepsToReproduce' | 'description'
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Given this ${ticket.type} ticket:\nTitle: ${ticket.title}\nDescription: ${ticket.description || ''}\n\nGenerate detailed content for the "${field}" field. Return plain text only.`,
    }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// ─── Generate architecture/sequence docs from repo ────────────────────────────
export async function generateDocs(
  repoPath: string,
  docType: 'architecture' | 'sequence' | 'dev_guide',
  branch?: string
): Promise<string> {
  const sourceFiles = collectSourceFiles(repoPath);
  if (sourceFiles.length === 0) return '# No source files found in repository.';

  const systemPrompt = docType === 'architecture'
    ? `You are a software architect. Analyze the provided source files and generate a Mermaid.js architecture diagram (graph TD) showing the main components, services, and their relationships. Then add a brief markdown explanation. Format:
\`\`\`mermaid
graph TD
  ...
\`\`\`
## Architecture Overview
...`
    : docType === 'sequence'
    ? `You are a software architect. Analyze the provided source files and generate Mermaid.js sequence diagrams showing the main request/response flows. Then add brief explanations for each flow. Format:
\`\`\`mermaid
sequenceDiagram
  ...
\`\`\`
## Flow Explanation
...`
    : `You are a senior developer. Analyze the provided source files and generate a comprehensive Developer Guide in markdown covering:
1. Project structure and key files
2. How to set up and run locally
3. Key architectural decisions
4. How to add new features
5. Testing approach
6. Branch: ${branch || 'main'}

Be practical and specific to the actual code.`;

  // Build file content with prompt caching for large repos
  const fileChunks = buildFileChunks(sourceFiles, 40000);

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Source files from the repository (branch: ${branch || 'main'}):\n\n${fileChunks}\n\nGenerate the ${docType} documentation.`,
        },
      ],
    },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages,
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// ─── Gap analysis between two branches ───────────────────────────────────────
export async function analyzeGap(
  diff: string,
  base: string,
  head: string
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [{
      type: 'text',
      text: `You are a senior developer reviewing a branch comparison. Analyze the diff and produce a structured Gap Analysis report in markdown:

## Gap Analysis: ${head} vs ${base}

### New Features / Changes
- List what's new or changed

### Missing or Incomplete
- List things that appear incomplete, missing tests, etc.

### Breaking Changes
- Any potential breaking changes

### Merge Readiness
- Overall assessment and recommendations

Be specific and actionable.`,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{
      role: 'user',
      content: `Branch diff (${base}...${head}):\n\n${diff || 'No diff available — branches may be identical.'}`,
    }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stripMarkdownJson(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers if present
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function collectSourceFiles(repoPath: string): Array<{ path: string; content: string }> {
  const result: Array<{ path: string; content: string }> = [];
  const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.cs', '.rb', '.php', '.vue', '.svelte']);
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv', '.venv', 'vendor']);

  function walk(dir: string, depth = 0) {
    if (depth > 6 || result.length > 100) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!skipDirs.has(entry.name)) walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.has(ext)) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              if (content.length < 50000) {
                result.push({ path: fullPath.replace(repoPath, ''), content });
              }
            } catch { }
          }
        }
      }
    } catch { }
  }

  walk(repoPath);
  return result;
}

function buildFileChunks(files: Array<{ path: string; content: string }>, maxChars: number): string {
  let total = 0;
  const parts: string[] = [];
  for (const f of files) {
    const chunk = `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\`\n\n`;
    if (total + chunk.length > maxChars) break;
    parts.push(chunk);
    total += chunk.length;
  }
  return parts.join('');
}
