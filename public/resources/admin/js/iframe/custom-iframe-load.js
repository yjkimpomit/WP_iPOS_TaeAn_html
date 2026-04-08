/**
 * *******************************************
 * 공통 iframe load
 * use: pnid, dataParc page
 *
 * */

/* 연계문서 목록 토글 */
function toggleDocuList(isRun) {
    var targetSel = "#_DOC_VIEW";

    if($(targetSel).is(":visible") || !isRun) {
        $(targetSel).addClass('d-none');
    }
    else {
        $(targetSel).removeClass('d-none');
    }
}

/* view page */
function fnViewPage(targetSel, url) {
    $(targetSel).attr("src", url);
    toggleDocuList(false);
}

// 설비번호로 데이터 검색(Pnid, dataParc, sld)
function fnSearchData(targetSel, url) {
    $.ajax({
        type: "POST"
        , url: url
        , dataType: "json"
        , beforeSend: function () {
            $("#loadingBar").show();
        },
        success: function (data) {
            var dataLen = data.length;
            var docList = [];
            var paramUrl = "";

            $.each(data, function (i, item) {
                paramUrl = url.split("dataPath=")[0] + "&dataPath=" + item.data + "&searchTag=" + item.tagNo;
                docList.push('<div class="doc-link" onclick="fnViewPage(\'' + targetSel + '\', \'' + paramUrl + '\')"><span>' + item.fileName + '</span><br><span>' + item.text + '</span></div>');
            });

            $("#_DOC_LIST").html(docList.join(""));

            // 여러개의 정보가 있으면 리스트를 보여줌
            console.log("##### dataLen " + dataLen);

            if (dataLen === 0) {
                fnViewPage(targetSel, url);
            } else if (dataLen > 0 && dataLen <= 1) {
                fnViewPage(targetSel, paramUrl);
            } else {
                toggleDocuList(true);
            }
        },
        error: function (xhr, status, error) {
            alert("오류가 발생했습니다.\n잠시 후 다시 시도해 주시기 바랍니다.");
        },
        complete: function () {
            $("#loadingBar").hide();
        }
    });
}
