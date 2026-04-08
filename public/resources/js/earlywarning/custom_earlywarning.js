/**
 * *******************************************************
 * 설비 마스터 트리 정보의 공통 메소드 *
 * *******************************************************
 */

'use strict';

/* set var */
var plantId = "3";
var unitId = "1";

/* set paramter values */
function fnSetParamValues(plantIdx, unitIdx, tagId) {
    $("#searchForm #plantIdx").val(plantIdx);
    $("#searchForm #unitIdx").val(unitIdx);
    $("#searchForm #tagId").val(tagId);
}

/** Set 트리의 정보 */
function fnSearchTagId(plantIdx, unitIdx, tagId) {
    fnSetParamValues(plantIdx, unitIdx, tagId);
    fnSearchList();
}

/** Set Tag tree List */
function fnLoadTagTree(zNodes, hoki) {
    // zTree 설정
    var setting = {
        view: {
            showIcon: false,
            nameIsHTML: true,
            showTitle: false,
            expandSpeed: ""
        },
        data: {
            simpleData: {
                enable: true
            }
        },
        callback: {
            onAsyncSuccess: function () {
            },
            onNodeCreated: function (event, treeId, node) {
            },
            onClick: function (event, treeId, treeNode, clickFlag) {
                try {
                    //if (treeNode && (treeNode.isParent === false)) {
                    //console.log("## fnLoadFacilityTree onclick ## " + JSON.stringify(treeNode));

                    var plantIdx = treeNode['data-plant'];
                    var unitIdx = treeNode['data-unit'];
                    var tagId = treeNode['data-tagId'];
                    var idx = treeNode['id'];

                    // 태그가 아닌 상위 노드임
                    if (tagId === '0') {
                        var datas = treeObj.transformToArray(treeNode.children || []);
                        var leafTagIds = datas
                            .filter(function (n) {
                                return n.isParent === false;
                            })
                            .map(function (n) {
                                return n['data-tagId'];
                            })
                            .filter(Boolean);

                        //console.log('## leafTagIds ##', leafTagIds);

                        tagId = leafTagIds.join(',');
                    }

                    // 해당 태그 데이터 검색 리스트
                    fnSearchTagId(plantIdx, unitIdx, tagId);
                    //}
                } catch (e) {
                    console.error('Error fnLoadFacilityTree() :', e);
                }
            }
        }
    };

    // zTree 초기화
    var treeObj = $.fn.zTree.init($("#treeIpas_" + hoki), setting, zNodes);

    // --- 평탄화 결과 캐시 ---
    var allNodes = null;

    function getNodeAll() {
        allNodes = treeObj.transformToArray(treeObj.getNodes() || []);
    }

    getNodeAll();
}

/** ipas tree data List */
function fnipasTreeList() {
    $.ajax({
        type: "POST",
        url: "/earlywarning/ipasTreeList.do",
        data: $("#searchForm").serialize(),
        dataType: "json",
        beforeSend: function () {
            $("._TAG_LOADING_BAR").show();
        },
        success: function (data) {
            var startInit = function () {
                fnLoadTagTree(data, unitId);
            };
            if (window.requestAnimationFrame) {
                requestAnimationFrame(function () {
                    setTimeout(startInit, 0);
                });
            }
            else {
                setTimeout(startInit, 0);
            }
        },
        complete: function () {
            $("._TAG_LOADING_BAR").hide();
        }
    });
}

/* 호기 탭 */
function fnSelectUnit(hoki) {
    unitId = hoki;
    fnSetParamValues(plantId, hoki, "");

    fnipasTreeList();
    fnSearchList();
}

/* 검색 일수 정보 */
function SelectedDaysCount(start, end) {
    var cur = start.clone().startOf('day');
    var last = end.clone().startOf('day');

    $("#searchForm #daysCount").val(last.diff(cur, 'days') + 1); // 선택 포함 일수
}

/* 데이터 검색 리스트 */
function fnSearchList() {
    $.ajax({
        type: "POST"
        , url: "/earlywarning/list.do"
        , data: $("#searchForm").serialize()
        , dataType: "html"
        , beforeSend: function () {
            $("#loadingBar").css("display", "");
        }
        , success: function (data) {
            $("#_ALARM_LIST").html(data);
        }
        , error: function () {
            alert("오류가 발생했습니다.\n잠시 후 다시 시도해 주시기 바랍니다.");
        }
        , complete: function () {
            $("#loadingBar").css("display", "none");
        }
    });
}

function fnSearchForm() {
    $("#searchForm #pageIndex").val(1);

    fnipasTreeList();
    fnSearchList();
}

function setToday() {
    var picker = $('#startDate').data('daterangepicker');
    var start = moment().startOf('day');
    var end = moment().endOf('day');

    picker.setStartDate(start);
    picker.setEndDate(end);

    // set date range picker value
    $('#startDate').val(start.format('YYYY-MM-DD HH:mm'));
    $('#endDate').val(end.format('YYYY-MM-DD HH:mm'));
}

/* init load */
function fnLoadInitSearch() {
    fnSetParamValues(plantId, unitId, tagId);

    setToday();         // set Today
    fnipasTreeList();   // tree list
    fnSearchList();     // alarm list
}

$(document).ready(function () {
    /* set date range picker */
    $('#startDate').daterangepicker({
        timePicker: true,
        timePicker24Hour: true,
        ranges: {
            'Today': [moment(), moment()],
            'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
            'Last 7 Days': [moment().subtract(6, 'days'), moment()],
            'Last 30 Days': [moment().subtract(29, 'days'), moment()],
            'Last 6 Months': [moment().subtract(6, 'months'), moment()],
            'Last 1 Year': [moment().subtract(1, 'year'), moment()],
            'This Month': [moment().startOf('month'), moment().endOf('month')],
            'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        },
        alwaysShowCalendars: true,
        linkedCalendars: false,
        autoUpdateInput: false,
        showCustomRangeLabel: false,
        startDate: moment(),
        endDate: moment(),
        locale: {
            format: 'YYYY-MM-DD',
            separator: ' ~ ',
            applyLabel: '적용',
            cancelLabel: '닫기',
            fromLabel: '시작',
            toLabel: '종료',
            customRangeLabel: 'Custom',
            weekLabel: '주',
            daysOfWeek: ['일', '월', '화', '수', '목', '금', '토'],
            monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
            firstDay: 0
        }
    }, function (start, end, label) {
        SelectedDaysCount(start, end);

        $("#startDate").val(start.format('YYYY-MM-DD HH:mm'));
        $("#endDate").val(end.format('YYYY-MM-DD HH:mm'));

        fnipasTreeList();
        fnSearchList();
    });

    /* click today button */
    $("#searchToday").click(function () {
        fnLoadInitSearch();
    });

    /* click alarm test button */
    $("#btnAlarmTest").click(function () {
        $.ajax({
            type: "POST",
            url: "/earlywarning/addAlarm.do",
            dataType: "json",
            beforeSend: function () {
                $(".loading-bar").show();
            },
            success: function (data) {
                //console.log("## addAlarm OK ##");
            },
            error: function (request, status, error) {
                console.log("## addAlarm Fail ##");
            },
            complete: function () {
                $(".loading-bar").hide();
            }
        });
    });

    /* load list page */
    fnLoadInitSearch();
});

/*<%-- 페이지 이동 부분 --%>*/
function fnPageMove(f) {
    var currentPage = parseInt($("#currentPage").val());

    if (f === 'P') {
        if (currentPage === 1) {
            alert("처음 페이지입니다.");
            return false;
        }
        currentPage = currentPage - 1;
    }
    else if (f === 'N') {
        if (currentPage === totalPage) {
            alert("마지막 페이지입니다.");
            return false;
        }
        currentPage = currentPage + 1;
    }
    else if (f === 'M') {
        if (currentPage > totalPage) {
            alert("마지막 페이지는 " + totalPage + "입니다. 이 페이지를 초과할 수 없습니다.");
            $("#currentPage").val(totalPage);
            return false;
        }
    }

    $("#currentPage").val(currentPage);

    $("#searchForm #pageIndex").val(currentPage);
    fnSearchList();
}

/* 20251124 yjkim 알람팝업 */
// 조기경보 테이블 선택
const earlyWarningDiv = document.querySelector('.early-warning');

// 클릭으로 열린 상태인지 구분
let isClicked = false;

/**
 * 조기경보 태그의 시간별 알람 리스트
 * @param target
 */
function fnEarlyWarningTagList(target) {
    // set paramters
    $("#searchTagForm #searchDateStart").val($("#searchForm #startDate").val());
    $("#searchTagForm #searchDateEnd").val($("#searchForm #endDate").val());

    const hour = parseInt($(target).attr('data-hour'));
    $("#searchTagForm #searchHour").val(hour);
    $("#searchTagForm #tagId").val($(target).attr('data-tagId'));

    $.ajax({
        type: "POST",
        url: "/earlywarning/alarmOccTimeList.do",
        data: $("#searchTagForm").serialize(),
        dataType: "html",
        beforeSend: function () {
            $(".loading-bar").show();
        },
        success: function (data) {
            $("#_EW_POPUP_OCCTIME").html(data);
        },
        error: function (request, status, error) {
            console.log("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
        },
        complete: function () {
            $(".loading-bar").hide();
        }
    });
}

// 팝업 열기 (클릭용)
function showEarlyWarning(target) {
    // get datas
    console.log("## div.id 2222##", $(target).attr('data-hour') + " #### tagid #### " + $(target).attr('data-tagId'));

    if (!earlyWarningDiv) return;

    // 테이블 범위 안에서 popup 찾기
    const popup = earlyWarningDiv.querySelector('.ew-popup');
    if (!popup) return;

    // 기존 활성화 제거(테이블 범위 내부만)
    earlyWarningDiv.querySelectorAll('.ew-occured.active')
        .forEach(el => el.classList.remove('active'));

    target.classList.add('active');
    popup.classList.add('active');

    isClicked = true;

    // 외부 클릭 닫기 (한 번만 등록)
    document.addEventListener('click', outsideClose);

    // 리스트
    fnEarlyWarningTagList(target);
}

// 팝업 닫기
function closeEarlyWarning() {
    if (!earlyWarningDiv) return;

    const popup = earlyWarningDiv.querySelector('.ew-popup');
    if (!popup) return;

    popup.classList.remove('active');

    // 테이블 내부 알람만 초기화
    earlyWarningDiv.querySelectorAll('.ew-occured.active')
        .forEach(el => el.classList.remove('active'));

    isClicked = false;

    document.removeEventListener('click', outsideClose);
}

// 외부 클릭 닫기
function outsideClose(e) {
    if (!earlyWarningDiv) return;

    const popup = earlyWarningDiv.querySelector('.ew-popup');
    if (!popup) return;

    const isAlarm = e.target.closest('.ew-occured');
    const isPopupInside = popup.contains(e.target);

    if (!isAlarm && !isPopupInside) {
        closeEarlyWarning();
    }
}

/* 20251211 yjkim - Hover 시 알람 강조 + 팝업 열기 */
function hoverShowEarlyWarning(alarmEl) {
    if (!alarmEl || isClicked || !earlyWarningDiv) return;

    const popup = earlyWarningDiv.querySelector('.ew-popup');
    if (!popup) return;

    // 기존 활성화 제거
    earlyWarningDiv.querySelectorAll('.ew-occured.active')
        .forEach(el => el.classList.remove('active'));

    alarmEl.classList.add('active');
    popup.classList.add('active');

    // 리스트
    fnEarlyWarningTagList(alarmEl);
}

//Hover-out 시 숨기기
function hoverHideEarlyWarning(alarmEl) {
    if (!alarmEl || isClicked || !earlyWarningDiv) return;

    const popup = earlyWarningDiv.querySelector('.ew-popup');
    if (!popup) return;

    alarmEl.classList.remove('active');
    popup.classList.remove('active');
}

// .ew-occured 가 여러 행에 있어도 항상 본인이 hover한 행만 처리하도록 변경.
if (earlyWarningDiv) {

    // alarm hover in
    earlyWarningDiv.addEventListener('mouseenter', (e) => {
        const alarm = e.target.closest('.ew-occured');
        if (alarm && earlyWarningDiv.contains(alarm)) {
            hoverShowEarlyWarning(alarm);
        }
    }, true);

    // alarm hover out
    earlyWarningDiv.addEventListener('mouseleave', (e) => {
        const alarm = e.target.closest('.ew-occured');
        if (alarm && earlyWarningDiv.contains(alarm)) {
            hoverHideEarlyWarning(alarm);
        }
    }, true);

    // popup hover in
    earlyWarningDiv.addEventListener('mouseenter', (e) => {
        const popup = e.target.closest('.ew-popup');
        if (popup && !isClicked) {
            popup.classList.add('active');
        }
    }, true);

    // popup hover out
    earlyWarningDiv.addEventListener('mouseleave', (e) => {
        const popup = e.target.closest('.ew-popup');
        if (popup && !isClicked) {
            popup.classList.remove('active');
            earlyWarningDiv.querySelectorAll('.ew-occured.active')
                .forEach(el => el.classList.remove('active'));
        }
    }, true);
}
/* 20251211 yjkim end */

/* + 버튼 클릭시 동작 - 아래 tr show/hide */
function toggleAlarmTr(th) {
    if (!th) return;

    const parentTr = th.closest('tr');   // th가 포함된 tr
    if (!parentTr) return;

    // 바로 다음 형제 tr 찾기
    let nextTr = parentTr.nextElementSibling;
    while (nextTr && nextTr.nodeType !== 1) {
        nextTr = nextTr.nextElementSibling;
    }
    if (!nextTr) return;

    // show/hide
    const isHidden = nextTr.style.display === '' || nextTr.style.display === 'none';
    nextTr.style.display = isHidden ? 'table-row' : 'none';

    // th 안의 img 변경
    const img = th.querySelector('img');
    if (img) {
        img.src = isHidden
            ? '/resources/images/icons/icon-remove-gray.svg'
            : '/resources/images/icons/icon-add-gray.svg';
    }
}

function toggleAllAlarmTr() {
    // 테이블 존재 여부 체크
    const table = document.querySelector('.table[aria-label="조기경보-조회결과"]');
    if (!table) return;

    // 상세 tr: td 내부에 .tg-box 포함된 tr 모두
    const detailRows = table.querySelectorAll('tr td .tg-box');
    if (!detailRows.length) return;

    // 상세 tr 실제 tr 요소 목록 만들기
    const rows = Array.from(detailRows).map(el => el.closest('tr'));

    // 현재 상태 판단: 하나라도 숨겨져 있으면 전체 열기
    const shouldOpen = rows.some(tr => tr.style.display === '' || tr.style.display === 'none');

    // 전체 열기 / 전체 닫기
    rows.forEach(tr => {
        tr.style.display = shouldOpen ? 'table-row' : 'none';
    });

    // + 버튼 아이콘 일괄 변경
    const toggleBtns = table.querySelectorAll('tbody th img');
    toggleBtns.forEach(img => {
        img.src = shouldOpen
            ? '/resources/images/icons/icon-remove-gray.svg'
            : '/resources/images/icons/icon-add-gray.svg';
    });

    // ★ thead 안의 전체 토글용 img도 변경
    const theadImg = table.querySelector('thead th img');
    if (theadImg) {
        theadImg.src = shouldOpen
            ? '/resources/images/icons/icon-collapse_all-darkgray.svg'
            : '/resources/images/icons/icon-expand_all-darkgray.svg';
    }
}

/* excel download */
function fnExcelDownloadEarlywarning() {
    var excelColList = [];

    $("th[name='excelCol']").each(function() {
        var fieldValue = $(this).data("field");
        excelColList.push(fieldValue);
    });
    $("#colList").val(excelColList);

    $.ajax({
        type : "POST",
        url : "/earlywarning/earlywarningExcelDownload.do",
        data : $("#searchForm").serialize(),
        xhrFields : {
            responseType : 'blob' // 응답을 Blob 형식으로 받기
        },
        beforeSend : function() {
            $("#loadingBar").css("display", "");
        },
        success : function(response, status, xhr) {
            //현재 날짜 가져오기
            var currentDate = new Date();
            var formattedDate = currentDate.getFullYear() + '-' +
                (currentDate.getMonth() + 1).toString().padStart(2, '0') + '-' +
                currentDate.getDate().toString().padStart(2, '0');

            // Blob을 사용하여 파일 다운로드 처리
            var blob = response;
            var link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = "조기경보_" + formattedDate + ".xlsx";
            link.click();  // 다운로드 트리거
        },
        error : function(request, status, error) {
            alert("오류가 발생했습니다.\n잠시 후 다시 시도해 주시기 바랍니다.");
        },
        complete : function() {
            $("#loadingBar").css("display", "none");
        }
    });
}
