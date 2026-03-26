import { NotesListItemProps } from '@/components/NotesListItem';

const buildChildrenIndex = (feed: NotesListItemProps[]) => {
  const childrenByParentId: Record<string, NotesListItemProps[]> = {};

  for (const n of feed) {
    const pid = (n.parentId ?? 'root') as string;
    if (!childrenByParentId[pid]) childrenByParentId[pid] = [];
    childrenByParentId[pid].push(n);
  }

  // порядок детей по sort, чтобы было стабильно
  for (const pid in childrenByParentId) {
    childrenByParentId[pid].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  }

  return childrenByParentId;
};

export const removeFamily = (
  id: string,
  [node, ...more]: NotesListItemProps[] = [],
  s: Set<string> = new Set([id]),
  r: NotesListItemProps[] = [],
): NotesListItemProps[] => {
  if (node === undefined) return r;
  const nextSet = new Set(s);
  nextSet.add(node.id);
  if (s.has(node.id) || (node.parentId != null && s.has(node.parentId))) {
    return removeFamily(id, [...r, ...more], nextSet, []);
  }
  return removeFamily(id, more, s, [...r, node]);
};

export const getFamily = (id: string, feed: NotesListItemProps[]) => {
  const childrenByParentId = buildChildrenIndex(feed);

  const self = feed.find((n) => n.id === id);
  if (!self) return [];

  const result: NotesListItemProps[] = [self];
  const stack: string[] = [id];
  const visited = new Set<string>(); // защита от циклов

  while (stack.length) {
    const curId = stack.pop()!;
    if (visited.has(curId)) continue;
    visited.add(curId);

    const children = childrenByParentId[curId] ?? [];
    for (const ch of children) {
      result.push(ch);
      stack.push(ch.id);
    }
  }

  return result;
};
