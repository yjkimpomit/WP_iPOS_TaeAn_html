(function () {
	
    const DRAG_THRESHOLD = 5; // px 단위, 이 이상 움직이면 "드래그"로 간주
    const CHUNK_SIZE = 100;// 한 번에 보낼 tag 개수
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


    // 배열을 CHUNK_SIZE씩 쪼개는 헬퍼
    function chunkArray(arr, size) {

        const result = [];
        for (let i = 0; i < arr.length; i += size) {
            result.push(arr.slice(i, i + size));
        }
        return result;
    }

    //엘리먼트가 실제로 화면에 보이는지 체크
    function isElementVisible(el) {

        if (!el) return false;

        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
            return false;
        }

        const rect = el.getBoundingClientRect();
        return !!(rect.width && rect.height);
    }

    // 뷰어 셋팅 리셋 : 멀티창 최소화에 적용 가능한 방어 뷰어 리셋 코드
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

    // dataparc 타입의 경우, 클릭한 요소를 강조하고 확대하여 해당 요소로 이동하는 함수
    function panToCenter(panZoom, rx, ry, rw, rh) {
        const realZoom = panZoom.getSizes().realZoom;

        const panX = -(rx * realZoom) + (panZoom.getSizes().width / 2) - ((rw * realZoom) / 2);
        const panY = -(ry * realZoom) + (panZoom.getSizes().height / 2) - ((rh * realZoom) / 2);

        panZoom.pan({x: 0, y: 0}); // 초기화
        panZoom.pan({x: panX, y: panY}); // 이동
    }

    // zoom 레벨을 결정하는 함수 ( 기준점 셋팅 )
    function determineZoomLevel(panZoom, bbox) {
        if (bbox.width < 75 && bbox.height < 100) {
            panZoom.zoom(7);
            console.log('panZoom.zoom(7);')
        } else {
            panZoom.zoom(4);
            console.log('panZoom.zoom(4);')
        }
    }

    // svg 파일에서 Utag를 Map 형식으로 추출하는 함수
    function extractUtagToElementMap(svgDoc) {

        const list = [];

        // SVG 전체에서 모든 UTagInfo 태그 검색
        const utagInfos = svgDoc.getElementsByTagName("UTagInfo");

        for (let i = 0; i < utagInfos.length; i++) {

            const uTag = utagInfos[i].getAttribute("UTag");
            const elName = utagInfos[i].getAttribute("ElementName");
            const desc = utagInfos[i].getAttribute("Description") || "";

            if (!uTag || !elName) {
                console.log('[extractUtagToElementMap] skip (uTag/elName missing):', {uTag, elName});
                continue;
            }
            //const skipTags = ["SYS.Sample_Boiler.FC100.PV", "SYS.Sample_Boiler.FC100.OP","T3.C1.time"]
            const skipTags = ["SYS.Sample_Boiler.FC100.PV", "T3.C1.time"]

            // 특정 태그를 제외 : 굳이 받아와야할 필요가 없는 예) 시간 데이터 제외
            if (skipTags.includes(uTag)) continue;

            list.push({uTag, elementName: elName, description: desc});
        }
        // map -> list 형태로 변환  : 중복 utag 값 중복으로 호출 하기 위해
        return list; // { std_tag: ElementName }
    }

    // 데이터 받아서 변환하는 함수
    async function fetchDataFromServer(utagToElementMap) {


        if (!Array.isArray(utagToElementMap)) {
            console.warn('[fetchDataFromServer] utagToElementMap is not an array:', typeof utagToElementMap, utagToElementMap);
        } else {
            const badUtagItems = utagToElementMap.filter(x => !x || !x.uTag || !x.elementName);
            if (badUtagItems.length) {
                console.warn('[fetchDataFromServer] invalid utagToElementMap items (missing uTag/elementName):', badUtagItems);
            }
        }

        const tagList = utagToElementMap.map(item => item.uTag); // std_tag 목록

        if (tagList.length === 0) {
            console.warn("태그 목록이 비어 있습니다.");
            return {};
        }

        // 서버에서 데이터를 가져오는 부분
        let dataList = await getApiData(tagList);

        //{"std_tag":"PT.DCS.CC2-P.GTC1.21G-D002IND001","Val":"78.0"},{"std_tag":"PT.DCS.CC2-P.GTC1.21G-D002IND001","Val":"78.0"}
        //{ std_tag: 'PVTextBlock7', Val: '82.3'}

        if (dataList.length === 0) {
            console.warn("서버에서 데이터를 가져오지 못했습니다.");
            return {};
        }


        // case :  dataList = [{ result: "JSON_STRING_ARRAY" }]
        if (Array.isArray(dataList) &&
            dataList.length === 1 &&
            dataList[0] &&
            typeof dataList[0].result === "string") {

            const inner = dataList[0].result.trim();
            if (!inner) {
                console.warn("[fetchDataFromServer] result 문자열이 비어 있습니다.");
                console.timeEnd('[fetchDataFromServer] total');
                return {};
            }

            try {
                const parsed = JSON.parse(inner);
                if (Array.isArray(parsed)) {
                    dataList = parsed;
                } else {
                    console.warn("[fetchDataFromServer] result 파싱 결과가 배열이 아닙니다:", parsed);
                    console.timeEnd('[fetchDataFromServer] total');
                    return {};
                }
            } catch (err) {
                console.error("[fetchDataFromServer] result 문자열 JSON 파싱 실패:", err);
                console.warn("[fetchDataFromServer] result 원본:", inner);
                console.timeEnd('[fetchDataFromServer] total');
                return {};
            }
        }
        // case 2) dataList = { result: "JSON_STRING_ARRAY" } (혹시 이런 경우도 대비)
        else if (!Array.isArray(dataList) &&
            dataList &&
            typeof dataList.result === "string") {

            const inner = dataList.result.trim();
            if (!inner) {
                console.warn("[fetchDataFromServer] result 문자열이 비어 있습니다.(object case)");
                console.timeEnd('[fetchDataFromServer] total');
                return {};
            }

            try {
                const parsed = JSON.parse(inner);
                if (Array.isArray(parsed)) {
                    dataList = parsed;
                } else {
                    console.warn("[fetchDataFromServer] result 파싱 결과가 배열이 아닙니다.(object case):", parsed);
                    console.timeEnd('[fetchDataFromServer] total');
                    return {};
                }
            } catch (err) {
                console.error("[fetchDataFromServer] result 문자열 JSON 파싱 실패(object case):", err);
                console.warn("[fetchDataFromServer] result 원본(object case):", inner);
                console.timeEnd('[fetchDataFromServer] total');
                return {};
            }
        }

        // 여기까지 오면 dataList는 진짜로 이런 형태여야 함:
        // [
        //   { Val:"48.00", std_tag:"T3.9M.9ho-lsl-02-l-i", ... },
        //   { Val:"99.99", std_tag:"T3.9M.9ho-lsh-02-h-i", ... }
        // ]

        if (!Array.isArray(dataList) || dataList.length === 0) {
            console.warn("[fetchDataFromServer] 서버에서 데이터를 가져오지 못했습니다. (정규화 후 빈 배열)");
            console.timeEnd('[fetchDataFromServer] total');
            return {};
        }
        /*console.log("[fetchDataFromServer] 정규화된 dataList:", dataList);*/

        const tagToElementMap = []; // 배열

        utagToElementMap.forEach(({uTag, elementName}) => {
            tagToElementMap.push({std_tag: uTag, elementName});
        });

        // tagToElementMap : Utag 값을 ElementName 값과 맵핑해줘야함
        // { std_tag: 'PT.DCS.CC2-P.GTC1.21CEDM-H401_02', elementName: 'Greenvessel_5' }
        /*  console.log("변환 데이터 [ tagToElementMap ]:", tagToElementMap);*/

        const result = {};

        dataList.forEach(({std_tag, Val}) => {
            tagToElementMap.forEach(({std_tag: uTag, elementName}) => {
                if (uTag === std_tag) {
                    result[elementName] = Val;
                }

            });
        });

        tagToElementMap.forEach(({elementName}) => {
            if (!(elementName in result)) {
                result[elementName] = "----";
                /* console.log("elementName NAN failed mapping : ", elementName)*/
            }
        });


        // 테스팅을 위한 임시 코드
        // gr_result = generateRandomizedDataFromTemplate(result); // 값 랜덤화

        return result;
    }

    function getApiData(tagList) {
        if (!Array.isArray(tagList) || tagList.length === 0) {
            console.warn("[getApiData] tagList 가 비어있거나 유효하지 않습니다:", tagList);
            return Promise.resolve([]);
        }

        const url = "/multiview/dataparc/getdata.do";

        return new Promise(function (resolve, reject) {
            $.ajax({
                url: url,
                type: "POST",                         // GET → POST
                data: {                               // body에 form 데이터로 전송
                    tags: tagList.join(",")          //   "tag1,tag2,tag3,..."
                },
                dataType: "text",                     // 응답은 여전히 text
                success: function (rawText) {
                    try {
                        const trimmedText = (rawText || "").trim();
                        let dataList = [];
                        let cleaned_dataList = [];

                        if (trimmedText.startsWith("{") && !trimmedText.startsWith("[")) {
                            // 비정형: {}{} 보정
                            const fixedJson = ("[" + trimmedText + "]").replace(/},\s*{/g, "},{");

                            try {
                                dataList = JSON.parse(fixedJson);
                                if (!Array.isArray(dataList)) {
                                    console.log(
                                        '[getApiData] payload is not array, try data:',
                                        typeof dataList,
                                        dataList
                                    );
                                    dataList = (dataList && Array.isArray(dataList.data))
                                        ? dataList.data
                                        : [];
                                }
                                cleaned_dataList = dataList.map(({id, ...rest}) => rest);
                                console.log("비정형 JSON 파싱 성공:", cleaned_dataList);
                            } catch (nestedErr) {
                                console.error("JSON 포맷이 잘못되었습니다:", nestedErr);
                                console.warn("원시 응답 내용:", rawText);
                                return resolve([]);
                            }
                        } else {
                            // 정형: [ {...}, ... ] 또는 { data:[...] }
                            try {
                                dataList = JSON.parse(trimmedText);
                                if (!Array.isArray(dataList)) {
                                    console.log('[getApiData] payload is not array, try data:', typeof dataList, dataList);
                                    dataList = (dataList && Array.isArray(dataList.data))
                                        ? dataList.data : [];
                                }
                                cleaned_dataList = dataList.map(({id, ...rest}) => rest);
                                /*console.log("정형 JSON 파싱 성공:", cleaned_dataList);*/
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
                    resolve([]); // 에러 시 빈 배열
                }
            });
        });
    }

    function setupFileInputHandler() {
        const svgFileInput = document.getElementById("svgFileInput")

        svgFileInput.addEventListener("change", function (e) {
            const file = e.target.files[0];
            const reader = new FileReader();

            if (!file || !file.name.endsWith(".svg")) {
                alert("SVG 파일만 가능합니다.");
                return;
            }

            reader.onload = function (event) {
                const svgText = event.target.result;
                const blob = new Blob([svgText], {type: "image/svg+xml"});
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

		// 파일 존재 여부 먼저 확인
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

    // 미사용함수 : fallbackValue 사용
    function formatTextValue(val, format = "0.00") {
        const num = parseFloat(val);

        if (isNaN(num)) {
            return "___";
        }

        const match = format.match(/0\.?(0*)/);
        const decimals = match ? match[1].length : 0;

        return num.toFixed(decimals).toString();
    }

    // 색상 결정 함수 : 미사용
    function getColorForValue(val) {
        const num = Number(val);
        if (isNaN(num)) return "gray";            // fallback 값
        if (num < 0) return "#C0C0C0";          // Gray
        if (num === 0) return "#00FF00";        // Green
        if (num === 1) return "#FF0000";        // Red
        if (num > 1) return "#C0C0C0";          // Gray again
        return "gray"; // fallback
    }

    function isTimeValue(val) {
        // 간단한 시:분:초 형식 감지
        return typeof val === 'string' && val.includes(":");
    }

    function formatDateTime(date = new Date()) {
        // "yyyy-MM-dd HH:mm:ss" 형식
        const pad = (n) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
            `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    function getMatchedOrFallbackValues(el, pvDefs, value, id, fallbackSelector = null) {
        const pvCvtMapItems = pvDefs.getElementsByTagName("PVcvtMapItem");
        const numVal = parseFloat(value);
        let matchedValue = null;

        if (pvCvtMapItems.length > 0) {
            const itemsArray = Array.from(pvCvtMapItems);
            const prioritizedItems = itemsArray.filter(i => i.getAttribute("Oper"));
            const fallbackItems = itemsArray.filter(i => !i.getAttribute("Oper"));
            // 순서 조정 : 아래 스위치 조건에 먼저 제대로 걸리도록 하기 위함 oper 없는 부분이 먼저 안 걸리도록
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
                /*console.log(`검사 중: Oper=${oper}, minVal=${minVal}, maxVal=${maxVal}, numVal=${numVal}`);*/

                switch (oper) {
                    case "LELE":  // <= ~ <=
                        match = numVal >= minVal && numVal <= maxVal;
                        break;
                    case "LTLE":  // < ~ <=
                        match = numVal > minVal && numVal <= maxVal;
                        break;
                    case "LELT":  //min <= ~ <
                        match = numVal >= minVal && numVal < maxVal;
                        break;
                    case "LTLT":  //min < ~ < max
                        match = numVal > minVal && numVal < maxVal;
                        break;
                    // case "EQEQ":  // ==  정의는 일반적으로 정확히 일치(equal) 를 의미
                    //     match = numVal === minVal;
                    //     break;
                    // EQEQ 셋팅 중에 min, max 둘 중 하나만 있는 경우가 존재하여 아래와 같이 개발
                    // 둘중 하나만 존재해도 해당 값과 비교하여 동일하면 적용
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
                        // Oper 없는 경우 (기본 포함 비교)
                        match = numVal >= minVal && numVal <= maxVal;
                }
                if (match) {
                    if (outValue !== "") {
                        matchedValue = outValue;
                    } else {
                        /* console.warn(`조건은 일치하지만 OutValue가 비어 있음: [${id}]`);*/
                        matchedValue = null;
                    }
                    break;
                }
            }
        }

        if (matchedValue) {
            return matchedValue;
        }

        // fallback 처리
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
            /*    console.warn("조건 미일치 혹은 OutValue 누락  fallbackValue 사용: " + id ,fallbackValue);*/
            return fallbackValue;
        } else {
            const colorAttr = el.getAttribute("fillcolor") || el.getAttribute("strokecolor");
            /*   console.warn(id+" fallbackValue도 지정되지 않음. 기본값" +colorAttr+" 강제 적용");*/
            return colorAttr;
        }
    }

    function onShotVisibleToHidden() {
        // Viewbox 최초 hidden 처리
        // ViewBox 요소 중 Visible 속성이 있으면 hidden으로 치환
        const viewboxElements = svgDoc.querySelectorAll('[wpftagname="Viewbox"]');

        // Viewbox 숨김 처리
        viewboxElements.forEach(vb => {
            const styleAttr = vb.getAttribute("style");

            // style 속성 중 visibility:Visible; 이 존재하면 hidden으로 치환
            if (styleAttr && styleAttr.includes("visibility:Visible")) {
                const newStyle = styleAttr.replace(/visibility\s*:\s*Visible/i, "visibility:hidden");
                vb.setAttribute("style", newStyle);
            }
        });
    }

    function formatYMD_tt_hms(date = new Date()) {
        // "yyyy-MM-dd tt h:mm:ss" 형식
        const pad = n => String(n).padStart(2, '0');
        const yyyy = date.getFullYear(), MM = pad(date.getMonth() + 1), dd = pad(date.getDate());
        const h24 = date.getHours(), tt = (h24 < 12 ? 'AM' : 'PM'), h12 = (h24 % 12) || 12;
        return `${yyyy}-${MM}-${dd} ${tt} ${h12}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    function chkMultiBidTime(el, pvDefs) {
        const multiBinding = pvDefs.querySelector('MultiBinding[ConverterParameter="yyyy-MM-dd HH:mm:ss"]');
        if (!multiBinding) return false;

        //  중복 등록 방지
        if (!TIME_NODES.some(x => x.el === el)) {
            TIME_NODES.push({el});

            el.style.fill = "white";
        }

        return true;
    }

    function startTimeTick() {
        if (TIME_TIMER) clearInterval(TIME_TIMER);

        TIME_TIMER = setInterval(() => {
            const now = formatDateTime();

            for (const {el} of TIME_NODES) {
                if (!el) continue;
                const tspan = el.querySelector("tspan");
                if (tspan) tspan.textContent = now;
                else el.textContent = now;
            }
        }, 1000);
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
            console.error("Element is not defined");
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
        return {fixedCenterX, fixedCenterY, centerX, centerY, bbox, zoomScale};
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

            const {fixedCenterX, fixedCenterY, zoomScale} = result;

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
                panZoom.zoomAtPoint(zoomScale, {x: fixedCenterX, y: fixedCenterY});
            } catch (e) {
                console.error("[highlightAndZoomToElement] zoomAtPoint error:", e);
            }
        });
    }

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
      
          //  bake면 더 크게, 아니면 기존 로직
		  if (baked) {
		    panZoom.zoom(10);
		  } else {
		    determineZoomLevel(panZoom, bbox); // 기존
		  }

        panZoom.pan({x: 0, y: 0});

        const realZoom = panZoom.getSizes().realZoom;

        panZoom.pan({
            x: -(bbox.x * realZoom) + (panZoom.getSizes().width / 2) - ((bbox.width * realZoom) / 2),
            y: -(bbox.y * realZoom) + (panZoom.getSizes().height / 2) - ((bbox.height * realZoom) / 2)
        });
    }

    function setCursor(version_prent, type) {
        version_prent.style.cursor = type;
    }

    function reSetStyle(version) {
        for (let i = 0; i < version.length; i++) {
            const version_id = version[i];
            const g = version_id?.parentNode?.parentNode;
            if (!g) continue;

            // g의 fill 강제 제거 (style + attribute)
            g.style.removeProperty("fill");
            g.removeAttribute("fill");

            // text/tspan 쪽도 인라인이 있으면 제거 (CSS가 먹게)
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

    function upDateTagValues(svgDoc, updatedData) {
        // DateTimeDisplay 한 번만 처리
        dtDisplaysCheckHandler(svgDoc);

        for (const [id, value] of Object.entries(updatedData)) {
            REALTIME_VAL_BY_EL.set(id, {val: value, updatedAt: Date.now()});
            // 업데이트 된 값들의 id 와 value를 순회하면서
            // SVG 문서에서 해당 id를 가진 요소를 찾음
            const el = svgDoc.getElementById(id);
            const pvDefs = svgDoc.getElementById("defs_" + id); // 예: defs_PVTextBlock8
            if (!el || !pvDefs) {
                continue;
            }

            // 실시간 시간 값 셋팅 함수
            if (chkMultiBidTime(el, pvDefs)) {
                continue
            }

            // 요소가 존재하면 해당 요소의 tagName을 소문자로 변환 ex)test, path, rect 등
            const tagName = el.tagName.toLowerCase();
            const wpftagName = el.getAttribute("wpftagname")?.toLowerCase() || "";

            if (wpftagName.includes("pvtextblock")) {
                if (handlePVTextBlock(el, pvDefs, value, id)) {
                    continue;
                }
            } else if (wpftagName.includes("path")) {
                if (handleSetFillColor(el, pvDefs, value, id)) {
                    continue;
                }
            } else if (wpftagName.includes("polygon")) {
                if (handleSetFillColor(el, pvDefs, value, id)) {
                    continue;
                }
            } else if (wpftagName.includes("polylineconnector")) {
                if (handlePolyLinecon(el, pvDefs, value, id)) {
                    continue;
                }
            } else if (wpftagName.includes("ellipse")) {
                if (handleSetFillColor(el, pvDefs, value, id)) {
                    continue;
                }
            } else if (wpftagName.includes("rect")) {
                if (handleProcessRect(svgDoc, el, pvDefs, value, id)) {
                    continue;
                }
            } else if (wpftagName.includes("colorcanvas")) {
                if (handleColorCanvas(el, pvDefs, value, id)) {
                    continue;
                }
            } else if (wpftagName.includes("lineconnector")) {
                if (handleLineCon(el, pvDefs, value, id)) {
                    continue;
                }
            } else if (wpftagName.includes("viewbox")) {
                if (handleViewBox(el, pvDefs, value, id)) {
                    continue;
                }
            } else {
                console.warn("Unsupported tag: " + tagName + "for element: " + id);
            }
        }
    }

    /** utagToElementMap 을 CHUNK_SIZE 단위로 잘라서비동기로 순환 호출하며 값 갱신하는 함수*/
    function startDataparcRealtimeUpdate(svgDoc, utagToElementMap, intervalMs) {
        if (!svgDoc) {
            console.warn("[startDataparcRealtimeUpdate] svgDoc 없음");
            return;
        }
        if (!Array.isArray(utagToElementMap) || utagToElementMap.length === 0) {
            console.warn("[startDataparcRealtimeUpdate] utagToElementMap 비어 있음");
            return;
        }

        // utagToElementMap 자체를 chunk 단위로 자른다.
        // (각 chunk는 [{uTag, elementName}, ...] 형태)
        const chunks = chunkArray(utagToElementMap, CHUNK_SIZE);
        if (!chunks.length) return;

        let chunkIndex = 0;

        if (window.updateTimer) {
            clearInterval(window.updateTimer);
            window.updateTimer = null;
        }

        // 실제로 chunk 하나를 처리하는 비동기 함수
        async function processChunkByIndex(idx) {
            const currentChunk = chunks[idx];

            try {
                const partialData = await fetchDataFromServer(currentChunk);

                // partialData 예: { ElementName1: "123.4", ElementName2: "----", ... }
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
		            Object.assign(mergedData, partialData);  // 결과 누적
		        } catch (e) {
		            console.error("[초기 chunk 병합 중 에러]:", e);
		        }
		    }

		    // 여기서 모든 병합된 데이터를 한 번에 반영
		    upDateTagValues(svgDoc, mergedData);

		    // 이후부터는 기존처럼 chunk 순차 업데이트 시작
		    chunkIndex = 0;
		    window.updateTimer = setInterval(async () => {
		        await processChunkByIndex(chunkIndex);
		        chunkIndex = (chunkIndex + 1) % chunks.length;
		    }, intervalMs);
		})();
    }

    // g태그에서 data-utag-key 추출
    function ensureUtagKeyOnG(target) {
        const g = target.closest ? target.closest("g") : null;
        if (!g) return {g: null, key: ""};

        // 이미 있으면 그대로 사용
        let key = g.getAttribute("data-utag-key") || "";
        if (key) return {g, key};

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

        return {g, key};
    }

    //SVG 문서 안에 <style>을 추가해서 help를 강제로 덮어쓰기
    function forcePointerCursor(svgDoc) {
        const svgEl = svgDoc.documentElement; // <svg>

        // 이미 넣었으면 중복 삽입 방지
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

	//데이터 창 클릭 이벤트
	function bindDataparcClick(svgDoc) {

	  forcePointerCursor(svgDoc);

	  // 모바일에서 중복 호출 방지용
	  let lastFireAt = 0;
	 
	  const FIRE_GUARD_MS = 350;

	  function fire(e) {
		if (isPinching || (Date.now() - lastPinchAt) < 350) return;
		
		if (isDragging) return;
 		if ((Date.now() - lastDragAt) < DRAG_SUPPRESS_MS) return;
	    
	    const now = Date.now();
	    if (now - lastFireAt < FIRE_GUARD_MS) return;
	    lastFireAt = now;

	    const { key } = ensureUtagKeyOnG(e.target);
	    if (!key) return;

	    const info = UTAG_INFO_BY_EL.get(key);
	    if (!info) return;

	    const rt = REALTIME_VAL_BY_EL.get(key);
	    const realtimeVal = rt ? rt.val : "----";

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
	        $("#dataparcDetail").html(data);
	      },
	      complete: function () {
	        $('#dataparcDetailBox').bPopup({
	          modalClose: false,
	          position: [0, 0],
	          opacity: .4,
	          speed: 450,
	          closeClass: "close",
	          onOpen: function () {
	            $(this).addClass('show detail-box');
	          },
	          onClose: function () {
	            $(this).removeClass('show');
	            $("#trendModal").remove();
	          }
	        });

	        $("#loadingBar").css("display", "none");
	      },
	      error: function (request, status, error) {
	        console.log("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
	      }
	    });
	  }

	  // click 대신 pointerup 
	  svgDoc.addEventListener("pointerup", fire, { capture: true });
	}

    async function headExists(url) {
        try {
            const r = await fetch(url, {method: "HEAD", cache: "no-store"});
            return r.ok;
        } catch {
            return false;
        }
    }

    function extractFileName(anyPath) {
        if (!anyPath) return "";
        let p = normalizePath(anyPath);
        p = p.split("#")[0].split("?")[0]; // 혹시 있을 때
        const segs = p.split("/").filter(Boolean);
        return segs.length ? segs[segs.length - 1] : "";
    }

    // onclick="movePage('...')" 에서 첫번째 인자(경로)만 추출
    function parseMovePagePathFromOnclick(onclickRaw) {
        if (!onclickRaw) return "";
        const s = String(onclickRaw).replace(/&quot;/g, '"').trim();

        // movePage('a') or movePage("a")
        const m = s.match(/movePage\s*\(\s*(['"])(.*?)\1\s*(?:,|\))/i);
        return m ? (m[2] || "").trim() : "";
    }

    // 경로 정규화
    function normalizePath(p) {
        return String(p || "")
            .trim()
            .replace(/\\+/g, "/")
            .replace(/\/{2,}/g, "/");
    }

    const DATAPARC_DIR_CANDIDATES = [
        "/drawing/dataparc/",                 // 루트 바로 밑
        "/drawing/dataparc/ICMS/",            // 예시
        "/drawing/dataparc/9/",               // 예시
        "/drawing/dataparc/10/",
        "/drawing/dataparc/ICMS/9/",
        "/drawing/dataparc/ICMS/10/"           // 예시
        // "/drawing/dataparc/01 태안/9,10호기/ICMS/",	  // 필요하면 추가
    ];

    async function resolveDataparcPathFromWpfLikePath(wpfPath) {
        // 1) 파일명만 추출
        const fileName = extractFileName(wpfPath);
        if (!fileName) return null;

        // 2) 후보 폴더들에 fileName 붙여서 HEAD로 찾기
        for (const dir of DATAPARC_DIR_CANDIDATES) {
            const dataparcRel = dir + fileName; // 이미 dir이 "/.../"로 끝나게 관리
            const abs = new URL(dataparcRel, location.origin).href;

            if (await headExists(abs)) {
                return new URL(abs).pathname; // "/drawing/dataparc/.../file.svg"
            }
        }

        return null;
    }

    // 최종 이동 URL 만들기: /multiview/dataparc.do?iegNo=...&dataPath=...&searchTag=...
    function buildDataparcDoUrl({iegNo, dataPath, searchTag}) {
        const url = new URL("/multiview/dataparc.do", location.origin);
        if (iegNo) url.searchParams.set("iegNo", iegNo);
        url.searchParams.set("dataPath", dataPath);
        if (searchTag) url.searchParams.set("searchTag", searchTag);
        return url.toString();
    }

    function bindMovePageButtons(svgDoc) {
        const els = svgDoc.querySelectorAll('g[onclick*="movePage"]');

        els.forEach((g) => {
            const raw = g.getAttribute("onclick") || "";
            const wpfPath = parseMovePagePathFromOnclick(raw);
            if (!wpfPath) return;
            // inline onclick 제거해서 "movePage undefined" 방지
            g.removeAttribute("onclick");
           
            g.style.cursor = "pointer";

            g.addEventListener("click", async (e) => {
                e.preventDefault();
                e.stopPropagation();

                // 현재 페이지 파라미터 유지
                const params = new URLSearchParams(location.search);
                const iegNo = params.get("iegNo") || "";
                const searchTag = params.get("searchTag") || ""; // 필요 없으면 ""로 두면 됨

                const resolved = await resolveDataparcPathFromWpfLikePath(wpfPath);

                if (!resolved) {
                    console.error("[movePage] dataparc에서 파일 못 찾음:", wpfPath);

                    $.alert({
                        icon: 'bi bi-exclamation-triangle',
                        title: 'dataPARC',
                        content: '이동할 도면이 없습니다.',
                        animation: 'scale',
                        type: 'red'
                    });
                    return;
                }

                const nextUrl = buildDataparcDoUrl({
                    iegNo,
                    dataPath: resolved,
                    searchTag
                });

                location.href = nextUrl;
            });
        });
    }
    // pmt id 태그 값 존재여부 확인
    function getNonEmptyPmtIdText(g) {
	  if (!g) return "";
	
	  // 1) querySelector로 시도 (pmt:id는 escape 필요)
	  let node = g.querySelector("metadata pmt\\:id, pmt\\:id");
	  if (node) {
	    const t = (node.textContent || "").trim();
	    if (t) return t;
	  }
	
	  // 2) fallback: getElementsByTagNameNS('*','id') (prefix 상관없이 localName=id)
	  const any = g.getElementsByTagNameNS("*", "id");
	  for (let i = 0; i < any.length; i++) {
	    const t = (any[i].textContent || "").trim();
	    if (t) return t;
	  }
	
	  return "";
	}
    function parseTranslate(tf) {
	  const s = String(tf || "").trim();
	  // translate(1197, 3376.656) or translate(1197 3376.656)
	  const m = s.match(/^translate\(\s*([-\d.]+)\s*(?:[, ]\s*([-\d.]+)\s*)?\)\s*$/i);
	  if (!m) return null;
	  const x = parseFloat(m[1]);
	  const y = (m[2] == null) ? 0 : parseFloat(m[2]);
	  if (!isFinite(x) || !isFinite(y)) return null;
	  return { x, y, raw: `translate(${x},${y})` };
	}
	// dataparc 도면을 변환하는 과정에서 생긴 g 태그 transform 값을 text 로 이관 하는 함수 
	// 조건 : text 태그에 transform 값이 없고 pmt:id 태그 에 값이 있는 경우  
    function bakeParentTranslateIntoText(svgDoc) {
	  // translate를 가진 g들을 대상으로
	  const gs = svgDoc.querySelectorAll('g[transform*="translate"]');
	
	  gs.forEach(g => {
	    const tf = (g.getAttribute("transform") || "").trim();
	    const tr = parseTranslate(tf);
    	if (!tr) return; // translate만
		
		const pmtIdText = getNonEmptyPmtIdText(g);
	    if (!pmtIdText) return;
	    
	    // 내부에 text가 없으면 스킵
	    const text = g.querySelector("text");
	    if (!text) return;
	
	    // 기존 text transform이 있으면 합성: "부모 translate + 기존 transform"
	    const old = (text.getAttribute("transform") || "").trim();
	    const next = old ? `${tf} ${old}` : tf;
	    text.setAttribute("transform", next);
	    // transform 옮겨진 텍스트인지 확인 하는 인자 셋팅
	    text.setAttribute("data-baked-translate", "1");
	    text.setAttribute("data-baked-tf", tf);
	
	    // 부모 transform 제거
	    g.removeAttribute("transform");
	  });
	}

    /**
	 * installDragGuard
	 * 클릭과 드래그를 구분하기 위한 입력 보호 가드 설치 함수.
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

    // 메인 함수 -> SVG 파일을 로드하고 초기화하는 함수
    function createAndLoadSVG(path, searchTag) {
        //시간 갱신 타이머 정리
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
            clearInterval(window.updateTimer);  // 기존 타이머 정리
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
            // g태그에 transform 존재하는 경우 text 로 이관
			bakeParentTranslateIntoText(svgDoc);
			installDragGuard(object);      
			installDragGuard(svgElement); 
        
            UTAG_TO_ELEMENT_LIST = extractUtagToElementMap(svgDoc);
            UTAG_INFO_BY_EL = new Map(
                UTAG_TO_ELEMENT_LIST.map(v => [
                    v.elementName,
                    {uTag: v.uTag, description: v.description}
                ])
            );
            // 2) 클릭 이벤트 바인딩
            bindDataparcClick(svgDoc);

            startTimeTick();

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
					    stroke: #E50041 !important;
						stroke-width: 3px !important;
						stroke-opacity: 0.3 !important;
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
					    stroke: #3747C1 !important;           
					    stroke-width: 3px !important;
					    stroke-opacity: 0.3 !important;
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
					/*
					stroke: #0F9B3A;
					stroke-width: 0.3;
					stroke-opacity: 0.2;
					paint-order: stroke fill;
					*/
			    `;
                svgElement.insertBefore(globalStyle, svgElement.firstChild);
            }

            const textNodes = svgElement.querySelectorAll("text");

            window.tempTextNodes = textNodes;

            onShotVisibleToHidden(); // Viewbox 최초 Hidden 처리

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
                zoomScaleSensitivity: 0.7,  // 줌 민감도 조절
                
                mouseWheelZoomEnabled: true,
				dblClickZoomEnabled: false,
				touchEnabled: false,  

                beforePan: function (oldPan, newPan) {
                    const sizes = this.getSizes();

                    // viewBox 정보 (x, y 에 음수 들어가는 것도 반영됨)
                    const vb = sizes.viewBox;
                    const realZoom = sizes.realZoom;

                    // 실제 뷰어 크기 (svg-pan-zoom이 잡은 viewport)
                    const viewportWidth = sizes.width;
                    const viewportHeight = sizes.height;

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

                    return {x: limitedX, y: limitedY};
                }
            });
			// =======================
			// 핀치 줌 : 손가락 2개로 줌인 줌 아웃
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
                        return;
                    }

                    try {
                        // svg-pan-zoom에게 뷰포트 크기 변경 사실 알리기
                        panZoom.resize();
                    } catch (e) {
                        console.error("[resize] panZoom.resize() error:", e);
                        return; // 이상하면 더 진행 안 함
                    }

                    // 2) 마지막으로 선택한 노드가 있으면 그 기준으로 다시 줌
                    if (LAST_SELECTED_NODE) {
                        const bbox = LAST_SELECTED_NODE.getBBox();
                        const outline = createOutlineRect(svgDoc, svgns, bbox, LAST_SELECTED_NODE.id);
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

            for (let i = 0; i < svgType.length; i++) {
                const metaNode = svgType[i];
                const svgType_parent = metaNode.closest("g");

                // g 태그만 있고 id 값 없어도 에러 없이 continue
                if (!svgType_parent) continue;

                const gId = svgType_parent.getAttribute("id") || "";

                if (!gId.trim()) continue;

                svgType_parent.setAttribute("data-state", "default");

                // tooltip 등록
                const title = document.createElementNS(svgns, "title"); // title이라는 이름을 가진 새 element를 동적 생성. 실제 화면에 그려지지는 않음, Tooltip

                title.textContent = gId;

                svgType_parent?.appendChild(title);

                svgType_parent.addEventListener("pointerup", function () {
					
					if (isPinching || (Date.now() - lastPinchAt) < 350) return;
                    
                    if (isDragging) return;
  					if ((Date.now() - lastDragAt) < DRAG_SUPPRESS_MS) return;

                    reSetStyle(svgType);

                    const element = this;
                    const clickedId = element.id || '';

                    if (!clickedId) return;

                    //이전에 선택된 노드가 있으면 default(레드)로 복원
                    if (LAST_SELECTED_NODE && LAST_SELECTED_NODE !== element) {
                        LAST_SELECTED_NODE.setAttribute("data-state", "default");
                    }

                    if (ckType === "pnid") {
                        //최초 id 값있는 text 노드들 색상 적용
                        highlightAndZoomToElement(element, svgDoc, svgElement, panZoom, () => safeViewReset(panZoom, svgElement), calculateFixedCenter);

                    } else {
                        // vnet 타입의 경우
                        const bbox = element.getBBox();
                        const outline = createOutlineRect(svgDoc, svgns, bbox, element.id);
                        var rx = outline.getAttribute('x');
                        var ry = outline.getAttribute('y');
                        var rw = outline.getAttribute('width');
                        var rh = outline.getAttribute('height');
                       	
                       	 const baked = !!element?.querySelector?.('text[data-baked-translate="1"]');
                  
						  //  baked면 더 크게 줌 (원하는 값으로 조정)
						  if (baked) {
						    panZoom.zoom(10);   // 예: 8~10 사이로
						  } else {
						    determineZoomLevel(panZoom, bbox); 
						  }
                        panToCenter(panZoom, rx, ry, rw, rh);
                        
                    }

                    //  현재 요소 강조 상태로 전환
                    element.setAttribute("data-state", "selected");

                    LAST_SELECTED_NODE = element; // 저장

                    var primaryId = clickedId.split(",")[0];   // 첫 번째 값만 사용

                    $.ajax({
                        url: "/multiview/dataparc/clicktag.do",
                        type: "POST",
                        dataType: "json",
                        data: {
                            dataTagNo: primaryId   // 클릭한 g의 id
                        },
                        success: function (resp) {
                            if (!resp || !resp.length) return;

                            var info = resp[0];
                            var iegNo = info.iegNo;

                            // 원하는 URL 생성
                            var targetUrl = "/multiview/index.do?t=F&iegNo=" + encodeURIComponent(iegNo);

                            fnOpenPopupStandard(targetUrl, "설비상세정보");
                        },
                        error: function (xhr, status, err) {
                            console.error("[clicktag] AJAX 오류:", status, err);
                        }
                    });
                });

                svgType_parent.addEventListener("mouseover", () => setCursor(svgType_parent, 'pointer'));
                svgType_parent.addEventListener("mouseout", () => setCursor(svgType_parent, 'default'));
            }

       
            bindMovePageButtons(svgDoc);

            if (searchTag && ckType === "dataparc") {
                // pnid와 동일하게: searchTag와 같은 id를 가진 <g> 태그 찾기
                const matchedGroupSet = new Set();

                for (let i = 0; i < tempTextNodes.length; i++) {
                    const textNode = tempTextNodes[i];
                    const parentG = textNode.closest("g[id]");

                    if (!parentG) continue;

                    const rawId = parentG.getAttribute("id") || "";
                    /* console.log("rawId : " + rawId)*/
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
                    const outline = createOutlineRect(svgDoc, svgns, bbox, targetGroup.id);
                    var rx = outline.getAttribute('x');
                    var ry = outline.getAttribute('y');
                    var rw = outline.getAttribute('width');
                    var rh = outline.getAttribute('height');
                    determineZoomLevel(panZoom, bbox);
                    panToCenter(panZoom, rx, ry, rw, rh);
                    /*highlightText(targetGroup);*/

                    // 중복: 해당 id를 가진 g가 여러 개 → 텍스트만 보라색, 줌 X
                    matchedGroups.forEach(g => {
                        const texts = g.querySelectorAll("text");
                        g.setAttribute("data-state", "selected");
                    });
                } else if (count === 1) {
                    // 1개: 줌 + 보라색
                    // 1) vnet 줌/이동
                    runSearchTag_vnet(
                        searchTag,
                        svgDoc,
                        panZoom,
                        () => reSetStyle(svgType)
                    );

                    // 2) 해당 g 안의 텍스트를 보라색으로
                    const targetGroup = matchedGroups[0];
                    targetGroup.setAttribute("data-state", "selected");
                }
                LAST_SELECTED_NODE = findElementByMultiId(svgDoc, searchTag);
            }

            //  ***실시간 값 초기 세팅은 별도의 비동기 블록에서 실행***
            //    여기서 await 하지 않음 → 뷰어 렌더링을 막지 않음
            (async () => {
                const utagToElementMap = UTAG_TO_ELEMENT_LIST;

                if (!Array.isArray(utagToElementMap) || utagToElementMap.length === 0) {
                    console.warn("UTagInfo 에서 추출된 태그가 없습니다. 실시간 값 업데이트 생략.");
                    return;
                }

                // 여기서부터는 "20개씩 끊어서 비동기 업데이트"를 시작
                // 첫 chunk는 즉시, 이후에는 REQUEST_INTERVAL_MS 마다 한 chunk 씩
                startDataparcRealtimeUpdate(svgDoc, utagToElementMap, REQUEST_INTERVAL_MS);
            })();
        });

        const container = document.getElementById("svgarea");
        container.innerHTML = "";
        container.appendChild(object);
    }

    // 이슈
    // 1. url 에 tags로 중복된 값을 보내서 리턴값을 가져옴 : fetchDataFromServer
    // 2. 태그 별로 다양한 조건 값들이 존재 -> 발견하면 조건 값 셋팅 필 !

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
    window.startDataparcRealtimeUpdate = startDataparcRealtimeUpdate
})();
