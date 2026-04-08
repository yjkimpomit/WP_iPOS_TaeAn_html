/**
* *******************************************************
* 설비정보의 공통 메소드 *
* *******************************************************
*/

'use strict';

function fnFacilityMultiviewPop(e, iegNo) {
    fnOpenPopupStandard("/multiview/index.do?iegNo=" + iegNo, "설비상세정보");
}
/**
 * 설비정보 > 설비상세 정보 뷰
 *
 * @param e
 * @param iegNo
 */
function fnFacilityDetailInfo(e, iegNo) {
    $('._TR_INFO').removeClass('active');
    $(e).closest('tr._TR_INFO').addClass('active');

    $.ajax({
        type: "post"
        , url: "/facility/infoDetail.do"
        , data: {iegNo: iegNo}
        , dataType: "html"
        , beforeSend: function () {
            $("#loadingBar").css("display", "");
        }
        , success: function (data) {
            $("#_FACILITY_DETAIL_VIEW_INFO").html(data);
        }
        , error: function (request, status, error) {
            console.log("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
        }
        , complete: function () {
            $("#loadingBar").css("display", "none");
        }
    });
}

/**
 * 설비정보 > 정비이력 상세 뷰
 *
 * @param e
 * @param woNo
 */
function fnFacilityDetailMaintenance(e, woNo) {
    $('._TR_INFO_MH').removeClass('active');
    $(e).addClass('active');

    $.ajax({
        type: "post"
        , url: "/facility/maintenanceHistoryDetail.do"
        , data: {woNo: woNo}
        , dataType: "html"
        , beforeSend: function () {
            $("#loadingBar").css("display", "");
        }
        , success: function (data) {
            $("#_FACILITY_DETAIL_VIEW_MH").html(data);
        }
        , error: function (request, status, error) {
            console.log("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
        }
        , complete: function () {
            $("#loadingBar").css("display", "none");
        }
    });
}

/**
 * 설비정보 > 자재정보 상세 뷰
 *
 * @param e
 * @param partNo
 * @param equipNo
 */
function fnFacilityDetailMaterial(e, partNo, equipNo) {
    $('._TR_INFO_MI').removeClass('active');
    $(e).addClass('active');

    $.ajax({
        type: "post"
        , url: "/facility/materialInfoDetail.do"
        , data: {partNo: partNo, equipNo: equipNo}
        , dataType: "html"
        , beforeSend: function () {
            $("#loadingBar").css("display", "");
        }
        , success: function (data) {
            $("#_FACILITY_DETAIL_VIEW_MI").html(data);
        }
        , error: function (request, status, error) {
            console.log("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
        }
        , complete: function () {
            $("#loadingBar").css("display", "none");
        }
    });
}

/**
 * 설비정보 > 포함설비의 설비정보 팝업 뷰
 *
 * @param e
 * @param iegNo
 */
function fnFacilityIncludePopup(e, iegNo) {
    console.log("## custom-facility.js : fnFacilityIncludePopup ## " + iegNo);

    $("#externalPopup2").bPopup({
        modalClose: false,
        opacity: 0.2,
        speed: 450,
        closeClass: "modal-close",
        onOpen: function () {
            //모달창 열릴때 클래스 추가
            $("#externalPopup2").addClass('modal fade facility show external-popup');
            $("#externalPopup2 .modal-dialog").addClass("modal-fullscreen");
            $("#modalTitle2").text('설비정보');
        },
        onClose: function () {
            // 모달이 닫힐 때 초기화 작업 수행
            $("#externalPopup2 #modalTitle2").empty();
            $("#externalPopup2 #modalBodyContent2").empty();

            $("#externalPopup2").removeClass();
            $("#externalPopup2").find(".modal-dialog").removeClass("modal-fullscreen");

            closeOtherPopups();
        }
    }, function () {
        $('._TR_INFO_INCLUDE').removeClass('active');
        $(e).addClass('active');

        // AJAX 요청으로 modalContent에 HTML 로드
        $.ajax({
            url: "/facility/mainInclude.do?iegNo=" + iegNo,
            dataType: "html",
            type: "post",
            beforeSend: function () {
                $("#loadingBar").css("display", "");
            },
            success: function (data) {
                $("#modalBodyContent2").html(data);
            },
            error: function () {
                alert("오류가 발생했습니다.\n잠시 후 다시 시도해 주시기 바랍니다.");
            }
            , complete: function () {
                $("#loadingBar").css("display", "none");
            }
        });
    });
}
