//취소 팝업창

	$(function($){
	
		//리스트 팝업창
		$(".btn_close").click(function(){
			$("#popup").bPopup().close();  
		});	
		$(".bt_close").click(function(){
			$("#popup").bPopup().close();  
		});
			
			//콘텐츠 항목 생성 좌표 확인 팝업
		$(".primaryBtn2").click(function(){
			$(".con_popup").bPopup({
				modalClose: false,
				opacity: 1,
			});
		});
		$(".b-close").click(function(){
			$(".con_popup").bPopup().close();
		});	
		$(".p_close").click(function(){
			$(".con_popup").bPopup().close();
		});	
	
		$(".pmt_pop").click(function(){
			$("#popup").bPopup({
				modalClose: false,
				opacity: 1,
			});
		});
		
	});

	