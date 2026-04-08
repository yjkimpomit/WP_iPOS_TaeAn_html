// 20260104 yjkim 업데이트
// 버튼 함수처리, 트리메뉴 높이값 자동계산
const $panoArea = $('#panoroot');
const $userNavigator = $('.user-navigator');
const $treeSec = $('#treeview');
const $mapSec = $('#miniview');
//const panoMeta = document.querySelector('meta[name="viewport"]');

function updateNavigator() {
	if (window.innerWidth < 1152) {
		document.body.classList.add('mobile');
	} else {
		document.body.classList.remove('mobile');
	}
}

$(document).ready(function () {
	updateNavigator();
	$(window).on('resize', updateNavigator);
	//
	updateTreeSecHeight();
});

//트리메뉴열기
function showTreeMenu() {
	$panoArea.addClass('disabled');
	$userNavigator.addClass('active');

	$treeSec.addClass('show');
	$mapSec.removeClass('show');
/*
	panoMeta.setAttribute(
		'content',
		'width=device-width, initial-scale=1, maximum-scale=1'
	);*/
}

//트리메뉴 닫기
function hideTreeMenu() {
	$panoArea.removeClass('disabled');
	$userNavigator.removeClass('active');

	$treeSec.removeClass('show');
	$mapSec.removeClass('show');
/*
	panoMeta.setAttribute(
		'content',
		'width=device-width, initial-scale=1, maximum-scale=3'
	);*/
}

//미니맵열기
function showMiniMap() {
	$panoArea.addClass('disabled');
	$userNavigator.addClass('active');

	$treeSec.removeClass('show');
	$mapSec.addClass('show');
/*
	panoMeta.setAttribute(
		'content',
		'width=device-width, initial-scale=1, maximum-scale=3'
	);*/
}

//미니맵닫기
function hideMiniMap() {
	$panoArea.removeClass('disabled');
	$userNavigator.removeClass('active');

	$mapSec.removeClass('show');
	$treeSec.removeClass('show');
/*
	panoMeta.setAttribute(
		'content',
		'width=device-width, initial-scale=1, maximum-scale=1'
	);*/
}

// 20260114 yjkim - 웹화면 트리메뉴/미니맵 높이조절 및 확대/축소기능

/* 확대 / 축소 함수 */
function toggleResize(btn) {
	const $button = $(btn);
	const $sec = $button.closest('.sec');

	const isMaximized = $sec.hasClass('maximized');
	const name = $sec.hasClass('tree-sec') ? '트리박스' : '미니맵';

	// 상태 토글
	$sec.toggleClass('maximized', !isMaximized);
	$button.toggleClass('maximized', !isMaximized);

	// title: 다음 동작 기준
	$button.attr(
		'title',
		!isMaximized ? `${name} 축소` : `${name} 확대`
	);

	updateTreeSecHeight();
}

/* 접기 / 펼치기 함수 */
function toggleFold(btn) {
	const $button = $(btn);
	const $sec = $button.closest('.sec');

	const isFolded = $sec.hasClass('folded');
	const name = $sec.hasClass('tree-sec') ? '트리박스' : '미니맵';

	$sec.toggleClass('folded', !isFolded);
	$button.toggleClass('folded', !isFolded);

	$button.attr(
		'title',
		!isFolded ? `${name} 펼치기` : `${name} 접기`
	);

	updateTreeSecHeight();
}

function updateTreeSecHeight() {

	$treeSec.removeClass('show');
	$mapSec.removeClass('show');

	const miniMapH = $('.user-navigator').hasClass('main')
		? 0
		: (($mapSec.outerHeight() || 0) + 8);

	const height = Math.floor(window.innerHeight - miniMapH - 16);

	//미니맵>레이더를 위해 반드시 있어야 함.
	if ($treeSec.hasClass('folded')) {
		$treeSec.css('height', 'auto');
		return;
	}

	$treeSec.css('height', height + 'px');
	//console.log('window.innerHeight : ' + window.innerHeight + ' / ' + 'height : ' + height);
}