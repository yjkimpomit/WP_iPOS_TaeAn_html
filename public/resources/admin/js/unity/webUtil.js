/** ************************
 * webUtils.js
 * *************************
 */

'use strict';

/**
 * Check Url
 * @param url
 * @returns {*|boolean}
 */
function isValidRedirectCCTV(url) {
    const allowedProtocol = "rtsp://";

    try {
        return url.includes(allowedProtocol);
    } catch (e) {
        console.log("# ERROR # " + e);
        return false;
    }
}

/**
 * Install popup message
 */
function fnInstallPopMessage() {
    $("#cctvInstall").bPopup({
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
        }
    });
}

/**
 * Check VLC url 스킴 체크
 *
 * @param callback
 */
function isAppInstalled(callback) {
    const iframeAppInstall = document.createElement("iframe");
    iframeAppInstall.id = "iframeAppInstall";
    iframeAppInstall.style.display = "none";
    iframeAppInstall.src = "rtsp://";

    document.body.appendChild(iframeAppInstall);

    const timeoutIframeAppInstall = setTimeout(function () {
        document.body.removeChild(iframeAppInstall);
        callback(false); // 앱이 없음
    }, 1500);

    window.addEventListener("blur", function () {
        clearTimeout(timeoutIframeAppInstall);
        document.body.removeChild(iframeAppInstall);
        callback(true); // 앱이 실행되어 포커스가 나감
    });
}

/**
 * Run VLC cctv
 *
 * @param rtspUrl
 */
function showVlcRtsp(rtspUrl) {
    window.location.href = rtspUrl;
}

/**
 * VLC - CCTV 실행
 *
 * @param rtspUrl
 */
function fnViewVlcRtsp(rtspUrl) {
    $("#loadingBar").css("display", "");

    let cctvUrl;

    if (isValidRedirectCCTV(rtspUrl)) {
        window.location.href = rtspUrl;
        cctvUrl = rtspUrl;
    }

    // 체크
    isAppInstalled(function (installed) {
        if (installed) {
            $("#loadingBar").css("display", "none");
            //showVlcRtsp(cctvUrl);
        } else {
            $("#loadingBar").css("display", "none");
            fnInstallPopMessage();
        }
    });
}

/**
 * 3D Model TO CCTV 실행
 *
 * @param cctvidx
 */
function receiveCctvView(cctvidx) {
    //예제 호출 함수 : receiveCctvView('CCTV_1011');
    console.log("## receiveCctvView ## " + cctvidx);

    /* 임시 CCTV 이미지 띄우기 */
    /*$("#cctvImg").bPopup({
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
        }
    });
    return;*/

    $.ajax({
        url: "/cctv/getCctvInfo.do",
        type: "POST",
        data: { ici_cctvid: cctvidx },
        dataType: "json",
        success: function (data) {
            console.table(data);
            var result = data.result;

            if (result === 1) {
                var rtspUrl = data.cctvUrl;
                fnViewVlcRtsp(rtspUrl);
            }
        },
        error: function (request, status, error) {
            console.log("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
        }
    });
}

/**
 * CCTV 페이지에서 사용
 * 3d Model로 이동
 * Call function - /main/unityUtil.js
 *
 * @param cctvId
 */
function fnCctvtoUnity(cctvId) {
    window.parent.$(".winbox:not(.min) .wb-min").trigger('click');
    window.parent.cctvToUnity(cctvId);
}