export const AVATAR_SIZE = 256
export const AVATAR_INPUT_MAX_BYTES = 5 * 1024 * 1024

/** Reduz a imagem para um quadrado de 256 px (recorte central) e devolve um data URL JPEG. */
export async function imageToAvatarDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Use uma imagem PNG, JPEG ou WebP.')
  if (file.size > AVATAR_INPUT_MAX_BYTES) throw new Error('A imagem deve ter no máximo 5 MB.')
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Não foi possível ler esta imagem.')
  })
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = AVATAR_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem.')
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}
