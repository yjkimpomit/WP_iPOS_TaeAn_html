// set time
function getClock() {
    $.ajax({
        url: '/main/nowDate.do'
        , type: 'POST'
        , dataType: 'json'
        , success: function (data) {
            $("#viewYearDate").html(data.date);
        },
        error: function () {
            console.log('getClock() error');
        }
    });
}

getClock();

/*<%-- APC 인원현황 --%>*/
function fnMainApcMemberInOutCount() {
    //console.log("### APC 인원현황 ###");
    $.ajax({
        type: "post"
        , url: "/main/apc/memberInOutCount.do"
        , dataType: "json"
        , success: function (data) {
            var datas = JSON.parse(data.apcMemberCount);
            var inM = datas.iah_in;
            var outM = datas.iah_out;

            $("#_APC_IN").html(inM);
            $("#_APC_OUT").html(outM);

            if (inM > outM) {
                $("#_APC_ALERT").addClass("danger");
            }
            else {
                $("#_APC_ALERT").removeClass("danger");
            }
        }
    });
}

/*<%-- LOAD --%>*/
fnMainApcMemberInOutCount();

/*<%-- TM 현황 : 발행건수 --%>*/
function fnMainTmPublishCount() {
    //console.log("### TM 현황 : 발행건수 ###");
    $.ajax({
        type: "post"
        , url: "/main/tm/tmPublishCount.do"
        , dataType: "json"
        , success: function (data) {
            $("#_TM_PUBLISH").html(data.tmPublishCount);
        }
    });
}

/*<%-- TM 현황 : RedTAG 건수 --%> */
function fnMainTmRedTagCount() {
    //console.log("### TM 현황 : RedTAG 건수 ###");
    $.ajax({
        type: "post"
        , url: "/main/tm/tmRedTagCount.do"
        , dataType: "json"
        , success: function (data) {
            $("#_TM_REDTAG").html(data.tmRedTagCount);
        }
    });
}

//TM현황 5분단위로 조회
fnMainTmPublishCount();
fnMainTmRedTagCount();

/*<%-- 대기정보 : 기온 --%>*/
function fnMainAiTemperature() {
    //console.log("### 대기정보 : 기온 ###");
    $.ajax({
        type: "post"
        , url: "/main/ai/temperature.do"
        , dataType: "json"
        , success: function (data) {
            $("#_AI_TEMPERATURE").html(data.result.aiTemperature);
        },
        error: function (request, status, error) {
            $("#_AI_TEMPERATURE").html("-");
        }
    });
}

/*<%-- 대기정보 : 압력 --%>*/
function fnMainAiPressure() {
    //console.log("### 대기정보 : 압력 ###");
    $.ajax({
        type: "post"
        , url: "/main/ai/pressure.do"
        , dataType: "json"
        , success: function (data) {
            $("#_AI_PRESSURE").html(data.result.aiPressure);
        },
        error: function (request, status, error) {
            $("#_AI_PRESSURE").html("-");
        }
    });
}

/*<%-- 대기정보 : 습도 --%>*/
function fnMainAiHumidity() {
    //console.log("### 대기정보 : 습도 ###");
    $.ajax({
        type: "post"
        , url: "/main/ai/humidity.do"
        , dataType: "json"
        , success: function (data) {
            $("#_AI_HUMIDITY").html(data.result.aiHumidity);
        },
        error: function (request, status, error) {
            $("#_AI_HUMIDITY").html("-");
        }
    });
}

/*<%-- 운전시간(H) 정보 --%>*/
function fnMainOperationTime() {
    //console.log("### 운전시간(H) 정보 ###");
    $.ajax({
        type: "post"
        , url: "/main/ot/operationTime.do"
        , dataType: "json"
        , success: function (data) {
            var datas = data.result;

            $("#_OT_GT1_AOH").html(datas.gt1Aoh);
            $("#_OT_GT1_ES").html(datas.gt1Es);
            $("#_OT_GT2_AOH").html(datas.gt2Aoh);
            $("#_OT_GT2_ES").html(datas.gt2Es);
        }
        , error: function (request, status, error) {
            //console.log("### 운전시간(H) 정보 ## code: " + request.status + "\n error: " + error);
            $("#_OT_GT1_AOH").html("-");
            $("#_OT_GT1_ES").html("-");
            $("#_OT_GT2_AOH").html("-");
            $("#_OT_GT2_ES").html("-");
        }
    });
}

/*<%-- 발전기 출력 정보 --%>*/
function fnMainGeneratorOutput() {
    //console.log("### 발전기 출력 정보 ###");
    $.ajax({
        type: "post"
        , url: "/main/generator/output.do"
        , dataType: "json"
        , success: function (data) {
            var datas = data.result;

            $("#_GEN_OP_GT1").html(datas.opGt1);
            $("#_GEN_OP_GT2").html(datas.opGt2);
            $("#_GEN_OP_ST").html(datas.opSt);
            $("#_GEN_OP_CC").html(datas.opCc);
        }
        , error: function (request, status, error) {
            //console.log("### 발전기 출력 정보 ## code: " + request.status + "\n error: " + error);
            $("#_GEN_OP_GT1").html("-");
            $("#_GEN_OP_GT2").html("-");
            $("#_GEN_OP_ST").html("-");
            $("#_GEN_OP_CC").html("-");
        }
    });
}

/*<%-- 발전효율 : 실시간 --%>*/
function fnMainPgeRealtime() {
    //console.log("### 발전효율 : 실시간 ###");
    $.ajax({
        type: "post"
        , url: "/main/pge/realtime.do"
        , dataType: "json"
        , success: function (data) {
            $("#_PGE_RT_9").html(data.result.pgeRealtime);
            $("#_PGE_RT_10").html(data.result.pgeRealtime);
        },
        error: function (request, status, error) {
            $("#_PGE_RT_9").html("-");
            $("#_PGE_RT_10").html("-");
        }
    });
}

/*<%-- 발전효율 : 전일누적 --%>*/
/*function fnMainPgePrevDaySum() {
    //console.log("### 발전효율 : 전일누적 ###");
    $.ajax({
        type: "post"
        , url: "/main/pge/prevDaySum.do"
        , dataType: "json"
        , success: function (data) {
            $("#_PGE_PDS").html(data.pgePrevDaySum);
        }
    });
}*/

fnMainAiTemperature();
fnMainAiPressure();
fnMainAiHumidity();
fnMainOperationTime();
fnMainGeneratorOutput();
fnMainPgeRealtime();
//fnMainPgePrevDaySum();

/*
* Interval : 3d model 로딩이 끝난 후 실행함
* */
function fnMainIntervalRun() {
    setInterval(getClock, 30000);

    setInterval(fnMainApcMemberInOutCount, 5 * 60000);

    setInterval(fnMainTmPublishCount, 5 * 60000);
    setInterval(fnMainTmRedTagCount, 5 * 60000);

    setInterval(function () {
        fnMainAiTemperature();
        fnMainAiPressure();
        fnMainAiHumidity();
        fnMainOperationTime();
        fnMainGeneratorOutput();
        fnMainPgeRealtime();
    }, 60000);
}

fnMainIntervalRun();
