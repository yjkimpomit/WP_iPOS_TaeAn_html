
//기기별 차트
// CC 차트
var cc_data = {
	categories: ['현재값', '기대값', '보정값'],
	series: {
		column: [
			{
				name: '출력',
				data: [320.48, 125.64, 200.16],
				colorByCategories: true,
			},
		],
		line: [
			{
				name: '효율',
				data: [80.15, 24.56, 64.82]
			},
		],
	},
};

var cc_chartoptions = {
	chart: {
		width: '100%',
		height: '100%',
		//title: 'CC'
	},
	yAxis: [
		{
			title: '출력(mw)',
			scale: {
				min: 0,
				max: 1000
			}
		},
		{
			title: '효율(HHV)',
			chartType: 'line',
			scale: {
				min: 0,
				max: 100
			}
		}
	],
	theme: {
		chart: {
			backgroundColor: 'transparent',
		},
		title: {
			fontFamily: 'Roboto',
			fontSize: 20,
			fontWeight: 700
		},
		xAxis: {
			label: {
				fontFamily: 'Noto Sans KR',
				fontSize: 15,
				fontWeight: 500,
				color: '#242424'
			},
			width: 1,
			color: '#B6BFCC'
		},
		yAxis: {
			title: {
				fontFamily: 'Noto Sans KR',
				fontSize: 14,
				fontWeight: 500,
				color: '#242424',
			},
			label: {
				fontFamily: 'Roboto',
				fontSize: 14,
				fontWeight: 500,
				color: '#242424'
			},
			width: 1,
			color: '#B6BFCC'
		},
		series: {
			column: {
				colors: ['#FF7A00', '#00CAFF', '#0078D4'],
				barWidth: 36,
			},
			line: {
				colors: '#272F3F'
			},
		},
	},
	series: {
		barWidth: 32,
		showDot: true,
	},
	legend: {
		align: 'bottom',
		visible: false,
	},
	tooltip: {
		formatter: (value, tooltipDataInfo) => {
			if (tooltipDataInfo.label === '출력') {
				return value + 'mw';
			}
			if (tooltipDataInfo.label === '효율') {
				return value + '%';
			}
			return value;
		},
	},
	responsive: {
		animation: { duration: 300 }
	},
	exportMenu: { visible: false }
};

var cc_chart = document.getElementById('chart-cc');
var chartCC = toastui.Chart.columnLineChart({ el: cc_chart, data: cc_data, options: cc_chartoptions });

	// 차트 리사이징
	function resizeCCChart() {
		const width = cc_chart.clientWidth;
		const height = cc_chart.clientHeight;

		if (width > 0 && height > 0) {
			chartCC.resize({ width, height });
		}
	}

// 최초 1회 (필수)
//resizeCCChart();

// 화면 리사이즈 대응
window.addEventListener('resize', resizeCCChart);