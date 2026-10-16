// Drag-and-drop payloads shared by the image pool and slot image grids.
export const POOL_TYPE = 'application/x-wallpy-images';
export const REORDER_TYPE = 'application/x-wallpy-reorder';

/** Image names dragged from the pool, or null. */
export function poolImages(e) {
  try {
    const raw = e.dataTransfer.getData(POOL_TYPE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** { slotId, index } of a thumbnail being reordered, or null. */
export function reorderSource(e) {
  try {
    const raw = e.dataTransfer.getData(REORDER_TYPE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
