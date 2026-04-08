(function () {
    const DRAG_THRESHOLD = 5; // px 단위, 이 이상 움직이면 "드래그"로 간주
    const CHUNK_SIZE = 100;   // 한 번에 보낼 tag 개수
    const REQUEST_INTERVAL_MS = 60000; // 1분 요청 간 간격 (ms)
    const DRAG_SUPPRESS_MS = 250;

    let isDragging = false;
    let isPinching = false;
    let lastPinchAt = 0;
    let lastDragAt = 0;

    let LAST_SELECTED_NODE = null;
    let TIME_NODES = [];     // { el }
    let TIME_TIMER = null;
    let UTAG_TO_ELEMENT_LIST = [];   // [{uTag, elementName, description}, ...]
    let UTAG_INFO_BY_EL = new Map(); // Map<elementName, {uTag, description}>
    let REALTIME_VAL_BY_EL = new Map(); // Map<elementName, { val, updatedAt }>
    
    let IS_MOVEPAGE_CLICK = false;
	let LAST_MOVEPAGE_AT = 0;
	const MOVEPAGE_SUPPRESS_MS = 500;

    /**
     * 배열을 지정 개수(size) 단위로 분할한다.
     * 실시간 태그 요청 시 서버 부담을 줄이기 위해 사용한다.
     *
     */
    function chunkArray(arr, size) {
        const result = [];
        for (let i = 0; i < arr.length; i += size) {
            result.push(arr.slice(i, i + size));
        }
        return result;
    }

    // 엘리먼트가 실제로 화면에 보이는지 체크
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
     * panZoom 뷰를 안전하게 초기화한다.
     * viewer 크기가 0인 경우 fit/center 호출 시 에러 또는 잘못된 계산이 발생할 수 있으므로 방어한다.
     *
     */
    function safeViewReset(panZoom, svgElement) {
        if (!panZoom || !svgElement) return;

        const rect = svgElement.getBoundingClientRect();
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
     * 현재 실제 zoom 배율 반환
     *
     */
    function getRealZoom(panZoomInstance) {
        const transform = panZoomInstance.getTransform();
        return transform.scale;
    }
	/**
     * 유한한 숫자인지 검증
     * NaN / Infinity 방어용
     *
     */
    function isFiniteNumber(v) {
        return typeof v === "number" && isFinite(v);
    }

    // dataparc 타입의 경우, 클릭한 요소를 강조하고 확대하여 해당 요소로 이동하는 함수
    function panToCenter(panZoom, rx, ry, rw, rh) {
        const realZoom = panZoom.getSizes().realZoom;

        const panX = -(rx * realZoom) + (panZoom.getSizes().width / 2) - ((rw * realZoom) / 2);
        const panY = -(ry * realZoom) + (panZoom.getSizes().height / 2) - ((rh * realZoom) / 2);

        panZoom.pan({ x: 0, y: 0 });
        panZoom.pan({ x: panX, y: panY });
    }

    // zoom 레벨을 결정하는 함수
    function determineZoomLevel(panZoom, bbox) {
        if (bbox.width < 75 && bbox.height < 100) {
            panZoom.zoom(7);
            console.log('panZoom.zoom(7);');
        } else {
            panZoom.zoom(4);
            console.log('panZoom.zoom(4);');
        }
    }

    // svg 파일에서 Utag를 Map 형식으로 추출하는 함수
    function extractUtagToElementMap(svgDoc) {
        const list = [];
        const utagInfos = svgDoc.getElementsByTagName("UTagInfo");

        for (let i = 0; i < utagInfos.length; i++) {
            const uTag = utagInfos[i].getAttribute("UTag");
            const elName = utagInfos[i].getAttribute("ElementName");
            const desc = utagInfos[i].getAttribute("Description") || "";

            if (!uTag || !elName) {
                console.log('[extractUtagToElementMap] skip (uTag/elName missing):', { uTag, elName });
                continue;
            }

            const skipTags = ["SYS.Sample_Boiler.FC100.PV", "T3.C1.time"];
            if (skipTags.includes(uTag)) continue;

            list.push({ uTag, elementName: elName, description: desc });
        }

        return list;
    }

     /**
     * UTag 목록을 서버에 보내 실시간 값을 받아오고,
     * 최종적으로 elementName → 값 형태 객체로 변환한다.
     *
     * 내부적으로 getApiData를 호출하며, 서버 응답이
     * 1) 배열
     * 2) result 문자열 안에 JSON 배열
     * 3) 단일 객체 + result 문자열
     * 등 여러 형태로 올 수 있어 이를 모두 정규화한다.
     *
     * 반환 예시:
     * {
     *   "TextBlock_1001": "12.34",
     *   "Valve_002": "1",
     *   "Temp_001": "----"
     * }
     */
    async function fetchDataFromServer(utagToElementMap) {
        if (!Array.isArray(utagToElementMap)) {
            console.warn('[fetchDataFromServer] utagToElementMap is not an array:', typeof utagToElementMap, utagToElementMap);
        } else {
            const badUtagItems = utagToElementMap.filter(x => !x || !x.uTag || !x.elementName);
            if (badUtagItems.length) {
                console.warn('[fetchDataFromServer] invalid utagToElementMap items (missing uTag/elementName):', badUtagItems);
            }
        }

        const tagList = utagToElementMap.map(item => item.uTag);

        if (tagList.length === 0) {
            console.warn("태그 목록이 비어 있습니다.");
            return {};
        }

        let dataList = await getApiData(tagList);

        if (dataList.length === 0) {
            console.warn("서버에서 데이터를 가져오지 못했습니다.");
            return {};
        }

        if (
            Array.isArray(dataList) &&
            dataList.length === 1 &&
            dataList[0] &&
            typeof dataList[0].result === "string"
        ) {
            const inner = dataList[0].result.trim();
            if (!inner) {
                console.warn("[fetchDataFromServer] result 문자열이 비어 있습니다.");
                return {};
            }

            try {
                const parsed = JSON.parse(inner);
                if (Array.isArray(parsed)) {
                    dataList = parsed;
                } else {
                    console.warn("[fetchDataFromServer] result 파싱 결과가 배열이 아닙니다:", parsed);
                    return {};
                }
            } catch (err) {
                console.error("[fetchDataFromServer] result 문자열 JSON 파싱 실패:", err);
                console.warn("[fetchDataFromServer] result 원본:", inner);
                return {};
            }
        }
        else if (
            !Array.isArray(dataList) &&
            dataList &&
            typeof dataList.result === "string"
        ) {
            const inner = dataList.result.trim();
            if (!inner) {
                console.warn("[fetchDataFromServer] result 문자열이 비어 있습니다.(object case)");
                return {};
            }

            try {
                const parsed = JSON.parse(inner);
                if (Array.isArray(parsed)) {
                    dataList = parsed;
                } else {
                    console.warn("[fetchDataFromServer] result 파싱 결과가 배열이 아닙니다.(object case):", parsed);
                    return {};
                }
            } catch (err) {
                console.error("[fetchDataFromServer] result 문자열 JSON 파싱 실패(object case):", err);
                console.warn("[fetchDataFromServer] result 원본(object case):", inner);
                return {};
            }
        }

        if (!Array.isArray(dataList) || dataList.length === 0) {
            console.warn("[fetchDataFromServer] 서버에서 데이터를 가져오지 못했습니다. (정규화 후 빈 배열)");
            return {};
        }

        const tagToElementMap = [];

        utagToElementMap.forEach(({ uTag, elementName }) => {
            tagToElementMap.push({ std_tag: uTag, elementName });
        });

        const result = {};

        dataList.forEach(({ std_tag, Val }) => {
            tagToElementMap.forEach(({ std_tag: uTag, elementName }) => {
                if (uTag === std_tag) {
                    result[elementName] = Val;
                }
            });
        });

        tagToElementMap.forEach(({ elementName }) => {
            if (!(elementName in result)) {
                result[elementName] = "----";
            }
        });

        return result;
    }
 	/**
     * 서버 API(/multiview/dataparc/getdata.do)를 호출해 태그값을 raw text로 받아오고,
     * 응답 포맷이 깨져 있더라도 최대한 복구하여 배열로 반환한다.
     *
     * 현재 서버 응답이 정형 JSON 배열이 아닐 가능성을 고려해
     * 문자열을 보정해서 JSON.parse 시도하는 로직을 포함한다.
     *
     * 반환 예시:
     * [
     *   { std_tag: "...", Val: "..." },
     *   ...
     * ]
     *
     */
    function getApiData(tagList) {
        if (!Array.isArray(tagList) || tagList.length === 0) {
            console.warn("[getApiData] tagList 가 비어있거나 유효하지 않습니다:", tagList);
            return Promise.resolve([]);
        }

        const url = "/multiview/dataparc/getdata.do";

        return new Promise(function (resolve) {
            $.ajax({
                url: url,
                type: "POST",
                data: {
                    tags: tagList.join(",")
                },
                dataType: "text",
                success: function (rawText) {
                    try {
                        const trimmedText = (rawText || "").trim();
                        let dataList = [];
                        let cleaned_dataList = [];

                        if (trimmedText.startsWith("{") && !trimmedText.startsWith("[")) {
                            const fixedJson = ("[" + trimmedText + "]").replace(/},\s*{/g, "},{");

                            try {
                                dataList = JSON.parse(fixedJson);
                                if (!Array.isArray(dataList)) {
                                    console.log('[getApiData] payload is not array, try data:', typeof dataList, dataList);
                                    dataList = (dataList && Array.isArray(dataList.data)) ? dataList.data : [];
                                }
                                cleaned_dataList = dataList.map(({ id, ...rest }) => rest);
                                console.log("비정형 JSON 파싱 성공:", cleaned_dataList);
                            } catch (nestedErr) {
                                console.error("JSON 포맷이 잘못되었습니다:", nestedErr);
                                console.warn("원시 응답 내용:", rawText);
                                return resolve([]);
                            }
                        } else {
                            try {
                                dataList = JSON.parse(trimmedText);
                                if (!Array.isArray(dataList)) {
                                    console.log('[getApiData] payload is not array, try data:', typeof dataList, dataList);
                                    dataList = (dataList && Array.isArray(dataList.data)) ? dataList.data : [];
                                }
                                cleaned_dataList = dataList.map(({ id, ...rest }) => rest);
                            } catch (error) {
                                console.error("JSON 파싱 실패 (정형):", error);
                                console.warn("원시 응답 내용:", rawText);
                                return resolve([]);
                            }
                        }

                        resolve(cleaned_dataList);
                    } catch (e) {
                        console.error("getApiData 내부 처리 오류:", e);
                        resolve([]);
                    }
                },
                error: function (xhr, status, err) {
                    console.error("getApiData AJAX 오류:", status, err);
                    resolve([]);
                }
            });
        });
    }
  	/**
     * 로컬 SVG 파일 업로드 input change 이벤트를 바인딩한다.
     * 사용자가 SVG 파일을 직접 업로드해서 viewer에 띄우는 기능이다.
     */
    function setupFileInputHandler() {
        const svgFileInput = document.getElementById("svgFileInput");

        svgFileInput.addEventListener("change", function (e) {
            const file = e.target.files[0];
            const reader = new FileReader();

            if (!file || !file.name.endsWith(".svg")) {
                alert("SVG 파일만 가능합니다.");
                return;
            }

            reader.onload = function (event) {
                const svgText = event.target.result;
                const blob = new Blob([svgText], { type: "image/svg+xml" });
                const blobURL = URL.createObjectURL(blob);
                createAndLoadSVG(blobURL);
            };

            reader.readAsText(file);
        });
    }
	/**
     * SVG 파일이 실제 존재하는지 HEAD 요청으로 검사
     *
     */
    async function checkSvgExists(url) {
        try {
            const res = await fetch(url, { method: "HEAD" });
            return res.ok;
        } catch (e) {
            console.warn("checkSvgExists 실패:", e);
            return false;
        }
    }
    /**
  	* URL 파라미터(dataPath, searchTag)를 읽어 초기 SVG를 로드한다.
     * dataPath가 없으면 아무 동작도 하지 않는다.
     * dataPath가 존재하지만 실제 파일이 없으면 경고 팝업 표시
     */
    async function initFromUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const dataPath = params.get("dataPath");
        const searchTag = params.get("searchTag");
        if (!dataPath) return;

        const exists = await checkSvgExists(dataPath);

        if (!exists) {
            $.alert({
                icon: 'bi bi-exclamation-triangle',
                title: 'DataPARC',
                content: '해당 파일이 존재하지 않습니다.',
                animation: 'scale',
                type: 'red'
            });
            return;
        }

        if (dataPath) createAndLoadSVG(dataPath, searchTag);
    }
 	/**
     * 값 문자열을 format 패턴 기준으로 소수점 자릿수 맞춰 표시한다.
     * 예: format="0.00" 이면 12.345 -> "12.35"
     */
    function formatTextValue(val, format = "0.00") {
        const num = parseFloat(val);

        if (isNaN(num)) {
            return "___";
        }

        const match = format.match(/0\.?(0*)/);
        const decimals = match ? match[1].length : 0;

        return num.toFixed(decimals).toString();
    }
 	/**
     * 값에 따라 상태 색상을 반환한다.
     * 주로 binary/상태 표시용
     */
    function getColorForValue(val) {
        const num = Number(val);
        if (isNaN(num)) return "gray";
        if (num < 0) return "#C0C0C0";
        if (num === 0) return "#00FF00";
        if (num === 1) return "#FF0000";
        if (num > 1) return "#C0C0C0";
        return "gray";
    }

    function isTimeValue(val) {
        return typeof val === 'string' && val.includes(":");
    }
	/**
     * 현재 시간을 yyyy-MM-dd HH:mm:ss 형태 문자열로 반환
     *
     */
    function formatDateTime(date = new Date()) {
        const pad = (n) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
            `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }
    /**
     * PVcvtMapItem 규칙에 따라 입력값(value)에 대응하는 outValue를 찾는다.
     *
     * 우선순위:
     * 1. PVcvtMapItem의 범위 매칭 결과 OutValue  / PVcvtMapItem : (도면 내부에 요소별 가지는 코드 값)
     * 2. MultiBinding의 FallbackValue
     * 3. 요소 자체의 fillcolor/strokecolor 속성
     *
     * DataPARC svg의 WPF 변환 정의를 해석하는 핵심 유틸이다.
     *
     * @param {Element} el 실제 렌더링 대상 요소
     * @param {Element} pvDefs defs 영역 내 정의 노드
     * @param {string|number} value 실시간 값
     * @param {string} id 요소 id
     * @param {*} fallbackSelector 특별 fallback 분기용 플래그
     * @returns {string|null}
     */
    function getMatchedOrFallbackValues(el, pvDefs, value, id, fallbackSelector = null) {
        const pvCvtMapItems = pvDefs.getElementsByTagName("PVcvtMapItem");
        const numVal = parseFloat(value);
        let matchedValue = null;

        if (pvCvtMapItems.length > 0) {
            const itemsArray = Array.from(pvCvtMapItems);
            const prioritizedItems = itemsArray.filter(i => i.getAttribute("Oper"));
            const fallbackItems = itemsArray.filter(i => !i.getAttribute("Oper"));
            const combinedItems = [...prioritizedItems, ...fallbackItems];

            for (let i = 0; i < combinedItems.length; i++) {
                const item = combinedItems[i];
                const min = item.getAttribute("MinRange");
                const max = item.getAttribute("MaxRange");
                const oper = item.getAttribute("Oper") || "";
                const outValue = item.getAttribute("OutValue");

                const minVal = min === "" ? -Infinity : parseFloat(min);
                const maxVal = max === "" ? +Infinity : parseFloat(max);

                let match = false;

                switch (oper) {
                    case "LELE":
                        match = numVal >= minVal && numVal <= maxVal;
                        break;
                    case "LTLE":
                        match = numVal > minVal && numVal <= maxVal;
                        break;
                    case "LELT":
                        match = numVal >= minVal && numVal < maxVal;
                        break;
                    case "LTLT":
                        match = numVal > minVal && numVal < maxVal;
                        break;
                    case "EQEQ":
                        if (min !== "" && max !== "") {
                            match = parseFloat(min) === parseFloat(max) && numVal === parseFloat(min);
                        } else if (min !== "") {
                            match = numVal === parseFloat(min);
                        } else if (max !== "") {
                            match = numVal === parseFloat(max);
                        }
                        break;
                    default:
                        match = numVal >= minVal && numVal <= maxVal;
                }

                if (match) {
                    if (outValue !== "") {
                        matchedValue = outValue;
                    } else {
                        matchedValue = null;
                    }
                    break;
                }
            }
        }

        if (matchedValue) {
            return matchedValue;
        }

        let fallbackValue = null;

        if (fallbackSelector) {
            const foregroundTags = pvDefs.getElementsByTagName("PVTextBlock.Foreground");
            if (foregroundTags.length > 0) {
                const multiBindings = foregroundTags[0].getElementsByTagName("MultiBinding");
                if (multiBindings.length > 0) {
                    fallbackValue = multiBindings[0].getAttribute("FallbackValue") || null;
                }
            }
        } else {
            const multiBindings = pvDefs.getElementsByTagName("MultiBinding");
            if (multiBindings.length > 0) {
                fallbackValue = multiBindings[0].getAttribute("FallbackValue") || null;
            }
        }

        if (fallbackValue && fallbackValue !== "") {
            return fallbackValue;
        } else {
            const colorAttr = el.getAttribute("fillcolor") || el.getAttribute("strokecolor");
            return colorAttr;
        }
    }

    function onShotVisibleToHidden() {
        const viewboxElements = svgDoc.querySelectorAll('[wpftagname="Viewbox"]');

        viewboxElements.forEach(vb => {
            const styleAttr = vb.getAttribute("style");
            if (styleAttr && styleAttr.includes("visibility:Visible")) {
                const newStyle = styleAttr.replace(/visibility\s*:\s*Visible/i, "visibility:hidden");
                vb.setAttribute("style", newStyle);
            }
        });
    }

    function formatYMD_tt_hms(date = new Date()) {
        const pad = n => String(n).padStart(2, '0');
        const yyyy = date.getFullYear(), MM = pad(date.getMonth() + 1), dd = pad(date.getDate());
        const h24 = date.getHours(), tt = (h24 < 12 ? 'AM' : 'PM'), h12 = (h24 % 12) || 12;
        return `${yyyy}-${MM}-${dd} ${tt} ${h12}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    function chkMultiBidTime(el, pvDefs) {
        const multiBinding = pvDefs.querySelector('MultiBinding[ConverterParameter="yyyy-MM-dd HH:mm:ss"]');
        if (!multiBinding) return false;

        if (!TIME_NODES.some(x => x.el === el)) {
            TIME_NODES.push({ el });
            el.style.fill = "white";
        }

        return true;
    }

    function startTimeTick() {
        if (TIME_TIMER) clearInterval(TIME_TIMER);

        TIME_TIMER = setInterval(() => {
            const now = formatDateTime();

            for (const { el } of TIME_NODES) {
                if (!el) continue;
                const tspan = el.querySelector("tspan");
                if (tspan) tspan.textContent = now;
                else el.textContent = now;
            }
        }, 1000);
    }
    // 좌표 이동 계산 함수 
     /**
     * 거리값 기반으로 확대 보정 지수(EXP)를 계산한다.
     * calculateFixedCenter에서 화면 중심 보정 계수를 만들기 위해 사용한다.
     *
     */

    function computeEXP(distance, minDist, maxDist, minEXP = 2.0, maxEXP = 3.3) {
        if (distance <= minDist) return minEXP;
        if (distance >= maxDist) return maxEXP;
        return minEXP + (maxEXP - minEXP) * ((distance - minDist) / (maxDist - minDist));
    }
	/**
     * 특정 요소를 화면 중앙에 보다 자연스럽게 맞추기 위한 고정 중심 좌표를 계산한다.
     *
     * 단순 bbox 중심만 사용하는 대신,
     * 현재 screenCTM / iframe 크기 / 확대 비율 / 화면 중심과의 거리 등을 고려해
     * zoomAtPoint 시 더 안정적으로 중앙에 들어오도록 보정한다.
     *
     * 주로 PNID / baked translate text 클릭 시 사용한다.
     *
     */
    function calculateFixedCenter(element, svgElement, svgDoc, containerId = 'svgarea') {
        if (!element) {
            console.error("Element is not defined");
            return;
        }

        const bbox = element.getBBox();
        const screenCTM = element.getScreenCTM();

        const centerX = (bbox.x + bbox.width / 2) * screenCTM.a + screenCTM.e;
        const centerY = (bbox.y + bbox.height / 2) * screenCTM.d + screenCTM.f;

        const viewWidth = svgElement.clientWidth || svgElement.getBoundingClientRect().width;
        const viewHeight = svgElement.clientHeight || svgElement.getBoundingClientRect().height;

        const svgArea = document.getElementById(containerId);

        const iframeWidth = svgArea.clientWidth;
        const iframeHeight = svgArea.clientHeight;

        const zoomScale = Math.min(
            Math.min(viewWidth / bbox.width, viewHeight / bbox.height) * 0.5,
            10.0
        );

        const deltaX = (iframeWidth / 2 - centerX) / zoomScale;
        const deltaY = (iframeHeight / 2 - centerY) / zoomScale;

        const screenCenterX = iframeWidth / 2;
        const screenCenterY = iframeHeight / 2;

        const distanceX = Math.abs(centerX - screenCenterX);
        const distanceY = Math.abs(centerY - screenCenterY);

        const aspectRatioX = iframeWidth / (iframeWidth + iframeHeight) * zoomScale;
        const aspectRatioY = iframeHeight / (iframeWidth + iframeHeight) * zoomScale;

        const EXP_X = computeEXP(distanceX, 0, screenCenterX);
        const EXP_Y = computeEXP(distanceY, 0, screenCenterY);

        const baseOffsetX = aspectRatioX * Math.pow(zoomScale, EXP_X) * 0.001;
        const baseOffsetY = aspectRatioY * Math.pow(zoomScale, EXP_Y) * 0.001;

        const offsetX = (centerX < screenCenterX) ? -baseOffsetX : baseOffsetX;
        const offsetY = (centerY < screenCenterY) ? -baseOffsetY : baseOffsetY;

        const fixedCenterX = centerX - deltaX + offsetX;
        const fixedCenterY = centerY - deltaY + offsetY;

        return { fixedCenterX, fixedCenterY, centerX, centerY, bbox, zoomScale };
    }
  	/**
     * 선택 요소를 강조/확대/중앙이동한다.
     *
     * 이 함수는 bbox 기반 panToCenter 방식이 아니라,
     * 화면 좌표 기반 zoomAtPoint 보정 방식으로 동작한다.
     * PNID 또는 text 직접 클릭(baked translate 포함) 시 주로 사용한다.
     */
    function highlightAndZoomToElement(
        element,
        svgDoc,
        svgElement,
        panZoom,
        safeViewResetFn,
        calculateFixedCenterFn
    ) {
        if (!element || !panZoom || !svgElement) return;

        const rect = svgElement.getBoundingClientRect();
        if (!rect.width || !rect.height) {
            console.warn("[highlightAndZoomToElement] viewer size is 0, skip zoom");
            return;
        }

        safeViewResetFn(panZoom, svgElement);

        requestAnimationFrame(() => {
            const result = calculateFixedCenterFn(element, svgElement, svgDoc);
            if (!result) return;

            const { fixedCenterX, fixedCenterY, zoomScale } = result;

            if (
                !isFiniteNumber(fixedCenterX) ||
                !isFiniteNumber(fixedCenterY) ||
                !isFiniteNumber(zoomScale) ||
                zoomScale <= 0
            ) {
                console.warn("[highlightAndZoomToElement] invalid center or zoomScale, skip:", {
                    fixedCenterX, fixedCenterY, zoomScale
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
 	/**
     * searchTag 값으로 SVG 내 id를 검색하여 해당 요소를 확대/중앙 정렬한다.
     * multi-id("A,B,C") 형태도 지원한다.
     *
     * 주로 URL 파라미터 searchTag 초기 검색에 사용된다.
     *
     */
    function runSearchTag_vnet(targetId, svgDoc, panZoom, reSetStyleFn) {
        if (!svgDoc) return;

        reSetStyleFn();

        const allItems = svgDoc.querySelectorAll("[id]");

        const item = Array.from(allItems).find(el => {
            const ids = el.id.split(",").map(id => id.trim());
            return ids.includes(targetId);
        });

        if (!item) {
            console.warn("요소를 찾을 수 없습니다:", targetId);
            alert("ID  : " + targetId + "에 해당하는 요소를 찾을 수 없습니다.");
            return;
        }

        const bbox = item.getBBox();
        const baked = !!item?.querySelector?.('text[data-baked-translate="1"]');

        if (baked) {
            panZoom.zoom(10);
        } else {
            determineZoomLevel(panZoom, bbox);
        }

        panZoom.pan({ x: 0, y: 0 });

        const realZoom = panZoom.getSizes().realZoom;

        panZoom.pan({
            x: -(bbox.x * realZoom) + (panZoom.getSizes().width / 2) - ((bbox.width * realZoom) / 2),
            y: -(bbox.y * realZoom) + (panZoom.getSizes().height / 2) - ((bbox.height * realZoom) / 2)
        });
    }

    function setCursor(version_prent, type) {
        version_prent.style.cursor = type;
    }
 	/**
     * 기존 선택/hover로 인해 들어간 fill/stroke 스타일을 초기화한다.
     * 현재는 text / tspan의 강조 속성 제거 용도로 사용한다.
     *
     */
    function reSetStyle(version) {
        for (let i = 0; i < version.length; i++) {
            const node = version[i];
            const g = node.closest ? node.closest("g") : node?.parentNode?.parentNode;
            if (!g) continue;

            g.style.removeProperty("fill");
            g.removeAttribute("fill");

            const texts = g.querySelectorAll("text, tspan");
            texts.forEach(node => {
                node.style.removeProperty("fill");
                node.removeAttribute("fill");

                node.style.removeProperty("stroke");
                node.removeAttribute("stroke");

                node.style.removeProperty("stroke-width");
                node.removeAttribute("stroke-width");
            });
        }
    }
  	/**
     * 선택 대상 주위에 외곽선을 그리기 위한 rect 요소를 생성한다.
     * 실제 DOM에 삽입하지는 않고, bbox 보정 계산용으로 사용되는 경우가 많다.
     *
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
     * 서버에서 받은 실시간 값들을 실제 SVG 요소에 반영한다.
     *
     * elementName(id) 기준으로 요소/defs를 찾아
     * PVTextBlock, Path, Polygon, Rect, Viewbox 등 타입별 처리 함수로 위임한다.
     *
     * 각 요소의 최신 값은 REALTIME_VAL_BY_EL 에 캐시된다.
     *
     * @param {Document} svgDoc
     * @param {Object} updatedData { elementId: value }
     */
    function upDateTagValues(svgDoc, updatedData) {
        dtDisplaysCheckHandler(svgDoc);

        for (const [id, value] of Object.entries(updatedData)) {
            REALTIME_VAL_BY_EL.set(id, { val: value, updatedAt: Date.now() });

            const el = svgDoc.getElementById(id);
            const pvDefs = svgDoc.getElementById("defs_" + id);
            if (!el || !pvDefs) {
                continue;
            }

            if (chkMultiBidTime(el, pvDefs)) {
                continue;
            }

            const tagName = el.tagName.toLowerCase();
            const wpftagName = el.getAttribute("wpftagname")?.toLowerCase() || "";

            if (wpftagName.includes("pvtextblock")) {
                if (handlePVTextBlock(el, pvDefs, value, id)) continue;
            } else if (wpftagName.includes("path")) {
                if (handleSetFillColor(el, pvDefs, value, id)) continue;
            } else if (wpftagName.includes("polygon")) {
                if (handleSetFillColor(el, pvDefs, value, id)) continue;
            } else if (wpftagName.includes("polylineconnector")) {
                if (handlePolyLinecon(el, pvDefs, value, id)) continue;
            } else if (wpftagName.includes("ellipse")) {
                if (handleSetFillColor(el, pvDefs, value, id)) continue;
            } else if (wpftagName.includes("rect")) {
                if (handleProcessRect(svgDoc, el, pvDefs, value, id)) continue;
            } else if (wpftagName.includes("colorcanvas")) {
                if (handleColorCanvas(el, pvDefs, value, id)) continue;
            } else if (wpftagName.includes("lineconnector")) {
                if (handleLineCon(el, pvDefs, value, id)) continue;
            } else if (wpftagName.includes("viewbox")) {
                if (handleViewBox(el, pvDefs, value, id)) continue;
            } else {
                console.warn("Unsupported tag: " + tagName + "for element: " + id);
            }
        }
    }
 	/**
     * DataPARC 실시간 갱신 루프 시작
     *
     * 동작 방식:
     * 1. 전체 태그를 CHUNK_SIZE 단위로 나눈다.
     * 2. 최초 1회는 모든 chunk를 순회하며 전체 값을 병합하여 한 번에 그린다.
     * 3. 이후 interval마다 chunk 하나씩만 갱신해 서버 부담을 낮춘다.
     *
     */
    function startDataparcRealtimeUpdate(svgDoc, utagToElementMap, intervalMs) {
        if (!svgDoc) {
            console.warn("[startDataparcRealtimeUpdate] svgDoc 없음");
            return;
        }
        if (!Array.isArray(utagToElementMap) || utagToElementMap.length === 0) {
            console.warn("[startDataparcRealtimeUpdate] utagToElementMap 비어 있음");
            return;
        }

        const chunks = chunkArray(utagToElementMap, CHUNK_SIZE);
        if (!chunks.length) return;

        let chunkIndex = 0;

        if (window.updateTimer) {
            clearInterval(window.updateTimer);
            window.updateTimer = null;
        }

        async function processChunkByIndex(idx) {
            const currentChunk = chunks[idx];

            try {
                const partialData = await fetchDataFromServer(currentChunk);
                if (partialData && Object.keys(partialData).length > 0) {
                    upDateTagValues(svgDoc, partialData);
                }
            } catch (e) {
                console.error("[startDataparcRealtimeUpdate] chunk 처리 중 에러:", e);
            }
        }

        (async () => {
            const mergedData = {};

            for (let i = 0; i < chunks.length; i++) {
                const currentChunk = chunks[i];
                try {
                    const partialData = await fetchDataFromServer(currentChunk);
                    Object.assign(mergedData, partialData);
                } catch (e) {
                    console.error("[초기 chunk 병합 중 에러]:", e);
                }
            }

            upDateTagValues(svgDoc, mergedData);

            chunkIndex = 0;
            window.updateTimer = setInterval(async () => {
                await processChunkByIndex(chunkIndex);
                chunkIndex = (chunkIndex + 1) % chunks.length;
            }, intervalMs);
        })();
    }

    // ---------------------------
    // PNID와 동일한 흐름으로 추가한 함수들
    // ---------------------------
    /**
     * svg-pan-zoom이 내부적으로 추가한 viewport wrapper g인지 판별한다.
     * 실제 업무용 설비 g와 구분하기 위해 사용한다.
     *
     * @param {Element} group
     * @returns {boolean}
     */
    function isInternalViewportGroup(group) {
        if (!group) return false;

        const gid = (group.getAttribute("id") || "").trim();
        const cls = (group.getAttribute("class") || "").trim();

        if (gid.startsWith("viewport-")) return true;
        if (cls.includes("svg-pan-zoom_viewport")) return true;
        if (gid.includes("svg-pan-zoom")) return true;

        return false;
    }
    /**
     * 클릭한 text/node 기준으로 가장 적절한 상위 g를 찾는다.
     *
     * 기준:
     * - svg-pan-zoom 내부 wrapper g는 제외
     * - id가 있거나
     * - 내부에 text[id]가 있거나
     * - 내부에 임의의 [id] 자식이 있으면 후보로 인정
     *
     * @param {Element} node
     * @returns {SVGGElement|null}
     */
    function findBestTaggedGroup(node) {
        let current = node ? node.parentElement : null;

        while (current) {
            if (current.tagName && current.tagName.toLowerCase() === "g") {
                if (isInternalViewportGroup(current)) {
                    current = current.parentElement;
                    continue;
                }

                const gid = (current.getAttribute("id") || "").trim();
                const textWithId = current.querySelector("text[id]");
                const childWithId = current.querySelector("[id]");

                if (gid || textWithId || childWithId) {
                    return current;
                }
            }
            current = current.parentElement;
        }

        return null;
    }
        /**
     * text 클릭 시 대표 id(primary id)를 구한다.
     *
     * 현재 정책:
     * - 가장 적절한 상위 g를 찾고
     * - 그 g의 id가 있으면 첫 번째 id만 사용
     * - g id가 없으면 null 반환
     *
     * 예: id="A,B,C" 이면 "A"
     *
     * @param {SVGTextElement} textNode
     * @returns {string|null}
     */
    function getPrimaryIdFromTextNode(textNode) {
    if (!textNode) return null;

    const taggedGroup = findBestTaggedGroup(textNode);

    if (taggedGroup) {
        const gid = (taggedGroup.getAttribute("id") || "").trim();
        if (gid) return gid.split(",")[0];
    }

    return null;
}

 /**
     * g 자체 id가 없을 때 text[id] 또는 하위 [id]를 fallback으로 찾아 반환한다.
     * 그룹 클릭 처리에서 "대표 클릭 대상 id"를 뽑을 때 사용
     *
     * @param {SVGGElement} group
     * @returns {string}
     */
    function getClickableIdFromGroup(group) {
        if (!group) return "";

        const gid = (group.getAttribute("id") || "").trim();
        if (gid) return gid;

        const textWithId = group.querySelector("text[id]");
        if (textWithId) {
            const tid = (textWithId.getAttribute("id") || "").trim();
            if (tid) return tid;
        }

        const childWithId = group.querySelector("[id]");
        if (childWithId) {
            const cid = (childWithId.getAttribute("id") || "").trim();
            if (cid) return cid;
        }

        return "";
    }
     /**
     * g 태그가 "실제 업무용 id"를 가지고 있는지 검사
     *
     * @param {SVGGElement} group
     * @returns {boolean}
     */
    function hasRealGroupId(group) {
    if (!group) return false;
    return !!(group.getAttribute("id") || "").trim();
}
 /**
     * DataPARC 설비 id(primaryId)로 서버(/admin/dataparc/clicktag.do)에 조회 요청을 보내고,
     * 결과를 팝업 함수 fnDataparcInfo 로 전달한다.
     *
     * 특징:
     * - 응답이 비어 있어도 fallbackInfo 기반으로 팝업을 띄운다.
     * - 부모 iframe의 src에서 현재 dataPath를 읽어 현재 도면 기준 데이터 선택
     *
     * @param {string} primaryId
     * @param {{data?:string,fileName?:string,text?:string,textElementId?:string}} fallbackInfo
     */
  function requestDataparcInfoById(primaryId, fallbackInfo) {
    $.ajax({
        url: "/admin/dataparc/clicktag.do",
        type: "POST",
        dataType: "json",
        data: {
            dataTagNo: primaryId || ""
        },
        success: function (resp) {
            let info;
            let iegNo;

            var iframeSrc = window.parent.$("#_VIEW_IFRAME").attr("src") || "";
            var currentDataPath = "";
            var currentFileName = "";
            var currentText = "";
            var currentTextElementId = "";

            if (iframeSrc) {
                var queryString = iframeSrc.split("?")[1] || "";
                var params = new URLSearchParams(queryString);
                currentDataPath = decodeURIComponent(params.get("dataPath") || "");
                currentFileName = currentDataPath.split("/").pop() || "";
            }

            if (fallbackInfo) {
                currentDataPath = fallbackInfo.data || currentDataPath;
                currentFileName = fallbackInfo.fileName || currentFileName;
                currentText = fallbackInfo.text || "";
                currentTextElementId = fallbackInfo.textElementId || "";
            }

            // 빈 응답이어도 팝업은 띄우기
            if (!resp || !resp.length) {
                info = {
                    data: currentDataPath || null,
                    fileName: currentFileName || null,
                    text: currentText || null,
                    textElementId: currentTextElementId || null,
                    iegNo: null,
                    dataTagNo: primaryId || null
                };
                iegNo = null;
            } else {
                if (!iframeSrc) {
                    console.warn("부모 iframe src를 찾지 못했습니다.");
                    info = resp[0];
                } else {
                    var queryString = iframeSrc.split("?")[1] || "";
                    var params = new URLSearchParams(queryString);
                    var currentDataPath = decodeURIComponent(params.get("dataPath") || "");

                    info = null;

                    for (var i = 0; i < resp.length; i++) {
                        if (resp[i].data === currentDataPath) {
                            info = resp[i];
                            break;
                        }
                    }

                    if (!info) info = resp[0];
                }

                // 응답값이 일부 비어 있으면 fallback으로 보강
                if (!info.data) info.data = currentDataPath || null;
                if (!info.fileName) info.fileName = currentFileName || null;
                if (!info.text) info.text = currentText || null;
                if (!info.textElementId) info.textElementId = currentTextElementId || null;
                if (!info.dataTagNo) info.dataTagNo = primaryId || null;

                iegNo = info.iegNo;
            }

            console.log("선택된 info:", info);
     
            //기존에서 info 값 넘기는 걸로 수정 
            fnDataparcInfo(info);
        },
        error: function (xhr, status, err) {
            console.error("[clicktag] AJAX 오류:", status, err);

            fnDataparcInfo(null, null);	
        }
    });
}
/**
 * 클릭 제외 대상 텍스트인지 판별
 * 예: mm, barg, degC, %
 */
function isIgnoredTextLabel(textNode) {
    if (!textNode) return false;

    // text 전체 문자열
    const rawText = (textNode.textContent || "")
        .replace(/\s+/g, " ")
        .trim();

    // 제외할 텍스트 목록
    const ignoredSet = new Set(["mm", "barg", "degC", "%","bar","A","mbar", "mbarg","ppm","mg/sm3","PPM","T/H","m3/h","M/W","RPM","℃","mmHg","Mvar","um","mm/s","HR","min"]);

    return ignoredSet.has(rawText);
}
 /**
     * text 노드 pointerup 이벤트 처리		
     *
     * 처리 순서:
     * 1. pinch/drag 직후 클릭 오인 방지
     * 2. 상위 g 판별 및 primary id 계산
     * 3. 확대/중앙정렬
     * 4. 선택 상태(data-state) 갱신
     * 5. fallbackInfo 구성 후 설비 정보 요청
     *
     */
    function handleTextPointerUp(e, textNode, svgDoc, svgElement, panZoom, svgType, ckType) {
        if (e.__handledByDataparcUtag) return;
        
        if (isMovePageElement(textNode)) {
        return;
	    }
	
	    if (IS_MOVEPAGE_CLICK || (Date.now() - LAST_MOVEPAGE_AT) < MOVEPAGE_SUPPRESS_MS) {
	        return;
	    }
        
        // mm, barg, degC, % 는 클릭 무시
	    if (isIgnoredTextLabel(textNode)) {
	        return;
	    }

        e.preventDefault();
        e.stopPropagation();

        if (isPinching || (Date.now() - lastPinchAt) < 350) return;
        if (isDragging) return;
        if ((Date.now() - lastDragAt) < DRAG_SUPPRESS_MS) return;

        const taggedGroup = findBestTaggedGroup(textNode);
        const primaryId = getPrimaryIdFromTextNode(textNode);

        reSetStyle(svgType);

        const useGroupTarget = taggedGroup && hasRealGroupId(taggedGroup);
		const zoomTarget = useGroupTarget ? taggedGroup : textNode;

        if (LAST_SELECTED_NODE && LAST_SELECTED_NODE !== taggedGroup) {
		    if (hasRealGroupId(LAST_SELECTED_NODE)) {
		        LAST_SELECTED_NODE.setAttribute("data-state", "default");
		    } else {
		        LAST_SELECTED_NODE.removeAttribute("data-state");
		    }
		}
		      const baked =
		    !!zoomTarget?.querySelector?.('text[data-baked-translate="1"]') ||
		    zoomTarget?.getAttribute?.("data-baked-translate") === "1";
		
		// pnid 이거나,
		// 실제 g id 없는 text 이거나,
		// baked text 이면
		// bbox + panToCenter 대신 화면 좌표 기준 zoom 사용
		if (ckType === "pnid" || !useGroupTarget || baked) {
		    highlightAndZoomToElement(
		        zoomTarget,
		        svgDoc,
		        svgElement,
		        panZoom,
		        safeViewReset,
		        calculateFixedCenter
		    );
		} else {
		    const bbox = zoomTarget.getBBox();
		    const outline = createOutlineRect(svgDoc, svgns, bbox, primaryId || "text-click");
		    const rx = parseFloat(outline.getAttribute('x'));
		    const ry = parseFloat(outline.getAttribute('y'));
		    const rw = parseFloat(outline.getAttribute('width'));
		    const rh = parseFloat(outline.getAttribute('height'));
		
		    determineZoomLevel(panZoom, bbox);
		    panToCenter(panZoom, rx, ry, rw, rh);
		}

        if (taggedGroup && hasRealGroupId(taggedGroup)) {
		    taggedGroup.setAttribute("data-state", "selected");
		    LAST_SELECTED_NODE = taggedGroup;
		}
		  // fallbackInfo 직접 생성
    var iframeSrc = window.parent.$("#_VIEW_IFRAME").attr("src") || "";
    var currentDataPath = "";
    var currentFileName = "";
    var currentText = (textNode.textContent || "").trim();

    if (iframeSrc) {
        var queryString = iframeSrc.split("?")[1] || "";
        var params = new URLSearchParams(queryString);
        currentDataPath = decodeURIComponent(params.get("dataPath") || "");
        currentFileName = currentDataPath.split("/").pop() || "";
    }

    var fallbackInfo = {
        data: currentDataPath,
        fileName: currentFileName,
        text: currentText,
        textElementId: (textNode.getAttribute("id") || "").trim()
    };

        requestDataparcInfoById(primaryId ,fallbackInfo);
    }
  /**
     * SVG 내 모든 text 노드에 pointerup 클릭 이벤트를 바인딩한다.
     * 중복 바인딩 방지를 위해 __svgTextBound 플래그 사용
     *
     */
    function bindTextNodeEvents(svgDoc, svgElement, panZoom, svgType, ckType) {
        const textNodes = svgElement.querySelectorAll("text");

        textNodes.forEach((textNode) => {
            if (textNode.__svgTextBound) return;
            textNode.__svgTextBound = true;
            
            if (isIgnoredTextLabel(textNode)) {
            textNode.style.pointerEvents = "none"; // 아예 클릭 통과
            textNode.style.cursor = "default";
            return;
        }

            textNode.style.pointerEvents = "auto";
            textNode.style.cursor = "pointer";

            textNode.addEventListener("pointerup", function (e) {
                handleTextPointerUp(e, textNode, svgDoc, svgElement, panZoom, svgType, ckType);
            });
        });
    }

     /**
     * 클릭 대상 주변의 g에서 data-utag-key를 확보한다.
     * 없으면 text[id] → 상위 [id] 순서로 찾아서 g에 캐싱한다.
     *
     * DataPARC 실시간 UTag 팝업 클릭의 key 추출용
     *
     */
   /* function ensureUtagKeyOnG(target) {
        const g = target.closest ? target.closest("g") : null;
        if (!g) return { g: null, key: "" };

        let key = g.getAttribute("data-utag-key") || "";
        if (key) return { g, key };

        const textWithId = g.querySelector("text[id]");
        if (textWithId) {
            key = textWithId.getAttribute("id") || "";
        }

        if (!key) {
            let el = target;
            while (el && el.nodeType === 1) {
                const id = el.getAttribute && el.getAttribute("id");
                if (id) {
                    key = id;
                    break;
                }
                el = el.parentNode;
            }
        }

        if (key) g.setAttribute("data-utag-key", key);

        return { g, key };
    }*/
    function ensureUtagKeyOnG(target) {
    if (!target || target.nodeType !== 1) {
        return { g: null, key: "" };
    }

    // 1) 클릭한 자기 자신의 id를 최우선 사용
    const selfId = (target.getAttribute && target.getAttribute("id"))
        ? target.getAttribute("id").trim()
        : "";

    if (selfId && !selfId.startsWith("viewport-") && selfId.indexOf("svg-pan-zoom") === -1) {
        return { g: null, key: selfId };
    }

    // 2) 상위 g 중에서 internal viewport wrapper 는 건너뛰고 실제 g 찾기
    let g = target.closest ? target.closest("g") : null;
    while (g && isInternalViewportGroup(g)) {
        g = g.parentElement ? g.parentElement.closest("g") : null;
    }

    // 3) g에 캐시된 key 있으면 사용
    if (g) {
        let key = (g.getAttribute("data-utag-key") || "").trim();
        if (key) return { g, key };

        // 4) g 자체 id
        let gid = (g.getAttribute("id") || "").trim();
        if (gid && !gid.startsWith("viewport-") && gid.indexOf("svg-pan-zoom") === -1) {
            g.setAttribute("data-utag-key", gid);
            return { g, key: gid };
        }

        // 5) g 내부 text[id]
        const textWithId = g.querySelector("text[id]");
        if (textWithId) {
            const tid = (textWithId.getAttribute("id") || "").trim();
            if (tid && !tid.startsWith("viewport-") && tid.indexOf("svg-pan-zoom") === -1) {
                g.setAttribute("data-utag-key", tid);
                return { g, key: tid };
            }
        }

        // 6) g 내부 child[id] 중 internal 제외
        const childrenWithId = g.querySelectorAll("[id]");
        for (let i = 0; i < childrenWithId.length; i++) {
            const cid = (childrenWithId[i].getAttribute("id") || "").trim();
            if (!cid) continue;
            if (cid.startsWith("viewport-")) continue;
            if (cid.indexOf("svg-pan-zoom") > -1) continue;

            g.setAttribute("data-utag-key", cid);
            return { g, key: cid };
        }
    }

    // 7) 최후 fallback: 자기 자신부터 상위로 올라가며 유효한 id 찾기
    let el = target;
    while (el && el.nodeType === 1) {
        const id = (el.getAttribute && el.getAttribute("id"))
            ? el.getAttribute("id").trim()
            : "";

        if (
            id &&
            !id.startsWith("viewport-") &&
            id.indexOf("svg-pan-zoom") === -1
        ) {
            return { g, key: id };
        }
        el = el.parentElement;
    }

    return { g, key: "" };
}

    function forcePointerCursor(svgDoc) {
        const svgEl = svgDoc.documentElement;

        if (svgDoc.getElementById("cursor-fix-style")) return;

        const style = svgDoc.createElementNS("http://www.w3.org/2000/svg", "style");
        style.setAttribute("id", "cursor-fix-style");
        style.textContent = `
            g[data-utag-key], 
            g[data-utag-key] * {
              cursor: pointer !important;
            }

            text, tspan {
              cursor: pointer !important;
            }
        `;

        svgEl.insertBefore(style, svgEl.firstChild);
    }
	/**
     * DataPARC 실시간 UTag 기반 클릭 이벤트를 svg 전체에 캡처링 방식으로 바인딩한다.
     *
     * 동작:
     * - 클릭된 target 주변 g에서 data-utag-key 추출
     * - key → UTAG_INFO_BY_EL 조회
     * - REALTIME_VAL_BY_EL 에서 현재 값 조회
     * - /multiview/dataparc/operationInfo.do 호출 후 fnDataparcInfo에 popupInfo 전달
     *
     * 주의:
     * - text/g 일반 클릭 처리와 중복 실행되지 않도록 e.__handledByDataparcUtag 사용
     *
     * @param {Document} svgDoc
     */
    function bindDataparcClick(svgDoc) {
        
        forcePointerCursor(svgDoc);

        let lastFireAt = 0;
        const FIRE_GUARD_MS = 350;

        function fire(e) {
			if (e.target.closest('g[data-movepage="1"]')) return;
            if (isPinching || (Date.now() - lastPinchAt) < 350) return;
            if (isDragging) return;
            if ((Date.now() - lastDragAt) < DRAG_SUPPRESS_MS) return;

            const now = Date.now();
            if (now - lastFireAt < FIRE_GUARD_MS) return;
            lastFireAt = now;
			console.log("[UTAG click target]", e.target);
            const { key } = ensureUtagKeyOnG(e.target);
             console.log("[UTAG resolved key]", key);
            if (!key) return;

            const info = UTAG_INFO_BY_EL.get(key);
            console.log("UTAG_INFO_BY_EL _info : " , info)
            if (!info || !info.uTag) return;

	        // 여기까지 왔으면 utag 클릭으로 인정
	        e.__handledByDataparcUtag = true;
	        e.stopPropagation();

            const rt = REALTIME_VAL_BY_EL.get(key);
            const realtimeVal = rt ? rt.val : "----";
            
            const utag = info.uTag || "";
	        const utagVal = realtimeVal;
	        const utagDes = info.description || "";


            $.ajax({
                url: "/multiview/dataparc/operationInfo.do",
                type: "POST",
                dataType: "html",
                data: {
                    utag: info.uTag,
                    utagVal: realtimeVal,
                    utagDes: info.description || ""
                },
                beforeSend: function () {
                    $("#loadingBar").css("display", "");
                },
                success: function (data) {

                var iframeSrc = window.parent.$("#_VIEW_IFRAME").attr("src") || "";
                var currentDataPath = "";
                var currentFileName = "";
			
                if (iframeSrc) {
                    var queryString = iframeSrc.split("?")[1] || "";
                    var params = new URLSearchParams(queryString);
                    currentDataPath = decodeURIComponent(params.get("dataPath") || "");
                    currentFileName = currentDataPath.split("/").pop() || "";
                    
                }

                var targetEl = e.target.closest("text, g") || e.target;
                var textElementId = targetEl ? (targetEl.getAttribute("id") || "") : "";
                 
                 var popupInfo = {
			            
			            fileName: currentFileName || "",
			            data: currentDataPath || "",
			            utag: utag,
			            utagVal: utagVal,
			            utagDes: utagDes,
			            textElementId: textElementId || ""
			        };

                console.log("fnDataparcInfo 전달 info:", popupInfo );

                fnDataparcInfo(popupInfo);	
                
                },
                complete: function () {
              
                    $("#loadingBar").css("display", "none");
                },
                error: function (request, status, error) {
                    console.log("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
                }
            });
        }

        svgDoc.addEventListener("pointerup", fire, { capture: true });
    }

    async function headExists(url) {
        try {
            const r = await fetch(url, { method: "HEAD", cache: "no-store" });
            return r.ok;
        } catch {
            return false;
        }
    }

    function extractFileName(anyPath) {
        if (!anyPath) return "";
        let p = normalizePath(anyPath);
        p = p.split("#")[0].split("?")[0];
        const segs = p.split("/").filter(Boolean);
        return segs.length ? segs[segs.length - 1] : "";
    }
 	/**
     * onclick="movePage('경로', ...)" 형태 문자열에서 경로만 파싱
     *
     * @param {string} onclickRaw
     * @returns {string}
     */
    function parseMovePagePathFromOnclick(onclickRaw) {
        if (!onclickRaw) return "";
        const s = String(onclickRaw).replace(/&quot;/g, '"').trim();
        const m = s.match(/movePage\s*\(\s*(['"])(.*?)\1\s*(?:,|\))/i);
        return m ? (m[2] || "").trim() : "";
    }
 	/**
     * 경로 구분자 정규화
     * 백슬래시 → 슬래시, 중복 슬래시 제거
     *
     */
    function normalizePath(p) {
        return String(p || "")
            .trim()
            .replace(/\\+/g, "/")
            .replace(/\/{2,}/g, "/");
    }

    const DATAPARC_DIR_CANDIDATES = [
        "/drawing/dataparc/",
        "/drawing/dataparc/ICMS/",
        "/drawing/dataparc/9/",
        "/drawing/dataparc/10/",
        "/drawing/dataparc/ICMS/9/",
        "/drawing/dataparc/ICMS/10/"
    ];
   	/**
     * WPF 스타일 movePage 경로에서 파일명만 추출한 뒤,
     * 실제 DataPARC 서비스 경로 후보들 중 존재하는 파일 경로를 찾아 반환한다.
     *
     */
    async function resolveDataparcPathFromWpfLikePath(wpfPath) {
        const fileName = extractFileName(wpfPath);
        if (!fileName) return null;

        for (const dir of DATAPARC_DIR_CANDIDATES) {
            const dataparcRel = dir + fileName;
            const abs = new URL(dataparcRel, location.origin).href;

            if (await headExists(abs)) {
                return new URL(abs).pathname;
            }
        }

        return null;
    }
	/**
     * DataPARC 화면 이동용 URL 생성
     *
     */
	function buildAdminDataparcViewerUrl({ iegNo, dataPath, searchTag }) {
	    const url = new URL("/admin/dataparc/viewer.do", location.origin);
	
	    if (iegNo) url.searchParams.set("iegNo", iegNo);
	    if (dataPath) url.searchParams.set("dataPath", dataPath);
	    if (searchTag) url.searchParams.set("searchTag", searchTag);
	
	    return url.toString();
	}
	
	function isMovePageElement(node) {
    if (!node) return false;

    const g = node.closest ? node.closest("g") : null;
    if (!g) return false;

    const raw = g.getAttribute("onclick") || "";
    return raw.indexOf("movePage") > -1 || g.getAttribute("data-role") === "movepage";
	}
	/**
     * SVG 내부 g[onclick*="movePage"] 요소들을 실제 JS click 이벤트로 재바인딩한다.
     *
     * 동작:
     * - onclick 문자열에서 대상 경로 추출
     * - DataPARC 내 실제 파일 경로 탐색
     * - 찾으면 /multiview/dataparc.do?... 로 이동
     * - 못 찾으면 알림 표시
     *
     * @param {Document} svgDoc
     */
function bindMovePageButtons(svgDoc) {
    const els = svgDoc.querySelectorAll('g[onclick*="movePage"]');

    els.forEach((g) => {
        const raw = g.getAttribute("onclick") || "";
        const wpfPath = parseMovePagePathFromOnclick(raw);
        if (!wpfPath) return;

        g.setAttribute("data-movepage", "1");
        g.setAttribute("data-movepage-path", wpfPath);

        // 기존 inline onclick 제거
        g.removeAttribute("onclick");
        g.style.cursor = "pointer";

        // movePage 그룹 내부에서 발생하는 포인터 이벤트를 먼저 먹는다
        const swallowPointerEvent = function (e) {
            const movePageGroup = e.target.closest('g[data-movepage="1"]');
            if (!movePageGroup || movePageGroup !== g) return;

            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === "function") {
                e.stopImmediatePropagation();
            }
        };

        // pointerdown / pointerup 둘 다 캡처 단계에서 차단
        g.addEventListener("pointerdown", swallowPointerEvent, true);
        g.addEventListener("pointerup", swallowPointerEvent, true);

        // touch 환경 대비
        g.addEventListener("touchstart", swallowPointerEvent, true);
        g.addEventListener("touchend", swallowPointerEvent, true);

        // 실제 이동은 click에서만 처리
        g.addEventListener("click", async function (e) {
            const movePageGroup = e.target.closest('g[data-movepage="1"]');
            if (!movePageGroup || movePageGroup !== g) return;

            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === "function") {
                e.stopImmediatePropagation();
            }

            const params = new URLSearchParams(location.search);
            const iegNo = params.get("iegNo") || "";
            const searchTag = params.get("searchTag") || "";

            const resolved = await resolveDataparcPathFromWpfLikePath(wpfPath);

            if (!resolved) {
                $.alert({
                    icon: 'bi bi-exclamation-triangle',
                    title: 'dataPARC',
                    content: '이동할 도면이 없습니다.',
                    animation: 'scale',
                    type: 'red'
                });
                return;
            }

            const nextUrl = buildAdminDataparcViewerUrl({
                iegNo,
                dataPath: resolved,
                searchTag
            });

            location.href = nextUrl;
        }, true);
    });
}
    
    
 	/**
     * g 내부 metadata/pmt:id 중 비어 있지 않은 텍스트를 찾아 반환한다.
     */
    function getNonEmptyPmtIdText(g) {
        if (!g) return "";

        let node = g.querySelector("metadata pmt\\:id, pmt\\:id");
        if (node) {
            const t = (node.textContent || "").trim();
            if (t) return t;
        }

        const any = g.getElementsByTagNameNS("*", "id");
        for (let i = 0; i < any.length; i++) {
            const t = (any[i].textContent || "").trim();
            if (t) return t;
        }

        return "";
    }
 /**
     * transform="translate(x,y)" 문자열을 파싱한다.
     * 단순 translate만 지원
     *
     */
    function parseTranslate(tf) {
        const s = String(tf || "").trim();
        const m = s.match(/^translate\(\s*([-\d.]+)\s*(?:[, ]\s*([-\d.]+)\s*)?\)\s*$/i);
        if (!m) return null;
        const x = parseFloat(m[1]);
        const y = (m[2] == null) ? 0 : parseFloat(m[2]);
        if (!isFinite(x) || !isFinite(y)) return null;
        return { x, y, raw: `translate(${x},${y})` };
    }
  /**
     * 부모 g의 translate를 내부 text의 transform으로 "굽는(bake)" 처리
     *
     * 조건:
     * - g에 transform translate가 있어야 함
     * - g 내부에 non-empty pmt:id가 있어야 함
     * - 내부 text가 존재해야 함
     *
     * 처리 후:
     * - text.transform = 부모 translate + 기존 text transform
     * - text에 data-baked-translate="1" 기록
     * - 부모 g의 transform 제거
     *
     * 목적:
     * - 클릭/중앙이동 시 부모 translate 때문에 bbox/위치 계산이 꼬이는 문제 방지
     *
     * @param {Document} svgDoc
     */
    function bakeParentTranslateIntoText(svgDoc) {
        const gs = svgDoc.querySelectorAll('g[transform*="translate"]');

        gs.forEach(g => {
            const tf = (g.getAttribute("transform") || "").trim();
            const tr = parseTranslate(tf);
            if (!tr) return;

            const pmtIdText = getNonEmptyPmtIdText(g);
            if (!pmtIdText) return;

            const text = g.querySelector("text");
            if (!text) return;

            const old = (text.getAttribute("transform") || "").trim();
            const next = old ? `${tf} ${old}` : tf;
            text.setAttribute("transform", next);
            text.setAttribute("data-baked-translate", "1");
            text.setAttribute("data-baked-tf", tf);

            g.removeAttribute("transform");
        });
    }
  /**
     * 드래그/터치 드래그를 클릭과 구분하기 위한 guard 설치
     *
     * pointer / touch 모두 지원하며,
     * 시작 좌표 대비 이동량이 DRAG_THRESHOLD 이상이면 isDragging = true
     *
     * @param {Element} targetEl
     */
    function installDragGuard(targetEl) {
        if (!targetEl || targetEl.__dragGuardBound) return;
        targetEl.__dragGuardBound = true;

        let start = null;

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
        }, { capture: true });

        targetEl.addEventListener("pointercancel", () => {
            if (isDragging) lastDragAt = Date.now();
            start = null;
        }, { capture: true });

        targetEl.addEventListener("touchstart", (e) => {
            if (!e.touches || e.touches.length !== 1) return;
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
	/**
     * 메인 진입 함수
     *
     * 역할:
     * 1. 기존 타이머 / panZoom / 상태 초기화
     * 2. SVG object 생성 후 로드
     * 3. load 완료 시:
     *    - svgDoc / svgElement 확보
     *    - translate bake 처리
     *    - drag guard / pinch zoom / resize 바인딩
     *    - DataPARC UTag 추출 및 실시간 업데이트 시작
     *    - g 클릭 / text 클릭 / movePage 클릭 바인딩
     *    - searchTag 있으면 초기 선택/중앙정렬
     *
     * @param {string} path SVG 경로
     * @param {string} searchTag 초기 검색 대상 tag
     */
    function createAndLoadSVG(path, searchTag) {
        if (TIME_TIMER) {
            clearInterval(TIME_TIMER);
            TIME_TIMER = null;
        }
        TIME_NODES = [];

        if (window.panZoom) {
            window.panZoom.destroy();
            window.panZoom = null;
        }

        if (window.updateTimer) {
            clearInterval(window.updateTimer);
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

        object.addEventListener("load", function () {
            svgDoc = object.contentDocument;
            svgElement = svgDoc.documentElement;

            bakeParentTranslateIntoText(svgDoc);
            installDragGuard(object);
            installDragGuard(svgElement);

            UTAG_TO_ELEMENT_LIST = extractUtagToElementMap(svgDoc);
            UTAG_INFO_BY_EL = new Map(
                UTAG_TO_ELEMENT_LIST.map(v => [
                    v.elementName,
                    { uTag: v.uTag, description: v.description }
                ])
            );
			
            bindDataparcClick(svgDoc);
           
            startTimeTick();

            let globalStyle = svgDoc.querySelector('style[data-role="global-state-style"]');

            if (!globalStyle) {
                globalStyle = document.createElementNS(svgns, "style");
                globalStyle.setAttribute("data-role", "global-state-style");
                globalStyle.textContent = `
                    g[data-state="default"] text,
                    g[data-state="default"] tspan {
                        fill: #E50041;
                        paint-order: stroke fill;
                        font-weight: bold;
                    }

                    g[data-state="default"]:hover text,
                    g[data-state="default"]:hover tspan {
                        stroke: #E50041 !important;
                        stroke-width: 3px !important;
                        stroke-opacity: 0.3 !important;
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
                        stroke: #3747C1 !important;
                        stroke-width: 3px !important;
                        stroke-opacity: 0.3 !important;
                        paint-order: stroke fill;
                    }

                    g[data-state="movepage"] text,
                    g[data-state="movepage"] tspan {
                        fill: #0F9B3A;
                        paint-order: stroke fill;
                        font-weight: bold;
                    }
                `;
                svgElement.insertBefore(globalStyle, svgElement.firstChild);
            }

            const textNodes = svgElement.querySelectorAll("text");
            window.tempTextNodes = textNodes;

            onShotVisibleToHidden();

            let svgType = svgDoc.getElementsByTagNameNS('*', 'id');
            const viewboxElements = svgDoc.querySelectorAll('[transform="scale(1,-1)"]');

            if (viewboxElements.length > 0) {
                ckType = "pnid";
            } else if (viewboxElements.length === 0) {
                ckType = "dataparc";
            } else {
                ckType = "dataparc";
            }

            panZoom = svgPanZoom(svgElement, {
                zoomEnabled: true,
                controlIconsEnabled: true,
                fit: true,
                center: true,
                minZoom: 1,
                maxZoom: 10,
                zoomScaleSensitivity: 0.7,
                mouseWheelZoomEnabled: true,
                dblClickZoomEnabled: false,
                touchEnabled: false,
                beforePan: function (oldPan, newPan) {
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

                    const limitedX = Math.max(leftLimit, Math.min(rightLimit, newPan.x));
                    const limitedY = Math.max(topLimit, Math.min(bottomLimit, newPan.y));

                    return { x: limitedX, y: limitedY };
                }
            });

            (function attachPinchZoom() {
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
            })();

            if (!window.__resizeBound__) {
                window.addEventListener("resize", () => {
                    if (!panZoom || !svgElement) return;
                    if (!isElementVisible(svgElement)) return;

                    try {
                        panZoom.resize();
                    } catch (e) {
                        console.error("[resize] panZoom.resize() error:", e);
                        return;
                    }

                    if (LAST_SELECTED_NODE) {
                        const bbox = LAST_SELECTED_NODE.getBBox();
                        const outline = createOutlineRect(svgDoc, svgns, bbox, LAST_SELECTED_NODE.id || "selected");
                        var rx = outline.getAttribute('x');
                        var ry = outline.getAttribute('y');
                        var rw = outline.getAttribute('width');
                        var rh = outline.getAttribute('height');
                        determineZoomLevel(panZoom, bbox);
                        panToCenter(panZoom, rx, ry, rw, rh);
                    }
                });
                window.__resizeBound__ = true;
            }

            // ---------------------------
            // 그룹 클릭 바인딩
            // ---------------------------
            for (let i = 0; i < svgType.length; i++) {
                const metaNode = svgType[i];
                const svgType_parent = metaNode.closest("g");

                if (!svgType_parent) continue;
                if (svgType_parent.__groupBound) continue;

                const clickableId = getClickableIdFromGroup(svgType_parent);
                if (!clickableId) continue;

                svgType_parent.__groupBound = true;
                // g 태그에 실제 id가 있을 때만 기본 빨간색 적용
				if (hasRealGroupId(svgType_parent)) {
				    svgType_parent.setAttribute("data-state", "default");
				} else {
				    svgType_parent.removeAttribute("data-state");
				}

                if (!svgType_parent.querySelector(":scope > title")) {
                    const title = document.createElementNS(svgns, "title");
                    title.textContent = clickableId;
                    svgType_parent.appendChild(title);
                }

                svgType_parent.addEventListener("pointerup", function (e) {
					if (e.__handledByDataparcUtag) return;
					if (isMovePageElement(this) || isMovePageElement(e.target)) {
				        return;
				    }
				    if (IS_MOVEPAGE_CLICK || (Date.now() - LAST_MOVEPAGE_AT) < MOVEPAGE_SUPPRESS_MS) {
				        return;
				    }
                    if (isPinching || (Date.now() - lastPinchAt) < 350) return;
                    if (isDragging) return;
                    if ((Date.now() - lastDragAt) < DRAG_SUPPRESS_MS) return;

                    reSetStyle(svgType);

                    const element = this;
                    const clickedId = getClickableIdFromGroup(element);
                    if (!clickedId) return;

                    if (LAST_SELECTED_NODE && LAST_SELECTED_NODE !== element) {
					    if (hasRealGroupId(LAST_SELECTED_NODE)) {
					        LAST_SELECTED_NODE.setAttribute("data-state", "default");
					    } else {
					        LAST_SELECTED_NODE.removeAttribute("data-state");
					    }
					}

                    if (ckType === "pnid") {
                        highlightAndZoomToElement(
                            element,
                            svgDoc,
                            svgElement,
                            panZoom,
                            safeViewReset,
                            calculateFixedCenter
                        );
                    } else {
                        const bbox = element.getBBox();
                        const outline = createOutlineRect(svgDoc, svgns, bbox, clickedId);
                        var rx = outline.getAttribute('x');
                        var ry = outline.getAttribute('y');
                        var rw = outline.getAttribute('width');
                        var rh = outline.getAttribute('height');

                        const baked = !!element?.querySelector?.('text[data-baked-translate="1"]');

                        if (baked) {
                            panZoom.zoom(10);
                        } else {
                            determineZoomLevel(panZoom, bbox);
                        }
                        panToCenter(panZoom, rx, ry, rw, rh);
                    }

                    if (hasRealGroupId(element)) {
					    element.setAttribute("data-state", "selected");
					    LAST_SELECTED_NODE = element;
					}

                    var primaryId = clickedId.split(",")[0];
                    var iframeSrc = window.parent.$("#_VIEW_IFRAME").attr("src") || "";
					var currentDataPath = "";
					var currentFileName = "";
					var currentText = clickedId || "";
					
					if (iframeSrc) {
					    var queryString = iframeSrc.split("?")[1] || "";
					    var params = new URLSearchParams(queryString);
					    currentDataPath = decodeURIComponent(params.get("dataPath") || "");
					    currentFileName = currentDataPath.split("/").pop() || "";
					}
					
					var fallbackInfo = {
					    data: currentDataPath,
					    fileName: currentFileName,
					    text: currentText
					};
                    requestDataparcInfoById(primaryId ,fallbackInfo);
                });

                svgType_parent.addEventListener("mouseover", () => setCursor(svgType_parent, 'pointer'));
                svgType_parent.addEventListener("mouseout", () => setCursor(svgType_parent, 'default'));
            }

            // ---------------------------
            // text 클릭 바인딩 추가
            // ---------------------------
            bindTextNodeEvents(svgDoc, svgElement, panZoom, svgType, ckType);

            bindMovePageButtons(svgDoc);

            if (searchTag && ckType === "dataparc") {
                const matchedGroupSet = new Set();

                for (let i = 0; i < tempTextNodes.length; i++) {
                    const textNode = tempTextNodes[i];
                    const parentG =
                        textNode.closest("g[id]") ||
                        findBestTaggedGroup(textNode);

                    if (!parentG) continue;

                    const rawId = getClickableIdFromGroup(parentG);
                    if (!rawId) continue;

                    const idList = rawId
                        .split(",")
                        .map(s => s.trim())
                        .filter(s => s.length > 0);

                    if (idList.includes(searchTag)) {
                        matchedGroupSet.add(parentG);
                    }
                }

                const matchedGroups = Array.from(matchedGroupSet);
                const count = matchedGroups.length;

                if (count > 1) {
                    const targetGroup = matchedGroups[0];
                    const bbox = targetGroup.getBBox();
                    const outline = createOutlineRect(svgDoc, svgns, bbox, getClickableIdFromGroup(targetGroup));
                    var rx = outline.getAttribute('x');
                    var ry = outline.getAttribute('y');
                    var rw = outline.getAttribute('width');
                    var rh = outline.getAttribute('height');
                    determineZoomLevel(panZoom, bbox);
                    panToCenter(panZoom, rx, ry, rw, rh);

                   matchedGroups.forEach(g => {
				    if (hasRealGroupId(g)) {
				        g.setAttribute("data-state", "selected");
				    }
				});
                } else if (count === 1) {
                    runSearchTag_vnet(
                        searchTag,
                        svgDoc,
                        panZoom,
                        () => reSetStyle(svgType)
                    );

                    const targetGroup = matchedGroups[0];
                    if (hasRealGroupId(targetGroup)) {
					    targetGroup.setAttribute("data-state", "selected");
					}
                }

                if (typeof findElementByMultiId === "function") {
                    LAST_SELECTED_NODE = findElementByMultiId(svgDoc, searchTag);
                }
            }

            (async () => {
                const utagToElementMap = UTAG_TO_ELEMENT_LIST;

                if (!Array.isArray(utagToElementMap) || utagToElementMap.length === 0) {
                    console.warn("UTagInfo 에서 추출된 태그가 없습니다. 실시간 값 업데이트 생략.");
                    return;
                }

                startDataparcRealtimeUpdate(svgDoc, utagToElementMap, REQUEST_INTERVAL_MS);
            })();
        });

        const container = document.getElementById("svgarea");
        container.innerHTML = "";
        container.appendChild(object);
    }

    // 전역 등록
    window.safeViewReset = safeViewReset;
    window.getRealZoom = getRealZoom;
    window.createAndLoadSVG = createAndLoadSVG;
    window.initFromUrlParams = initFromUrlParams;
    window.fetchDataFromServer = fetchDataFromServer;
    window.extractUtagToElementMap = extractUtagToElementMap;
    window.upDateTagValues = upDateTagValues;
    window.formatTextValue = formatTextValue;
    window.getColorForValue = getColorForValue;
    window.isTimeValue = isTimeValue;
    window.setupFileInputHandler = setupFileInputHandler;
    window.getApiData = getApiData;
    window.formatDateTime = formatDateTime;
    window.getMatchedOrFallbackValues = getMatchedOrFallbackValues;
    window.onShotVisibleToHidden = onShotVisibleToHidden;
    window.formatYMD_tt_hms = formatYMD_tt_hms;
    window.startDataparcRealtimeUpdate = startDataparcRealtimeUpdate;
})();