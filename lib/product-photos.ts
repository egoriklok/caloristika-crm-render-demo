import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export type ProductPhoto = {
  name: string
  site_title?: string
  product_url?: string
  image_url?: string
  image_match?: string
  image_note?: string
}

export type ProductPhotoFields = {
  image_url: string | null
  product_url: string | null
  image_source: string | null
  image_match: string | null
  image_note: string | null
  site_title: string | null
}

type ProductPhotoMaps = {
  exact: Map<string, ProductPhoto>
  normalized: Map<string, ProductPhoto>
}

let cachedPhotos: ProductPhotoMaps | null = null

export function normalizeProductPhotoKey(name: string) {
  return name
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»“”"]/g, "")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function getProductPhotos(): ProductPhotoMaps {
  if (cachedPhotos) return cachedPhotos

  const path = join(process.cwd(), "data", "product-photos.json")
  if (!existsSync(path)) {
    cachedPhotos = {
      exact: new Map<string, ProductPhoto>(),
      normalized: new Map<string, ProductPhoto>()
    }
    return cachedPhotos
  }

  const payload = JSON.parse(readFileSync(path, "utf-8")) as { items?: ProductPhoto[] }
  const items = payload.items ?? []
  cachedPhotos = {
    exact: new Map(items.map((item) => [item.name, item])),
    normalized: new Map(items.map((item) => [normalizeProductPhotoKey(item.name), item]))
  }
  return cachedPhotos
}

export function attachProductPhotos<T extends { name: string } & Partial<ProductPhotoFields>>(
  items: T[]
): Array<T & ProductPhotoFields> {
  const photos = getProductPhotos()
  return items.map((item) => {
    const photo = photos.exact.get(item.name) ?? photos.normalized.get(normalizeProductPhotoKey(item.name))

    return {
      ...item,
      image_url: item.image_url ?? photo?.image_url ?? null,
      product_url: item.product_url ?? photo?.product_url ?? null,
      image_source: item.image_source ?? photo?.product_url ?? "https://lunch-up.ru/",
      image_match: item.image_match ?? photo?.image_match ?? null,
      image_note: item.image_note ?? photo?.image_note ?? null,
      site_title: item.site_title ?? photo?.site_title ?? null
    }
  })
}
