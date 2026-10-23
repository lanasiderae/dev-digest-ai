ALTER TABLE "skills" ADD COLUMN "project_context" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "project_context" jsonb DEFAULT '[]'::jsonb NOT NULL;