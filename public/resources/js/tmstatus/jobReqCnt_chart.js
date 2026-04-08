if (chartType === "1") {
    //TM현황 작업요청 건수 요청유형 차트
    var jobreq_data = {
        categories: chartList.map(item => item.labels),
        series: [
            {
                name: 'TM',
                data: chartList.map(item => item.tmCnt)
            },
            {
                name: '설비개선',
                data: chartList.map(item => item.reCnt)
            },
            {
                name: 'NCR',
                data: chartList.map(item => item.ncrCnt)
            },
            {
                name: '푸른신호등',
                data: chartList.map(item => item.carCnt)
            },
            {
                name: '유사고장',
                data: chartList.map(item => item.evCnt)
            },
            {
                name: '기타',
                data: chartList.map(item => item.etcCnt)
            },
        ]
    };
} else {
    //TM현황 작업요청 건수 중요도 차트
    var jobreq_data = {
        categories: chartList.map(item => item.labels),
        series: [
            {
                name: 'A등급',
                data: chartList.map(item => item.aCnt)
            },
            {
                name: 'B등급',
                data: chartList.map(item => item.bCnt)
            },
            {
                name: 'C등급',
                data: chartList.map(item => item.cCnt)
            },
            {
                name: '기타등급',
                data: chartList.map(item => item.etcCnt)
            },
        ]
    };
}

var maxValue = Math.max(...jobreq_data.series.flatMap(series => series.data));

var jobreq_chartoptions = {
    chart: {
        /*width: 1830,
        height: 640,*/
		width: '100%',
		height: '100%',
        title: {
            text: '호기별 작업요청 건수',
            offsetY: -5,
            align: 'center'
        }
    },
    series: {
        eventDetectType: 'grouped'
    },
    xAxis: {
        label: {
            //categories 글자 가로로 변경하는 옵션
            rotatable: true
        }
    },
    yAxis: {
        scale: {
            min: 0,
            max: maxValue,
            stepSize: maxValue,
        }
    },
    legend: {
        visible: false,
    },
    theme: {
        title: {
            fontSize: 16,
            fontWeight: 700
        },
		xAxis: {
			label: {
				fontSize: 12
			}
		},
		yAxis: {
			label: {
				fontSize: 12
			}
		},
        series: {
            colors: ['#085FB5', '#FFD837', '#3EBB3C', '#FF8000', '#00B3CE', '#E1154F'],
            //barWidth: 24
        }
    },
    responsive: {
        animation: {duration: 300}
    },
    exportMenu: {visible: false}
};

var jobreqcnt_chart = document.getElementById('jobreqcnt_chart');
var chart_jobreqcnt = toastui.Chart.columnChart({el: jobreqcnt_chart, data: jobreq_data, options: jobreq_chartoptions});

updateChart();
function updateChart() {
    if (chartOpt === "1") {
        jobreq_chartoptions.chart.title.text = "호기별 작업요청 건수";
    } else if (chartOpt === "2") {
        jobreq_chartoptions.chart.title.text = "요청부서별 작업요청 건수";
    } else if (chartOpt === "3") {
        jobreq_chartoptions.chart.title.text = "감독부서별 작업요청 건수";
    } else if (chartOpt === "4") {
        jobreq_chartoptions.chart.title.text = "요청자별 작업요청 건수";
    } else if (chartOpt === "5") {
        jobreq_chartoptions.chart.title.text = "설비별 작업요청 건수";
    } else if (chartOpt === "6") {
        jobreq_chartoptions.chart.title.text = "요청부서별 & 감독부서별 작업요청 건수";
    }
    jobreq_chartoptions.chart.title.align = "center";
    jobreq_chartoptions.chart.title.offsetY = -5;

    //차트 검색 개수가 20개 이상 일 경우 글자 세로로 변경
    var reqListCnt = chartList.length;
    if (reqListCnt > 20) {
        jobreq_chartoptions.xAxis.label.interval = 1;
    }

    chart_jobreqcnt.setOptions(jobreq_chartoptions);
}

/*-- 20260107 yjkim : 차트 리사이징 start --*/
function resizeJobReqCntChart() {
	const width = jobreqcnt_chart.clientWidth;
	const height = jobreqcnt_chart.clientHeight;

	if (width > 0 && height > 0) {
		chart_jobreqcnt.resize({ width, height });
	}
}

// 최초 1회 (필수)
resizeJobReqCntChart();

// 화면 리사이즈 대응
window.addEventListener('resize', resizeJobReqCntChart);
/*-- 20260107 yjkim : 차트 리사이징 end --*/
