'use client';

import React from 'react';
import {
  DndContext, DragEndEvent, closestCenter,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableGridProps {
  items: string[];
  onReorder: (items: string[]) => void;
  className?: string;
  children: React.ReactNode;
}

export function SortableGrid({ items, onReorder, className, children }: SortableGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const oldIdx = items.indexOf(active.id as string);
      const newIdx = items.indexOf(over.id as string);
      if (oldIdx === -1 || newIdx === -1) return;
      const next = [...items];
      next.splice(oldIdx, 1);
      next.splice(newIdx, 0, active.id as string);
      onReorder(next);
    }}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {children}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

export function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : 'auto' as unknown as number,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <div
        {...attributes}
        {...listeners}
        className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity hover:shadow-md"
      >
        <GripVertical size={10} className="text-slate-400" />
      </div>
      {children}
    </div>
  );
}
