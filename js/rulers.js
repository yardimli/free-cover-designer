/**
 * DivRulers Class
 * Adds interactive rulers (horizontal and vertical) to a target div element.
 *
 * @param {HTMLElement} targetElement - The div element to attach rulers to.
 * @param {object} [options] - Configuration options.
 * @param {string} [options.unit='px'] - Unit label to display (currently only affects label).
 * @param {number} [options.tickMajor=100] - Distance between major ticks (in pixels).
 * @param {number} [options.tickMinor=50] - Distance between minor ticks (in pixels).
 * @param {number} [options.tickMicro=10] - Distance between micro ticks (in pixels).
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
			tickMajor: 100,
			tickMinor: 50,
			tickMicro: 10,
			showLabel: true,
			arrowStyle: 'line', // 'line' or 'arrow' (arrow is basic triangle)
			rulerSize: 20,
			rulerBgColor: 'rgba(240, 240, 240, 0.9)',
			tickColor: '#888',
			labelColor: '#333',
			indicatorColor: 'red',
			...options // Override defaults with user options
		};
		
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
	
	handleScroll() {
		// Request animation frame for smoother updates during scroll
		window.requestAnimationFrame(() => {
			this.updateRulers();
			if (this.isMouseOver) {
				// Force indicator update relative to new scroll position if mouse hasn't moved
				// This requires storing the last mouse event, or recalculating based on stored relative pos
				// For simplicity, we'll just let the next mousemove handle the precise update.
				// If you need indicators to stick perfectly during scroll without mouse move,
				// you'd store the last relative mouseX/Y and update indicator position here too.
			}
		});
	}
	
	handleMouseMove(event) {
		this.isMouseOver = true;
		const wrapperRect = this.wrapper.getBoundingClientRect();
		const targetRect = this.target.getBoundingClientRect(); // Use target for content-relative coords
		
		// Mouse position relative to the wrapper top-left
		const mouseXWrapper = event.clientX - wrapperRect.left;
		const mouseYWrapper = event.clientY - wrapperRect.top;
		
		// Mouse position relative to the target's content area (including scrolled out part)
		// clientX/Y - targetScreenX/Y + scrollLeft/Top
		const mouseXContent = event.clientX - targetRect.left + this.target.scrollLeft;
		const mouseYContent = event.clientY - targetRect.top + this.target.scrollTop;
		
		// --- Update Horizontal Indicator ---
		// Position based on wrapper coordinates for visual placement on the ruler
		let indicatorHLeft = mouseXWrapper;
		// Clamp indicator position to the visible ruler area
		indicatorHLeft = Math.max(this.options.rulerSize, Math.min(wrapperRect.width, indicatorHLeft));
		
		this.indicatorH.style.left = indicatorHLeft + 'px';
		this.indicatorH.style.display = 'block';
		
		// --- Update Vertical Indicator ---
		// Position based on wrapper coordinates
		let indicatorVTop = mouseYWrapper;
		// Clamp indicator position
		indicatorVTop = Math.max(this.options.rulerSize, Math.min(wrapperRect.height, indicatorVTop));
		
		this.indicatorV.style.top = indicatorVTop + 'px';
		this.indicatorV.style.display = 'block';
		
		// --- Update Ruler Canvas if needed (e.g., for hover effects - not implemented here) ---
		// You could potentially redraw a small part of the canvas or add hover states here
		
	}
	
	handleMouseLeave() {
		this.isMouseOver = false;
		this.indicatorH.style.display = 'none';
		this.indicatorV.style.display = 'none';
		if (this.options.showLabel) {
			this.corner.textContent = ''; // Clear corner text
		}
	}
	
	handleResize() {
		// Update wrapper size to match target's potential new offsetWidth/Height
		// This is important if the target's size is controlled externally (e.g., flexbox, grid)
		this.wrapper.style.width = this.target.offsetWidth + this.options.rulerSize + 'px';
		this.wrapper.style.height = this.target.offsetHeight + this.options.rulerSize + 'px';
		
		// Recalculate and redraw rulers
		this.updateRulers();
	}
	
	updateRulers() {
		if (!this.ctxH || !this.ctxV || !this.target) return; // Not initialized or destroyed
		
		// Use clientWidth/Height for visible area size, scrollWidth/Height for total content size
		const scrollWidth = this.target.scrollWidth;
		const scrollHeight = this.target.scrollHeight;
		const scrollLeft = this.target.scrollLeft;
		const scrollTop = this.target.scrollTop;
		const rs = this.options.rulerSize;
		
		// --- Update Horizontal Ruler ---
		const dpr = window.devicePixelRatio || 1;
		// Ensure minimum canvas width matches the visible width if scrollWidth is smaller
		const canvasWidthH = Math.max(scrollWidth, this.target.clientWidth);
		this.canvasH.width = canvasWidthH * dpr;
		this.canvasH.height = rs * dpr;
		this.canvasH.style.width = canvasWidthH + 'px';
		this.canvasH.style.height = rs + 'px';
		this.ctxH.scale(dpr, dpr);
		
		// Position canvas based on scroll - Use transform for potentially better performance
		// this.canvasH.style.left = -scrollLeft + 'px'; // Old way
		this.canvasH.style.transform = `translateX(${-scrollLeft}px)`;
		
		
		// Clear and redraw H
		this.ctxH.clearRect(0, 0, canvasWidthH, rs); // Use scaled dimensions for clearing
		// Redraw background explicitly if needed (e.g., if ruler BG is transparent)
		// this.ctxH.fillStyle = this.options.rulerBgColor;
		// this.ctxH.fillRect(0, 0, canvasWidthH, rs);
		this.ctxH.strokeStyle = this.options.tickColor;
		this.ctxH.fillStyle = this.options.labelColor;
		this.ctxH.font = '10px sans-serif';
		this.ctxH.textBaseline = 'bottom';
		this.ctxH.lineWidth = 0.5; // Thinner lines often look better
		
		for (let i = 0; i <= canvasWidthH; i++) { // Iterate based on canvas width
			let tickY = 0; // Top position for major ticks
			if (i % this.options.tickMajor === 0) {
				tickY = 0;
				if (this.options.showLabel && i > 0) {
					this.ctxH.fillText(`${i}`, i + 2, rs - 2);
				}
			} else if (i % this.options.tickMinor === 0) {
				tickY = rs * 0.4;
			} else if (i % this.options.tickMicro === 0) {
				tickY = rs * 0.7;
			} else {
				continue; // Skip if not a tick position
			}
			this.ctxH.beginPath();
			this.ctxH.moveTo(i + 0.5, tickY); // +0.5 for sharp lines
			this.ctxH.lineTo(i + 0.5, rs);
			this.ctxH.stroke();
		}
		
		// --- Update Vertical Ruler ---
		// Ensure minimum canvas height matches the visible height if scrollHeight is smaller
		const canvasHeightV = Math.max(scrollHeight, this.target.clientHeight);
		this.canvasV.width = rs * dpr;
		this.canvasV.height = canvasHeightV * dpr;
		this.canvasV.style.width = rs + 'px';
		this.canvasV.style.height = canvasHeightV + 'px';
		this.ctxV.scale(dpr, dpr);
		
		// Position canvas based on scroll - Use transform
		// this.canvasV.style.top = -scrollTop + 'px'; // Old way
		this.canvasV.style.transform = `translateY(${-scrollTop}px)`;
		
		// Clear and redraw V
		this.ctxV.clearRect(0, 0, rs, canvasHeightV); // Use scaled dimensions
		// Redraw background explicitly if needed
		// this.ctxV.fillStyle = this.options.rulerBgColor;
		// this.ctxV.fillRect(0, 0, rs, canvasHeightV);
		this.ctxV.strokeStyle = this.options.tickColor;
		this.ctxV.fillStyle = this.options.labelColor;
		this.ctxV.font = '10px sans-serif';
		// No rotation needed if drawing lines horizontally then rotating text
		this.ctxV.lineWidth = 0.5; // Thinner lines
		
		for (let i = 0; i <= canvasHeightV; i++) { // Iterate based on canvas height
			let tickX = 0; // Left position for major ticks
			if (i % this.options.tickMajor === 0) {
				tickX = 0;
				if (this.options.showLabel && i > 0) {
					// Draw text vertically
					this.ctxV.save(); // Save context state
					this.ctxV.translate(rs - 2, i + 0.5); // Move origin for rotation (right edge, centered on tick)
					this.ctxV.rotate(-Math.PI / 2); // Rotate counter-clockwise
					this.ctxV.textAlign = 'center'; // Center text horizontally after rotation
					this.ctxV.textBaseline = 'middle'; // Center text vertically after rotation
					this.ctxV.fillText(`${i}`, 0, 0); // Draw text at the rotated origin
					this.ctxV.restore(); // Restore context state
				}
			} else if (i % this.options.tickMinor === 0) {
				tickX = rs * 0.4;
			} else if (i % this.options.tickMicro === 0) {
				tickX = rs * 0.7;
			} else {
				continue; // Skip if not a tick position
			}
			this.ctxV.beginPath();
			this.ctxV.moveTo(tickX, i + 0.5); // Draw horizontal line from tickX to right edge
			this.ctxV.lineTo(rs, i + 0.5);
			this.ctxV.stroke();
		}
	}
	destroy() {
		// 1. Remove Listeners
		this.detachListeners();
		
		// 2. Remove Elements from DOM
		if (this.wrapper && this.wrapper.parentNode) {
			// Move target element back out of the wrapper
			this.wrapper.parentNode.insertBefore(this.target, this.wrapper);
			// Remove the wrapper (which contains rulers, corner, canvas, indicators)
			this.wrapper.parentNode.removeChild(this.wrapper);
		}
		
		// 3. Reset Target Styles (remove styles added by the component)
		this.target.style.position = ''; // Or restore original if known
		this.target.style.top = '';
		this.target.style.left = '';
		this.target.style.width = '';
		this.target.style.height = '';
		
		// 4. Nullify references to help GC
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
		this.resizeObserver = null; // Already disconnected
	}
}

// --- Example Usage ---

// Get the div you want to add rulers to
const myDiv = document.getElementById('myScrollableDiv'); // Make sure this div exists in your HTML

if (myDiv) {
	// Example 1: Basic usage
	const rulers = new DivRulers(myDiv);
	
	// Example 2: With custom options
	/*
	const rulersWithOptions = new DivRulers(myDiv, {
			tickMajor: 50,
			tickMinor: 10,
			tickMicro: 5,
			rulerSize: 25,
			indicatorColor: 'blue',
			arrowStyle: 'arrow',
			showLabel: true
	});
	*/
	
	// To remove the rulers later:
	// rulers.destroy();
	// rulersWithOptions.destroy(); // if you used the second example
	
} else {
	console.error("Target div for rulers not found!");
}

// --- HTML Setup (for the example) ---
/*
<!DOCTYPE html>
<html>
<head>
<title>Div Rulers Example</title>
<style>
  body { margin: 50px; font-family: sans-serif; }
  #myScrollableDiv {
    width: 400px; /* Can be fixed or variable * /
height: 300px; /* Can be fixed or variable * /
overflow: auto; /* Crucial for scrolling * /
border: 1px solid #ccc; /* Just for visibility * /
background-color: #f0f0f0; /* Content background * /
/* position: relative; /* Not strictly needed anymore with wrapper * /
}
.content {
	width: 800px; /* Content wider than div * /
	height: 600px; /* Content taller than div * /
	background-image: linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%);
	background-size: 20px 20px;
	background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
	padding: 10px;
	box-sizing: border-box;
}
</style>
</head>
<body>

<h1>Div with Rulers</h1>

<div id="myScrollableDiv">
	<div class="content">
		Scroll me! <br>
		Lots of content here to make the div scrollable horizontally and vertically.
		<br>...<br>...<br>...<br>...<br>...<br>...<br>...<br>...<br>...<br>...<br>...<br>...
			<br>...<br>...<br>...<br>...<br>...<br>...<br>...<br>...<br>...<br>...<br>...<br>...
				<span style="margin-left: 600px;">Far Right Content</span>
	</div>
</div>

<script src="DivRulers.js"></script> <!- Assuming you save the class in this file ->

</body>
</html>
*/
