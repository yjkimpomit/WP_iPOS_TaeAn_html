/**
 * ******************************************************
 * 공통
 * 설비번호 검색
 */

var searchFacilityTargetIdx;

/**
 * 설비번호 검색 리스트
 */
function fnSearchFacilityList() {
    $.ajax({
        type: "POST",
        url: "/admin/facility/searchList.do",
        data: $("#searchForm").serialize(),
        dataType: "json",
        beforeSend: function () {
            $("#loadingBar").show();
        },
        success: function (data) {
            $("#iegDescription").val('');

            // return array
            if (data !== null && data.length > 0) {
                var len = data.length;

                if (len > 1) {
                    var $list = $('[id=iegNoList]').eq(searchFacilityTargetIdx);
                    $list.empty(); // 기존 옵션 제거

                    var val;
                    $.each(data, function (i, item) {
                        val = val + "<option value='" + item.iegNo + "'>" + item.ietDecription + "</option>";
                    });
                    $list.html(val);
                }
                else {
                    $("[id=iegNo]").eq(searchFacilityTargetIdx).val(data[0].iegNo);
                    $("[id=iegDescription]").eq(searchFacilityTargetIdx).val(data[0].ietDecription);
					//$("#editBtn").removeClass("btn-primary").addClass("btn-danger");
					console.log(data[0].iegTagno);
                    fnSearchResult(data[0].iegTagno);
                }
            }
            else {
                alert("설비정보가 없습니다.");
            }
        },
        complete: function () {
            $("#loadingBar").hide();
        }
    });
}

$(document).ready(function () {
    /**
     *  설비번호 검색
     */
    $("[id=iegNo]").on("keypress change", function (e) {
        searchFacilityTargetIdx = $(this).index('[id=iegNo]');

        var paramIeqNo = $(this).val().trim();
        var checkLen = paramIeqNo.length;
        var isEnter = (e.key === 'Enter' || e.keyCode === 13);

        console.log("checkLen: " + checkLen + "  ###### idx #### " + searchFacilityTargetIdx);

        if (isEnter || checkLen >= 8) {
            e.preventDefault();

            if (typeof paramIeqNo === "undefined" || paramIeqNo === "") {
                $("[id=iegDescription]").eq(searchFacilityTargetIdx).val('');
                return false;
            }

            fnSearchFacilityList();
        }
    });
});
