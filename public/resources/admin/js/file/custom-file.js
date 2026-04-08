/**
 * ******************************************************
 * 공통 - 파일 list control
 */

var title = "", content = "";

/* alert message */
function fnMsg() {
    $.alert({
        title: title, content: content, type: 'red', buttons: {
            '확인': {
                btnClass: 'btn-red', action: function () {
                }
            }
        }
    });
}

/**
 * 파일리스트 조회
 */
function fnSearchFacilityFileList() {
    $.ajax({
        type: "POST",
        url: "/admin/facility/file/searchList.do",
        data: $("#searchForm").serialize(),
        dataType: "html",
        beforeSend: function () {
            $("#loadingBar").show();
        },
        success: function (data) {
            $("#_FACILITY_FILE_LIST").html(data);
        },
        complete: function () {
            $("#loadingBar").hide();
        }
    });
}

/* 전체 검색 */
function fnSearchFileAllList() {
    $("#iegNo").val("");
    $("#iegDescription").val("");
    $("#iegNoList").empty();

    $("#searchForm #pageIndex").val(1);
    fnSearchFacilityFileList();
}

/**
 * 공통
 * js callback 처리 부분
 */
function fnSearchResult() {
    $("#searchForm #pageIndex").val(1);
    fnSearchFacilityFileList();
}

/**
 * 공통 - fnPageMove()
 * file js callback 처리 부분
 */
function fnSearchFileList() {
    fnSearchFacilityFileList();
}

/*<%-- 페이지 이동 부분 --%>*/
function fnPageMove(f) {
    var currentPage = parseInt($("#currentPage").val());

    if (f === 'P') {
        if (currentPage === 1) {
            title = "이전";
            content = "처음 페이지입니다.";
            fnMsg();
            return false;
        }
        currentPage = currentPage - 1;
    } else if (f === 'N') {
        if (currentPage === totalPage) {
            title = "다음";
            content = "마지막 페이지입니다.";
            fnMsg();
            return false;
        }
        currentPage = currentPage + 1;
    } else if (f === 'M') {
        if (currentPage > totalPage) {
            title = "페이지 이동";
            content = "마지막 페이지는 " + totalPage + "입니다. 이 페이지를 초과할 수 없습니다.";
            fnMsg();
            $("#currentPage").val(totalPage);
            return false;
        }
    }

    $("#currentPage").val(currentPage);

    $("#searchForm #pageIndex").val(currentPage);

    fnSearchFileList();
}

/* file download */
function fnFileDownload(targetName) {
    $.confirm({
        title: "파일 다운로드", content: "파일을 다운로드하겠습니까?", type: 'blue', buttons: {
            '확인': {
                btnClass: 'btn-blue', action: function () {
                    $.ajax({
                        type: "POST", url: "/admin/file/download.do", data: {saveFileName: targetName}, xhrFields: {
                            responseType: 'blob'  // 응답을 Blob 형식으로 받기
                        }, beforeSend: function () {
                            $("#loadingBar").show();
                        }, success: function (data, message, xhr) {
                            var blob = data;
                            var fileName = "";

                            // 서버 응답 헤더에서 Content-Disposition 읽기
                            var disposition = xhr.getResponseHeader('Content-Disposition');
                            if (disposition && disposition.indexOf('attachment') !== -1) {
                                // filename* (UTF-8) 우선 추출
                                var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                                var matches = filenameRegex.exec(disposition);
                                if (matches != null && matches[1]) {
                                    fileName = decodeURIComponent(matches[1].replace(/['"]/g, '').replace('UTF-8\'\'', ''));
                                }
                            }

                            var link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            link.download = fileName;
                            link.click();

                            // 메모리 해제
                            URL.revokeObjectURL(link.href);
                        }, error: function (request, status, error) {
                            title = "파일 다운로드";
                            if (request.status === 404) {
                                content = "다운로드할 파일이 없습니다.";
                            } else {
                                content = "오류가 발생했습니다.";
                            }
                            fnMsg();
                        }, complete: function () {
                            $("#loadingBar").hide();
                        }
                    });
                }
            }, '취소': {
                action: function () {
                }
            }
        }
    });

}

/* remove file */
function fnRemoveFile(targetName) {
    $.confirm({
        title: "설비번호 삭제", content: "삭제하시겠습니까?", type: 'red', buttons: {
            '확인': {
                btnClass: 'btn-red', action: function () {
                    $.ajax({
                        type: "POST", url: "/admin/file/removeFile.do"
                        , data: {saveFileNameList: targetName}
                        , dataType: "json"
                        , beforeSend: function () {
                            $("#loadingBar").show();
                        }, success: function (data) {
                            if (data.result === '1') {
                                title = "삭제 완료";
                                content = "정상적으로 처리되었습니다.";
                                fnMsg();
                                fnSearchFileList();
                            } else {
                                title = "삭제";
                                content = "오류가 발생했습니다.";
                                fnMsg();
                            }
                        }, error: function (request, status, error) {
                            title = "삭제";
                            content = "오류가 발생했습니다.";
                            fnMsg();
                        }, complete: function () {
                            $("#loadingBar").hide();
                        }
                    });
                }
            }, '취소': {
                action: function () {
                }
            }
        }
    });
}

/* save button disabled */
function fnBtnSaveDisabled(isDisabled) {
    if (isDisabled) {
        $("#btnUpload").attr("disabled", true);
    } else {
        $("#btnUpload").attr("disabled", false);
    }
}
