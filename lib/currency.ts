// Local currency by country (ISO 3166-1 alpha-2 -> ISO 4217). Unknown countries fall back to USD.
const EUR = 'AT BE HR CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES AD MC SM VA ME XK'.split(' ');
const MAP: Record<string, string> = {
  IL: 'ILS', PS: 'ILS', US: 'USD', EC: 'USD', SV: 'USD', PA: 'USD', TL: 'USD', GB: 'GBP', CH: 'CHF', LI: 'CHF',
  NO: 'NOK', SE: 'SEK', DK: 'DKK', IS: 'ISK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', BG: 'BGN', RS: 'RSD',
  BA: 'BAM', MK: 'MKD', AL: 'ALL', MD: 'MDL', UA: 'UAH', GE: 'GEL', AM: 'AMD', AZ: 'AZN', TR: 'TRY', CY_N: 'TRY',
  RU: 'RUB', BY: 'BYN', KZ: 'KZT', KG: 'KGS', UZ: 'UZS', TJ: 'TJS', TM: 'TMT', MN: 'MNT',
  NP: 'NPR', IN: 'INR', LK: 'LKR', BT: 'BTN', BD: 'BDT', PK: 'PKR', MV: 'MVR',
  TH: 'THB', VN: 'VND', LA: 'LAK', KH: 'KHR', MM: 'MMK', MY: 'MYR', SG: 'SGD', ID: 'IDR', PH: 'PHP', BN: 'BND',
  CN: 'CNY', HK: 'HKD', MO: 'MOP', TW: 'TWD', JP: 'JPY', KR: 'KRW',
  AU: 'AUD', NZ: 'NZD', FJ: 'FJD',
  CA: 'CAD', MX: 'MXN', GT: 'GTQ', BZ: 'BZD', HN: 'HNL', NI: 'NIO', CR: 'CRC', CU: 'CUP', DO: 'DOP', JM: 'JMD',
  CO: 'COP', VE: 'VES', PE: 'PEN', BO: 'BOB', CL: 'CLP', AR: 'ARS', UY: 'UYU', PY: 'PYG', BR: 'BRL',
  EG: 'EGP', JO: 'JOD', AE: 'AED', SA: 'SAR', QA: 'QAR', BH: 'BHD', OM: 'OMR', KW: 'KWD', MA: 'MAD', TN: 'TND',
  ZA: 'ZAR', NA: 'NAD', BW: 'BWP', ZW: 'USD', ZM: 'ZMW', MZ: 'MZN', MW: 'MWK', TZ: 'TZS', KE: 'KES', UG: 'UGX',
  RW: 'RWF', ET: 'ETB', MG: 'MGA', MU: 'MUR', SC: 'SCR', GH: 'GHS', NG: 'NGN', SN: 'XOF', CV: 'CVE',
};
for (const c of EUR) MAP[c] = 'EUR';

export const currencyFor = (country?: string | null) => (country && MAP[country.toUpperCase()]) || 'USD';

/** Country code -> flag emoji. */
export const flagOf = (country?: string | null) =>
  country && /^[A-Za-z]{2}$/.test(country)
    ? String.fromCodePoint(...country.toUpperCase().split('').map(ch => 0x1f1a5 + ch.charCodeAt(0)))
    : '🌍';

export const FLAG_BY_CURRENCY: Record<string, string> = { USD: '🇺🇸', ILS: '🇮🇱', EUR: '🇪🇺', GBP: '🇬🇧' };

export function currencyName(code: string) {
  try { return new Intl.DisplayNames(['he'], { type: 'currency' }).of(code) ?? code; } catch { return code; }
}

export function formatMoney(amount: number, code: string) {
  try { return new Intl.NumberFormat('he-IL', { style: 'currency', currency: code, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount); }
  catch { return `${amount.toLocaleString('en-US')} ${code}`; }
}

export const isCurrency = (c: unknown): c is string => typeof c === 'string' && /^[A-Z]{3}$/.test(c);
