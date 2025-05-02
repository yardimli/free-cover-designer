/**
 * DivRulers Class
 * Adds interactive rulers (horizontal and vertical) to a target div element.
 *
 * @param {HTMLElement} targetElement - The div element to attach rulers to.
 * @param {object} [options] - Configuration options.
 * @param {string} [options.unit='px'] - Unit label to display (currently only affects label).
 * @param {number} [options.tickMajor=100] - Distance between major ticks (in content pixels).
 * @param {number} [options.tickMinor=50] - Distance between minor ticks (in content pixels).
 * @param {number} [options.tickMicro=10] - Distance between micro ticks (in content pixels).
 * @param {boolean} [options.showLabel=true] - Whether to show labels on major ticks.
 * @param {string} [options.arrowStyle='line'] - Style of the mouse indicator ('line' or 'arrow').
 * @param {number} [options.rulerSize=20] - Thickness of the rulers in pixels.
 * @param {string} [options.rulerBgColor='rgba(240, 240, 240, 0.9)'] - Background color of rulers.
 * @param {string} [options.tickColor='#888'] - Color of the ticks.
 * @param {string} [options.labelColor='#333'] - Color of the labels.
 * @param {string} [options.indicatorColor='red'] - Color of the mouse indicators.
 */
class DivRulers {
	constructor(targetElement, options = {}) {
		if (!targetElement || !(targetElement instanceof HTMLElement)) {
			console.error("DivRulers: Invalid target element provided.");
			return;
		}
		this.target = targetElement;
		this.options = {
			unit: 'px',
			tickMajor: 100, // Represents content pixels
			tickMinor: 50,  // Represents content pixels
			tickMicro: 10,  // Represents content pixels
			showLabel: true,
			arrowStyle: 'line', // 'line' or 'arrow' (arrow is basic triangle)
			rulerSize: 20,
			rulerBgColor: 'rgba(240, 240, 240, 0.9)',
			tickColor: '#888',
			labelColor: '#333',
			indicatorColor: 'red',
			...options // Override defaults with user options
		};
		
		// <<< NEW: Store zoom factor >>>
		this.zoomFactor = 1.0;
		
		this.wrapper = null;
		this.rulerH = null;
		this.rulerV = null;
		this.canvasH = null;
		this.canvasV = null;
		this.ctxH = null;
		this.ctxV = null;
		this.corner = null;
		this.indicatorH = null;
		this.indicatorV = null;
		this.isMouseOver = false;
		
		// Bound event handlers for easy removal
		this.handleScroll = this.handleScroll.bind(this);
		this.handleMouseMove = this.handleMouseMove.bind(this);
		this.handleMouseLeave = this.handleMouseLeave.bind(this);
		this.handleResize = this.handleResize.bind(this);
		
		this.init();
	}
	
	init() {
		if (!this.target.parentElement) {
			console.error("DivRulers: Target element must be attached to the DOM.");
			return;
		}
		// --- 1. Create Wrapper and Structure ---
		this.wrapper = document.createElement('div');
		this.wrapper.style.position = 'relative'; // Context for absolute rulers
		this.wrapper.style.width = this.target.offsetWidth + 'px'; // Initial width match
		this.wrapper.style.height = this.target.offsetHeight + 'px'; // Initial height match
		this.wrapper.style.overflow = 'hidden'; // Prevents rulers showing outside wrapper bounds initially
		
		// Insert wrapper and move target inside
		this.target.parentNode.insertBefore(this.wrapper, this.target);
		this.wrapper.appendChild(this.target);
		
		// Adjust target styles
		this.target.style.position = 'absolute';
		this.target.style.top = this.options.rulerSize + 'px';
		this.target.style.left = this.options.rulerSize + 'px';
		// Make target take up remaining space (important for overflow:auto)
		this.target.style.width = `calc(100% - ${this.options.rulerSize}px)`;
		this.target.style.height = `calc(100% - ${this.options.rulerSize}px)`;
		
		
		this.wrapper.style.flexGrow = '1';
		this.wrapper.style.flexShrink = '1';
		this.wrapper.style.flexBasis = '0';
		this.wrapper.style.height = '100%'; // Or let align-items: stretch handle it
		
		// --- 2. Create Ruler Elements ---
		this.rulerH = document.createElement('div');
		this.rulerV = document.createElement('div');
		this.corner = document.createElement('div');
		this.canvasH = document.createElement('canvas');
		this.canvasV = document.createElement('canvas');
		this.ctxH = this.canvasH.getContext('2d');
		this.ctxV = this.canvasV.getContext('2d');
		this.indicatorH = document.createElement('div');
		this.indicatorV = document.createElement('div');
		
		// --- 3. Style Elements ---
		this.applyStyles();
		
		// --- 4. Append Elements ---
		this.rulerH.appendChild(this.canvasH);
		this.rulerV.appendChild(this.canvasV);
		this.wrapper.appendChild(this.corner);
		this.wrapper.appendChild(this.rulerH);
		this.wrapper.appendChild(this.rulerV);
		this.wrapper.appendChild(this.indicatorH); // Add indicators to wrapper for positioning
		this.wrapper.appendChild(this.indicatorV);
		
		// --- 5. Initial Draw & Attach Listeners ---
		this.updateRulers(); // Initial draw
		this.attachListeners();
	}
	
	applyStyles() {
		const rs = this.options.rulerSize;
		// Corner
		this.corner.style.position = 'absolute';
		this.corner.style.top = '0';
		this.corner.style.left = '0';
		this.corner.style.width = rs + 'px';
		this.corner.style.height = rs + 'px';
		this.corner.style.backgroundColor = this.options.rulerBgColor;
		this.corner.style.borderRight = `1px solid ${this.options.tickColor}`;
		this.corner.style.borderBottom = `1px solid ${this.options.tickColor}`;
		this.corner.style.boxSizing = 'border-box';
		this.corner.style.zIndex = '1001'; // Above rulers
		
		// Horizontal Ruler
		this.rulerH.style.position = 'absolute';
		this.rulerH.style.top = '0';
		this.rulerH.style.left = rs + 'px';
		this.rulerH.style.width = `calc(100% - ${rs}px)`;
		this.rulerH.style.height = rs + 'px';
		this.rulerH.style.backgroundColor = this.options.rulerBgColor;
		this.rulerH.style.overflow = 'hidden';
		this.rulerH.style.zIndex = '1000';
		
		// Vertical Ruler
		this.rulerV.style.position = 'absolute';
		this.rulerV.style.top = rs + 'px';
		this.rulerV.style.left = '0';
		this.rulerV.style.width = rs + 'px';
		this.rulerV.style.height = `calc(100% - ${rs}px)`;
		this.rulerV.style.backgroundColor = this.options.rulerBgColor;
		this.rulerV.style.overflow = 'hidden';
		this.rulerV.style.zIndex = '1000';
		
		// Canvas Base Styles
		this.canvasH.style.position = 'absolute';
		this.canvasH.style.top = '0';
		this.canvasH.style.left = '0'; // Scroll handled by transform/left later
		this.canvasV.style.position = 'absolute';
		this.canvasV.style.top = '0'; // Scroll handled by transform/top later
		this.canvasV.style.left = '0';
		
		// Indicator Base Styles
		this.indicatorH.style.position = 'absolute';
		this.indicatorH.style.top = '0';
		this.indicatorH.style.left = '0'; // Position updated on mouse move
		this.indicatorH.style.width = '1px';
		this.indicatorH.style.height = rs + 'px';
		this.indicatorH.style.backgroundColor = this.options.indicatorColor;
		this.indicatorH.style.zIndex = '1002'; // Above everything
		this.indicatorH.style.display = 'none'; // Initially hidden
		this.indicatorH.style.pointerEvents = 'none'; // Don't interfere with mouse events
		
		this.indicatorV.style.position = 'absolute';
		this.indicatorV.style.top = '0'; // Position updated on mouse move
		this.indicatorV.style.left = '0';
		this.indicatorV.style.width = rs + 'px';
		this.indicatorV.style.height = '1px';
		this.indicatorV.style.backgroundColor = this.options.indicatorColor;
		this.indicatorV.style.zIndex = '1002'; // Above everything
		this.indicatorV.style.display = 'none'; // Initially hidden
		this.indicatorV.style.pointerEvents = 'none'; // Don't interfere with mouse events
		
		// Arrow style for indicators (basic triangle)
		if (this.options.arrowStyle === 'arrow') {
			this.indicatorH.style.width = '0';
			this.indicatorH.style.height = '0';
			this.indicatorH.style.borderLeft = '5px solid transparent';
			this.indicatorH.style.borderRight = '5px solid transparent';
			this.indicatorH.style.borderTop = `7px solid ${this.options.indicatorColor}`;
			this.indicatorH.style.backgroundColor = 'transparent';
			this.indicatorH.style.transform = 'translateX(-50%)'; // Center the arrow tip
			
			this.indicatorV.style.width = '0';
			this.indicatorV.style.height = '0';
			this.indicatorV.style.borderTop = '5px solid transparent';
			this.indicatorV.style.borderBottom = '5px solid transparent';
			this.indicatorV.style.borderLeft = `7px solid ${this.options.indicatorColor}`;
			this.indicatorV.style.backgroundColor = 'transparent';
			this.indicatorV.style.transform = 'translateY(-50%)'; // Center the arrow tip
		}
	}
	
	attachListeners() {
		this.target.addEventListener('scroll', this.handleScroll);
		this.wrapper.addEventListener('mousemove', this.handleMouseMove);
		this.wrapper.addEventListener('mouseleave', this.handleMouseLeave);
		// Use ResizeObserver for efficient element resize detection
		this.resizeObserver = new ResizeObserver(this.handleResize);
		this.resizeObserver.observe(this.target); // Observe the target content div
		this.resizeObserver.observe(this.wrapper); // Observe the wrapper too
	}
	
	detachListeners() {
		this.target.removeEventListener('scroll', this.handleScroll);
		if (this.wrapper) {
			this.wrapper.removeEventListener('mousemove', this.handleMouseMove);
			this.wrapper.removeEventListener('mouseleave', this.handleMouseLeave);
		}
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
		}
	}
	
	// <<< NEW: Method to update zoom factor >>>
	setZoom(zoomFactor) {
		this.zoomFactor = Math.max(0.01, zoomFactor); // Prevent zoom <= 0
		this.updateRulers(); // Redraw rulers when zoom changes
	}
	
	handleScroll() {
		window.requestAnimationFrame(() => {
			this.updateRulers();
			// Indicator update on mouse move is usually sufficient
		});
	}
	
	handleMouseMove(event) {
		this.isMouseOver = true;
		const wrapperRect = this.wrapper.getBoundingClientRect();
		const targetRect = this.target.getBoundingClientRect(); // Target is the scrollable div
		
		// Mouse position relative to the wrapper top-left
		const mouseXWrapper = event.clientX - wrapperRect.left;
		const mouseYWrapper = event.clientY - wrapperRect.top;
		
		// --- Update Horizontal Indicator ---
		let indicatorHLeft = mouseXWrapper;
		indicatorHLeft = Math.max(this.options.rulerSize, Math.min(wrapperRect.width, indicatorHLeft));
		this.indicatorH.style.left = indicatorHLeft + 'px';
		this.indicatorH.style.display = 'block';
		
		// --- Update Vertical Indicator ---
		let indicatorVTop = mouseYWrapper;
		indicatorVTop = Math.max(this.options.rulerSize, Math.min(wrapperRect.height, indicatorVTop));
		this.indicatorV.style.top = indicatorVTop + 'px';
		this.indicatorV.style.display = 'block';
		
		// --- Optional: Display Content Coordinates in Corner ---
		if (this.options.showLabel && this.corner) {
			// Calculate content coordinates under the cursor
			// Coords relative to the target's top-left (visible part)
			const mouseXTarget = event.clientX - targetRect.left;
			const mouseYTarget = event.clientY - targetRect.top;
			// Add scroll offset and divide by zoom to get content coords
			const contentX = Math.round((this.target.scrollLeft + mouseXTarget) / this.zoomFactor);
			const contentY = Math.round((this.target.scrollTop + mouseYTarget) / this.zoomFactor);
			
			// Display in corner (adjust styling as needed)
			// this.corner.textContent = `${contentX}, ${contentY}`;
			// this.corner.style.fontSize = '10px';
			// this.corner.style.textAlign = 'center';
			// this.corner.style.lineHeight = this.options.rulerSize + 'px';
			// this.corner.style.color = this.options.labelColor;
			// this.corner.style.overflow = 'hidden';
			// this.corner.style.whiteSpace = 'nowrap';
		}
	}
	
	handleMouseLeave() {
		this.isMouseOver = false;
		this.indicatorH.style.display = 'none';
		this.indicatorV.style.display = 'none';
		if (this.options.showLabel && this.corner) {
			this.corner.textContent = ''; // Clear corner text
		}
	}
	
	handleResize() {
		console.log('DivRulers: Resize detected');
		// Update wrapper size to match target's potential new offsetWidth/Height
		this.wrapper.style.width = this.target.offsetWidth + this.options.rulerSize + 'px';
		// this.wrapper.style.height = this.target.offsetHeight + this.options.rulerSize + 'px';
		// Recalculate and redraw rulers
		this.updateRulers();
	}
	
	updateRulers() {
		if (!this.ctxH || !this.ctxV || !this.target) return; // Not initialized or destroyed
		
		const scrollWidth = this.target.scrollWidth;
		const scrollHeight = this.target.scrollHeight;
		const scrollLeft = this.target.scrollLeft;
		const scrollTop = this.target.scrollTop;
		const clientWidth = this.target.clientWidth; // Visible width
		const clientHeight = this.target.clientHeight; // Visible height
		const rs = this.options.rulerSize;
		const dpr = window.devicePixelRatio || 1;
		
		// <<< Get current zoom factor >>>
		const zoom = this.zoomFactor;
		
		// --- Update Horizontal Ruler ---
		// Canvas width needs to cover the potentially scrolled content width
		const canvasWidthH = Math.max(scrollWidth, clientWidth);
		this.canvasH.width = canvasWidthH * dpr;
		this.canvasH.height = rs * dpr;
		this.canvasH.style.width = canvasWidthH + 'px';
		this.canvasH.style.height = rs + 'px';
		this.ctxH.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset transform and scale
		
		// Position canvas based on scroll - this moves the drawing window
		this.canvasH.style.transform = `translateX(${-scrollLeft}px)`;
		
		// Clear and redraw H
		this.ctxH.clearRect(0, 0, canvasWidthH, rs);
		this.ctxH.fillStyle = this.options.rulerBgColor; // Explicitly draw background
		this.ctxH.fillRect(0, 0, canvasWidthH, rs);
		
		this.ctxH.strokeStyle = this.options.tickColor;
		this.ctxH.fillStyle = this.options.labelColor;
		this.ctxH.font = '10px sans-serif';
		this.ctxH.textBaseline = 'bottom';
		this.ctxH.lineWidth = 0.5;
		
		// Determine the range of content coordinates to draw
		// Ticks are drawn based on *content* coordinates, scaled by zoom
		const tickMajor = this.options.tickMajor;
		const tickMinor = this.options.tickMinor;
		const tickMicro = this.options.tickMicro;
		
		// Iterate through potential tick positions based on *content* coordinates
		// We only need to draw ticks that will be visible on the canvas (0 to canvasWidthH)
		// A content coordinate 'i' will be drawn at canvas position 'i * zoom'
		const maxContentX = canvasWidthH / zoom; // Max content coordinate covered by canvas
		
		for (let i = 0; i <= maxContentX; i += tickMicro) {
			const drawX = i * zoom; // Position on the canvas where this content coord is drawn
			let tickY = 0;
			
			// Round 'i' slightly for modulo checks to avoid floating point issues
			const roundedI = Math.round(i / tickMicro) * tickMicro;
			
			if (roundedI % tickMajor === 0) {
				tickY = 0; // Major tick - full height
				if (this.options.showLabel && i > 0) {
					this.ctxH.fillText(`${roundedI}`, drawX + 2, rs - 2);
				}
			} else if (roundedI % tickMinor === 0) {
				tickY = rs * 0.4; // Minor tick
			} else if (roundedI % tickMicro === 0) {
				tickY = rs * 0.7; // Micro tick
			} else {
				continue; // Skip if not a tick position (shouldn't happen with loop increment)
			}
			
			this.ctxH.beginPath();
			this.ctxH.moveTo(drawX + 0.5, tickY); // +0.5 for sharp lines
			this.ctxH.lineTo(drawX + 0.5, rs);
			this.ctxH.stroke();
		}
		
		// --- Update Vertical Ruler ---
		const canvasHeightV = Math.max(scrollHeight, clientHeight);
		this.canvasV.width = rs * dpr;
		this.canvasV.height = canvasHeightV * dpr;
		this.canvasV.style.width = rs + 'px';
		this.canvasV.style.height = canvasHeightV + 'px';
		this.ctxV.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset transform and scale
		
		// Position canvas based on scroll
		this.canvasV.style.transform = `translateY(${-scrollTop}px)`;
		
		// Clear and redraw V
		this.ctxV.clearRect(0, 0, rs, canvasHeightV);
		this.ctxV.fillStyle = this.options.rulerBgColor; // Explicitly draw background
		this.ctxV.fillRect(0, 0, rs, canvasHeightV);
		
		this.ctxV.strokeStyle = this.options.tickColor;
		this.ctxV.fillStyle = this.options.labelColor;
		this.ctxV.font = '10px sans-serif';
		this.ctxV.lineWidth = 0.5;
		
		// Iterate through potential tick positions based on *content* coordinates
		const maxContentY = canvasHeightV / zoom; // Max content coordinate covered by canvas
		
		for (let i = 0; i <= maxContentY; i += tickMicro) {
			const drawY = i * zoom; // Position on the canvas
			let tickX = 0;
			
			const roundedI = Math.round(i / tickMicro) * tickMicro;
			
			if (roundedI % tickMajor === 0) {
				tickX = 0; // Major tick - full width
				if (this.options.showLabel && i > 0) {
					this.ctxV.save();
					this.ctxV.translate(rs - 2, drawY + 0.5); // Move origin for rotation
					this.ctxV.rotate(-Math.PI / 2);
					this.ctxV.textAlign = 'right'; // Align text before rotation point
					this.ctxV.textBaseline = 'middle';
					this.ctxV.fillText(`${roundedI}`, 0, 0);
					this.ctxV.restore();
				}
			} else if (roundedI % tickMinor === 0) {
				tickX = rs * 0.4; // Minor tick
			} else if (roundedI % tickMicro === 0) {
				tickX = rs * 0.7; // Micro tick
			} else {
				continue;
			}
			
			this.ctxV.beginPath();
			this.ctxV.moveTo(tickX, drawY + 0.5);
			this.ctxV.lineTo(rs, drawY + 0.5);
			this.ctxV.stroke();
		}
	}
	
	destroy() {
		// 1. Remove Listeners
		this.detachListeners();
		// 2. Remove Elements from DOM
		if (this.wrapper && this.wrapper.parentNode) {
			this.wrapper.parentNode.insertBefore(this.target, this.wrapper);
			this.wrapper.parentNode.removeChild(this.wrapper);
		}
		// 3. Reset Target Styles
		this.target.style.position = '';
		this.target.style.top = '';
		this.target.style.left = '';
		this.target.style.width = '';
		this.target.style.height = '';
		// 4. Nullify references
		this.target = null;
		this.options = null;
		this.wrapper = null;
		this.rulerH = null;
		this.rulerV = null;
		this.canvasH = null;
		this.canvasV = null;
		this.ctxH = null;
		this.ctxV = null;
		this.corner = null;
		this.indicatorH = null;
		this.indicatorV = null;
		this.resizeObserver = null;
	}
}

// --- Remove Example Usage from here ---
// It should be called from script.js
