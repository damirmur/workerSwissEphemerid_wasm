import SwissEPH from 'swisseph-wasm';
import path from 'path';
import pino from 'pino';
import fs from 'fs';
// worker.js
const logger = pino({
    level: 'info', // Убедитесь, что уровень info, а не error
    transport: { target: 'pino-pretty' }
});

let swe;

const SEFLG_SWIEPH = 2;



const ZODIAC_SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer',
    'Leo', 'Virgo', 'Libra', 'Scorpio',
    'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

const DIGNITIES = {
    0: { domicile: 4, exalt: 0, detriment: 10, fall: 6 },
    1: { domicile: 3, exalt: 1, detriment: 9, fall: 7 },
    2: { domicile: [2, 5], exalt: 5, detriment: [8, 11], fall: 11 },
    3: { domicile: [1, 6], exalt: 11, detriment: [7, 0], fall: 5 },
    4: { domicile: [0, 7], exalt: 9, detriment: [6, 1], fall: 3 },
    5: { domicile: [8, 11], exalt: 3, detriment: [2, 5], fall: 9 },
    6: { domicile: [9, 10], exalt: 6, detriment: [3, 4], fall: 0 },
    7: { domicile: 10, exalt: 7, detriment: 4, fall: 1 },
    8: { domicile: 11, exalt: 10, detriment: 5, fall: 4 },
    9: { domicile: 7, exalt: 0, detriment: 1, fall: 6 }
};

const ASPECT_TYPES = [
    { name: 'conjunction', angle: 0, orb: 8 },
    { name: 'sextile', angle: 60, orb: 6 },
    { name: 'square', angle: 90, orb: 7 },
    { name: 'trine', angle: 120, orb: 8 },
    { name: 'opposition', angle: 180, orb: 8 }
];
ASPECT_TYPES.getName = function (angle) {
    return this.find(body => body.angle === angle)?.name;
};
ASPECT_TYPES.precise = function (orb = 0.01) {
    if (orb == 0) {
        return this;
    };
    const arr = [];
    this.forEach(el => {
        el = { ...el };
        el.orb = orb;
        arr.push(el);
    });
    return arr;
};



const init = async () => {
    if (!swe) {
        swe = new SwissEPH();
        await swe.initSwissEph();
        const ephePath = path.join(process.cwd(), 'ephemeris');
        // Checking the existence of the folder
        if (!fs.existsSync(ephePath)) {
            throw new Error(`Ephemeris folder not found: ${ephePath}`);
        }
        swe.set_ephe_path(ephePath);
        const testJd = 2451545.0; // 2000-01-01
        const testCalc = swe.calc_ut(testJd, 0, SEFLG_SWIEPH);

        // If files are NOT found, the library will remove SEFLG_SWIEPH (2) flag from result
        if ((testCalc.returnFlag & SEFLG_SWIEPH) === 0) {
            console.error(`🔴 EPHEMERIS NOT FOUND at path: ${ephePath}`);
            console.error(`Using simplified Moshier calculation. Check for .se1 files`);
        } else {
            console.log(`🟢 Ephemeris successfully connected: ${ephePath}`);
        }
    }
};

const getSignInfo = (lon) => ({
    signId: Math.floor(lon / 30),
    signName: ZODIAC_SIGNS[Math.floor(lon / 30)],
    signDegree: lon % 30
});

const getHouseNumber = (lon, cusps) => {
    for (let i = 0; i < 11; i++) {
        if (cusps[i] < cusps[i + 1]) {
            if (lon >= cusps[i] && lon < cusps[i + 1]) return i + 1;
        } else {
            if (lon >= cusps[i] || lon < cusps[i + 1]) return i + 1;
        }
    }
    return 12;
};

const getJd = (iso) => {
    const d = new Date(iso);
    const hr = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 + d.getUTCMilliseconds() / 3600000;
    return swe.julday(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hr, 1);
};

/**
 * Возвращает ISO-строки (UTC) для заданного периода с учетом GMT
 * @param {number} gmtOffsetMinutes - Смещение в минутах (напр. +180 для Москвы)
 * @param {string} period - 'day', 'week', 'month', 'year'
 * @returns { {start: string, end: string} }
 */
function getTimeBounds(gmtOffsetMinutes = 0, period = 'day') {
    const now = new Date();
    
    // 1. Получаем "местное" время для указанного GMT
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const localWithOffset = new Date(utcTime + (gmtOffsetMinutes * 60000));

    // Извлекаем компоненты "местного" времени
    let year = localWithOffset.getUTCFullYear();
    let month = localWithOffset.getUTCMonth();
    let date = localWithOffset.getUTCDate();
    let dayOfWeek = localWithOffset.getUTCDay(); // 0 (Вск) - 6 (Суб)

    let startLocal, endLocal;

    switch (period) {
        case 'year':
            startLocal = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
            endLocal = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
            break;
            
        case 'month':
            startLocal = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
            // Последний день месяца: 0-й день следующего месяца
            endLocal = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
            break;
            
        case 'week':
            // Находим понедельник (в JS 0 - это воскресенье)
            const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            startLocal = new Date(Date.UTC(year, month, date + diffToMonday, 0, 0, 0, 0));
            endLocal = new Date(Date.UTC(year, month, date + diffToMonday + 6, 23, 59, 59, 999));
            break;

        case 'day':
        default:
            startLocal = new Date(Date.UTC(year, month, date, 0, 0, 0, 0));
            endLocal = new Date(Date.UTC(year, month, date, 23, 59, 59, 999));
            break;
    }

    // 2. Конвертируем обратно в чистый UTC (вычитаем прибавленное ранее смещение)
    const startUTC = new Date(startLocal.getTime() - (gmtOffsetMinutes * 60000));
    const endUTC = new Date(endLocal.getTime() - (gmtOffsetMinutes * 60000));

    return {
        start: startUTC.toISOString(),
        end: endUTC.toISOString()
    };
}

export const currentFullTask = () => {return {
    dates: [new Date().toISOString()], // Передаем как массив из одного элемента для универсальности
    bodies: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12], // Все планеты + Узлы + Лилит
    options: {
        calculateAspects: true,
        calculateDignities: true,
        geo: { lat: 55.75, lon: 37.61, system: 'P' } // Координаты по умолчанию (напр. Москва)
    }
};
};
export const dailyPlanetsTask = () => {
    const { start, end } = getTimeBounds(); // Получаем границы дня для GMT
        return {
            dates: [start, end],
            bodies: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], // Только планеты без фиктивных точек
            options: {
                step: 60, // Шаг 1 мин
                calculateAspects: false, // Отключаем для скорости
                calculateDignities: false
            }
        };
    };


export default async function (task=currentFullTask) {
    const startTs = Date.now();
    await init();

    const { dates, bodies, options = {} } = task;
    const { step = 60, geo = null, maxSteps = 5000, calculateAspects, calculateDignities } = options;
    const SEFLG_SPEED = 256;

    const compute = (jdUT) => {
        const res = { bodies: {}, aspects: [], houses: null };
        // 1. Planets
        bodies.forEach(id => {
            const d = swe.calc_ut(jdUT, id, SEFLG_SWIEPH | SEFLG_SPEED);
            const lon = d[0];
            const speed = d[3];
            const sign = getSignInfo(lon);
            const bodyData = {
                lon,
                ...sign,
                speed,
                isRetro: speed < 0
            };

            if (res.houses) {
                const rawCusps = res.houses.cusps.map(c => c.lon);
                bodyData.house = getHouseNumber(d.longitude, rawCusps);
            }
            if (calculateDignities && DIGNITIES[id]) {
                const dig = DIGNITIES[id];
                const isIn = (rule, s) => Array.isArray(rule) ? rule.includes(s) : rule === s;
                let score = 0, status = 'peregrine';
                if (isIn(dig.domicile, sign.signId)) { score = 5; status = 'domicile'; }
                else if (isIn(dig.exalt, sign.signId)) { score = 4; status = 'exaltation'; }
                else if (isIn(dig.detritment, sign.signId)) { score = -5; status = 'detriment'; }
                else if (isIn(dig.fall, sign.signId)) { score = -4; status = 'fall'; }
                bodyData.dignity = { status, score };
            }
            res.bodies[id] = bodyData;
        });

        // 2. Houses
        if (geo && geo.lat !== undefined && geo.lon !== undefined) {
            try {
                const lat = parseFloat(geo.lat);
                const lon = parseFloat(geo.lon);
                const system = geo.system || 'P';

                // Вызываем расчет домов
                const h = swe.houses(jdUT, lat, lon, system);

                // Проверка: в некоторых версиях swisseph-wasm данные лежат в h.cusps, 
                // но ascendant и mc нужно доставать аккуратно
                const rawCusps = Array.from(h.cusps);

                // ВАЖНО: SwissEPH возвращает 13 элементов, где индекс [1] - это 1-й дом.
                // Отрезаем 0-й элемент, оставляя 1-12 куспиды.
                const actualCusps = rawCusps.slice(1, 13);

                res.houses = {
                    cusps: actualCusps.map(c => ({
                        lon: c,
                        ...getSignInfo(c)
                    })),
                    // Если h.ascendant === undefined, берем 1-й куспид (это и есть Асцендент)
                    asc: getSignInfo(h.ascendant || actualCusps[0]),
                    // Если h.mc === undefined, берем 10-й куспид
                    mc: getSignInfo(h.mc || actualCusps[9])
                };

                // Добавляем чистую долготу для удобства
                res.houses.asc.lon = h.ascendant || actualCusps[0];
                res.houses.mc.lon = h.mc || actualCusps[9];

            } catch (e) {
                logger.error({ err: e.message }, 'Houses calculation failed');
            }
        }

        // 3. Aspects
        if (calculateAspects) {
            const ids = Object.keys(res.bodies);
            for (let i = 0; i < ids.length; i++) {
                for (let j = i + 1; j < ids.length; j++) {
                    let diff = Math.abs(res.bodies[ids[i]].lon - res.bodies[ids[j]].lon);
                    if (diff > 180) diff = 360 - diff;
                    for (const asp of ASPECT_TYPES) {
                        const dist = Math.abs(diff - asp.angle);
                        if (dist <= (options.orb || asp.orb)) {
                            res.aspects.push({ p1: Number(ids[i]), p2: Number(ids[j]), type: asp.name, exact: 1 - (dist / (options.orb || asp.orb)) });
                        }
                    }
                }
            }
        }
        return res;
    };

    try {
        let finalResult;

        // Нормализация входных данных: 
        // Если это массив из 1 элемента или просто строка — считаем как одиночную дату
        const isRange = Array.isArray(dates) && dates.length === 2;
        const singleDate = Array.isArray(dates) ? dates[0] : dates;

        if (!isRange) {
            // --- ЛОГИКА ДЛЯ ОДИНОЧНОЙ ДАТЫ ---
            const jd = getJd(singleDate);
            finalResult = [{
                iso: new Date(singleDate).toISOString(),
                ...compute(jd)
            }];
        }
        else {
            // --- ЛОГИКА ДЛЯ ДИАПАЗОНА ---
            const startJd = getJd(dates[0]);
            const endJd = getJd(dates[1]);
            const jdStep = step / 1440;

            // Защита от бесконечного цикла
            const totalSteps = Math.max(1, Math.floor((endJd - startJd) / jdStep) + 1);

            if (totalSteps > maxSteps) throw new Error(`Limit exceeded: ${totalSteps} > ${maxSteps}`);
            if (endJd < startJd) throw new Error("End date must be after start date");

            finalResult = [];
            for (let i = 0; i < totalSteps; i++) {
                const currentJd = startJd + (i * jdStep);

                // Обратное преобразование JD в ISO для каждой точки
                const rev = swe.revjul(currentJd, 1);
                const d = new Date(Date.UTC(rev.year, rev.month - 1, rev.day));
                d.setUTCSeconds(Math.round(rev.hour * 3600));

                finalResult.push({
                    iso: d.toISOString(),
                    ...compute(currentJd)
                });
            }
        }

        // Общий логгер для всех типов запросов
        logger.info({
            duration: `${Date.now() - startTs}ms`,
            points: Array.isArray(finalResult) ? finalResult.length : 1,
            rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`
        }, 'Calc Complete');

        return finalResult;

    } catch (err) {
        logger.error({ err: err.message }, 'Worker Error');
        throw err;
    }

}
