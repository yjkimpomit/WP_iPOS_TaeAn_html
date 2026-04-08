$(document).ready(function() {

	function getViewportSize() {
		const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
		const height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
		return { width, height };
	}
	
	//alert(navigator.userAgent);
	
	function getDeviceInfo() {
		const userAgent = navigator.userAgent.toLowerCase();
		let device = "Unknown Device";
		//console.log( userAgent );
	
		if (/android/.test(userAgent)) {
			if (/mobile/.test(userAgent)) {
				//console.log("Android Smartphone");
				device = "Android Smartphone";
				$('body').addClass('phone');
			} else if (/tablet|sm-t|kindle|silk/.test(userAgent)) {
				//console.log("Android Tablet");
				device = "Android Tablet";
				$('body').addClass('tablet');
			} else {
				//console.log("Other Android Device");
				device = "Other Android Device";
				$('body').addClass('tablet');
			}
		}
		// 애플 기기 (iPad)
		else if (/ipad/.test(userAgent)) {
			device = "Apple iPad";
			$('body').addClass('ipad');
		}
		// 애플 기기 (iPhone, iPod)
		else if (/iphone|ipod/.test(userAgent)) {
			device = "Apple iPhone";
			$('body').addClass('iphone');
		}
		// HP 노트북
		else if (/hp/.test(userAgent)) {
			device = "PC HP";
			$('body').addClass('pc hp');
		}
		// Windows 데스크탑/노트북
		else if (/windows nt/.test(userAgent)) {
			device = "PC Windows";
			$('body').addClass('pc window');
		} 
		
		// MacOS 데스크탑
		else if (/macintosh|mac os x/.test(userAgent)) {
			device = "OS X";
			$('body').addClass('os-x');
		}
	
		return device;
	}
	
	function updateViewportInfo() {
		$('body').removeClass('phone tablet ipad iphone pc hp window os-x');
	
		const viewportSize = getViewportSize();
		const deviceInfo = getDeviceInfo();
		const unityContainer = $('#unity-container');
		const unityCanvas = $('#unity-canvas');
		const infoDiv = document.getElementById("viewport-info");
	
		// 기기 명칭과 뷰포트 크기 함께 표시
		if( infoDiv ) {
			infoDiv.innerHTML =  
			`
				Device: ${deviceInfo}<br>
				Viewport W: ${viewportSize.width}px / H: ${viewportSize.height}px<br>
			`  
			+ 'Unity Container W: ' + unityContainer.width() + 'px / H: ' + unityContainer.height() + 'px'
			+ `<br>`
			+ 'Unity Canvas W: ' + unityCanvas.width() + 'px / H: ' + unityCanvas.height() + 'px'
			;
		} else {
			//console.log('뷰포트-인포 div 없음');
		}
	
	}
	
	// 페이지 로드 시 기기 정보 표시
	updateViewportInfo();
	
	// 윈도우 리사이징시 뷰포트인포 업데이트
	window.addEventListener('resize', updateViewportInfo);

	// 박스 토글
	if($("#viewport-info").length) {
		$("#viewport-info").on('click', function() {
			$(this).toggleClass('hide');
		});
	}
	
});
