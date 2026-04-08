(function () {

    const FIXED_BASES = ['test_viewer_file/', './pnid/', './'];

    function handlePVTextBlock(el, pvDefs, value, id) {

        // PVTextBlock 요소의 경우
        // pvDefs에서 PVTextBlock.Text와 PVTextBlock.Foreground 요소를 찾음 : getElementsByTagName 사용 필수
        const pvBT = pvDefs.getElementsByTagName("PVTextBlock.Text")
        const pvBF = pvDefs.getElementsByTagName("PVTextBlock.Foreground")
        
        // <tspan> 내부만 변경
        const tspan = el.querySelector("tspan");
        
         //    (DataPARC useType=N 이거나, 미연동 표시)
	    const sv = (value ?? "").toString().trim();
	    if (sv === "-" || sv === "----" || sv === "" || sv === "null" || sv === "NULL") {
	        if (tspan) tspan.textContent = "-";
	        else el.textContent = "-";
	        
	        return true;
	    }

        // 안전하게 MultiBinding 찾기
        let mb = null;

        // 1) 정규 경로: PVTextBlock.Text 바로 아래 MultiBinding
        if (pvBT && pvBT.length > 0) {
            const mbs = pvBT[0].getElementsByTagName("MultiBinding");
            if (mbs && mbs.length > 0) mb = mbs[0];
        }

        // 2) 폴백: defs 전체에서 MultiBinding 중 부모가 PVTextBlock.Text 인 것
        if (!mb) {
            const allMBs = pvDefs.getElementsByTagName("MultiBinding");
            mb = Array.from(allMBs).find(n => n.parentElement?.tagName === "PVTextBlock.Text") || null;
        }

        if (!mb) {
            console.warn(`[${id}] PVTextBlock.Text > MultiBinding 없음 (defs_${id})`,
                [...pvDefs.children].map(n => n.tagName));
            return true; // ← 함수에서 종료
        }

        // 여기서부터 사용
        const formatPattern = (mb.getAttribute("ConverterParameter") || "").trim(); // 예: "0.00"
        // 기존 스타일 복사
        const originalStyle = el.getAttribute("style") || "";
        



        // 텍스트 요소인 경우
        // 값이 시간 형식이면 그대로 표시
        // 조건 1: Text만 있는 경우
        if (pvBT.length > 0 && pvBF.length === 0) {

            if (tspan) {
                //fallbackValue 처리

                const contentValue = getMatchedOrFallbackValues(el, pvDefs, value, id);
                //API 절대 값
                const absValue = formatTextValue(Math.abs(value), formatPattern);
                // console.log(`여기니? contentValue=${contentValue}, absValue=${absValue}, value=${value}, formatPattern=${formatPattern}`);
                if (value === "------" || value === "1" || value === "0") {
                    tspan.textContent = value < 0 ? `${contentValue}-` : contentValue;
                }
                else {
                    tspan.textContent = value < 0 ? `${absValue}-` : absValue;
                }

            }

            el.setAttribute("style", originalStyle);  // 그대로 다시 셋팅
            return true; // ← 호출부에서 continue
        }

        // 조건 2: Text와 Foreground 모두 있는 경우
        else if (pvBT.length > 0 && pvBF.length > 0) {

            if (tspan) {
                const absValue = formatTextValue(Math.abs(value), formatPattern)
                console.log(`아니니?? , absValue=${absValue}, value=${value}, formatPattern=${formatPattern}`);

                if (value === "------" || value === "1" || value === "0") {
                    tspan.textContent = value < 0 ? `${contentValue}-` : contentValue;
                }
                else {
                    tspan.textContent = value < 0 ? `${absValue}-` : absValue;
                }
            }
            const fillColor = getMatchedOrFallbackValues(el, pvDefs, value, id, "PVTextBlock.Foreground > MultiBinding");
            if (fillColor) el.style.fill = fillColor;
            return true;
        }
        return true;
    }
    function handleSetFillColor(el, pvDefs, value, id) {
        const fillColor = getMatchedOrFallbackValues(el, pvDefs, value, id);

        if (fillColor) el.style.fill = fillColor;
        // Path 계열 → 색상 변경
        // pvDefs에서 PVcvtMap.TargetMap 요소를 찾음 
    }
    function handlePolyLinecon(el, pvDefs, value, id) {

        const styleValue = getMatchedOrFallbackValues(el, pvDefs, value, id);
        if (styleValue && (styleValue.includes("Hidden") || styleValue.includes("Visible"))) {
            el.style.visibility = styleValue;


        } else { el.style.stroke = styleValue; }
        return true;

    }
    function handleProcessRect(svgDoc, el, pvDefs, value, id) {

        // 조건 추가 필요 : 바 계열인지, 색상 계열인지 구분
        const hasLevelFill = !!pvDefs.querySelector('PVLevelFillControl');
        // 바 계열만 필터링
        if (id.includes("pbBarBoundingRectEl") || hasLevelFill) {

            let levelMax = "", levelMin = "", levelBrush = "", levelDir = "", levelStart = "";

            const pvLFC = pvDefs.getElementsByTagName("PVLevelFillControl");

            if (pvLFC.length === 0) {
                console.warn(`PVLevelFillControl 요소가 없습니다: ${id}`);
                return true; // ← 함수에서 종료 (continue 아님)
            }
            else {
			console.warn(`PVLevelFillControl 요소가 있습니다: ${id}`);
			console.warn(`PVLevelFillControl 요소가`);
                for (const el of pvLFC) {

                    levelMax = el.getAttribute("LevelMax");
                    levelMin = el.getAttribute("LevelMin")
                    levelBrush = el.getAttribute("LevelBrush");
                    levelDir = el.getAttribute("LevelDirection");
                    levelStart = el.getAttribute("LevelStart");
 				
                }
            }

            const maxValue = parseFloat(levelMax - (levelMin)); // PVLevelFillControl.LevelMax와 동일하게 설정
            const currentValue = parseFloat(value);
            const percent = Math.max(0, Math.min(1, currentValue / maxValue)); // 0~1 사이로 정규화
            const x = parseFloat(el.getAttribute("x"));
            const y = parseFloat(el.getAttribute("y"));
            const width = parseFloat(el.getAttribute("width"));
            const height = parseFloat(el.getAttribute("height"));
          

            if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
                console.warn(`Rect 속성 값이 유효하지 않습니다: ${id}`);
                return true; // ← 함수 종료
            }

            const fillHeight = height * percent;
            const fillY = y + (height - fillHeight); // 아래에서 위로 차오르도록 Y 보정
            const fillWidth = width * percent;

            const progressRectId = id + "_progress";

            // 기존 진행 바 제거
            // 기존 진행 바가 아래로 줄어들 수 도 있다는 점을 고려하여 셋팅
            const existing = svgDoc.getElementById(progressRectId);
            if (existing) existing.remove();

            // 진행 바 생성
            const progressRect = svgDoc.createElementNS("http://www.w3.org/2000/svg", "rect");

            if ((levelDir || '').toLowerCase() === 'right') {
                // 왼쪽 → 오른쪽으로 채움 (일반적인 Right 의미)
                progressRect.setAttribute("x", x);
                progressRect.setAttribute("y", y);
                progressRect.setAttribute("width", fillWidth);
                progressRect.setAttribute("height", height);

            }else if (!isNaN(parseFloat(levelStart)) && levelMin && levelMax) {

			  const max = parseFloat(levelMax);
			  const min = parseFloat(levelMin);
			  const start = parseFloat(levelStart);
			  const span = Math.max(1e-9, max - min);
			
			  let cur = parseFloat(value);
			  if (isNaN(cur)) cur = start;
			
			  // clamp
			  cur = Math.min(max, Math.max(min, cur));
			  const s = Math.min(max, Math.max(min, start));
			
			  // value -> y (max가 위, min이 아래)
			  const valueToY = (v) => y + height * (max - v) / span;
			
			  const yStart = valueToY(s);
			  const yCur = valueToY(cur);
			
			  const topY = Math.min(yStart, yCur);
			  const h = Math.abs(yCur - yStart);
			
			  progressRect.setAttribute("x", x);
			  progressRect.setAttribute("y", topY);
			  progressRect.setAttribute("width", width);
			  progressRect.setAttribute("height", h);
			
			  console.warn(`[START-BASED] id=${id} min=${min} max=${max} start=${s} cur=${cur} yStart=${yStart} yCur=${yCur} h=${h}`);
			} 
            /*else if (levelStart && levelMin && levelMax) {
                // 0 기준선 계산에 필요한 최소값 방어
                const max = parseFloat(levelMax);
                const min = parseFloat(levelMin);
                const span = Math.max(1e-9, max - min);

                const cur = isNaN(parseFloat(value)) ? 0 : parseFloat(value);

                // 0을 기준으로 한 양/음 범위와 그에 해당하는 픽셀 높이
                const posRange = Math.max(0, max - 0);   // 0→최대
                const negRange = Math.max(0, 0 - min);   // 최소→0
                const posPix = height * (posRange / span);
                const negPix = height * (negRange / span);

                // SVG 좌표계에서 "0"의 y 위치 (위에서 posRange만큼 내려온 지점)
                const baseY = y + (height * (posRange / span));

                // cur 부호에 따라 위/아래로 채우기
                let h = 0, y0 = baseY;
                if (cur >= 0 && posRange > 0) {
                    // 0에서 위로
                    h = Math.max(0, Math.min(posPix * (cur / posRange), posPix));
                    y0 = baseY - h;
                } else if (cur < 0 && negRange > 0) {
                    // 0에서 아래로
                    h = Math.max(0, Math.min(negPix * (Math.abs(cur) / negRange), negPix));
                    y0 = baseY;
                } // else → h=0

                progressRect.setAttribute("x", x);
                progressRect.setAttribute("y", y0);        // 음수면 baseY, 양수면 위로
                progressRect.setAttribute("width", width);
                progressRect.setAttribute("height", h);
            }*/
            // LevelStart 미지정, LevelMin/Max 사용
            else if (!levelStart && levelMin && levelMax) {

                const max = parseFloat(levelMax);
                const min = parseFloat(levelMin);
                const span = Math.max(1e-9, max - min);
                console.log(`LevelStart 미지정, LevelMin/Max 사용: min=${min}, max=${max}, span=${span}`);

                let checkValue = parseFloat(value);
                if (isNaN(checkValue)) checkValue = min;                    // NaN 방어 값없으면 min 값 사용 
                checkValue = Math.min(max, Math.max(min, checkValue));
                // min~max 클램프   : min 보다 작으면 min, max 보다 크면 max

                const percentFromMin = (checkValue - min) / span;    // min 기준 비율 [0..1]
                // 예시 : 100 -(-250) /400 = 350/400 = 0.875

                // 세로(기본): 아래(=min) → 위로 채움
                // 그려야 될 높이의 바 높이
                const fillHeightFromMin = height * percentFromMin;

                const fillYFromMin = y + (height - fillHeightFromMin);
                // 바가 아래에서 위로 채워지는데 정작 y축의 수치는 아래값이 더 크다 그래서 바가 그려지는 위치까지 y 값을 구할려면
                // 높이에서 오히려 그려지는 높이를 빼줘야 해당 위치의 y 값이 나온다.
                // fillHeight=30 ⇒ fillY = 80 + (180 - 30) = 230

                // 가로(우측 진행)
                const fillWidthFromMin = width * percentFromMin;

                if ((levelDir || '').toLowerCase() === 'right') {
                    progressRect.setAttribute("x", x);
                    progressRect.setAttribute("y", y);
                    progressRect.setAttribute("width", fillWidthFromMin);
                    progressRect.setAttribute("height", height);
                } else {
                    progressRect.setAttribute("x", x);
                    progressRect.setAttribute("y", fillYFromMin);
                    progressRect.setAttribute("width", width);
                    progressRect.setAttribute("height", fillHeightFromMin);
                }

                console.log(`Rect [${id}] - percent: ${percent}, fillHeight: ${fillHeight}, fillY: ${fillY}, fillWidth: ${fillWidth}, min: ${min}, max: ${max}, span: ${span}`);
            }
            else {
                // 기본: 아래 → 위로 채움
                progressRect.setAttribute("x", x);
                progressRect.setAttribute("y", fillY); // y 위치는 fillY로 설정
                progressRect.setAttribute("width", width);
                progressRect.setAttribute("height", fillHeight);
            }

            if (levelBrush) progressRect.setAttribute("fill", levelBrush);
            progressRect.setAttribute("opacity", "0.7");
            progressRect.setAttribute("id", progressRectId);
            el.parentNode.appendChild(progressRect);
            return true;

        } else {
            console.log(`Color setting rect ${id} (not a pbBarBoundingRectEl)`);
            const fillColor = getMatchedOrFallbackValues(el, pvDefs, value, id);
            if (fillColor) el.style.fill = fillColor;
            return true;
        }
    }
    function handleColorCanvas(el, pvDefs, value, id) {
        const paths = el.querySelectorAll("path[id^='Path_']");
        const fillColor = getMatchedOrFallbackValues(el, pvDefs, value, id);

        if (fillColor) {
            paths.forEach(path => {
                path.style.fill = fillColor;
            });
        }
        return true;
    }
    function handleLineCon(el, pvDefs, value, id) {
        const styleValue = getMatchedOrFallbackValues(el, pvDefs, value, id);

        const _sv = (styleValue ?? '').toString().trim();
        if (!_sv) { console.warn(`[${id}] lineconnector: styleValue 없음`); return true; }
        if (/^(hidden|visible)$/i.test(_sv)) { el.style.visibility = _sv; return true; }

        if (styleValue && (styleValue.includes("Hidden") || styleValue.includes("Visible"))) {
            el.style.visibility = styleValue;
        }
        // stroke, fill 속성 존재 여부 확인
        const styleAttr = (el.getAttribute('style') || '').toLowerCase();
        const hasStroke = el.hasAttribute('stroke') || styleAttr.includes('stroke:');
        const hasFill = el.hasAttribute('fill') || styleAttr.includes('fill:');
        // stroke, fill 속성 중 하나만 존재할 때만 변경
        if (hasStroke && !hasFill) {
            el.style.stroke = styleValue;
        } else if (!hasStroke && hasFill) {
            el.style.fill = styleValue;
        }
        return true;
    }
    function handleViewBox(el, pvDefs, value, id) {
        const contentValue = getMatchedOrFallbackValues(el, pvDefs, value, id);
        if (contentValue && contentValue.trim() !== "") {
            el.style.visibility = contentValue;
        }
        return true;
    }
    // 가벼운 존재 확인: 서버가 HEAD 미지원이면 Range GET으로 폴백
    async function headExists(url) {
        try {
            const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
            if (res.ok) return true;
            if ([405, 501, 403].includes(res.status)) {
                const r = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, cache: 'no-store' });
                return r.ok;
            }
            return false;
        } catch { return false; }
    }

    function dtDisplaysCheckHandler(svgDoc) {

        const dtDisplays = svgDoc.querySelectorAll('g[wpftagname="DateTimeDisplay"] text');

        if (dtDisplays.length !== 0) {
            dtDisplays.forEach(dtd => {

                const textNode = dtd.getAttribute("datetimeformat")?.trim();

                if (textNode === "yyyy-MM-dd hh:mm:ss") {
                    const now = formatDateTime();
                    dtd.textContent = now;
                }
                else if (textNode === "yyyy-MM-dd tt hh:mm:ss") {
                    const ttNow = formatYMD_tt_hms();
                    dtd.textContent = ttNow;
                }

            });
        }
    }


    window.handleViewBox = handleViewBox;
    window.handleLineCon = handleLineCon;
    window.handleColorCanvas = handleColorCanvas;
    window.handleProcessRect = handleProcessRect;
    window.handlePolyLinecon = handlePolyLinecon;
    window.handleSetFillColor = handleSetFillColor;
    window.handlePVTextBlock = handlePVTextBlock;
    window.dtDisplaysCheckHandler = dtDisplaysCheckHandler;

})();
