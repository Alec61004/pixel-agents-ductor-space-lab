/** Do not expose partially downloaded/undecodable sprites to the render loop. */
export async function loadStarshipImage(
  image: HTMLImageElement,
  url: string,
  expectedSize?: { width: number; height: number },
): Promise<boolean> {
  image.src = url;
  try {
    await image.decode();
    return (
      image.naturalWidth > 0 &&
      image.naturalHeight > 0 &&
      (!expectedSize ||
        (image.naturalWidth === expectedSize.width &&
          image.naturalHeight === expectedSize.height))
    );
  } catch {
    return false;
  }
}
