/*<%-- 평택 2복합 출력현황 --%>*/
function fnOutputStatsGT1() {
    //console.log("### GT1 ###");
    $.ajax({
        type: "post"
        , url: "/dashboard/deviceStatsGt1.do"
        , dataType: "json"
        , success: function (data) {
            $("#_GT1_OUT").html(data.result.gt1Out);
            $("#_GT1_VOLT").html(data.result.gt1Volt);
            $("#_GT1_WATER_VT").html(data.result.gt1WaterVT);
            $("#_GT1_WATER_VE").html(data.result.gt1WaterVE);
            $("#_GT1_RHST").html(data.result.gt1RHST);
            $("#_GT1_RHSE").html(data.result.gt1RHSE);
            $("#_GT1_NOX").html(data.result.gt1Nox);
            $("#_GT1_FLUX").html(data.result.gt1Flux);
        },
        error: function (request, status, error) {
            $("#_GT1_OUT").html("-");
            $("#_GT1_VOLT").html("-");
            $("#_GT1_WATER_VT").html("-");
            $("#_GT1_WATER_VE").html("-");
            $("#_GT1_RHST").html("-");
            $("#_GT1_RHSE").html("-");
            $("#_GT1_NOX").html("-");
            $("#_GT1_FLUX").html("-");
        }
    });
}

/*<%-- GT2 --%>*/
function fnOutputStatsGT2() {
    //console.log("### GT2 ###");
    $.ajax({
        type: "post"
        , url: "/dashboard/deviceStatsGt2.do"
        , dataType: "json"
        , success: function (data) {
            $("#_GT2_OUT").html(data.result.gt2Out);
            $("#_GT2_VOLT").html(data.result.gt2Volt);
            $("#_GT2_WATER_VT").html(data.result.gt2WaterVT);
            $("#_GT2_WATER_VE").html(data.result.gt2WaterVE);
            $("#_GT2_RHST").html(data.result.gt2RHST);
            $("#_GT2_RHSE").html(data.result.gt2RHSE);
            $("#_GT2_NOX").html(data.result.gt2Nox);
            $("#_GT2_FLUX").html(data.result.gt2Flux);
        },
        error: function (request, status, error) {
            $("#_GT2_OUT").html("-");
            $("#_GT2_VOLT").html("-");
            $("#_GT2_WATER_VT").html("-");
            $("#_GT2_WATER_VE").html("-");
            $("#_GT2_RHST").html("-");
            $("#_GT2_RHSE").html("-");
            $("#_GT2_NOX").html("-");
            $("#_GT2_FLUX").html("-");
        }
    });
}

/*<%-- ST --%>*/
function fnOutputStatsST() {
    //console.log("### ST ###");
    $.ajax({
        type: "post"
        , url: "/dashboard/deviceStatsST.do"
        , dataType: "json"
        , success: function (data) {
            $("#_ST_OUT").html(data.result.stOut);
            $("#_ST_VOLT").html(data.result.stVolt);
        },
        error: function (request, status, error) {
            $("#_ST_OUT").html("-");
            $("#_ST_VOLT").html("-");
        }
    });
}

/*<%-- LOAD --%>*/
fnOutputStatsGT1();
fnOutputStatsGT2();
fnOutputStatsST();

setInterval(function(){
    fnOutputStatsGT1();
    fnOutputStatsGT2();
    fnOutputStatsST();
},60000);
