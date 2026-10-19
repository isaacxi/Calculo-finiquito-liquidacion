import mxConfig from './config/MX.json' assert { type: 'json' };

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar iconos Lucide
  lucide.createIcons();

  const form = document.getElementById('calcForm');
  const resultCard = document.getElementById('resultCard');
  const placeholderCard = document.getElementById('placeholderCard');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Captura de Inputs
    const salarioInput = parseFloat(document.getElementById('salario').value);
    const frecuencia = document.getElementById('frecuencia').value;
    const fechaIngreso = new Date(document.getElementById('fechaIngreso').value);
    const fechaSalida = new Date(document.getElementById('fechaSalida').value);
    const tipoBaja = document.getElementById('tipoBaja').value;
    const diasAguinaldoInput = parseFloat(document.getElementById('diasAguinaldo').value) || 15;
    const primaVacPctInput = (parseFloat(document.getElementById('primaVacacionalPct').value) || 25) / 100;

    // Normalización a Salario Diario
    let salarioDiario = salarioInput;
    if (frecuencia === 'mensual') salarioDiario = salarioInput / 30;
    if (frecuencia === 'quincenal') salarioDiario = salarioInput / 15;

    // Ejecutar Cálculo
    const res = calcularLFT(salarioDiario, fechaIngreso, fechaSalida, tipoBaja, diasAguinaldoInput, primaVacPctInput);

    // Renderizar Resultados
    document.getElementById('montoTotal').textContent = `$${res.totalGeneral} MXN`;
    document.getElementById('resAguinaldo').textContent = `$${res.aguinaldoProporcional}`;
    document.getElementById('resVacaciones').textContent = `$${res.vacacionesProporcionales}`;
    document.getElementById('resPrimaVac').textContent = `$${res.primaVacacional}`;

    const seccionLiq = document.getElementById('seccionLiquidacion');
    if (tipoBaja === 'despido') {
      document.getElementById('resIndemnizacion').textContent = `$${res.indemnizacionConstitucional}`;
      document.getElementById('resPrimaAntiguedad').textContent = `$${res.primaAntiguedad}`;
      seccionLiq.classList.remove('hidden');
    } else {
      seccionLiq.classList.add('hidden');
    }

    // Alternar visibilidad de Tarjetas
    placeholderCard.classList.add('hidden');
    resultCard.classList.remove('hidden');
  });

  // Exportar a PDF
  downloadPdfBtn.addEventListener('click', () => {
    const element = document.getElementById('pdfContent');
    const opt = {
      margin:       0.5,
      filename:     'Resumen_Finiquito_MX.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  });
});

// Función de Cálculo según LFT
function calcularLFT(salarioDiario, inicio, fin, tipoBaja, diasAguinaldo, primaVacPct) {
  const diffTiempo = Math.abs(fin - inicio);
  const diasTotalesTrabajados = Math.ceil(diffTiempo / (1000 * 60 * 60 * 24));
  const anosCompletos = Math.floor(diasTotalesTrabajados / 365);

  // 1. Aguinaldo Proporcional
  const inicioAno = new Date(fin.getFullYear(), 0, 1);
  const fechaInicioConteo = inicio > inicioAno ? inicio : inicioAno;
  const diasTrabajadosAnoActual = Math.ceil((fin - fechaInicioConteo) / (1000 * 60 * 60 * 24)) + 1;
  const aguinaldoProporcional = (diasAguinaldo / 365) * diasTrabajadosAnoActual * salarioDiario;

  // 2. Vacaciones Dignas Proporcionales
  const diasVacacionesAno = obtenerDiasVacaciones(anosCompletos + 1);
  const fechaUltimoAniversario = new Date(inicio);
  fechaUltimoAniversario.setFullYear(inicio.getFullYear() + anosCompletos);
  const diasTranscurridosAnioActual = Math.ceil((fin - fechaUltimoAniversario) / (1000 * 60 * 60 * 24));
  const vacacionesProporcionales = (diasVacacionesAno / 365) * diasTranscurridosAnioActual * salarioDiario;

  // 3. Prima Vacacional
  const primaVacacional = vacacionesProporcionales * primaVacPct;

  let totalFiniquito = aguinaldoProporcional + vacacionesProporcionales + primaVacacional;
  let indemnizacionConstitucional = 0;
  let primaAntiguedad = 0;

  // 4. Liquidación por Despido
  if (tipoBaja === 'despido') {
    const factorIntegracion = 1 + (diasAguinaldo / 365) + ((diasVacacionesAno * primaVacPct) / 365);
    const sdi = salarioDiario * factorIntegracion;

    indemnizacionConstitucional = 90 * sdi;
    const topeUMA = 2 * mxConfig.uma_daily_2026;
    const baseCalculoPrima = Math.min(salarioDiario, topeUMA);
    primaAntiguedad = 12 * (diasTotalesTrabajados / 365) * baseCalculoPrima;
  }

  return {
    aguinaldoProporcional: aguinaldoProporcional.toFixed(2),
    vacacionesProporcionales: vacacionesProporcionales.toFixed(2),
    primaVacacional: primaVacacional.toFixed(2),
    indemnizacionConstitucional: indemnizacionConstitucional.toFixed(2),
    primaAntiguedad: primaAntiguedad.toFixed(2),
    totalGeneral: (totalFiniquito + indemnizacionConstitucional + primaAntiguedad).toFixed(2)
  };
}

function obtenerDiasVacaciones(anos) {
  if (anos <= 1) return 12;
  if (anos === 2) return 14;
  if (anos === 3) return 16;
  if (anos === 4) return 18;
  if (anos === 5) return 20;
  if (anos >= 6 && anos <= 10) return 22;
  if (anos >= 11 && anos <= 15) return 24;
  if (anos >= 16 && anos <= 20) return 26;
  if (anos >= 21 && anos <= 25) return 28;
  return 30;
}
