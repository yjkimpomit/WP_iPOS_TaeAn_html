var yearSelect = document.getElementById("selectYear");
var monthSelect = document.getElementById("selectMonth");

// 기존 weekdayRow/dateRow 제거
var calendarRow = document.getElementById("calendar-list");

var weekdays = ['일', '월', '화', '수', '목', '금', '토'];

// 오늘 날짜
var today = new Date();
var todayYear = today.getFullYear();
var todayMonth = today.getMonth() + 1;
var todayDate = today.getDate();

// 연도/월 셀렉트박스 채우기
var currentYear = todayYear;

for (let y = currentYear - 5; y <= currentYear + 5; y++) {
	var option = document.createElement("option");
	option.value = y;
	option.textContent = y;
	if (y === currentYear) option.selected = true;
	yearSelect.appendChild(option);
}

for (let m = 1; m <= 12; m++) {
	var option = document.createElement("option");
	option.value = m;
	option.textContent = m + "월";
	if (m === todayMonth) option.selected = true;
	monthSelect.appendChild(option);
}

// 검색조회 리스트
var paramSearchDate;
var orderColumn;
var orderType;

function fnSearchWorkReportList(searchDate) {
	paramSearchDate = searchDate;
	$("#searchWorkReportForm #searchDate").val(searchDate);

	$.ajax({
		type: "POST",
		url: "/dailySafety/workReportList.do",
		data: $("#searchWorkReportForm").serialize(),
		dataType: "html",
		beforeSend: function () { $("#loadingBar").css("display", ""); },
		success: function (data) {
			$("#_SAFETY_WORK_REPORT_LIST").html(data);

			if (orderColumn === "model_type_name") {
				if (orderType === "asc") {
					$("._WORK_ORDER_CLASS").eq(0).removeClass('icon-down').addClass('icon-up');
					$("._WORK_ORDER_CLASS").eq(0).attr("data-order-type", "asc");
				} else {
					$("._WORK_ORDER_CLASS").eq(0).removeClass('icon-up').addClass('icon-down');
					$("._WORK_ORDER_CLASS").eq(0).attr("data-order-type", "desc");
				}
			}

			if (orderColumn === "sv_dept_name") {
				if (orderType === "asc") {
					$("._WORK_ORDER_CLASS").eq(1).removeClass('icon-down').addClass('icon-up');
					$("._WORK_ORDER_CLASS").eq(1).attr("data-order-type", "asc");
				} else {
					$("._WORK_ORDER_CLASS").eq(1).removeClass('icon-up').addClass('icon-down');
					$("._WORK_ORDER_CLASS").eq(1).attr("data-order-type", "desc");
				}
			}

			var searchCondition = $("#searchWorkReportForm #searchCondition").val();
			if (searchCondition === "") searchCondition = "all";

			$("#selectSearchCondition").val(searchCondition);
			$("#txtSearchKeyword").val($("#searchWorkReportForm #searchKeyword").val());
		},
		error: function () {
			alert("오류가 발생했습니다.\n잠시 후 다시 시도해 주시기 바랍니다.");
		},
		complete: function () { $("#loadingBar").css("display", "none"); }
	});
}

// 달력 생성 함수 (1 cell = 1 day, cell 안에 span 2개)
function generateCalendar(year, month) {
	calendarRow.innerHTML = "";

	var daysInMonth = new Date(year, month, 0).getDate();

	// 이번 달 1일의 요일 (0:일 ~ 6:토)
	const firstDay = new Date(year, month - 1, 1);
	const firstDow = firstDay.getDay(); // 일요일 기준

	// 일요일부터 시작하기 위해 앞을 이전 달로 채워야 하는 개수
	const prevMonthFillCount = firstDow; // 0이면 채울 필요 없음, 1이면 이전달 일요일 1개 등

	// 이전 달 정보
	const prevMonthDate = new Date(year, month - 1, 0); // 지난 달 마지막 날
	const prevMonthLastDate = prevMonthDate.getDate();
	const prevMonthYear = prevMonthDate.getFullYear();
	const prevMonth = prevMonthDate.getMonth() + 1;

	// 다음 달 정보
	const nextMonthYear = (month === 12) ? year + 1 : year;
	const nextMonth = (month === 12) ? 1 : month + 1;

	// 이번달 총 셀 위치: prevFillCount + daysInMonth
	const currentMonthCells = prevMonthFillCount + daysInMonth;
	// 총 42셀(6주 * 7일)까지 채우기 위해 다음달 채울 개수
	const nextMonthFillCount = 44 - currentMonthCells;

	let cellIndex = 0;

	// 1) 앞쪽: 이전 달 날짜 채우기 (opacity 0.5)
	for (let i = prevMonthFillCount; i > 0; i--) {
		const day = prevMonthLastDate - i + 1;
		const dateObj = new Date(prevMonthYear, prevMonth - 1, day);
		const dayOfWeek = dateObj.getDay();

		const cell = createCalendarCell(dateObj, day, prevMonthYear, prevMonth, "prev-month");
		calendarRow.appendChild(cell);
		cellIndex++;
	}

	// 2) 이번 달 날짜들
	for (let day = 1; day <= daysInMonth; day++) {
		const dateObj = new Date(year, month - 1, day);
		const dayOfWeek = dateObj.getDay();

		const cell = createCalendarCell(dateObj, day, year, month);
		calendarRow.appendChild(cell);
		cellIndex++;
	}

	// 3) 뒤쪽: 다음 달 날짜 채우기 (opacity 0.5)
	for (let i = 1; i <= nextMonthFillCount; i++) {
		const day = i;
		const dateObj = new Date(nextMonthYear, nextMonth - 1, day);
		const dayOfWeek = dateObj.getDay();

		const cell = createCalendarCell(dateObj, day, nextMonthYear, nextMonth, "next-month");
		calendarRow.appendChild(cell);
		cellIndex++;
	}

	// today cell로 스크롤
	setTimeout(() => {
		const todayCell = document.querySelector(".calendar .cell.today");
		if (todayCell) {
			todayCell.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
		}
	}, 100);
}

// 공통 셀 생성 헬퍼 함수
function createCalendarCell(dateObj, day, cellYear, cellMonth, extraClass = "") {
	const dayOfWeek = dateObj.getDay();

	const cell = document.createElement("div");
	cell.className = `cell ${extraClass}`;
	/*if (extraClass !== "") {
		cell.style.opacity = "0.5";
	}*/

	// 먼저 날짜, 그 다음 요일 순으로 배치
	const dateSpan = document.createElement("span");
	dateSpan.className = "date";
	dateSpan.textContent = day;

	const daySpan = document.createElement("span");
	daySpan.className = "day";
	daySpan.textContent = weekdays[dayOfWeek];

	if (dayOfWeek === 0) cell.classList.add("sunday");
	if (dayOfWeek === 6) cell.classList.add("saturday");

	// 오늘 날짜 체크
	if (cellYear === todayYear && cellMonth === todayMonth && day === todayDate) {
		cell.classList.add("today", "active");
	}

	// 클릭 이벤트: 실제 날짜로 검색 (이전/다음달도 클릭 가능)
	cell.addEventListener("click", () => {
		cell.closest(".calendar-list").querySelectorAll(".cell").forEach(c => c.classList.remove("active"));
		cell.classList.add("active");

		$("#searchWorkReportForm #pageIndex").val(1);
		$("#searchWorkReportForm #searchCondition").val("all");
		$("#searchWorkReportForm #searchKeyword").val("");

		const selectedDate = `${cellYear}-${String(cellMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		fnSearchWorkReportList(selectedDate);
	});

	cell.appendChild(dateSpan);
	cell.appendChild(daySpan);
	return cell;
}

// 월 변경 시 새로고침
monthSelect.addEventListener("change", () => {
	const selectedYear = parseInt(yearSelect.value);
	const selectedMonth = parseInt(monthSelect.value);
	generateCalendar(selectedYear, selectedMonth);
});

// 연도 변경 시도 동일하게 달력 새로고침
yearSelect.addEventListener("change", () => {
	const selectedYear = parseInt(yearSelect.value);
	const selectedMonth = parseInt(monthSelect.value); // 현재 선택된 월 유지
	generateCalendar(selectedYear, selectedMonth);
});

// 초기 로드
generateCalendar(currentYear, todayMonth);
fnSearchWorkReportList(
	currentYear + "-" + String(todayMonth).padStart(2, '0') + "-" + String(todayDate).padStart(2, '0')
);
