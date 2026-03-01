# workerSwissEphemerid_wasm

High-performance astrological calculations using Swiss Ephemeris with WebAssembly and worker threads.

## Features

- **Swiss Ephemeris** - accurate astronomical calculations using the Swiss Ephemeris library (WASM version)
- **Worker Threads** - parallel processing using Piscina thread pool for optimal performance
- **Comprehensive Calculations**:
  - Planetary positions (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, etc.)
  - House cusps (multiple house systems)
  - Planetary aspects
  - Planetary dignities (domicile, exaltation, detriment, fall)
  - Retrograde motion detection
- **Flexible Time Periods** - calculate for single dates or ranges (day, week, month, year)
- **Geographic Coordinates** - support for different locations with house calculations

## Installation

```bash
npm install
```

## Usage

```bash
npm start
```

## Project Structure

```
workerSwissEphemerid_wasm/
├── server.js           # Main entry point with Piscina worker pool
├── worker.js           # Worker thread with Swiss Ephemeris calculations
├── package.json        # Project dependencies
├── ephemeris/          # Swiss Ephemeris data files
│   ├── seas_18.se1
│   ├── semo_18.se1
│   ├── sepl_18.se1
│   └── sefstars.txt
└── .gitignore
```

## Dependencies

- [piscina](https://github.com/piscinajs/piscina) - fast worker thread pool
- [pino](https://github.com/pinojs/pino) - fast JSON logger
- [swisseph-wasm](https://github.com/astrolabsoftware/swisseph-wasm) - Swiss Ephemeris in WebAssembly

## API

### Task Options

```javascript
{
  dates: ['2024-01-01'] || ['2024-01-01', '2024-01-02'], // Single date or range
  bodies: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12], // Planet IDs
  options: {
    step: 60, // Time step in minutes for range calculations
    calculateAspects: true,
    calculateDignities: true,
    geo: { lat: 55.75, lon: 37.61, system: 'P' } // Coordinates and house system
  }
}
```

### Planet IDs

| ID | Planet |
|----|--------|
| 0 | Sun |
| 1 | Moon |
| 2 | Mercury |
| 3 | Venus |
| 4 | Mars |
| 5 | Jupiter |
| 6 | Saturn |
| 7 | Uranus |
| 8 | Neptune |
| 9 | Pluto |
| 11 | North Node |
| 12 | Black Moon Lilith |

## License

MIT

## Output Format

The default export function returns an **array of objects**. Each object represents calculations for a single point in time:

```javascript
[
  {
    iso: "2024-01-15T12:00:00.000Z",  // ISO date string
    bodies: {
      0: {                           // Planet ID (0 = Sun, 1 = Moon, etc.)
        lon: 295.42,                 // Longitude in degrees
        signId: 9,                   // Zodiac sign ID (0-11)
        signName: "Capricorn",       // Zodiac sign name
        signDegree: 25.42,           // Degree within the sign
        speed: 0.95,                 // Movement speed
        isRetro: false,              // Retrograde flag
        house: 10,                   // House number (if calculated)
        dignity: {                   // (if calculateDignities: true)
          status: "domicile",        // 'domicile', 'exaltation', 'detriment', 'fall', 'peregrine'
          score: 5
        }
      },
      1: { ... },
      // ... other planets (keys: 0-9, 11, 12)
    },
    aspects: [                       // (if calculateAspects: true)
      {
        p1: 0,                       // First planet ID
        p2: 1,                       // Second planet ID
        type: "trine",               // Aspect type
        exact: 0.85                  // Exactness (1.0 = exact)
      },
      // ... other aspects
    ],
    houses: {                        // (if geo coordinates provided)
      cusps: [                       // 12 houses
        { lon: 120.5, signId: 3, signName: "Cancer", signDegree: 0.5 },
        // ... house cusps 2-12
      ],
      asc: { lon: 95.2, signId: 3, signName: "Cancer", signDegree: 5.2 },  // Ascendant
      mc: { lon: 215.8, signId: 7, signName: "Scorpio", signDegree: 5.8 } // MC (Midheaven)
    }
  },
  // ... next points (if date range)
]
```

### Key Points:
- **Single date** — array with one object
- **Date range** — array of objects for each step (defined by `step` option in minutes)
- **bodies** — object with planet ID keys (0-9 for planets, 11, 12 for nodes)
- **aspects** — array of aspects between planets (optional)
- **houses** — object with cusps, ascendant, and MC (optional, when geo provided)

