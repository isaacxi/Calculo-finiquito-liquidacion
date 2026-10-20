// js/engines/mxCalculator.js

const CONFIG_2026 = Object.freeze({
  currency: "MXN",
  minAguinaldoDays: 15,
  minVacationBonusRate: 0.25,
  minimumDailyWage: Object.freeze({
    general: 315.04,
    fronteraNorte: 440.87,
  }),
});

const DAY_MS = 86_400_000;

function money(value) {
  if (!Number.isFinite(value)) throw new RangeError("Importe no finito");
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function positiveNumber(value, name, { allowZero = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) {
    throw new RangeError(`${name} tiene un valor inválido`);
  }
  return number;
}

function parseDateOnly(value, name) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`${name} debe tener formato YYYY-MM-DD`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError(`${name} no es una fecha válida`);
  }
  return date;
}

function daysBetween(start, end) {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

function anniversary(start, years) {
  const year = start.getUTCFullYear() + years;
  const month = start.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(start.getUTCDate(), lastDay);
  return new Date(Date.UTC(year, month, day));
}

function completedServiceYears(start, end) {
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  while (years > 0 && anniversary(start, years) > end) years -= 1;
  while (anniversary(start, years + 1) <= end) years += 1;
  return years;
}

function vacationDaysForServiceYear(year) {
  if (!Number.isInteger(year) || year < 1) {
    throw new RangeError("El año de servicio debe ser un entero positivo");
  }
  if (year <= 5) return 12 + (year - 1) * 2;
  return 22 + Math.floor((year - 6) / 5) * 2;
}

function calendarYearDays(year) {
  return (
    new Date(Date.UTC(year + 1, 0, 1)).getTime() / DAY_MS -
    new Date(Date.UTC(year, 0, 1)).getTime() / DAY_MS
  );
}

export function calcularLFT({
  salarioDiario,
  fechaIngreso,
  fechaSalida,
  tipoBaja = "renuncia",
  diasAguinaldo = CONFIG_2026.minAguinaldoDays,
  primaVacacional = CONFIG_2026.minVacationBonusRate,
  diasVacacionesPendientes = 0,
  zonaSalarioMinimo = "general",
  otrosConceptosPendientes = 0,
}) {
  const salario = positiveNumber(salarioDiario, "Salario diario");
  const start = parseDateOnly(fechaIngreso, "Fecha de ingreso");
  const end = parseDateOnly(fechaSalida, "Fecha de salida");

  if (end < start) throw new RangeError("La salida no puede ser anterior al ingreso");
  if (!["renuncia", "despido_injustificado", "otra"].includes(tipoBaja)) {
    throw new RangeError("tipoBaja no reconocido");
  }

  const aguinaldoDays = positiveNumber(diasAguinaldo, "Días de aguinaldo");
  const vacationBonusRate = positiveNumber(primaVacacional, "Prima vacacional");
  const pendingVacationDays = positiveNumber(diasVacacionesPendientes, "Días de vacaciones pendientes", { allowZero: true });
  const otherPending = positiveNumber(otrosConceptosPendientes, "Otros conceptos", { allowZero: true });

  const serviceYears = completedServiceYears(start, end);
  const lastAnniversary = anniversary(start, serviceYears);
  const nextAnniversary = anniversary(start, serviceYears + 1);
  const cycleLength = daysBetween(lastAnniversary, nextAnniversary);
  const elapsedInCurrentVacationCycle = Math.max(0, daysBetween(lastAnniversary, end));
  const annualVacationDays = vacationDaysForServiceYear(serviceYears + 1);
  const vacationDaysAccrued = annualVacationDays * Math.min(1, elapsedInCurrentVacationCycle / cycleLength);

  const yearStart = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
  const aguinaldoPeriodStart = start > yearStart ? start : yearStart;
  const daysInCurrentCalendarYear = Math.max(0, daysBetween(aguinaldoPeriodStart, end) + 1);

  const aguinaldoProportional = money(
    salario * aguinaldoDays * (daysInCurrentCalendarYear / calendarYearDays(end.getUTCFullYear()))
  );

  const vacationPay = money(salario * (vacationDaysAccrued + pendingVacationDays));
  const vacationPremium = money(vacationPay * vacationBonusRate);
  
  const finiquito = money(aguinaldoProportional + vacationPay + vacationPremium + otherPending);

  let sdiEstimado = 0;
  let indemnizacionConstitucional = 0;
  let primaAntiguedad = 0;
  let serviceYearsFraction = serviceYears;

  if (end > lastAnniversary) {
    serviceYearsFraction += daysBetween(lastAnniversary, end) / cycleLength;
  } else if (serviceYears === 0) {
    serviceYearsFraction = 1 / cycleLength;
  }

  if (tipoBaja === "despido_injustificado") {
    const minimumWage = CONFIG_2026.minimumDailyWage[zonaSalarioMinimo];
    if (!minimumWage) throw new RangeError("Zona salarial inválida");

    const integrationFactor = 1 + aguinaldoDays / 365 + (annualVacationDays * vacationBonusRate) / 365;
    sdiEstimado = money(salario * integrationFactor);
    indemnizacionConstitucional = money(90 * sdiEstimado);

    const cappedDailySalary = Math.min(salario, 2 * minimumWage);
    primaAntiguedad = money(12 * serviceYearsFraction * cappedDailySalary);
  }

  return {
    moneda: CONFIG_2026.currency,
    diasServicioCalendario: daysBetween(start, end) + 1,
    aniosCompletosServicio: serviceYears,
    aguinaldoProporcional,
    diasVacacionesProporcionales: money(vacationDaysAccrued),
    diasVacacionesPendientes: money(pendingVacationDays),
    pagoVacaciones: vacationPay,
    primaVacacional: vacationPremium,
    otrosConceptosPendientes: money(otherPending),
    finiquitoEstimado: finiquito,
    sdiEstimado,
    indemnizacionConstitucional,
    primaAntiguedad,
    totalEstimado: money(finiquito + indemnizacionConstitucional + primaAntiguedad),
    nota: "Estimación orientativa basada en LFT 2026.",
  };
}
