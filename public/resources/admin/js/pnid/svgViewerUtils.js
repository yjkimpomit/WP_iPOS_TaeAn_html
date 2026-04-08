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
	let CURRENT_TEXT_TRANSFORM = "";   // 클릭한 text가 속한 g의 transform
	let LAST_DUPLICATE_ZOOM_ID = null;

	/**
	 * 클릭한 ID 문자열에서 "(B-5)" 같은 그리드 앵커 좌표를 추출한다.
	 * movepage 시 drawing_tag_no가 없을 경우, 클릭한 태그 ID 안에 포함된
	 * 그리드 좌표를 찾아 다음 도면에서 해당 위치로 이동시키기 위해 사용한다.
	 */
	function extractGridAnchorFromId(clickedId) {
		if (!clickedId) return "";
		const m = clickedId.match(/\([A-Z]\s*-\s*\d+\)/i); // "(B-5)"
		return m ? m[0].toUpperCase().replace(/\s+/g, "") : ""; // "(B-5)"
	}
	/**
	 * "(B-5)" 또는 "B-5" 형식의 문자열을 { row, col } 형태로 파싱한다.
	 * 이후 border grid index에서 행/열 좌표를 찾기 쉽게 변환하는 용도다.
	 */
	function parseGridAnchor(grid) {
		if (!grid) return null;
		const m = grid.match(/\(?([A-Z])\s*-\s*(\d+)\)?/i);
		if (!m) return null;
		return { row: m[1].toUpperCase(), col: m[2] };
	}
	/**
	 * 전달된 문자열이 그리드 좌표 형식인지 여부를 판단한다.
	 * 예: "(B-5)", "C-10"
	 */
	function isGridAnchor(str) {
		return !!parseGridAnchor(str);
	}
	/**
	 * SVG 내부 좌표(x, y)를 현재 브라우저 화면(client) 좌표로 변환한다.
	 * zoomAtPoint 같은 화면 기준 확대 처리 시 기준점을 맞추기 위해 사용한다.
	 */
	function svgPointToClient(svgRoot, x, y) {
		const pt = svgRoot.createSVGPoint();
		pt.x = x;
		pt.y = y;
	
		const m = svgRoot.getScreenCTM();
		if (!m) return { x, y };

		const res = pt.matrixTransform(m);
		return { x: res.x, y: res.y };
	}
	/**
	 * text 요소의 중심 좌표를 SVG 좌표계 기준으로 계산한다.
	 * getBBox()와 getCTM()을 이용해서 transform이 적용된 실제 중심점을 구한다.
	 */
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
	/**
	 * SVG 외곽 테두리에 표시된 행(A,B,C...) / 열(1,2,3...) 텍스트를 분석하여
	 * 그리드 좌표 인덱스를 만든다.
	 * 예를 들어 B-5 → x좌표는 5열의 중앙값, y좌표는 B행의 중앙값으로 찾을 수 있게 한다.
	 */
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
		/**
		 * 여러 개의 좌표값 중 중앙값을 계산한다.
		 * 동일한 행/열 텍스트가 여러 군데 존재해도 안정적인 기준 좌표를 얻기 위함이다.
		 */
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
	function zoomToCalculatedCenter(targetEl, svgDoc, svgElement, panZoom, calculateFn) {

	  const result = calculateFn(targetEl, svgElement, svgDoc);
	  if (!result) return;
	
	  const { fixedCenterX, fixedCenterY, zoomScale } = result;
	
	  if (
	    !isFiniteNumber(fixedCenterX) ||
	    !isFiniteNumber(fixedCenterY) ||
	    !isFiniteNumber(zoomScale) ||
	    zoomScale <= 0
	  ) {
	    console.warn("[zoom] invalid values");
	    return;
	  }
	
	  try {
	    panZoom.zoomAtPoint(zoomScale, { x: fixedCenterX, y: fixedCenterY });
	  } catch (e) {
	    console.error("[zoom] zoomAtPoint error:", e);
	  }
	}
	/**
	 * "(B-5)" 같은 그리드 좌표를 실제 SVG 위치로 변환한 뒤
	 * 해당 위치를 기준으로 화면을 리셋하고 확대 이동한다.
	 * movepage로 넘어왔는데 drawing_tag_no가 없을 때 사용된다.
	 */
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
				panZoom.zoomAtPoint(3.0, pt); 
			} catch (e) {
				console.error("[grid] zoomAtPoint error:", e);
			}
		});

		return true;
	}
	/**
	 * URL 파라미터에 searchTag가 존재하면 네비게이션 히스토리를 초기화해야 하는지 판단한다.
	 * 직접 URL 접근 + 특정 태그 검색으로 진입한 경우 이전 세션 히스토리를 이어받지 않기 위함이다.
	 */
	// 도면이동 네비게이션 히스토리 리셋 함수 : url 접근 +searchTag 존재 하는 경우 
	function shouldResetNavHistory() {

		const params = new URLSearchParams(window.location.search);

		const searchTag = params.get("searchTag");

		return searchTag !== null && searchTag.trim() !== "";
	}

	/**
	 * 현재 네비게이션 히스토리 목록 개수를 화면에 표시한다.
	 * 예: "도면 이동 이력 (3)"
	 */
	function updatePnidHistoryCount() {
		const list = document.getElementById("navHistoryList");
		const countSpan = document.getElementById("pnidHistoryCount");

		if (!list || !countSpan) return;

		const count = list.children.length;
		countSpan.textContent = ` \u00A0(${count})`;
	}
	/**
	 * sessionStorage에 저장된 도면 이동 히스토리를 읽어온다.
	 * 데이터가 없거나 파싱 실패 시 빈 배열을 반환한다.
	 */
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
	/**
	 * 현재 도면 이동 히스토리를 sessionStorage에 저장한다.
	 */
	function saveNavHistory(list) {
		try {
			sessionStorage.setItem(NAV_HISTORY_KEY, JSON.stringify(list));
		} catch (e) {
			console.warn("[navHistory] save 실패:", e);
		}
	}
	/**
	 * 세션에 저장된 도면 이동 히스토리를 네비게이션 UI에 렌더링한다.
	 * 사용자가 과거 이동 이력을 클릭하면 해당 dataPath/searchTag 상태로 복귀할 수 있다.
	 */
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

	/**
	 * 새로운 도면 이동 이력을 히스토리 배열 맨 앞에 추가하고,
	 * 최대 개수를 넘기면 오래된 항목은 제거한다.
	 */
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
	/**
	 * 선택된 SVG 요소를 확대 이동할 때 사용할 보정 중심 좌표와 적절한 줌 배율을 계산한다.
	 * 요소 bbox, 화면 중심, wrapper 크기 등을 종합해서 보다 자연스럽게 중앙 정렬되도록 만든다.
	 */
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
		if (!screenCTM) return;
		// 요소의 중심 좌표 (화면 기준)를 계산
		//const centerX = (bbox.x + bbox.width / 2) * screenCTM.a + screenCTM.e;
		//const centerY = (bbox.y + bbox.height / 2) * screenCTM.d + screenCTM.f;
		const pt = svgDoc.documentElement.createSVGPoint();
		pt.x = bbox.x + bbox.width / 2;
		pt.y = bbox.y + bbox.height / 2;
	
		const transformed = pt.matrixTransform(screenCTM);
	
		const centerX = transformed.x;
		const centerY = transformed.y;
		// SVG 요소의 실제 표시 영역 크기를 계산
		const viewWidth = svgElement.clientWidth || svgElement.getBoundingClientRect().width;
		const viewHeight = svgElement.clientHeight || svgElement.getBoundingClientRect().height;

		// SVG를 감싸고 있는 영역 (iframe 포함 wrapper) 요소
		const svgArea = document.getElementById(containerId);
		if (!svgArea) return;
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
	/**
	 * 숫자형이며 NaN / Infinity가 아닌 정상적인 값인지 검사한다.
	 * zoom / pan 좌표 계산 전에 예외 방지를 위해 사용한다.
	 */
	function isFiniteNumber(v) {
		return typeof v === "number" && isFinite(v);
	}
	/**
	 * 단일 SVG 요소를 강조하고 해당 요소가 화면 중앙 부근에 오도록 확대 이동한다.
	 * 선택한 노드 클릭 시 가장 기본적으로 수행되는 줌 이동 함수다.
	 */
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
		 zoomToCalculatedCenter(
		    element,
		    svgDoc,
		    svgElement,
		    panZoom,
		    calculateFixedCenterFn
		  );
		
		});
	}
	/**
	 * 같은 g id를 가진 여러 text 노드가 존재할 때,
	 * 각 텍스트의 중심과 줌값을 종합해서 그룹 전체가 적절히 보이도록 확대 이동한다.
	 * 중복 텍스트 그룹 클릭 시 사용된다.
	 */
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
		 zoomToCalculatedCenter(
		    clickedGroup,
		    svgDoc,
		    svgElement,
		    panZoom,
		    calculateFixedCenterFn
		  );
		});
	}
	/**
	 * 요소가 실제 화면상에 보이는 상태인지 확인한다.
	 * display:none, visibility:hidden, opacity:0, width/height 0 상태를 방지하기 위해 사용한다.
	 */
	function isElementVisible(el) {
		if (!el) return false;
		const style = window.getComputedStyle(el);
		if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
			return false;
		}
		const rect = el.getBoundingClientRect();
		return !!(rect.width && rect.height);
	}
	/**
	 * panZoom 상태를 안전하게 초기화한다.
	 * 뷰어 크기가 0인 상태에서는 resize / fit / center 호출 자체를 막아 예외를 방지한다.
	 */
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
	/**
	 * svg-pan-zoom 인스턴스에서 현재 실제 확대 배율(scale) 값을 반환한다.
	 */
	function getRealZoom(panZoomInstance) {
		const transform = panZoomInstance.getTransform();
		return transform.scale;
	}
	/**
	 * SVG 요소의 viewBox 속성에서 x, y 시작 좌표를 파싱한다.
	 * viewBox가 없으면 기본값 {x:0, y:0}을 반환한다.
	 */
	function parseViewBox(svgEl) {
		const vb = svgEl.getAttribute("viewBox");
		if (!vb) return { x: 0, y: 0 };
		const [x, y] = vb.split(/\s+|,/).map(parseFloat);
		return { x, y };
	}
	/**
	 * 특정 이벤트 대상 노드의 bbox를 기준으로 outline을 만들고,
	 * 적절한 zoom/pan을 적용해서 화면 중앙으로 이동시킨다.
	 * 기존 vnet 타입 관련 중심 이동 로직이다.
	 */
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
	/**
	 * 그룹 노드 내부 텍스트에 stroke를 줘서 강조 표시한다.
	 * 텍스트 기반 하이라이트 처리용 간단한 유틸 함수다.
	 */
	function highlightText(groupNode) {
		const text = groupNode.childNodes[1];
		if (text) {
			text.setAttribute("stroke", "#a52bff");
			text.setAttribute("stroke-width", "0.05px");
		}
	}
	/**
	 * 지정한 사각형 영역(rx, ry, rw, rh)이 화면 중앙에 오도록 pan 값을 계산해 이동한다.
	 * zoom 후 중앙 정렬이 필요한 경우 사용한다.
	 */
	// vnet 타입의 경우, 클릭한 요소를 강조하고 확대하여 해당 요소로 이동하는 함수
	function panToCenter(panZoom, rx, ry, rw, rh) {
		const realZoom = panZoom.getSizes().realZoom;

		const panX = -(rx * realZoom) + (panZoom.getSizes().width / 2) - ((rw * realZoom) / 2);
		const panY = -(ry * realZoom) + (panZoom.getSizes().height / 2) - ((rh * realZoom) / 2);

		panZoom.pan({ x: 0, y: 0 }); // 초기화
		panZoom.pan({ x: panX, y: panY }); // 이동
	}

	/**
	 * 요소 bbox 크기에 따라 적절한 zoom 레벨을 결정한다.
	 * 작은 요소는 더 크게, 큰 요소는 상대적으로 덜 확대한다.
	 */
	function determineZoomLevel(panZoom, bbox) {
		if (bbox.width < 75 && bbox.height < 100) {
			panZoom.zoom(10);
		} else {
			panZoom.zoom(5);
		}
	}
		/**
	 * 선택한 요소 주변에 표시할 outline 사각형을 생성한다.
	 * 시각적인 선택 강조를 위해 사용한다.
	 */
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
	
	/**
	 * 지정한 SVG 경로에 대해 HEAD 요청으로 실제 파일 존재 여부를 확인한다.
	 * 존재하지 않는 SVG/PDF를 로드하려고 할 때 사전 차단하는 용도다.
	 */
	async function checkSvgExists(url) {
		try {
			const res = await fetch(url, { method: "HEAD" });
			return res.ok;                // 200, 304 등 → true
		} catch (e) {
			console.warn("checkSvgExists 실패:", e);
			return false;
		}
	}

	/**
	 * 현재 페이지 URL 파라미터(dataPath, searchTag)를 읽어
	 * 최초 진입 시 해당 SVG 파일을 자동 로드한다.
	 */
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
function fnMovePageEdit(info) {
	if (window.parent && typeof window.parent.fnMovePageEdit === "function") {
		window.parent.fnMovePageEdit(info);
	} else {
		console.warn("[fnMovePageEdit] parent.fnMovePageEdit not found", info);
		alert("movepage 수정 팝업 함수를 찾지 못했습니다.");
	}
}

function openMovePageEditPopup(group ,textNode) {
	
	if (!group) return;

	const rawMovePage = group.getAttribute("movepage") || "";
	if (!rawMovePage) return;
	
	const moveData = parseMovePageData(rawMovePage);
	const textValue = textNode ? (textNode.textContent || "").trim() : "";
	const gId = (group.getAttribute("id") || textValue).trim();
	const pmtId = getPmtIdFromGroup(group) || "";
	const drawingFile = (moveData.drawing_file || "").trim();
	const drawingTagNo = (moveData.drawing_tag_no || "").trim();

	const currentDataPath = CURRENT_DATA_PATH || "";
	const currentFileName = currentDataPath
		? decodeURIComponent(currentDataPath).split("/").pop()
		: "";
		
   // 핵심: 클릭한 text가 속한 transform 의 값 구하기
   const targetTransform = getTransformFromTextNode(textNode) || CURRENT_TEXT_TRANSFORM || "";

	const info = {
		dataPath: currentDataPath,
		fileName: currentFileName,
		gId: gId,
		pmtId: pmtId,
		drawingFile: drawingFile,
		drawingTagNo: drawingTagNo,
		rawMovePage: rawMovePage,
		targetTransform: targetTransform
	};

	console.log("[openMovePageEditPopup]", info);
	
	fnMovePageEdit(info);
}
	function requestPnidInfo(primaryId, fallbackInfo) {
	
		fallbackInfo = fallbackInfo || {};
	
		const fallbackData = fallbackInfo.data || "";
		const fallbackFileName = fallbackInfo.fileName || "";
		const fallbackText = fallbackInfo.text || "";
		const fallbackTransform = fallbackInfo.targetTransform || "";
	
		$.ajax({
			url: "/admin/pnid/clicktag.do",
			type: "POST",
			dataType: "json",
			data: { pnidTagNo: primaryId },
	
			success: function(resp) {
	
				let info = null;
	
				if (!resp || !resp.length) {
					info = {
						data: fallbackData,
						fileName: fallbackFileName,
						text: fallbackText,
						targetTransform: fallbackTransform,
						iegNo: null,
						pnidTagNo: primaryId || null
					};
	
				} else {
					info = resp[0];
	
					// 부모 iframe src에서 현재 도면 경로 가져오기
					var iframeSrc = window.parent.$("#_VIEW_IFRAME").attr("src") || "";
	
					if (iframeSrc) {
						var queryString = iframeSrc.split("?")[1] || "";
						var params = new URLSearchParams(queryString);
						var currentDataPath = decodeURIComponent(params.get("dataPath") || "");
	
						console.log("현재 P&ID 도면:", currentDataPath);
	
						var matched = resp.find(function(item) {
							return item.data === currentDataPath;
						});
	
						if (matched) {
							info = matched;
						}
					} else {
						console.warn("부모 iframe src를 찾지 못했습니다.");
					}
	
					info.text = fallbackText || info.text || "";
					if (!info.data) info.data = fallbackData;
					if (!info.fileName) info.fileName = fallbackFileName;
					if (!info.pnidTagNo) info.pnidTagNo = primaryId || null;
					if (!info.iegNo) info.iegNo = null;
				}
	
				// 서버 응답에는 없을 수 있으므로 fallback 유지
				if (!info.targetTransform) info.targetTransform = fallbackTransform;
	
				console.log("선택된 info:", info);
            
            if(info.pnidTagNo == null){
				
				
			}
				 //기존에서 info 값 넘기는 걸로 수정 
				fnPnidInfo(info);
			},
	
			error: function(xhr, status, err) {
				console.error("[clicktag] AJAX 오류:", status, err);
	
				fnPnidInfo({
					data: fallbackData,
					fileName: fallbackFileName,
					text: fallbackText,
					targetTransform: fallbackTransform,
					iegNo: null,
					pnidTagNo: primaryId || null
				});
			}
		});
	}
		/**
	 * movepage 속성(JSON 문자열)을 파싱하여 다른 도면으로 이동한다.
	 * 필요 시 현재 도면 정보를 히스토리에 저장하고,
	 * drawing_tag_no가 없으면 grid anchor 기반 이동으로 보완한다.
	 */
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
		/**
	 * object / svg 영역에 드래그 감지 가드를 설치한다.
	 * 클릭 이벤트와 드래그 이벤트를 구분해서,
	 * 드래그 직후 잘못된 클릭 처리(pointerup)를 막기 위한 용도다.
	 */
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
		
		function getPmtIdFromGroup(group) {
			if (!group) return "";
		
			const pmtIdNode = group.querySelector(":scope > metadata pmt\\:id");
			if (!pmtIdNode) return "";
		
			return (pmtIdNode.textContent || "").trim();
		}
		
		function findBestTaggedGroup(node) {
			let current = node ? node.parentElement : null;
		
			while (current) {
				if (current.tagName && current.tagName.toLowerCase() === "g") {
		
					// svg-pan-zoom 내부 viewport 래퍼는 제외
					if (isInternalViewportGroup(current)) {
						current = current.parentElement;
						continue;
					}
		
					const gid = (current.getAttribute("id") || "").trim();
					const pmtId = getPmtIdFromGroup(current);
		
					// 실제 의미 있는 g만 반환
					if (gid || pmtId) {
						return current;
					}
				}
				current = current.parentElement;
			}
		
			return null;
		}
		function isInternalViewportGroup(group) {
			if (!group) return false;
		
			const gid = (group.getAttribute("id") || "").trim();
			const cls = (group.getAttribute("class") || "").trim();
		
			if (gid.startsWith("viewport-")) return true;
			if (cls.includes("svg-pan-zoom_viewport")) return true;
			if (gid.includes("svg-pan-zoom")) return true;
		
			return false;
		}
		function getPrimaryIdFromTextNode(textNode) {
			if (!textNode) return "";
		
			const taggedGroup = findBestTaggedGroup(textNode);
		
			if (taggedGroup) {
				const gid = (taggedGroup.getAttribute("id") || "").trim();
				if (gid) return gid.split(",")[0];
		
				const pmtId = getPmtIdFromGroup(taggedGroup);
				if (pmtId) return pmtId.split(",")[0];
			}
		
			// 마지막 fallback
			return "";
		}
		
	/**
 * SVG 파일 로딩의 진입점.
 * 현재 상태값(path, searchTag)을 저장하고,
 * 이전 panZoom 인스턴스를 정리한 뒤,
 * object 태그를 생성하여 #svgarea 영역에 mount 한다.
 */
	function createAndLoadSVG(path, searchTag) {
	setupSvgState(path, searchTag);
	destroyExistingPanZoom();

	const object = createSvgObject(path);

	object.addEventListener("load", function () {
		handleSvgObjectLoad(object, searchTag);
	});

		mountSvgObject(object);
	}
/**
 * 현재 열고 있는 도면 경로와 검색 태그를 전역 상태에 저장한다.
 * 이후 movepage, searchTag 재적용, 히스토리 관리 등에 사용된다.
 */
	function setupSvgState(path, searchTag) {
		CURRENT_DATA_PATH = path;
		CURRENT_SEARCH_TAG = searchTag || "";
	}
	/**
 * 기존 svg-pan-zoom 인스턴스가 남아 있으면 안전하게 제거한다.
 * 새 SVG를 다시 로드할 때 이전 인스턴스 충돌을 방지하기 위한 처리다.
 */
	function destroyExistingPanZoom() {
		if (window.panZoom) {
			window.panZoom.destroy();
			window.panZoom = null;
		}
	}
	/**
 * 주어진 SVG 경로(path)로 object 태그를 생성한다.
 * 실제 SVG 문서는 load 이벤트 이후 contentDocument 로 접근한다.
 */
	function createSvgObject(path) {
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
	
		return object;
	}
	/**
 * 생성된 object 태그를 실제 뷰어 영역(#svgarea)에 붙인다.
 * 기존 내용을 비우고 새 SVG object 만 남기도록 처리한다.
 */
	function mountSvgObject(object) {
		const container = document.getElementById("svgarea");
		if (!container) {
			console.warn("[createAndLoadSVG] #svgarea container not found");
			return;
		}
	
		container.innerHTML = "";
		container.appendChild(object);
	}
	/**
	 * SVG object 로드가 완료된 뒤 실제 초기화를 수행한다.
	 * - svgDoc / svgElement 설정
	 * - drag guard 설치
	 * - 전역 스타일 삽입
	 * - panZoom 생성
	 * - pinch zoom 등록
	 * - resize 이벤트 등록
	 * - g / text 클릭 이벤트 바인딩
	 * - searchTag 초기 처리
	 */
	function handleSvgObjectLoad(object, searchTag) {
		LAST_DUPLICATE_ZOOM_ID = null;
	
		svgDoc = object.contentDocument;
		if (!svgDoc || !svgDoc.documentElement) {
			console.warn("[handleSvgObjectLoad] SVG document not ready");
			return;
		}
	
		svgElement = svgDoc.documentElement;
	
		installSvgInteractionGuards(object, svgElement);
		ensureGlobalSvgStyle(svgDoc, svgElement);
	
		const context = buildSvgContext(svgDoc, svgElement);
		ckType = context.ckType;
	
		panZoom = createPanZoomInstance(svgElement);
		window.panZoom = panZoom;
	
		attachPinchZoom(svgElement, object, panZoom);
		bindWindowResizeOnce();
	
		bindGroupEvents(context);
		bindTextNodeEvents(context);
	
		applyInitialSearchTag(context, searchTag);
	}
	/**
	 * object 태그와 svg 루트 양쪽에 drag guard를 설치한다.
	 * 클릭과 드래그를 구분하여 pointerup 오작동을 막기 위함이다.
	 */
	function installSvgInteractionGuards(object, svgElement) {
		installDragGuard(object);
		installDragGuard(svgElement);
	}
	/**
	 * SVG 문서 안에 상태별(data-state) 색상 스타일이 없으면 추가한다.
	 * default / selected / movepage 상태에 따라 text, tspan 색상을 구분한다.
	 */
	function ensureGlobalSvgStyle(svgDoc, svgElement) {
		let globalStyle = svgDoc.querySelector('style[data-role="global-state-style"]');
		if (globalStyle) return globalStyle;
	
		globalStyle = document.createElementNS(svgns, "style");
		globalStyle.setAttribute("data-role", "global-state-style");
		globalStyle.textContent = getGlobalSvgStyleText();
	
		svgElement.insertBefore(globalStyle, svgElement.firstChild);
		return globalStyle;
	}
	/**
	 * g[data-state] 값에 따라 텍스트 색상 및 hover 스타일을 정의한 CSS 문자열을 반환한다.
	 * SVG 내부에 동적으로 삽입되어 상태 표시용으로 사용된다.
	 */
	function getGlobalSvgStyleText() {
		return `
			g[data-state="default"] text,
			g[data-state="default"] tspan {
				fill: #E50041;
				paint-order: stroke fill;
				font-weight: bold;
			}
	
			g[data-state="default"]:hover text,
			g[data-state="default"]:hover tspan {
				stroke: #E50041;
				stroke-width: 0.3;
				stroke-opacity: 0.2;
				paint-order: stroke fill;
			}
	
			g[data-state="selected"] text,
			g[data-state="selected"] tspan {
				fill: #3747C1;
				paint-order: stroke fill;
				font-weight: bold;
			}
	
			g[data-state="selected"]:hover text,
			g[data-state="selected"]:hover tspan {
				stroke: #3747C1;
				stroke-width: 0.3;
				stroke-opacity: 0.2;
				paint-order: stroke fill;
			}
	
			g[data-state="movepage"] text,
			g[data-state="movepage"] tspan {
				fill: #0F9B3A;
				paint-order: stroke fill;
				font-weight: bold;
			}
	
			g[data-state="movepage"]:hover text,
			g[data-state="movepage"]:hover tspan {
				stroke: #0F9B3A;
				stroke-width: 0.3;
				stroke-opacity: 0.2;
				paint-order: stroke fill;
			}
		`;
	}
	/**
	 * SVG 초기화에 필요한 주요 노드/정보를 하나의 context 객체로 묶어 반환한다.
	 * - textNodes: 모든 text 요소
	 * - svgTypeNodes: getElementsByTagNameNS('*', 'id') 결과
	 * - ckType: pnid / dataparc 판별값
	 */
	function buildSvgContext(svgDoc, svgElement) {
		const textNodes = Array.from(svgElement.querySelectorAll("text"));
		const svgTypeNodes = Array.from(svgDoc.getElementsByTagNameNS("*", "id"));
		const ckType = detectSvgType(svgDoc);
	
		window.tempTextNodes = textNodes;
	
		return {
			svgDoc,
			svgElement,
			textNodes,
			svgTypeNodes,
			ckType
		};
	}
	/**
	 * SVG 내부에 transform="scale(1,-1)" 요소가 있는지 기준으로
	 * 현재 도면 타입을 pnid 또는 dataparc 로 구분한다.
	 */
	function detectSvgType(svgDoc) {
		const viewboxElements = svgDoc.querySelectorAll('[transform="scale(1,-1)"]');
		return viewboxElements.length > 0 ? "pnid" : "dataparc";
	}
	/**
 * svg-pan-zoom 인스턴스를 생성한다.
 * 확대/축소/센터링을 활성화하고,
 * 화면 밖으로 과도하게 벗어나지 않도록 beforePan 제한 로직을 연결한다.
 */
	function createPanZoomInstance(svgElement) {
		return svgPanZoom(svgElement, {
			zoomEnabled: true,
			controlIconsEnabled: true,
			fit: true,
			center: true,
			minZoom: 1,
			maxZoom: 10,
			zoomScaleSensitivity: 0.7,
			beforePan: limitPanWithinViewport
		});
	}
	/**
 * pan 이동 시 SVG가 너무 멀리 벗어나지 않도록 x/y 이동 범위를 제한한다.
 * 현재 realZoom, viewBox, viewport 크기를 기준으로 허용 범위를 계산한다.
 */
	function limitPanWithinViewport(oldPan, newPan) {
		const sizes = this.getSizes();
		const vb = sizes.viewBox;
		const realZoom = sizes.realZoom;
		const viewportWidth = sizes.width;
		const viewportHeight = sizes.height;
	
		const gutterX = 100;
		const gutterY = 100;
	
		const leftLimit = -((vb.x + vb.width) * realZoom) + gutterX;
		const rightLimit = (viewportWidth - gutterX) - (vb.x * realZoom);
		const topLimit = -((vb.y + vb.height) * realZoom) + gutterY;
		const bottomLimit = (viewportHeight - gutterY) - (vb.y * realZoom);
	
		return {
			x: Math.max(leftLimit, Math.min(rightLimit, newPan.x)),
			y: Math.max(topLimit, Math.min(bottomLimit, newPan.y))
		};
	}
	/**
 * 모바일 환경에서 두 손가락 pinch zoom 을 지원하기 위해
 * svgElement 와 object 양쪽에 touch 이벤트를 등록한다.
 * iOS 호환성을 고려하여 기준 좌표는 object 박스를 사용한다.
 */
	function attachPinchZoom(svgElement, object, panZoom) {
		if (svgElement.__pinchBound) return;
		svgElement.__pinchBound = true;
	
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
			return {
				x: (t1.clientX + t2.clientX) / 2,
				y: (t1.clientY + t2.clientY) / 2
			};
		}
	
		function clamp(v, min, max) {
			return Math.max(min, Math.min(max, v));
		}
	
		function kill(e) {
			e.preventDefault();
			e.stopPropagation();
			if (typeof e.stopImmediatePropagation === "function") {
				e.stopImmediatePropagation();
			}
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
			if (e.touches && e.touches.length >= 2) return;
			endPinch();
		}
	
		targets.forEach((t) => {
			t.addEventListener("touchstart", onStart, { passive: false, capture: true });
			t.addEventListener("touchmove", onMove, { passive: false, capture: true });
			t.addEventListener("touchend", onEnd, { passive: true, capture: true });
			t.addEventListener("touchcancel", endPinch, { passive: true, capture: true });
		});
	}
	/**
 * window resize 이벤트를 한 번만 등록한다.
 * SVG 재로딩이 여러 번 일어나도 resize 핸들러가 중복 등록되지 않도록 한다.
 */
	function bindWindowResizeOnce() {
		if (window.__resizeBound__) return;
	
		window.addEventListener("resize", handleWindowResize);
		window.__resizeBound__ = true;
	}
	/**
 * 브라우저 resize 시 panZoom 사이즈를 갱신하고,
 * 마지막으로 선택된 노드가 있으면 그 노드를 다시 중앙 확대한다.
 */
	function handleWindowResize() {
		if (!panZoom || !svgElement) return;
	
		if (!isElementVisible(svgElement)) {
			console.warn("[resize] SVG not visible (maybe minimized). Skip panZoom.resize & re-zoom");
			return;
		}
	
		try {
			panZoom.resize();
		} catch (e) {
			console.error("[resize] panZoom.resize() error:", e);
			return;
		}
	
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
	}
	/**
 * svgTypeNodes 를 순회하면서 g 그룹을 찾아 초기 상태를 설정하고,
 * 각 그룹에 pointer/mouse 이벤트를 바인딩한다.
 */

	function bindGroupEvents(context) {
		context.svgTypeNodes.forEach((metaNode) => {
			const group = metaNode.closest("g");
			if (!group) return;
	
			const initialized = initializeGroupNode(group);
			if (!initialized) return;
	
			bindGroupPointerEvents(group, context);
		});
	}
	/**
 * 개별 g 그룹의 초기 상태를 설정한다.
 * - id 유효성 검사
 * - movepage 여부에 따라 data-state 지정
 * - tooltip(title) 추가
 */
	function initializeGroupNode(group) {
		const gId = (group.getAttribute("id") || "").trim();
		if (!gId) return false;
	
		const moveData = parseMovePageData(group);
		group.setAttribute("data-state", moveData.drawing_file ? "movepage" : "default");
	
		appendTitleIfNeeded(group, gId);
		return true;
	}
	/**
 * 그룹에 title 요소가 아직 없으면 tooltip 용 title 을 추가한다.
 */
	function appendTitleIfNeeded(group, gId) {
		const hasTitle = group.querySelector(":scope > title");
		if (hasTitle) return;
	
		const title = document.createElementNS(svgns, "title");
		title.textContent = gId;
		group.appendChild(title);
	}
	/**
 * movepage 속성(JSON 문자열)을 안전하게 파싱한다.
 * group 요소를 직접 넘기거나 raw 문자열을 넘겨도 처리 가능하다.
 * 속성이 없거나 JSON 파싱에 실패하면 빈 객체를 반환한다.
 */
	function parseMovePageData(groupOrRaw) {
		let raw = "";
	
		if (typeof groupOrRaw === "string") {
			raw = groupOrRaw;
		} else if (groupOrRaw && typeof groupOrRaw.getAttribute === "function") {
			raw = groupOrRaw.getAttribute("movepage") || "";
		}
	
		if (!raw) return {};
	
		const decoded = raw.replace(/&quot;/g, '"');
	
		try {
			return JSON.parse(decoded);
		} catch (e) {
			console.warn("[movepage] JSON 파싱 실패:", decoded);
			return {};
		}
	}
	function isMovePageEditableTag(tagText) {
	if (!tagText) return false;

	const text = tagText.trim();

	// 예: J11600-002(B-5)
	//    J31500-001(B-6)
	// 영문 1개 + 숫자 5자리 + "-" + 숫자 3자리 + "(" + 영문1개 + "-" + 숫자 + ")"
	return /^[A-Z]\d{5}-\d{3}\([A-Z]-\d+\)$/i.test(text);
}
	/**
 * 개별 g 그룹에 클릭(pointerup) 및 hover 이벤트를 바인딩한다.
 * __svgGroupBound 플래그로 중복 바인딩을 방지한다.
 */
	function bindGroupPointerEvents(group, context) {
		if (group.__svgGroupBound) return;
		group.__svgGroupBound = true;
	
		group.addEventListener("pointerup", function () {
			handleGroupPointerUp(this, context);
		});
	
		group.addEventListener("mouseover", function () {
			setCursor(group, "pointer");
		});
	
		group.addEventListener("mouseout", function () {
			setCursor(group, "default");
		});
	}
	function findRepresentativeTextNode(group, clickedId) {
    if (!group) return null;

    const textNodes = group.querySelectorAll("text");
    if (!textNodes || textNodes.length === 0) return null;

    const normalizedId = (clickedId || "").trim();

    // 1순위: text 내용이 clickedId와 정확히 같은 것
    for (const textNode of textNodes) {
        const textValue = (textNode.textContent || "").trim();
        if (textValue === normalizedId) {
            return textNode;
        }
    }

    // 2순위: 편집 가능한 movepage 형식의 text
    for (const textNode of textNodes) {
        const textValue = (textNode.textContent || "").trim();
        if (isMovePageEditableTag(textValue)) {
            return textNode;
        }
    }

    // 3순위: 첫 번째 text
    return textNodes[0];
}
	/**
	 * g 그룹 클릭 시 수행되는 핵심 처리 로직.
	 * - drag/pinch 예외 처리
	 * - movepage 여부 판별
	 * - 상태 갱신
	 * - 줌 이동
	 * - 테이블 하이라이트
	 * - AJAX 정보 조회
	 */
	function handleGroupPointerUp(element, context) {
		if (shouldIgnorePointerAction()) return;
	
		reSetStyle(context.svgTypeNodes);
	
		const clickedId = element.id || "";
		if (!clickedId) return;
	
		const moveData = parseMovePageData(element);
		const drawingFile = (moveData.drawing_file || "").trim();
	
		CURRENT_SEARCH_TAG = clickedId;
		PENDING_GRID_ANCHOR = extractGridAnchorFromId(clickedId);
	
		
		const clickedTextForPopup = (element.getAttribute("id") || "").trim();
		const hasMovePage = !!(element.getAttribute("movepage") || "").trim();
		const isEditableMovePageTag = isMovePageEditableTag(clickedTextForPopup);
		
	
		// movepage도 있고, J11600-002(B-5) 형식일 때만 수정 팝업
		if (hasMovePage && isEditableMovePageTag) {
			updateSelectedNodeState(element);
		
			handleGroupZoomByType(element, clickedId, context);
		
			element.setAttribute("data-state", "selected");
			LAST_SELECTED_NODE = element;
			// group 내부에서 기준 text 찾기
   			 const textNode = findRepresentativeTextNode(element, clickedId);
			openMovePageEditPopup(element,textNode);
			return;
		}
		
		if (drawingFile) {
			PENDING_FROM_MOVE = true;
			handleMovePage(element.getAttribute("movepage"));
			return;
		}
	
		PENDING_FROM_MOVE = false;
		sessionStorage.removeItem(NAV_HISTORY_KEY);
	
		updateSelectedNodeState(element);
		handleGroupZoomByType(element, clickedId, context);
	
		element.setAttribute("data-state", "selected");
		
		tbHighlightRow(element.id);
		LAST_SELECTED_NODE = element;
	
		const primaryId = clickedId.split(",")[0];
		const targetTransform = getTransformFromGroupNode(element);
	
		var currentDataPath = CURRENT_DATA_PATH || "";
		var currentFileName = currentDataPath
			? decodeURIComponent(currentDataPath).split("/").pop()
			: "";
	
		var fallbackInfo = {
			data: currentDataPath,
			fileName: currentFileName,
			text: clickedId,
			targetTransform: targetTransform,
			iegNo: null,
			pnidTagNo: primaryId || null
		};
	
		console.log("[group click debug]", {
			clickedId: clickedId,
			primaryId: primaryId,
			targetTransform: targetTransform,
			fallbackInfo: fallbackInfo
		});

		requestPnidInfo(primaryId, fallbackInfo);
	}
	/**
	 * 현재 pointerup 이벤트를 무시해야 하는지 판단한다.
	 * pinch 직후, drag 중, drag 직후 클릭 오작동을 막기 위한 공통 조건 함수다.
	 */
	function shouldIgnorePointerAction() {
		if (isPinching || (Date.now() - lastPinchAt) < 350) return true;
		if (isDragging) return true;
		if ((Date.now() - lastDragAt) < DRAG_SUPPRESS_MS) return true;
		return false;
	}
	/**
 * 이전에 선택된 노드가 있고 현재 클릭한 노드와 다르면
 * 이전 노드의 상태를 default 로 되돌린다.
 */
	function updateSelectedNodeState(element) {
		if (LAST_SELECTED_NODE && LAST_SELECTED_NODE !== element) {
			LAST_SELECTED_NODE.setAttribute("data-state", "default");
		}
	}
	/**
 * 현재 클릭한 그룹의 도면 타입과 중복 여부를 판단하여
 * 적절한 줌 함수(highlightAndZoomToElement / highlightAndZoomSameIdGroup)를 호출한다.
 */
	function handleGroupZoomByType(element, clickedId, context) {
		const sameGroups = context.svgDoc.querySelectorAll(`g[id="${CSS.escape(clickedId)}"]`);
		const isDuplicateGroup = sameGroups.length > 1;
	
		if (isDuplicateGroup && LAST_DUPLICATE_ZOOM_ID === clickedId) {
			return;
		}
	
		if (context.ckType !== "pnid") return;
	
		if (isDuplicateGroup) {
			LAST_DUPLICATE_ZOOM_ID = clickedId;
			highlightAndZoomSameIdGroup(
				element,
				context.svgDoc,
				context.svgElement,
				panZoom,
				() => safeViewReset(panZoom, context.svgElement),
				calculateFixedCenter
			);
		} else {
			LAST_DUPLICATE_ZOOM_ID = null;
			highlightAndZoomToElement(
				element,
				context.svgDoc,
				context.svgElement,
				panZoom,
				() => safeViewReset(panZoom, context.svgElement),
				calculateFixedCenter
			);
		}
	}
	/**
 * SVG 내부의 모든 text 노드에 클릭 이벤트를 바인딩한다.
 * id 없는 g 안의 text 또는 단독 text 클릭도 처리할 수 있도록 한다.
 */
	function bindTextNodeEvents(context) {
		context.textNodes.forEach((textNode) => {
			if (textNode.__svgTextBound) return;
			textNode.__svgTextBound = true;
	
			textNode.style.pointerEvents = "auto";
			textNode.style.cursor = "pointer";
	
			textNode.addEventListener("pointerup", function (e) {
				handleTextPointerUp(e, textNode, context);
			});
		});
	}
	
	function findSemanticGroup(node) {
	let current = node;

	while (current) {
		if (current.tagName && current.tagName.toLowerCase() === "g") {
			if (isInternalViewportGroup(current)) {
				current = current.parentElement;
				continue;
			}

			const hasMetadata = !!current.querySelector(":scope > metadata");
			const hasMovePage = current.hasAttribute("movepage");
			const hasId = !!(current.getAttribute("id") || "").trim();

			if (hasMetadata || hasMovePage || hasId) {
				return current;
			}
		}
		current = current.parentElement;
	}

	return null;
}
/**
 * 클릭한 text 기준으로 상위 g 그룹을 찾고
 * 그 안의 text들을 모두 합쳐 태그 문자열을 만든다.
 * 예: HG + TW + 06A → HG-TW-06A
 */
function getCombinedTagTextFromTextNode(textNode) {
	const group = findSemanticGroup(textNode);
	if (!group) return "";

	const childGroups = Array.from(group.children).filter(el =>
		el.tagName && el.tagName.toLowerCase() === "g"
	);

	const parts = [];

	childGroups.forEach(g => {
		const textEl = g.querySelector("text");
		if (!textEl) return;

		const value = (textEl.textContent || "").trim();
		if (value) parts.push(value);
	});

	return parts.join("-");
}
function getTransformFromTextNode(textNode) {
	if (!textNode) return "";

	// 1순위: 가장 가까운 상위 g[transform]
	const transformGroup = textNode.closest("g[transform]");
	if (transformGroup) {
		const transform = (transformGroup.getAttribute("transform") || "").trim();
		if (transform && transform !== "scale(1,-1)") {
			return transform;
		}
	}

	// 2순위: text 자신의 transform
	if (textNode.hasAttribute("transform")) {
		const transform = (textNode.getAttribute("transform") || "").trim();
		if (transform && transform !== "scale(1,-1)") {
			return transform;
		}
	}

	return "";
}
function getTransformFromGroupNode(groupNode) {
	if (!groupNode) return "";

	// 1순위: group 내부 첫 번째 g[transform]
	const innerTransformGroup = groupNode.querySelector("g[transform]");
	if (innerTransformGroup) {
		const transform = (innerTransformGroup.getAttribute("transform") || "").trim();
		if (transform && transform !== "scale(1,-1)") {
			return transform;
		}
	}

	// 2순위: group 자체가 transform을 가진 경우
	if (groupNode.hasAttribute("transform")) {
		const transform = (groupNode.getAttribute("transform") || "").trim();
		if (transform && transform !== "scale(1,-1)") {
			return transform;
		}
	}

	return "";
}
	/**
 * text 요소 클릭 시 수행되는 처리 로직.
 * - drag/pinch 예외 처리
 * - 관련 g 그룹 탐색
 * - 적절한 zoom 대상 결정
 * - AJAX 정보 조회
 */
	function handleTextPointerUp(e, textNode, context) {
		e.preventDefault();
		e.stopPropagation();
	
		if (shouldIgnorePointerAction()) return;
	
		const taggedGroup = findBestTaggedGroup(textNode);
		const primaryId = getPrimaryIdFromTextNode(textNode);
		const combinedText = getCombinedTagTextFromTextNode(textNode);
		const targetTransform = getTransformFromTextNode(textNode);
	
		// 현재 클릭한 transform 전역 저장
		CURRENT_TEXT_TRANSFORM = targetTransform;
	
		var currentDataPath = CURRENT_DATA_PATH || "";
		var currentFileName = currentDataPath
			? decodeURIComponent(currentDataPath).split("/").pop()
			: "";
		var currentText = combinedText || (textNode.textContent || "").trim();
	
		var fallbackInfo = {
			data: currentDataPath,
			fileName: currentFileName,
			text: currentText,
			targetTransform: targetTransform,
			primaryId: primaryId
		};
	
		console.log("[text click debug]", {
			text: (textNode.textContent || "").trim(),
			currentText: currentText,
			taggedGroup: taggedGroup,
			taggedGroupId: taggedGroup ? taggedGroup.getAttribute("id") : null,
			taggedGroupPmtId: taggedGroup ? getPmtIdFromGroup(taggedGroup) : null,
			combinedText: combinedText,
			primaryId: primaryId,
			fallbackInfo: fallbackInfo
		});
	
		// =========================
		// movepage 분기 추가 시작
		// =========================
	
		// 핵심: 그룹 id 말고 클릭한 텍스트 자체를 검사
		const isEditableMovePageTag = isMovePageEditableTag(currentText);
	
		if (isEditableMovePageTag) {
			const popupTarget = taggedGroup || textNode.parentElement || textNode;
	
			CURRENT_SEARCH_TAG = currentText;
			PENDING_GRID_ANCHOR = extractGridAnchorFromId(currentText);
	
			if (popupTarget && popupTarget.tagName && popupTarget.tagName.toLowerCase() === "g") {
				updateSelectedNodeState(popupTarget);
	
				highlightAndZoomToElement(
					popupTarget,
					context.svgDoc,
					context.svgElement,
					panZoom,
					() => safeViewReset(panZoom, context.svgElement),
					calculateFixedCenter
				);
	
				popupTarget.setAttribute("data-state", "selected");
				LAST_SELECTED_NODE = popupTarget;
			} else {
				highlightAndZoomToElement(
					textNode,
					context.svgDoc,
					context.svgElement,
					panZoom,
					() => safeViewReset(panZoom, context.svgElement),
					calculateFixedCenter
				);
			}
	
			openMovePageEditPopup(popupTarget ,textNode);
			return;
		}
	
		// =========================
		// movepage 분기 추가 끝
		// =========================
	
		const zoomTarget = taggedGroup || textNode;
	
		if (taggedGroup) {
			updateSelectedNodeState(taggedGroup);
		}
	
		highlightAndZoomToElement(
			zoomTarget,
			context.svgDoc,
			context.svgElement,
			panZoom,
			() => safeViewReset(panZoom, context.svgElement),
			calculateFixedCenter
		);
	
		if (taggedGroup) {
			taggedGroup.setAttribute("data-state", "selected");
			LAST_SELECTED_NODE = taggedGroup;
		}
	
		requestPnidInfo(primaryId, fallbackInfo);
	}
	/**
	 * SVG 최초 로드 후 searchTag 값이 있으면
	 * grid anchor 이동 또는 일반 태그 하이라이트를 적용한다.
	 */
	function applyInitialSearchTag(context, searchTag) {
		if (shouldHandleGridAnchorSearch(searchTag, context.ckType)) {
			handleGridAnchorSearch(context, searchTag);
			return;
		}
	
		if (searchTag && context.ckType === "pnid") {
			handleSearchTagHighlight(context, searchTag);
		}
	}
	/**
 * 현재 searchTag 가 단순 id 검색이 아니라
 * "(B-5)" 같은 grid anchor 기반 이동 조건인지 판별한다.
 */
	function shouldHandleGridAnchorSearch(searchTag, currentCkType) {
		return !!(
			searchTag &&
			currentCkType === "pnid" &&
			PENDING_FROM_MOVE === true &&
			PENDING_GRID_ONLY === true &&
			isGridAnchor(searchTag)
		);
	}
	/**
 * grid anchor 기반 searchTag 를 실제 좌표로 변환하여 줌 이동한다.
 * 처리 후 pending 관련 플래그를 초기화한다.
 */
	function handleGridAnchorSearch(context, searchTag) {
		reSetStyle(context.svgTypeNodes);
	
		const ok = zoomToGridAnchor(searchTag, context.svgDoc, context.svgElement, panZoom);
	
		PENDING_GRID_ANCHOR = "";
		PENDING_FROM_MOVE = false;
		PENDING_GRID_ONLY = false;
	
		if (!ok) {
			console.warn("[grid] anchor not resolved:", searchTag);
		}
	}
	/**
 * 일반 searchTag(id) 기반으로 SVG 내 매칭되는 그룹을 찾아
 * 하이라이트 및 줌 이동을 수행한다.
 * 중복 그룹이 여러 개면 모두 selected 처리하고,
 * 1개면 runSearchTag_pmt 로 기존 검색 로직을 재사용한다.
 */
	function handleSearchTagHighlight(context, searchTag) {
		const matchedGroups = findMatchedGroupsBySearchTag(context.textNodes, searchTag);
		const count = matchedGroups.length;
	
		if (count > 1) {
			const targetGroup = matchedGroups[0];
	
			highlightAndZoomToElement(
				targetGroup,
				context.svgDoc,
				context.svgElement,
				panZoom,
				() => reSetStyle(context.svgTypeNodes),
				calculateFixedCenter
			);
	
			LAST_SELECTED_NODE = targetGroup;
	
			matchedGroups.forEach((g) => {
				g.setAttribute("data-state", "selected");
			});
		} else if (count === 1) {
			runSearchTag_pmt(
				searchTag,
				context.svgDoc,
				context.svgElement,
				panZoom,
				() => reSetStyle(context.svgTypeNodes),
				highlightAndZoomToElement,
				safeViewReset,
				calculateFixedCenter
			);
	
			matchedGroups[0].setAttribute("data-state", "selected");
		} else {
			console.warn("[searchTag] element not found:", searchTag);
		}
	
		LAST_SELECTED_NODE = findElementByMultiId(context.svgDoc, searchTag);
	}
	/**
 * text 노드 목록을 순회하면서
 * searchTag 가 포함된 g[id] 그룹들을 중복 없이 수집하여 반환한다.
 */
	function findMatchedGroupsBySearchTag(textNodes, searchTag) {
		const matchedGroupSet = new Set();
	
		textNodes.forEach((textNode) => {
			const parentG = textNode.closest("g[id]");
			if (!parentG) return;
	
			const gId = (parentG.getAttribute("id") || "").trim();
			if (gId.includes(searchTag)) {
				matchedGroupSet.add(parentG);
			}
		});
	
		return Array.from(matchedGroupSet);
	}



	// 외부에서도 사용할 수 있도록 주요 함수들을 window 전역에 등록한다.
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
	window.initFromUrlParams = initFromUrlParams;
	window.loadNavHistory = loadNavHistory;
	window.renderNavHistory = renderNavHistory;
	window.addNavHistoryEntry = addNavHistoryEntry;
	window.shouldResetNavHistory = shouldResetNavHistory


})();
