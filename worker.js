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
const SEFLG_SPEED = 256;



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
    signDegree: round6(lon % 30)
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
 * Rounds a number to 6 decimal places
 * @param {number} num - Number to round
 * @returns {number} Rounded number
 */
const round6 = (num) => Math.round(num * 1e6) / 1e6;

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

// ============================================
// Task Factory Functions
// ============================================

/**
 * Creates a task for current moment calculations with all planets, aspects, dignities, and houses
 * @returns {Object} Task configuration
 */
export const currentFullTask = () => ({
    dates: [new Date().toISOString()],
    bodies: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
    options: {
        calculateAspects: true,
        calculateDignities: true,
        geo: { lat: 55.75, lon: 37.61, system: 'P' }
    }
});

/**
 * Creates a task for daily planetary calculations (no aspects/dignities for speed)
 * @returns {Object} Task configuration
 */
export const dailyPlanetsTask = () => {
    const { start, end } = getTimeBounds();
    return {
        dates: [start, end],
        bodies: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        options: {
            step: 60,
            calculateAspects: false,
            calculateDignities: false
        }
    };
};

// ============================================
// Core Calculation Functions
// ============================================

/**
 * Calculates dignity status for a planet based on its sign position
 * @param {number} bodyId - Planet ID
 * @param {Object} sign - Sign info with signId
 * @returns {Object} Dignity status and score
 */
const calculateDignity = (bodyId, sign) => {
    if (!DIGNITIES[bodyId]) {
        return { status: 'peregrine', score: 0 };
    }
    
    const dig = DIGNITIES[bodyId];
    const isIn = (rule, s) => Array.isArray(rule) ? rule.includes(s) : rule === s;
    let score = 0, status = 'peregrine';
    
    if (isIn(dig.domicile, sign.signId)) { score = 5; status = 'domicile'; }
    else if (isIn(dig.exalt, sign.signId)) { score = 4; status = 'exaltation'; }
    else if (isIn(dig.detritment, sign.signId)) { score = -5; status = 'detriment'; }
    else if (isIn(dig.fall, sign.signId)) { score = -4; status = 'fall'; }
    
    return { status, score };
};

/**
 * Calculates aspects between all planets
 * @param {Object} bodies - Object with planet positions
 * @param {number} orb - Custom orb limit (optional)
 * @returns {Array} Array of aspect objects
 */
const calculateAspects = (bodies, orb) => {
    const aspects = [];
    const ids = Object.keys(bodies);
    
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            let diff = Math.abs(bodies[ids[i]].lon - bodies[ids[j]].lon);
            if (diff > 180) diff = 360 - diff;
            
            for (const asp of ASPECT_TYPES) {
                const dist = Math.abs(diff - asp.angle);
                const orbLimit = orb || asp.orb;
                if (dist <= orbLimit) {
                    aspects.push({ 
                        p1: Number(ids[i]), 
                        p2: Number(ids[j]), 
                        type: asp.name, 
                        exact: 1 - (dist / orbLimit)
                    });
                }
            }
        }
    }
    return aspects;
};

/**
 * Calculates planetary positions for a single Julian Day
 * @param {number} jdUT - Julian Day in UT
 * @param {number[]} bodies - Array of body IDs to calculate
 * @param {Object} options - Calculation options
 * @returns {Object} Calculation result with bodies, aspects, houses
 */
const compute = (jdUT, bodies, options) => {
    const { geo, calculateAspects: doAspects, calculateDignities: doDignities, orb } = options;
    const res = { bodies: {}, aspects: [], houses: null };
    
    // 1. Calculate planets
    bodies.forEach(id => {
        const d = swe.calc_ut(jdUT, id, SEFLG_SWIEPH | SEFLG_SPEED);
        const lon = round6(d[0]);
        const speed = round6(d[3]);
        const sign = getSignInfo(lon);
        const bodyData = {
            lon,
            speed
        };

        if (res.houses) {
            const rawCusps = res.houses.cusps.map(c => c.lon);
            bodyData.house = getHouseNumber(d.longitude, rawCusps);
        }
        
        if (doDignities) {
            bodyData.dignity = calculateDignity(id, sign);
        }
        
        res.bodies[id] = bodyData;
    });

    // 2. Calculate houses
    if (geo && geo.lat !== undefined && geo.lon !== undefined) {
        try {
            const lat = parseFloat(geo.lat);
            const lon = parseFloat(geo.lon);
            const system = geo.system || 'P';
            const h = swe.houses(jdUT, lat, lon, system);
            const rawCusps = Array.from(h.cusps).map(round6);
            const actualCusps = rawCusps.slice(1, 13);

            res.houses = {
                cusps: actualCusps.map(c => ({
                    lon: c,
                    ...getSignInfo(c)
                })),
                asc: getSignInfo(round6(h.ascendant || actualCusps[0])),
                mc: getSignInfo(round6(h.mc || actualCusps[9]))
            };
            res.houses.asc.lon = round6(h.ascendant || actualCusps[0]);
            res.houses.mc.lon = round6(h.mc || actualCusps[9]);
        } catch (e) {
            logger.error({ err: e.message }, 'Houses calculation failed');
        }
    }

    // 3. Calculate aspects
    if (doAspects) {
        res.aspects = calculateAspects(res.bodies, orb);
    }
    
    return res;
};

/**
 * Calculate for a single date
 * @param {string} dateIso - ISO date string
 * @param {Object} task - Full task object with bodies and options
 * @returns {Array} Array with single calculation result
 */
export const calculateSingle = async (dateIso, task) => {
    await init();
    const { bodies, options } = task;
    const jd = getJd(dateIso);
    
    return [{
        iso: new Date(dateIso).toISOString(),
        ...compute(jd, bodies, options)
    }];
};

/**
 * Calculate for a date range
 * @param {string[]} dates - Array with start and end ISO dates
 * @param {Object} task - Full task object with bodies and options
 * @returns {Array} Array with calculation results for each step
 */
export const calculateRange = async (dates, task) => {
    await init();
    const { bodies, options } = task;
    const { step = 60, maxSteps = 5000 } = options;
    
    const startJd = getJd(dates[0]);
    const endJd = getJd(dates[1]);
    const jdStep = step / 1440;

    const totalSteps = Math.max(1, Math.floor((endJd - startJd) / jdStep) + 1);
    if (totalSteps > maxSteps) throw new Error(`Limit exceeded: ${totalSteps} > ${maxSteps}`);
    if (endJd < startJd) throw new Error("End date must be after start date");

    const results = [];
    for (let i = 0; i < totalSteps; i++) {
        const currentJd = startJd + (i * jdStep);
        const rev = swe.revjul(currentJd, 1);
        const d = new Date(Date.UTC(rev.year, rev.month - 1, rev.day));
        d.setUTCSeconds(Math.round(rev.hour * 3600));

        results.push({
            iso: d.toISOString(),
            ...compute(currentJd, bodies, options)
        });
    }
    return results;
};

// ============================================
// Main Export Function
// ============================================

/**
 * Main worker function - calculates planetary positions
 * @param {Object} task - Task configuration with dates, bodies, and options
 * @returns {Array} Array of calculation results
 */
export default async function (task = currentFullTask()) {
    const startTs = Date.now();
    await init();

    const { dates, bodies, options = {} } = task;
    
    // Determine if single date or range
    const isRange = Array.isArray(dates) && dates.length === 2;
    const singleDate = Array.isArray(dates) ? dates[0] : dates;

    let finalResult;
    if (!isRange) {
        finalResult = await calculateSingle(singleDate, { bodies, options });
    } else {
        finalResult = await calculateRange(dates, { bodies, options });
    }

    logger.info({
        duration: `${Date.now() - startTs}`,
        points: Array.isArray(finalResult) ? finalResult.length : 1,
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`
    }, 'Calc Complete');

    return finalResult;
}
