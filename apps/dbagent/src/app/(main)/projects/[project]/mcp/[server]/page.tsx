import { notFound } from 'next/navigation';
import { McpView } from '~/components/mcp/mcp-view';
import { listConnections } from '~/lib/db/connections';
import { getUserSessionDBAccess } from '~/lib/db/db';
import { findServerOnDisk, getUserMcpServer } from '~/lib/db/mcp-servers';

type PageParams = {
  project: string;
  server: string;
};

export default async function McpServerPage({ params }: { params: Promise<PageParams> }) {
  const { project: projectId, server: serverId } = await params;

  // Try file-based discovery first
  let server = await findServerOnDisk(serverId);

  // Fall back to DB (covers external servers like postgres-mcp)
  if (!server) {
    const dbAccess = await getUserSessionDBAccess();
    const dbServer = await getUserMcpServer(dbAccess, serverId, projectId);
    if (dbServer) {
      server = {
        name: dbServer.name,
        serverName: dbServer.serverName,
        filePath: dbServer.filePath ?? undefined,
        version: dbServer.version,
        enabled: dbServer.enabled,
        envVars: dbServer.envVars,
        projectId: dbServer.projectId ?? undefined,
        command: dbServer.command,
        args: dbServer.args ?? undefined
      };
    }
  }

  if (!server) {
    notFound();
  }

  // Get the project's default connection string to auto-inject DATABASE_URL
  let connectionString: string | undefined;
  try {
    const dbAccess = await getUserSessionDBAccess();
    const connections = await listConnections(dbAccess, projectId);
    const defaultConn = connections.find((c) => c.isDefault) ?? connections[0];
    if (defaultConn) {
      connectionString = defaultConn.connectionString;
    }
  } catch {
    // Not critical — tools preview will still work for servers that don't need a DB
  }

  return (
    <div className="container">
      <McpView server={{ ...server, projectId: server.projectId ?? projectId }} connectionString={connectionString} />
    </div>
  );
}
