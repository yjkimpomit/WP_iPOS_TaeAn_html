

// CC 차트
var cc_data = {
	categories: ['현재값','기대값','보정값'],
	series: {
		column: [
			{
				name: '출력',
				data:[755.33, 863.48, 827.79],
				colorByCategories: true,
			},
		],
		line: [
			{
				name: '효율',
				data:[45.1, 54.23, 46.07] 	
			},
		],
	},
};

var cc_chartoptions = {
		chart: {
			width: 450,
			height: 220,
			title: 'CC'
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
			title: {
				fontFamily: 'Roboto',
				fontSize: 20,
				fontWeight: 700
			},
			xAxis: {
				label: {
					fontFamily: 'Noto Sans KR',
					fontSize: 13,
					fontWeight:500,
					color: '#3D4652'
				},
				width: 1,
				color: '#E8EAEE'
			},
			yAxis: {
				title: {
					fontFamily: 'Noto Sans KR',
					fontSize: 13,
					fontWeight:500,
					color: '#3D4652'
				},
				label: {
					fontFamily: 'Roboto',
					fontSize: 11,
					fontWeight:500,
					color: '#3D4652'
				},
				width: 1,
				color: '#E8EAEE'
			},
			series:{
				column: {
					colors: ['#FF7700','#F56200','#11111130'],
					barWidth: 25,
				},
				line: {
					colors: '#272F3F'
				}
			},
		},
		series: {
			barWidth: 30,
			showDot: true,
		},
		legend: {
			align: 'bottom',
			visible: false,
		},
		tooltip: {
			formatter: (value, tooltipDataInfo) => {
				if (tooltipDataInfo.label === '출력'){
					return value +  'mw';
				}
				if (tooltipDataInfo.label === '효율'){
					return value + '%';
				}
				console.log(tooltipDataInfo);
				return value;
			},
		},
		responsive: {
			animation: { duration: 300 }
		},
		exportMenu:{visible: false}
};
// GT1 차트
var gt_data = {
	categories: ['현재값','기대값','보정값'],
	series: {
		column: [
			{
				name: '출력',
				data:[258.69, 287.75, 285.79],
				colorByCategories: true,
			},
		],
		line: [
			{
				name: '효율',
				data:[30.88, 36.04, 31.79] 	
			},
		],
	},
};

var gt_chartoptions = {
		chart: {
			width: 450,
			height: 220,
			title: 'GT1'
		},
		yAxis: [
			{
				title: '출력(MW)',
				scale: {
				min: 0,
				max: 400
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
			title: {
				fontFamily: 'Roboto',
				fontSize: 20,
				fontWeight: 700
			},
			xAxis: {
				label: {
					fontFamily: 'Noto Sans KR',
					fontSize: 13,
					fontWeight:500,
					color: '#3D4652'
				},
				width: 1,
				color: '#E8EAEE'
			},
			yAxis: {
				title: {
					fontFamily: 'Noto Sans KR',
					fontSize: 13,
					fontWeight:500,
					color: '#3D4652'
				},
				label: {
					fontFamily: 'Roboto',
					fontSize: 11,
					fontWeight:500,
					color: '#3D4652'
				},
				width: 1,
				color: '#E8EAEE'
			},
			series:{
				column: {
					colors: ['#1E8FFF','#005DDF','#11111130'],
					barWidth: 25,
				},
				line: {
					colors: '#272F3F'
				}
			},
		},
		series: {
			barWidth: 30,
			showDot: true,
		},
		legend: {
			align: 'bottom',
			visible: false,
		},
		tooltip: {
			formatter: (value, tooltipDataInfo) => {
				if (tooltipDataInfo.label === '출력'){
					return value +  'mw';
				}
				if (tooltipDataInfo.label === '효율'){
					return value + '%';
				}
				console.log(tooltipDataInfo);
				return value;
			},
		},
		responsive: {
			animation: { duration: 300 }
		},
		exportMenu:{visible: false}
};

// GT2 차트
var gt2_data = {
	categories: ['현재값','기대값','보정값'],
	series: {
		column: [
			{
				name: '출력',
				data:[259.12, 286.62, 287.40],
				colorByCategories: true,
			},
		],
		line: [
			{
				name: '효율',
				data:[30.96, 36.11, 31.92] 	
			},
		],
	},
};

var gt2_chartoptions = {
		chart: {
			width: 450,
			height: 220,
			title: 'GT2'
		},
		yAxis: [
			{
				title: '출력(MW)',
				scale: {
				min: 0,
				max: 400
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
			title: {
				fontFamily: 'Roboto',
				fontSize: 20,
				fontWeight: 700
			},
			xAxis: {
				label: {
					fontFamily: 'Noto Sans KR',
					fontSize: 13,
					fontWeight:500,
					color: '#3D4652'
				},
				width: 1,
				color: '#E8EAEE'
			},
			yAxis: {
				title: {
					fontFamily: 'Noto Sans KR',
					fontSize: 13,
					fontWeight:500,
					color: '#3D4652'
				},
				label: {
					fontFamily: 'Roboto',
					fontSize: 11,
					fontWeight:500,
					color: '#3D4652'
				},
				width: 1,
				color: '#E8EAEE'
			},
			series:{
				column: {
					colors: ['#3EBB3C','#21A321','#11111130'],
					barWidth: 25,
				},
				line: {
					colors: '#272F3F'
				}
			},
		},
		series: {
			barWidth: 30,
			showDot: true,
		},
		legend: {
			align: 'bottom',
			visible: false,
		},
		tooltip: {
			formatter: (value, tooltipDataInfo) => {
				if (tooltipDataInfo.label === '출력'){
					return value +  'mv';
				}
				if (tooltipDataInfo.label === '효율'){
					return value + '%';
				}
				console.log(tooltipDataInfo);
				return value;
			},
		},
		responsive: {
			animation: { duration: 300 }
		},
		exportMenu:{visible: false}
};

// ST 차트
var st_data = {
	categories: ['현재값','기대값','보정값'],
	series: {
		column: [
			{
				name: '출력',
				data:[237.52, 289.11, 304.92],
				colorByCategories: true,
			},
		],
		line: [
			{
				name: '효율',
				data:[33.31, 34.53, 34.48] 	
			},
		],
	},
};

var st_chartoptions = {
		chart: {
			width: 450,
			height: 220,
			title: 'ST'
		},
		yAxis: [
			{
				title: '출력(MW)',
				scale: {
				min: 0,
				max: 400
			}
			},
			
			{
				title: '효율(Cycle)',
				chartType: 'line',
				scale: {
				min: 0,
				max: 100
			}
			}
		],
		theme: {
			title: {
				fontFamily: 'Roboto',
				fontSize: 20,
				fontWeight: 700
			},
			xAxis: {
				label: {
					fontFamily: 'Noto Sans KR',
					fontSize: 13,
					fontWeight:500,
					color: '#3D4652'
				},
				width: 1,
				color: '#E8EAEE'
			},
			yAxis: {
				title: {
					fontFamily: 'Noto Sans KR',
					fontSize: 13,
					fontWeight:500,
					color: '#3D4652'
				},
				label: {
					fontFamily: 'Roboto',
					fontSize: 11,
					fontWeight:500,
					color: '#3D4652'
				},
				width: 1,
				color: '#E8EAEE'
			},
			series:{
				column: {
					colors: ['#00CCBE','#00ADAD','#11111130'],
					barWidth: 25,
				},
				line: {
					colors: '#272F3F'
				}
			},
		},
		series: {
			barWidth: 30,
			showDot: true,
		},
		legend: {
			align: 'bottom',
			visible: false,
		},
		tooltip: {
			formatter: (value, tooltipDataInfo) => {
				if (tooltipDataInfo.label === '출력'){
					return value +  'mw';
				}
				if (tooltipDataInfo.label === '효율'){
					return value + '%';
				}
				console.log(tooltipDataInfo);
				return value;
			},
		},
		responsive: {
			animation: { duration: 300 }
		},
		exportMenu:{visible: false}
};

// HRSG 차트
var hrsg_data = {
	categories: ['현재값','기대값'],
	series: [
		{
			name: '효율',
			data: [59.01, 91.85],
		},
	],
};

var hrsg_chartoptions = {
		chart: {
			width: 450,
			height: 220,
			title: 'HRSG1',
		},
		legend: {
			align: 'bottom',
			visible: false,
		},
		tooltip: {
			formatter: (value) => value + '%',
		},
		yAxis: {
			title: '효율(입출력)',
			scale: {
				min: 0,
				max: 100
			},
		},
		xAxis:{
			pointOnColumn: true,
		},
		series: {
			barWidth: 30,
			showDot: true,
		},
		theme: {
			title: {
				fontFamily: 'Roboto',
				fontSize: 20,
				fontWeight: 700
			},
			xAxis: {
				label: {
					fontFamily: 'Noto Sans KR',
					fontSize: 13,
					fontWeight:500,
					color: '#3D4652'
				},
				width: 1,
				color: '#E8EAEE'
			},
			yAxis: {
				title: {
					fontFamily: 'Noto Sans KR',
					fontSize: 13,
					fontWeight:500,
					color: '#3D4652'
				},
				label: {
					fontFamily: 'Roboto',
					fontSize: 11,
					fontWeight:500,
					color: '#3D4652'
				},
				width: 1,
				color: '#E8EAEE'
			},
			series:{
					colors: ['#FFD837']
			},
		},
		responsive: {
			animation: { duration: 300 }
		},
		exportMenu:{visible: false}
};

// HRSG2 차트
var hrsg2_data = {
	categories: ['현재값','기대값'],
	series: [
		{
			name: '효율',
			data: [58.95, 89.75],
		},
	],
};

var hrsg2_chartoptions = {
		chart: {
			width: 450,
			height: 240,
			title: 'HRSG2',
		},
		legend: {
			align: 'bottom',
			visible: false,
		},
		tooltip: {
			formatter: (value) => value + '%',
		},
		yAxis: {
			title: '효율(입출력)',
			scale: {
				min: 0,
				max: 100
			},
		},
		xAxis:{
			pointOnColumn: true,
		},
		series: {
			barWidth: 30,
			showDot: true,
		},
		theme: {
			title: {
				fontFamily: 'Roboto',
				fontSize: 20,
				fontWeight: 700
			},
			xAxis: {
				label: {
					fontFamily: 'Noto Sans KR',
					fontSize: 13,
					fontWeight:500,
					color: '#3D4652'
				},
				width: 1,
				color: '#E8EAEE'
			},
			yAxis: {
				title: {
					fontFamily: 'Noto Sans KR',
					fontSize: 13,
					fontWeight:500,
					color: '#3D4652'
				},
				label: {
					fontFamily: 'Roboto',
					fontSize: 11,
					fontWeight:500,
					color: '#3D4652'
				},
				width: 1,
				color: '#E8EAEE'
			},
			series:{
					colors: ['#9048C7']
			},
		},
		responsive: {
			animation: { duration: 300 }
		},
		exportMenu:{visible: false}
};

var cc_chart = document.getElementById('chart-cc');
var gt_chat = document.getElementById('chart-gt1');
var gt2_chat = document.getElementById('chart-gt2');
var st_chat = document.getElementById('chart-st');
var hrsg_chat = document.getElementById('chart-hrsg1');
var hrsg2_chat = document.getElementById('chart-hrsg2');

toastui.Chart.columnLineChart({el:cc_chart, data:cc_data, options:cc_chartoptions});
toastui.Chart.columnLineChart({el:gt_chat, data:gt_data, options:gt_chartoptions});
toastui.Chart.columnLineChart({el:gt2_chat, data:gt2_data, options:gt2_chartoptions});
toastui.Chart.columnLineChart({el:st_chat, data:st_data, options:st_chartoptions});
toastui.Chart.areaChart({el:hrsg_chat, data:hrsg_data, options:hrsg_chartoptions});
toastui.Chart.areaChart({el:hrsg2_chat, data:hrsg2_data, options:hrsg2_chartoptions});