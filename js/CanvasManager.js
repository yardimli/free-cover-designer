class CanvasManager {
	constructor($canvasArea, $canvasWrapper, $canvas, options) {
		this.$canvasArea = $canvasArea;
		this.$canvasWrapper = $canvasWrapper;
		this.$canvas = $canvas;
		this.canvasAreaDiv = $canvasArea[0]; // Keep reference to the DOM element
		
		// Dependencies
		this.layerManager = options.layerManager;
		this.historyManager = options.historyManager;
		this.onZoomChange = options.onZoomChange || (() => {}); // Callback for UI updates
		
		// State
		this.rulers = null;
		this.currentZoom = 1.0;
		this.MIN_ZOOM = 0.1;
		this.MAX_ZOOM = 3.0;
		this.isPanning = false;
		this.lastPanX = 0;
		this.lastPanY = 0;
	}
	
	initialize() {
		this.initializeRulers();
		this.initializeDroppable();
		this.initializeZoomPan();
		this.centerCanvas();
		this.setZoom(this.currentZoom, false); // Apply initial zoom without saving state
	}
	
	initializeRulers() {
		if (this.canvasAreaDiv && typeof DivRulers !== 'undefined') {
			this.rulers = new DivRulers(this.canvasAreaDiv, {
				rulerSize: 25,
				tickMajor: 50,
				tickMinor: 10,
				tickMicro: 5,
				indicatorColor: 'rgba(0, 100, 255, 0.8)',
				arrowStyle: 'line',
				showLabel: true
			});
		} else {
			console.error("Canvas area element not found or DivRulers class not loaded.");
		}
	}
	
	initializeDroppable() {
		this.$canvas.droppable({
			accept: '.layout-thumbnail, .cover-thumbnail, .element-thumbnail',
			drop: (event, ui) => {
				const $draggedItem = $(ui.draggable);
				const dropPosition = this._calculateDropPosition(event, ui);
				
				if ($draggedItem.hasClass('layout-thumbnail')) {
					const layoutData = $draggedItem.data('layoutData');
					layoutData.forEach(layerData => {
						// Adjust position relative to drop point? Or just add at defined coords?
						// Adding at defined coords for now:
						this.layerManager.addLayer(layerData.type, layerData);
					});
				} else if ($draggedItem.hasClass('cover-thumbnail')) {
					const imgSrc = $draggedItem.data('coverSrc');
					const imgWidth = 200; const imgHeight = 300;
					const newLayer = this.layerManager.addLayer('image', {
						content: imgSrc,
						x: dropPosition.x - (imgWidth / 2),
						y: dropPosition.y - (imgHeight / 2),
						width: imgWidth, height: imgHeight
					});
					if (newLayer) {
						this.layerManager.moveLayer(newLayer.id, 'back'); // Send background images back
					}
				} else if ($draggedItem.hasClass('element-thumbnail')) {
					const imgSrc = $draggedItem.data('elementSrc');
					const elemWidth = 100; const elemHeight = 100;
					this.layerManager.addLayer('image', {
						content: imgSrc,
						x: dropPosition.x - (elemWidth / 2),
						y: dropPosition.y - (elemHeight / 2),
						width: elemWidth, height: elemHeight
					});
				}
				// LayerManager.addLayer calls updateList, but we need to save state
				this.historyManager.saveState();
			}
		});
	}
	
	_calculateDropPosition(event, ui) {
		// Calculate drop position relative to the UNZOOMED canvas origin
		const canvasOffset = this.$canvasWrapper.offset(); // Use wrapper offset relative to document
		const areaScrollLeft = this.$canvasArea.scrollLeft();
		const areaScrollTop = this.$canvasArea.scrollTop();
		
		// Use event.clientX/Y for drop coords relative to viewport
		const areaRect = this.canvasAreaDiv.getBoundingClientRect();
		const mouseXInArea = event.clientX - areaRect.left;
		const mouseYInArea = event.clientY - areaRect.top;
		
		// Position relative to the scrolled content of canvas-area
		const scrolledAreaX = mouseXInArea + areaScrollLeft;
		const scrolledAreaY = mouseYInArea + areaScrollTop;
		
		// Position relative to the canvas wrapper's origin (which might be offset within canvas-area)
		const wrapperPos = this.$canvasWrapper.position(); // Position relative to canvas-area
		const relativeToWrapperX = scrolledAreaX - wrapperPos.left;
		const relativeToWrapperY = scrolledAreaY - wrapperPos.top;
		
		// Account for zoom to get coordinates relative to the unscaled canvas (0,0)
		const dropX = relativeToWrapperX / this.currentZoom;
		const dropY = relativeToWrapperY / this.currentZoom;
		
		return { x: dropX, y: dropY };
	}
	
	initializeZoomPan() {
		// Panning
		this.$canvasArea.on('mousedown', (e) => {
			if (e.target === this.$canvasArea[0]) { // Click on background
				this.isPanning = true;
				this.lastPanX = e.clientX;
				this.lastPanY = e.clientY;
				this.$canvasArea.addClass('panning');
				e.preventDefault();
				this.layerManager.selectLayer(null); // Deselect on background click
			} else if (e.target === this.$canvasWrapper[0]) { // Click on wrapper (between canvas and area edge)
				this.layerManager.selectLayer(null);
			}
		});
		
		$(document).on('mousemove', (e) => {
			if (!this.isPanning) return;
			const deltaX = e.clientX - this.lastPanX;
			const deltaY = e.clientY - this.lastPanY;
			this.$canvasArea.scrollLeft(this.$canvasArea.scrollLeft() - deltaX);
			this.$canvasArea.scrollTop(this.$canvasArea.scrollTop() - deltaY);
			this.lastPanX = e.clientX;
			this.lastPanY = e.clientY;
			// Rulers update via their own scroll handler
		});
		
		$(document).on('mouseup', (e) => {
			if (this.isPanning) {
				this.isPanning = false;
				this.$canvasArea.removeClass('panning');
			}
		});
		
		// Zooming (Wheel)
		this.$canvasArea.on('wheel', (e) => {
			e.preventDefault();
			const delta = e.originalEvent.deltaY;
			const zoomFactor = delta < 0 ? 1.1 : 0.9;
			
			const areaRect = this.canvasAreaDiv.getBoundingClientRect();
			const mouseX = e.clientX - areaRect.left;
			const mouseY = e.clientY - areaRect.top;
			const mouseXInContent = this.$canvasArea.scrollLeft() + mouseX;
			const mouseYInContent = this.$canvasArea.scrollTop() + mouseY;
			const wrapperPos = this.$canvasWrapper.position();
			const mouseRelativeToWrapperX = mouseXInContent - wrapperPos.left;
			const mouseRelativeToWrapperY = mouseYInContent - wrapperPos.top;
			const mouseOnCanvasX = mouseRelativeToWrapperX / this.currentZoom;
			const mouseOnCanvasY = mouseRelativeToWrapperY / this.currentZoom;
			
			const oldZoom = this.currentZoom;
			const newZoom = this.currentZoom * zoomFactor;
			const clampedZoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, newZoom));
			
			if (clampedZoom !== oldZoom) {
				this.setZoom(clampedZoom, false); // Apply zoom first
				
				// Recalculate scroll to keep mouse point stationary
				const newMouseRelativeToWrapperX = mouseOnCanvasX * this.currentZoom;
				const newMouseRelativeToWrapperY = mouseOnCanvasY * this.currentZoom;
				// Need the *new* wrapper position if it changed due to zoom (it shouldn't if positioned absolutely)
				const currentWrapperPos = this.$canvasWrapper.position(); // Get potentially updated pos
				
				const newScrollLeft = (currentWrapperPos.left + newMouseRelativeToWrapperX) - mouseX;
				const newScrollTop = (currentWrapperPos.top + newMouseRelativeToWrapperY) - mouseY;
				
				this.$canvasArea.scrollLeft(newScrollLeft);
				this.$canvasArea.scrollTop(newScrollTop);
			}
		});
		
		// Zoom Buttons
		$('#zoom-in').on('click', () => this.zoom(1.25));
		$('#zoom-out').on('click', () => this.zoom(0.8));
	}
	
	zoom(factor) {
		this.setZoom(this.currentZoom * factor);
	}
	
	setZoom(newZoom, triggerCallbacks = true) {
		const clampedZoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, newZoom));
		if (clampedZoom === this.currentZoom) return;
		
		this.currentZoom = clampedZoom;
		
		// Apply scale transform to the canvas itself
		this.$canvas.css('transform', `scale(${this.currentZoom})`);
		
		// Adjust the wrapper's size to reflect the scaled canvas size
		const originalCanvasWidth = parseFloat(this.$canvas.css('width'));
		const originalCanvasHeight = parseFloat(this.$canvas.css('height'));
		this.$canvasWrapper.css({
			width: originalCanvasWidth * this.currentZoom + 'px',
			height: originalCanvasHeight * this.currentZoom + 'px'
		});
		
		// Inform the rulers
		if (this.rulers) {
			this.rulers.setZoom(this.currentZoom);
		}
		
		// Update UI (via callback)
		if(triggerCallbacks) {
			this.onZoomChange(this.currentZoom, this.MIN_ZOOM, this.MAX_ZOOM);
		}
	}
	
	centerCanvas() {
		// Wait for potential layout shifts after zoom/load
		requestAnimationFrame(() => {
			const areaWidth = this.$canvasArea.width();
			const areaHeight = this.$canvasArea.height();
			const wrapperWidth = this.$canvasWrapper.outerWidth();
			const wrapperHeight = this.$canvasWrapper.outerHeight();
			
			const scrollLeft = (wrapperWidth - areaWidth) / 2;
			const scrollTop = (wrapperHeight - areaHeight) / 2;
			
			this.$canvasArea.scrollLeft(scrollLeft > 0 ? scrollLeft : 0);
			this.$canvasArea.scrollTop(scrollTop > 0 ? scrollTop : 0);
			
			// Rulers need update after scroll changes
			if (this.rulers) {
				this.rulers.updateRulers();
			}
		});
	}
	
	// --- Export ---
	exportCanvas(format = 'png') {
		this.layerManager.selectLayer(null); // Deselect elements
		
		// Store original state
		const originalTransform = this.$canvas.css('transform');
		const originalWrapperWidth = this.$canvasWrapper.css('width');
		const originalWrapperHeight = this.$canvasWrapper.css('height');
		const originalScrollLeft = this.$canvasArea.scrollLeft();
		const originalScrollTop = this.$canvasArea.scrollTop();
		
		// Temporarily reset zoom and scroll
		this.$canvas.css('transform', 'scale(1.0)');
		const canvasWidth = this.$canvas.css('width');
		const canvasHeight = this.$canvas.css('height');
		this.$canvasWrapper.css({ width: canvasWidth, height: canvasHeight });
		
		// Scroll canvas-area so the top-left of the canvas is visible
		const wrapperPos = this.$canvasWrapper.position();
		this.$canvasArea.scrollLeft(wrapperPos.left);
		this.$canvasArea.scrollTop(wrapperPos.top);
		
		// Temporarily make all layers visible
		const hiddenLayerIds = this.layerManager.getLayers().filter(l => !l.visible).map(l => l.id);
		hiddenLayerIds.forEach(id => $(`#${id}`).show());
		
		const canvasElement = this.$canvas[0];
		const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
		const quality = format === 'jpeg' ? 0.9 : 1.0;
		const filename = `book-cover.${format}`;
		
		setTimeout(() => {
			html2canvas(canvasElement, {
				useCORS: true,
				allowTaint: true,
				logging: false,
				scale: 1, // Use native resolution
				x: 0, y: 0,
				width: this.$canvas.width(),
				height: this.$canvas.height(),
				scrollX: 0, scrollY: 0,
				onclone: (clonedDoc) => {
					// Ensure elements are truly visible in the clone
					hiddenLayerIds.forEach(id => {
						const el = clonedDoc.getElementById(id);
						if (el) el.style.display = 'block';
					});
					// Ensure the canvas itself has no transform in the clone
					const clonedCanvas = clonedDoc.getElementById('canvas');
					if (clonedCanvas) {
						clonedCanvas.style.transform = 'scale(1.0)';
					}
				}
			}).then(canvas => {
				const image = canvas.toDataURL(mimeType, quality);
				const a = document.createElement('a');
				a.href = image;
				a.download = filename;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
			}).catch(err => {
				console.error("Error exporting canvas:", err);
				alert("Error exporting canvas. Check console for details.");
			}).finally(() => {
				// Restore original state
				hiddenLayerIds.forEach(id => $(`#${id}`).hide());
				this.$canvas.css('transform', originalTransform);
				this.$canvasWrapper.css({ width: originalWrapperWidth, height: originalWrapperHeight });
				this.$canvasArea.scrollLeft(originalScrollLeft);
				this.$canvasArea.scrollTop(originalScrollTop);
			});
		}, 150); // Delay for rendering
	}
	
	// --- Save / Load Design ---
	saveDesign() {
		const designData = {
			version: "1.0",
			layers: this.layerManager.getLayers(),
			canvas: {
				width: parseFloat(this.$canvas.css('width')),
				height: parseFloat(this.$canvas.css('height'))
			}
		};
		const jsonData = JSON.stringify(designData, null, 2);
		const blob = new Blob([jsonData], {type: 'application/json'});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'book-cover-design.json';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
	
	loadDesign(file) {
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const designData = JSON.parse(e.target.result);
				if (designData && designData.layers) {
					// Clear current state via LayerManager and HistoryManager
					this.historyManager.clear(); // Reset history
					
					// Optional: Adjust canvas size if saved
					if (designData.canvas) {
						const originalCanvasWidth = designData.canvas.width;
						const originalCanvasHeight = designData.canvas.height;
						this.$canvas.css({ width: originalCanvasWidth + 'px', height: originalCanvasHeight + 'px' });
						// Trigger zoom update to resize wrapper correctly
						this.setZoom(this.currentZoom, true);
					}
					
					// Load layers using LayerManager
					this.layerManager.setLayers(designData.layers); // This handles clearing canvas, rendering, updating list
					
					this.historyManager.saveState(); // Save the loaded state as the initial history point
					this.centerCanvas();
					alert('Design loaded successfully!');
				} else {
					alert('Invalid design file format.');
				}
			} catch (error) {
				console.error("Error loading design:", error);
				alert('Error reading or parsing the design file.');
			}
		};
		reader.onerror = () => {
			alert('Error reading file.');
		};
		reader.readAsText(file);
	}
}
