import { DatabaseSync } from "node:sqlite"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const db = new DatabaseSync(join(root, "data", "lunch_up_crm.sqlite"))
db.exec("PRAGMA foreign_keys = ON;")

const production = {
  address: "Санкт-Петербург, Уральская улица, 13",
  latitude: 59.9532837,
  longitude: 30.2630469,
  deliveryRadius: "рабочая логистика до 60 минут от производства"
}

const sourceRun = {
  date: "2026-06-06",
  apifyDataset: "logs/apify_2gis_education_2026-06-06.json",
  apifyActor: "piotrv1001/2gis-scraper",
  method:
    "Apify/2GIS использован для первичного поиска учебных локаций СПб; официальные сайты использованы для публичных телефонов и email; закрытые военные академии, кофейни/отели/магазины и дубли корпусов исключены."
}

function dgisRows() {
  const path = join(root, sourceRun.apifyDataset)
  if (!existsSync(path)) return []
  return JSON.parse(readFileSync(path, "utf-8"))
}

const dgisByUrl = new Map(dgisRows().map((row) => [row.url, row]))

const prospects = [
  {
    name: "СПбГУ, кампус В.О.",
    address: "Университетская набережная, 7",
    district: "Василеостровский район",
    website: "https://spbu.ru/",
    contactUrl: "https://300.spbu.ru/contacts",
    phone: "+7 (812) 363-66-33",
    email: "spbu@spbu.ru",
    dgisUrl: "https://2gis.ru/spb/firm/5348552838584183",
    score: 94,
    revenue: 320000,
    people: [1200, 3500],
    portions: 95,
    sku: 16,
    launchBudget: 19000,
    fitReason: "Крупный кампус на Васильевском острове рядом с производством; высокая дневная концентрация студентов и сотрудников.",
    notes: "Старт: коворкинг-холодильник или витрина 14-16 SKU в одном корпусе, затем масштабирование на соседние корпуса."
  },
  {
    name: "СЗИУ РАНХиГС",
    address: "Средний проспект В.О., 57/43",
    district: "Василеостровский район",
    website: "https://sziu.ranepa.ru/",
    contactUrl: "https://sziu.ranepa.ru/sveden/common/",
    phone: "+7 (812) 335-94-94",
    email: "sziu@ranepa.ru",
    dgisUrl: "https://2gis.ru/spb/firm/70000001033708219",
    score: 91,
    revenue: 260000,
    people: [700, 1800],
    portions: 75,
    sku: 14,
    launchBudget: 15000,
    fitReason: "Кампус В.О. в зоне короткой доставки; аудитория студентов, сотрудников и слушателей ДПО.",
    notes: "Стартовать через администрацию/АХО: пилот на один корпус с завтраками, салатами и горячими блюдами."
  },
  {
    name: "Санкт-Петербургский горный университет",
    address: "21-я линия В.О., 2",
    district: "Василеостровский район",
    website: "https://spmi.ru/",
    contactUrl: "https://spmi.ru/kontakti",
    phone: "+7 (812) 382-01-28",
    email: "rectorat@spmi.ru",
    dgisUrl: "https://2gis.ru/spb/firm/5349008105198688",
    score: 90,
    revenue: 270000,
    people: [800, 2200],
    portions: 80,
    sku: 15,
    launchBudget: 16000,
    fitReason: "Большой кампус на В.О. с плотным учебным трафиком и понятной логистикой от Уральской.",
    notes: "Предложить тест 2 недели: свежая готовая еда в холодильнике, контроль списаний и weekly-ревизия."
  },
  {
    name: "НИУ ВШЭ Санкт-Петербург",
    address: "25-я линия В.О., 6 к1",
    district: "Василеостровский район",
    website: "https://spb.hse.ru/",
    contactUrl: "https://spb.hse.ru/info/",
    phone: "+7 (812) 980-00-30",
    email: "callspb@hse.ru",
    dgisUrl: "https://2gis.ru/spb/firm/70000001097308795",
    score: 92,
    revenue: 280000,
    people: [800, 2400],
    portions: 85,
    sku: 15,
    launchBudget: 17000,
    fitReason: "Несколько корпусов в центре и на В.О.; высокий fit для grab-and-go и еды к учебному дню.",
    notes: "Начать с корпуса В.О. или Союза Печатников; связка: завтраки, салаты, сэндвичи, горячее."
  },
  {
    name: "ИТМО, городской кампус",
    address: "Кронверкский проспект, 49",
    district: "Петроградский район",
    website: "https://itmo.ru/",
    contactUrl: "https://itmo.ru/ru/page/118/kontakty.htm",
    phone: "+7 (812) 480-00-00",
    email: "od@itmo.ru",
    dgisUrl: "https://2gis.ru/spb/firm/5349008106551717",
    score: 92,
    revenue: 290000,
    people: [900, 2600],
    portions: 90,
    sku: 16,
    launchBudget: 18000,
    fitReason: "Много учебных корпусов в центре и на Петроградке; аудитория хорошо подходит для быстрых полезных обедов.",
    notes: "Пилотировать у учебного корпуса: 16 SKU, акцент на завтрак/обед, оплата по QR и быстрый повтор."
  },
  {
    name: "ГУАП",
    address: "Большая Морская улица, 67",
    district: "Адмиралтейский район",
    website: "https://guap.ru/",
    contactUrl: "https://guap.ru/sveden",
    phone: "+7 (812) 494-70-05",
    email: "info@guap.ru",
    dgisUrl: "https://2gis.ru/spb/firm/70000001081877066",
    score: 88,
    revenue: 220000,
    people: [500, 1500],
    portions: 65,
    sku: 13,
    launchBudget: 13000,
    fitReason: "Центральный корпус рядом с потоками студентов; удобная доставка до часа.",
    notes: "Предложить стартовый холодильник 12-13 SKU и отдельный прайс для регулярной загрузки."
  },
  {
    name: "СПбГУПТД",
    address: "Большая Морская улица, 18",
    district: "Центральный район",
    website: "https://sutd.ru/",
    contactUrl: "https://sutd.ru/contacts/",
    phone: "+7 (812) 315-75-25",
    email: "rector@sutd.ru",
    dgisUrl: "https://2gis.ru/spb/firm/5349008105133294",
    score: 87,
    revenue: 210000,
    people: [500, 1400],
    portions: 60,
    sku: 13,
    launchBudget: 12500,
    fitReason: "Центральный учебный корпус с регулярным дневным трафиком студентов и сотрудников.",
    notes: "Запускать как витрину для учебного дня: завтраки, салаты, сэндвичи, десерты к кофе."
  },
  {
    name: "РГПУ им. А.И. Герцена",
    address: "набережная реки Мойки, 48",
    district: "Центральный район",
    website: "https://www.herzen.spb.ru/",
    contactUrl: "https://www.herzen.spb.ru/upload/files/ib/terms%20of_use%20v2.pdf",
    phone: "+7 (812) 312-44-92",
    email: "mail@herzen.spb.ru",
    dgisUrl: "https://2gis.ru/spb/firm/70000001081898872",
    score: 89,
    revenue: 240000,
    people: [700, 2000],
    portions: 75,
    sku: 14,
    launchBudget: 15000,
    fitReason: "Крупный центральный педагогический университет; много корпусов и повторяющийся трафик.",
    notes: "Начать с одного корпуса, затем предложить матрицу для нескольких учебных точек."
  },
  {
    name: "СПбГЭУ",
    address: "набережная канала Грибоедова, 30-32",
    district: "Центральный район",
    website: "https://unecon.ru/",
    contactUrl: "https://unecon.ru/kontakty-fakultetov/",
    phone: "+7 (812) 458-97-30",
    email: "dept.ud@unecon.ru",
    dgisUrl: "https://2gis.ru/spb/firm/5348552838633967",
    score: 88,
    revenue: 230000,
    people: [600, 1800],
    portions: 70,
    sku: 14,
    launchBudget: 14000,
    fitReason: "Центральный кампус с экономической аудиторией; хороший формат для обедов и перекусов без очереди.",
    notes: "Оффер: снизить очереди в пиковые окна и дать понятную альтернативу столовой."
  },
  {
    name: "ЛЭТИ",
    address: "улица Профессора Попова, 5",
    district: "Петроградский район",
    website: "https://etu.ru/",
    contactUrl: "https://etu.ru/",
    phone: "+7 (812) 234-36-75",
    email: "office@etu.ru",
    dgisUrl: "https://2gis.ru/spb/firm/70000001082627815",
    score: 87,
    revenue: 220000,
    people: [550, 1700],
    portions: 65,
    sku: 13,
    launchBudget: 13000,
    fitReason: "Петроградский технический кампус в зоне удобной доставки; студенческий трафик подходит для холодильника.",
    notes: "Тест 10-13 SKU: сытные блюда, роллы, салаты и перекусы для лабораторных дней."
  },
  {
    name: "Первый СПбГМУ им. Павлова",
    address: "улица Льва Толстого, 6/8",
    district: "Петроградский район",
    website: "https://www.1spbgmu.ru/",
    contactUrl: "https://www.1spbgmu.ru/universitet/kontakty",
    phone: "+7 (812) 338-78-95",
    email: "info@1spbgmu.ru",
    dgisUrl: "https://2gis.ru/spb/firm/70000001082528836",
    score: 90,
    revenue: 260000,
    people: [700, 2200],
    portions: 80,
    sku: 15,
    launchBudget: 16000,
    fitReason: "Медицинский кампус с длинным учебным и клиническим днем; высокий спрос на быстрые приемы пищи.",
    notes: "Ставка на сытную смену: горячее, белковые салаты, сэндвичи; проверить требования по санитарному режиму."
  },
  {
    name: "СПбПУ Петра Великого",
    address: "Политехническая улица, 29",
    district: "Калининский район",
    website: "https://www.spbstu.ru/",
    contactUrl: "https://english.spbstu.ru/contacts/",
    phone: "+7 (812) 297-16-16",
    email: "intadm@spbstu.ru",
    dgisUrl: "https://2gis.ru/spb/firm/5349008105278923",
    score: 88,
    revenue: 250000,
    people: [800, 2400],
    portions: 80,
    sku: 15,
    launchBudget: 16000,
    fitReason: "Большой кампус с распределенными корпусами; до часа от производства при плановой доставке.",
    notes: "Запуск через один корпус с последующим масштабированием; важна точка с высокой проходимостью."
  },
  {
    name: "СПбГАСУ",
    address: "2-я Красноармейская улица, 4",
    district: "Адмиралтейский район",
    website: "https://www.spbgasu.ru/",
    contactUrl: "https://www.spbgasu.ru/university/kontakty/",
    phone: "+7 (812) 575-05-34",
    email: "rector@spbgasu.ru",
    dgisUrl: null,
    score: 84,
    revenue: 190000,
    people: [450, 1300],
    portions: 55,
    sku: 12,
    launchBudget: 11000,
    fitReason: "Компактный центральный технический кампус; логистика простая, аудитория дневная.",
    notes: "Пилот 10-12 SKU, ориентир на обед и перекусы между парами."
  },
  {
    name: "ПГУПС",
    address: "Московский проспект, 9",
    district: "Адмиралтейский район",
    website: "https://www.pgups.ru/",
    contactUrl: "https://www.pgups.ru/contacts/",
    phone: "8 (800) 302-06-60",
    email: "dou@pgups.ru",
    dgisUrl: "https://2gis.ru/spb/firm/70000001081875593",
    score: 85,
    revenue: 200000,
    people: [500, 1500],
    portions: 60,
    sku: 13,
    launchBudget: 12000,
    fitReason: "Центральный транспортный вуз рядом с метро; регулярный поток студентов.",
    notes: "Стартовая витрина с акцентом на горячие блюда и сытные перекусы."
  },
  {
    name: "БГТУ Военмех",
    address: "1-я Красноармейская улица, 1/21",
    district: "Адмиралтейский район",
    website: "https://voenmeh.ru/",
    contactUrl: "https://voenmeh.ru/contacts-3/",
    phone: "+7 (812) 495-76-20",
    email: "admission@voenmeh.ru",
    dgisUrl: "https://2gis.ru/spb/firm/70000001059685011",
    score: 83,
    revenue: 180000,
    people: [450, 1300],
    portions: 55,
    sku: 12,
    launchBudget: 11000,
    fitReason: "Инженерный кампус в центре; удобно для точечного пилота без сложной логистики.",
    notes: "Начинать с согласования формата доступа и точки размещения оборудования."
  },
  {
    name: "СПбГТИ Технологический институт",
    address: "Московский проспект, 26",
    district: "Адмиралтейский район",
    website: "https://technolog.edu.ru/",
    contactUrl: "https://technolog.edu.ru/",
    phone: "+7 (812) 494-92-99",
    email: "office@technolog.edu.ru",
    dgisUrl: null,
    score: 82,
    revenue: 180000,
    people: [400, 1200],
    portions: 55,
    sku: 12,
    launchBudget: 11000,
    fitReason: "Исторический технический кампус у метро; подходит для витрины на учебный день.",
    notes: "Предложить компактный пилот на 10-12 SKU с утренней и дневной загрузкой."
  },
  {
    name: "СПбГУТ им. Бонч-Бруевича",
    address: "проспект Большевиков, 22 к1",
    district: "Невский район",
    website: "https://www.sut.ru/",
    contactUrl: "https://www.sut.ru/university/kontakti-1",
    phone: "+7 (812) 326-31-63",
    email: "rector@sut.ru",
    dgisUrl: null,
    score: 80,
    revenue: 170000,
    people: [450, 1300],
    portions: 55,
    sku: 12,
    launchBudget: 11000,
    fitReason: "Крупный учебный корпус в пределах часовой городской доставки; есть регулярный студенческий поток.",
    notes: "Логистику ставить на плановую доставку; не начинать с большого ассортимента."
  },
  {
    name: "СПбГМТУ Корабелка",
    address: "Лоцманская улица, 3",
    district: "Адмиралтейский район",
    website: "https://www.smtu.ru/",
    contactUrl: "https://www.smtu.ru/ru/contacts/",
    phone: "+7 (812) 495-26-48",
    email: "office@smtu.ru",
    dgisUrl: null,
    score: 81,
    revenue: 175000,
    people: [400, 1200],
    portions: 55,
    sku: 12,
    launchBudget: 11000,
    fitReason: "Центральный морской технический кампус; хорош для пилотной витрины в учебном корпусе.",
    notes: "Начать с 10-12 SKU и замера sell-through в течение двух недель."
  },
  {
    name: "ГУМРФ им. адмирала Макарова",
    address: "Двинская улица, 5/7",
    district: "Кировский район",
    website: "https://gumrf.ru/",
    contactUrl: "https://gumrf.ru/contacts",
    phone: "+7 (812) 748-96-92",
    email: "otd_o@gumrf.ru",
    dgisUrl: "https://2gis.ru/spb/firm/5349008107485478",
    score: 80,
    revenue: 170000,
    people: [400, 1200],
    portions: 55,
    sku: 12,
    launchBudget: 11000,
    fitReason: "Крупная учебная точка юго-запада города; возможна плановая доставка до часа.",
    notes: "Проверить точку входа и график доступа; предложить пилот с ограниченной матрицей."
  },
  {
    name: "НГУ им. П.Ф. Лесгафта",
    address: "улица Декабристов, 35",
    district: "Адмиралтейский район",
    website: "https://lesgaft.spb.ru/",
    contactUrl: "https://lesgaft.spb.ru/en/node/13",
    phone: "+7 (812) 714-40-13",
    email: "kanc@lesgaft.spb.ru",
    dgisUrl: "https://2gis.ru/spb/firm/70000001067334945",
    score: 81,
    revenue: 175000,
    people: [350, 1100],
    portions: 50,
    sku: 12,
    launchBudget: 10000,
    fitReason: "Спортивный вуз с понятной потребностью в белковых и сытных перекусах.",
    notes: "Сделать акцент на белковые блюда, салаты, творожные позиции и сытные перекусы."
  },
  {
    name: "СЗГМУ им. И.И. Мечникова",
    address: "Кирочная улица, 41",
    district: "Центральный район",
    website: "https://szgmu.ru/",
    contactUrl: "https://szgmu.ru/index.php?page=contacts",
    phone: "+7 (812) 303-50-00",
    email: "rectorat@szgmu.ru",
    dgisUrl: null,
    score: 86,
    revenue: 220000,
    people: [600, 1800],
    portions: 70,
    sku: 14,
    launchBudget: 14000,
    fitReason: "Медицинский университет с длинным дневным трафиком; актуальна готовая еда для студентов и сотрудников.",
    notes: "Предложить пилот с санитарно понятной упаковкой и регулярным контролем сроков."
  },
  {
    name: "СПбГПМУ",
    address: "Литовская улица, 2",
    district: "Выборгский район",
    website: "https://gpmu.org/",
    contactUrl: "https://gpmu.org/contacts",
    phone: "+7 (812) 416-54-44",
    email: "priem@gpmu.org",
    dgisUrl: null,
    score: 85,
    revenue: 210000,
    people: [550, 1600],
    portions: 65,
    sku: 13,
    launchBudget: 13000,
    fitReason: "Медицинский кампус с регулярным потоком студентов и клинических сотрудников.",
    notes: "Пилотировать с белковой линейкой и быстрым обедом; отдельно проверить правила размещения внутри медучреждения."
  },
  {
    name: "СПбГУВМ",
    address: "Черниговская улица, 5",
    district: "Московский район",
    website: "https://spbguvm.ru/",
    contactUrl: "https://spbguvm.ru/contacts-2/",
    phone: "+7 (812) 388-36-31",
    email: "secretary@spbguvm.ru",
    dgisUrl: null,
    score: 77,
    revenue: 150000,
    people: [250, 800],
    portions: 40,
    sku: 10,
    launchBudget: 8000,
    fitReason: "Небольшой профильный кампус в пределах доставки; подходит для аккуратного теста.",
    notes: "Не перегружать ассортимент: 8-10 SKU, акцент на повторяемые позиции."
  },
  {
    name: "РГГМУ",
    address: "Малоохтинский проспект, 98",
    district: "Красногвардейский район",
    website: "https://www.rshu.ru/",
    contactUrl: "https://www.rshu.ru/university/contacts/",
    phone: "+7 (812) 633-01-82",
    email: "rshu@rshu.ru",
    dgisUrl: null,
    score: 78,
    revenue: 155000,
    people: [300, 900],
    portions: 45,
    sku: 11,
    launchBudget: 9000,
    fitReason: "Учебный кампус на правом берегу, в пределах плановой доставки до часа.",
    notes: "Запускать небольшим холодильником: 10-11 SKU и замер спроса по будням."
  },
  {
    name: "РГИСИ",
    address: "Моховая улица, 34",
    district: "Центральный район",
    website: "https://www.rgisi.ru/",
    contactUrl: "https://www.rgisi.ru/en/contacts",
    phone: "+7 (812) 273-15-81",
    email: "rector@rgisi.ru",
    dgisUrl: "https://2gis.ru/spb/firm/70000001081877534",
    score: 79,
    revenue: 160000,
    people: [300, 900],
    portions: 45,
    sku: 11,
    launchBudget: 9000,
    fitReason: "Центральный творческий институт; подходит для компактного grab-and-go запуска.",
    notes: "Ставка на удобные перекусы, десерты и легкие обеды между репетициями и занятиями."
  },
  {
    name: "СПбГИКиТ",
    address: "улица Правды, 13",
    district: "Центральный район",
    website: "https://www.gikit.ru/",
    contactUrl: "https://www.gikit.ru/abiturient/priem/contact/",
    phone: "+7 (812) 315-74-83",
    email: "priem@gikit.ru",
    dgisUrl: "https://2gis.ru/spb/firm/5349008107020350",
    score: 80,
    revenue: 165000,
    people: [350, 1000],
    portions: 50,
    sku: 11,
    launchBudget: 10000,
    fitReason: "Центральный кампус творческого профиля с дневным и вечерним трафиком.",
    notes: "Запускать с ассортиментом для длинного учебного дня: сэндвичи, салаты, горячее, десерты."
  },
  {
    name: "СПбГИК",
    address: "Дворцовая набережная, 2",
    district: "Центральный район",
    website: "https://spbgik.ru/",
    contactUrl: "https://spbgik.ru/",
    phone: "+7 (812) 318-97-97",
    email: "dp@spbgik.ru",
    dgisUrl: "https://2gis.ru/spb/firm/5349008105177129",
    score: 78,
    revenue: 155000,
    people: [300, 900],
    portions: 45,
    sku: 11,
    launchBudget: 9000,
    fitReason: "Кампус в центре рядом с туристическим и учебным потоком; подходит для точечного пилота.",
    notes: "Предлагать компактную витрину с десертами, сэндвичами и легким обедом."
  },
  {
    name: "Академия Штиглица",
    address: "Соляной переулок, 13",
    district: "Центральный район",
    website: "https://www.ghpa.ru/",
    contactUrl: "https://www.ghpa.ru/",
    phone: "+7 (812) 273-29-93",
    email: "info@ghpa.ru",
    dgisUrl: "https://2gis.ru/spb/firm/70000001028779840",
    score: 77,
    revenue: 145000,
    people: [250, 800],
    portions: 40,
    sku: 10,
    launchBudget: 8000,
    fitReason: "Творческий кампус в центре; подходит для небольшой витрины с высоким качеством упаковки.",
    notes: "Сделать акцент на эстетичной упаковке, десертах и легких обедах."
  },
  {
    name: "Академия художеств им. Репина",
    address: "Университетская набережная, 17",
    district: "Василеостровский район",
    website: "https://artsacademy.ru/",
    contactUrl: "https://artsacademy.ru/contacts/",
    phone: "+7 (812) 323-61-89",
    email: "academyart@yandex.ru",
    dgisUrl: "https://2gis.ru/spb/firm/70000001081875159",
    score: 79,
    revenue: 150000,
    people: [250, 850],
    portions: 45,
    sku: 10,
    launchBudget: 9000,
    fitReason: "Кампус на В.О. в короткой логистике от производства; творческие занятия дают длинные учебные смены.",
    notes: "Начать с небольшой витрины и качественной упаковки; отдельно протестировать десерты и сытные перекусы."
  },
  {
    name: "IThub College Санкт-Петербург",
    address: "Аптекарский проспект, 2",
    district: "Петроградский район",
    website: "https://ithubcollege.ru/",
    contactUrl: "https://ithubcollege.ru/contacts/",
    phone: "+7 (812) 309-56-51",
    email: "info@spb.ithub.ru",
    dgisUrl: "https://2gis.ru/spb/firm/70000001075734504",
    score: 76,
    revenue: 135000,
    people: [180, 600],
    portions: 35,
    sku: 9,
    launchBudget: 7000,
    fitReason: "IT-колледж с молодой аудиторией и удобной Петроградской логистикой.",
    notes: "Подходит для малого пилота: сэндвичи, роллы, десерты и напитки-пары к еде."
  },
  {
    name: "Петровский колледж",
    address: "Балтийская улица, 35",
    district: "Кировский район",
    website: "https://petrocollege.ru/",
    contactUrl: "https://petrocollege.ru/",
    phone: "+7 (812) 252-02-00",
    email: "abiturient@petrocollege.ru",
    dgisUrl: "https://2gis.ru/spb/firm/5348552838581920",
    score: 74,
    revenue: 125000,
    people: [200, 650],
    portions: 35,
    sku: 9,
    launchBudget: 7000,
    fitReason: "Колледж в зоне доставки; лучше рассматривать как небольшой тест после вузов первой очереди.",
    notes: "Только компактная матрица и проверка доступа; не ставить большой объем на старте."
  },
  {
    name: "РХГА им. Ф.М. Достоевского",
    address: "набережная реки Фонтанки, 15",
    district: "Центральный район",
    website: "https://rhga.ru/",
    contactUrl: "https://rhga.ru/ob-akademii/kontakty/",
    phone: "+7 (812) 571-30-75",
    email: "rector@rhga.ru",
    dgisUrl: "https://2gis.ru/spb/firm/5349008107011700",
    score: 73,
    revenue: 120000,
    people: [180, 550],
    portions: 35,
    sku: 9,
    launchBudget: 7000,
    fitReason: "Небольшой центральный вуз; подходит для осторожного запуска после приоритетных кампусов.",
    notes: "Пилот 8-9 SKU: десерты, сэндвичи, легкий обед; проверить реальный дневной поток."
  },
  {
    name: "СПбИЭУ",
    address: "Крапивный переулок, 5",
    district: "Выборгский район",
    website: "https://www.spbiem.ru/",
    contactUrl: "https://www.spbiem.ru/",
    phone: "+7 (812) 309-99-06",
    email: "spbiem@yandex.ru",
    dgisUrl: "https://2gis.ru/spb/firm/5349008105198739",
    score: 70,
    revenue: 105000,
    people: [120, 450],
    portions: 30,
    sku: 8,
    launchBudget: 6000,
    fitReason: "Небольшой частный вуз/колледж; подходит только для малого ручного теста.",
    notes: "Низкий стартовый объем, фокус на минимальные списания и проверку управленческого контакта."
  },
  {
    name: "СПбУТУиЭ",
    address: "Лермонтовский проспект, 44",
    district: "Адмиралтейский район",
    website: "https://www.spbume.ru/",
    contactUrl: "https://www.spbume.ru/",
    phone: "+7 (812) 575-11-32",
    email: "rector@spbume.ru",
    dgisUrl: "https://2gis.ru/spb/firm/5349008106533487",
    score: 72,
    revenue: 115000,
    people: [150, 500],
    portions: 32,
    sku: 8,
    launchBudget: 6500,
    fitReason: "Центральный частный университет из выгрузки 2GIS; подходит для малого пилота при подтвержденном потоке.",
    notes: "Проверить корпус и фактическую посещаемость; запускать только компактную витрину."
  }
]

const now = "2026-06-06T00:00:00.000Z"
const stageId = db.prepare("SELECT id FROM pipeline_stages WHERE code = 'lead'").get()?.id
if (!stageId) throw new Error("Missing lead pipeline stage")

function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

for (const table of ["companies", "contacts"]) {
  addColumnIfMissing(table, "address", "TEXT")
  addColumnIfMissing(table, "dgis_url", "TEXT")
  addColumnIfMissing(table, "drive_minutes_from_production", "INTEGER")
  addColumnIfMissing(table, "drive_minutes_source", "TEXT")
}
addColumnIfMissing("company_enrichment_profiles", "dgis_url", "TEXT")
addColumnIfMissing("company_enrichment_profiles", "drive_minutes_from_production", "INTEGER")
addColumnIfMissing("company_enrichment_profiles", "drive_minutes_source", "TEXT")

function dgisUrlFor(item, dgis) {
  if (item.dgisUrl) return item.dgisUrl
  return `https://2gis.ru/spb/search/${encodeURIComponent(`${item.name} ${item.address} Санкт-Петербург`)}`
}

function driveMinutesFor(item, dgis) {
  if (dgis?.latitude && dgis?.longitude) {
    const earthRadiusKm = 6371
    const dLat = ((Number(dgis.latitude) - production.latitude) * Math.PI) / 180
    const dLon = ((Number(dgis.longitude) - production.longitude) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((production.latitude * Math.PI) / 180) * Math.cos((Number(dgis.latitude) * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
    const directKm = earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.max(3, Math.min(90, Math.round(8 + directKm * 4.2)))
  }
  const text = `${item.address} ${item.district}`.toLowerCase()
  if (/василеостров|в\.о\.|линия|университетская/.test(text)) return 18
  if (/петроград|кронверк|профессора попова|аптекар/.test(text)) return 28
  if (/централь|адмиралтей|морская|красноармейск|московский|правды|фонтанк|моховая|соляной|дворцовая/.test(text)) return 35
  if (/киров|балтийск|двинская|декабристов|лоцманская|черниговская/.test(text)) return 42
  if (/калинин|политехническ|литовская|выборг/.test(text)) return 55
  if (/невск|большевиков|красногвард|малоохтинск/.test(text)) return 50
  return 45
}

const getCompany = db.prepare("SELECT id FROM companies WHERE name = ?")
const insertCompany = db.prepare(`
  INSERT INTO companies(
    name, segment, region, city, district, address, dgis_url, drive_minutes_from_production, drive_minutes_source,
    website, public_contact_url, source, lead_status, lead_score, fit_reason, notes
  )
  VALUES (?, 'education_campus', 'Санкт-Петербург и Ленинградская область', 'Санкт-Петербург', ?, ?, ?, ?, ?, ?, ?, 'apify_2gis_education_campus_2026_06_06', 'lead', ?, ?, ?)
`)
const updateCompany = db.prepare(`
  UPDATE companies
  SET segment = 'education_campus',
      region = 'Санкт-Петербург и Ленинградская область',
      city = 'Санкт-Петербург',
      district = ?,
      address = ?,
      dgis_url = ?,
      drive_minutes_from_production = ?,
      drive_minutes_source = ?,
      website = ?,
      public_contact_url = ?,
      source = 'apify_2gis_education_campus_2026_06_06',
      lead_status = 'lead',
      lead_score = ?,
      fit_reason = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`)
const getContact = db.prepare("SELECT id FROM contacts WHERE company_id = ? LIMIT 1")
const insertContact = db.prepare(`
  INSERT INTO contacts(
    company_id, name, role, email, phone, address, dgis_url, drive_minutes_from_production, drive_minutes_source,
    preferred_channel, is_public, consent_basis, notes
  )
  VALUES (?, 'Публичный B2B-канал', 'Администрация / АХО / приемная комиссия', ?, ?, ?, ?, ?, ?, 'email', 1, 'public_business_channel', ?)
`)
const updateContact = db.prepare(`
  UPDATE contacts
  SET name = 'Публичный B2B-канал',
      role = 'Администрация / АХО / приемная комиссия',
      email = ?,
      phone = ?,
      address = ?,
      dgis_url = ?,
      drive_minutes_from_production = ?,
      drive_minutes_source = ?,
      preferred_channel = 'email',
      is_public = 1,
      consent_basis = 'public_business_channel',
      notes = ?
  WHERE id = ?
`)
const getDeal = db.prepare("SELECT id FROM deals WHERE company_id = ? AND title = ?")
const insertDeal = db.prepare(`
  INSERT INTO deals(company_id, stage_id, title, estimated_monthly_revenue, expected_close_date, priority, owner, next_action, next_action_at)
  VALUES (?, ?, ?, ?, '2026-07-06', ?, 'Директор по развитию продуктов', ?, '2026-06-08T10:00:00')
`)
const updateDeal = db.prepare(`
  UPDATE deals
  SET stage_id = ?,
      estimated_monthly_revenue = ?,
      expected_close_date = '2026-07-06',
      priority = ?,
      owner = 'Директор по развитию продуктов',
      next_action = ?,
      next_action_at = '2026-06-08T10:00:00',
      updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`)
const upsertProfile = db.prepare(`
  INSERT INTO company_enrichment_profiles(
    company_id, dgis_id, dgis_url, address, website, phone, email,
    office_people_min, office_people_max, office_people_confidence, office_people_method,
    office_people_daily_present, likely_buyers_min, likely_buyers_max,
    recommended_portions, recommended_sku, estimated_launch_budget, drive_minutes_from_production, drive_minutes_source, source_summary
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'estimated', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(company_id) DO UPDATE SET
    dgis_id = excluded.dgis_id,
    dgis_url = excluded.dgis_url,
    address = excluded.address,
    website = excluded.website,
    phone = excluded.phone,
    email = excluded.email,
    office_people_min = excluded.office_people_min,
    office_people_max = excluded.office_people_max,
    office_people_confidence = excluded.office_people_confidence,
    office_people_method = excluded.office_people_method,
    office_people_daily_present = excluded.office_people_daily_present,
    likely_buyers_min = excluded.likely_buyers_min,
    likely_buyers_max = excluded.likely_buyers_max,
    recommended_portions = excluded.recommended_portions,
    recommended_sku = excluded.recommended_sku,
    estimated_launch_budget = excluded.estimated_launch_budget,
    drive_minutes_from_production = excluded.drive_minutes_from_production,
    drive_minutes_source = excluded.drive_minutes_source,
    source_summary = excluded.source_summary,
    updated_at = CURRENT_TIMESTAMP
`)
const insertSource = db.prepare(`
  INSERT INTO company_enrichment_sources(company_id, source, status, title, source_url, note)
  VALUES (?, ?, ?, ?, ?, ?)
`)
const sourceExists = db.prepare(`
  SELECT id FROM company_enrichment_sources
  WHERE company_id = ? AND source = ? AND source_url IS ?
  LIMIT 1
`)
const insertActivity = db.prepare(`
  INSERT INTO activities(company_id, deal_id, type, subject, notes, due_at, created_by)
  VALUES (?, ?, 'call', ?, ?, '2026-06-08T10:00:00', 'AI Sales Ops')
`)
const activityExists = db.prepare(`
  SELECT id FROM activities
  WHERE company_id = ? AND type = 'call' AND subject = ?
  LIMIT 1
`)

function priority(score) {
  if (score >= 88) return "high"
  if (score >= 78) return "medium"
  return "low"
}

function sourceSummary(item, dgis) {
  const sources = [
    {
      source: "apify_2gis",
      status: dgis ? "connected" : "not_in_dataset",
      title: "Apify Actor / 2GIS",
      url: item.dgisUrl,
      note: dgis
        ? `2GIS подтвердил учебную локацию: ${dgis.name}; адрес: ${dgis.address}.`
        : "Карточка добавлена по официальному открытому источнику; в текущей выгрузке Apify/2GIS отдельная запись не попала."
    },
    {
      source: "official_site",
      status: "connected",
      title: "Официальный сайт организации",
      url: item.contactUrl,
      note: "Публичный телефон/email взят с официальной страницы или страницы сведений об образовательной организации."
    },
    {
      source: "heuristic",
      status: "estimated",
      title: "Оценка людей для КП",
      note:
        "Оценка дана по типу кампуса, району, масштабу учреждения и формату пилота; для точного КП нужен ответ АХО/администрации о фактической посещаемости корпуса."
    }
  ]
  return JSON.stringify(sources)
}

function note(item, dgis, driveMinutes) {
  const pieces = [
    item.notes,
    `Логистика: ${production.deliveryRadius} от ${production.address}.`,
    `На авто от производства: ${driveMinutes} мин.`,
    `Рекомендуемый запуск: ${item.sku} SKU, ${item.portions} порций в первую загрузку.`,
    `Оценка аудитории для КП: ${item.people[0]}-${item.people[1]} человек в активной зоне кампуса.`,
    dgis ? `2GIS/Apify: ${dgis.url}` : "2GIS/Apify: запись не найдена в текущем датасете, использован официальный открытый источник."
  ]
  return pieces.join(" ")
}

db.exec("BEGIN")
try {
  for (const item of prospects) {
    const dgis = item.dgisUrl ? dgisByUrl.get(item.dgisUrl) : null
    const dgisId = dgis?.id ? String(dgis.id) : null
    const dgisUrl = dgisUrlFor(item, dgis)
    const driveMinutes = driveMinutesFor(item, dgis)
    const companyNote = note(item, dgis, driveMinutes)
    const existing = getCompany.get(item.name)
    let companyId
    if (existing) {
      companyId = existing.id
      updateCompany.run(
        item.district,
        item.address,
        dgisUrl,
        driveMinutes,
        dgis ? "estimated_from_2gis_coordinates" : "estimated_from_address",
        item.website,
        item.contactUrl,
        item.score,
        item.fitReason,
        companyNote,
        companyId
      )
    } else {
      const result = insertCompany.run(
        item.name,
        item.district,
        item.address,
        dgisUrl,
        driveMinutes,
        dgis ? "estimated_from_2gis_coordinates" : "estimated_from_address",
        item.website,
        item.contactUrl,
        item.score,
        item.fitReason,
        companyNote
      )
      companyId = result.lastInsertRowid
    }

    const contactNote = `Публичный контакт для первичного B2B-outreach. Адрес: ${item.address}. 2GIS: ${dgisUrl}. На авто от производства: ${driveMinutes} мин. Источник: ${item.contactUrl}.`
    const contact = getContact.get(companyId)
    if (contact) {
      updateContact.run(
        item.email,
        item.phone,
        item.address,
        dgisUrl,
        driveMinutes,
        dgis ? "estimated_from_2gis_coordinates" : "estimated_from_address",
        contactNote,
        contact.id
      )
    } else {
      insertContact.run(
        companyId,
        item.email,
        item.phone,
        item.address,
        dgisUrl,
        driveMinutes,
        dgis ? "estimated_from_2gis_coordinates" : "estimated_from_address",
        contactNote
      )
    }

    const title = `Запуск Lunch Up: ${item.name}`
    const nextAction = `Проверить ЛПР по питанию/АХО и предложить пилот: ${item.sku} SKU, ${item.portions} порций, контроль списаний через 2 недели.`
    const existingDeal = getDeal.get(companyId, title)
    if (existingDeal) {
      updateDeal.run(stageId, item.revenue, priority(item.score), nextAction, existingDeal.id)
    } else {
      insertDeal.run(companyId, stageId, title, item.revenue, priority(item.score), nextAction)
    }
    const dealId = getDeal.get(companyId, title).id

    upsertProfile.run(
      companyId,
      dgisId,
      dgisUrl,
      item.address,
      item.website,
      item.phone,
      item.email,
      item.people[0],
      item.people[1],
      `campus heuristic from Apify/2GIS and official public sources; production=${production.address}`,
      Math.round((item.people[0] + item.people[1]) / 2),
      Math.max(10, Math.round(item.people[0] * 0.08)),
      Math.max(20, Math.round(item.people[1] * 0.12)),
      item.portions,
      item.sku,
      item.launchBudget,
      driveMinutes,
      dgis ? "estimated_from_2gis_coordinates" : "estimated_from_address",
      sourceSummary(item, dgis)
    )

    for (const source of [
      ["apify_2gis", dgis ? "connected" : "not_in_dataset", "Apify/2GIS education campus discovery", item.dgisUrl, dgis ? `Найдено в датасете ${sourceRun.apifyDataset}.` : "Не попало в текущий датасет, добавлено по открытому официальному источнику."],
      ["official_site", "connected", "Official public contact", item.contactUrl, `Телефон ${item.phone}, email ${item.email}.`]
    ]) {
      if (!sourceExists.get(companyId, source[0], source[3])) {
        insertSource.run(companyId, source[0], source[1], source[2], source[3], source[4])
      }
    }

    const activitySubject = `Квалифицировать запуск Lunch Up: ${item.name}`
    if (!activityExists.get(companyId, activitySubject)) {
      insertActivity.run(companyId, dealId, activitySubject, nextAction)
    }
  }
  db.exec("COMMIT")
} catch (error) {
  db.exec("ROLLBACK")
  throw error
}

const publicContactsPath = join(root, "data", "public-contacts.json")
const publicContacts = existsSync(publicContactsPath)
  ? JSON.parse(readFileSync(publicContactsPath, "utf-8"))
  : []
const byCompany = new Map(publicContacts.map((item) => [item.company, item]))
for (const item of prospects) {
  byCompany.set(item.name, {
    company: item.name,
    phone: item.phone,
    email: item.email,
    preferred_channel: "email",
    source_url: item.contactUrl,
    address: item.address,
    dgis_url: dgisUrlFor(item, item.dgisUrl ? dgisByUrl.get(item.dgisUrl) : null),
    drive_minutes_from_production: driveMinutesFor(item, item.dgisUrl ? dgisByUrl.get(item.dgisUrl) : null),
    production_address: production.address,
    notes: `Образовательный кампус для запуска Lunch Up. ${item.notes} 2GIS/Apify: ${item.dgisUrl ?? "нет в текущей выгрузке"}.`
  })
}
writeFileSync(publicContactsPath, `${JSON.stringify([...byCompany.values()], null, 2)}\n`, "utf-8")

const evidence = {
  generated_at: now,
  production,
  source_run: sourceRun,
  selection: {
    included_count: prospects.length,
    included_rule: "учебная локация в Санкт-Петербурге, рабочая доставка до часа от Уральской, 13, есть публичный канал связи",
    excluded: [
      "кофейни, отели, магазины и прочие неучебные совпадения по словам институт/академия",
      "дубли отдельных корпусов одного вуза, если запуск логичнее вести через одну карточку компании",
      "закрытые военные академии, где высокий барьер доступа и закупки делают быстрый коммерческий пилот маловероятным"
    ]
  },
  prospects: prospects.map((item) => {
    const dgis = item.dgisUrl ? dgisByUrl.get(item.dgisUrl) : null
    return {
      ...item,
      production_address: production.address,
      delivery_radius: production.deliveryRadius,
      dgis_match: dgis
        ? {
            id: dgis.id,
            name: dgis.name,
            address: dgis.address,
            district: dgis.district,
            categories: dgis.categories,
            latitude: dgis.latitude,
            longitude: dgis.longitude,
            rating: dgis.rating,
            reviewCount: dgis.reviewCount,
            scrapedAt: dgis.scrapedAt
          }
        : null
    }
  })
}
writeFileSync(join(root, "data", "education-campus-prospects-2026-06-06.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf-8")

const counts = {
  imported: prospects.length,
  educationCompanies: db.prepare("SELECT COUNT(*) AS count FROM companies WHERE segment = 'education_campus'").get().count,
  educationContacts: db.prepare(`
    SELECT COUNT(*) AS count
    FROM contacts c
    JOIN companies co ON co.id = c.company_id
    WHERE co.segment = 'education_campus'
      AND COALESCE(TRIM(c.email), '') <> ''
      AND COALESCE(TRIM(c.phone), '') <> ''
  `).get().count,
  educationDeals: db.prepare(`
    SELECT COUNT(*) AS count
    FROM deals d
    JOIN companies co ON co.id = d.company_id
    WHERE co.segment = 'education_campus'
  `).get().count
}

db.close()
console.log(JSON.stringify(counts, null, 2))
