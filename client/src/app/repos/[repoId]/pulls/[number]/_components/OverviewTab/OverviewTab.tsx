"use client";

import React from "react";
import { SectionLabel } from "@devdigest/ui";
import type { PrFile } from "@devdigest/shared";
import { IntentCard } from "./_components/IntentCard";
import { BlastRadiusCard } from "./_components/BlastRadiusCard";
import { PrBriefCard } from "./_components/PrBriefCard";
import { s } from "./styles";

interface OverviewTabProps {
  prId: string | null | undefined;
  prBody: string | null | undefined;
  repoFullName?: string | null;
  headSha?: string | null;
  /** This PR's actual changed files — grounds PrBriefCard's diff navigation
   *  (BRIEF-AC-17). Defaults to `[]` for call sites that don't have it yet. */
  files?: PrFile[];
}

export function OverviewTab({ prId, prBody, repoFullName, headSha, files = [] }: OverviewTabProps) {
  return (
    <>
      <PrBriefCard
        prId={prId}
        files={files}
        intent={<IntentCard prId={prId} embedded />}
        blast={<BlastRadiusCard prId={prId} repoFullName={repoFullName} headSha={headSha} embedded />}
      />

      {prBody && (
        <section>
          <SectionLabel icon="MessageSquare">Description</SectionLabel>
          <div style={s.descriptionBox}>{prBody}</div>
        </section>
      )}
    </>
  );
}
