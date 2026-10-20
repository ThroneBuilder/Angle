// Image downloads (T049; FR-019). Images are for viewing only, so they are not covered by the
// determinism requirement.

function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function serialize(svg: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(svg);
}

export function downloadSvg(svg: SVGSVGElement, name: string): void {
  save(new Blob([serialize(svg)], { type: 'image/svg+xml' }), `${name}.svg`);
}

/** Render the SVG at its own width and height, times `scale`, through an off-screen canvas. */
export async function downloadPng(svg: SVGSVGElement, name: string, scale = 2): Promise<void> {
  const width = Number(svg.getAttribute('width')) * scale;
  const height = Number(svg.getAttribute('height')) * scale;
  const url = URL.createObjectURL(new Blob([serialize(svg)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) save(blob, `${name}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** contracts/exports.md: angle-{preset|custom}-{16p07}deg[-part]. */
export function fileBase(preset: string, buildDeg: number, part?: string): string {
  return `angle-${preset}-${buildDeg.toFixed(2).replace('.', 'p')}deg${part ? `-${part}` : ''}`;
}
