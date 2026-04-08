/*
 * jQuery.fitCanvas
 * Make a <canvas> dynamically fill its parent (100% x 100%) and keep the pixel buffer sized appropriately.
 *
 * Usage:
 *   $('#unity-canvas').fitCanvas({ respectDevicePixelRatio: true });
 *
 * Notes:
 * - Sets CSS width/height to 100% so it visually fills the parent container.
 * - Sets canvas.width/height (pixel buffer) to parent size * devicePixelRatio to keep WebGL crisp.
 * - Works well with Unity WebGL when config.matchWebGLToCanvasSize (default) is true.
 */
(function ($) {
  if (!$) return;

  $.fn.fitCanvas = function (options) {
    var settings = $.extend({
      respectDevicePixelRatio: true,
      onResize: null
    }, options);

    function resize($el) {
      var parent = $el.parent();
      if (!parent || parent.length === 0) return;

      // Use client dimensions of parent
      var w = parent.innerWidth();
      var h = parent.innerHeight();
      if (!w || !h) return;

      // Ensure CSS fills parent
      $el.css({ width: '100%', height: '100%', display: 'block' });

      // Update canvas pixel buffer to avoid blur (esp. for WebGL)
      var dpr = settings.respectDevicePixelRatio ? (window.devicePixelRatio || 1) : 1;
      var pxW = Math.max(1, Math.round(w * dpr));
      var pxH = Math.max(1, Math.round(h * dpr));

      var canvas = $el[0];
      if (canvas.width !== pxW) canvas.width = pxW;
      if (canvas.height !== pxH) canvas.height = pxH;

      if (typeof settings.onResize === 'function') {
        try {
          settings.onResize.call(canvas, { cssWidth: w, cssHeight: h, pixelWidth: pxW, pixelHeight: pxH, dpr: dpr });
        } catch (e) { /* no-op */ }
      }
    }

    return this.each(function () {
      var $el = $(this);

      // Initial sizing after current call stack to ensure DOM attached
      setTimeout(function(){ resize($el); }, 0);

      var handler = function () { resize($el); };
      $(window).on('resize.fitCanvas orientationchange.fitCanvas', handler);
      document.addEventListener('fullscreenchange', handler);

      // Store teardown for later (optional)
      $el.data('fitCanvasDestroy', function () {
        $(window).off('resize.fitCanvas orientationchange.fitCanvas', handler);
        document.removeEventListener('fullscreenchange', handler);
      });
    });
  };

  $.fn.fitCanvasDestroy = function () {
    return this.each(function () {
      var destroy = $(this).data('fitCanvasDestroy');
      if (destroy) destroy();
    });
  };

})(window.jQuery);
