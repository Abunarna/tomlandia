export const preloadImages = (
  imageSrcs: string[],
  onProgress?: (loadedCount: number, totalCount: number) => void
): Promise<void[]> => {
  let loadedCount = 0;
  const totalCount = imageSrcs.length;

  if (totalCount === 0) return Promise.resolve([]);

  const promises = imageSrcs.map((src) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.src = src;

      img.onload = () => {
        loadedCount++;
        onProgress?.(loadedCount, totalCount);
        resolve();
      };

      img.onerror = (err) => {
        console.warn(`Failed to load asset: ${src}`, err);
        loadedCount++;
        onProgress?.(loadedCount, totalCount);
        resolve();
      };
    });
  });

  return Promise.all(promises);
};
