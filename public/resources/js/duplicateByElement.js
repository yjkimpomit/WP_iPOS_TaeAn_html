// 특정 테이블을 대상으로 지정한 수만큼 행을 복제하는 함수
function duplicateByElement(copyElement, numCopies = 10) {
	if (!copyElement) {
		console.warn("복제할 요소가 없습니다.");
		return;
	}

	const parent = copyElement.parentElement;
	if (!parent) {
		console.warn("상위 부모요소를 찾을 수 없습니다.");
		return;
	}

	for (let i = 1; i < numCopies; i++) {
		const cloned = copyElement.cloneNode(true);
		parent.appendChild(cloned);
	}

	console.log(`${numCopies}개의 요소가 복제되었습니다.`);
}

/* 활용예

	<script src="/resources/js/duplicateByElement.js"></script>
	<script>
		const targetRow = document.querySelector('.table[aria-label="종합현황-일별조회결과"] tbody');
		duplicateByElement(targetRow, 10);
	</script>
*/
