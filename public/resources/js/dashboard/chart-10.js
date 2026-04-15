
//기기별 차트
// CC 차트
var m10_data = {
	categories: ['현재값', '기대값', '보정값'],
	series: {
		column: [
			{
				name: '출력',
				data: [158.24, 258.15, 182.65],
				colorByCategories: true,
			},
		],
		line: [
			{
				name: '효율',
				data: [50.15, 64.48, 32.15]
			},
		],
	},
};

var m10_chartoptions = {
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
			backgroundColor: 'transparent'
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
				color: '#242424'
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
			}
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

var m10_chart = document.getElementById('chart-10');
var chartM10 = toastui.Chart.columnLineChart({ el: m10_chart, data: m10_data, options: m10_chartoptions });

// 차트 리사이징
function resizeM10Chart() {
	const width = m10_chart.clientWidth;
	const height = m10_chart.clientHeight;

	if (width > 0 && height > 0) {
		chartM10.resize({ width, height });
	}
}

// 최초 1회 (필수)
//resizeM10Chart();

// 화면 리사이즈 대응
window.addEventListener('resize', resizeM10Chart);
