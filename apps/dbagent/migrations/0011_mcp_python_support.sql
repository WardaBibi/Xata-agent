-- Make file_path nullable (external servers like postgres-mcp have no local .js file)
ALTER TABLE "mcp_servers" ALTER COLUMN "file_path" DROP NOT NULL;

--> statement-breakpoint
-- Add project_id to scope MCP servers per project
ALTER TABLE "mcp_servers" ADD COLUMN "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE;

--> statement-breakpoint
-- Add command (default 'node' keeps existing file-based servers working)
ALTER TABLE "mcp_servers" ADD COLUMN "command" text NOT NULL DEFAULT 'node';

--> statement-breakpoint
-- Add args (null = derive from file_path; set explicitly for external servers)
ALTER TABLE "mcp_servers" ADD COLUMN "args" jsonb;

--> statement-breakpoint
-- Drop global unique constraints — names are now unique per project
ALTER TABLE "mcp_servers" DROP CONSTRAINT "uq_mcp_servers_name";

--> statement-breakpoint
ALTER TABLE "mcp_servers" DROP CONSTRAINT "uq_mcp_servers_server_name";

--> statement-breakpoint
-- Per-project uniqueness
ALTER TABLE "mcp_servers" ADD CONSTRAINT "uq_mcp_servers_name_project" UNIQUE("name", "project_id");

--> statement-breakpoint
-- Update RLS: allow access when project_id is null (legacy) or user is a project member
DROP POLICY "mcp_servers_policy" ON "mcp_servers";

--> statement-breakpoint
CREATE POLICY "mcp_servers_policy" ON "mcp_servers" AS PERMISSIVE FOR ALL TO "authenticated_user"
  USING (
    project_id IS NULL OR
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = mcp_servers.project_id
        AND user_id = current_setting('app.current_user', true)::TEXT
    )
  );
