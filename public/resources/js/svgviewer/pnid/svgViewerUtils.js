(function() {
 	
 	const NAV_HISTORY_LIMIT = 10;
 	const DRAG_SUPPRESS_MS = 250;
 	const DRAG_THRESHOLD = 5; // px 단위, 이 이상 움직이면 "드래그"로 간주
	
	let isDragging = false;
	let isPinching = false;
	let lastPinchAt = 0;
	let lastDragAt = 0;  
	
	let LAST_SELECTED_NODE = null;
	let CURRENT_DATA_PATH = null;  // 예: "/drawing/pnid/10-11600-UM-105-001.svg"
	let CURRENT_SEARCH_TAG = "";    // 예: "10-11610-J-MS-MV-05B"
	let PENDING_GRID_ANCHOR = "";   // 예: "(B-5)" 또는 "B-5"
	let PENDING_FROM_MOVE = false; // movepage로 넘어온 건지 구분
	let PENDING_GRID_ONLY = false; // drawing_tag_no가 비어있을 때만 true

	
	function extractGridAnchorFromId(clickedId) {
		if (!clickedId) return "";
		const m = clickedId.match(/\([A-Z]\s*-\s*\d+\)/i); // "(B-5)"
		return m ? m[0].toUpperCase().replace(/\s+/g, "") : ""; // "(B-5)"
	}

	function parseGridAnchor(grid) {
		if (!grid) return null;
		const m = grid.match(/\(?([A-Z])\s*-\s*(\d+)\)?/i);
		if (!m) return null;
		return { row: m[1].toUpperCase(), col: m[2] };
	}

	function isGridAnchor(str) {
		return !!parseGridAnchor(str);
	}

	function svgPointToClient(svgRoot, x, y) {
		const pt = svgRoot.createSVGPoint();
		pt.x = x;
		pt.y = y;
	
		const m = svgRoot.getScreenCTM();
		if (!m) return { x, y };

		const res = pt.matrixTransform(m);
		return { x: res.x, y: res.y };
	}
	function getTextCenterInSvgCoords(textEl, svgRoot) {
	  const bbox = textEl.getBBox();
	
	  const pt = svgRoot.createSVGPoint();
	  pt.x = bbox.x + bbox.width / 2;
	  pt.y = bbox.y + bbox.height / 2;
	
	  const ctm = textEl.getCTM();
	  if (!ctm) return null;
	
	  const res = pt.matrixTransform(ctm);
	  return { x: res.x, y: res.y };
	}
	function buildBorderGridIndex(svgDoc) {
		const svgRoot = svgDoc.documentElement;
		if (!svgRoot) return null;

		const vb = svgRoot.viewBox.baseVal;
		const vbX = vb.x;
		const vbY = vb.y;
		const vbW = vb.width;
		const vbH = vb.height;

		// 테두리 판단 영역 (도면마다 튜닝 가능)
		const topY = vbY + vbH * 0.08;
		const bottomY = vbY + vbH * 0.92;
		const leftX = vbX + vbW * 0.08;
		const rightX = vbX + vbW * 0.92;

		const texts = Array.from(svgDoc.querySelectorAll("text"));

		const colMap = new Map(); // 숫자 → x[]
		const rowMap = new Map(); // 문자 → y[]

		for (const t of texts) {
			const v = (t.textContent || "").trim();
			if (!v) continue;

			const p = getTextCenterInSvgCoords(t, svgRoot);
			if (!p) continue;

			// 열 번호 (1,2,3...) → 상/하단
			if (/^\d{1,2}$/.test(v)) {
				if (p.y <= topY || p.y >= bottomY) {
					if (!colMap.has(v)) colMap.set(v, []);
					colMap.get(v).push(p.x);
				}
			}

			// 행 문자 (A,B,C...) → 좌/우
			else if (/^[A-Z]$/.test(v)) {
				if (p.x <= leftX || p.x >= rightX) {
					if (!rowMap.has(v)) rowMap.set(v, []);
					rowMap.get(v).push(p.y);
				}
			}
		}

		function median(arr) {
			const a = arr.slice().sort((x, y) => x - y);
			const m = Math.floor(a.length / 2);
			return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
		}

		const colLookup = new Map();
		for (const [k, xs] of colMap.entries()) colLookup.set(k, median(xs));

		const rowLookup = new Map();
		for (const [k, ys] of rowMap.entries()) rowLookup.set(k, median(ys));

		return { colLookup, rowLookup };
	}

	function zoomToGridAnchor(gridStr, svgDoc, svgElement, panZoom) {
		const parsed = parseGridAnchor(gridStr);
		if (!parsed) return false;

		const svgRoot = svgDoc.documentElement;
		if (!svgRoot) return false;

		const grid = buildBorderGridIndex(svgDoc);
		if (!grid) return false;

		const x = grid.colLookup.get(parsed.col);
		const y = grid.rowLookup.get(parsed.row);

		if (x == null || y == null) {
			console.warn("[grid] not found:", parsed, grid);
			return false;
		}

		// 기존 너 코드 흐름 유지
		safeViewReset(panZoom, svgElement);

		requestAnimationFrame(() => {
			const pt = svgPointToClient(svgRoot, x, y);

			try {
				panZoom.zoomAtPoint(3.0, pt); // 🔧 확대율 튜닝 가능
			} catch (e) {
				console.error("[grid] zoomAtPoint error:", e);
			}
		});

		return true;
	}

	// 도면이동 네비게이션 히스토리 리셋 함수 : url 접근 +searchTag 존재 하는 경우 
	function shouldResetNavHistory() {

		const params = new URLSearchParams(window.location.search);

		const searchTag = params.get("searchTag");

		return searchTag !== null && searchTag.trim() !== "";
	}

	// 도면이동 네비게이션 갯수 셋팅
	function updatePnidHistoryCount() {
		const list = document.getElementById("navHistoryList");
		const countSpan = document.getElementById("pnidHistoryCount");

		if (!list || !countSpan) return;

		const count = list.children.length;
		countSpan.textContent = ` \u00A0(${count})`;
	}

	// 세션에서 히스토리 읽기
	function loadNavHistory() {
		try {
			const raw = sessionStorage.getItem(NAV_HISTORY_KEY);
			if (!raw) return [];
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch (e) {
			console.warn("[navHistory] load 실패:", e);
			return [];
		}
	}
	// 세션에 히스토리 저장
	function saveNavHistory(list) {
		try {
			sessionStorage.setItem(NAV_HISTORY_KEY, JSON.stringify(list));
		} catch (e) {
			console.warn("[navHistory] save 실패:", e);
		}
	}
	// 네비게이션 바에 히스토리 렌더링
	function renderNavHistory(history) {

		const listEl = document.getElementById("navHistoryList");
		const boxEl = document.querySelector(".pnid-history-box"); // 네비 전체 박스

		if (!listEl || !boxEl) return;

		//먼저 기존 목록 비우기 (중복 렌더 방지)
		listEl.innerHTML = "";

		// 히스토리 없으면 UI 자체 숨김
		if (!history || history.length === 0) {
			boxEl.style.display = "none";
			return;
		}

		boxEl.style.display = "block";

		history.forEach((item, index) => {

			const historylist = document.createElement("li");

			const historyAttr = document.createElement("a");

			let targetFile = item.targetFile.split(".").shift();

			historyAttr.href = item.nextUrl;
			historyAttr.style.whiteSpace = "pre-line";
			historyAttr.dataset.index = index;
			historyAttr.textContent = item.searchTag
				? `${targetFile} → ${item.searchTag}`
				: item.targetFile;


			historyAttr.addEventListener("click", function(e) {

				e.preventDefault();  // a.href 로 페이지 이동 막기

				const idx = Number(this.dataset.index);

				try {
					// item.nextUrl 예: "/multiview/pnid.do?dataPath=...&searchTag=..."
					const urlObj = new URL(item.nextUrl, window.location.origin);
					const dataPath = urlObj.searchParams.get("dataPath");
					const searchTag = urlObj.searchParams.get("searchTag") || "";

					if (!dataPath) {
						console.warn("[navHistory] dataPath 없음, 이동 불가:", item);
						return;
					}

					let currentHistory = loadNavHistory()
					currentHistory = history.slice(idx);
					saveNavHistory(currentHistory);      // 세션에 반영
					renderNavHistory(currentHistory);    // 화면도 다시 그림
					createAndLoadSVG(dataPath, searchTag);


				} catch (err) {
					console.error("[navHistory] URL 파싱 실패, fallback 으로 전체 이동:", err);

					// 혹시나 파싱에 실패하면 마지막 보루로 그냥 페이지 이동
					window.location.href = item.nextUrl;
				}
			});

			/* li.appendChild(a);
			 listEl.appendChild(li);*/
			historylist.prepend(historyAttr);
			listEl.prepend(historylist);
		});
		updatePnidHistoryCount();
	}

	// 히스토리 배열에 항목 추가
	function addNavHistoryEntry(nextUrl, targetFile, searchTag) {

		let history = loadNavHistory();

		// 같은 href는 제거
		/*history = history.filter(item => item.nextUrl !== nextUrl);*/

		// 맨 앞에 새 항목 추가
		history.unshift({
			nextUrl,
			targetFile,
			searchTag: searchTag || null,
		});

		// 최대 개수 제한
		if (history.length > NAV_HISTORY_LIMIT) {
			history = history.slice(0, NAV_HISTORY_LIMIT);
		}

		saveNavHistory(history);

		renderNavHistory(history);   // 화면도 업데이트
	}

	//  중심 거리(distance)에 따라 보정 강도(Exponent)를 계산하는 함수
	//  화면 중심과 가까울수록 보정 강도(지수)를 작게 설정하여 미세 조정
	//  화면 중심에서 멀어질수록 보정 강도(지수)를 크게 설정하여 이동량을 더 크게 함
	function computeEXP(distance, minDist, maxDist, minEXP = 2.0, maxEXP = 3.3) {
		if (distance <= minDist) return minEXP;
		if (distance >= maxDist) return maxEXP;
		return minEXP + (maxEXP - minEXP) * ((distance - minDist) / (maxDist - minDist));
	}

	function calculateFixedCenter(element, svgElement, svgDoc, containerId = 'svgarea') {

		// SVG 요소가 유효하지 않으면 오류 출력 후 종료
		if (!element) {
			/*  console.error("Element is not defined");*/
			return;
		}
		// 대상 요소의 bounding box (크기 및 위치 정보)를 가져옴
		const bbox = element.getBBox();

		// 요소가 현재 화면에서 어떻게 보이는지 계산하기 위한 좌표 변환 행렬
		const screenCTM = element.getScreenCTM();

		// 요소의 중심 좌표 (화면 기준)를 계산
		const centerX = (bbox.x + bbox.width / 2) * screenCTM.a + screenCTM.e;
		const centerY = (bbox.y + bbox.height / 2) * screenCTM.d + screenCTM.f;

		// SVG 요소의 실제 표시 영역 크기를 계산
		const viewWidth = svgElement.clientWidth || svgElement.getBoundingClientRect().width;
		const viewHeight = svgElement.clientHeight || svgElement.getBoundingClientRect().height;

		// SVG를 감싸고 있는 영역 (iframe 포함 wrapper) 요소
		const svgArea = document.getElementById(containerId);

		// iframe 기준 가시 영역의 폭과 높이
		const iframeWidth = svgArea.clientWidth;
		const iframeHeight = svgArea.clientHeight;

		// 확대 비율 계산: 현재 요소가 영역에 맞게 보여질 수 있는 최대 배율 중 하나 선택
		const zoomScale = Math.min(
			Math.min(viewWidth / bbox.width, viewHeight / bbox.height) * 0.5,
			10.0 // 최대 확대 제한
		);

		// 확대 상태에서 중심을 화면 가운데로 이동시키기 위한 보정 거리
		const deltaX = (iframeWidth / 2 - centerX) / zoomScale;
		const deltaY = (iframeHeight / 2 - centerY) / zoomScale;

		// 화면 중심 좌표 계산 (기준 좌표)
		const screenCenterX = iframeWidth / 2;
		const screenCenterY = iframeHeight / 2;

		// 현재 중심과 화면 중심 사이의 거리
		const distanceX = Math.abs(centerX - screenCenterX);
		const distanceY = Math.abs(centerY - screenCenterY);

		// 화면 비율에 따른 x/y 방향 보정 비율 계산 (줌에 따라 조정)
		const aspectRatioX = iframeWidth / (iframeWidth + iframeHeight) * zoomScale;
		const aspectRatioY = iframeHeight / (iframeWidth + iframeHeight) * zoomScale;

		// 중심 거리 대비 보정 계수 계산을 위한 지수(Exponent)
		const EXP_X = computeEXP(distanceX, 0, screenCenterX);
		const EXP_Y = computeEXP(distanceY, 0, screenCenterY);

		// x/y 방향 보정값 계산 (줌과 비율 기반)
		const baseOffsetX = aspectRatioX * Math.pow(zoomScale, EXP_X) * 0.001;
		const baseOffsetY = aspectRatioY * Math.pow(zoomScale, EXP_Y) * 0.001;

		// 중심 위치에 따라 보정 방향 결정 (왼쪽/오른쪽, 위/아래)
		const offsetX = (centerX < screenCenterX) ? -baseOffsetX : baseOffsetX;
		const offsetY = (centerY < screenCenterY) ? -baseOffsetY : baseOffsetY;

		// 보정된 중심 좌표 계산 (줌 이동 시 실제로 이동할 좌표)
		const fixedCenterX = centerX - deltaX + offsetX;
		const fixedCenterY = centerY - deltaY + offsetY;

		// 결과 반환: 보정 중심, 원래 중심, 박스 정보, 줌 배율 포함
		return { fixedCenterX, fixedCenterY, centerX, centerY, bbox, zoomScale };
	}
	// 숫자 유효성 체크 헬퍼
	function isFiniteNumber(v) {
		return typeof v === "number" && isFinite(v);
	}
	// 요소를 강조하고 확대하여 해당 요소로 이동하는 함수
	function highlightAndZoomToElement(
		element,
		svgDoc,
		svgElement,
		panZoom,
		safeViewReset,
		calculateFixedCenterFn
	) {
		if (!element || !panZoom || !svgElement) return;

		// 뷰어가 최소화되어 width/height 가 0이면 아예 처리 안 함
		const rect = svgElement.getBoundingClientRect();
		if (!rect.width || !rect.height) {
			console.warn("[highlightAndZoomToElement] viewer size is 0, skip zoom");
			return;
		}

		// 뷰어 리셋 (이 안에서 또 한 번 size 체크 해 두면 더 안전)
		safeViewReset(panZoom, svgElement);

		// 리셋 이후 레이아웃 반영된 뒤에 중심/줌 계산
		requestAnimationFrame(() => {

			const result = calculateFixedCenterFn(element, svgElement, svgDoc);
			if (!result) return;

			const { fixedCenterX, fixedCenterY, zoomScale } = result;

			//  NaN / Infinity / 비정상 값 방어
			if (
				!isFiniteNumber(fixedCenterX) ||
				!isFiniteNumber(fixedCenterY) ||
				!isFiniteNumber(zoomScale) ||
				zoomScale <= 0
			) {
				console.warn("[highlightAndZoomToElement] invalid center or zoomScale, skip:", {
					fixedCenterX,
					fixedCenterY,
					zoomScale
				});
				return;
			}

			try {
				panZoom.zoomAtPoint(zoomScale, { x: fixedCenterX, y: fixedCenterY });
			} catch (e) {
				console.error("[highlightAndZoomToElement] zoomAtPoint error:", e);
			}
		});
	}
	// 같은 g id 를 가진 여러 텍스트를 "중간 좌표 + 여러 개 보이는 정도"로 줌하는 헬퍼
	function highlightAndZoomSameIdGroup(clickedGroup, svgDoc, svgElement, panZoom, safeViewReset, calculateFixedCenterFn) {

		if (!clickedGroup) return;

		const gId = clickedGroup.getAttribute("id");
		if (!gId) {
			// id 없으면 그냥 기존 동작
			highlightAndZoomToElement(clickedGroup, svgDoc, svgElement, panZoom, safeViewReset, calculateFixedCenterFn);
			return;
		}

		// 같은 id 를 가진 g 들
		const sameGroups = svgDoc.querySelectorAll(`g[id="${CSS.escape(gId)}"]`);
		if (!sameGroups || sameGroups.length === 0) {
			highlightAndZoomToElement(clickedGroup, svgDoc, svgElement, panZoom, safeViewReset, calculateFixedCenterFn);
			return;
		}

		// g 안의 text 노드들만 모음
		const textNodes = [];
		sameGroups.forEach(g => {
			g.querySelectorAll("text").forEach(t => textNodes.push(t));
		});

		// 텍스트가 1개 이하이면 기존 단일 요소 로직 그대로 사용
		if (textNodes.length <= 1) {
			highlightAndZoomToElement(clickedGroup, svgDoc, svgElement, panZoom, safeViewReset, calculateFixedCenterFn);
			return;
		}

		// === 여기부터 "복수 텍스트"용 로직 ===
		const centers = [];
		const zoomScales = [];

		textNodes.forEach(t => {
			try {
				const { fixedCenterX, fixedCenterY, zoomScale } = calculateFixedCenterFn(t, svgElement, svgDoc);
				if (
					typeof fixedCenterX === "number" &&
					typeof fixedCenterY === "number" &&
					typeof zoomScale === "number"
				) {
					centers.push({ x: fixedCenterX, y: fixedCenterY });
					zoomScales.push(zoomScale);
				}
			} catch (e) {
				console.warn("calculateFixedCenterFn 실패:", e);
			}
		});

		if (centers.length === 0 || zoomScales.length === 0) {
			// 계산 실패 시 기존 fallback
			highlightAndZoomToElement(clickedGroup, svgDoc, svgElement, panZoom, safeViewReset, calculateFixedCenterFn);
			return;
		}

		// 여러 텍스트의 "중간 좌표" = fixedCenter 의 평균
		const avgCenter = centers.reduce(
			(acc, c) => {
				acc.x += c.x;
				acc.y += c.y;
				return acc;
			},
			{ x: 0, y: 0 }
		);
		avgCenter.x /= centers.length;
		avgCenter.y /= centers.length;

		// 각 텍스트 기준 zoomScale 은 "그 텍스트 하나만 보기 좋게" 맞춘 값.
		// 여러 개를 한 번에 보이게 하려면 그보다 조금 더 멀리(=더 작게) 보는 게 좋음.
		const maxZoom = Math.max(...zoomScales); // 가장 많이 줌인되는 값
		const minZoom = Math.min(...zoomScales); // 가장 멀리 있는 값

		// 둘 다 어느 정도 보이도록 "중간치" 줌에서 살~짝 줄여줌
		// (너무 민감하면 factor 를 0.6~0.9 사이로 조정)
		const baseZoom = (maxZoom + minZoom) / 2;
		const zoomScale = baseZoom * 0.5; // ← 여기 숫자(0.8)로 확대 정도 튜닝 가능

		// 기존 highlightAndZoomToElement 의 흐름과 동일:
		// 1) viewReset
		// 2) setTimeout 뒤에 zoomAtPoint
		safeViewReset(panZoom, svgElement);

		requestAnimationFrame(() => {
			const result = calculateFixedCenterFn(clickedGroup, svgElement, svgDoc);
			if (!result) return;

			const { fixedCenterX, fixedCenterY, zoomScale } = result;

			//  NaN / Infinity / 비정상 값 방어
			if (
				!isFiniteNumber(fixedCenterX) ||
				!isFiniteNumber(fixedCenterY) ||
				!isFiniteNumber(zoomScale) ||
				zoomScale <= 0
			) {
				console.warn("[highlightAndZoomToElement] invalid center or zoomScale, skip:", {
					fixedCenterX,
					fixedCenterY,
					zoomScale
				});
				return;
			}

			try {
				panZoom.zoomAtPoint(zoomScale, { x: fixedCenterX, y: fixedCenterY });
			} catch (e) {
				console.error("[highlightAndZoomToElement] zoomAtPoint error:", e);
			}
		});
	}
	function isElementVisible(el) {
		if (!el) return false;
		const style = window.getComputedStyle(el);
		if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
			return false;
		}
		const rect = el.getBoundingClientRect();
		return !!(rect.width && rect.height);
	}

	function safeViewReset(panZoom, svgElement) {
		if (!panZoom || !svgElement) return;

		const rect = svgElement.getBoundingClientRect();
		//뷰어가 0x0 이면 reset/fit/center 하지 않음
		if (!rect.width || !rect.height) {
			console.warn("[safeViewReset] viewer size is 0, skip reset");
			return;
		}

		try {
			panZoom.resize();
			panZoom.fit();
			panZoom.center();
		} catch (e) {
			console.error("[safeViewReset] error during reset:", e);
		}
	}

	function getRealZoom(panZoomInstance) {
		const transform = panZoomInstance.getTransform();
		return transform.scale;
	}

	function parseViewBox(svgEl) {
		const vb = svgEl.getAttribute("viewBox");
		if (!vb) return { x: 0, y: 0 };
		const [x, y] = vb.split(/\s+|,/).map(parseFloat);
		return { x, y };
	}

	function onResize_vent(svgDoc, svgns, panZoom, rebbox, revnet_id) {


		if (revnet_id != null) {

			var outline = svgDoc.createElementNS(svgns, 'rect');
			outline.setAttributeNS(null, 'x', rebbox.x - 2);
			outline.setAttributeNS(null, 'y', rebbox.y - 2);
			if (rebbox.width <= 75 && rebbox.width > 60) {
				outline.setAttributeNS(null, 'width', rebbox.width - 45);
			}
			else {
				outline.setAttributeNS(null, 'width', rebbox.width + 4);
			}
			outline.setAttributeNS(null, 'height', rebbox.height + 4);
			//revnet_id.parentNode.insertBefore(outline, revnet_id);

			var bboxWidth = rebbox.width;

			//bbox width will distinguish zoom level
			if (bboxWidth < 75)
				panZoom.zoom(10);
			else {
				panZoom.zoom(5);
			}

			//init first translate value 0
			panZoom.pan({
				x: 0,
				y: 0
			})

			//get zoom value and element to center
			var realZoom = panZoom.getSizes().realZoom;

			panZoom.pan({
				x: -(outline.x.baseVal.value * realZoom) + (panZoom.getSizes().width / 2) - ((outline.width.baseVal.value * realZoom) / 2),
				y: -(outline.y.baseVal.value * realZoom) + (panZoom.getSizes().height / 2) - ((outline.height.baseVal.value * realZoom) / 2)
			})
		}
	}

	function highlightText(groupNode) {
		const text = groupNode.childNodes[1];
		if (text) {
			text.setAttribute("stroke", "#a52bff");
			text.setAttribute("stroke-width", "0.05px");
		}
	}

	// vnet 타입의 경우, 클릭한 요소를 강조하고 확대하여 해당 요소로 이동하는 함수
	function panToCenter(panZoom, rx, ry, rw, rh) {
		const realZoom = panZoom.getSizes().realZoom;

		const panX = -(rx * realZoom) + (panZoom.getSizes().width / 2) - ((rw * realZoom) / 2);
		const panY = -(ry * realZoom) + (panZoom.getSizes().height / 2) - ((rh * realZoom) / 2);

		panZoom.pan({ x: 0, y: 0 }); // 초기화
		panZoom.pan({ x: panX, y: panY }); // 이동
	}

	// zoom 레벨을 결정하는 함수 ( 기준점 셋팅 )
	function determineZoomLevel(panZoom, bbox) {
		if (bbox.width < 75 && bbox.height < 100) {
			panZoom.zoom(10);
		} else {
			panZoom.zoom(5);
		}
	}
	// outline rect를 생성하는 함수 
	function createOutlineRect(svgDoc, svgns, bbox, selectedId) {
		const outline = svgDoc.createElementNS(svgns, 'rect');
		outline.setAttributeNS(null, 'x', bbox.x - 2);
		outline.setAttributeNS(null, 'y', bbox.y - 2);

		const width = (bbox.width <= 75 && bbox.width > 60)
			? bbox.width - 45
			: bbox.width + 4;

		outline.setAttributeNS(null, 'width', width);
		outline.setAttributeNS(null, 'height', bbox.height + 4);
		outline.setAttributeNS(null, 'id', selectedId);

		return outline;
	}
	// 파일 리더 함수 - 미사용 
	function setupFileInputHandler() {

		const svgFileInput = document.getElementById("svgFileInput")

		svgFileInput.addEventListener("change", function(e) {

			const file = e.target.files[0];
			const reader = new FileReader();
			const selectedType = document.querySelector('input[name="svgType"]:checked').value;

			if (!file || !file.name.endsWith(".svg")) {
				alert("SVG 파일만 가능합니다.");
				return;
			}

			reader.onload = function(event) {
				const svgText = event.target.result;
				if (svgText.includes("<pmt:id")) ckType = "pnid";
				else { alert("형식이 올바르지 않습니다."); return; }

				if (ckType && ckType !== selectedType) {
					alert("SVG 파일 형식 확인 후 다시 선택해주세요.");
					document.getElementById('svgFileInput').value = "";
					return;
				}

				const blob = new Blob([svgText], { type: "image/svg+xml" });
				const blobURL = URL.createObjectURL(blob);

				createAndLoadSVG(blobURL);
			};

			reader.readAsText(file);
		});
	}
	// SVG 파일 존재 여부 체크 (HEAD 요청)
	async function checkSvgExists(url) {
		try {
			const res = await fetch(url, { method: "HEAD" });
			return res.ok;                // 200, 304 등 → true
		} catch (e) {
			console.warn("checkSvgExists 실패:", e);
			return false;
		}
	}

	// URL 접근 시 파라미터로부터 SVG 또는 PDF 파일을 로드하는 함수
	async function initFromUrlParams() {

		const params = new URLSearchParams(window.location.search);
		const dataPath = params.get("dataPath");
		const searchTag = params.get("searchTag");

		if (!dataPath) return;
		
		console.log("dataPath : " +dataPath);

		// 파일 존재 여부 먼저 확인
		const exists = await checkSvgExists(dataPath);

		 if (!exists) {
		    $.alert({
		      icon: 'bi bi-exclamation-triangle',
		      title: 'P&ID',
		      content: '해당 파일이 존재하지 않습니다.',
		      animation: 'scale',
		      type: 'red'
		    });
		    return;
		  }
		console.log("dataPath , searchTag" , searchTag)
		createAndLoadSVG(dataPath, searchTag);
	}


	// P&ID 도면 이동 작동 함수 (movepage)
	function handleMovePage(movepageAttr) {

		const decoded = movepageAttr.replace(/&quot;/g, '"');

		let moveData;

		try {
			moveData = JSON.parse(decoded);
		} catch (e) {
			console.warn("movepage JSON 파싱 실패:", decoded);
			return;
		}

		const targetFileMove = (moveData.drawing_file || "").trim();
		let searchTagMove = (moveData.drawing_tag_no || "").trim();
		
		// 이동할 SVG 경로
		const nextDataPath = "/drawing/pnid/" + targetFileMove;
		
		console.log("[movepage] nextDataPath =", nextDataPath);
		
		checkSvgExists(nextDataPath).then(ok => console.log("[movepage] exists?", ok));

		if (!targetFileMove) return;

		PENDING_GRID_ONLY = !searchTagMove;
		
		if (PENDING_GRID_ONLY) {
		    // 클릭한 ID에서 뽑은 그리드 앵커 우선
		    searchTagMove = PENDING_GRID_ANCHOR || extractGridAnchorFromId(CURRENT_SEARCH_TAG);
		  }
		PENDING_FROM_MOVE = true;
		
		if (CURRENT_DATA_PATH) {

			const prevUrl = `/multiview/pnid.do?dataPath=${encodeURIComponent(CURRENT_DATA_PATH)}&searchTag=${encodeURIComponent(CURRENT_SEARCH_TAG || "")}`;

			// 파일명만 추출 (디코딩 후 마지막 슬래시 뒤)
			const prevFileName = decodeURIComponent(CURRENT_DATA_PATH).split("/").pop();

			addNavHistoryEntry(prevUrl, prevFileName, CURRENT_SEARCH_TAG);

		}
		

		// 실제 도면만 교체
		createAndLoadSVG(nextDataPath, searchTagMove);

	}
	
	    function installDragGuard(targetEl) {
		  if (!targetEl || targetEl.__dragGuardBound) return;
		  targetEl.__dragGuardBound = true;
		
		  let start = null;
		
		  // pointer (마우스/안드로이드/일부 iOS)
		  targetEl.addEventListener("pointerdown", (e) => {
		    if (isPinching) return;
		    start = { x: e.clientX, y: e.clientY };
		    isDragging = false;
		  }, { capture: true });
		
		  targetEl.addEventListener("pointermove", (e) => {
		    if (!start || isPinching) return;
		    const dx = e.clientX - start.x;
		    const dy = e.clientY - start.y;
		    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
		      isDragging = true;
		    }
		  }, { capture: true });
		
		  targetEl.addEventListener("pointerup", () => {
		    if (isDragging) lastDragAt = Date.now();
		    start = null;
		    // 드래그 플래그는 잠깐 유지됐다가, 다음 제스처 시작에서 다시 false로 초기화됨
		  }, { capture: true });
		
		  targetEl.addEventListener("pointercancel", () => {
		    if (isDragging) lastDragAt = Date.now();
		    start = null;
		  }, { capture: true });
		  targetEl.addEventListener("mousedown", (e) => {
		    if (isPinching) return;
		    start = { x: e.clientX, y: e.clientY };
		    isDragging = false;
		  }, { capture: true });
		
		  targetEl.addEventListener("mousemove", (e) => {
		    if (!start || isPinching) return;
		    const dx = e.clientX - start.x;
		    const dy = e.clientY - start.y;
		    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
		      isDragging = true;
		    }
		  }, { capture: true });
		
		  targetEl.addEventListener("mouseup", () => {
		    if (isDragging) lastDragAt = Date.now();
		    start = null;
		  }, { capture: true });
		
		  targetEl.addEventListener("mouseleave", () => {
		    // 드래그 도중 밖으로 나가면 종료 처리
		    if (isDragging) lastDragAt = Date.now();
		    start = null;
		  }, { capture: true });
		  // touch (iOS 보완)
		  targetEl.addEventListener("touchstart", (e) => {
		    if (!e.touches || e.touches.length !== 1) return; // 1손가락만 드래그 체크
		    if (isPinching) return;
		    const t = e.touches[0];
		    start = { x: t.clientX, y: t.clientY };
		    isDragging = false;
		  }, { passive: true, capture: true });
		
		  targetEl.addEventListener("touchmove", (e) => {
		    if (!start || isPinching) return;
		    if (!e.touches || e.touches.length !== 1) return;
		    const t = e.touches[0];
		    const dx = t.clientX - start.x;
		    const dy = t.clientY - start.y;
		    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
		      isDragging = true;
		    }
		  }, { passive: true, capture: true });
		
		  targetEl.addEventListener("touchend", () => {
		    if (isDragging) lastDragAt = Date.now();
		    start = null;
		  }, { passive: true, capture: true });
		
		  targetEl.addEventListener("touchcancel", () => {
		    if (isDragging) lastDragAt = Date.now();
		    start = null;
		  }, { passive: true, capture: true });
		}

	// SVG 파일을 생성하고 로드하는 함수
	function createAndLoadSVG(path, searchTag) {

		CURRENT_DATA_PATH = path;
		CURRENT_SEARCH_TAG = searchTag || "";

		if (window.panZoom) {
			window.panZoom.destroy();
			window.panZoom = null;
		}

		const strDocNo = path.split(".")[0];
		const object = document.createElement("object");
		object.setAttribute("id", strDocNo);
		object.setAttribute("data", path);
		object.setAttribute("type", "image/svg+xml");
		object.setAttribute("preserveAspectRatio", "xMidYMid meet");
		object.style.width = "100%";
		object.style.height = "100%";
		object.style.display = "block";
		object.style.pointerEvents = "auto";


		object.addEventListener("load", function() {

			// 새 도면이 로드되면 중복 그룹 클릭 상태 리셋
			LAST_DUPLICATE_ZOOM_ID = null;

			svgDoc = object.contentDocument;
			svgElement = svgDoc.documentElement;
			
			installDragGuard(object);      
			installDragGuard(svgElement); 

			let globalStyle = svgDoc.querySelector('style[data-role="global-state-style"]');

			if (!globalStyle) {
				globalStyle = document.createElementNS(svgns, "style");
				globalStyle.setAttribute("data-role", "global-state-style");

				/* 20251212 yjkim - 컬러변경 */
				globalStyle.textContent = `
			        g[data-state="default"] text,
			        g[data-state="default"] tspan {
			            fill: #E50041;
						paint-order: stroke fill;
			            font-weight: bold;
			        }
					/* default - hover 스타일 */
					g[data-state="default"]:hover text,
					g[data-state="default"]:hover tspan {
					    stroke: #E50041;
						stroke-width: 0.3;
						stroke-opacity: 0.2;
						paint-order: stroke fill;
					}
					
					/* 타겟용 스타일 */
					g[data-state="selected"] text,
					g[data-state="selected"] tspan {
						fill: #3747C1;
						paint-order: stroke fill;
						font-weight: bold;
					}
					/* 타겟용 - hover 스타일 */
					g[data-state="selected"]:hover text,
					g[data-state="selected"]:hover tspan {
					    stroke: #3747C1;           
					    stroke-width: 0.3;
					    stroke-opacity: 0.2;
					    paint-order: stroke fill;
					}
					
					/* movepage 버튼용 스타일 */
					g[data-state="movepage"] text,
					g[data-state="movepage"] tspan {
						fill: #0F9B3A;
						paint-order: stroke fill;
						font-weight: bold;
					}
					/* movepage - hover 스타일 */
					g[data-state="movepage"]:hover text,
					g[data-state="movepage"]:hover tspan {
					stroke: #0F9B3A;
					stroke-width: 0.3;
					stroke-opacity: 0.2;
					paint-order: stroke fill;
				}
			    `;
				svgElement.insertBefore(globalStyle, svgElement.firstChild);
			}

			const textNodes = svgElement.querySelectorAll("text");

			window.tempTextNodes = textNodes;

			let svgType = svgDoc.getElementsByTagNameNS('*', 'id');

			const viewboxElements = svgDoc.querySelectorAll('[transform="scale(1,-1)"]');

			if (viewboxElements.length > 0) {

				ckType = "pnid";

			} else if (viewboxElements.length === 0) {

				ckType = "dataparc";
			}
			else {
				ckType = "dataparc";
			}

			panZoom = svgPanZoom(svgElement, {
				zoomEnabled: true,
				controlIconsEnabled: true,
				fit: true,
				center: true,
				minZoom: 1,
				maxZoom: 10,
				zoomScaleSensitivity: 0.7,  // 기본보다 작게 → 더 천천히 줌

				beforePan: function(oldPan, newPan) {

					const sizes = this.getSizes();

					// viewBox 정보 (x, y 에 음수 들어가는 것도 반영됨)
					const vb = sizes.viewBox;
					const realZoom = sizes.realZoom;

					// 실제 뷰어 크기 (svg-pan-zoom이 잡은 viewport)
					const viewportWidth = sizes.width;
					const viewportHeight = sizes.height;
					/*console.log("test: " + viewportWidth,viewportHeight)*/
					// 화면 밖으로 약간만 나가게 허용하고 싶을 때 여백
					const gutterX = 100;   // 좌우 여백 (px)
					const gutterY = 100;   // 상하 여백 (px)

					// ---- 좌우 한계 계산 ----
					// SVG 좌표(viewBox)를 화면 픽셀로 옮긴 후, 어느 지점까지 허용할지 계산
					const leftLimit = -((vb.x + vb.width) * realZoom) + gutterX;
					const rightLimit = (viewportWidth - gutterX) - (vb.x * realZoom);

					// ---- 상하 한계 계산 ----
					const topLimit = -((vb.y + vb.height) * realZoom) + gutterY;
					const bottomLimit = (viewportHeight - gutterY) - (vb.y * realZoom);

					// newPan.x / y 를 이 범위 안으로 클램프
					const limitedX = Math.max(leftLimit, Math.min(rightLimit, newPan.x));
					const limitedY = Math.max(topLimit, Math.min(bottomLimit, newPan.y));

					return { x: limitedX, y: limitedY };
				}
			});

			// =======================
			// "핀치 줌"
			// =======================
			(function attachPinchZoom() {
			  if (svgElement.__pinchBound) return;
			  svgElement.__pinchBound = true;
			
			  // iOS에서 중요: object에도 걸어줘야 이벤트가 잡히는 케이스가 있음
			  const targets = [svgElement, object];
			
			  try { svgElement.style.touchAction = "none"; } catch (e) {}
			  try { object.style.touchAction = "none"; } catch (e) {}
			
			  const MIN_ZOOM = 1;
			  const MAX_ZOOM = 10;
			
			  const DIST_DEADZONE_PX = 8;
			  const SCALE_DEADZONE = 0.01;
			
			  let pinching = false;
			  let startDist = 0;
			  let lastDist = 0;
			  let armed = false;
			
			  function dist(t1, t2) {
			    const dx = t1.clientX - t2.clientX;
			    const dy = t1.clientY - t2.clientY;
			    return Math.hypot(dx, dy);
			  }
			  function mid(t1, t2) {
			    return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
			  }
			  function clamp(v, min, max) {
			    return Math.max(min, Math.min(max, v));
			  }
			  function kill(e) {
			    e.preventDefault();
			    e.stopPropagation();
			    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
			  }
			
			  function onStart(e) {
			    if (!e.touches || e.touches.length < 2) return;
			
			    kill(e);
			
			    pinching = true;
			    armed = false;
			
			    startDist = dist(e.touches[0], e.touches[1]);
			    lastDist = startDist;
			
			    isPinching = true;
			    lastPinchAt = Date.now();
			  }
			
			  function onMove(e) {
			    if (!pinching || !e.touches || e.touches.length < 2) return;
			
			    kill(e);
			
			    const newDist = dist(e.touches[0], e.touches[1]);
			
			    if (!armed) {
			      const totalDelta = newDist - startDist;
			      if (Math.abs(totalDelta) < DIST_DEADZONE_PX) return;
			
			      armed = true;
			      lastDist = newDist;
			      return;
			    }
			
			    const scale = newDist / lastDist;
			    lastDist = newDist;
			
			    if (Math.abs(scale - 1) < SCALE_DEADZONE) return;
			
			    let nextZoom = panZoom.getZoom() * scale;
			    nextZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
			
			    // 기준점을 object 기준으로 잡는 게 안정적
			    const rect = object.getBoundingClientRect();
			    const c = mid(e.touches[0], e.touches[1]);
			    const point = { x: c.x - rect.left, y: c.y - rect.top };
			
			    panZoom.zoomAtPoint(nextZoom, point);
			
			    isPinching = true;
			    lastPinchAt = Date.now();
			  }
			
			  function endPinch() {
			    pinching = false;
			    armed = false;
			    startDist = 0;
			    lastDist = 0;
			
			    isPinching = false;
			    lastPinchAt = Date.now();
			  }
			
			  function onEnd(e) {
			    // 두 손가락 중 하나라도 남아있으면 아직 pinch 상태로 볼 수 있어서
			    if (e.touches && e.touches.length >= 2) return;
			    endPinch();
			  }
			
			  // 리스너 등록 (svg + object 둘 다)
			  targets.forEach((t) => {
			    t.addEventListener("touchstart", onStart, { passive: false, capture: true });
			    t.addEventListener("touchmove",  onMove,  { passive: false, capture: true });
			    t.addEventListener("touchend",   onEnd,   { passive: true,  capture: true });
			    t.addEventListener("touchcancel", endPinch, { passive: true, capture: true });
			  });
			})();
	
			//  리사이즈 핸들러 등록 (한 번만)
			if (!window.__resizeBound__) {
				window.addEventListener("resize", () => {

					// panZoom / svgElement 준비 안 됐으면 스킵
					if (!panZoom || !svgElement) return;

					//  최소화/숨김 상태면 pan/zoom 절대 호출하지 않기
					if (!isElementVisible(svgElement)) {
						// 콘솔에서 상태만 참고용으로 찍고 아무 것도 안 함
						console.warn("[resize] SVG not visible (maybe minimized). Skip panZoom.resize & re-zoom");
						return;
					}


					try {
						// 1) svg-pan-zoom에게 뷰포트 크기 변경 사실 알리기
						panZoom.resize();
					} catch (e) {
						console.error("[resize] panZoom.resize() error:", e);
						return; // 이상하면 더 진행 안 함
					}

					// 2) 마지막으로 선택한 노드가 있으면 그 기준으로 다시 줌
					if (LAST_SELECTED_NODE) {

						highlightAndZoomToElement(
							LAST_SELECTED_NODE,
							svgDoc,
							svgElement,
							panZoom,
							() => safeViewReset(panZoom, svgElement),
							calculateFixedCenter
						);


					}
				});
				window.__resizeBound__ = true;
			}

			////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
			for (let i = 0; i < svgType.length; i++) {

				const metaNode = svgType[i];

				const svgType_parent = metaNode.closest("g");

				// g 태그만 있고 id 값 없어도 에러 없이 continue
				if (!svgType_parent) continue;

				const gId = svgType_parent.getAttribute("id") || "";

				const moveAttr = svgType_parent.getAttribute("movepage") || "";

				if (!moveAttr.trim()) continue;
				
				const decoded = moveAttr.replace(/&quot;/g, '"');

				let moveData;

				try {
					moveData = JSON.parse(decoded);
				} catch (e) {
					console.warn("movepage JSON 파싱 실패:", decoded);
					return;
				}

				if (!gId.trim()) continue;

				if (moveData.drawing_file) {

					svgType_parent.setAttribute("data-state", "movepage");

				} else {
					svgType_parent.setAttribute("data-state", "default");
				}

				// tooltip 등록
				const title = document.createElementNS(svgns, "title"); // title이라는 이름을 가진 새 element를 동적 생성. 실제 화면에 그려지지는 않음, Tooltip

				title.textContent = gId;

				svgType_parent?.appendChild(title);

				///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
				// 클릭 이벤트 등록
				// 클로저 문제 해결 위해 function(){} 사용, 화살표 함수 사용 시 this 바인딩 문제 발생
				// 클릭 시 해당 요소 강조 및 확대, PDF 버튼 활성화 등

				svgType_parent.addEventListener("pointerup", function() {
					
					if (isPinching || (Date.now() - lastPinchAt) < 350) return;
                    
                    if (isDragging) return;
  					if ((Date.now() - lastDragAt) < DRAG_SUPPRESS_MS) return;

					reSetStyle(svgType);

					const element = this;
					const clickedId = element.id || '';

					if (!clickedId) return;

					//  movepage 속성 있는지 확인
					const movepageAttr = element.getAttribute("movepage");
					let obj = {};
					try {
					  const decoded = (movepageAttr || "").replace(/&quot;/g, '"');
					  obj = decoded ? JSON.parse(decoded) : {};
					} catch (e) {
					  console.warn("[movepage] parse fail:", movepageAttr, e);
					}
					const drawingFile = obj.drawing_file;

					// 클릭한 Movepage 태그 id 값 입력 
					CURRENT_SEARCH_TAG = clickedId;
					PENDING_GRID_ANCHOR = extractGridAnchorFromId(clickedId);  // "(B-5)" or ""
					
					if (drawingFile) {
						PENDING_FROM_MOVE = true;
						handleMovePage(movepageAttr)
						return;
					}
					else {
						PENDING_FROM_MOVE = false;
						sessionStorage.removeItem(NAV_HISTORY_KEY);
					}

					if (LAST_SELECTED_NODE && LAST_SELECTED_NODE !== element) {
						LAST_SELECTED_NODE.setAttribute("data-state", "default");
					}

					//  같은 id를 가진 g가 여러 개인지 체크 (중복 그룹 여부)
					const sameGroups = svgDoc.querySelectorAll(`g[id="${CSS.escape(clickedId)}"]`);
					const isDuplicateGroup = sameGroups.length > 1;

					//  중복 그룹이면서, 이미 한 번 줌 처리한 id를 다시 클릭한 경우 → 아무 것도 안 함
					if (isDuplicateGroup && LAST_DUPLICATE_ZOOM_ID === clickedId) {
						/*   console.debug("중복 텍스트 그룹 재클릭 → 줌/팬 스킵:", clickedId);*/
						return;
					}

					if (ckType === "pnid") {

						if (isDuplicateGroup) {
							//  중복 텍스트 그룹: 이번에 처음 클릭된 것이므로 줌 실행 + id 기억
							LAST_DUPLICATE_ZOOM_ID = clickedId;

							highlightAndZoomSameIdGroup(
								element,
								svgDoc,
								svgElement,
								panZoom,
								() => safeViewReset(panZoom, svgElement),
								calculateFixedCenter
							);
						} else {
							// 단일 텍스트 그룹이면 항상 줌 허용, 중복 플래그는 초기화
							LAST_DUPLICATE_ZOOM_ID = null;

							highlightAndZoomToElement(
								element,
								svgDoc,
								svgElement,
								panZoom,
								() => safeViewReset(panZoom, svgElement),
								calculateFixedCenter
							);
						}


					}

					//  현재 요소 강조 상태로 전환
					element.setAttribute("data-state", "selected");

					tbHighlightRow(element.id); // 또는 직접 DOM 접근하여 강조

					LAST_SELECTED_NODE = element; // 저장

					var primaryId = clickedId.split(",")[0];   // 첫 번째 값만 사용

					$.ajax({
						url: "/multiview/pnid/clicktag.do",
						type: "POST",
						dataType: "json",
						data: {
							pnidTagNo: primaryId   // 클릭한 g의 id   
						},
						success: function(resp) {

							if (!resp || !resp.length) return;

							var info = resp[0];
							var iegNo = info.iegNo;

							// 원하는 URL 생성
							var targetUrl = "/multiview/index.do?t=F&iegNo=" + encodeURIComponent(iegNo);

							fnOpenPopupStandard(targetUrl, "설비상세정보");

						},
						error: function(xhr, status, err) {
							console.error("[clicktag] AJAX 오류:", status, err);
						}
					});

				});
				/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

				svgType_parent.addEventListener("mouseover", () => setCursor(svgType_parent, 'pointer'));
				svgType_parent.addEventListener("mouseout", () => setCursor(svgType_parent, 'default'));
			}

			// searchTag가 "(B-5)" 같은 그리드 좌표면: 요소검색 말고 좌표로 이동
			if (
				  searchTag &&
				  ckType === "pnid" &&
				  PENDING_FROM_MOVE === true &&
				  PENDING_GRID_ONLY === true &&
				  isGridAnchor(searchTag)
				) {
				// 기존 스타일 초기화는 필요하면 유지
				reSetStyle(svgType);

				// grid 이동 실행
				const ok = zoomToGridAnchor(searchTag, svgDoc, svgElement, panZoom);

				// 한번 처리 후 pending 초기화(중요)
				PENDING_GRID_ANCHOR = "";
				PENDING_FROM_MOVE = false;
				PENDING_GRID_ONLY = false;
				// 못 찾으면 로그만
				if (!ok) console.warn("[grid] anchor not resolved:", searchTag);

				//  여기서 return 해야 기존 searchTag id검색 로직으로 안 내려감
				return;
			}
			// 검색 태그가 있을 경우 해당 태그 강조 및 확대
			if (searchTag && ckType === "pnid") {

				// searchTag와 같은 id를 가진 <g> 태그를 찾기
				const matchedGroupSet = new Set();  // 중복 g 방지용

				for (let i = 0; i < tempTextNodes.length; i++) {
					const textNode = tempTextNodes[i];

					// 이 텍스트가 포함된 g 부모 찾기
					const parentG = textNode.closest("g[id]");
					if (!parentG) continue;

					const gId = (parentG.getAttribute("id") || "").trim();

					// 여기서 g의 id와 searchTag 비교
					if (gId.includes(searchTag)) {
						matchedGroupSet.add(parentG);
					}
				}

				const matchedGroups = Array.from(matchedGroupSet);
				const count = matchedGroups.length;

				if (count > 1) {
					const targetGroup = matchedGroups[0];

					highlightAndZoomToElement(
						targetGroup,
						svgDoc,
						svgElement,
						panZoom,
						() => reSetStyle(svgType),
						calculateFixedCenter
					);

					// 선택된 노드 기록
					LAST_SELECTED_NODE = targetGroup;

					//  중복인 경우: 해당 id를 가진 g가 여러 개 → 텍스트만 보라색, 줌 취소
					matchedGroups.forEach(g => {
						g.setAttribute("data-state", "selected");
					});

				} else if (count === 1) {
					// 1개인 경우: 줌 + 보라색

					//  줌/이동 먼저 수행 (기존 로직 유지)
					runSearchTag_pmt(
						searchTag,
						svgDoc,
						svgElement,
						panZoom,
						() => reSetStyle(svgType),
						highlightAndZoomToElement,
						safeViewReset,
						calculateFixedCenter
					);

					matchedGroups[0].setAttribute("data-state", "selected");
				} else {
					// 못 찾았으면 굳이 LAST_SELECTED_NODE를 null로 덮어쓰지 말지 선택
					console.warn("[searchTag] element not found:", searchTag);
				}

			LAST_SELECTED_NODE = findElementByMultiId(svgDoc, searchTag);
			}

		});

		const container = document.getElementById("svgarea");
		container.innerHTML = "";
		container.appendChild(object);
	}


	// 전역 등록
	window.computeEXP = computeEXP;
	window.calculateFixedCenter = calculateFixedCenter;
	window.highlightAndZoomToElement = highlightAndZoomToElement;
	window.safeViewReset = safeViewReset;
	window.getRealZoom = getRealZoom;
	window.parseViewBox = parseViewBox;
	window.onResize_vent = onResize_vent;
	window.highlightText = highlightText;
	window.panToCenter = panToCenter;
	window.determineZoomLevel = determineZoomLevel;
	window.createOutlineRect = createOutlineRect;
	window.createAndLoadSVG = createAndLoadSVG;
	window.setupFileInputHandler = setupFileInputHandler;
	window.initFromUrlParams = initFromUrlParams;
	window.loadNavHistory = loadNavHistory;
	window.renderNavHistory = renderNavHistory;
	window.addNavHistoryEntry = addNavHistoryEntry;
	window.shouldResetNavHistory = shouldResetNavHistory


})();
