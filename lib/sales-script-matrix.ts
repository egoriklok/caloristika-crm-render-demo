export type LaunchSkuItem = {
  segment: string
  category: string
  name: string
  quantity: number | null
}

export type ScriptBlockCode = "opening" | "qualification" | "offer" | "proof" | "objection" | "closing" | "follow_up"
export type ScriptFocusCode = "spin" | "horeca" | "vending" | "objections" | "closing" | "email"

export type BaseSegmentStageScript = {
  key: string
  segmentCode: string
  segmentLabel: string
  stageCode: string
  stageName: string
  audience: string
  launchName: string
  goal: string
  offer: string
  skuItems: LaunchSkuItem[]
  framework: string
  close: string
  spin: {
    situation: string
    needPayoff: string
  }
  objection: {
    objection: string
    response: string
    proof_or_asset: string
    next_question: string
  } | null
  proof: string
  nextQuestion: string
}

export type ClientLineScript = {
  key: string
  segmentStageKey: string
  segmentCode: string
  segmentLabel: string
  stageCode: string
  stageName: string
  block: string
  blockCode: ScriptBlockCode
  role: string
  focus: ScriptFocusCode
  focusLabel: string
  framework: string
  launchName: string
  script: string
  offer: string
  closingQuestion: string
  logic: string
  skuItems: LaunchSkuItem[]
}

export const scriptBlockLabels: Record<ScriptBlockCode, string> = {
  opening: "Открытие",
  qualification: "Квалификация",
  offer: "Предложение",
  proof: "Доказательство",
  objection: "Возражение",
  closing: "Закрытие",
  follow_up: "Письмо после звонка"
}

export const scriptFocusLabels: Record<ScriptFocusCode, string> = {
  spin: "SPIN",
  horeca: "HoReCa FAB",
  vending: "Вендинг",
  objections: "Возражения",
  closing: "Закрытие",
  email: "Письмо"
}

export const stageScriptBlocks: Record<string, ScriptBlockCode[]> = {
  lead: ["opening", "qualification", "closing"],
  qualified: ["qualification", "offer", "objection", "closing"],
  contacted: ["offer", "proof", "follow_up", "closing"],
  tasting: ["proof", "objection", "closing"],
  trial: ["offer", "proof", "objection", "closing"],
  repeat: ["proof", "objection", "closing"],
  contract: ["proof", "objection", "closing", "follow_up"],
  won: ["proof", "offer", "closing"]
}

export const segmentRoleProfiles: Record<string, string[]> = {
  vending_micromarket: [
    "директор по развитию/собственник вендинга",
    "операционный руководитель вендинга",
    "закупки/категорийный менеджер вендинга"
  ],
  office_cluster: ["управляющий БЦ/facility manager", "администратор БЦ", "оператор питания/арендатор"],
  coffee_bakery: ["управляющий кофейни", "собственник/директор сети", "бариста-администратор"],
  coffee_chain: ["категорийный менеджер кофейной сети", "операционный директор сети", "франчайзи/управляющий точки"],
  gas_station: ["категорийный менеджер convenience", "управляющий АЗС", "операционный руководитель сети АЗС"],
  retail_store: ["управляющий магазина", "закупки fresh/ready-to-eat", "директор розничной сети"],
  retail_cluster: ["управляющий ТЦ/кластера", "категорийный менеджер арендатора", "администратор площадки"],
  production_logistics: ["операционный руководитель склада/производства", "HR/Admin сменного объекта", "закупки питания персонала"],
  healthcare_clinic: ["администратор клиники", "операционный руководитель медцентра", "закупки/АХО клиники"],
  bath_spa: ["управляющий банного комплекса", "F&B/буфет банного комплекса", "администратор SPA/ресепшен"],
  computer_club: ["управляющий компьютерного клуба", "администратор клуба", "собственник/операционный руководитель клуба"],
  foodservice_operator: ["оператор корпоративной столовой", "закупки оператора питания", "директор F&B/кейтеринга"],
  education_campus: ["администратор кампуса", "руководитель студенческого сервиса", "оператор питания кампуса"],
  residential_apart: ["управляющая компания ЖК", "оператор апарт-комплекса", "коммерческий директор сервиса резидентов"],
  lo_anchor: ["закупки якорного клиента ЛО", "операционный руководитель сети адресов", "логист/администратор маршрута"],
  rail_partner: ["директор по развитию rail-оператора", "операционный руководитель инфраструктурного партнера", "категорийный менеджер vending/coffee-point"],
  horeca_cluster: ["управляющий площадки", "F&B/операционный менеджер", "администратор смены"],
  horeca_ready_food: ["закупки готовой еды", "операционный руководитель", "категорийный менеджер"],
  transport_cluster: ["оператор питания транспортного узла", "управляющий точки", "закупки convenience"]
}

export function roleAngle(role: string) {
  const lower = role.toLowerCase()
  if (lower.includes("закуп") || lower.includes("катег")) {
    return "важны SKU-карточки, цена, срок годности, штрихкод, документы и понятная стартовая матрица"
  }
  if (lower.includes("операц") || lower.includes("facility") || lower.includes("управля")) {
    return "важны график поставки, место выкладки, холодильник, списания, ответственный и критерий пилота"
  }
  if (lower.includes("собствен") || lower.includes("директор") || lower.includes("развит")) {
    return "важны рост среднего чека, быстрая проверка спроса, масштабирование и отсутствие большого риска на старте"
  }
  if (lower.includes("администратор") || lower.includes("бариста")) {
    return "важны быстрый маршрут к ЛПР, дегустация и понятный формат следующего действия"
  }
  return "важны понятный пилот, ответственный за решение и короткая матрица без перегруза каталога"
}

export function skuSummary(items: LaunchSkuItem[]) {
  if (!items.length) return "стартовый набор уточняем по каталогу после квалификации точки"
  const preview = items.slice(0, 4).map((item) => `${item.name}${item.quantity ? ` x${item.quantity}` : ""}`)
  return `${preview.join(", ")}${items.length > preview.length ? ` и еще ${items.length - preview.length} SKU` : ""}`
}

export function focusForClientLineScript(base: BaseSegmentStageScript, blockCode: ScriptBlockCode): ScriptFocusCode {
  if (blockCode === "follow_up") return "email"
  if (blockCode === "objection") return "objections"
  if (blockCode === "closing") return "closing"
  if (base.segmentCode === "vending_micromarket") return "vending"
  if (base.framework === "HoReCa FAB") return "horeca"
  return "spin"
}

export function buildClientLineScript(
  base: BaseSegmentStageScript,
  blockCode: ScriptBlockCode,
  role: string
): ClientLineScript {
  const focus = focusForClientLineScript(base, blockCode)
  const angle = roleAngle(role)
  const productTerms =
    "охлажденная готовая еда Lunch-UP, сроки 3-10 суток, заказ от 7 000 рублей, заказ за 2 дня до 15:00, СПб/ЛО: бесплатная доставка по СПб Пн-Чт, ЛО через согласованные маршруты"
  const skuText = skuSummary(base.skuItems)
  const objection = base.objection
  const block = scriptBlockLabels[blockCode]
  const scriptByBlock: Record<ScriptBlockCode, string> = {
    opening: `Добрый день. Я отвечаю за развитие продуктов Lunch-UP в Санкт-Петербурге и Ленинградской области. Для сегмента "${base.segmentLabel}" вижу запуск "${base.launchName}": ${base.offer}. Для роли "${role}" ${angle}.`,
    qualification: `${base.spin.situation} Уточню еще четыре вещи: кто принимает решение, где физически стоит готовая еда, какой график пополнения удобен и какой KPI пилота будет считаться успехом.`,
    offer: `Предлагаю не весь каталог, а стартовую матрицу "${base.launchName}" под ваш сценарий: ${skuText}. Логика предложения: ${base.offer}`,
    proof: `Обосновываем через продукт и условия: ${productTerms}. Подтверждение для клиента: ${base.proof}. На этом этапе показываем SKU, роли позиций и KPI запуска.`,
    objection: `Если клиент говорит "${objection?.objection ?? "нужно подумать"}", отвечаем: ${objection?.response ?? "Согласен, поэтому начинаем не с большого контракта, а с маленького измеримого пилота."} Материал: ${base.proof}.`,
    closing: `${base.close} Фиксируем не большой контракт, а следующий проверяемый шаг: контакт ЛПР, матрица SKU, дегустация или пилот на 7-10 дней.`,
    follow_up: `Тема: Lunch-UP / ${base.segmentLabel} / ${base.launchName}. Добрый день. По итогам разговора отправляю короткий вариант запуска: ${base.offer}. Условия: ${productTerms}. Следующий шаг: ${base.nextQuestion}`
  }
  const offerByBlock: Record<ScriptBlockCode, string> = {
    opening: `Короткая квалификация и релевантный запуск "${base.launchName}".`,
    qualification: "3-4 вопроса, чтобы не отправлять лишний каталог и не продавать неподходящую матрицу.",
    offer: `${base.launchName}: ${skuText}.`,
    proof: `Матрица запуска, SKU из каталога, условия сотрудничества и материал: ${base.proof}.`,
    objection: `Ответ на возражение и следующий маленький шаг: ${base.nextQuestion}`,
    closing: "Следующий шаг воронки: ЛПР, матрица, дегустация, пилот, повтор или документы.",
    follow_up: `Письмо с матрицей "${base.launchName}", условиями и одним вопросом на решение.`
  }
  const closingByBlock: Record<ScriptBlockCode, string> = {
    opening: "Кто отвечает за ассортимент/закупку/развитие и можно ли задать 3 вопроса?",
    qualification: base.spin.needPayoff,
    offer: "Кому отправить матрицу и какие поля нужны для первичного согласования?",
    proof: "Какой материал критичен для решения: прайс, документы, образцы, фото или SKU-карточки?",
    objection: base.nextQuestion,
    closing: base.nextQuestion || base.close,
    follow_up: "Подтвердите, пожалуйста, кому удобно согласовать следующий шаг и дату."
  }

  return {
    key: `${base.key}-${blockCode}-${role}`,
    segmentStageKey: base.key,
    segmentCode: base.segmentCode,
    segmentLabel: base.segmentLabel,
    stageCode: base.stageCode,
    stageName: base.stageName,
    block,
    blockCode,
    role,
    focus,
    focusLabel: scriptFocusLabels[focus],
    framework: base.framework,
    launchName: base.launchName,
    script: scriptByBlock[blockCode],
    offer: offerByBlock[blockCode],
    closingQuestion: closingByBlock[blockCode],
    logic: `${base.segmentLabel} / ${base.stageName}: ${base.goal} Роль: ${angle}. Продукт: "${base.launchName}" через ${base.framework}.`,
    skuItems: base.skuItems
  }
}
