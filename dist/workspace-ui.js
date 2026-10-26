/** Fit the whole sheet to the available content box, preserving its coordinates. */
export function fitImageSize(imageWidth, imageHeight, availableWidth, availableHeight) {
  if (![imageWidth, imageHeight, availableWidth, availableHeight].every(n => Number.isFinite(n) && n > 0)) return null;
  const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
  return { width: imageWidth * scale, height: imageHeight * scale };
}

/** One file-drop path for the upload card and the main drawing desk. */
export function bindFileDrop(target, { onFiles, isBusy = () => false }) {
  let depth = 0;
  const isFileDrag = event => Array.from(event.dataTransfer?.types ?? []).includes('Files');
  const clear = () => { depth = 0; target.classList.remove('dragging'); };
  target.addEventListener('dragenter', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    if (!isBusy()) { depth++; target.classList.add('dragging'); }
  });
  target.addEventListener('dragover', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = isBusy() ? 'none' : 'copy';
  });
  target.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) clear();
  });
  target.addEventListener('drop', event => {
    if (!isFileDrag(event) && !event.dataTransfer?.files?.length) return;
    event.preventDefault();
    event.stopPropagation();
    clear();
    if (!isBusy()) onFiles(Array.from(event.dataTransfer.files));
  });
  return clear;
}

export function zoomView(view, nextZoom, anchor=[0,0]) {
  const zoom=Math.max(1,Math.min(5,nextZoom)),ratio=zoom/view.zoom;
  return {zoom,panX:anchor[0]-(anchor[0]-view.panX)*ratio,panY:anchor[1]-(anchor[1]-view.panY)*ratio};
}
