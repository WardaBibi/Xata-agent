import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { getMCPServersDir } from '~/lib/ai/tools/user-mcp';
import { getUserSessionDBAccess } from '~/lib/db/db';
import { getUserMcpServers } from '~/lib/db/mcp-servers';

const mcpServersDir = getMCPServersDir();

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId');

    // Discover file-based Node.js servers from disk
    let fileBasedServers: { name: string; serverName: string; enabled: boolean; filePath: string }[] = [];
    try {
      const files = await fs.readdir(mcpServersDir);
      fileBasedServers = files
        .filter((file) => file.endsWith('.js'))
        .map((file) => ({
          name: file.slice(0, -3),
          serverName: file,
          filePath: file,
          enabled: false
        }));
    } catch {
      // mcp-source/dist doesn't exist yet — that's fine
    }

    // Load external (non-file) servers from DB for this project
    let externalServers: {
      name: string;
      serverName: string;
      enabled: boolean;
      command: string;
      args: string[] | null;
    }[] = [];
    if (projectId) {
      try {
        const dbAccess = await getUserSessionDBAccess();
        const dbServers = await getUserMcpServers(dbAccess, projectId);
        externalServers = dbServers
          .filter((s) => !s.filePath) // external = no file on disk
          .map((s) => ({
            name: s.name,
            serverName: s.serverName,
            enabled: s.enabled,
            command: s.command,
            args: s.args ?? null
          }));
      } catch {
        // DB lookup failed — skip external servers
      }
    }

    // Merge: file-based servers take precedence over any DB duplicates
    const fileNames = new Set(fileBasedServers.map((s) => s.name));
    const merged = [...fileBasedServers, ...externalServers.filter((s) => !fileNames.has(s.name))];

    return NextResponse.json(merged);
  } catch (error) {
    console.error('Error reading MCP servers:', error);
    return NextResponse.json({ error: 'Failed to read MCP servers' }, { status: 500 });
  }
}
