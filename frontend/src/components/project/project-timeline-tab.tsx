"use client";

import { GanttChart } from "./gantt-chart";

interface ProjectTimelineTabProps {
  projectId: string;
}

export function ProjectTimelineTab({ projectId }: ProjectTimelineTabProps) {
  return <GanttChart projectId={projectId} />;
}
