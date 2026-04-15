/*
* common.js
*
* */

/* set WinBox */
var targetWinbox;

/* WinBox temp get data */
var winboxIsOpen = true;
var winboxTop;
var winboxHeight;

// Shared WinBox group margins to ensure minimized windows stack together
var WINBOX_GROUP = {
    pc: {top: 80, left: 48, right: 0, bottom: 0, border: 0}
    , tablet: {top: 48, left: 48, right: 0, bottom: 0, border: 0}
    , mobile: {top: 48, left: 0, right: 0, bottom: 0, border: 0}

    /* 20260107 yjkim - 반응형 크기적용 요청 */
    /*
    화면 리사이징시 winBox 포지션 설정

    [화면크기 767px 까지] - mobile
    >> winBox {top: 48, left: 0

    [화면크기 768px ~ 1537px 까지] - tablet
    >> winBox {top: 48, left: 48

    [화면크기 1536px 이상] - pc
    >> body에 .header-open 있으면, pc: {top: 80, left: 48
    >> body에 .header-open 없으면, pc: {top: 0, left: 48
    */
};

/* pc 모드에서 width 체크 */
function fnGetDeviceWidth() {
    var width = $(window).width();

    if (window.parent || window.parent.parent) {
        width = $(window.parent).width();

        if (width === undefined) {
            width = $(window.parent.parent).width();
        }
    }

    if (width <= 767) {
        return WINBOX_GROUP.mobile;
    }
    else if (width >= 768 && width <= 1537) {
        return WINBOX_GROUP.tablet;
    }
    else {
        return WINBOX_GROUP.pc;
    }
}

/* 디바이스 체크 */
function getDeviceType() {
    if (checkDevice === "mobile") {
        return WINBOX_GROUP.mobile;
    }
    else if (checkDevice === "tablet") {
        return WINBOX_GROUP.tablet;
    }
    else {
        return fnGetDeviceWidth();
    }
}

function getWinboxGroupOptions() {
    return getDeviceType();
}

window.addEventListener("resize", () => {
    // 화면 크기 변경에 따른 처리
    getWinboxGroupOptions();
});

/**
 * 메뉴 팝업창 열기
 * @param url
 * @param target
 */
function fnOpenPopup(url, target) {
    var title = target.data("title");

    // 기존 메뉴 닫기
    var closeTarget = ['대시보드', '일일안전현황', '설비정보', 'TM현황', '작업현황', '예방점검현황', '조기경보', 'CCTV', '설비검색', '서비스정보', '로그시트', '방문자 조회'];
    $('.wb-title').each(function () {
        // 이미 열려져 있는 창 닫기
        /*if (closeTarget.includes(title) && title === $(this).text()) {
            $(this).closest('.wb-header').find('.wb-close').trigger('click');
            return false;
        }*/

        // 같은 메뉴 2개 사용안함 - 메뉴 리스트와 비교해서 창닫기
        if (closeTarget.includes($(this).text())) {
            $(this).closest('.wb-header').find('.wb-close').trigger('click');
        }

        // all close
        // $('.wb-close').trigger('click');
    });

    // 모든 창 최소화
    fnCloseAllWinbox();

    var base = getWinboxGroupOptions();
    winboxTop = base.top;
    winboxHeight = base.height;

    targetWinbox = new WinBox(title, Object.assign({}, base, {
        groupId: "winMain-group"
        , class: ["no-full"]
        , url: url, onCreate: function (options) {
            options.autoResize = true;
        },
        onmaximize: function () {
            if (this.min) return;

            fnSetWinboxTop(this, winboxIsOpen);
        },
        onclose: function (force) {
            //console.table("### onClose ### " + title);
        }
    }));

    targetWinbox.maximize();

    /* 브라우저를 조절할때 처리 */
    window.addEventListener("resize", () => {
        if (!targetWinbox || !targetWinbox.g) return;
        if (!targetWinbox.min) {
            targetWinbox.restore();
            targetWinbox.maximize();
        }
    });
}

/**
 * 전체화면으로 팝업창 열기
 * @param url
 * @param target
 */
function fnOpenPopupFullscreen(url, target) {
    var title = target.data("title");
    var base = getWinboxGroupOptions();

    // Update global top/height
    winboxTop = base.top;
    winboxHeight = base.height;

    targetWinbox = new WinBox(title, Object.assign({}, base, {
        groupId: "winMain-group", class: ["no-full"], url: url, onCreate: function (options) {
            options.autoResize = true;
        },
        onmaximize: function () {
            if (this.min) return;

            fnSetWinboxTop(this, winboxIsOpen);
        }
    }));

    targetWinbox.maximize();

    /* 브라우저를 조절할때 처리 */
    window.addEventListener("resize", () => {
        if (!targetWinbox || !targetWinbox.g) return;
        if (!targetWinbox.min) {
            targetWinbox.restore();
            targetWinbox.maximize();
        }
    });
}

/**
 * WinBox에서 독립 WinBox로 띄우기
 * 이 메소드만 부모의 scriipt 변수를 필요로 하므로 parent를 사용해야 함
 * 멀티뷰 화면
 *
 * @param url
 * @param target
 */
function fnOpenPopupStandard(url, title) {
    // 열려져 있는 모든 창 최소화
    fnAllMinParentWinbox();

    /* iframe으로 팝업이므로 상위의 checkDevice 정보를 가지고 옴 */
    checkDevice = window.parent.checkDevice;

    // 상위에 팝업창 생성
    var base = getWinboxGroupOptions();

    // Update global top/height
    winboxTop = base.top;
    winboxHeight = base.height;
    var topWindow = window.top;

    console.log("########### parent val : " + window.parent.winboxIsOpen);

    targetWinbox = new topWindow.WinBox(title, Object.assign({}, base, {
        groupId: "winMain-group"
        , root: topWindow.document.body
        , class: ["no-full"]
        , url: url, onCreate: function (options) {
            options.autoResize = true;
        },
        onmaximize: function () {
            if (this.min) return;

            fnSetWinboxTop(this, window.parent.winboxIsOpen);
        },
        onclose: function (force) {
            // Set 3d model flag
            var iframe = $("#_MULTI_UNITY_VIEW iframe")[0];
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.fnCloseUnity();
            }
        }
    }));

    targetWinbox.maximize();

    /* 브라우저를 조절할때 처리 */
    window.addEventListener("resize", () => {
        if (!targetWinbox || !targetWinbox.g) return;
        if (!targetWinbox.min) {
            targetWinbox.restore();
            targetWinbox.maximize();
        }
    });
}

/**
 * 설비정보 메뉴 팝업창 열기
 * @param url
 * @param target
 */
function fnOpenPopupFacilityMenu(url, target) {
    var title = target.data("title");
    var base = getWinboxGroupOptions();

    // Update global top/height
    winboxTop = base.top;
    winboxHeight = base.height;

    if (checkDevice === "mobile") {
        targetWinbox = new WinBox(title, Object.assign({}, base, {
            groupId: "winMain-group", class: ["no-full", "facility"], width: "100%", height: "100%", url: url, onCreate: function (options) {
                options.autoResize = true;
            },
            onmaximize: function () {
                if (this.min) return;

                fnSetWinboxTop(this, winboxIsOpen);
            }
        }));
    }
    else if (checkDevice === "tablet") {
        targetWinbox = new WinBox(title, Object.assign({}, base, {
            groupId: "winMain-group", class: ["no-full", "facility"], width: "560", height: "100%", url: url, onCreate: function (options) {
                options.autoResize = true;
            },
            onmaximize: function () {
                if (this.min) return;

                fnSetWinboxTop(this, winboxIsOpen);
            }
        }));
    }
    else {
        targetWinbox = new WinBox(title, Object.assign({}, base, {
            groupId: "winMain-group", class: ["no-full", "facility"], width: "560", height: "100%", url: url, onCreate: function (options) {
                options.autoResize = true;
            },
            onmaximize: function () {
                if (this.min) return;

                fnSetWinboxTop(this, winboxIsOpen);
            }
        }));
    }

    fnSetWinboxTop(targetWinbox, winboxIsOpen);

    /* 브라우저를 조절할때 처리 */
    window.addEventListener("resize", () => {
        if (!targetWinbox || !targetWinbox.g) return;
        if (!targetWinbox.min) {
            targetWinbox.restore();
        }
    });
}

/**
 * 모든 창 닫기
 */
function fnWinPopAllClose() {
    if (!targetWinbox || !targetWinbox.g) return;

    if (confirm("모든 창을 닫겠습니까?")) {
        $(".wb-close").trigger('click');
    }
}

/**
 * 모든 창 최소화
 */
function fnWinPopMinimize() {
    if (!targetWinbox || !targetWinbox.g) return;

    if ($(".winbox:not(.min)").length > 0) {
        if (confirm("모든 창을 최소화하겠습니까?")) {
            fnCloseAllWinbox();
        }
    }
}

function fnWinOpenLogVisit(target) {
    fnOpenPopup("/log/index.do", target);
    $('.left-box').removeClass('expand');
}

/**
 * 페이지의 탭메뉴에 대한 기능 설정
 * tab trigger event
 * @param target
 */
function fnSetCommonBootstrapTab(target) {
    try {
        // Normalize to a DOM element (supports jQuery object or DOM node)
        var el = target && target.jquery ? target[0] : target;
        if (!el) return;

        if (window.bootstrap && typeof window.bootstrap.Tab === 'function') {
            var bsTab = new bootstrap.Tab(el);
            bsTab.show();
        }
        else if (window.jQuery) {
            // Bootstrap이 없더라도 최소한 ARIA/클래스 정리
            var $this = $(el);
            $('.nav-link').removeClass('active').attr('aria-selected', false);
            $this.addClass('active').attr('aria-selected', true);
            var targetSel = $this.attr('data-bs-target') || $this.attr('href');
            // 탭 패널 show 처리
            if (targetSel && targetSel.charAt(0) === '#') {
                $('.tab-pane').removeClass('show active');
                $(targetSel).addClass('show active');
            }
        }
    } catch (e) {
        console.log(e);
    }
}

// 3D모델 사용가이드 버튼제어
function closeControlGuide() {
    $('.unity-guide').fadeOut(500);
}

// 유니티에서 하단 버튼클릭시 가이드팝업 나타남
function openControlGuide() {
    $('.unity-guide').fadeIn(500);
}

$(document).ready(function () {

    var $leftBox = $('.left-box');
    var $toggleBtn = $('#toggle-button');

    /* =========================
       공통 상태 정리 함수
    ========================= */
    function resetHoverState() {
        $('#menuList .menu-box').removeClass('active');
    }

    /* =========================
       글로벌 메뉴 토글
    ========================= */
    function globalMenu() {

        $leftBox.toggleClass('expand');

        // hover 상태 제거 (expand 진입/해제 모두)
        resetHoverState();

        if ($leftBox.hasClass('expand')) {
            $toggleBtn.find('span').text('메뉴 닫기');

            // expand 시 hover 효과 제거
            $('#menuList .menu-box').removeClass('active');
        }
        else {
            $toggleBtn.find('span').text('메뉴 열기');
        }

        // 다른 버튼 초기화
        $('.operation-status').removeClass('visible');
        $('.btn-status img')
            .attr('src', '/resources/images/icons/icon-power.svg')
            .attr('alt', '기타정보 열기');

        // 서브메뉴 닫힌채 로드
        $('#menuList li .menu-box:has(.d2)').addClass('hide');
        $('.open-icon').addClass('close').attr('aria-expanded', 'false');
    }

    // 전역에서 사용 가능하도록 export
    window.globalMenu = globalMenu;


    /* =========================
       hover 이벤트 (collapsed 상태 전용)
    ========================= */
    $('#menuList .menu-item').hover(function () {

        if (!$leftBox.hasClass('expand')) {
            resetHoverState();
            $(this).siblings('.menu-box').addClass('active');
        }

    }, function () {

        if (!$leftBox.hasClass('expand')) {
            var $menuBox = $(this).siblings('.menu-box');

            setTimeout(function () {
                if (!$menuBox.is(':hover')) {
                    $menuBox.removeClass('active');
                }
            }, 100);
        }

    });


    /* =========================
       menu-box mouseleave
    ========================= */
    $('#menuList .menu-box').mouseleave(function () {
        if (!$leftBox.hasClass('expand')) {
            resetHoverState();
        }
    });


    /* =========================
       메뉴 클릭 시 GNB 닫기
    ========================= */
    $('#menuList .menu-link[onclick]').click(function () {

        $('.left-box').removeClass('expand');
        $toggleBtn.find('span').text('메뉴 열기');

        // hover 상태 제거
        resetHoverState();
    });

    /* =========================
       depth 메뉴 토글 (expand 상태 전용)
    ========================= */
    $('#menuList li').each(function () {

        var $li = $(this);
        var $menuItem = $li.find('.menu-item:has(.open-icon)');
        var $menuBox = $li.find('.menu-box');
        var $icon = $menuItem.find('.open-icon');

        $menuItem.on('click', function () {

            if ($leftBox.hasClass('expand')) {

                // depth 토글 시 hover 상태 제거
                resetHoverState();

                if ($menuBox.hasClass('hide')) {
                    // 닫힌 상태 → 열기
                    $menuBox.removeClass('hide');
                    $icon.removeClass('close').attr('aria-expanded', 'true');
                }
                else {
                    // 열린 상태 → 닫기
                    $menuBox.addClass('hide');
                    $icon.addClass('close').attr('aria-expanded', 'false');
                }
            }
        });
    });

	// 사이드 패널 열고닫기
	$('.js-panel-toggle').click(function () {

		var $btn = $(this);
		var $panel = $btn.closest('.panel-box').find('.side-panel');

		$panel.toggleClass('is-open');

		if ($panel.hasClass('is-open')) {
			$btn.find('span').text('좌측패널 닫기');
		} else {
			$btn.find('span').text('좌측패널 열기');
		}

	});

});

// 모바일: 헤더 > 운전정보 클릭시 실행
function operationInfo() {
    $('.left-box').removeClass('expand');
    $('#toggle-button').find('span').text('메뉴 열기');
    //$('#menuList').removeClass('show');
    //$('#toggle-button img').attr('src', '/resources/images/icons/icon-menu.svg').attr('alt', '메뉴 열기');

    if ($('.operation-status').hasClass('visible')) {
        // .operation-status에서 'visible' 클래스 제거
        $('.operation-status').removeClass('visible');
        // .btn-status에서 img의 src와 alt 속성 초기화
        $('#operationStatus img').attr('src', '/resources/images/icons/icon-power.svg').attr('alt', '기타정보 열기');
    }
    else {
        $('.operation-status').addClass('visible');
        $('#operationStatus img').attr('src', '/resources/images/icons/icon-close-gray.svg').attr('alt', '기타정보 닫기');
    }
}

// 모바일: 윈도우 리사이징 메뉴와 운전정보 버튼 초기화
window.addEventListener("resize", () => {
    $('.btn-status img').attr('src', '/resources/images/icons/icon-power.svg').attr('alt', '기타정보 열기');
    //$('#toggle-button img').attr('src', '/resources/images/icons/icon-menu.svg').attr('alt', '메뉴 열기');
    $('.operation-status').removeClass('visible');

    $('.left-box').removeClass('expand');
    $('#toggle-button').find('span').text('메뉴 열기');
});

//날짜 한달 전으로 세팅하는 공통 함수
function setDateS() {
    //날짜 현재날짜 기준 한 달 전 세팅
    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = ("0" + (today.getMonth() + 1)).slice(-2); // 월은 0부터 시작하므로 +1
    var dd = ("0" + today.getDate()).slice(-2);
    var currentDate = yyyy + "-" + mm + "-" + dd;
    $('#designDateEnd').val(currentDate); // 첫 번째 input에 오늘 날짜 설정

    // 두 번째 input 태그 (한 달 전 날짜로 설정)
    today.setMonth(today.getMonth() - 1); // 현재 날짜 기준 한 달 전으로 설정
    var lastMonthDate = today.getFullYear() + "-" + ("0" + (today.getMonth() + 1)).slice(-2) + "-" + ("0" + today.getDate()).slice(-2);
    $('#designDateStart').val(lastMonthDate); // 두 번째 input에 한 달 전 날짜 설정
}

function fnWoSearchForm() {
    $.ajax({
        type: "POST", url: "/common/wolInfo.do", dataType: "html", beforeSend: function () {
            $("#loadingBar").css("display", "");
        }, success: function (data) {
            $("#woSearchListForm").html(data);
        }, error: function (request, status, error) {
            console.log("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
        }, complete: function () {
            $("#loadingBar").css("display", "none");
        }
    });
}

// 검색박스내 W/O  팝업
function searchWoTreePopup(target) {
    $("#searchWoTreePopup").bPopup({
        modalClose: false, opacity: 0.2, speed: 450, closeClass: "close", onOpen: function () {
            $("#searchWoTreePopup").addClass('show');
            fnWoSearchForm();
        }, onClose: function () {
            $("#searchWoTreePopup").removeClass('show');
            $("#woSearchListForm").html('');
        }
    });
}

//W/O 상세 검색
function fnWoDetailSearch() {
    var startVal = "";
    var endVal = "";

    //조회 시작일
    startVal = document.getElementById("designDateStart").value;
    //조회 종료일
    endVal = document.getElementById("designDateEnd").value;

    if (startVal !== "" && endVal === "") {
        alert("조회 종료일을 선택해주세요");
        return false;
    }
    else if (startVal === "" && endVal !== "") {
        alert("조회 시작일을 선택해주세요");
        return false;
    }
    else if (startVal > endVal) {
        alert("조회 종료일을 시작일 이전으로 설정할 수 없습니다.\n조회 종료일을 다시 선택해주세요.");
        return false;
    }

    $.ajax({
        type: "POST", url: "/common/wolList.do", data: $("#form_search_woresult1").serialize(), dataType: "html", beforeSend: function () {
            $("#loadingBar").css("display", "");
        }, success: function (data) {
            $("#_VIEW_WO_RESULTS_LIST").html(data);
        }, error: function (request, status, error) {
            console.log("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
        }, complete: function () {
            $("#loadingBar").css("display", "none");
        }
    });
}

//설비마스터 상세 검색
function fnFacilityDetailSearch() {
    $.ajax({
        type: "POST", url: "/common/facilitydetailList.do?searchUseYn=S", data: $("#form_search_result1").serialize(), dataType: "html", beforeSend: function () {
            $("#loadingBar").css("display", "");
        }, success: function (data) {
            $("#facilityMasterList").html(data);
        }, error: function (request, status, error) {
            console.log("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
        }, complete: function () {
            $("#loadingBar").css("display", "none");
        }
    });
}

//설비마스터 페이지 이동 부분
function fnfacilityDetailPageMove(f) {
    var detailCurrentPage = parseInt($("#detailCurrentPage").val());

    var flg = $("#chkItemNo").val();
    var flgNo = "";
    if (f === 'P') {
        if (detailCurrentPage === 1) {
            alert("처음 페이지입니다.");
            return false;
        }

        detailCurrentPage = detailCurrentPage - 1;
    }
    else if (f === 'N') {
        if (detailCurrentPage == totalPage) {
            alert("마지막 페이지입니다.");
            return false;
        }

        detailCurrentPage = detailCurrentPage + 1;
    }
    else if (f === 'M') {
        if (detailCurrentPage > totalPage) {
            alert("마지막 페이지는 " + totalPage + "입니다. 이 페이지를 초과할 수 없습니다.");
            $("#detailCurrentPage").val(totalPage);
            return false;
        }
    }

    $("#detailCurrentPage").val(detailCurrentPage);
    var dataToSend = {};

    if (flg === "S") {
        $.ajax({
            type: "POST", url: "/common/facilitydetailList.do?searchUseYn=S&pageIndex=" + detailCurrentPage, data: $("#form_search_result1").serialize(), dataType: "html", beforeSend: function () {
                $("#loadingBar").css("display", "");
            }, success: function (data) {
                $("#facilityMasterList").html(data);
            }, error: function (request, status, error) {
                console.log("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
            }, complete: function () {
                $("#loadingBar").css("display", "none");
            }
        });
    }
    else {
        flgNo = $("#chkItemVal").val();
        if (flg === "M1") {
            dataToSend = {locNo: flgNo}
        }
        else if (flg === "M2") {
            dataToSend = {eqCategory: flgNo}
        }
        else if (flg === "M3") {
            dataToSend = {eqType: flgNo}
        }

        $.ajax({
            type: "POST", url: "/common/facilitydetailList.do?searchUseYn=" + flg + "&pageIndex=" + detailCurrentPage, data: dataToSend, dataType: "html", beforeSend: function () {
                $("#loadingBar").css("display", "");
            }, success: function (data) {
                $("#facilityMasterList").html(data);
            }, error: function (request, status, error) {
                console.log("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
            }, complete: function () {
                $("#loadingBar").css("display", "none");
            }
        });
    }
}

// 검색박스내 설비종류 검색팝업
function searchFacilityTypeTreePopup(target) {
    $("#searchFacilityTypeTreePopup").bPopup({
        modalClose: false, opacity: 0.2, speed: 450, closeClass: "close", onOpen: function () {
            $("#searchFacilityTypeTreePopup").addClass('show');
        }, onClose: function () {
            $("#searchFacilityTypeTreePopup").removeClass('show');
        }
    });
}

// 검색박스내 설비기능위치 검색팝업
function searchFacilityLocTreePopup(target) {
    $("#searchFacilityLocTreePopup").bPopup({
        modalClose: false, opacity: 0.2, speed: 450, closeClass: "close", onOpen: function () {
            $("#searchFacilityLocTreePopup").addClass('show');
        }, onClose: function () {
            $("#searchFacilityLocTreePopup").removeClass('show');
        }
    });
}

// 검색박스내 감독부서 검색팝업
function searchReqTreePopup(target) {
    $("#searchReqTreePopup").bPopup({
        modalClose: false, opacity: 0.2, speed: 450, closeClass: "close", onOpen: function () {
            // #searchTreePopup에 클래스 추가
            $("#searchReqTreePopup").addClass('show');
        }, onClose: function () {
            var tree = $.fn.zTree.getZTreeObj('reqTree1');
            if (tree) {
                tree.expandAll(false);
                tree.cancelSelectedNode();
            }
            $("#searchReqTreePopup").removeClass('show');
        }
    });
}

// 검색박스내 설계부서 검색팝업
function searchdesignDeptTreePopup(target) {
    // 모달이 닫힐 때 초기화 작업 수행
    $("#searchdesignDeptTreePopup #searchdesignDeptTreeTitle").empty();

    var title = target.siblings('label').text();

    // 모달 제목 설정
    $("#searchdesignDeptTreeTitle").text(title);

    $("#searchdesignDeptTreePopup").bPopup({
        modalClose: false, //zIndex: 1200,
        opacity: 0.2, speed: 450, closeClass: "close", onOpen: function () {
            // #searchTreePopup에 클래스 추가
            $("#searchdesignDeptTreePopup").addClass('show');
        }, onClose: function () {
            var tree = $.fn.zTree.getZTreeObj('designDeptTree1');
            if (tree) {
                tree.expandAll(false);
                tree.cancelSelectedNode();
            }
            $("#searchdesignDeptTreePopup").removeClass('show');
        }
    });
}

// 검색박스내 요청부서 검색팝업
function searchReqDeptTreePopup(target) {

    $("#searchReqDeptTreePopup").bPopup({
        modalClose: false, opacity: 0.2, speed: 450, closeClass: "close", onOpen: function () {
            // #searchTreePopup에 클래스 추가
            $("#searchReqDeptTreePopup").addClass('show');
        }, onClose: function () {
            var tree = $.fn.zTree.getZTreeObj('reqDeptTree1');
            if (tree) {
                tree.expandAll(false);
                tree.cancelSelectedNode();
            }
            $("#searchReqDeptTreePopup").removeClass('show');
        }
    });
}

// 검색박스내 운전부서 검색팝업
function searchopDeptTreePopup(target) {
    $("#searchopDeptTreePopup").bPopup({
        modalClose: false, //zIndex: 1200,
        opacity: 0.2, speed: 450, closeClass: "close", onOpen: function () {
            // #searchTreePopup에 클래스 추가
            $("#searchopDeptTreePopup").addClass('show');
        }, onClose: function () {
            var tree = $.fn.zTree.getZTreeObj('opDeptTree1');
            if (tree) {
                tree.expandAll(false);
                tree.cancelSelectedNode();
            }
            $("#searchopDeptTreePopup").removeClass('show');
        }
    });
}

// 검색박스내 정비부서 검색팝업
function searchmainDeptTreePopup(target) {
    // 모달이 닫힐 때 초기화 작업 수행
    $("#searchmainDeptTreePopup #searchmainDeptTreeTitle").empty();

    var title = target.siblings('label').text();

    // 모달 제목 설정
    $("#searchmainDeptTreeTitle").text(title);

    $("#searchmainDeptTreePopup").bPopup({
        modalClose: false, //zIndex: 1200,
        opacity: 0.2, speed: 450, closeClass: "close", onOpen: function () {
            // #searchTreePopup에 클래스 추가
            $("#searchmainDeptTreePopup").addClass('show');
        }, onClose: function () {
            // 모달이 닫힐 때 초기화 작업 수행
            var tree = $.fn.zTree.getZTreeObj('mainDeptTree1');
            if (tree) {
                tree.expandAll(false);
                tree.cancelSelectedNode();
            }
            $("#searchmainDeptTreePopup").removeClass('show');
        }
    });
}

// 검색박스내 사용자검색 팝업
function searchItemPopup(target) {
    // 모달이 닫힐 때 초기화 작업 수행
    $("#searchItemPopup #searchItemTitle").empty();
    var title = target.siblings('label').text();

    if (title == "요청자 검색") {
        $("#chkTitleTree").val("1");
    }
    else if (title == "감독자 검색") {
        $("#chkTitleTree").val("2");
    }
    else if (title == "점검자 검색") {
        $("#chkTitleTree").val("3");
    }
    else if (title == "발행자 검색") {
        $("#chkTitleTree").val("4");
    }
    else if (title == "회수자 검색") {
        $("#chkTitleTree").val("5");
    }
    else if (title == "설계자 검색") {
        $("#chkTitleTree").val("6");
    }

    // 모달 제목 설정
    $("#searchItemTitle").text(title);
    $("#searchItemPopup").bPopup({
        modalClose: false, opacity: 0.2, speed: 0, closeClass: "close", onOpen: function () {
            // #searchItemPopup에 클래스 추가
            $("#searchItemPopup").addClass('show');

        }, onClose: function () {
            // 모달이 닫힐 때 초기화 작업 수행
            $("#userDetailList").html('');
            $("#searchItemPopup").removeClass('show');
            var tree = $.fn.zTree.getZTreeObj('divisionTree2');
            if (tree) {
                tree.cancelSelectedNode();
                tree.expandAll(false);
            }
            $('#id_code1').prop('checked', false);
        }
    });
}

function userDetailList(id) {
    var chkVal = "";
    var checkbox = document.getElementById('id_code1');
    if (checkbox.checked) {
        chkVal = "N"
    }
    else {
        chkVal = "Y"
    }
    var deptNo = id;
    $("#loadingBar").css("display", "");
    $.ajax({
        type: "post", url: "/common/userList.do", data: {deptNo: deptNo, isJoin: chkVal}, dataType: "html", success: function (data) {
            $("#userDetailList").html(data);
            $("#loadingBar").css("display", "none");
        }, error: function (request, status, error) {
            console.log("code:" + request.status + "\n error:" + error);
        }
    });
}

// 검색박스내 설비마스터 팝업
function searchFacilityPopup(target) {
    $("#searchFacilityPopup").bPopup({
        modalClose: false, //zIndex: 1100,
        opacity: 0.2, speed: 450, closeClass: "close", onOpen: function () {
            // #searchFacilityPopup에 클래스 추가
            $("#searchFacilityPopup").addClass('show');

        }, onClose: function () {
            $("#searchFacilityPopup").removeClass('show');
        }
    });
}

//검색박스내 점검종류 팝업
function searchResultPopup(target) {
    $("#loadingBar").css("display", "");
    //ajax detail load
    var setData = "";
    $.ajax({
        url: "/common/pmlList.do", type: "POST", dataType: "html", success: function (data) {
            if (data !== "") {
                setData = data;
            }
        }, complete: function () {
            $("#codeDetailList").html(setData);

            $('#searchResultPopup').bPopup({
                modalClose: false, position: [0, 0], opacity: 0.2, speed: 450, //zIndex: 1200,
                closeClass: "close", onOpen: function () {
                    $(this).addClass('show');
                    $("#loadingBar").css("display", "none");
                }, onClose: function () {
                    $(this).removeClass('show');
                    $('#inspectorTypeCode').val('');
                    $('#inspectorTypeDesc').val('');
                }
            });
        }, error: function (request, status, error) {
            console.log("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
        }
    });
}

//검색박스내 점검종류 검색기능
function fnCodeSearch() {
    $("#loadingBar").css("display", "");
    $.ajax({
        type: "post", url: "/common/pmlList.do", data: $("#form_search_result2").serialize(), dataType: "html", success: function (data) {
            $("#codeDetailList").html(data);
            $("#loadingBar").css("display", "none");
        }, error: function (request, status, error) {
            console.log("code:" + request.status + "\n error:" + error);
        }
    });
}

/* 메인페이지 왼쪽 메뉴에서 도면보기 팝업 */
function fnOpenDrawing(url) {
    $('#menuList').removeClass('show');
    $("#toggle-button").attr('aria-expanded', 'false');
    $('#toggle-button img').attr('src', '/resources/images/icons/gnb-menu.svg').attr('alt', '메뉴 열기');

    var popup = window.open(url, '_viewDrawing', 'height=' + screen.height + ',width=' + screen.width + 'fullscreen=yes');
    popup.focus();
}

/* 메인페이지 왼쪽 메뉴에서 파노라마 팝업 */
function fnOpenPano() {
    $('#menuList').removeClass('show');
    $("#toggle-button").attr('aria-expanded', 'false');
    $('#toggle-button img').attr('src', '/resources/images/icons/gnb-menu.svg').attr('alt', '메뉴 열기');

    var popup = window.open("/pcm/vi/main.do?pct_sn=84&pci_tag=Taean9_10", '_viewPano', 'height=' + screen.height + ',width=' + screen.width + 'fullscreen=yes');
    popup.focus();
}

/* 모달 팝업창 띄우기 */
function fnOpenModal(url, title, x, y, width, height) {
    title = "Modal Window";
    x = "center";
    y = "center";
    width = "50%";
    height = "50%";

    new WinBox(title, {
        modal: true, x: x, y: y, width: width, height: height, url: url
    });
}

// closeOtherPopups
// 메인 화면에 종속된 모달 이외의 추가로 생성된 팝업 제거
function closeOtherPopups() {
    $('.modal').each(function () {
        const popupId = $(this).attr('id');

        if (popupId !== 'externalPopup' && popupId !== 'externalPopup2' && popupId !== 'cctvInstall' && popupId !== 'searchItemPopup' && popupId !== 'searchReqTreePopup' && popupId !== 'searchReqDeptTreePopup' && popupId !== 'searchFacilityPopup' && popupId !== 'searchResultPopup' && popupId !== 'searchopDeptTreePopup' && popupId !== 'searchmainDeptTreePopup' && popupId !== 'searchdesignDeptTreePopup' && popupId !== 'searchFacilityTypeTreePopup' && popupId !== 'searchFacilityLocTreePopup' && popupId !== 'searchWoTreePopup') {
            $(this).remove();
        }
    });
}

/* cctv nvl download file */
function downloadCctvView() {
    window.location.href = "/cctv/setupFilwDownload.do";

    if ($('#cctvInstall.show').length > 0) {
        $('#cctvInstall.show').find('.close').trigger('click');
    }
}

/* root의 winbox 창 최소화 */
function fnAllMinParentWinbox() {
    window.parent.parent.$(".winbox:not(.min) .wb-min").trigger('click');
}

/* 멀티뷰 : 3D 이동 */
function fnFacilityTo3D(modelType, equipNo) {
    fnAllMinParentWinbox();
    window.parent.parent.modelLoadToUnity(modelType, equipNo);
}

/* 멀티뷰 : 파노라마 이동 */
function fnFacilityToPanorama(e, iegNo) {
    var url = "/pcm/vi/panoview.do?pct_sn=84&tagno=" + iegNo;
    fnOpenPopupStandard(url, "파노라마");
}

/**
 * 로딩바 제어
 * @param flag
 */
function fnLoadingBarFlag(flag) {
    $("#loadingBar").css("display", flag);
}

$(document).ready(function () {
    // 터치디바이스 체크
    function checkTouchDevice() {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // 기존 클래스 제거 (터치 디바이스 여부 갱신)
        $('body').removeClass('touch-device');

        if (isTouchDevice) {
            //console.log("터치 디바이스입니다.");
            $('body').addClass('touch-device');
        }
        else {
            $('body').removeClass('touch-device');
        }
    }

    checkTouchDevice();
    window.addEventListener('resize', checkTouchDevice);
    /*
    setTimeout(function () {
        $('.left-box').fadeIn(500);

        // 2025.04.29 yjkim - 사용가이드 자동사라짐
        $('.unity-guide').fadeIn(500, function () {
            setTimeout(function () {
                $('.unity-guide').fadeOut(500);
                $('.unity-guide .unity-guide-footer').hide();
            }, 5000); // 페이드인 완료후 8초뒤 페이드아웃
        });

        $('.header .btn-status').fadeIn(500).css('display', 'flex');
    }, 500);*/
});

// 헤더 > 발전소 선택
function initPlantSelect() {
    const $plantGroup = $('.plant-group');
    const $selectBtn = $('.select-plant .icon-arrow');

    // 발전소 선택 버튼 클릭 시 (토글 방식)
    $selectBtn.on('click', function (e) {
        e.stopPropagation();
        $plantGroup.toggleClass('active');
    });

    // 발전소 목록(span) 클릭 시
    $plantGroup.on('click', 'span', function (e) {
        e.stopPropagation();
        const plantName = $(this).text().trim();
        const plantCode = $(this).attr("data-code");
        console.log(`이동: ${plantName} 발전소 ## ` + plantCode);

        /* 이동 */
        const $form = $('<form>', {method: 'POST', action: '/index.do'})
            .append($('<input>', {type: 'hidden', name: 'eqOrgNo', value: plantCode}));

        $form.appendTo('body').submit();
    });

    // 외부 클릭 시 active 제거
    $(document).on('click', function (e) {
        if (!$plantGroup.is(e.target) && $plantGroup.has(e.target).length === 0 && !$selectBtn.is(e.target)) {
            $plantGroup.removeClass('active');
        }
    });
}

/* 3D Model/운전정보 데이터 연계 박스 start */
let operationInfoInterval = null;

function open_opDataBox(targetId, id) {
    if (operationInfoInterval != null) {
        clearInterval(operationInfoInterval);
        operationInfoInterval = null;
    }

    operationInfoInterval = setInterval(() => {
        fnOperationLoadInterval(targetId, id);
    }, 60000);

    $(targetId).addClass('active');
}

function close_opDataBox(targetId) {
    clearInterval(operationInfoInterval);
    operationInfoInterval = null;
    $(targetId).removeClass('active');
}

/* 모든 winbox 최소화 처리 */
function fnCloseAllWinbox() {
    if (!targetWinbox || !targetWinbox.g) return;

    if ($(".winbox:not(.min)").length > 0) {
        $(".winbox:not(.min) .wb-min").trigger('click');
    }
}

function fnOpDataBoxToggle(targetId) {
    console.log("########## fnOpDataBoxToggle ####");

    fnCloseAllWinbox();

    if ($(targetId).hasClass('active')) {
        $(targetId).removeClass('active');
    }
    else {
        $(targetId).addClass('active');
    }
}

/* 3D Model/운전정보 데이터 연계 박스 End */

// 페이지 로드 후 실행
$(document).ready(function () {
    initPlantSelect();
});

// MultiView 토글: 클릭한 cell 내부의 doc-box만 열기/닫기
function toggleDocuList(e) {
    e.stopPropagation();

    const cell = e.currentTarget.closest('.cell');
    const box = cell.querySelector('.doc-box');

    box.classList.toggle('active');
}

// 닫기 버튼: 해당 doc-box만 닫기
function closeDocuList(e) {
    e.stopPropagation();

    const box = e.currentTarget.closest('.doc-box');
    box.classList.remove('active');
}

// ESC로 모달 닫히는거 방지
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const modalOpen = document.querySelector('.modal.show');
        if (modalOpen) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }
}, true);

// 메인공지팝업 - 범용으로 사용가능
function closeThisPopup(button) {
    var thisPopup = button.closest('.popup-layer');
    if (!thisPopup) return;

    if ($("#checkViewToday").is(":checked")) {
        Cookies.set('notice_view_today', 'Y', {expires: 1});
    }

    thisPopup.classList.remove('open');
}

// 헤더 초기 상태 강제 (열림)
function initHeader() {
    const header = document.querySelector('.header-box');
    const body = document.body;
    const btn = document.querySelector('.header-icon span');

    if (!header) return;

    header.classList.add('open');
    body.classList.add('header-open');

    if (btn) {
        btn.textContent = '실시간정보 닫기';
    }
}

/**
 * 헤더 토글 이벤트에 따른 windowbox top 처리
 * winbox가 maximized 상태일 경우 height를 100%로 설정
 *
 * @param target
 * @param isOpen
 */
function fnSetWinboxTop(target, isOpen) {
    var winboxInstance = null;
    var selector = target;

    // target이 WinBox 객체인 경우 (문자열이 아닌 경우)
    if (typeof target !== 'string') {
        winboxInstance = target;
        selector = "#" + winboxInstance.id;
    }

    console.table("#### winbox target : " + target);
    console.table("#### winbox selector : " + selector);
    console.table("#### winbox control open : " + isOpen);

    var base = getWinboxGroupOptions();
    var top = base.top;
    var left = base.left;
    var width = base.maxwidth;
    var height = window.innerHeight;

    if (isOpen) {
        height = height - top;
        $(selector).css("top", top + "px");
		$(selector).css("height", "calc(100% - 80px)");

        if (winboxInstance && winboxInstance.move) {
            //winboxInstance.resize();
            winboxInstance.move(left, top);
        }
    }
    else {
        height = height + top;
        top = 0;

        console.table("#### false height : " + height);

        $(selector).css("top", "0px");
        $(selector).css("height", "100%");

        console.log("################## Winbox closed, resetting position to top:0, height:100%");

        if (winboxInstance && winboxInstance.move) {
            winboxInstance.resize();
            winboxInstance.move(left, top);
        }
    }
}

function fnSetWinboxMove(target) {
    console.table("#### fnSetWindowboxMove ### ");

    var winboxInstance = null;
    var selector = target;

    // target이 WinBox 객체인 경우 (문자열이 아닌 경우)
    if (typeof target !== 'string') {
        winboxInstance = target;
        selector = "#" + winboxInstance.id;
    }

    var base = getWinboxGroupOptions();
    var top = base.top;
    var left = base.left;
    var height = window.innerHeight;

    console.table($(window).height());
    console.table($(window).innerHeight());
    console.table($(window).outerHeight());

    if (winboxIsOpen) {
        height = height - top;
        console.table("#### true height : " + height);

        $(selector).css("height", height + "px");
    }
    else {
        height = height + top;

        console.table("#### false height : " + height);

        $(selector).css("height", height);
    }
}

// 헤더 토글
function toggleHeader() {
    const header = document.querySelector('.header-box');
    const body = document.body;
    if (!header) return;

    const isOpen = header.classList.toggle('open');
    winboxIsOpen = isOpen;
    fnSetWinboxTop('.winbox:not(.min)', isOpen); // 열려져 있는 창에만 적용

    // body 연계 토글
    body.classList.toggle('header-open', isOpen);

    // 버튼 텍스트
    const btn = document.querySelector('.header-icon span');
    if (btn) {
        btn.textContent = isOpen ? '실시간정보 닫기' : '실시간정보 열기';
    }
}

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', initHeader);

/*
* android
* */

/* unity 보기 */
function fnAndroidShowUnity() {
    if (window.Android) {
        window.Android.showUnityActivity(eqOrgNo, hoki);
    }
}

/* 로그시트 QRCode scan */
function requestQRScan() {
    // Android Bridge 호출
    if (window.Android && window.Android.scanQRCode) {
        window.Android.scanQRCode();
    }
    else {
        alert("실행할 수 없습니다.");
    }
}

/* 로그시트 QRCode scan callback */
function onScanFinished(data) {
    alert("QR Data received:" + data);

    // page open
    var target = $('<input type="hidden" id="_openLogSheetPopup" data-title="로그시트"/>');
    fnOpenPopup("/qrcode/index.do?data=" + encodeURIComponent(encodeURIComponent(data)), target);

    target.remove();
}

/* 외부라이브러리 오버라이드용 스타일 헤더에 추가로드시 사용 */
function loadCss(url){
	if(!document.querySelector(`link[href="${url}"]`)){
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = url;
		document.head.appendChild(link);
	}
}
// loadCss("/lib/jstree/jstree.css");
// loadCss("/css/library/jstree.override.css");


/* 테이블 내에 해당클래스(auto-size) 적용시 value 값에 따라 자동 너비 조정 */
document.querySelectorAll(".form-control.auto-size").forEach(input => {
	resizeInput(input);

	input.addEventListener("input", () => {
		resizeInput(input);
	});
});

function resizeInput(input) {
	input.size = Math.max(input.value.length + 1, 1);
}

/* view test model */
function fnViewTestModel() {
    var testModelTarget = $("._TEST_MODEL_JS");

    if(testModelTarget.hasClass("d-none")) {
        testModelTarget.removeClass("d-none");
    }
    else {
        testModelTarget.addClass("d-none");
    }
}

function fnViewAdminPage() {
    window.open("/admin/index.do", '_viewAdmin', 'height=' + screen.height + ',width=' + screen.width + 'fullscreen=yes');
}
