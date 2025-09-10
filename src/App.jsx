import React, { useMemo, useState, useEffect, memo } from "react";

/* ========= Flags ========= */
const showSlidersSalary = true;   // enable sliders on Løn & Budget
const showSlidersInvest = false;  // keep text inputs on Investering

/* ========= Utils ========= */
const kr = (n) =>
  new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0,
  }).format(isFinite(n) ? Math.round(n) : 0);

const pct = (n) => `${(isFinite(n) ? Number(n) : 0).toFixed(2)}%`;

const toNum = (v, fallback = 0) => {
  if (v === "" || v === null || v === undefined) return fallback;
  const x = typeof v === "string" ? v.replaceAll(".", "").replace(",", ".") : v;
  const n = Number(x);
  return isFinite(n) ? n : fallback;
};

const field = (key, def) => {
  try {
    const saved = window.localStorage.getItem(key);
    return saved !== null ? JSON.parse(saved) : String(def);
  } catch {
    return String(def);
  }
};

const INPUT_BASE =
  "border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400";

/* ========= Small UI bits ========= */
const Row = memo(({ label, children, hint }) => (
  <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-3 py-2">
    <div className="md:col-span-4 text-sm md:text-base text-gray-700 font-medium whitespace-normal break-words leading-snug">
      {label}
    </div>
    <div className="md:col-span-6">{children}</div>
    <div className="md:col-span-2 text-[11px] text-gray-500 whitespace-normal break-words leading-snug">
      {hint}
    </div>
  </div>
));

const Read = memo(({ label, value, sub }) => (
  <div className="flex items-baseline justify-between py-1">
    <div className="text-gray-600 truncate pr-3">{label}</div>
    <div className="text-right">
      <div className="font-semibold leading-tight whitespace-nowrap tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-gray-500 leading-tight">{sub}</div>}
    </div>
  </div>
));

function TextNumber({ value, onChange, suffix, width = "w-28", placeholder, onBlur }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="decimal"
        className={`${width} ${INPUT_BASE}`}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
      />
      {suffix && <span className="text-gray-500">{suffix}</span>}
    </div>
  );
}

function Stepper({ value, onChange, step = 100, min = 0, suffix = "kr" }) {
  const dec = () =>
    onChange({ target: { value: String(Math.max(min, toNum(value) - step)) } });
  const inc = () => onChange({ target: { value: String(toNum(value) + step) } });
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={dec}
        className="rounded-xl border px-3 py-2 hover:bg-gray-50 active:scale-95"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        className={`w-full ${INPUT_BASE}`}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        onClick={inc}
        className="rounded-xl border px-3 py-2 hover:bg-gray-50 active:scale-95"
      >
        +
      </button>
      <span className="text-gray-500">{suffix}</span>
    </div>
  );
}

function RangeSlider({ value, onChange, min = 0, max = 100, step = 0.1, suffix = "%" }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        className="w-full accent-blue-600"
        min={min}
        max={max}
        step={step}
        value={toNum(value)}
        onInput={(e) =>
          onChange({ target: { value: String(e.currentTarget.value) } })
        }
      />
      <div className="flex items-center gap-2 min-w-[120px]">
        <input
          type="text"
          inputMode="decimal"
          className={`w-24 ${INPUT_BASE}`}
          value={value}
          onChange={onChange}
        />
        <span className="text-gray-500">{suffix}</span>
      </div>
    </div>
  );
}

function KPICard({ label, value, tone = "blue" }) {
  const toneClasses =
    tone === "green"
      ? "bg-green-50 border-green-200"
      : tone === "amber"
      ? "bg-amber-50 border-amber-200"
      : "bg-blue-50 border-blue-200";
  return (
    <div className={`rounded-2xl border ${toneClasses} p-4 overflow-hidden`}>
      <div className="text-gray-600 leading-tight">{label}</div>
      <div className="text-xl md:text-2xl font-extrabold mt-1 tracking-tight leading-tight break-words whitespace-nowrap tabular-nums">
        {value}
      </div>
    </div>
  );
}

function Toggle({ active, onClick, color, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl border text-sm flex items-center gap-2 transition ${
        active ? "bg-white shadow border-blue-300" : "bg-white/70 hover:bg-white border-gray-200"
      }`}
    >
      <span className="w-4 h-1 inline-block" style={{ background: color }} />
      {label}
    </button>
  );
}

/* ========= Investing Simulation ========= */
function simulateInvest({
  start,
  monthly,
  years,
  annualReturnPct,
  annualFeePct,
  inflationPct,
  taxPct,
  feeMode = "net", // 'net' | 'gains'
  timing = "begin", // 'begin' | 'end'
}) {
  const months = Math.max(0, Math.round(years * 12));
  const rAnnual = Math.max(0, annualReturnPct / 100);
  const feeAnnual = Math.max(0, annualFeePct / 100);
  const inflAnnual = Math.max(0, inflationPct / 100);
  const taxRate = Math.max(0, taxPct / 100);

  const rMonthlyNet = (rAnnual - feeAnnual) / 12;
  const rMonthlyGross = Math.pow(1 + rAnnual, 1 / 12) - 1;

  let balance = start;
  let contrib = start;

  const yearlyNominal = [balance];
  const yearlyInflAdj = [balance];
  const yearlyContrib = [contrib];
  const yearlyAfterTax = [balance];
  const yearlyAfterTaxInfl = [balance];

  for (let m = 1; m <= months; m++) {
    const r = feeMode === "net" ? rMonthlyNet : rMonthlyGross;

    if (timing === "begin") {
      balance += monthly;
      contrib += monthly;
    }
    balance = balance * (1 + r);
    if (timing === "end") {
      balance += monthly;
      contrib += monthly;
    }

    if (feeMode === "gains" && m % 12 === 0) {
      const gainsSoFar = Math.max(0, balance - contrib);
      balance -= gainsSoFar * feeAnnual;
    }

    if (m % 12 === 0) {
      const y = m / 12;
      yearlyNominal.push(balance);
      yearlyInflAdj.push(balance / Math.pow(1 + inflAnnual, y));
      yearlyContrib.push(start + monthly * m);

      const gainsSoFar = Math.max(0, balance - (start + monthly * m));
      const afterTaxSoFar = balance - gainsSoFar * taxRate;
      yearlyAfterTax.push(afterTaxSoFar);
      yearlyAfterTaxInfl.push(afterTaxSoFar / Math.pow(1 + inflAnnual, y));
    }
  }

  const beforeTax = balance;
  const gains = Math.max(0, beforeTax - contrib);
  const estTax = gains * taxRate;
  const afterTax = beforeTax - estTax;
  const afterInflation = beforeTax / Math.pow(1 + inflAnnual, years);
  const afterTaxInflation = afterTax / Math.pow(1 + inflAnnual, years);

  const effMonthly = feeMode === "net" ? rMonthlyNet : rMonthlyGross;

  return {
    beforeTax,
    gains,
    estTax,
    afterTax,
    afterInflation,
    afterTaxInflation,
    totalContrib: contrib,
    yearlyNominal,
    yearlyInflAdj,
    yearlyContrib,
    yearlyAfterTax,
    yearlyAfterTaxInfl,
    rMonthly: effMonthly,
  };
}

/* ========= Debt Payoff Simulation (min 200 kr) ========= */
function simulateDebt({ amount, ratePct, payment }) {
  const MIN_PAYMENT = 200; // recommended minimum floor
  const r = Math.max(0, ratePct / 100 / 12);
  let balance = Math.max(0, amount);

  if (payment < MIN_PAYMENT) {
    return {
      months: Infinity,
      years: Infinity,
      totalInterest: 0,
      lastPayment: 0,
      impossible: true,
      minPayment: MIN_PAYMENT,
    };
  }

  if (balance === 0) {
    return { months: 0, years: 0, totalInterest: 0, lastPayment: 0, impossible: false, minPayment: 0 };
  }

  if (r === 0) {
    const months = Math.ceil(balance / payment);
    const lastPayment = Math.max(0, balance - payment * (months - 1));
    return { months, years: months / 12, totalInterest: 0, lastPayment, impossible: false, minPayment: 0 };
  }

  const firstInterest = balance * r;
  const requiredForInterest = Math.ceil(firstInterest + 1); // tiny buffer so principal decreases
  const requiredMin = Math.max(MIN_PAYMENT, requiredForInterest);
  if (payment < requiredMin) {
    return {
      months: Infinity,
      years: Infinity,
      totalInterest: 0,
      lastPayment: 0,
      impossible: true,
      minPayment: requiredMin,
    };
  }

  let months = 0;
  let totalInterest = 0;
  let lastPayment = 0;
  const MAX_MONTHS = 2000; // safety

  for (let i = 0; i < MAX_MONTHS && balance > 1e-9; i++) {
    const interest = balance * r; // accrues over the month
    const payThisMonth = Math.min(payment, balance + interest); // then you pay
    const interestPaid = Math.min(interest, payThisMonth);
    const principalPaid = payThisMonth - interestPaid;

    totalInterest += interestPaid;
    balance -= principalPaid;
    months += 1;
    lastPayment = payThisMonth;
  }

  return { months, years: months / 12, totalInterest, lastPayment, impossible: false, minPayment: 0 };
}

/* ========= Chart for Investing ========= */
function niceTicks(maxVal) {
  const nice = (x) => {
    const exp = Math.pow(10, Math.floor(Math.log10(x)));
    const f = x / exp;
    let nf = 1;
    if (f <= 1) nf = 1;
    else if (f <= 2) nf = 2;
    else if (f <= 5) nf = 5;
    else nf = 10;
    return nf * exp;
  };
  const step = nice(maxVal / 5);
  const ticks = [];
  for (let v = 0; v <= maxVal * 1.01; v += step) ticks.push(v);
  return ticks;
}

function ChartSVG({ years, nominal, inflAdj, contrib, taxAdj, showInfl, showTax }) {
  const w = 760;
  const h = 280;
  const padL = 48;
  const padR = 14;
  const padT = 14;
  const padB = 34;

  const steps = Math.max(1, nominal.length - 1);
  const maxY = Math.max(
    ...nominal,
    ...(showInfl ? inflAdj : [0]),
    ...(showTax ? taxAdj : [0]),
    ...contrib
  ) || 1;
  const yTicks = niceTicks(maxY);

  const x = (i) => padL + (i * (w - padL - padR)) / steps;
  const y = (v) => h - padB - (v / (yTicks[yTicks.length - 1])) * (h - padT - padB);

  const path = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const areaPath = `${path(nominal)} L ${x(steps)},${y(0)} L ${x(0)},${y(0)} Z`;

  const xTicks = Array.from({ length: years + 1 }, (_, i) => i);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[280px]">
      {yTicks.map((t, idx) => (
        <g key={idx}>
          <line x1={padL} y1={y(t)} x2={w - padR} y2={y(t)} stroke="#eef2f7" />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#6b7280">
            {kr(t)}
          </text>
        </g>
      ))}
      {xTicks.map((yr) => (
        <line key={yr} x1={x(yr)} y1={h - padB} x2={x(yr)} y2={h - padB + 4} stroke="#cbd5e1" />
      ))}
      {xTicks
        .filter((yr) => yr % 5 === 0)
        .map((yr) => (
          <text
            key={`lbl-${yr}`}
            x={x(yr)}
            y={h - 8}
            textAnchor="middle"
            fontSize="10"
            fill="#6b7280"
          >
            År {yr}
          </text>
        ))}

      <path d={areaPath} fill="#dbeafe" opacity="0.6" />
      <path d={path(nominal)} stroke="#1d4ed8" fill="none" strokeWidth="2" />
      {showInfl && <path d={path(inflAdj)} stroke="#16a34a" fill="none" strokeDasharray="6,6" strokeWidth="2" />}
      {showTax && <path d={path(taxAdj)} stroke="#f59e0b" fill="none" strokeWidth="2" />}
      <path d={path(contrib)} stroke="#9ca3af" fill="none" strokeWidth="2" opacity="0.9" />

      <text x={(w + padL) / 2} y={h - 2} textAnchor="middle" fontSize="11" fill="#6b7280">
        År
      </text>
      <text
        transform={`translate(12 ${(h - padB) / 2}) rotate(-90)`}
        fontSize="11"
        fill="#6b7280"
      >
        Værdi (kr)
      </text>
    </svg>
  );
}

/* ========= Main App ========= */

// --- Mortgage helpers ---
function annuityPayment(principal, annualRatePct, years) {
  const P = Math.max(0, principal);
  const r = Math.max(0, annualRatePct) / 100 / 12;
  const n = Math.max(0, Math.round(years * 12));
  if (n === 0) return 0;
  if (r === 0) return P / n;
  return (P * r) / (1 - Math.pow(1 + r, -n));
}

function principalFromPayment(payment, annualRatePct, years) {
  const C = Math.max(0, payment);
  const r = Math.max(0, annualRatePct) / 100 / 12;
  const n = Math.max(0, Math.round(years * 12));
  if (n === 0) return 0;
  if (r === 0) return C * n;
  return (C * (1 - Math.pow(1 + r, -n))) / r;
}

// --- Mortgage Tab ---
function MortgageTab() {
  const [m, setM] = React.useState(() => ({
    type: field("m_type", "helaar"), // 'helaar' | 'fritid' | 'andel'
    price: field("m_price", 2500000),
    down: field("m_down", 300000),
    rkYears: field("m_rkYears", 30),
    rkIoYears: field("m_rkIoYears", 0),
    rkRate: field("m_rkRate", 4.0),
    bankYears: field("m_bankYears", 30),
    bankRate: field("m_bankRate", 7.0),
    // capacity inputs
    c_income1: field("c_income1", 450000),
    c_income2: field("c_income2", 0),
    c_taxPct: field("c_taxPct", 38),
    c_housingPct: field("c_housingPct", 30),
    c_obligations: field("c_obligations", 0),
    c_rate: field("c_rate", 6.0),
    c_years: field("c_years", 30),
    c_ioYears: field("c_ioYears", 0),
    c_down: field("c_down", 300000),
  }));

  React.useEffect(() => {
    const id = setTimeout(() => {
      Object.entries(m).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
    }, 250);
    return () => clearTimeout(id);
  }, [m]);

  const t = (k) => (e) => setM((s) => ({ ...s, [k]: e.target.value }));
  const setType = (v) => setM((s) => ({ ...s, type: v }));

  const price = toNum(m.price);
  const down = Math.min(price, Math.max(0, toNum(m.down)));
  const need = Math.max(0, price - down);

  const LTVS = { helaar: 0.8, fritid: 0.75, andel: 0 };
  const maxRK = (LTVS[m.type] || 0) * price;
  const rkLoan = Math.min(need, maxRK);
  const bankLoan = Math.max(0, need - rkLoan);

  const rkYears = Math.max(0, toNum(m.rkYears));
  const rkIoYears = Math.min(10, Math.max(0, toNum(m.rkIoYears)));
  const rkRate = Math.max(0, toNum(m.rkRate));
  const bankYears = Math.max(1, toNum(m.bankYears));
  const bankRate = Math.max(0, toNum(m.bankRate));

  const rkPayIO = rkLoan > 0 ? rkLoan * (rkRate / 100 / 12) : 0;
  const rkAmortYears = Math.max(0, rkYears - rkIoYears);
  const rkPayAfter = rkLoan > 0 ? annuityPayment(rkLoan, rkRate, rkAmortYears || rkYears) : 0;
  const bankPay = bankLoan > 0 ? annuityPayment(bankLoan, bankRate, bankYears) : 0;

  const totalInitial = rkPayIO + bankPay;
  const totalAfterIO = rkPayAfter + bankPay;

  const ltvActual = price > 0 ? need / price : 0;

  // capacity
  const inc1 = Math.max(0, toNum(m.c_income1));
  const inc2 = Math.max(0, toNum(m.c_income2));
  const taxPct = Math.min(60, Math.max(0, toNum(m.c_taxPct)));
  const housingPct = Math.min(60, Math.max(5, toNum(m.c_housingPct)));
  const obligations = Math.max(0, toNum(m.c_obligations));
  const cRate = Math.max(0, toNum(m.c_rate));
  const cYears = Math.max(1, toNum(m.c_years));
  const cIo = Math.max(0, Math.min(10, toNum(m.c_ioYears)));
  const cDown = Math.max(0, toNum(m.c_down));

  const netMonthly = ((inc1 + inc2) * (1 - taxPct / 100)) / 12;
  const budgetMonthly = Math.max(0, (netMonthly * housingPct) / 100 - obligations);
  const loanFromBudget = principalFromPayment(budgetMonthly, cRate, Math.max(1, cYears - cIo));
  const maxPrice = loanFromBudget + cDown;

  return (
    <div>
      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Boliglån</h1>
        <p className="text-gray-600 mt-2 max-w-3xl mx-auto">
          Beregn fordeling mellem realkredit og banklån, og estimer hvor meget du kan låne baseret på indkomst og budget.
        </p>
      </header>

      {/* Struktur-beregner */}
      <section className="bg-white rounded-3xl shadow p-6 mb-8">
        <div className="grid xl:grid-cols-3 gap-8">
          <div>
            <div className="mb-4">
              <div className="font-semibold mb-2">Boligtype</div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="btype" checked={m.type === 'helaar'} onChange={() => setType('helaar')} />
                  Helårsbolig
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="btype" checked={m.type === 'fritid'} onChange={() => setType('fritid')} />
                  Fritidsbolig
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="btype" checked={m.type === 'andel'} onChange={() => setType('andel')} />
                  Andelsbolig
                </label>
              </div>
            </div>

            <Row label="Boligens pris*">
              <TextNumber value={m.price} onChange={t('m_price')} suffix="kr" width="w-40" />
            </Row>
            <Row label="Egen udbetaling*">
              <TextNumber value={m.down} onChange={t('m_down')} suffix="kr" width="w-40" />
            </Row>

            {down < price * 0.05 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3 text-sm">
                Bemærk: udbetalingen er under 5% af købsprisen (almindelig anbefaling).
              </div>
            )}
          </div>

          <div>
            <div className="font-semibold mb-2">Justér realkreditlån</div>
            <Row label={`Afdragsfrihed`} hint={`${rkIoYears} år`}>
              <RangeSlider value={m.rkIoYears} onChange={t('m_rkIoYears')} min={0} max={10} step={1} suffix="år" />
            </Row>
            <Row label={`Løbetid`} hint={`${rkYears} år`}>
              <RangeSlider value={m.rkYears} onChange={t('m_rkYears')} min={10} max={30} step={1} suffix="år" />
            </Row>
            <Row label="Rente (ÅOP)">
              <TextNumber value={m.rkRate} onChange={t('m_rkRate')} suffix="%" width="w-24" />
            </Row>
          </div>

          <div>
            <div className="font-semibold mb-2">Justér banklån</div>
            <Row label={`Løbetid`} hint={`${bankYears} år`}>
              <RangeSlider value={m.bankYears} onChange={t('m_bankYears')} min={1} max={30} step={1} suffix="år" />
            </Row>
            <Row label="Rente (ÅOP)">
              <TextNumber value={m.bankRate} onChange={t('m_bankRate')} suffix="%" width="w-24" />
            </Row>
          </div>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <KPICard label="Lånebehov" value={kr(need)} />
          <KPICard label="Realkredit (beløb)" value={kr(rkLoan)} />
          <KPICard label="Banklån (beløb)" value={kr(bankLoan)} />
          <KPICard label="Faktisk belåningsgrad" value={`${(ltvActual * 100).toFixed(1)}%`} />
        </div>

        <div className="mt-4 grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <KPICard label="Mdl. ydelse (start)" value={kr(totalInitial)} tone="green" />
          <KPICard label="Mdl. ydelse (efter IO)" value={kr(totalAfterIO)} tone="amber" />
          <KPICard label="RK ydelse (IO)" value={kr(rkPayIO)} />
          <KPICard label="RK ydelse (efter IO)" value={kr(rkPayAfter)} />
        </div>

        {m.type === 'andel' && (
          <div className="text-xs text-gray-500 mt-2">
            Andelsbolig finansieres typisk kun via banklån; realkredit sættes til 0 i denne model.
          </div>
        )}
      </section>

      {/* Låneevne */}
      <section className="bg-white rounded-3xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Hvor meget kan jeg låne?</h2>
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <Row label="Indkomst 1 (årligt)">
              <TextNumber value={m.c_income1} onChange={t('c_income1')} suffix="kr" width="w-40" />
            </Row>
            <Row label="Indkomst 2 (årligt)">
              <TextNumber value={m.c_income2} onChange={t('c_income2')} suffix="kr" width="w-40" />
            </Row>
            <Row label="Skatteprocent (estimat)">
              <TextNumber value={m.c_taxPct} onChange={t('c_taxPct')} suffix="%" width="w-24" />
            </Row>
            <Row label="Andel af netto til bolig">
              <TextNumber value={m.c_housingPct} onChange={t('c_housingPct')} suffix="%" width="w-24" />
            </Row>
            <Row label="Øvrige forpligtelser (mdr)">
              <TextNumber value={m.c_obligations} onChange={t('c_obligations')} suffix="kr" width="w-32" />
            </Row>
          </div>

          <div>
            <Row label="Beregningsrente (stress)">
              <TextNumber value={m.c_rate} onChange={t('c_rate')} suffix="%" width="w-24" />
            </Row>
            <Row label="Løbetid">
              <TextNumber value={m.c_years} onChange={t('c_years')} suffix="år" width="w-20" />
            </Row>
            <Row label="Afdragsfrihed">
              <TextNumber value={m.c_ioYears} onChange={t('c_ioYears')} suffix="år" width="w-20" />
            </Row>
            <Row label="Udbetaling (til købet)">
              <TextNumber value={m.c_down} onChange={t('c_down')} suffix="kr" width="w-40" />
            </Row>
          </div>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Budget til bolig (mdr)" value={kr(budgetMonthly)} />
          <KPICard label="Estimeret lån" value={kr(loanFromBudget)} />
          <KPICard label="Estimeret max boligpris" value={kr(maxPrice)} tone="green" />
          <KPICard label="Effektiv mdr-rente" value={`${(Math.max(0, toNum(m.c_rate)) / 12).toFixed(3)}%`} />
        </div>
        <div className="text-xs text-gray-500 mt-3">
          Forenklet model: resultater er vejledende og tager ikke højde for alle bankkrav (fx gælds-/indkomstgrænser,
          bidragssatser, stiftelsesomkostninger m.m.).
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const tabs = [
    { key: "salary", label: "Løn & Budget" },
    { key: "invest", label: "Investering" },
    { key: "debt", label: "Gæld" },
    { key: "mortgage", label: "Boliglån" },
  ];
  const [tab, setTab] = useState("invest");

  /* ----- Salary state + calc ----- */
  const [inputs, setInputs] = useState(() => ({
    salaryPreTax: field("salaryPreTax", 40000),
    amPct: field("amPct", 8),
    pensionPct: field("pensionPct", 3),
    atpFixed: field("atpFixed", 99),
    fradrag: field("fradrag", 9868),
    taxRatePct: field("taxRatePct", 36),
    essentialsPct: field("essentialsPct", 0),
    funPct: field("funPct", 0),
    futurePct: field("futurePct", 0),
    essentialsFixed: field("essentialsFixed", 0),
    funFixed: field("funFixed", 0),
    futureFixed: field("futureFixed", 0),
  }));

  useEffect(() => {
    const id = setTimeout(() => {
      for (const [k, v] of Object.entries(inputs)) {
        localStorage.setItem(k, JSON.stringify(v));
      }
    }, 300);
    return () => clearTimeout(id);
  }, [inputs]);

  const onText = (k) => (e) => setInputs((s) => ({ ...s, [k]: e.target.value }));

  const calc = useMemo(() => {
    const salaryPreTax = toNum(inputs.salaryPreTax);
    const am = salaryPreTax * (toNum(inputs.amPct) / 100);
    const pension = salaryPreTax * (toNum(inputs.pensionPct) / 100);
    const atp = toNum(inputs.atpFixed);

    const amountBeforeFradrag = salaryPreTax - am - pension - atp;

    const fradrag = Math.max(0, toNum(inputs.fradrag));
    const taxableBase = Math.max(0, amountBeforeFradrag - fradrag);

    const taxRate = toNum(inputs.taxRatePct) / 100;
    const taxedAmount = taxableBase * taxRate;

    const salaryAfterTax = amountBeforeFradrag - taxedAmount;

    const E_pct = Math.max(0, toNum(inputs.essentialsPct));
    const F_pct = Math.max(0, toNum(inputs.funPct));
    const U_pct = Math.max(0, toNum(inputs.futurePct));

    const pctSum = E_pct + F_pct + U_pct;

    let essentials = salaryAfterTax * (E_pct / 100);
    let fun = salaryAfterTax * (F_pct / 100);
    let future = salaryAfterTax * (U_pct / 100);

    const essentialsFixed = Math.max(0, toNum(inputs.essentialsFixed));
    const funFixed = Math.max(0, toNum(inputs.funFixed));
    const futureFixed = Math.max(0, toNum(inputs.futureFixed));

    if (essentialsFixed > 0) essentials = essentialsFixed;
    if (funFixed > 0) fun = funFixed;
    if (futureFixed > 0) future = futureFixed;

    const allocated = essentials + fun + future;
    const leftover = salaryAfterTax - allocated;

    const pctUsed = salaryAfterTax > 0 ? (allocated / salaryAfterTax) * 100 : 0;

    return {
      salaryPreTax,
      am,
      pension,
      atp,
      fradrag,
      amountBeforeFradrag,
      amountAfterFradrag: amountBeforeFradrag - fradrag,
      taxedAmount,
      salaryAfterTax,
      essentials,
      fun,
      future,
      leftover,
      pctUsed,
      pctSum,
    };
  }, [inputs]);

  function SalaryTab() {
    return (
      <div>
        <header className="text-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Løn & Budget</h1>
          <p className="text-gray-600 mt-2 max-w-3xl mx-auto">
            Få et klart billede af din månedlige nettoindkomst, og fordel den mellem Essentials, Fun og
            Future You.
          </p>
        </header>

        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-8">
          <section className="bg-white rounded-3xl shadow p-6 overflow-hidden">
            <h2 className="text-lg font-semibold mb-3">Indstillinger</h2>

            <Row label="Bruttoløn (kr)">
              <Stepper value={inputs.salaryPreTax} onChange={onText("salaryPreTax")} step={500} min={0} />
            </Row>

            <Row label="AM (%)" hint="Arbejdsmarkedsbidrag">
              {showSlidersSalary ? (
                <RangeSlider value={inputs.amPct} onChange={onText("amPct")} min={0} max={8} step={0.1} />
              ) : (
                <TextNumber value={inputs.amPct} onChange={onText("amPct")} suffix="%" width="w-24" />
              )}
            </Row>

            <Row label="Pension (%)">
              {showSlidersSalary ? (
                <RangeSlider value={inputs.pensionPct} onChange={onText("pensionPct")} min={0} max={20} step={0.1} />
              ) : (
                <TextNumber value={inputs.pensionPct} onChange={onText("pensionPct")} suffix="%" width="w-24" />
              )}
            </Row>

            <Row label="ATP (kr)" hint="Fast beløb">
              <Stepper value={inputs.atpFixed} onChange={onText("atpFixed")} step={10} min={0} />
            </Row>

            <Row label="Fradrag (kr)" hint="Bruges kun til skattebase">
              <Stepper value={inputs.fradrag} onChange={onText("fradrag")} step={100} min={0} />
            </Row>

            <Row label="Skatteprocent (%)" hint="Anvendes på (beløb efter fradrag)">
              {showSlidersSalary ? (
                <RangeSlider value={inputs.taxRatePct} onChange={onText("taxRatePct")} min={0} max={60} step={0.1} />
              ) : (
                <TextNumber value={inputs.taxRatePct} onChange={onText("taxRatePct")} suffix="%" width="w-24" />
              )}
            </Row>
          </section>

          <section className="bg-white rounded-3xl shadow p-6 overflow-hidden">
            <h2 className="text-lg font-semibold mb-3">Resultater</h2>

            <div className="space-y-1">
              <Read label="Bruttoløn" value={kr(calc.salaryPreTax)} />
              <Read label="AM" value={kr(calc.am)} sub={pct(toNum(inputs.amPct))} />
              <Read label="Pension" value={kr(calc.pension)} sub={pct(toNum(inputs.pensionPct))} />
              <Read label="ATP" value={kr(calc.atp)} />
              <div className="border-t my-2" />
              <Read label="Beløb før fradrag" value={kr(calc.amountBeforeFradrag)} />
              <Read label="Fradrag" value={kr(calc.fradrag)} />
              <Read label="Beløb efter fradrag" value={kr(calc.amountAfterFradrag)} />
              <Read label="Skat" value={kr(calc.taxedAmount)} sub={pct(toNum(inputs.taxRatePct))} />
              <div className="border-t my-2" />
              <Read label="Løn efter skat" value={kr(calc.salaryAfterTax)} />
            </div>

            <div className="grid sm:grid-cols-3 gap-3 mt-4">
              <KPICard label="Efter skat" value={kr(calc.salaryAfterTax)} tone="green" />
              <KPICard label="Skattepligtig" value={kr(calc.amountAfterFradrag)} />
              <KPICard label="Skat (anslået)" value={kr(calc.taxedAmount)} tone="amber" />
            </div>
          </section>
        </div>

        <section
          className={`${
            calc.leftover < 0 ? "ring-2 ring-red-300" : ""
          } bg-white rounded-3xl shadow p-6 mt-8 overflow-hidden`}
        >
          <h2 className="text-lg font-semibold mb-4">Budgetfordeling (af netto)</h2>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { key: "essentials", label: "Essentials" },
              { key: "fun", label: "Fun" },
              { key: "future", label: "Future You" },
            ].map(({ key, label }) => (
              <div key={key} className="rounded-xl border p-4">
                <div className="font-medium mb-2">{label}</div>
                {showSlidersSalary ? (
                  <RangeSlider
                    value={inputs[`${key}Pct`]}
                    onChange={onText(`${key}Pct`)}
                    min={0}
                    max={100}
                    step={0.5}
                    suffix="%"
                  />
                ) : (
                  <TextNumber
                    value={inputs[`${key}Pct`]}
                    onChange={onText(`${key}Pct`)}
                    suffix="%"
                    width="w-24"
                  />
                )}
                <div className="flex items-center justify-between mt-3 text-sm">
                  <div className="text-gray-500">eller fast beløb</div>
                  <TextNumber
                    value={inputs[`${key}Fixed`]}
                    onChange={onText(`${key}Fixed`)}
                    suffix="kr"
                    width="w-28"
                  />
                </div>
                <div className="mt-3 text-right text-sm">
                  <span className="text-gray-500">Beløb:</span>{" "}
                  <span className="font-semibold whitespace-nowrap tabular-nums">
                    {kr(key === "essentials" ? calc.essentials : key === "fun" ? calc.fun : calc.future)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid md:grid-cols-3 gap-4">
            <div className="rounded-xl bg-gray-50 p-4 border overflow-hidden">
              <div className="text-gray-600">Allokeret</div>
              <div className="text-xl font-semibold whitespace-nowrap tabular-nums">
                {kr(calc.essentials + calc.fun + calc.future)}
              </div>
              <div className="text-[11px] text-gray-500">{pct(calc.pctUsed)} af netto</div>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 border overflow-hidden">
              <div className="text-gray-600">Tilbage</div>
              <div
                className={`text-xl font-semibold whitespace-nowrap tabular-nums ${
                  calc.leftover < 0 ? "text-red-600" : ""
                }`}
              >
                {kr(calc.leftover)}
              </div>
              <div className="text-[11px] text-gray-500">Ikke allokeret</div>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 border overflow-hidden">
              <div className="text-gray-600">% i alt</div>
              <div className="text-xl font-semibold whitespace-nowrap tabular-nums">{pct(calc.pctSum)}</div>
              <div className="text-[11px] text-gray-500">Kun relevant ved % fordeling</div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  /* ----- Investing tab ----- */
  function InvestingTab() {
    const [iv, setIv] = useState(() => ({
      start: field("iv_start", 0),
      monthly: field("iv_monthly", 6000),
      years: field("iv_years", 30),
      returnPct: field("iv_returnPct", 8),
      feePct: field("iv_feePct", 1),
      inflPct: field("iv_inflPct", 2),
      taxPct: field("iv_taxPct", 27),
      feeMode: field("iv_feeMode", "net"),   // 'net' | 'gains'
      timing: field("iv_timing", "begin"),   // 'begin' | 'end'
    }));

    const [showInfl, setShowInfl] = useState(true);
    const [showTax, setShowTax] = useState(false);

    useEffect(() => {
      const id = setTimeout(() => {
        Object.entries(iv).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
      }, 300);
      return () => clearTimeout(id);
    }, [iv]);

    const t = (k) => (e) => setIv((s) => ({ ...s, [k]: e.target.value }));

    const sim = useMemo(
      () =>
        simulateInvest({
          start: toNum(iv.start),
          monthly: toNum(iv.monthly),
          years: toNum(iv.years),
          annualReturnPct: toNum(iv.returnPct),
          annualFeePct: toNum(iv.feePct),
          inflationPct: toNum(iv.inflPct),
          taxPct: toNum(iv.taxPct),
          feeMode: iv.feeMode,
          timing: iv.timing,
        }),
      [iv]
    );

    const years = Math.max(0, Math.round(toNum(iv.years)));

    const Seg = ({ k, options }) => (
      <div className="inline-flex rounded-xl border bg-white overflow-hidden text-sm">
        {options.map((o, idx) => (
          <button
            key={o.v}
            onClick={() => setIv((s) => ({ ...s, [k]: o.v }))}
            className={`px-3 py-1.5 ${iv[k] === o.v ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"} ${
              idx ? "border-l" : ""
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    );

    return (
      <div>
        <header className="text-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Investeringsberegner</h1>
          <p className="text-gray-600 mt-2 max-w-3xl mx-auto">
            Visualisér hvordan din opsparing kan vokse med månedlige indskud, afkast, omkostninger og inflation.
          </p>
        </header>

        <section className="bg-white rounded-3xl shadow p-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <Row label="Startbeløb">
                <Stepper value={iv.start} onChange={t("start")} step={1000} min={0} />
                <span className="hidden">kr</span>
              </Row>
              <Row label="Månedligt indskud">
                {showSlidersInvest ? (
                  <div />
                ) : (
                  <TextNumber value={iv.monthly} onChange={t("monthly")} suffix="kr" width="w-32" />
                )}
              </Row>
              <Row label="Tidshorisont (år)">
                {showSlidersInvest ? <div /> : <TextNumber value={iv.years} onChange={t("years")} width="w-24" />}
              </Row>
              <Row label="Forventet årligt afkast (%)">
                {showSlidersInvest ? (
                  <div />
                ) : (
                  <TextNumber value={iv.returnPct} onChange={t("returnPct")} suffix="%" width="w-24" />
                )}
              </Row>
              <Row label="Årlige omkostninger (ÅOP %)">
                {showSlidersInvest ? (
                  <div />
                ) : (
                  <TextNumber value={iv.feePct} onChange={t("feePct")} suffix="%" width="w-24" />
                )}
              </Row>
              <Row label="Forventet årlig inflation (%)">
                {showSlidersInvest ? (
                  <div />
                ) : (
                  <TextNumber value={iv.inflPct} onChange={t("inflPct")} suffix="%" width="w-24" />
                )}
              </Row>
              <Row label="Skat af afkast (%)">
                {showSlidersInvest ? (
                  <div />
                ) : (
                  <TextNumber value={iv.taxPct} onChange={t("taxPct")} suffix="%" width="w-24" />
                )}
              </Row>

              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-44 text-gray-700 font-medium">Indbetaling</div>
                  <Seg
                    k="timing"
                    options={[
                      { v: "begin", label: "Starten af måneden" },
                      { v: "end", label: "Slutningen af måneden" },
                    ]}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-44 text-gray-700 font-medium">ÅOP-model</div>
                  <Seg
                    k="feeMode"
                    options={[
                      { v: "net", label: "Træk fra afkast (simpel)" },
                      { v: "gains", label: "ÅOP på årets gevinst" },
                    ]}
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="grid sm:grid-cols-3 gap-3">
                <KPICard label="Værdi (før skat)" value={kr(sim.beforeTax)} />
                <KPICard label="Værdi efter skat" value={kr(sim.afterTax)} tone="green" />
                <KPICard label="Værdi efter inflation" value={kr(sim.afterInflation)} tone="amber" />
              </div>
              <div className="grid sm:grid-cols-3 gap-3 mt-4">
                <div className="rounded-2xl border bg-gray-50 p-4">
                  <div className="text-gray-600">Samlede indbetalinger</div>
                  <div className="text-xl font-bold whitespace-nowrap tabular-nums">{kr(sim.totalContrib)}</div>
                </div>
                <div className="rounded-2xl border bg-gray-50 p-4">
                  <div className="text-gray-600">Samlet afkast</div>
                  <div className="text-xl font-bold whitespace-nowrap tabular-nums">{kr(sim.gains)}</div>
                </div>
                <div className="rounded-2xl border bg-gray-50 p-4">
                  <div className="text-gray-600">Anslået skat</div>
                  <div className="text-xl font-bold whitespace-nowrap tabular-nums">{kr(sim.estTax)}</div>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 mt-4">
                <KPICard label="Værdi efter skat & inflation" value={kr(sim.afterTaxInflation)} />
                <div className="rounded-2xl border bg-gray-50 p-4">
                  <div className="text-gray-600">Eff. mdr-rente</div>
                  <div className="text-xl font-bold whitespace-nowrap tabular-nums">
                    {(sim.rMonthly * 100).toFixed(3)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="mt-8">
            <div className="flex gap-2 justify-end mb-2">
              <Toggle
                active={showInfl}
                onClick={() => setShowInfl((v) => !v)}
                color="#16a34a"
                label="Inflation-justeret"
              />
              <Toggle
                active={showTax}
                onClick={() => setShowTax((v) => !v)}
                color="#f59e0b"
                label="Efter skat"
              />
            </div>
            <ChartSVG
              years={years}
              nominal={sim.yearlyNominal}
              inflAdj={sim.yearlyInflAdj}
              contrib={sim.yearlyContrib}
              taxAdj={sim.yearlyAfterTax}
              showInfl={showInfl}
              showTax={showTax}
            />
          </div>
        </section>
      </div>
    );
  }

  /* ----- Debt (Gæld) tab ----- */
  function DebtTab() {
    const [d, setD] = useState(() => ({
      amount: field("d_amount", 480000),
      ratePct: field("d_ratePct", 3),
      payment: field("d_payment", 4084),
    }));

    useEffect(() => {
      const id = setTimeout(() => {
        Object.entries(d).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
      }, 300);
      return () => clearTimeout(id);
    }, [d]);

    const t = (k) => (e) => setD((s) => ({ ...s, [k]: e.target.value }));

    const sim = useMemo(
      () =>
        simulateDebt({
          amount: toNum(d.amount),
          ratePct: toNum(d.ratePct),
          payment: toNum(d.payment),
        }),
      [d]
    );

    const monthsStr = `${sim.impossible ? "—" : sim.months} måneder / ${
      sim.impossible ? "—" : (sim.years).toFixed(2).replace(".", ",")
    } år`;

    const setMin = () => setD((s) => ({ ...s, payment: String(sim.minPayment || 200) }));

    return (
      <div>
        <header className="text-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Beregn, hvornår du er gældfri</h1>
          <p className="text-gray-600 mt-2 max-w-3xl mx-auto">
            Indtast din samlede gæld, den gennemsnitlige rente og hvor meget du kan betale hver måned.
          </p>
        </header>

        <section className="bg-white rounded-3xl shadow p-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <Row label="Hvad skylder du i alt?">
                <TextNumber value={d.amount} onChange={t("amount")} suffix="kr" width="w-40" />
              </Row>
              <Row label="Hvad er renten i gennemsnit?">
                <TextNumber value={d.ratePct} onChange={t("ratePct")} suffix="%" width="w-24" />
              </Row>
              <Row label="Hvor meget kan du betale om måneden?">
                <TextNumber
                  value={d.payment}
                  onChange={t("payment")}
                  onBlur={() => setD((s) => ({ ...s, payment: String(Math.max(200, toNum(s.payment))) }))}
                  suffix="kr"
                  width="w-40"
                />
              </Row>

              <div className="mt-4">
                {sim.impossible ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4">
                    Din månedlige ydelse er for lav. Minimum er {" "}
                    <span className="font-semibold">{kr(sim.minPayment)}</span>.
                    <button
                      type="button"
                      className="ml-3 rounded-lg px-3 py-1.5 border bg-white hover:bg-gray-50"
                      onClick={setMin}
                    >
                      Brug minimum
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Sidste betaling anslået: {kr(sim.lastPayment)}.</div>
                )}
              </div>
            </div>

            <div>
              <div className="grid gap-3">
                <KPICard label="Du er gældfri om" value={monthsStr} />
                <KPICard label="Total sum betalt i rente" value={kr(sim.totalInterest)} tone="amber" />
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border bg-gray-50 p-4">
                  <div className="text-gray-600">Din samlede gæld</div>
                  <div className="text-xl font-bold whitespace-nowrap tabular-nums">{kr(toNum(d.amount))}</div>
                </div>
                <div className="rounded-2xl border bg-gray-50 p-4">
                  <div className="text-gray-600">Gns. pålydende rente</div>
                  <div className="text-xl font-bold whitespace-nowrap tabular-nums">{pct(toNum(d.ratePct))}</div>
                </div>
                <div className="rounded-2xl border bg-gray-50 p-4">
                  <div className="text-gray-600">Månedlig ydelse</div>
                  <div className="text-xl font-bold whitespace-nowrap tabular-nums">{kr(toNum(d.payment))}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // (ComingSoon removed — replaced by MortgageTab)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 py-3">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                  tab === t.key
                    ? "bg-white border-blue-300 text-blue-700 shadow"
                    : "bg-white/70 hover:bg-white border-gray-200 text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {tab === "salary" && <SalaryTab />}
        {tab === "invest" && <InvestingTab />}
        {tab === "debt" && <DebtTab />}
        {tab === "mortgage" && <MortgageTab />}

        <footer className="text-xs text-gray-500 mt-10 text-center">
          Værdier gemmes lokalt i din browser. Designet med Tailwind.
        </footer>
      </main>
    </div>
  );
}
