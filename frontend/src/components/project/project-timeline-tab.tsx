"use client";

import { useState } from "react";
import { GanttChart } from "./gantt-chart";

interface ProjectTimelineTabProps {
  projectId: string;
}

export function ProjectTimelineTab({ projectId }: ProjectTimelineTabProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <GanttChart
      projectId={projectId}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    />
  );
}
