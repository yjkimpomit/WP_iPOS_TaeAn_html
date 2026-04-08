// ______________________________________________________________________________________________ Send
/* 멀티뷰 화면 체크을 체크하기 위한 변수 */
var _isIdmsPage = false;
var _scale = 1;

/* 멀티뷰 화면에서 3d model 상세 정보로 이동하기 위한 변수 */
var _modelType;
var _modelId;

/**
 * Unity -> Web 모델 정보 팝업
 * @param modelId String
 */
function openModelInfoPopup(modelId) {
    console.log("## openModelInfoPopup ## " + modelId);

    /* 설비정보 리스트 보기 */
    fnViewMappingData(modelId);
}

/**
 * Unity -> 파노라마 팝업 핫스팟 이동
 * @param panoLv string model level
 * @param panoId string model id
 */
function openPanoInfoPopup(panoLv, panoId) {
    console.log("### openPanoInfoPopup #" + panoLv);
    console.log("### openPanoInfoPopup ## " + panoId);

    var pciTag = panoLv;
    var tagno = panoId;
    var tagNumberJason = {};
    var popTargetInfo = $('<input type="hidden" id="_openPanoramaPopup" data-title="파노라마"/>');

    if (panoId !== "") {
        // 파노라마의 pIdx 검색
        $.ajax({
            type: "post",
            url: "/multiview/panoramaInfo.do",
            data: {iegNo: tagno},
            dataType: "json",
            beforeSend: function () {
                $("#loadingBar").css("display", "");
            },
            success: function (data) {
                if (data !== "") {
                    // 파노라마 tagno 검색
                    tagNumberJason = {"tagno": data.pIdx};

                    // load panorama
                    fnOpenPopup("/pcm/vi/panoview.do?pct_sn=84&tagno=" + data.pIdx, popTargetInfo);
                }
                else {
                    alert("파노라마 정보가 없습니다.");
                }
            },
            error: function (xhr, status, error) {
                alert("파노라마 정보가 없습니다.");
            },
            complete: function () {
                $("#loadingBar").css("display", "none");
            }
        });
    }
    else {
        alert("파노라마 정보가 없습니다.");
    }
    popTargetInfo.remove();
}

/**
 * 운영정보 데이터 뷰 페이지 부분
 * @param targetId
 * @param id
 */
function fnOperationLoadInterval(targetId, id) {
    $.ajax({
        type: "POST"
        , url: "/operation/ModelDatas.do"
        , data: {modelType: id}
        , dataType: "json"
        , success: function (data) {
            const dataList = data.list;
            let targetIdVew;

            for (const key in dataList) {
                targetIdVew = targetId + " #_" + id + "_" + key.toUpperCase();
                $(targetIdVew).html(dataList[key]);
            }
        },
        error: function () {
            console.error("Error loading operation data.");
        }
    });
}

/**
 * 왼쪽 메뉴의 3D모델의 운전정보 테이블 정보 보기
 * @param modelType
 */
function fnOperationControlView(modelType) {
    console.log("#### fnOperationControlView #### " + modelType);

    var $ops = $(".operation-control");
    if ($ops.length) {
        $ops.hide();
        var indexMap = {GT: 0, TBBD9_3F: 1, HRSG: 2};
        var idx = indexMap[modelType];
        if (idx != null && idx < $ops.length) {
            $ops.eq(idx).show();
            $("#_OPERATION_" + modelType + "_").removeClass('folded');
        }
    }
}

/**
 * Unity -> Web 운전정보 팝업
 * @param modelIdAndActive  String
 */
function requestOperationInfo(modelIdAndActive) {
    let result = modelIdAndActive.split(",");
    let id = result[0];
    let active = JSON.parse(result[1].toLowerCase());

    let modelId;
    const equals = {
        "ALL": () => {
            modelId = null;
        },
        "GT": () => {
            modelId = '#_OPERATION_GT_';
        },
        "ST": () => {
            modelId = '#_OPERATION_ST_';
        },
        "HRSG": () => {
            modelId = '#_OPERATION_HRSG_';
        },
        "TBBD9_3F": () => {
            modelId = '#_OPERATION_TBBD9_3F_';
        },
        "TBBD10": () => {
            modelId = '#_OPERATION_TBBD_10_';
        }
    }

    if (equals[id]) {
        equals[id]();

        if (modelId == null) {
            close_opDataBox('#_OPERATION_GT_');
            close_opDataBox('#_OPERATION_ST_');
            close_opDataBox('#_OPERATION_HRSG_');
            close_opDataBox('#_OPERATION_TBBD9_3F_');
            close_opDataBox('#_OPERATION_TBBD_10_');
        }
        else {
            if (active) {
                fnOperationControlView(id);
                open_opDataBox(modelId, id);
            }
            else {
                close_opDataBox(modelId);
            }
        }
    }
    else {
        //console.log("requestOperationInfo | Null");
    }
}

/**
 * Unity -> Web Unity가 로딩되고 호출하는 함수
 */
function initializeOnLoad() {
    // console.log("### initializeOnLoad ### " + _isIdmsPage + " ### " + _scale);
    fnSetLoadIdmsPage(_isIdmsPage, _scale);
}

/**
 * Unity -> Web Unity가 로딩완료 시 호출하는 함수
 */
function initializeOnLoadComplete() {
    if (_isIdmsPage) {
        modelLoadToUnity(_modelType, _modelId);
    }

    /* 설비번호가 있으면 실행 */
    if(typeof isModelView !== 'undefined' && isModelView) {
        fnModelView();
        isModelView = false;
    }
}

/**
 * 3D 모델 로딩전 전달해야 할 변수 값들
 * 사업소코드: 평택(5100), 태안(5000)
 * 호기코드: 평택(52922), 태안 9,10호기(51909,51910)
 */
function fnSetPreloading3dModel() {
    unityObj.SendMessage("webDataPath", "SetCurrentPowerPlant", eqOrgNo);
}

/**
 * IDMS page에서 실행중인지 아닌지 체크하기위한 플래그 변수
 * default: isIdmsPage = false;
 * 마지막 값의 'A': mode=A 파라메터 값으로 관리자 페이지의 데이터을 가져오기 위함
 *
 * @param isIdmsPage boolean
 */
function fnSetLoadIdmsPage(isIdmsPage, scale) {
    var payload = isIdmsPage + "," + scale + ",A";
    unityObj.SendMessage("Network", "ToggleIdms", payload);
}

// ______________________________________________________________________________________________ Receive

/**
 * Web -> CCTV 설비 모델
 * @param modelId String
 */
function cctvToUnity(modelId) {
    try {
        // 창닫기 처리 부분
        window.parent.$(".winbox:not(.min) .wb-min").trigger('click');

        var systemTarget = "" + "," + modelId;

        unityObj.SendMessage("Network", "LoadModelFromWeb", systemTarget);
    } catch (error) {
        alert(error.message + '\n' + '3D모델이 연결되지 않았습니다.');
    }
}

/**
 * Web -> Unity 모델 로딩
 * @param modelType
 * @param modelId
 */
function modelLoadToUnity(modelType, modelId) {
    try {
        var systemTarget = modelType + "," + modelId;

        console.log("### modelLoadToUnity ## " + systemTarget);

        unityObj.SendMessage("Network", "LoadModelFromWeb", systemTarget);
    } catch (error) {
        alert(error.message + '\n' + '3D모델이 연결되지 않았습니다.');
    }
}

/**
 * panorama -> Unity 모델 로딩
 * @param modelType
 * @param modelId
 */
function panoramaLoadToUnity(modelType, modelId) {
    try {
        var systemTarget = modelType + "," + modelId;
        console.log("### panoramaLoadToUnity ## " + systemTarget);

        const isSuccess = true;

        if (isSuccess) {
            unityObj.SendMessage("Network", "LoadModelFromWeb", systemTarget);
        }
        else {
            throw new Error("전송 실패");
        }
    } catch (error) {
        alert(error.message + '\n' + '3D모델이 연결되지 않았습니다.');
    }
}

/**
 * Web -> Unity 요청한 모델이나 정보가 없을 경우 Unity Popup Message 전달
 * @param message
 */
function popupMessageToUnity(message) {
    unityObj.SendMessage("Network", "PopupMessageFromWeb", message);
}


/**
 * Unity 인스턴스를 종료하고 메모리를 해제
 */
function fnCloseUnity() {
    console.log("### fnCloseUnity ###");
    if (unityObj != null) {
        //unityObj.SendMessage("Network", "DestroyModel");

        unityObj.Quit().then(function () {
            console.log("Unity instance quit successfully.");
            unityObj = null; // 참조 해제
        }).catch(function (err) {
            console.error("Error quitting Unity:", err);
        });
    }
}
