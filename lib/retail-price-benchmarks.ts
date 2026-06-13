export type RetailBenchmarkConfidence = "Точный SKU" | "Точный весовой SKU"

export type ExactRetailBenchmark = {
  code: string
  label: string
  provider: string
  sellPrice: number
  netWeight: string
  sourceLabel: string
  sourceUrl: string
  sourceNote: string
  confidence: RetailBenchmarkConfidence
  matchBasis: string
}

export type RetailPriceRecommendation = {
  price: number
  source: string
  benchmark: ExactRetailBenchmark | null
  isExternalBenchmark: boolean
}

const targetMarkupByCategory: Record<string, number> = {
  Завтраки: 1.75,
  Салаты: 1.8,
  Сэндвичи: 1.85,
  Десерты: 1.8
}

const exactRetailBenchmarksByName: Record<string, ExactRetailBenchmark> = {
  [normalizeProductName("Блинчики с ветчиной и сыром")]: {
    code: "vkusvill-pancakes-ham-cheese-150",
    label: "ВкусВилл: Блинчики с ветчиной и сыром, 150 г",
    provider: "ВкусВилл",
    sellPrice: 260,
    netWeight: "150 г",
    sourceLabel: "ВкусВилл: Блинчики с ветчиной и сыром, 150 г",
    sourceUrl: "https://vkusvill.ru/goods/blinchiki-s-vetchinoy-i-syrom-97466/",
    sourceNote: "Точное название и вес 150 г; публичная цена 260 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает название позиции и вес"
  },
  [normalizeProductName("Сырники с творогом")]: {
    code: "vkusvill-syrniki-tvorog-120",
    label: "ВкусВилл: Сырники из творога, кафе, 120 г",
    provider: "ВкусВилл",
    sellPrice: 220,
    netWeight: "120 г",
    sourceLabel: "ВкусВилл: Сырники из творога, кафе, 120 г",
    sourceUrl: "https://vkusvill.ru/goods/syrniki-iz-tvoroga-27161/",
    sourceNote: "Точное блюдо и вес 120 г; публичная цена 220 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает блюдо и вес"
  },
  [normalizeProductName("Салат «Винегрет»")]: {
    code: "vkusvill-vinegret-150",
    label: "ВкусВилл: Салат \"Винегрет\", 150 г",
    provider: "ВкусВилл",
    sellPrice: 150,
    netWeight: "150 г",
    sourceLabel: "ВкусВилл: Салат \"Винегрет\", 150 г",
    sourceUrl: "https://vkusvill.ru/goods/salat-vinegret-150-g-105795.html",
    sourceNote: "Точное название и вес 150 г; публичная цена 150 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает название салата и вес"
  },
  [normalizeProductName("Салат «Сельдь под шубой»")]: {
    code: "samokat-herring-under-coat-150",
    label: "Самокат: Салат Сельдь под шубой, 150 г",
    provider: "Самокат",
    sellPrice: 175,
    netWeight: "150 г",
    sourceLabel: "Купер: Салат Самокат Сельдь под шубой, 150 г",
    sourceUrl: "https://kuper.ru/products/26552900-salat-samokat-sel-d-pod-shuboy-150-g-c3ac44d",
    sourceNote: "Точное название и вес 150 г; публичная цена 175 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает название салата и вес"
  },
  [normalizeProductName("Десерт «Наполеон»")]: {
    code: "vkusvill-napoleon-120",
    label: "ВкусВилл: Наполеон, 120 г",
    provider: "ВкусВилл",
    sellPrice: 390,
    netWeight: "120 г",
    sourceLabel: "ВкусВилл: Наполеон, 120 г",
    sourceUrl: "https://vkusvill.ru/goods/napoleon-256800.html",
    sourceNote: "Точное название десерта и вес 120 г; публичная цена 390 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает название десерта и вес"
  },
  [normalizeProductName("Десерт «Картошка классическая»")]: {
    code: "perekrestok-pirozhnoe-kartoshka-80",
    label: "Перекресток: Пирожное Картошка, 80 г",
    provider: "Перекресток",
    sellPrice: 199,
    netWeight: "80 г",
    sourceLabel: "Перекресток: Пирожное Картошка, 80 г",
    sourceUrl: "https://promo.perekrestok.ru/cat/b/48550/pekarna-perekrestok?page=2",
    sourceNote: "Точное название десерта и вес 80 г; публичная цена 199 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает название десерта и вес"
  },
  [normalizeProductName("Десерт «Медовик»")]: {
    code: "perekrestok-medovik-klassicheskiy-130",
    label: "Перекресток: Торт Кондитерское Ателье Медовик классический, 130 г",
    provider: "Перекресток",
    sellPrice: 149.9,
    netWeight: "130 г",
    sourceLabel: "Перекресток: Торт Кондитерское Ателье Медовик классический, 130 г",
    sourceUrl: "https://promo.perekrestok.ru/cat/c/201/torty?filter.vid-torta=medovyj",
    sourceNote: "Точное название медовика и вес 130 г; публичная цена 149,90 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает название десерта и вес"
  },
  [normalizeProductName("Десерт «Песочная полоска»")]: {
    code: "perekrestok-pesochnaya-poloska-100",
    label: "Перекресток: Пирожное Ама Песочная полоска, 100 г",
    provider: "Перекресток",
    sellPrice: 109.99,
    netWeight: "100 г",
    sourceLabel: "Перекресток: Пирожное Ама Песочная полоска, 100 г",
    sourceUrl: "https://promo.perekrestok.ru/cat/search?search=%D0%BF%D0%B5%D1%81%D0%BE%D1%87%D0%BD%D0%B0%D1%8F%20%D0%BF%D0%BE%D0%BB%D0%BE%D1%81%D0%BA%D0%B0",
    sourceNote: "Точное название песочной полоски и вес 100 г; публичная цена 109,99 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает название десерта и вес"
  },
  [normalizeProductName("Десерт «Тирамису»")]: {
    code: "perekrestok-farshe-tiramisu-110",
    label: "Перекресток: Пирожное Farshe Тирамису, 110 г",
    provider: "Перекресток",
    sellPrice: 149.99,
    netWeight: "110 г",
    sourceLabel: "Перекресток: Пирожное Farshe Тирамису, 110 г",
    sourceUrl: "https://promo.perekrestok.ru/cat/c/704/piroznye/reviews",
    sourceNote: "Точное название тирамису и вес 110 г; публичная цена 149,99 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает название десерта и вес"
  },
  [normalizeProductName("Сочень с творогом")]: {
    code: "perekrestok-sochen-tvorog-100",
    label: "Перекресток: Сочень Хлебный Дом с творогом, 100 г",
    provider: "Перекресток",
    sellPrice: 81.99,
    netWeight: "100 г",
    sourceLabel: "Перекресток: Сочень Хлебный Дом с творогом, 100 г",
    sourceUrl: "https://promo.perekrestok.ru/cat/search?search=%D1%81%D0%BE%D1%87%D0%B5%D0%BD%D1%8C",
    sourceNote: "Точное название и вес 100 г; публичная цена 81,99 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает название выпечки и вес"
  },
  [normalizeProductName("Салат «Греческий»")]: {
    code: "perekrestok-freshclub-greek-150",
    label: "Перекресток: Салат Freshclub Греческий, 150 г",
    provider: "Перекресток",
    sellPrice: 159.9,
    netWeight: "150 г",
    sourceLabel: "Перекресток: Салат Freshclub Греческий, 150 г",
    sourceUrl: "https://promo.perekrestok.ru/cat/search?page=2&search=%D0%B3%D1%80%D0%B5%D1%87%D0%B5%D1%81%D0%BA%D0%B8%D0%B9",
    sourceNote: "Точное название салата и вес 150 г; публичная цена 159,90 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает название салата и вес"
  },
  [normalizeProductName("Салат «Крабовый»")]: {
    code: "perekrestok-naturbuffet-crab-150",
    label: "Перекресток: Салат Натурбуфет Крабовый, 150 г",
    provider: "Перекресток",
    sellPrice: 119.99,
    netWeight: "150 г",
    sourceLabel: "Перекресток: Салат Натурбуфет Крабовый, 150 г",
    sourceUrl: "https://promo.perekrestok.ru/cat/search?page=4&search=%D0%BA%D1%80%D0%B0%D0%B1%D0%BE%D0%B2%D1%8B",
    sourceNote: "Точное название салата и вес 150 г; публичная цена 119,99 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает название салата и вес"
  },
  [normalizeProductName("Салат «Столичный»")]: {
    code: "perekrestok-naturbuffet-stolichny-150",
    label: "Перекресток: Салат Натурбуфет Столичный, 150 г",
    provider: "Перекресток",
    sellPrice: 124.9,
    netWeight: "150 г",
    sourceLabel: "Перекресток: Салат Натурбуфет Столичный, 150 г",
    sourceUrl: "https://promo.perekrestok.ru/cat/b/59514/natur-buffet",
    sourceNote: "Точное название салата и вес 150 г; публичная цена 124,90 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает название салата и вес"
  },
  [normalizeProductName("Салат «Витаминный»")]: {
    code: "okey-vitaminy-weighted-150",
    label: "Окей: Салат Окей Витаминный, пересчет на 150 г",
    provider: "Окей",
    sellPrice: 54,
    netWeight: "150 г (из весовой цены 72 ₽ / 200 г)",
    sourceLabel: "Boxberry/ЯндексМаркет: Салат Окей Витаминный +-200 г",
    sourceUrl: "https://boxberry.ru/market/category/salaty/brand-okey/",
    sourceNote: "Точное название весовой позиции Окей; источник указывает 72 ₽ за +-200 г, для сравнения 150 г пересчитаны пропорционально.",
    confidence: "Точный весовой SKU",
    matchBasis: "совпадает название салата; весовая цена пересчитана под фасовку Lunch Up"
  },
  [normalizeProductName("Салат «Фунчоза с овощами»")]: {
    code: "okey-funchosa-weighted-150",
    label: "Окей: Салат Окей Фунчоза, пересчет на 150 г",
    provider: "Окей",
    sellPrice: 97.5,
    netWeight: "150 г (из весовой цены 130 ₽ / 200 г)",
    sourceLabel: "Boxberry/ЯндексМаркет: Салат Окей Фунчоза +-200 г",
    sourceUrl: "https://boxberry.ru/market/category/salaty/brand-okey/",
    sourceNote: "Точное название весовой позиции Окей; источник указывает 130 ₽ за +-200 г, для сравнения 150 г пересчитаны пропорционально.",
    confidence: "Точный весовой SKU",
    matchBasis: "совпадает название салата; весовая цена пересчитана под фасовку Lunch Up"
  },
  [normalizeProductName("Ролл «Цезарь»")]: {
    code: "perekrestok-sandwich-roll-caesar-150",
    label: "Перекресток: Сэндвич-ролл Цезарь Шеф Перекресток, 150 г",
    provider: "Перекресток",
    sellPrice: 139.99,
    netWeight: "150 г",
    sourceLabel: "Перекресток: Сэндвич-ролл Цезарь Шеф Перекресток, 150 г",
    sourceUrl: "https://promo.perekrestok.ru/cat/c/306/sendvici",
    sourceNote: "Точное название ролла Цезарь и вес 150 г; публичная цена 139,99 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает название ролла и вес"
  },
  [normalizeProductName("Ролл «Итальянский с курицей в соусе песто»")]: {
    code: "perekrestok-chicken-pesto-roll-190",
    label: "Перекресток: Сэндвич-ролл с курицей и соусом песто, 190 г",
    provider: "Перекресток",
    sellPrice: 249.99,
    netWeight: "190 г",
    sourceLabel: "Перекресток: Сэндвич-ролл с курицей, кабачком и соусом песто, 190 г",
    sourceUrl: "https://promo.perekrestok.ru/cat/c/306/sendvici",
    sourceNote: "Совпадает формат ролла, курица, соус песто и вес 190 г; публичная цена 249,99 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает ключевой состав ролла и вес"
  },
  [normalizeProductName("Сосиска в тесте Макси")]: {
    code: "perekrestok-sosiska-v-teste-100",
    label: "Перекресток: Сосиска в тесте, 100 г",
    provider: "Перекресток",
    sellPrice: 70.99,
    netWeight: "100 г",
    sourceLabel: "Перекресток: Сосиска в тесте, 100 г",
    sourceUrl: "https://promo.perekrestok.ru/cat/196/p/sosiska-v-teste-perekrestok-100g-78008066",
    sourceNote: "Точное название выпечки и вес 100 г; публичная цена 70,99 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает название позиции и вес"
  },
  [normalizeProductName("Сэндвич с ветчиной и сыром")]: {
    code: "perekrestok-ham-cheese-sandwich-150",
    label: "Перекресток: Сэндвич с ветчиной и сыром Шеф Перекресток, 150 г",
    provider: "Перекресток",
    sellPrice: 229.99,
    netWeight: "150 г",
    sourceLabel: "Перекресток: Сэндвич с ветчиной и сыром Шеф Перекресток, 150 г",
    sourceUrl: "https://promo.perekrestok.ru/cat/c/306/sendvici",
    sourceNote: "Точное название сэндвича и вес 150 г; публичная цена 229,99 ₽/шт.",
    confidence: "Точный SKU",
    matchBasis: "совпадает название сэндвича и вес"
  }
}

function normalizeProductName(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function categoryMarkup(category: string) {
  return targetMarkupByCategory[category] ?? 1.8
}

function roundRetailPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.max(49, Math.ceil(value / 10) * 10 - 1)
}

function roundRetailPriceAtOrBelow(value: number, cap: number) {
  if (!Number.isFinite(cap) || cap <= 49) return roundRetailPrice(value)
  const rounded = roundRetailPrice(value)
  if (rounded <= cap) return rounded
  return Math.max(49, Math.floor((cap + 1) / 10) * 10 - 1)
}

export function findRetailBenchmark(product: { name: string; category?: string }) {
  return findExactRetailBenchmark(product)
}

export function findExactRetailBenchmark(product: { name: string; category?: string }) {
  return exactRetailBenchmarksByName[normalizeProductName(product.name)] ?? null
}

export function recommendedRetailPrice(product: {
  name: string
  category: string
  price: number
}): RetailPriceRecommendation {
  const benchmark = findRetailBenchmark(product)
  const markup = categoryMarkup(product.category)
  const costFloor = product.price * markup

  if (benchmark) {
    const competitiveCap = benchmark.sellPrice - 1
    const benchmarkKind = benchmark.confidence === "Точный весовой SKU" ? "точный внешний весовой SKU" : "точный внешний SKU"
    if (costFloor <= competitiveCap) {
      const competitiveTarget = Math.max(costFloor, benchmark.sellPrice * 0.92)
      const price = roundRetailPriceAtOrBelow(competitiveTarget, competitiveCap)
      return {
        price,
        source: `${benchmarkKind}: ${benchmark.label}, ${benchmark.sellPrice} ₽; РРЦ рассчитана ниже публичной цены при целевой наценке`,
        benchmark,
        isExternalBenchmark: true
      }
    }

    const price = roundRetailPrice(costFloor)
    return {
      price,
      source: `${benchmarkKind}: ${benchmark.label}, ${benchmark.sellPrice} ₽; публичная цена ниже целевой входной экономики, РРЦ рассчитана от закупки Lunch Up`,
      benchmark,
      isExternalBenchmark: true
    }
  }

  return {
    price: roundRetailPrice(costFloor),
    source: "точный публичный аналог в Самокате/ВкусВилл/Перекрестке/Окей не найден; РРЦ рассчитана только от закупки Lunch Up и целевой наценки без внешнего сравнения",
    benchmark: null,
    isExternalBenchmark: false
  }
}

export function exactRetailBenchmarkCount() {
  return Object.keys(exactRetailBenchmarksByName).length
}

export function retailBenchmarkCount() {
  return exactRetailBenchmarkCount()
}
