/**
 * elms 공통 함수 모음
 */

/* 
영상의 썸네일 추출.
대상은 mov, mp4.
그이외의 영상은 추출 불가.
getTargetIdx : 추출할 영상.
setTargetIdx : 추출된 썸네일을 img 태그에 src로 등록.
setMovieTimeIdx : 추출할 영상의 시간을 input에 입력.
DB에 저장시는 img태그의 src를 파일형태로 저장 후 내용을 DB에 저장.
*/
function createMovieThumbnail(getTargetIdx, setTargetIdx,setMovieTimeidx) {

	if($("#"+getTargetIdx).val() != ""){
		$("#ajaxing").show();
		$("#movieThumbnail").attr("src","/resources/images/image-mockup-md.png");
		$("#"+setMovieTimeidx).val("");
		//document.getElementById(getTargetIdx).addEventListener('change', function(event) {
			
			//var file = event.target.files[0];
			var file = document.getElementById(getTargetIdx).files[0];
			//console.log(setTargetIdx);
			var fileReader = new FileReader();
			var thumbnailImg = document.getElementById(setTargetIdx);
			
			var video = null;
			fileReader.onload = function() {
				if (fileReader.result != null) {
			
					var blob = new Blob([fileReader.result], { type: file.type });
					//console.log(blob);
					var url = URL.createObjectURL(blob);
					//console.log(url);
					video = document.createElement('video');
					
					var timeupdate = function() {
						if (snapImage()) {
							video.removeEventListener('timeupdate', timeupdate);
							video.pause();
						}
					};
					
					video.addEventListener('loadeddata', function() {
						//console.log("tracks1 = " + video.duration);
						if (snapImage()) {
							//console.log("tracks4 = " + Math.floor(video.duration / 60) + ":" + Math.floor(video.duration % 60)+ "분") ;
							$("#"+setMovieTimeidx).val(Math.floor(video.duration / 60) + ":" +Math.floor(video.duration % 60));
							video.removeEventListener('timeupdate', timeupdate);
							$("#changeThumnail").val(1);
							$("#ajaxing").hide();
						}
					});
					var snapImage = function() {
						//console.log("tracks2 = " + video.duration);
						var canvas = document.createElement('canvas');
						canvas.width = video.videoWidth;
						canvas.height = video.videoHeight;
						canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
						var image = ""; 
						image = canvas.toDataURL("image/jpeg");
						//console.log(image);
						//console.log("length====="+image.length);
						var success = image.length > 1000;
						//console.log(success);
						if (success) {
							//console.log(image);
							thumbnailImg.src = image;
							URL.revokeObjectURL(url);
						}
						
						return success;
					};
				}
				
				video.addEventListener('timeupdate', timeupdate);
				video.preload = 'metadata';
				video.src = url;
				video.muted = true;
				video.playsInline = true;
				video.currentTime = 4;
				//console.log("tracks3 = " + video.duration);
				if (snapImage()) {
					setTimeout(() => fileReader.abort(), 3000);
				}
			};
			fileReader.readAsArrayBuffer(file);
		//});
		}
}

/*
로그인 세션 체크 후 세션이 만료 되었을 경우 로그인 페이지로 이동
조건 : ajax 사용시 ajax 호출하기 전에 선언하여 사용해야 함
*/
function checkLogin() {
	var result = 0;
	
	$.ajax({
		url:"/home/checkLogin.do",
		type:"GET",
		dataType : "json",
		async : false,
		success: function(data){
			result = data.result;
			
			if (result == 0) {
				alert("로그인 세션이 종료 되었습니다.\n다시 로그인하여 주십시오.");
				
				location.href = '/home/login.do';
				return;
			}
		},
		error:function(request,status,error){
			console.log("code:"+request.status+"\n message:"+request.responseText+"\n error:"+error);
		},
		complete:function(){
		}
	});
}


function checkAdmLogin() {
	var result = 0;
	
	$.ajax({
		url:"/home/checkLogin.do",
		type:"GET",
		dataType : "json",
		async : false,
		success: function(data){
			result = data.result;
			
			if (result == 0) {
				alert("로그인 세션이 종료 되었습니다.\n다시 로그인하여 주십시오.");
				opener.location.href="/home/login.do";
				window.close();
				return;
			}
		},
		error:function(request,status,error){
			console.log("code:"+request.status+"\n message:"+request.responseText+"\n error:"+error);
		},
		complete:function(){
		}
	});
}

function checkGroupActivate(){
	$.ajax({
		url:"/home/checkGroup.do",
		type:"GET",
		dataType : "json",
		async : false,
		success: function(data){
			result = data.result;
			
			if (result == 0) {
				alert("잘못된 정보의 url로 접근하였습니다. \n 메인화면으로 이동합니다.");
				location.href="/home/selectGroup.do";
				return;
			}
		},
		error:function(request,status,error){
			console.log("code:"+request.status+"\n message:"+request.responseText+"\n error:"+error);
		},
		complete:function(){
		}
	});
}

function isValidURL(url){
	var RegExp = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
	
	if(RegExp.test(url)){
		return true;
	}else{
		return false;
	}
}

function checkSpecialChar(targetTxt){

	var flg = true;
	var chkTagSpecialChar = /[@$%^&!'\\]/;
			
	if(chkTagSpecialChar.test(targetTxt)){
		flg = false;
	}
	
	return flg;
}

function replaceXssStr(str){
	var checkflg = true;
	console.log(str);
	
	str = str.replaceAll("&lt;","<");
	str = str.replaceAll("&gt;",">");
	
	var type_1 = str.indexOf("<script");
	var type_2 = str.indexOf("</script>");
	
	if(type_1 > 0){
		console.log(type_1);
		checkflg = false;
	}
	if(type_2 > 0){
		console.log(type_2);
		checkflg = false;
	}
	console.log(checkflg);
	return checkflg; 
}
