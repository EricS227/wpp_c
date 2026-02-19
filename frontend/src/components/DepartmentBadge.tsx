'use client';

import { Badge } from '@/components/ui/badge';
import { Department } from '@/types/conversation';

export function DepartmentBadge({ department }: { department?: Department | null }) {
  if (!department) return null;
  const color = department.color || '#6366f1';
  return (
    <Badge
      variant="secondary"
      className="text-xs font-normal"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {department.name}
    </Badge>
  );
}
