
const elem2 = document.getElementById('minibox');

var height1 = $("#view").height()*0.4;

var height2 = ((set_height*mini_height)/height1);
$("#minibox").height(height2);


function setscal(zoomlevel) {
	var rtn_val = 1;
	var scalk = 0.095;
	
	if(zoomlevel==1) {
		rtn_val = 1;
	} else if(zoomlevel==2) {
		rtn_val = 0.905;
	} else if(zoomlevel==3) {
		rtn_val = 0.81
	} else if(zoomlevel==4) {
		rtn_val = 0.73;
	} else if(zoomlevel==5) {
		rtn_val = 0.68;
	} else if(zoomlevel==6) {
		rtn_val = 0.61;
	} else if(zoomlevel==7) {
		rtn_val = 0.55;
	} else if(zoomlevel==8) {
		rtn_val = 0.5;
	} else if(zoomlevel==9) {
		rtn_val = 0.455;
	} else if(zoomlevel==10) {
		rtn_val = 0.41;
	} else if(zoomlevel==11) {
		rtn_val = 0.37;
	} else if(zoomlevel==12) {
		rtn_val = 0.34;
	} else if(zoomlevel==13) {
		rtn_val = 0.3;
	} else if(zoomlevel==14) {
		rtn_val = 0.26;
	} else if(zoomlevel==15) {
		rtn_val = 0.22;
	}
	
	return rtn_val;
}

function load_svg(aa){
	$( "#view" ).load( aa, function() {
		$( "#minisvg" ).load( aa, function() {
		});
	});
}

function miniviewwh(){
	var ss_pos = $("#view").position();
	var x2 = ((100*$("#minibox").width()/$("#view").width())/100)*1.65;
	var h2 = ((100*$("#minibox").height()/$("#view").height())/100)*2.3;
	var scale11 = window.devicePixelRatio;
	
	if(scale11>1) {
		x2 = x2*(scale11*1.25);
		h2 = h2*(scale11*1.1);
	} else {
	}
	
	var mini_left = Math.abs(ss_pos.left*x2);
	var mini_top = Math.abs(ss_pos.top*h2);
	
	if(zoomlevel==1) {
		$("#minibox").css("left","0px").css("top",mini_top+"px");
	} else {
		$("#minibox").css("left",mini_left+"px").css("top",mini_top+"px");
	}
}

function mainfocus(a){
					
					var mainFocusInfo = a.split("@");
					window.location.href = "/pcm/vi/main.do?pct_sn=" + mainFocusInfo[0] + "&pci_tag=" + encodeURIComponent(mainFocusInfo[1]);
					
				}

function navifocus(a){
					
					var naviFocusInfo = a.split("@");
					//console.log(naviFocusInfo[1]);
					window.location.href = "/pcm/vi/naviview.do?pct_sn=" + naviFocusInfo[0] + "&pci_tag=" + encodeURIComponent(naviFocusInfo[1]);
					
				}

function tagnofocus(a){
					
					var tagnoFocusInfo = a.split("@");
					window.location.href = "/pcm/vi/panoview.do?pct_sn=" + tagnoFocusInfo[0] +"&pci_tag=" + encodeURIComponent(tagnoFocusInfo[1]) + "&tagno=" + tagnoFocusInfo[2];
					
				}

function jsgotourl(aa){
	if(aa!=""){
		if(aa.indexOf('@')>-1){
			var linktab = aa.split('@');
			var tag_name = linktab[0];
			var cam_date = linktab[2];
			
			//url 파라미터 추가
			var urlParam = new URL(location.href).searchParams;
			var favorites = urlParam.get('favorites');
			var empno = urlParam.get('empno');

			$.ajax({
				url : '/pmt/xml_pcmcontentitem2.do',
				type : 'POST',
				method : 'POST',
				data : {pct_sn:pct_sn1,pci_tag:tag_name,pci_cam_date:cam_date},
				dataType : 'xml'
			}).done(function(data){
				var pci_sn = $(data).find("pci_sn").text();
				var type = $(data).find("type").text();
				//alert(type);
				var bg_img = $(data).find("bg_img").text();
				var tag = $(data).find("tag").text();
				//alert(tag);
				var jsontxt = $(data).find("jsontxt").text();
				var svghtml = $(data).find("svghtml").text();
				var pci_direction = $(data).find("pci_direction").text();
				var cam_date = $(data).find("cam_date").text();
				var pct_sn = $(data).find("pct_sn").text();
				var pct_name = $(data).find("name").text();
				tag = encodeURIComponent(tag);
				
				if(type=="N") {
					//document.location.href="/pcm/vi/naviview.do?pci_tag="+tag;
					document.location.href = "/pcm/vi/naviview.do?pct_sn=" + pct_sn + "&pci_tag=" + tag;
				} else if(type=="P") {
					//document.location.href = "/pcm/vi/naviview.do?pct_sn=" + pct_sn + "&pci_tag=" + tag;
					//document.location.href="/pcm/vi/panoview.do?pct_sn=" + pct_sn + "&pci_tag=" + tag + "&empno=" + empno  + "&room=" + room + "&tagno=" + tagno;
					document.location.href="/pcm/vi/panoview.do?pct_sn=" + pct_sn + "&pci_tag=" + tag;
				} else if(type=="M") {
					document.location.href="/pcm/vi/main.do?pct_sn=" + pct_sn + "&pci_tag=" + tag;
				} else {
					document.location.href="/pcm/vi/main.do?pci_cam_date="+cam_date+"&pct_sn="+pct_sn;
				}
			});
		}
	}	
}
