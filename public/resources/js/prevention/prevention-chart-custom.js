
//처음 화면을 띄울 때 차트라인이 안보이게 설정하는 변수
var setValue = true;
// 데이터 설정
var mwh = costList.map(item => item.mwh);
var mwc = costList.map(item => item.mwc);
var cost = costList.map(item => item.cost);
var use_rate = costList.map(item => item.use_rate);
var pm = costList.map(item => item.pm);
var wo = costList.map(item => item.wo);
var tm = costList.map(item => item.tm);
var failureTendency = costList.map(item => item.failureTendency);
var factor = costList.map(item => item.factor);
var trip = costList.map(item => item.trip);

//y축 최대값 설정
var maxMwh = Math.max(...mwh);
var maxMwc = Math.max(...mwc);
var maxCost = Math.max(...cost);
var maxUseRate = Math.max(...use_rate);
var maxpm = Math.max(...pm);
var maxwo = Math.max(...wo);
var maxtm = Math.max(...tm);
var maxfailureTendency = Math.max(...failureTendency);
var maxfactor = Math.max(...factor);
var maxtrip = Math.max(...trip);

// 공통 ticks 적용
var applyCommonYAxisOptionsPlugin = {
	id: 'applyCommonYAxisOptions',
	beforeInit(chart) {
		// 공통 옵션 정의
		var commonYAxisOptions = {
			ticks: {
				font: {
					size: 11,
					family: 'Noto Sans KR',
					weight: '400'
				},
				color: '#111111',
				maxRotation: 45,
				minRotation: 45,
				borderWidth: 1
			}, 
			title: {
				display: true,
				color: '#333333',
				font: {
					size: 12,
					family: 'Noto Sans KR'
				}
			}
		};
		
		// 모든 Y축에 공통옵션 적용
		Object.keys(chart.options.scales).forEach((axis) => {
			if (axis.startsWith('y')) {
				Object.assign(chart.options.scales[axis], commonYAxisOptions);
			}
		});
	}
};

var myChart = new Chart(document.getElementById('trend_chart'), {
	type: 'line',
	data: {
		labels: costList.map(item => item.labels),
		datasets: [{
			label: '발전량(Mwh)',
			yAxisID: 'y1',
			data: mwh,
			borderColor: 'rgba(219, 19, 76, 0.8)',
			borderWidth: 1,
			//borderDash: [24, 4, 24, 4],
			pointStyle: 'rectRot',
			pointBackgroundColor: 'rgba(219, 19, 76, 1)',
			fill: false,
			hidden: setValue
		}, {
			label: '￦/MWH',
			yAxisID: 'y2',
			data: mwc,
			borderColor: 'rgba(0, 118, 209, 1)',
			borderWidth: 1,
			//borderDash: [16, 4, 8, 4],
			pointStyle: 'triangle',
			pointBackgroundColor: 'rgba(0, 118, 209, 1)',
			fill: false,
			hidden: setValue
		}, {
			label: '비용(억원)',
			yAxisID: 'y3',
			data: cost,
			borderColor: 'rgba(0, 78, 138, 1)',
			borderWidth: 1,
			borderDash: [24, 2],
			pointStyle: 'rect',
			pointBackgroundColor: 'rgba(0, 78, 138, 1)',
			fill: false,
			hidden: setValue
		}, {
			label: '이용률(%)',
			yAxisID: 'y4',
			data: use_rate,
			borderColor: 'rgba(242, 66, 22, 1)',
			borderWidth: 1,
			borderDash: [4, 8],
			pointStyle: 'circle',
			pointBackgroundColor: 'rgba(242, 66, 22, 1)',
			fill: false,
			hidden: setValue
		}, {
			label: 'PM(건)',
			yAxisID: 'y5',
			data: pm,
			borderColor: 'rgba(10, 184, 48, 1)',
			borderWidth: 1,
			borderDash: [12, 4, 8, 16],
			pointStyle: 'rectRounded',
			pointBackgroundColor: 'rgba(10, 184, 48, 1)',
			fill: false,
			hidden: setValue
		}, {
			label: '작업오더(건)',
			yAxisID: 'y6',
			data: wo,
			borderColor: 'rgba(255, 102, 210, 1)',
			borderWidth: 1,
			borderDash: [8, 4, 8, 8, 24],
			pointStyle: 'star',
			pointBackgroundColor: 'rgba(255, 102, 210, 1)',
			fill: false,
			hidden: setValue
		}, {
			label: 'TM(건)',
			yAxisID: 'y7',
			data: tm,
			borderColor: 'rgba(105, 120, 140, 1)',
			borderWidth: 1,
			//borderDash: [4, 2, 16, 24, 32],
			pointStyle: 'circle',
			pointBackgroundColor: 'rgba(105, 120, 140, 1)',
			fill: false,
			hidden: setValue
		}, {
			label: 'Failure Tendency',
			yAxisID: 'y8',
			data: failureTendency,
			borderColor: 'rgba(85, 0, 102, 1)',
			borderWidth: 1,
			borderDash: [8, 12, 24],
			pointStyle: 'rectRounded',
			pointBackgroundColor: 'rgba(85, 0, 102, 1)',
			fill: false,
			hidden: setValue
		}, {
			label: 'Factor(F.T./$)',
			yAxisID: 'y9',
			data: factor,
			borderColor: 'rgba(160, 108, 3, 1)',
			borderWidth: 1,
			borderDash: [4, 8, 16, 8],
			pointStyle: 'triangle',
			pointBackgroundColor: 'rgba(160, 108, 3, 1)',
			fill: false,
			hidden: setValue
		}, {
			label: 'Trip(건)',
			yAxisID: 'y10',
			data: trip,
			borderColor: 'rgba(0, 128, 160, 1)',
			borderWidth: 1,
			borderDash: [4, 4],
			pointStyle: 'crossRot',
			pointBackgroundColor: 'rgba(0, 128, 160, 1)',
			fill: false,
			hidden: setValue
		}]
	},
	options: {
		responsive: true,
		maintainAspectRatio: true,
		elements: {
			point:{
				radius: 4,
				hoverBackgroundColor: 'white'
			}
		},
		plugins:{
			legend:{
				display: false
			}
		},
		scales: {
			x:{
				grid: {
					drawOnChartArea: false // 그리드 라인을 한쪽 축에만 표시
				},
				ticks: {
					font: {
						size: 14,
						family: 'Noto Sans KR',
						weight: '500'
					},
					color: '#333333'
				}
			},
			y1: {
				type: 'linear',
				position: 'left',
				min:0,
				suggestedMax:maxMwh,
				ticks: {
					stepSize: 200000
				},
				grid: {
					drawOnChartArea: true // 그리드 라인을 한쪽 축에만 표시
				},
				border: {
					color: 'rgba(219, 19, 76, 1)'
				}
			},
			y2: {
				type: 'linear',
				position: 'left',
				grid: {
					drawOnChartArea: false // 그리드 라인을 한쪽 축에만 표시
				},
				min:0,
				suggestedMax:maxMwc,
				ticks: {
					stepSize: 10
				},
				border: {
					color: 'rgba(0, 118, 209, 1)'
				}
			},
			y3: {
				type: 'linear',
				position: 'left',
				grid: {
					drawOnChartArea: false // 그리드 라인을 한쪽 축에만 표시
				},
				min:0,
				suggestedMax:maxCost,
				ticks: {
					stepSize: 500
				},
				border: {
					color: 'rgba(0, 78, 138, 1)'
				}
			},
			y4: {
				type: 'linear',
				position: 'left',
				min:0,
				suggestedMax:maxUseRate,
				grid: {
					drawOnChartArea: false // 그리드 라인을 한쪽 축에만 표시
				},
				ticks: {
					stepSize: 500
				},
				border: {
					color: 'rgba(242, 66, 22, 1)'
				}
			},
			y5: {
				type: 'linear',
				position: 'left',
				min:0,
				suggestedMax:maxpm,
				grid: {
					drawOnChartArea: false // 그리드 라인을 한쪽 축에만 표시
				},
				ticks: {
					stepSize: 10000000
				},
				border: {
					color: 'rgba(10, 184, 48, 1)'
				}
			},
			y6: {
				type: 'linear',
				position: 'right',
				min:0,
				suggestedMax:maxwo,
				grid: {
					drawOnChartArea: false // 그리드 라인을 한쪽 축에만 표시
				},
				ticks: {
					stepSize: 10000
				},
				border: {
					color: 'rgba(255, 102, 210, 1)'
				}
			},
			y7: {
				type: 'linear',
				position: 'right',
				min:0,
				suggestedMax:maxtm,
				grid: {
					drawOnChartArea: false // 그리드 라인을 한쪽 축에만 표시
				},
				ticks: {
					stepSize: 2000
				},
				border: {
					color: 'rgba(105, 120, 140, 1)'
				}
			},
			y8: {
				type: 'linear',
				position: 'right',
				min:0,
				suggestedMax:maxfailureTendency,
				grid: {
					drawOnChartArea: false // 그리드 라인을 한쪽 축에만 표시
				},
				ticks: {
					stepSize: 2000
				},
				border: {
					color: 'rgba(85, 0, 102, 1)'
				}
			},
			y9: {
				type: 'linear',
				position: 'right',
				min:0,
				suggestedMax:maxfactor,
				grid: {
					drawOnChartArea: false // 그리드 라인을 한쪽 축에만 표시
				},
				ticks: {
					stepSize: 0.2
				},
				border: {
					color: 'rgba(160, 108, 3, 1)'
				}
			},
			y10: {
				type: 'linear',
				position: 'right',
				min:0,
				suggestedMax:maxtrip,
				grid: {
					drawOnChartArea: false // 그리드 라인을 한쪽 축에만 표시
				},
				ticks: {
					stepSize: 5
				},
				border: {
					color: 'rgba(0, 128, 160, 1)'
				}
			}
			
		},
		layout: {
			padding: {
				top: 30,
				bottom: 10
			}						
		}
	},
	plugins: [applyCommonYAxisOptionsPlugin]
});

// 체크박스 이벤트 리스너 추가
document.querySelectorAll('.label-box input[type="checkbox"]').forEach((checkbox, index) => {
	checkbox.addEventListener('change', (event) => {
		// 체크박스 상태에 따라 숨기기, 표시하기
		myChart.data.datasets[index].hidden = !event.target.checked;
		
		var optionId = myChart.data.datasets[index].yAxisID;
		var yAxis = myChart.options.scales[optionId];
		var getyAxisColor = yAxis.border.color;
		if (event.target.checked){
			yAxis.border = { color:getyAxisColor, width: 5};
		} else {
			yAxis.border = { color:getyAxisColor, width: 1};
		}

		myChart.update(); // 차트 업데이트
	});
});

//비용 라인만 먼저 보이게 설정
myChart.data.datasets.forEach((dataset, index) => {
	var optionIds = dataset.yAxisID;
	var yAxisNo = myChart.options.scales[optionIds];
    if (optionIds == 'y3') {
      myChart.data.datasets[index].hidden = false;
      var getyAxisColors = yAxisNo.border.color;
      yAxisNo.border = { color:getyAxisColors, width: 5};
    }
    myChart.update();
 });