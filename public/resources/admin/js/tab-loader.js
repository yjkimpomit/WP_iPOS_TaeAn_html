/* ---------------------------------
   탭 콘텐츠 로드 함수
--------------------------------- */

async function loadTabPage(page, pane) {

	if (!page || !pane || pane.dataset.loaded) return;

	try {

		const res = await fetch(page);

		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}

		const html = await res.text();

		pane.innerHTML = html;
		pane.dataset.loaded = "true";

		// 로그시트 처리
		//setLogsheetCells(pane);

		// 하위 탭이 있으면 다시 초기화
		initTabs(pane);

	} catch (err) {

		console.error("tab load error:", page, err);

	}

}

/* ---------------------------------
   탭 초기화 (scope 기반)
--------------------------------- */

async function initTabs(scope = document) {

	const tabGroups = scope.querySelectorAll(".data-tab");

	for (const tabGroup of tabGroups) {

		const activeTab = tabGroup.querySelector(".nav-link.active");
		if (!activeTab) continue;

		const page = activeTab.getAttribute("data-page");
		const target = activeTab.getAttribute("data-bs-target");

		const tabContainer = activeTab.closest(".admin-content");
		if (!tabContainer) continue;

		const pane = tabContainer.querySelector(target);
		if (!pane) continue;

		await loadTabPage(page, pane);

	}

}


/* ---------------------------------
   초기 페이지 로드
--------------------------------- */

document.addEventListener("DOMContentLoaded", function () {

	initTabs();

});


/* ---------------------------------
   탭 변경 시 콘텐츠 로딩
--------------------------------- */

document.addEventListener("shown.bs.tab", async function (e) {

	const tab = e.target;

	const page = tab.getAttribute("data-page");
	const target = tab.getAttribute("data-bs-target");

	const tabContainer = tab.closest(".admin-content");
	if (!tabContainer) return;

	const pane = tabContainer.querySelector(target);
	if (!pane) return;

	await loadTabPage(page, pane);

});


function setLogsheetCells(container){

	const cells = container.querySelectorAll('td:has(input)');

	cells.forEach(function (td, index) {
		
		const prefix = container.id || 'LS';
		const id = prefix + '_A' + (index + 1);

		// td id
		td.id = id;

		const input = td.querySelector('input');

		if(input){

			const inputId = id + '_input';
			input.id = inputId;

			// label 생성
			let label = td.querySelector('label');

			if(!label){
				label = document.createElement('label');
				td.prepend(label);
			}

			label.setAttribute('for', inputId);
			label.id = id + '_label';
			label.className = 'visually-hidden';
			label.textContent = id;

		}

	});

}