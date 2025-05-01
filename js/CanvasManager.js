class CanvasManager {
	constructor($canvasArea, $canvasWrapper, $canvas, options) {
		this.$canvasArea = $canvasArea;
		this.$canvasWrapper = $canvasWrapper;
		this.$canvas = $canvas;
		this.canvasAreaDiv = $canvasArea[0]; // Keep reference to the DOM element
		
		// Dependencies
		this.layerManager = options.layerManager;
		this.historyManager = options.historyManager;
		this.onZoomChange = options.onZoomChange || (() => {
		}); // Callback for UI updates
		
		// State
		this.rulers = null;
		this.currentZoom = 0.3;
		this.MIN_ZOOM = 0.1; // Min zoom level
		this.MAX_ZOOM = 5.0; // Max zoom level
		this.isPanning = false;
		this.lastPanX = 0;
		this.lastPanY = 0;
		
		// Default Canvas Size (can be overridden by loaded designs/templates)
		this.DEFAULT_CANVAS_WIDTH = 1540;
		this.DEFAULT_CANVAS_HEIGHT = 2475;
	}
	
	initialize() {
		this.setCanvasSize(this.DEFAULT_CANVAS_WIDTH, this.DEFAULT_CANVAS_HEIGHT); // Set initial size
		this.initializeRulers();
		this.initializeDroppable();
		this.initializeZoomPan();
		this.centerCanvas();
		this.setZoom(this.currentZoom, true); // Apply initial zoom and trigger UI update
		this.zoom(1);
		
	}
	
	setCanvasSize(width, height) {
		this.currentCanvasWidth = parseFloat(width) || this.DEFAULT_CANVAS_WIDTH;
		this.currentCanvasHeight = parseFloat(height) || this.DEFAULT_CANVAS_HEIGHT;
		
		this.$canvas.css({
			width: this.currentCanvasWidth + 'px',
			height: this.currentCanvasHeight + 'px'
		});
		
		// Update wrapper size immediately based on *current* zoom
		this.updateWrapperSize();
		// Recenter after size change
		this.centerCanvas();
		// Update rulers if they exist
		if (this.rulers) {
			this.rulers.updateRulers();
		}
	}
	
	updateWrapperSize() {
		// Adjust the wrapper's size to reflect the scaled canvas size
		this.$canvasWrapper.css({
			width: this.currentCanvasWidth * this.currentZoom + 'px',
			height: this.currentCanvasHeight * this.currentZoom + 'px'
		});
	}
	
	
	initializeRulers() {
		// Ensure rulers are initialized *after* the wrapper structure is set up
		if (this.canvasAreaDiv && typeof DivRulers !== 'undefined') {
			// Destroy existing rulers if any
			if (this.rulers) {
				this.rulers.destroy();
			}
			// Pass the canvas-area div as the target for rulers
			this.rulers = new DivRulers(this.canvasAreaDiv, {
				rulerSize: 25,
				tickMajor: 100, // Based on unzoomed canvas pixels
				tickMinor: 50,
				tickMicro: 10,
				indicatorColor: 'rgba(0, 100, 255, 0.8)',
				arrowStyle: 'line',
				showLabel: true,
				labelColor: '#333',
				tickColor: '#888',
				rulerBgColor: 'rgba(240, 240, 240, 0.95)'
			});
			// Set initial zoom for rulers
			this.rulers.setZoom(this.currentZoom);
		} else {
			console.error("Canvas area element not found or DivRulers class not loaded.");
		}
	}
	
	initializeDroppable() {
		this.$canvas.droppable({
			// Accept items from sidebar: templates, covers, elements
			accept: '.template-thumbnail, .cover-thumbnail, .element-thumbnail',
			tolerance: 'pointer', // Drop when pointer overlaps canvas
			drop: (event, ui) => {
				const $draggedItem = $(ui.draggable);
				const dropPosition = this._calculateDropPosition(event, ui); // Calculate drop coords relative to canvas 0,0
				
				if ($draggedItem.hasClass('template-thumbnail')) {
					const jsonPath = $draggedItem.data('templateJsonPath');
					if (jsonPath) {
						this.loadDesign(jsonPath, true); // Load from path, indicate it's a template
					}
				} else if ($draggedItem.hasClass('cover-thumbnail')) {
					const imgSrc = $draggedItem.data('coverSrc');
					if (!imgSrc) return;
					
					// Add image as a layer, positioned at (0,0)
					const img = new Image();
					img.onload = () => {
						// Scale image to fit reasonably, maintain aspect ratio (optional, keep for now)
						const maxDim = Math.min(this.currentCanvasWidth * 0.6, this.currentCanvasHeight * 0.6);
						const scale = Math.min(1, maxDim / img.width, maxDim / img.height);
						const imgWidth = img.width * scale;
						const imgHeight = img.height * scale;
						
						// --- MODIFICATION START ---
						// Set position to 0, 0 instead of centering at drop point
						const newLayer = this.layerManager.addLayer('image', {
							content: imgSrc,
							x: 0, // Set X to 0
							y: 0, // Set Y to 0
							width: imgWidth, // Keep scaled width for now
							height: imgHeight // Keep scaled height for now
							// Consider setting width/height to canvas dimensions if it should fill
							// width: this.currentCanvasWidth,
							// height: this.currentCanvasHeight
						});
						// --- MODIFICATION END ---
						
						if (newLayer) {
							// Send background images to the back by default
							this.layerManager.moveLayer(newLayer.id, 'back');
							this.historyManager.saveState(); // Save state after adding and moving
						}
					};
					img.onerror = () => console.error("Failed to load cover image for dropping:", imgSrc);
					img.src = imgSrc;
					
				} else if ($draggedItem.hasClass('element-thumbnail')) {
					const imgSrc = $draggedItem.data('elementSrc');
					if (!imgSrc) return;
					
					// Add element image, centered at drop point (Keep this behavior for elements)
					const img = new Image();
					img.onload = () => {
						// Default size for elements, maybe smaller
						const elemWidth = Math.min(img.width, 100); // Use actual width up to 100px
						const elemHeight = (img.height / img.width) * elemWidth; // Maintain aspect ratio
						
						this.layerManager.addLayer('image', {
							content: imgSrc,
							x: dropPosition.x - (elemWidth / 2), // Center X
							y: dropPosition.y - (elemHeight / 2), // Center Y
							width: elemWidth,
							height: elemHeight
						});
						this.historyManager.saveState(); // Save state after adding element
					};
					img.onerror = () => console.error("Failed to load element image for dropping:", imgSrc);
					img.src = imgSrc;
				}
			}
		});
	}
	
	_calculateDropPosition(event, ui) {
		// Calculate drop position relative to the UNZOOMED canvas origin (0,0)
		
		// 1. Get mouse coordinates relative to the viewport
		const mouseXViewport = event.clientX;
		const mouseYViewport = event.clientY;
		
		// 2. Get the bounding box of the scrollable canvas area
		const areaRect = this.canvasAreaDiv.getBoundingClientRect();
		
		// 3. Calculate mouse position relative to the canvas area's top-left corner
		const mouseXInArea = mouseXViewport - areaRect.left;
		const mouseYInArea = mouseYViewport - areaRect.top;
		
		// 4. Account for the canvas area's scroll position
		const scrollLeft = this.$canvasArea.scrollLeft();
		const scrollTop = this.$canvasArea.scrollTop();
		const mouseXInScrollContent = mouseXInArea + scrollLeft;
		const mouseYInScrollContent = mouseYInArea + scrollTop;
		
		// 5. Get the position of the canvas WRAPPER relative to the scrolled content of canvas area
		//    We use the wrapper because it's the element being positioned/centered.
		const wrapperPos = this.$canvasWrapper.position(); // { top: ..., left: ... } relative to offset parent (canvas-area)
		
		// 6. Calculate mouse position relative to the wrapper's top-left corner
		const relativeToWrapperX = mouseXInScrollContent - wrapperPos.left;
		const relativeToWrapperY = mouseYInScrollContent - wrapperPos.top;
		
		// 7. Account for the current zoom level to get coordinates relative to the unscaled canvas (0,0)
		const dropX = relativeToWrapperX / this.currentZoom;
		const dropY = relativeToWrapperY / this.currentZoom;
		
		// console.log(`Drop Coords: CanvasX=${dropX.toFixed(2)}, CanvasY=${dropY.toFixed(2)}`);
		return {x: dropX, y: dropY};
	}
	
	
	initializeZoomPan() {
		// --- Panning ---
		this.$canvasArea.on('mousedown', (e) => {
			// Only pan if clicking directly on the background of canvas-area
			// Or use middle mouse button? (e.which === 2)
			if (e.target === this.$canvasArea[0] || e.target === this.$canvasWrapper[0]) {
				this.isPanning = true;
				this.lastPanX = e.clientX;
				this.lastPanY = e.clientY;
				this.$canvasArea.addClass('panning');
				e.preventDefault(); // Prevent text selection during pan
				
				// Deselect layer if clicking background
				if (this.layerManager.getSelectedLayer()) {
					this.layerManager.selectLayer(null);
				}
			}
		});
		
		$(document).on('mousemove.canvasManager', (e) => { // Add namespace for easy removal
			if (!this.isPanning) return;
			
			const deltaX = e.clientX - this.lastPanX;
			const deltaY = e.clientY - this.lastPanY;
			
			// Scroll the canvas area
			this.$canvasArea.scrollLeft(this.$canvasArea.scrollLeft() - deltaX);
			this.$canvasArea.scrollTop(this.$canvasArea.scrollTop() - deltaY);
			
			// Update last position for next movement
			this.lastPanX = e.clientX;
			this.lastPanY = e.clientY;
			
			// Rulers update automatically via their own scroll handler
		});
		
		$(document).on('mouseup.canvasManager mouseleave.canvasManager', (e) => { // Add namespace
			if (this.isPanning) {
				this.isPanning = false;
				this.$canvasArea.removeClass('panning');
			}
		});
		
		// --- Zooming (Mouse Wheel) ---
		this.$canvasArea.on('wheel', (e) => {
			e.preventDefault(); // Prevent page scroll
			
			const delta = e.originalEvent.deltaY;
			const zoomFactor = delta < 0 ? 1.1 : (1 / 1.1); // Consistent zoom steps
			
			// Calculate mouse position relative to the canvas content (like in drop)
			const areaRect = this.canvasAreaDiv.getBoundingClientRect();
			const mouseX = e.clientX - areaRect.left;
			const mouseY = e.clientY - areaRect.top;
			const scrollLeft = this.$canvasArea.scrollLeft();
			const scrollTop = this.$canvasArea.scrollTop();
			const wrapperPos = this.$canvasWrapper.position();
			
			// Mouse position relative to the unscaled canvas origin
			const mouseOnCanvasX = (scrollLeft + mouseX - wrapperPos.left) / this.currentZoom;
			const mouseOnCanvasY = (scrollTop + mouseY - wrapperPos.top) / this.currentZoom;
			
			// Calculate new zoom level
			const newZoom = this.currentZoom * zoomFactor;
			const clampedZoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, newZoom));
			
			if (clampedZoom !== this.currentZoom) {
				const oldZoom = this.currentZoom;
				this.currentZoom = clampedZoom; // Update internal zoom state
				
				// Apply scale transform to the canvas itself
				this.$canvas.css('transform', `scale(${this.currentZoom})`);
				// Update wrapper size for the new zoom level
				this.updateWrapperSize();
				
				// Calculate the new scroll position to keep the mouse pointer
				// over the same point on the unscaled canvas.
				// New position of the mouse point relative to the wrapper's top-left
				const newWrapperOffsetX = mouseOnCanvasX * this.currentZoom;
				const newWrapperOffsetY = mouseOnCanvasY * this.currentZoom;
				
				// Get the potentially updated wrapper position (it might shift slightly if centering logic runs)
				const currentWrapperPos = this.$canvasWrapper.position();
				
				// Calculate required scroll offset
				const newScrollLeft = (currentWrapperPos.left + newWrapperOffsetX) - mouseX;
				const newScrollTop = (currentWrapperPos.top + newWrapperOffsetY) - mouseY;
				
				// Apply the new scroll position
				this.$canvasArea.scrollLeft(newScrollLeft);
				this.$canvasArea.scrollTop(newScrollTop);
				
				// Update rulers and UI
				if (this.rulers) {
					this.rulers.setZoom(this.currentZoom);
					this.rulers.updateRulers(); // Force redraw after scroll/zoom
				}
				this.onZoomChange(this.currentZoom, this.MIN_ZOOM, this.MAX_ZOOM);
			}
		});
		
		// --- Zoom Buttons ---
		$('#zoom-in').on('click', () => this.zoom(1.25)); // Zoom in by 25%
		$('#zoom-out').on('click', () => this.zoom(0.8)); // Zoom out (1 / 1.25)
	}
	
	// Zooms towards the center of the visible area
	zoom(factor) {
		// Calculate center point of the visible canvas area
		const areaWidth = this.$canvasArea.innerWidth();
		const areaHeight = this.$canvasArea.innerHeight();
		const centerX = areaWidth / 2;
		const centerY = areaHeight / 2;
		
		// Simulate a wheel event at the center
		const fakeEvent = {
			preventDefault: () => {
			},
			originalEvent: {deltaY: factor > 1 ? -1 : 1}, // Negative delta for zoom in
			clientX: this.$canvasArea.offset().left + centerX,
			clientY: this.$canvasArea.offset().top + centerY
		};
		this.$canvasArea.trigger($.Event('wheel', fakeEvent));
	}
	
	// Sets zoom level directly (used internally and potentially externally)
	setZoom(newZoom, triggerCallbacks = true) {
		const clampedZoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, newZoom));
		if (clampedZoom === this.currentZoom) return;
		
		this.currentZoom = clampedZoom;
		
		// Apply scale transform to the canvas
		this.$canvas.css('transform', `scale(${this.currentZoom})`);
		// Adjust the wrapper's size
		this.updateWrapperSize();
		
		// Recenter canvas within the view after zoom might have shifted wrapper
		//this.centerCanvas(); // This also updates rulers
		
		// Update UI (via callback)
		if (triggerCallbacks) {
			this.onZoomChange(this.currentZoom, this.MIN_ZOOM, this.MAX_ZOOM);
		}
		// Update rulers zoom factor
		if (this.rulers) {
			this.rulers.setZoom(this.currentZoom);
		}
	}
	
	centerCanvas() {
		// Use requestAnimationFrame to ensure layout calculations are up-to-date
		requestAnimationFrame(() => {
			const areaWidth = this.$canvasArea.innerWidth(); // Use innerWidth for visible area
			const areaHeight = this.$canvasArea.innerHeight();
			const wrapperWidth = this.$canvasWrapper.outerWidth(); // Use outerWidth including padding/border
			const wrapperHeight = this.$canvasWrapper.outerHeight();
			
			// Calculate desired scroll position to center the wrapper
			let scrollLeft = (wrapperWidth - areaWidth) / 2;
			let scrollTop = (wrapperHeight - areaHeight) / 2;
			
			// Ensure scroll position isn't negative
			scrollLeft = Math.max(0, scrollLeft);
			scrollTop = Math.max(0, scrollTop);
			
			// Apply the scroll position
			this.$canvasArea.scrollLeft(scrollLeft);
			this.$canvasArea.scrollTop(scrollTop);
			
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
		
		// Temporarily reset zoom and scroll for accurate capture
		this.$canvas.css('transform', 'scale(1.0)');
		this.$canvasWrapper.css({
			width: this.currentCanvasWidth + 'px', // Use stored unscaled width
			height: this.currentCanvasHeight + 'px' // Use stored unscaled height
		});
		
		// Scroll canvas-area so the top-left of the canvas is visible
		// Need position relative to document or viewport? Let's try relative to area.
		const wrapperPos = this.$canvasWrapper.position(); // Position relative to canvas-area
		this.$canvasArea.scrollLeft(wrapperPos.left);
		this.$canvasArea.scrollTop(wrapperPos.top);
		
		// Temporarily make all layers visible for export
		const hiddenLayerIds = this.layerManager.getLayers().filter(l => !l.visible).map(l => l.id);
		hiddenLayerIds.forEach(id => $(`#${id}`).show()); // Simple show for export
		
		const canvasElement = this.$canvas[0];
		const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
		const quality = format === 'jpeg' ? 0.92 : 1.0; // Standard JPEG quality
		const filename = `book-cover-export.${format}`;
		
		// Use setTimeout to allow the browser to re-render after style changes
		setTimeout(() => {
			html2canvas(canvasElement, {
				useCORS: true,      // Attempt to load cross-origin images
				allowTaint: true,   // Allows tainting canvas for cross-origin images (may prevent toDataURL) - useCORS is better
				logging: false,     // Disable console logging from html2canvas
				scale: 1,           // Export at native resolution (canvas size)
				width: this.currentCanvasWidth, // Explicitly set width
				height: this.currentCanvasHeight, // Explicitly set height
				x: 0,               // Capture from top-left of the element
				y: 0,
				scrollX: 0,         // Ignore internal scroll of the element itself
				scrollY: 0,
				backgroundColor: '#ffffff', // Ensure background is white if canvas is transparent
				onclone: (clonedDoc) => {
					// --- Modifications to the cloned document before rendering ---
					const clonedCanvas = clonedDoc.getElementById('canvas');
					if (clonedCanvas) {
						// Ensure no transform on the cloned canvas
						clonedCanvas.style.transform = 'scale(1.0)';
						// Remove selection borders from the clone
						const selectedElements = clonedCanvas.querySelectorAll('.canvas-element.selected');
						selectedElements.forEach(el => el.classList.remove('selected'));
						// Ensure hidden layers are visible in the clone
						hiddenLayerIds.forEach(id => {
							const el = clonedCanvas.querySelector(`#${id}`);
							if (el) el.style.display = 'block'; // Or appropriate display type
						});
						// Remove jQuery UI resizable handles from the clone
						const handles = clonedCanvas.querySelectorAll('.ui-resizable-handle');
						handles.forEach(h => h.style.display = 'none');
					}
				}
			}).then(canvas => {
				// Convert the rendered canvas to a data URL
				const image = canvas.toDataURL(mimeType, quality);
				
				// Trigger download
				const a = document.createElement('a');
				a.href = image;
				a.download = filename;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				
			}).catch(err => {
				console.error("Error exporting canvas:", err);
				alert("Error exporting canvas. Check console for details. Cross-origin images might be the cause if not hosted locally.");
			}).finally(() => {
				// --- Restore original state ---
				hiddenLayerIds.forEach(id => {
					const layer = this.layerManager.getLayerById(id);
					if (layer && !layer.visible) $(`#${id}`).hide(); // Hide again if originally hidden
				});
				this.$canvas.css('transform', originalTransform);
				this.$canvasWrapper.css({
					width: originalWrapperWidth,
					height: originalWrapperHeight
				});
				this.$canvasArea.scrollLeft(originalScrollLeft);
				this.$canvasArea.scrollTop(originalScrollTop);
				// Re-apply selection border if needed
				if (this.layerManager.getSelectedLayer()) {
					$(`#${this.layerManager.getSelectedLayer().id}`).addClass('selected');
				}
			});
		}, 250); // Increased delay slightly for complex rendering
	}
	
	// --- Save / Load Design ---
	
	// Saves the current design (canvas size and layers) to a JSON file
	saveDesign() {
		const designData = {
			version: "1.1", // Update version if format changes
			canvas: {
				width: this.currentCanvasWidth,
				height: this.currentCanvasHeight
			},
			layers: this.layerManager.getLayers() // Get layers in the correct format
		};
		
		const jsonData = JSON.stringify(designData, null, 2); // Pretty print JSON
		const blob = new Blob([jsonData], {type: 'application/json'});
		const url = URL.createObjectURL(blob);
		
		const a = document.createElement('a');
		a.href = url;
		a.download = 'book-cover-design.json';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url); // Clean up blob URL
	}
	
	// Loads a design from a file object or a URL path
	loadDesign(source, isTemplate = false) {
		if (!source) return;
		
		const handleLoad = (designData) => {
			try {
				if (designData && designData.layers && designData.canvas) {
					if (!isTemplate) {
						// --- Clear current state ---
						this.historyManager.clear(); // Reset history
						
						// --- Set Canvas Size ---
						this.setCanvasSize(designData.canvas.width, designData.canvas.height);
					}
					
					// --- Load Layers ---
					// LayerManager.setLayers handles clearing canvas, rendering, updating list
					this.layerManager.setLayers(designData.layers, isTemplate);
					
					// --- Finalize ---
					this.historyManager.saveState(); // Save the loaded state as the initial history point
					if (!isTemplate) {
						this.setZoom(1.0); // Reset zoom to 100%
						this.centerCanvas(); // Center the newly loaded canvas
					}
					// alert(`Design ${isTemplate ? 'template' : ''} loaded successfully!`);
					
				} else {
					console.error("Invalid design data structure:", designData);
					alert('Invalid design file format. Check console for details.');
				}
			} catch (error) {
				console.error("Error processing loaded design:", error);
				alert('Error applying the design data.');
			}
		};
		
		const handleError = (error) => {
			console.error("Error loading design:", error);
			alert('Error reading or fetching the design file.');
		};
		
		// Check if source is a File object (from input) or a string (path for template)
		if (source instanceof File) {
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const designData = JSON.parse(e.target.result);
					handleLoad(designData);
				} catch (parseError) {
					handleError(parseError);
				}
			};
			reader.onerror = () => handleError(reader.error);
			reader.readAsText(source);
		} else if (typeof source === 'string') {
			// Assume source is a URL/path (for templates)
			$.getJSON(source)
				.done(handleLoad)
				.fail(handleError);
		} else {
			alert('Invalid source type for loading design.');
		}
	}
	
	// --- Cleanup ---
	destroy() {
		// Remove event listeners
		this.$canvasArea.off('mousedown wheel');
		$(document).off('.canvasManager'); // Remove namespaced listeners
		$('#zoom-in').off('click');
		$('#zoom-out').off('click');
		if (this.$canvas.hasClass('ui-droppable')) {
			this.$canvas.droppable('destroy');
		}
		
		// Destroy rulers
		if (this.rulers) {
			this.rulers.destroy();
			this.rulers = null;
		}
		
		// Nullify references
		this.$canvasArea = null;
		this.$canvasWrapper = null;
		this.$canvas = null;
		this.canvasAreaDiv = null;
		this.layerManager = null;
		this.historyManager = null;
	}
	
} // End of CanvasManager class
