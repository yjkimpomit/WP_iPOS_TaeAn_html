var mini_p_list = "";
var set_width = window.innerWidth;
var set_height = window.innerHeight - $("#pnlm").height();
$("#panoroot").height(set_height);
var t_cnt = 1;
var l_cnt1 = 0;
var l_cnt2 = 0;
var root_div = document.getElementById('root');
var bodyheight = 0;
var bodyheighthalf = Math.abs(set_height / 2);
var bodywidththalf = Math.abs(set_width / 2);
var pano1;
var pano2;
var pano3;
var pano4;
var pano5;
var pano6;
var pano7;
var pano8;
var pano9;
var chkpano1 = false;
var chkpano2 = false;
var chkpano3 = false;
var chkpano4 = false;
var chkpano5 = false;
var chkpano6 = false;
var chkpano7 = false;
var chkpano8 = false;
var chkpano9 = false;
//TAGNO 존재할경우 핀포인트 찾기 변수 추가
var tagJson;
var tagpitch;
var tagyaw;

$("#panorama1").hide();
$("#panorama2").hide();
$("#panorama3").hide();
$("#panorama4").hide();
$("#panorama5").show();
$("#panorama6").hide();
$("#panorama7").hide();
$("#panorama8").hide();
$("#panorama9").hide();


function chkcnt(a1, a2, a3, a4, a5, a6, a7, a8, a9) {
	var chk = 0;

	if (a1 == true) {
		chk++;
	}

	if (a2 == true) {
		chk++;
	}

	if (a3 == true) {
		chk++;
	}

	if (a4 == true) {
		chk++;
	}

	if (a5 == true) {
		chk++;
	}

	if (a6 == true) {
		chk++;
	}

	if (a7 == true) {
		chk++;
	}

	if (a8 == true) {
		chk++;
	}

	if (a9 == true) {
		chk++;
	}

	return chk;
}



function chkcnt2(a1, a2, a3) {
	var chk = 0;

	if (a1 == true) {
		chk++;
	}

	if (a2 == true) {
		chk++;
	}

	if (a3 == true) {
		chk++;
	}
	return chk;
}

function pano_resize() {
	if (pano1) {
		pano1.resize();
	}

	if (pano2) {
		pano2.resize();
	}

	if (pano3) {
		pano3.resize();
	}

	if (pano4) {
		pano4.resize();
	}
}

function addpp(setpano_id, boxid_num, jsontxt) {

	$("#" + setpano_id).html("");
	var pintagno = panopintagno;
	var favoritesLists = favoritesList;
	var now_yaw_vals = now_yaw_val;
	var now_pitch_vals = now_pitch_val;
	
	var test_tagno = chkTree_tagno;

	
	$.ajax({
		url: '/pmt/xml_pcmcontentitem2.do',
		type: 'POST',
		method: 'POST',
		data: { pct_sn: pct_sn1, pci_tag: now_tag, pci_cam_date: now_pcicam, pme_empno: pme_empno},
		dataType: 'xml'
	}).done(function(data) {
		var bg_img = $(data).find("bg_img").text();
		var pci_cam_date = $(data).find("cam_date").text();
		var pci_x = parseFloat($(data).find("pci_x").text());
		var pci_y = parseFloat($(data).find("pci_y").text());
		var pci_z = parseFloat($(data).find("pci_z").text());

		jsontxt = $(data).find("jsontxt").text();

		if (jsontxt == "") {
			if (setpano_id == "panorama1") {
				pano1 = pannellum.viewer(setpano_id, {
					"type": "equirectangular",
					"panorama": now_img,
					"autoLoad": true,
					"haov": 360,
					"vaov": 180,
					"compass": true,
					"vOffset": 0
				});

				chkpano1 = true;
			} else if (setpano_id == "panorama2") {
				pano2 = pannellum.viewer(setpano_id, {
					"type": "equirectangular",
					"panorama": now_img,
					"autoLoad": true,
					"haov": 360,
					"vaov": 180,
					"compass": true,
					"vOffset": 0
				});
				chkpano2 = true;
			} else if (setpano_id == "panorama3") {
				pano3 = pannellum.viewer(setpano_id, {
					"type": "equirectangular",
					"panorama": now_img,
					"autoLoad": true,
					"haov": 360,
					"vaov": 180,
					"compass": true,
					"vOffset": 0
				});
				chkpano3 = true;
			} else if (setpano_id == "panorama4") {
				pano4 = pannellum.viewer(setpano_id, {
					"type": "equirectangular",
					"panorama": now_img,
					"autoLoad": true,
					"haov": 360,
					"vaov": 180,
					"compass": true,
					"vOffset": 0
				});
				chkpano4 = true;
			}
		} else {
			var aaa = JSON.parse(jsontxt);
			tagJson = JSON.parse(jsontxt);
			if (setpano_id == "panorama1") {
				pano1 = pannellum.viewer(setpano_id, {
					"type": "equirectangular",
					"panorama": now_img,
					"autoLoad": true,
					"haov": 360,
					"vaov": 180,
					"compass": true,
					"vOffset": 0,
					"hotSpots": aaa
				});
				chkpano1 = true;
			} else if (setpano_id == "panorama2") {
				pano2 = pannellum.viewer(setpano_id, {
					"type": "equirectangular",
					"panorama": now_img,
					"autoLoad": true,
					"haov": 360,
					"vaov": 180,
					"compass": true,
					"vOffset": 0,
					"hotSpots": aaa
				});
				chkpano2 = true;
			} else if (setpano_id == "panorama3") {
				pano3 = pannellum.viewer(setpano_id, {
					"type": "equirectangular",
					"panorama": now_img,
					"autoLoad": true,
					"haov": 360,
					"vaov": 180,
					"compass": true,
					"vOffset": 0,
					"hotSpots": aaa
				});
				chkpano3 = true;
			} else if (setpano_id == "panorama4") {
				pano4 = pannellum.viewer(setpano_id, {
					"type": "equirectangular",
					"panorama": now_img,
					"autoLoad": true,
					"haov": 360,
					"vaov": 180,
					"compass": true,
					"vOffset": 0,
					"hotSpots": aaa
				});
				chkpano4 = true;
			}
		}

		panoset(setpano_id, boxid_num);
		pano_resize();
		//TAGNO 존재할경우 핀포인트 찾기
		//console.log(pintagno);
		if (pintagno != "" && pintagno != "null"){
			var found = tagJson.find(a => a.tagno == pintagno);
		}

		// x, y, z 축 변경
		if (setpano_id == "panorama1") {
			//TAGNO 존재할경우 핀포인트 찾기
			if(typeof found != "undefined" && found != "null" && found != ""){
				var tagnos = found.tagno;
				if (tagnos != "null" && tagnos != ""){
					tagpitch = found.pitch;
					tagyaw = found.yaw;
					// x축
					pano1.setYaw(tagyaw);
					// y축
					pano1.setPitch(tagpitch);
					pano1.setfavorite(favoritesLists);
					pano1.settesttag(test_tagno);
				}else{
					//alert("존재안함");
				}
			}else{
				//파노라마 시점 변경 할 경우
				if(now_yaw_vals != ""){
					// x축
					var move_val = Math.sign(now_yaw_vals);
					//소수 둘째 자리 반올림
					var yaws_val = Math.abs(now_yaw_vals);
					var fix_yaw = "";
					//움직인 값이 양수 일때 
					if(move_val == 1){
						fix_yaw = pci_x + yaws_val;
					//x값이 음수이고 움직인 값이 음수 일때 
					}else if(move_val == -1){
						fix_yaw = pci_x - yaws_val;
					//움직임 없이 이동 할 경우 저장된 x값 그대로 전달
					}else if(move_val == 0){
						fix_yaw = pci_x;
					}
				// x축
				pano1.setYaw(fix_yaw);
				// y축
				pano1.setPitch(now_pitch_vals);
				}else{
				// x축
				pano1.setYaw(pci_x);
				// y축
				pano1.setPitch(pci_y);
				}
				
				// z축
				pano1.setHorizonRoll(pci_z);
				pano1.setfavorite(favoritesLists);
			}		
		} else if (setpano_id == "panorama2") {
			// x축
			pano2.setYaw(pci_x);
			// y축
			pano2.setPitch(pci_y);
			// z축
			pano2.setHorizonRoll(pci_z);
		} else if (setpano_id == "panorama3") {
			// x축
			pano3.setYaw(pci_x);
			// y축
			pano3.setPitch(pci_y);
			// z축
			pano3.setHorizonRoll(pci_z);
		} else if (setpano_id == "panorama4") {
			// x축
			pano4.setYaw(pci_x);
			// y축
			pano4.setPitch(pci_y);
			// z축
			pano4.setHorizonRoll(pci_z);
		}

		var ssss = "<div class='clspanorama' >" + pci_cam_date.substring(5, 10) + "</div>";
		//console.log("aa");
		$("#" + setpano_id).append(ssss);
	});
}

function pp_close(aa) {
	var true_len = $('.datasettrue').length;

	if (true_len == 1) {

	} else {
		$("#panorama" + aa).removeClass("datasettrue");
		$("#panorama" + aa).hide();
		setsize("panorama1");
	}

	pano_resize();
}

function setsize(setpano_id) {

	var chk1 = $('#panorama1').hasClass('datasettrue');
	var chk2 = $('#panorama2').hasClass('datasettrue');
	var chk3 = $('#panorama3').hasClass('datasettrue');
	var chk4 = $('#panorama4').hasClass('datasettrue');

	var true_len = $('.datasettrue').length;

	if (true_len == 1) {
		$("#panorama1").width("100%");
		$("#panorama1").height("100%");
		$("#treeview").hide();
		$("#miniview").hide();
		$("#panorama2").hide();
		$("#panorama3").hide();
		$("#panorama4").hide();
	} else if (true_len == 4) {
		$("#panorama1").width("49.5%");
		$("#panorama2").width("49.5%");
		$("#panorama3").width("49.5%");
		$("#panorama4").width("49.5%");
		$("#panorama1").height("49.5%");
		$("#panorama2").height("49.5%");
		$("#panorama3").height("49.5%");
		$("#panorama4").height("49.5%");
		$("#miniview").hide();
		$("#treeview").hide();
	} else if (true_len == 2) {
		if (chk2 == true) {
			$("#panorama1").width("49.5%");
			$("#panorama1").height("99%");
			$("#panorama2").width("49.5%");
			$("#panorama2").height("99%");
			$("#panorama3").hide();
			$("#panorama4").hide();
		} else if (chk3 == true) {
			$("#panorama1").width("99%");
			$("#panorama1").height("49.5%");
			$("#panorama3").width("99%");
			$("#panorama3").height("49.5%");
			$("#panorama2").hide();
			$("#panorama4").hide();
		} else if (chk4 == true) {
			$("#panorama1").width("99%");
			$("#panorama1").height("49.5%");
			$("#panorama4").width("99%");
			$("#panorama4").height("49.5%");
			$("#panorama2").hide();
			$("#panorama3").hide();
		}

		$("#miniview").hide();
		$("#treeview").hide();
	} else if (true_len == 3) {
		if (chk2 == true && chk3 == true) {
			$("#panorama1").width("49.5%");
			$("#panorama1").height("49.5%");
			$("#panorama2").width("49.5%");
			$("#panorama2").height("49.5%");
			$("#panorama3").width("99%");
			$("#panorama3").height("49.5%");

			$("#panorama4").hide();

		} else if (chk2 == true && chk4 == true) {
			$("#panorama1").width("49.5%");
			$("#panorama1").height("49.5%");
			$("#panorama2").width("49.5%");
			$("#panorama2").height("49.5%");
			$("#panorama4").width("99%");
			$("#panorama4").height("49.5%");

			$("#panorama3").hide();

		} else if (chk3 == true && chk4 == true) {
			$("#panorama1").width("99%");
			$("#panorama1").height("49.5%");
			$("#panorama3").width("49.5%");
			$("#panorama3").height("49.5%");
			$("#panorama4").width("49.5%");
			$("#panorama4").height("49.5%");

			$("#panorama2").hide();

		}

		$("#miniview").hide();
		$("#treeview").hide();
	} else {
		$("#panorama1").width("99%");
		$("#panorama1").height("99%");
		$("#miniview").show();
		$("#treeview").show();
		$("#panorama2").hide();
		$("#panorama3").hide();
		$("#panorama4").hide();
	}
}


function panoset(setpano_id, boxid_num) {
	//console.log(setpano_id);
	var clsname = "box" + boxid_num;
	var a1 = $("#" + setpano_id).width();
	var a2 = $("#" + setpano_id).height() - 44;
	var top_id = "panorama2";
	var left_id = "panorama4";
	var right_id = "panorama6";
	var bottom_id = "panorama8";
	var bottom_id = "panorama5";

	if (setpano_id == "panorama1") {
		top_id = "";
		left_id = "";
		right_id = "panorama2";
		bottom_id = "panorama3";
		center_id = "panorama1";
	} else if (setpano_id == "panorama2") {
		top_id = "";
		left_id = "panorama1";
		right_id = "";
		bottom_id = "panorama4";
		center_id = "panorama2";
	} else if (setpano_id == "panorama3") {
		top_id = "panorama1";
		left_id = "";
		right_id = "panorama4";
		bottom_id = "";
		center_id = "panorama3";
	} else if (setpano_id == "panorama4") {
		top_id = "panorama2";
		left_id = "panorama3";
		right_id = "";
		bottom_id = "";
		center_id = "panorama4";
	}

	//파노라마 분할 html
	if (setpano_id == "panorama1") {
		var aaa = '';
		aaa = aaa + '<div class="' + clsname + ' box_center" pano-data-nm="' + center_id + '" ></div>';
		aaa = aaa + '<div class="' + clsname + ' box_right" pano-data-nm="' + right_id + '" ></div>';
		aaa = aaa + '<div class="' + clsname + ' box_bottom" pano-data-nm="' + bottom_id + '" ></div>';
		//aaa = aaa + '<div class="box_x" pano-data-nm="'+setpano_id+'" ><a href="javascript:pp_close(1)">X</a></div>';
	} else if (setpano_id == "panorama2") {
		var aaa = '';
		aaa = aaa + '<div class="' + clsname + ' box_left" pano-data-nm="' + left_id + '" ></div>';
		aaa = aaa + '<div class="' + clsname + ' box_center" pano-data-nm="' + center_id + '" ></div>';
		aaa = aaa + '<div class="' + clsname + ' box_bottom" pano-data-nm="' + bottom_id + '" ></div>';
		aaa = aaa + '<div class="box_x" pano-data-nm="' + setpano_id + '" ><a href="javascript:pp_close(2)">X</a></div>';
	} else if (setpano_id == "panorama3") {
		var aaa = '<div class="' + clsname + ' box_top" pano-data-nm="' + top_id + '" ></div>';
		aaa = aaa + '';
		aaa = aaa + '<div class="' + clsname + ' box_center" pano-data-nm="' + center_id + '" ></div>';
		aaa = aaa + '<div class="' + clsname + ' box_right" pano-data-nm="' + right_id + '" ></div>';
		aaa = aaa + '<div class="box_x" pano-data-nm="' + setpano_id + '" ><a href="javascript:pp_close(3)">X</a></div>';
	} else if (setpano_id == "panorama4") {
		var aaa = '<div class="' + clsname + ' box_top" pano-data-nm="' + top_id + '" ></div>';
		aaa = aaa + '<div class="' + clsname + ' box_left" pano-data-nm="' + left_id + '" ></div>';
		aaa = aaa + '<div class="' + clsname + ' box_center" pano-data-nm="' + center_id + '" ></div>';
		aaa = aaa + '<div class="box_x" pano-data-nm="' + setpano_id + '" ><a href="javascript:pp_close(4)">X</a></div>';
	}

	$("#" + setpano_id).append(aaa);

	$(".box1").hide();
	$(".box2").hide();
	$(".box3").hide();
	$(".box4").hide();

	//adddroppable(clsname,setpano_id,idx);

	$("." + clsname).droppable({
		over: function(event, ui) {
			var nowbox_idx = $("." + clsname).index(this);
			$("." + clsname).eq(nowbox_idx).addClass("ui-state-highlight");
			$("." + clsname).eq(nowbox_idx).show();
		},
		drop: function(event, ui) {
			var nowbox_idx = $("." + clsname).index(this);
			var now_setpano_id = $("." + clsname).eq(nowbox_idx).attr("pano-data-nm");
			//alert(now_setpano_id);

			if (now_setpano_id != "" && now_setpano_id.length > 2) {
				var cnt = $(".pnlm-container").length;
				$("." + clsname).eq(nowbox_idx).removeClass("ui-state-highlight");

				var now_boxid_num = 1;
				if (now_setpano_id == "panorama1") {
					now_boxid_num = 1;
				} else if (now_setpano_id == "panorama2") {
					now_boxid_num = 2;
				} else if (now_setpano_id == "panorama3") {
					now_boxid_num = 3;
				} else if (now_setpano_id == "panorama4") {
					now_boxid_num = 4;
				} else {
					now_boxid_num = 1;
				}
				//alert(cnt+"/"+now_setpano_id+"/"+nowbox_idx);

				addpp(now_setpano_id, now_boxid_num, "");
			}
			//setsize(idx);
		},
		out: function(event, ui) {
			var nowbox_idx = $("." + clsname).index(this);
			$("." + clsname).eq(nowbox_idx).removeClass("ui-state-highlight");
		}
	});

	$("#" + setpano_id).addClass("datasettrue");
	//alert($(".datasettrue").length);
	setsize(setpano_id);
	$("#" + setpano_id).show();
}

/* 2024.12.27 yjkim
 * 최신버전 브라우저용 레이더 매핑 & 미니맵 포지션 계산식 업데이트
 */
function getZoomScale($svg) {
	if ( !$svg || $svg.length === 0 ) return { scaleX: 1, scaleY: 1 };
	
	var viewBox = $svg[0].getAttribute("viewBox");
	if ( !viewBox ) return { scaleX: 1, scaleY: 1 };
	
	var viewBoxValues = viewBox.split(" ").map(Number);
	
	var width = $svg.width();
	var height = $svg.height();
	
	var scaleX = width / viewBoxValues[2];
	var scaleY = height / viewBoxValues[3];
	
	return { scaleX, scaleY };
}

var zoom = getZoomScale($("#minisvg"));
//console.log(zoom);

function getSVGRelativePosition($element) {
	
	if( !$element || $element.length === 0 ) {
		console.error('Not Exist!');
		return null;
	}
	
	// $element 의 위치 구하기
	var rect = $element[0].getBoundingClientRect();
	console.log( '$element 의 위치 - \nTop: ' + rect.top + '\nLeft: ' + rect.left + '\nWidth: ' + rect.width + '\nHeight: ' + rect.height );
	
	// $element를 포함하는 svg 찾기
	var $svg = $element.closest('svg');
	
	// $element를 포함하는 svg 찾기
	var $miniview = $svg.closest('#miniview');
	var zoom = 1;
	
	if( $miniview.length > 0 ) {
		// zoom 값 가져오기
		zoom = parseFloat($miniview.css('zoom')) || 1;
	}
	
	console.log( 'zoom: ' + zoom );
	
	// svg 시작점 좌표 구하기
	var svgRect = $svg[0].getBoundingClientRect();
	
	// 크롬 버전 체크
	var userAgent = navigator.userAgent;
	var chromeVersion = /Chrome\/([0-9]+)/.exec(userAgent);
	var chromeVersionNumber = chromeVersion ? parseInt(chromeVersion[1], 10) : 0;
	
	// 버전확인
	// 크롬 기준 127까지는 zoom 기능이 정상적으로 동작 안하여 127 이전 버전에 대한 크기 적용
	// 128 이후 버전부터 반응형 정상동작
	console.log( '[1. 브라우저 버전: ' + chromeVersionNumber + ' ]');
	
	if ( chromeVersionNumber <= 127 ) {
		console.log('127 이하 버전이므로 업그레이드 권장');
		// svg의 너비와 높이 구하기
		var svgWidth = $svg.width() / zoom;
		var svgHeight = $svg.height() / zoom;
	} else {
		// svg의 너비와 높이 구하기
		var svgWidth = $svg.width();
		var svgHeight = $svg.height();	
	}
	
	// $element의 위치에서 svg의 위치를 빼서 상대좌표 구하기
	var relativeTop = (rect.top - svgRect.top) / zoom;
	var relativeLeft = (rect.left - svgRect.left) / zoom;
	
	// rect의 중심값 더해 주기위해
	var centerOffsetTop = rect.height / 2 / zoom;
	var centerOffsetLeft = rect.width / 2 / zoom;
	
	// 계산된 상대좌표 반환
	return {
		top: ((relativeTop + centerOffsetTop) / svgHeight) * 100,
		left: ((relativeLeft + centerOffsetLeft) / svgWidth) * 100
	};
}

function setRadarPosition(svgPos) {
	// svgPos가 null 이면 실행안함
	if ( !svgPos ) {
		return;
	} else {
		console.log( 'Top: ' + (svgPos.top) + ' / Left: ' + (svgPos.left) );
	}
	
	var $radar = $("#aaa11");
	
	// radar 좌표설정
	$radar.css({
		top: (svgPos.top) + '%',
		left: (svgPos.left) + '%'
	});
	
}

function getPos($element) {
	// $element 유효한지 확인
	if( !$element || $element.length === 0 ) {
		console.error('The element is not found.');
		return;
	}
	
	// $element 상대좌표 가져오기
	var svgPos =  getSVGRelativePosition($element);
	
	// 좌표 매핑
	setRadarPosition(svgPos);
}

/* end */

// 레이더 매핑함수
// 이전 버전 문제없이 동작하지만 복잡해서 교체하고 사용안함
// 2024.12.27 yjkim
function chkminiloc__ori__($this) {
	
	// 크롬 버전 체크
	var userAgent = navigator.userAgent;
	var chromeVersion = /Chrome\/([0-9]+)/.exec(userAgent);
	var chromeVersionNumber = chromeVersion ? parseInt(chromeVersion[1], 10) : 0;
	
	// var edgeVersion = /Edg\/([0-9]+)/.exec(userAgent);
	
	// 버전확인
	console.log( '[1. 브라우저 버전: ' + chromeVersionNumber + ' ]');
	
	var start_pos = $("#minisvg > svg").position();
	
	var start_pos_top = start_pos.top;
	var start_pos_left = start_pos.left;
	
	//console.log('[#minisvg > svg] start_pos_top: ' + parseInt(start_pos.top) + ' / start_pos_left: ' + parseInt(start_pos.left) );
	
	var thisSvg = $this[0].getBoundingClientRect();
	
	//var xPos = (thisSvg.left) + window.pageXOffset;
	//var yPos = (thisSvg.top) + window.pageYOffset;
	//console.log( '$this: xPos, yPos: ', xPos, yPos );
	
	//console.log( '$this - Top: ' + parseInt(thisSvg.top) + '/ Left: ' + parseInt(thisSvg.left) );
	
	//var svgRatio = thisSvg.width / thisSvg.height;
	//console.log( '$this - Width: ' + parseInt(thisSvg.width) + ' - 1/2: ' + parseInt(thisSvg.width / 2) + '/ Heght/2: ' + parseInt(thisSvg.height / 2) );
	
	/*
	console.log( '$this - width: ' + parseInt(thisSvg.width) + '/ height: ' + parseInt(thisSvg.height) + ' / svgRatio: ' + svgRatio );
	
	var radarW = $("#aaa11").width();
	var radarH = radarW * svgRatio;
	console.log( '$this - Height: ' + radarH );	
	$('#aaa11').css("height", radarH + "px");
	*/
	
	// 3200 * 1800
	var svgWidth = $("#minisvg > svg").width();
	var svgHeight = $("#minisvg > svg").height();

	var svg_1 = $this.position();
	//console.log(svg_1);
	
	console.log('[2. SVG 내의 포지션 - $this] Top: ' + (svg_1.top) + ' / Left:' + (svg_1.left) );
	
	// 클릭한 도형의 시작점에서 절반크기만큼 더 하여 센터값 계산
	var now_pos_top = (svg_1.top - start_pos_top) + (thisSvg.height / 2);
	var now_pos_left = (svg_1.left - start_pos_left)  + (thisSvg.width / 2);
	
	console.log('[3. 미니맵용으로 계산된 포지션 SVG - $this] Top: ' + now_pos_top + ' / Left: ' + now_pos_left );
	
	/*
	mini_width = '320';
	mini_height = '180';
	
	var mini_pos_top = parseInt((mini_height * now_pos_top) / svgHeight);
	var mini_pos_left = parseInt((mini_width * now_pos_left) / svgWidth);	
	console.log('mini_pos_top: ' + mini_pos_top + ' / mini_pos_left: ' + mini_pos_left);
	
	$("#aaa11").css("left", (mini_pos_left - 35) + "px").css("top", (mini_pos_top - 35) + "px");
	$("#aaa11").css("top", now_pos_top + "px").css("left", now_pos_left + "px");
	*/
	
	// 윈도우 크기
	const screenWidth = window.innerWidth;
	
	if (chromeVersionNumber <= 118) {
		
		now_pos_top = parseInt(now_pos_top * 0.1);
		now_pos_left = parseInt(now_pos_left * 0.1);
		
		//console.log('화면크기: '  + screenWidth);
		//console.log('위치: ' + now_pos_top + ' / ' + now_pos_left);	
		
		// 반응형 적용
		if( screenWidth >= 1440 ) {
			now_pos_top = parseInt(now_pos_top);
			now_pos_left = parseInt(now_pos_left);
			
			//console.log('1440 이상 ' + now_pos_top + ' / ' + now_pos_left);		
		} else if( screenWidth >= 1200 ) {
			now_pos_top = parseInt(now_pos_top * 0.75);
			now_pos_left = parseInt(now_pos_left * 0.75);
			
			//console.log('1200 이상 ' + now_pos_top + ' / ' + now_pos_left);			
		} else {
			now_pos_top = parseInt(now_pos_top * 0.5);
			now_pos_left = parseInt(now_pos_left * 0.5);
			
			//console.log('1200 이상 ' + now_pos_top + ' / ' + now_pos_left);	
		} 
		
	} 
	
	console.log('[2-1 Clicked $this Original SVG] Top: ' + (svg_1.top) + ' / Left:' + (svg_1.left) );
	
	// 반응형 적용
	if( screenWidth >= 1440 ) {
		console.log('4. 화면크기: 1440 이상 ' + now_pos_top + ' / ' + now_pos_left);
		$("#aaa11").css("top", parseInt(now_pos_top) + "px").css("left", parseInt(now_pos_left) + "px");
	
	} else if( screenWidth >= 1200 ) {
		// 1.33  은 축소된 비율을 원래크기로 돌림
		console.log('4. 화면크기: 1440 이하  1200 이상 ' + now_pos_top + ' / ' + now_pos_left);
		$("#aaa11").css("top", parseInt(now_pos_top * 1.3333) + "px").css("left", parseInt(now_pos_left * 1.3333) + "px");
	
	} else {
		// 1.5  은 축소된 비율을 원래크기로 돌림
		console.log('4. 화면크기: 1200 이하 ' + now_pos_top + ' / ' + now_pos_left);
		$("#aaa11").css("top", parseInt(now_pos_top * 2) + "px").css("left", parseInt(now_pos_left * 2) + "px");
	}
	
	//$("#aaa11").css("top", now_pos_top + "px").css("left", now_pos_left + "px");
	$('#aaa11').css("display", "inline");
}


var svg_width = $("#minisvg > svg").width();
var svg_height = $("#minisvg > svg").height();
var mini_width = parseInt(svg_width * 0.2);
var mini_height = parseInt(svg_height * 0.2);
$("#minibox").width(mini_width);
$("#minibox").height(mini_height);

/* 2024.12.27 yjkim
//$("#miniview").width(mini_width);
//$("#miniview").height(mini_height);
$("#minisvg").css({ 'zoom': 0.2 });
*/

$("#minisvg").hide();
$("#miniview").hide();
$("#treeview").hide();
const slider = document.querySelector('#pnlm');
let isDown = false;
let startX;
let scrollLeft;
//slider.scrollLeft = 200;
slider.addEventListener('mousedown', e => {
	//$("#aaaa").html("mousedown");
	isDown = true;
	slider.classList.add('active');
	startX = e.pageX - slider.offsetLeft;
	scrollLeft = slider.scrollLeft;
});

slider.addEventListener('mouseleave', () => {
	//$("#aaaa").html("mouseleave");
	isDown = false;
	slider.classList.remove('active');
});

slider.addEventListener('mouseup', () => {
	//$("#aaaa").html("mouseup");
	isDown = false;
	slider.classList.remove('active');
});

slider.addEventListener('mousemove', e => {
	//$("#aaaa").html("mousemove");
	if (!isDown) return;
	e.preventDefault();
	const x = e.pageX - slider.offsetLeft;
	const walk = x - startX;
	slider.scrollLeft = scrollLeft - walk;
});

$(function() {
	var p;

	$('.top_menu').draggable({
		start: function() {
			var idx = $('.top_menu').index(this);
			now_img = $('.top_menu').eq(idx).attr("data-img");
			now_pcisn = $('.top_menu').eq(idx).attr("data-sn");
			now_pcicam = $('.top_menu').eq(idx).attr("data-cam");
			now_tag = $('.top_menu').eq(idx).attr("data-tag");

			//p = $(this).offset();
			$(".box1").show();
			$(".box2").show();
			$(".box3").show();
			$(".box4").show();

		},
		stop: function() { // 드래그 종료시 실행
			$(this).animate({ top: -27, left: -4 }, 250, 'easeOutBack');
			//var sss = $( ".box11" ).length;

			$(".box1").hide();
			$(".box2").hide();
			$(".box3").hide();
			$(".box4").hide();

			//alert(sss);
			// 제이쿼리UI 의 이징효과 사용
		}
	});

	addpp("panorama1", 1, "");

	$("#minisvg > svg a").each(function(index, item) {
		var linkt = $(item).attr("xlink:href");
		//var pcisn1 = linkt.substring(22,linkt.length-2);
		//var pcisn2 = linkt.substring(linkt.indexOf("#") + 1, linkt.length - 14);
		var pcisn2 = linkt.substring(22, linkt.indexOf("@"));
		var pinid = $(item).attr('id');
		if (pcisn2 == nv_tag1 || pcisn2 == nv_tag2 || pcisn2 == nv_tag3 || pcisn2 == nv_tag4) {
			$("#"+pinid).find("path").attr("fill","#FF0000");
			// 2024.12.27 yjkim 최신브라우저용 업데이트
			// chkminiloc($(item));
			getPos($(item));
		}
	})

});

function box_close() {
	$(".box1").show();
	$(".box2").show();
	$(".box3").show();
	$(".box4").show();
	$(".box5").show();
	$(".box6").show();
	$(".box7").show();
	$(".box8").show();
	$(".box9").show();
}

function box_open() {
	$(".box1").hide();
	$(".box2").hide();
	$(".box3").hide();
	$(".box4").hide();
	$(".box5").hide();
	$(".box6").hide();
	$(".box7").hide();
	$(".box8").hide();
	$(".box9").hide();
}

//스냅샷이 없을 경우
function nosnap(tagno){
	if (tagno != "") {
		//alert(tagno);
		// 아래 testFull 함수 에서 window.top.location.href='http://www.naver.com'; 부분에 url 경로 바꿔줄 시 iframe 밖에 창에서 주소로 이동함
		//testFull();
		/*document.exitFullscreen();
		location.href='http://www.naver.com';*/
			/*$("div[id^='submenu_']").remove();
			$(".pnlm-render-container .pnlm-hotspot-base").css("z-index", "1");
			$("#" + tagno).css("z-index", "999");
			var subdiv = "<div class=lookbox  id=submenu_" + tagno + ">";
			subdiv = subdiv + "<div  class=look_btn01  onclick=movesystem('" + tagno + "')>" + "추출" + "</div>";
			subdiv = subdiv + "<div  class=look_btn03 onclick=subclose('" + tagno + "')>" + "닫기" + "</div>";
			subdiv = subdiv + "</div>";
			$("#" + tagno).append(subdiv);*/
		modalPopup(tagno);	
		//alert("중부태그정보검색:"+tagno);	
	}
}

function mainfocus(a){
					
					var mainFocusInfo = a.split("@");
					window.location.href = "/pcm/vi/main.do?pct_sn=" + mainFocusInfo[0] + "&pci_tag=" + encodeURIComponent(mainFocusInfo[1]);
					
				}

function navifocus(a){
					
					var naviFocusInfo = a.split("@");
					window.location.href = "/pcm/vi/naviview.do?pct_sn=" + naviFocusInfo[0] + "&pci_tag=" + encodeURIComponent(naviFocusInfo[1]);
					
				}

function tagnofocus(a){
					
					var tagnoFocusInfo = a.split("@");
					window.location.href = "/pcm/vi/panoview.do?pct_sn=" + tagnoFocusInfo[0] +"&pci_tag=" + encodeURIComponent(tagnoFocusInfo[1]) + "&tagno=" + tagnoFocusInfo[2];
					
				}

//스냅샷이 있을 경우
function existsanp(aa) {
// (클릭한 대상).css("z-index", "999");
	if (aa != "") {
		if (aa.indexOf('@') > -1) {
			var linklist = aa.split('@');
			var tag_name = linklist[3];
			$("div[id^='submenu_']").remove();
			$(".pnlm-render-container .pnlm-hotspot-base").css("z-index", "1");
			$("#" + tag_name).css("z-index", "999");
			//서브메뉴 추가
			if(document.getElementById("submenu_"+tag_name)){
				$("#" + tag_name).css("z-index", "1");
			}else{
				var subdiv = "<div class=lookbox  id=submenu_" + tag_name + ">";
				subdiv = subdiv + "<div  class=look_btn01  onclick=movesystem('" + tag_name + "')>" + "추출" + "</div>";
				subdiv = subdiv + "<div  class=look_btn02  onclick=changesnap('" + aa + "')>" + "보기" + "</div>";
				subdiv = subdiv + "<div  class=look_btn03 onclick=subclose('" + tag_name + "')>" + "닫기" + "</div>";
				subdiv = subdiv + "</div>";
				$("#" + tag_name).append(subdiv);
			}
			
			//alert(tag_name);
		}
	}
}


//태그번호 설비 정보 시스템 넘겨주기
function movesystem(tagno){
	testFull(tagno);
	//alert(tagno);
	event.preventDefault();
}

//스냅샷 보기
function changesnap(aa){
	jsgotourl(aa);
	event.preventDefault();
}

//닫기
function subclose(tagno){
	var div = "#submenu_"+tagno;
	$(div).remove();
	event.preventDefault();
}

//핀 수정
function updatepin(info){

	var infolist = info.split(',');
	//태그명
	var tag_name = infolist[0];
	//공용체크
	var chk_type = infolist[1];
	//표시명
	var text_name = infolist[2];
	dialog2.dialog( "open" );
	updatepininfo(tag_name, chk_type, text_name);
	//event.preventDefault();
}

function jsgotourl(aa) {

	var x_val = $("#bbb11").val();
	var y_val = $("#bbb22").val();
	var hot_x_val = Math.floor(x_val * 100) / 100;
	var hot_y_val = Math.floor(y_val * 100) / 100;
	
	if (aa != "") {
		if (aa.indexOf('@') > -1) {
			var linktab = aa.split('@');
			var tag_name = linktab[0];
			var cam_date = linktab[2];
			
			//url 파라미터 추가
			var urlParam = new URL(location.href).searchParams;
			var favorites = urlParam.get('favorites');
			var empno = urlParam.get('empno');
			var room = urlParam.get('room');
			var tagno = urlParam.get('tagno');
			var flag = flg;

			$.ajax({
				url: '/pmt/xml_pcmcontentitem2.do',
				type: 'POST',
				method: 'POST',
				data: { pct_sn: pct_sn1, pci_tag: tag_name, pci_cam_date: cam_date },
				dataType: 'xml'
			}).done(function(data) {
				var pci_sn = $(data).find("pci_sn").text();
				var type = $(data).find("type").text();
				//alert(type);

				var bg_img = $(data).find("bg_img").text();
				var tag = $(data).find("tag").text();
				var jsontxt = $(data).find("jsontxt").text();
				var svghtml = $(data).find("svghtml").text();
				var pci_direction = $(data).find("pci_direction").text();
				var cam_date = $(data).find("cam_date").text();
				var pci_dp1 = $(data).find("pci_dp1").text();
				var pci_dp2 = $(data).find("pci_dp2").text();
				var pci_dp3 = $(data).find("pci_dp3").text();
				var pci_dp4 = $(data).find("pci_dp4").text();
				//console.log('tag');
				//console.log(tag);
				var pga_code = $(data).find("pga_code").text();
				var pga_name = $(data).find("pga_name").text();
				var pgb_code = $(data).find("pgb_code").text();
				var pgb_name = $(data).find("pgb_name").text();
				var pgc_code = $(data).find("pgc_code").text();
				var pgc_name = $(data).find("pgc_name").text();

				var pct_sn = $(data).find("pct_sn").text();
				var pct_name = $(data).find("name").text();

				if(type=="N") {
					//document.location.href="/pcm/vi/naviview.do?pci_tag="+tag;
					document.location.href = "/pcm/vi/naviview.do?pct_sn=" + pct_sn + "&pci_tag=" + tag;
				} else if(type=="P") {
					if(flag == "1" || flag == "2"){
					document.location.href="/pcm/vi/panoview.do?pct_sn=" + pct_sn + "&pci_tag=" + tag  + "&favorites=" + favorites + "&empno=" + empno  + "&room=" + room + "&tagno=" + tagno +"&flg=" + flag;
					}else{
					//document.location.href = "/pcm/vi/naviview.do?pct_sn=" + pct_sn + "&pci_tag=" + tag;
					document.location.href="/pcm/vi/panoview.do?pct_sn=" + pct_sn + "&pci_tag=" + tag  + "&hot_x_val=" + hot_x_val + "&hot_y_val=" + hot_y_val + "&tagno=" + tagno;
					}
				} else if(type=="M") {
					document.location.href="/pcm/vi/main.do?pct_sn=" + pct_sn + "&pci_tag=" + tag;
				} else {
					document.location.href="/pcm/vi/main.do?pci_cam_date="+cam_date+"&pct_sn="+pct_sn;
				}
			});
		}
	}
}

