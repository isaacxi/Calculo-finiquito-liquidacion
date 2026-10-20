// js/app.js
import { calcularLFT } from './engines/mxCalculator.js';

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  const form = document.getElementById('calcForm');
  const resultCard = document.getElementById('resultCard');
  const placeholderCard = document.getElementById('placeholderCard');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');

  const currencyFormatter = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    try {
      const salarioInput = parseFloat(document.getElementById('salario').value);
      const frecuencia = document.getElementById('frecuencia').value;
      const fechaIngreso = document.getElementById('fechaIngreso').value;
      const fechaSalida = document.getElementById('fechaSalida').value;
      const tipoBaja = document.getElementById('tipoBaja').value;
      const diasVacacionesPendientes = parseFloat(document.getElementById('diasVacacionesPendientes').value) || 0;
      const zonaSalarioMinimo = document.getElementById('zonaSalarioMinimo').value;

      // Normalizar a salario diario
      let salarioDiario = salarioInput;
      if (frecuencia === 'mensual') salarioDiario = salarioInput / 30;
      if (frecuencia === 'quincenal') salarioDiario = salarioInput / 15;

      // Invocar motor independiente
      const res = calcularLFT({
        salarioDiario,
        fechaIngreso,
        fechaSalida,
        tipoBaja,
        diasVacacionesPendientes,
        zonaSalarioMinimo,
      });

      // Renderizar valores con formato monetario
      document.getElementById('montoTotal').textContent = currencyFormatter.format(res.totalEstimado);
      document.getElementById('resAguinaldo').textContent = currencyFormatter.format(res.aguinaldoProporcional);
      document.getElementById('resVacaciones').textContent = currencyFormatter.format(res.pagoVacaciones);
      document.getElementById('resPrimaVac').textContent = currencyFormatter.format(res.primaVacacional);

      const seccionLiq = document.getElementById('seccionLiquidacion');
      if (tipoBaja === 'despido_injustificado') {
        document.getElementById('resIndemnizacion').textContent = currencyFormatter.format(res.indemnizacionConstitucional);
        document.getElementById('resPrimaAntiguedad').textContent = currencyFormatter.format(res.primaAntiguedad);
        seccionLiq.classList.remove('hidden');
      } else {
        seccionLiq.classList.add('hidden');
      }

      placeholderCard.classList.add('hidden');
      resultCard.classList.remove('hidden');

    } catch (error) {
      alert(`Error en los datos de entrada: ${error.message}`);
    }
  });

  downloadPdfBtn.addEventListener('click', () => {
    const element = document.getElementById('pdfContent');
    const opt = {
      margin: 0.5,
      filename: 'Resumen_Finiquito_MX.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
    };
    html2pdf().set(opt).from(element).save();
  });
});
