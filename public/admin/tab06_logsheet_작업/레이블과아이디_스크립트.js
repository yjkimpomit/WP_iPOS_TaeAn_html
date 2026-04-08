//크롬 콘솔에서 바로 적용가능한 스크립트 : 테이블에 id  및 data-unit(9, 10) 생성 

(function () {
  const BASE_PREFIX = 'BO';

  const tables = document.querySelectorAll('table');

  tables.forEach((table, tableIndex) => {
    const PREFIX = `${BASE_PREFIX}${tableIndex + 1}`;

    const inputs = table.querySelectorAll('input.form-control');

    inputs.forEach((input, index) => {
      const num = index + 1;

      let base = input.name || num;
      base = base.toString().replace(/\s+/g, '_').toLowerCase();

      // 🔹 id는 순수 식별용
      const id = `${PREFIX}_${base || num}`;
      input.id = id;

      // 🔹 설비 구분은 data 속성으로
      const unit = index % 2 === 0 ? '9' : '10';
      input.dataset.unit = unit;

      let label =
        table.querySelector(`label[for="${id}"]`) ||
        input.closest('label');

      if (!label) {
        label = document.createElement('label');
        label.setAttribute('for', id);
        label.className = 'visually-hidden';
        label.textContent = input.name || `Label ${num}`;
        input.parentNode.insertBefore(label, input);
      } else {
        label.classList.add('form-label');
      }
    });
  });
})();