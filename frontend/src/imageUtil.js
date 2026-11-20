// Pinaliliit ang larawan sa browser bago i-upload (para mabilis at hindi bumigat ang database).
export function fileToDataUrl(file, { maxSide = 900, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image (JPG, PNG or WEBP).'));
    if (file.size > 10 * 1024 * 1024) return reject(new Error('The file is too large (max 10 MB).'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';                       // puting background para sa transparent na PNG
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this image. Try a JPG or PNG.')); };
    img.src = url;
  });
}
