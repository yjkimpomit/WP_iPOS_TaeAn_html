(function () {

    let isRendering = false;

    // 렌더링 상태를 반환하는 함수
    // 이 함수는 렌더링이 진행 중인지 여부를 확인하는 데 사용됩니다.
    // 렌더링이 진행 중이면 true, 그렇지 않으면 false를 반환
    // 렌더링 중 검색 기능 사용시 에러 방지
    function getIsRendering() {
        return isRendering;
    }
    // 뷰어에서 특정 태그 클릭 시
    // 테이블에서 특정 태그를 강조 표시하고 스크롤
    function tbHighlightRow(tag) {

        const rows = document.querySelectorAll("#idTableBody tr");
        rows.forEach(row => {
            const idCell = row.cells[2]; // ID가 3번째 셀이라면 (숨김 후 순서에 맞춰 수정)
            if (idCell && idCell.textContent.trim() === tag) {
                row.scrollIntoView({ behavior: "smooth", block: "center" });
                // 모든 셀에 배경 적용
                const tds = Array.from(row.cells);
                tds.forEach(td => td.style.backgroundColor = "#fffae6");

                setTimeout(() => {
                    tds.forEach(td => td.style.backgroundColor = "");
                }, 3000);
            }
        });
    }
    // 테이블을 초기화하고 새 데이터를 렌더링
    // tempTextNodes: <text> 노드들의 배열
    function resetTable(tempTextNodes, renderFn) {
        document.getElementById("tbSearchTarget").value = "";
        document.getElementById("idTableBody").innerHTML = "";

        if (tempTextNodes) {
            renderFn(tempTextNodes, document.getElementById("idTableBody"));
        }
    }
    // 테이블의 모든 행을 표시
    // 이 함수는 테이블의 모든 행을 다시 표시하는 데 사용됩니다.
    function showAllRows() {
        const rows = document.querySelectorAll("#idTableBody tr");
        rows.forEach(row => {
            row.style.display = "";
        });
    }
    /** (미사용 함수) 사유 : 반복 렌더링 */
    function filterTableByKeyword(tempTextNodes, renderFn) {
        const keyword = document.getElementById("tbSearchTarget").value.trim().toLowerCase();
        const selectBoxType = document.getElementById("idSelector").value;

        if (!keyword) {
            alert("검색어를 입력하세요.");
            return;
        }
        if (!tempTextNodes) {
            alert("파일을 업로드하세요.");
            return;
        }

        const filteredNodes = Array.from(tempTextNodes).filter(textEl => {
            const parentGroup = textEl.closest("g");
            const gId = parentGroup?.getAttribute("id")?.toLowerCase() || "";
            const textContent = textEl.textContent?.toLowerCase() || "";
            return selectBoxType === "text" ? textContent.includes(keyword) : gId.includes(keyword);
        });

        document.getElementById("idTableBody").innerHTML = "";
        renderFn(filteredNodes, document.getElementById("idTableBody"));
    }
    // 테이블에서 검색어로 행을 필터링
    // 검색어가 입력되면 해당 행만 표시하고 나머지는 숨김
    function filterTableByKeyword_ShowHide() {
        const keyword = document.getElementById("tbSearchTarget").value.trim().toLowerCase();
        const selectBoxType = document.getElementById("idSelector").value;
        const tableBody = document.getElementById("idTableBody");
        const tableWrapper = tableBody.closest("div[style*='overflow-y']");

        if (!keyword) {
            alert("검색어를 입력하세요.");
            return;
        }

        if (tableWrapper) {
            tableWrapper.scrollTop = 0;
        }
        const rows = document.querySelectorAll("#idTableBody tr");

        rows.forEach(row => {
            const textCell = row.cells[1]?.textContent?.toLowerCase() || "";
            const idCell = row.cells[2]?.textContent?.toLowerCase() || "";

            const match = (selectBoxType === "text")
                ? textCell.includes(keyword)
                : idCell.includes(keyword);

            row.style.display = match ? "" : "none";
        });
    }

    // chunkSize 1회당 출력 갯수 설정 가능 -> 50 넘어가면 UI 버벅임 발생
    function renderTableAsync(tempTextNodes, idTableBody, chunkSize = 30, onComplete = () => { }) {
        // 디버그 컬럼(원본 <text>, <g>) 표시 여부 (thead에서 이미 주석처리 했으니 false 유지)
        const SHOW_DEBUG_COLS = false;
        // 렌더링 상태 플래그 true로 설정 (중복 실행 방지)
        isRendering = true;

        // DOM 조각(Fragment)을 사용하여 렌더링 효율 최적화
        const fragment = document.createDocumentFragment();

        // 현재 렌더링할 인덱스 위치
        let index = 0;

        // 일정 단위로 나누어 테이블을 비동기적으로 렌더링하는 내부 함수
        function processChunk() {

            // 현재 처리할 시작과 끝 인덱스 계산
            const start = index;
            const end = Math.min(index + chunkSize, tempTextNodes.length);

            // 각 텍스트 요소를 순회하며 테이블 행 생성
            for (let i = start; i < end; i++) {
                const textEl = tempTextNodes[i]; // <text> 노드
                const textContent = textEl.textContent || ''; // 텍스트 내용 추출

                const parentGroup = textEl.closest("g"); // 가장 가까운 <g> 그룹 찾기
                if (!parentGroup) continue; // 그룹이 없으면 무시

                const hasGroupId = parentGroup?.hasAttribute("id"); // <g> 태그에 id 존재 여부 확인

                const rawTextTag = textEl.outerHTML ?? ""; // 원본 <text> 태그 문자열
                const rawGroupTag = parentGroup?.outerHTML ?? ""; // 원본 <g> 태그 문자열
                const gId = parentGroup?.getAttribute("id") || ""; // 그룹의 id 값

                // <tr> 행 생성
                const row = document.createElement("tr");

                // 고유 번호 칸 (클릭 가능)
                const tdNumber = document.createElement("td");
                tdNumber.style.cursor = "pointer";

                if (gId) {
                    // id가 있는 경우 강조 표시
                    const span = document.createElement("span");
                    span.style.color = "#124AD1";
                    span.style.fontWeight = "bold";
                    span.textContent = `${i + 1}`;
                    tdNumber.appendChild(span);
                } else {
                    tdNumber.textContent = `${i + 1}`;
                }

                let tdRealText, tdPost;
                if (SHOW_DEBUG_COLS) {
                    tdRealText = document.createElement("td");
                    tdRealText.textContent = rawTextTag;
                    tdRealText.style.whiteSpace = "normal";
                    tdRealText.style.wordBreak = "break-word";

                    tdPost = document.createElement("td");
                    tdPost.textContent = hasGroupId ? rawGroupTag : "";
                    tdPost.style.whiteSpace = "normal";
                    tdPost.style.wordBreak = "break-word";
                }
                // 실제 텍스트 내용 출력
                const tdText = document.createElement("td");
                tdText.textContent = textContent;
                tdText.style.whiteSpace = "normal";
                tdText.style.wordBreak = "break-word";

                // id 출력 및 클릭 시 SVG에서 해당 요소 검색
                const tdId = document.createElement("td");
                tdId.textContent = gId;
                tdId.style.cursor = "pointer";
                tdId.style.color = "#124AD1";
                tdId.style.fontWeight = "bold";
                tdId.style.whiteSpace = "normal";
                tdId.style.wordBreak = "break-word";

                // 번호와 ID 셀 모두 클릭 시 SVG로 메시지 전송
                // 필요 없는 요소 클릭 이벤트는 빼면 됨 
                [tdNumber, tdId].forEach(el =>
                    el.addEventListener("click", () => {
                        if (!gId || !svgDoc) return;

                        const targetElement = svgDoc.getElementById(gId);
                        if (!targetElement) return;

                        reSetStyle(svgType);

                        if (ckType === "pmt") {
                            highlightAndZoomToElement(
                                targetElement,
                                svgDoc,
                                svgElement,
                                panZoom,
                                () => viewReset(panZoom),
                                calculateFixedCenter
                            );

                            const textNodes = targetElement.getElementsByTagName("text");
                            if (textNodes.length > 0) {
                                const text = textNodes[0];
                                text.setAttribute("stroke", "#a52bff");
                                text.setAttribute("stroke-width", "0.05px");
                            }

                        } else {
                            const bbox = targetElement.getBBox();
                            determineZoomLevel(panZoom, bbox);
                            panToCenter(panZoom, bbox.x, bbox.y, bbox.width, bbox.height);
                            highlightText(targetElement);
                        }

                        tbHighlightRow(gId); // 테이블 행 강조
                    })
                );

                // thead(순번, TEXT 값, ID)에 맞춰서만 append
                if (SHOW_DEBUG_COLS) {
                    row.append(tdNumber, tdRealText, tdPost, tdText, tdId);
                } else {
                    row.append(tdNumber, tdText, tdId);
                }

                // fragment에 추가 (DOM 직접 접근 최소화)
                fragment.appendChild(row);
            }

            // 다음 chunk 범위로 인덱스 증가
            index += chunkSize;

            if (index < tempTextNodes.length) {
                // 아직 남은 데이터가 있다면 fragment를 추가하고 다음 chunk 예약
                idTableBody.appendChild(fragment);
                setTimeout(processChunk, 0); // 비동기 재귀 호출 (UI 멈춤 방지)
            } else {
                // 마지막 chunk 처리 후 fragment 추가 및 완료 콜백 실행
                idTableBody.appendChild(fragment);
                isRendering = false;
                alert("리스트 생성 완료")
                onComplete(); // 후처리 콜백
            }
        }

        // 첫 chunk 처리 시작
        processChunk();
    }
    /** (미사용 함수) 사유 : post 타입 태그 전송 방식 */
    function searchTag() {
        if (isRendering) {
            alert("리스트 생성 중입니다. 잠시만 기다려주세요.");
            return;
        }
        const target = document.getElementById("txtSearchTarget").value.trim();
        if (!target) {
            alert("검색어를 입력해주세요.");
            return;
        }
        const iframe = document.getElementById("svgContanier");
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: "searchTag", tag: target }, "*");
        }
    }

    function setupMouseTracking(svgElement, svgDoc) {
        svgElement.addEventListener("mousemove", function (event) {
            const point = svgDoc.createElementNS("http://www.w3.org/2000/svg", "svg").createSVGPoint();
            point.x = event.clientX;
            point.y = event.clientY;
            const svgCoords = point.matrixTransform(svgElement.getScreenCTM().inverse());

            // mouseCoords 요소가 존재할 때만 업데이트
            const coordDisplay = parent.document.getElementById("mouseCoords");
            if (coordDisplay) {
                coordDisplay.innerText = `좌표: X=${svgCoords.x.toFixed(2)}, Y=${svgCoords.y.toFixed(2)}`;
            }
        });
    }
    // 커서 스타일 설정
    function setCursor(version_prent, type) {
        version_prent.style.cursor = type;
    }
   
    function findElementByMultiId(svgDoc, targetId) {
    if (!svgDoc || !targetId) return null;

    const allWithId = svgDoc.querySelectorAll("[id]");
    const trimmedTarget = targetId.trim();

    for (const el of allWithId) {
        const rawId = el.getAttribute("id") || "";
        const idList = rawId
            .split(",")
            .map(s => s.trim())
            .filter(s => s.length > 0);
        if (idList.includes(trimmedTarget)) {
            return el;
        }
    }
    return null;
}
    //// PMT 맵핑 뷰어에서 특정 태그 검색 및 강조/확대
    //// 여기서 중복 체크를 하고  중복인 경우는 텍스트 색상만 바꾸고 줌 취소
    function runSearchTag_pmt(
        targetId, svgDoc, svgElement, panZoom,
        reSetStyleFn, highlightAndZoomToElementFn,
        viewResetFn, calculateFixedCenterFn
    ) {
        if (!svgDoc) return;

        reSetStyleFn();
        
        const item = findElementByMultiId(svgDoc, targetId);
		
        if (!item) {
            console.warn("요소를 찾을 수 없습니다:", targetId);
            alert(`ID "${targetId}"에 해당하는 요소를 찾을 수 없습니다.`);
            return;
        }

        highlightAndZoomToElementFn(
            item,
            svgDoc,
            svgElement,
            panZoom,
            () => viewResetFn(panZoom),
            calculateFixedCenterFn
        );


    }

    function runSearchTag_vnet(targetId, svgDoc, panZoom, reSetStyleFn) {
        if (!svgDoc) return;

        reSetStyleFn();

        const item = findElementByMultiId(svgDoc,targetId);
        if (!item) {
            console.warn("요소를 찾을 수 없습니다:", targetId);
            alert(`ID "${targetId}"에 해당하는 요소를 찾을 수 없습니다.`);
            return;
        }

        const bbox = item.getBBox();

        if (bbox.width < 75 && bbox.height < 100)
            panZoom.zoom(10);
        else
            panZoom.zoom(5);

        panZoom.pan({ x: 0, y: 0 });

        const realZoom = panZoom.getSizes().realZoom;

        panZoom.pan({
            x: -(bbox.x * realZoom) + (panZoom.getSizes().width / 2) - ((bbox.width * realZoom) / 2),
            y: -(bbox.y * realZoom) + (panZoom.getSizes().height / 2) - ((bbox.height * realZoom) / 2)
        });

        const text = item.childNodes[1];
        if (text != null && typeof text !== 'undefined') {
            text.setAttribute("stroke", "#a52bff");
            text.setAttribute("stroke-width", "0.05px");
        }
    }

    function reSetStyle(version) {
        for (let i = 0; i < version.length; i++) {
            const version_id = version[i];
            const version_prent = version_id?.parentNode?.parentNode;
            if (!version_prent) continue;

            const textNodes = version_prent.getElementsByTagName("text");
            if (textNodes.length > 0) {
                const text = textNodes[0];
                text.setAttribute("stroke", "none");
            }
            version_prent.style.fill = version_prent.getAttribute("data-original-fill") || "black";
        }
    }

    function safeFilterTable() {
        if (isRendering) {
            alert("리스트 생성 중입니다. 잠시만 기다려주세요.");
            return;
        }
        filterTableByKeyword_ShowHide();
    }

    function handleResetTable() {
        showAllRows();
    }

    // 전역 등록 (export 목적)
    window.getIsRendering = getIsRendering;
    window.tbHighlightRow = tbHighlightRow;
    window.resetTable = resetTable;
    window.showAllRows = showAllRows;
    window.filterTableByKeyword = filterTableByKeyword;
    window.filterTableByKeyword_ShowHide = filterTableByKeyword_ShowHide;
    window.renderTableAsync = renderTableAsync;
    window.searchTag = searchTag;
    window.setupMouseTracking = setupMouseTracking;
    window.setCursor = setCursor;
    window.runSearchTag_pmt = runSearchTag_pmt;
    window.runSearchTag_vnet = runSearchTag_vnet;
    window.reSetStyle = reSetStyle;
    window.safeFilterTable = safeFilterTable;
    window.handleResetTable = handleResetTable;
    window.findElementByMultiId =findElementByMultiId;
})();
