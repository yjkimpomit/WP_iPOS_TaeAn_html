
(function () {
	const mapStage = document.getElementById('mapStage');
	const mapOverlay = mapStage.querySelector('.map-overlay');
	const lineLayer = document.getElementById('lineLayer');
	const infoLayer = document.getElementById('infoLayer');
	const hotspots = Array.from(mapStage.querySelectorAll('.hotspot'));
	const isTouchDevice = window.matchMedia('(hover: none), (pointer: coarse)').matches;
	let activeHotspot = null;

	function clamp(value, min, max) {
		return Math.min(Math.max(value, min), max);
	}

	function pointInRect(x, y, rect) {
		return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
	}

	function getPinCenter(pinRect, baseRect) {
		return {
			x: pinRect.left - baseRect.left + (pinRect.width / 2),
			y: pinRect.top - baseRect.top + (pinRect.height / 2)
		};
	}

	function getOwnedBox(hotspot) {
		if (!hotspot) return null;

		return hotspot.querySelector('.info-box') ||
			Array.from(infoLayer.querySelectorAll('.info-box')).find(function (el) {
				return el.__originHotspot === hotspot;
			}) ||
			null;
	}

	function clearConnector() {
		if (lineLayer) {
			lineLayer.innerHTML = '';
		}
	}

	function choosePlacement() {
		return window.innerWidth <= 767 ? 'bottom' : 'right';
	}

	function getBoxPosition(direction, pinX, pinY, boxW, boxH, stageW, stageH) {
		let left = 0;
		let top = 0;

		const isMobile = window.innerWidth <= 767;
		const edgePadding = isMobile ? 8 : 16;
		const desktopRightOffset = 160;
		const mobileBottomGap = 56;
		const desktopGap = 20;

		switch (direction) {
			case 'right':
				left = pinX + desktopRightOffset;
				top = pinY - (boxH / 2);
				break;

			case 'left':
				left = pinX - boxW - 40;
				top = pinY - (boxH / 2);
				break;

			case 'top':
				left = pinX - (boxW / 2);
				top = pinY - boxH - desktopGap;
				break;

			case 'bottom':
			default:
				left = pinX - (boxW / 2);
				top = pinY + (isMobile ? mobileBottomGap : desktopGap);
				break;
		}

		left = clamp(left, edgePadding, stageW - boxW - edgePadding);
		top = clamp(top, edgePadding, stageH - boxH - edgePadding);

		return { left, top };
	}

	function drawConnector(hotspot, box) {
		if (!lineLayer || !hotspot || !box) return;

		if (!hotspot.classList.contains('is-active') || !box.classList.contains('is-open')) {
			clearConnector();
			return;
		}

		const pin = hotspot.querySelector('.pin');
		if (!pin) {
			clearConnector();
			return;
		}

		const stageRect = mapStage.getBoundingClientRect();
		const pinRect = pin.getBoundingClientRect();
		const boxRect = box.getBoundingClientRect();

		if (!boxRect.width || !boxRect.height || !pinRect.width || !pinRect.height) {
			clearConnector();
			return;
		}

		const pinX = pinRect.left - stageRect.left + (pinRect.width / 2);
		const pinY = pinRect.top - stageRect.top + (pinRect.height / 2);

		const boxLeft = boxRect.left - stageRect.left;
		const boxTop = boxRect.top - stageRect.top;
		const boxRight = boxLeft + boxRect.width;
		const boxBottom = boxTop + boxRect.height;
		const boxCenterX = boxLeft + (boxRect.width / 2);
		const boxCenterY = boxTop + (boxRect.height / 2);

		let targetX = boxCenterX;
		let targetY = boxCenterY;

		const dxCenter = pinX - boxCenterX;
		const dyCenter = pinY - boxCenterY;

		if (Math.abs(dxCenter) > Math.abs(dyCenter)) {
			targetX = dxCenter > 0 ? boxRight : boxLeft;
			targetY = clamp(pinY, boxTop + 16, boxBottom - 16);
		} else {
			targetY = dyCenter > 0 ? boxBottom : boxTop;
			targetX = clamp(pinX, boxLeft + 16, boxRight - 16);
		}

		if (
			!isFinite(pinX) || !isFinite(pinY) ||
			!isFinite(targetX) || !isFinite(targetY)
		) {
			clearConnector();
			return;
		}

		const x1 = Number(pinX);
		const y1 = Number(pinY);
		const x2 = Number(targetX);
		const y2 = Number(targetY);

		lineLayer.setAttribute('viewBox', `0 0 ${stageRect.width} ${stageRect.height}`);
		lineLayer.setAttribute('width', stageRect.width);
		lineLayer.setAttribute('height', stageRect.height);

		lineLayer.innerHTML = `
			<line
				x1="${x1}"
				y1="${y1}"
				x2="${x2}"
				y2="${y2}"
				stroke="#ffffff"
				stroke-width="3"
				stroke-linecap="round"
			/>
		`;
	}

	function closeHotspot(hotspot) {
		if (!hotspot) return;

		const box = getOwnedBox(hotspot);

		hotspot.classList.remove('is-active');

		if (box) {
			box.classList.remove('is-open');
			box.style.opacity = '0';
			box.style.visibility = 'hidden';
			box.style.pointerEvents = 'none';
			box.style.left = '0px';
			box.style.top = '0px';
		}

		clearConnector();

		if (activeHotspot === hotspot) {
			activeHotspot = null;
		}
	}

	function closeAllExcept(current) {
		hotspots.forEach(function (hotspot) {
			if (hotspot !== current) {
				closeHotspot(hotspot);
			}
		});
	}

	function positionInfoBox(hotspot) {
		const pin = hotspot.querySelector('.pin');
		const box = getOwnedBox(hotspot);
		const panel = box ? box.querySelector('.info-box__panel') : null;

		if (!pin || !box || !panel) return;

		hotspot.classList.add('is-active');

		if (!box.__originHotspot) {
			box.__originHotspot = hotspot;
		}

		if (box.parentNode !== infoLayer) {
			infoLayer.appendChild(box);
		}

		box.style.left = '0px';
		box.style.top = '0px';
		box.classList.add('is-open');
		box.style.opacity = '1';
		box.style.visibility = 'visible';
		box.style.pointerEvents = 'auto';

		const stageRect = mapStage.getBoundingClientRect();
		const pinRect = pin.getBoundingClientRect();
		const boxRect = box.getBoundingClientRect();

		if (!boxRect.width || !boxRect.height) return;

		const pinCenter = getPinCenter(pinRect, stageRect);
		const direction = choosePlacement();

		const pos = getBoxPosition(
			direction,
			pinCenter.x,
			pinCenter.y,
			boxRect.width,
			boxRect.height,
			stageRect.width,
			stageRect.height
		);

		box.style.left = pos.left + 'px';
		box.style.top = pos.top + 'px';

		requestAnimationFrame(function () {
			requestAnimationFrame(function () {
				drawConnector(hotspot, box);
			});
		});
	}

	function openHotspot(hotspot) {
		if (!hotspot) return;

		closeAllExcept(hotspot);
		hotspot.classList.add('is-active');
		activeHotspot = hotspot;
		positionInfoBox(hotspot);
	}

	function isPointerOverActiveArea(hotspot, clientX, clientY) {
		if (!hotspot) return false;

		const pin = hotspot.querySelector('.pin');
		const box = getOwnedBox(hotspot);

		let overPin = false;
		let overBox = false;
		let overBridge = false;

		if (pin) {
			const pinRect = pin.getBoundingClientRect();
			overPin = pointInRect(clientX, clientY, pinRect);

			if (box && box.classList.contains('is-open')) {
				const boxRect = box.getBoundingClientRect();

				overBox = pointInRect(clientX, clientY, boxRect);

				const bridgeLeft = Math.min(pinRect.left, boxRect.left) - 12;
				const bridgeRight = Math.max(pinRect.right, boxRect.right) + 12;
				const bridgeTop = Math.min(pinRect.top, boxRect.top) - 12;
				const bridgeBottom = Math.max(pinRect.bottom, boxRect.bottom) + 12;

				overBridge =
					clientX >= bridgeLeft &&
					clientX <= bridgeRight &&
					clientY >= bridgeTop &&
					clientY <= bridgeBottom;
			}
		}

		return overPin || overBox || overBridge;
	}

	hotspots.forEach(function (hotspot) {
		const pin = hotspot.querySelector('.pin');
		const closeBtn = hotspot.querySelector('.info-box__close');

		if (!pin) return;

		pin.addEventListener('click', function (e) {
			e.preventDefault();
			e.stopPropagation();

			if (hotspot.classList.contains('is-unbuilt')) {
				closeHotspot(hotspot);
				return;
			}

			openHotspot(hotspot);
		});

		if (!isTouchDevice) {
			pin.addEventListener('mouseenter', function () {
				if (hotspot.classList.contains('is-unbuilt')) return;
				openHotspot(hotspot);
			});
		}

		if (closeBtn) {
			closeBtn.addEventListener('click', function (e) {
				e.preventDefault();
				e.stopPropagation();
				closeHotspot(hotspot);
			});
		}
	});

	document.addEventListener('mousemove', function (e) {
		if (isTouchDevice) return;

		if (!activeHotspot) {
			clearConnector();
			return;
		}

		const activeBox = getOwnedBox(activeHotspot);

		if (!activeBox || !activeBox.classList.contains('is-open')) {
			clearConnector();
			return;
		}

		if (isPointerOverActiveArea(activeHotspot, e.clientX, e.clientY)) {
			drawConnector(activeHotspot, activeBox);
			return;
		}

		closeHotspot(activeHotspot);
	});

	window.addEventListener('resize', function () {
		if (activeHotspot) {
			positionInfoBox(activeHotspot);
		} else {
			clearConnector();
		}
	});

	window.addEventListener('orientationchange', function () {
		if (activeHotspot) {
			positionInfoBox(activeHotspot);
		} else {
			clearConnector();
		}
	});

	window.addEventListener('load', function () {
		if (activeHotspot) {
			positionInfoBox(activeHotspot);
		} else {
			clearConnector();
		}
	});
})();
