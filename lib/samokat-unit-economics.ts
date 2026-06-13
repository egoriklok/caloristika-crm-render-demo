import type { ClientCatalogProduct } from "@/lib/client-catalog"
import {
  exactRetailBenchmarkCount,
  recommendedRetailPrice,
  type ExactRetailBenchmark
} from "@/lib/retail-price-benchmarks"

export type SamokatBenchmark = ExactRetailBenchmark

export type SamokatUnitEconomicsRow = {
  productId: number
  category: string
  name: string
  netWeight: string | null
  imageUrl: string | null
  productUrl: string | null
  catalogSource: string
  lunchUpPurchaseBase: number
  lunchUpPurchaseWithTax: number
  recommendedSellPrice: number
  marketSellPrice: number | null
  customerSavingsVsMarket: number | null
  marketMinusLunchUpWithTax: number | null
  recommendedProfitAfterTax: number
  marketPriceProfitAfterTax: number | null
  recommendedMarginPercent: number
  benchmark: SamokatBenchmark | null
}

export type SamokatUnitEconomics = {
  generatedAt: string
  taxRate: number
  taxLabel: string
  assumptions: string[]
  summary: {
    skuCount: number
    comparableSkuCount: number
    totalPurchaseWithTax: number
    totalRecommendedRevenue: number
    totalMarketRevenue: number
    totalCustomerSavingsVsMarket: number
    totalRecommendedProfitAfterTax: number
    totalMarketPriceProfitAfterTax: number
    averageRecommendedProfitAfterTax: number
    averageRecommendedMarginPercent: number
  }
  rows: SamokatUnitEconomicsRow[]
}

export const samokatTaxRate = 0.22

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function buildSamokatUnitEconomics(products: ClientCatalogProduct[]): SamokatUnitEconomics {
  const rows = products.map((product) => {
    const lunchUpPurchaseBase = product.price
    const lunchUpPurchaseWithTax = roundMoney(lunchUpPurchaseBase * (1 + samokatTaxRate))
    const retailRecommendation = recommendedRetailPrice({
      name: product.name,
      category: product.category,
      price: lunchUpPurchaseWithTax
    })
    const benchmark = retailRecommendation.benchmark
    const recommendedSellPrice = retailRecommendation.price
    const marketSellPrice = benchmark?.sellPrice ?? null
    const customerSavingsVsMarket =
      marketSellPrice === null ? null : roundMoney(marketSellPrice - recommendedSellPrice)
    const marketMinusLunchUpWithTax =
      marketSellPrice === null ? null : roundMoney(marketSellPrice - lunchUpPurchaseWithTax)
    const recommendedProfitAfterTax = roundMoney((recommendedSellPrice - lunchUpPurchaseWithTax) / (1 + samokatTaxRate))
    const marketPriceProfitAfterTax =
      marketSellPrice === null ? null : roundMoney((marketSellPrice - lunchUpPurchaseWithTax) / (1 + samokatTaxRate))
    const recommendedMarginPercent = recommendedSellPrice
      ? Math.round((recommendedProfitAfterTax / (recommendedSellPrice / (1 + samokatTaxRate))) * 100)
      : 0

    return {
      productId: product.id,
      category: product.category,
      name: product.name,
      netWeight: product.net_weight,
      imageUrl: product.image_url,
      productUrl: product.product_url,
      catalogSource: "CRM SQLite products",
      lunchUpPurchaseBase,
      lunchUpPurchaseWithTax,
      recommendedSellPrice,
      marketSellPrice,
      customerSavingsVsMarket,
      marketMinusLunchUpWithTax,
      recommendedProfitAfterTax,
      marketPriceProfitAfterTax,
      recommendedMarginPercent,
      benchmark
    } satisfies SamokatUnitEconomicsRow
  })

  const comparableRows = rows.filter((row) => row.marketSellPrice !== null)
  const totalPurchaseWithTax = rows.reduce((sum, row) => sum + row.lunchUpPurchaseWithTax, 0)
  const totalRecommendedRevenue = rows.reduce((sum, row) => sum + row.recommendedSellPrice, 0)
  const totalMarketRevenue = comparableRows.reduce((sum, row) => sum + (row.marketSellPrice ?? 0), 0)
  const totalCustomerSavingsVsMarket = comparableRows.reduce((sum, row) => sum + (row.customerSavingsVsMarket ?? 0), 0)
  const totalRecommendedProfitAfterTax = rows.reduce((sum, row) => sum + row.recommendedProfitAfterTax, 0)
  const totalMarketPriceProfitAfterTax = comparableRows.reduce((sum, row) => sum + (row.marketPriceProfitAfterTax ?? 0), 0)
  const skuCount = rows.length || 1

  return {
    generatedAt: "2026-06-08",
    taxRate: samokatTaxRate,
    taxLabel: "НДС 22%",
    assumptions: [
      "SKU, закупочная цена, вес, фото и ссылка Lunch Up берутся из единого CRM-каталога в SQLite.",
      "Закупка Lunch Up пересчитана как CRM-цена x 1,22, чтобы показать входящую цену с НДС для B2B-клиента в базовом сценарии 2026.",
      `Внешнее сравнение заполнено только для ${comparableRows.length} SKU с точным публичным совпадением; база источников содержит ${exactRetailBenchmarkCount()} точных правил сопоставления.`,
      "Если точный публичный SKU не найден, рыночная цена, разница и потенциал не показываются; РРЦ считается только от закупки Lunch Up и целевой наценки.",
      "Формула прибыли после НДС: (цена продажи с НДС - закупка Lunch Up с НДС) / 1,22."
    ],
    summary: {
      skuCount: rows.length,
      comparableSkuCount: comparableRows.length,
      totalPurchaseWithTax: roundMoney(totalPurchaseWithTax),
      totalRecommendedRevenue: roundMoney(totalRecommendedRevenue),
      totalMarketRevenue: roundMoney(totalMarketRevenue),
      totalCustomerSavingsVsMarket: roundMoney(totalCustomerSavingsVsMarket),
      totalRecommendedProfitAfterTax: roundMoney(totalRecommendedProfitAfterTax),
      totalMarketPriceProfitAfterTax: roundMoney(totalMarketPriceProfitAfterTax),
      averageRecommendedProfitAfterTax: roundMoney(totalRecommendedProfitAfterTax / skuCount),
      averageRecommendedMarginPercent: Math.round(
        rows.reduce((sum, row) => sum + row.recommendedMarginPercent, 0) / skuCount
      )
    },
    rows
  }
}
