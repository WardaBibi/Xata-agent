'use server';

import { and, eq, isNull, or } from 'drizzle-orm';
import { promises as fs } from 'fs';
import path from 'path';
import { DBAccess } from '~/lib/db/db';
import { MCPServer, MCPServerInsert, mcpServers } from '~/lib/db/schema';
import { getMCPServersDir } from '../ai/tools/user-mcp';

export async function getUserMcpServers(dbAccess: DBAccess, projectId: string) {
  return await dbAccess.query(async ({ db }) => {
    return await db
      .select()
      .from(mcpServers)
      .where(or(eq(mcpServers.projectId, projectId), isNull(mcpServers.projectId)));
  });
}

export async function getUserMcpServer(dbAccess: DBAccess, serverName: string, projectId?: string) {
  return await dbAccess.query(async ({ db }) => {
    const condition =
      projectId !== undefined
        ? and(eq(mcpServers.name, serverName), eq(mcpServers.projectId, projectId))
        : eq(mcpServers.name, serverName);

    const result = await db.select().from(mcpServers).where(condition).limit(1);
    return result[0];
  });
}

export async function findServerOnDisk(server: string): Promise<MCPServerInsert | null> {
  const mcpServersDir = getMCPServersDir();

  const sanitizedServer = server.replace(/[^a-zA-Z0-9.-]/g, '');
  const filePath = path.join(mcpServersDir, `${sanitizedServer}.js`);
  if (!filePath.startsWith(mcpServersDir) || filePath.includes('..')) {
    return null;
  }

  try {
    await fs.access(filePath);
  } catch {
    return null;
  }

  return {
    name: sanitizedServer,
    serverName: sanitizedServer,
    filePath: `${sanitizedServer}.js`,
    version: '0.0.0',
    enabled: false,
    command: 'node',
    args: null
  };
}

export async function updateUserMcpServer(dbAccess: DBAccess, input: MCPServerInsert) {
  return await dbAccess.query(async ({ db }) => {
    const condition =
      input.projectId !== undefined && input.projectId !== null
        ? and(eq(mcpServers.name, input.name), eq(mcpServers.projectId, input.projectId))
        : eq(mcpServers.name, input.name);

    const result = await db
      .update(mcpServers)
      .set({
        enabled: input.enabled,
        envVars: input.envVars,
        command: input.command,
        args: input.args
      })
      .where(condition)
      .returning();

    if (result.length === 0) {
      throw new Error(`[UPDATE] Server with name "${input.name}" not found`);
    }

    return result[0];
  });
}

export async function addUserMcpServerToDB(dbAccess: DBAccess, input: MCPServer): Promise<MCPServer> {
  return await dbAccess.query(async ({ db }) => {
    const result = await db
      .insert(mcpServers)
      .values({
        name: input.name,
        serverName: input.serverName,
        version: '0.0.0',
        filePath: input.filePath ?? null,
        enabled: input.enabled,
        projectId: input.projectId ?? null,
        command: input.command ?? 'node',
        args: input.args ?? null
      })
      .returning();

    const server = result[0];
    if (!server) {
      throw new Error('Failed to create server');
    }

    return server;
  });
}

export async function registerExternalMcpServer(
  dbAccess: DBAccess,
  projectId: string,
  input: { name: string; command: string; args: string[]; envVars?: Record<string, string> }
): Promise<MCPServer> {
  return await dbAccess.query(async ({ db }) => {
    const result = await db
      .insert(mcpServers)
      .values({
        name: input.name,
        serverName: input.name,
        version: '0.0.0',
        filePath: null,
        enabled: true,
        projectId,
        command: input.command,
        args: input.args,
        envVars: input.envVars ?? {}
      })
      .returning();

    const server = result[0];
    if (!server) {
      throw new Error('Failed to register external MCP server');
    }

    return server;
  });
}

export async function deleteUserMcpServer(dbAccess: DBAccess, serverName: string, projectId?: string): Promise<void> {
  return await dbAccess.query(async ({ db }) => {
    const condition =
      projectId !== undefined
        ? and(eq(mcpServers.name, serverName), eq(mcpServers.projectId, projectId))
        : eq(mcpServers.name, serverName);

    const result = await db.delete(mcpServers).where(condition).returning();

    if (result.length === 0) {
      throw new Error(`Server with name "${serverName}" not found`);
    }
  });
}
