// free-cover-designer/js/CanvasManager.js

class CanvasManager {
	constructor($canvasArea, $canvasWrapper, $canvas, options) {
		this.$canvasArea = $canvasArea;
		this.$canvasWrapper = $canvasWrapper;
		this.$canvas = $canvas;
		this.canvasAreaDiv = $canvasArea[0]; // Keep reference to the DOM element
		// Dependencies
		this.layerManager = options.layerManager; // Should be passed in App.js
		this.historyManager = options.historyManager; // Should be passed in App.js
		this.onZoomChange = options.onZoomChange || (() => { }); // Callback for UI updates
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
		this.currentCanvasWidth = this.DEFAULT_CANVAS_WIDTH; // Initialize
		this.currentCanvasHeight = this.DEFAULT_CANVAS_HEIGHT;// Initialize
	}
	
	initialize() {
		this.setCanvasSize(this.DEFAULT_CANVAS_WIDTH, this.DEFAULT_CANVAS_HEIGHT); // Set initial size
		
		if (this.$canvasArea && this.$canvasArea.length) {
			this.$canvasArea.css('--canvas-zoom-x', 1 / this.currentZoom );
		} else {
			console.warn("CanvasManager: $canvasArea not found during initialization for setting CSS variable.");
		}
		
		this.initializeRulers();
		this.initializeDroppable();
		this.initializePan();
		this.initializeZoomControls();
		this.setZoom(this.currentZoom, false);
		this.centerCanvas();
		this.onZoomChange(this.currentZoom, this.MIN_ZOOM, this.MAX_ZOOM);
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
		this.$canvas.css({
			transform: `scale(${this.currentZoom})`,
			transformOrigin: 'top left'
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
				
				// --- TEMPLATE DROP ---
				if ($draggedItem.hasClass('template-thumbnail')) {
					const jsonPath = $draggedItem.data('templateJsonPath');
					if (jsonPath) {
						// --- NEW: Delete existing text layers BEFORE loading ---
						console.log("Applying template, removing existing text layers...");
						const existingLayers = this.layerManager.getLayers();
						const textLayerIdsToDelete = existingLayers
							.filter(layer => layer.type === 'text')
							.map(layer => layer.id);
						
						if (textLayerIdsToDelete.length > 0) {
							textLayerIdsToDelete.forEach(id => this.layerManager.deleteLayer(id, false)); // Delete without saving history yet
							console.log(`Removed ${textLayerIdsToDelete.length} text layers.`);
						} else {
							console.log("No existing text layers found to remove.");
						}
						// --- END NEW ---
						
						// Load the template design. The `isTemplate=true` flag tells loadDesign
						// *not* to clear canvas size/history, and tells setLayers to add to existing (non-text) layers.
						// saveState will happen inside loadDesign after layers are set.
						this.loadDesign(jsonPath, true);
					}
					// --- COVER DROP ---
				} else if ($draggedItem.hasClass('cover-thumbnail')) {
					const imgSrc = $draggedItem.data('coverSrc');
					if (!imgSrc) return;
					
					// Add image as a layer, positioned at (0,0) and sized to canvas
					const img = new Image();
					img.onload = () => {
						// --- MODIFIED: Set dimensions to canvas size ---
						const newLayer = this.layerManager.addLayer('image', {
							content: imgSrc,
							x: 0,
							y: 0,
							width: this.currentCanvasWidth,
							height: this.currentCanvasHeight,
							// Generate a more specific default name
							name: `Background Cover ${this.layerManager.uniqueIdCounter}`
						});
						
						if (newLayer) {
							// Move to back and lock
							this.layerManager.moveLayer(newLayer.id, 'back'); // Move without saving yet
							this.layerManager.toggleLockLayer(newLayer.id, false); // Lock without saving yet
							
							// --- Select the newly added layer (optional) ---
							this.layerManager.selectLayer(newLayer.id);
							
							// Save state AFTER all changes (add, move, lock) are applied
							this.historyManager.saveState();
						}
					};
					img.onerror = () => console.error("Failed to load cover image for dropping:", imgSrc);
					img.src = imgSrc;
					
					// --- ELEMENT DROP ---
				} else if ($draggedItem.hasClass('element-thumbnail')) {
					const imgSrc = $draggedItem.data('elementSrc');
					if (!imgSrc) return;
					
					// Add element image, centered at drop point (Keep this behavior for elements)
					const img = new Image();
					img.onload = () => {
						// Default size for elements, maybe smaller
						const elemWidth = Math.min(img.width, 150); // Use actual width up to 150px
						const elemHeight = (img.height / img.width) * elemWidth; // Maintain aspect ratio
						
						const newLayer = this.layerManager.addLayer('image', {
							content: imgSrc,
							x: dropPosition.x - (elemWidth / 2), // Center X at drop
							y: dropPosition.y - (elemHeight / 2), // Center Y at drop
							width: elemWidth,
							height: elemHeight
						});
						
						if (newLayer) {
							// --- Select the newly added layer ---
							this.layerManager.selectLayer(newLayer.id);
						}
						
						// Save state after adding element
						this.historyManager.saveState();
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
		// We use the wrapper because it's the element being positioned/centered.
		const wrapperPos = this.$canvasWrapper.position(); // { top: ..., left: ... } relative to offset parent (canvas-area)
		// 6. Calculate mouse position relative to the wrapper's top-left corner
		const relativeToWrapperX = mouseXInScrollContent - wrapperPos.left;
		const relativeToWrapperY = mouseYInScrollContent - wrapperPos.top;
		// 7. Account for the current zoom level to get coordinates relative to the unscaled canvas (0,0)
		const dropX = relativeToWrapperX / this.currentZoom;
		const dropY = relativeToWrapperY / this.currentZoom;
		// console.log(`Drop Coords: CanvasX=${dropX.toFixed(2)}, CanvasY=${dropY.toFixed(2)}`);
		return { x: dropX, y: dropY };
	}
	
	initializePan() {
		// --- Panning ---
		this.$canvasArea.on('mousedown', (e) => {
			if (e.target === this.$canvasArea[0] || e.target === this.$canvasWrapper[0] || e.which === 2) {
				if ($(e.target).closest('#canvas .canvas-element').length > 0 && e.which !== 2) { return; }
				if ($(e.target).closest('.ruler').length > 0) { return; }
				
				this.isPanning = true;
				this.lastPanX = e.clientX;
				this.lastPanY = e.clientY;
				this.$canvasArea.addClass('panning');
				e.preventDefault();
				
				// Deselect layer AND hide inspector if clicking background (not middle mouse)
				if (e.which !== 2 && this.layerManager.getSelectedLayer()) {
					this.layerManager.selectLayer(null); // Triggers inspector hide via App.js callback
				}
			}
		});
		
		$(document).on('mousemove.canvasManagerPan', (e) => { // Use specific namespace
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
		
		$(document).on('mouseup.canvasManagerPan mouseleave.canvasManagerPan', (e) => { // Use specific namespace
			if (this.isPanning) {
				this.isPanning = false;
				this.$canvasArea.removeClass('panning');
			}
		});
	}
	
	initializeZoomControls() {
		// Listeners for zoom-in, zoom-out buttons
		$('#zoom-in').on('click', () => this.zoom(1.25));
		$('#zoom-out').on('click', () => this.zoom(0.8));
		
		const self = this; // Preserve context for the dropdown
		// Listener for the zoom dropdown options
		$('#zoom-options-menu').on('click', '.zoom-option', function (e) {
			e.preventDefault(); // Prevent default link behavior
			const zoomValue = $(this).data('zoom');
			if (zoomValue === 'fit') {
				self.zoomToFit();
			} else {
				const numericZoom = parseFloat(zoomValue);
				if (!isNaN(numericZoom)) {
					self.setZoom(numericZoom);
				}
			}
			// Bootstrap's dropdown should close automatically on item click
		});
	}
	
	// Zooms by a factor, keeping the center of the view stable
	zoom(factor) {
		const newZoom = this.currentZoom * factor;
		this.setZoom(newZoom); // setZoom handles clamping, applying, and recentering
	}
	
	// Sets zoom level directly
	setZoom(newZoom, triggerCallbacks = true) {
		const oldZoom = this.currentZoom;
		const clampedZoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, newZoom));
		
		if (clampedZoom === oldZoom) return; // No change
		
		// --- Calculate center point before zoom ---
		const areaWidth = this.$canvasArea.innerWidth();
		const areaHeight = this.$canvasArea.innerHeight();
		const scrollLeftBefore = this.$canvasArea.scrollLeft();
		const scrollTopBefore = this.$canvasArea.scrollTop();
		const wrapperPosBefore = this.$canvasWrapper.position(); // Relative to canvas-area
		
		// Center of the viewport relative to the canvas-area's scrollable content
		const viewCenterX = scrollLeftBefore + areaWidth / 2;
		const viewCenterY = scrollTopBefore + areaHeight / 2;
		
		// Center of the viewport relative to the wrapper's top-left
		const centerRelativeToWrapperX = viewCenterX - wrapperPosBefore.left;
		const centerRelativeToWrapperY = viewCenterY - wrapperPosBefore.top;
		
		// Corresponding point on the unscaled canvas
		const centerOnCanvasX = centerRelativeToWrapperX / oldZoom;
		const centerOnCanvasY = centerRelativeToWrapperY / oldZoom;
		
		// --- Apply the new zoom ---
		this.currentZoom = clampedZoom;
		
		if (this.$canvasArea && this.$canvasArea.length) {
			this.$canvasArea.css('--canvas-zoom-x', 1 / this.currentZoom);
		}
		
		// Update wrapper size and canvas transform (scale from top-left)
		this.updateWrapperSize();
		
		// Get the wrapper position *after* its size might have changed due to zoom
		// Note: position() might not update immediately if layout hasn't reflowed.
		// Using the *old* wrapperPosBefore might be more reliable here for scroll calculation.
		const wrapperPosAfter = this.$canvasWrapper.position(); // Re-read position after styles applied (may need rAF)
		
		// Calculate where the target canvas point *should* be relative to the wrapper's top-left at the new zoom
		const newCenterRelativeToWrapperX = centerOnCanvasX * this.currentZoom;
		const newCenterRelativeToWrapperY = centerOnCanvasY * this.currentZoom;
		
		// Calculate the new scroll position needed to place this point back at the center of the viewport
		// Use wrapperPosBefore for calculating scroll, as it represents the pre-zoom layout state
		const newScrollLeft = (wrapperPosBefore.left + newCenterRelativeToWrapperX) - (areaWidth / 2);
		const newScrollTop = (wrapperPosBefore.top + newCenterRelativeToWrapperY) - (areaHeight / 2);
		
		
		// Apply the new scroll position
		this.$canvasArea.scrollLeft(newScrollLeft);
		this.$canvasArea.scrollTop(newScrollTop);
		
		// Update rulers zoom factor and redraw them based on new scroll/zoom
		if (this.rulers) {
			this.rulers.setZoom(this.currentZoom);
			this.rulers.updateRulers(); // Essential after scroll/zoom changes
		}
		
		// Update UI (via callback)
		if (triggerCallbacks) {
			this.onZoomChange(this.currentZoom, this.MIN_ZOOM, this.MAX_ZOOM);
		}
	}
	
	zoomToFit() {
		requestAnimationFrame(() => {
			const areaWidth = this.$canvasArea.innerWidth() - 40; // Subtract padding/scrollbar allowance
			const areaHeight = this.$canvasArea.innerHeight() - 40; // Subtract padding/scrollbar allowance
			const canvasWidth = this.currentCanvasWidth;
			const canvasHeight = this.currentCanvasHeight;
			
			if (areaWidth <= 0 || areaHeight <= 0 || canvasWidth <= 0 || canvasHeight <= 0) {
				console.warn("Cannot zoomToFit, invalid dimensions.");
				return; // Avoid division by zero or nonsensical zoom
			}
			
			const scaleX = areaWidth / canvasWidth;
			const scaleY = areaHeight / canvasHeight;
			const newZoom = Math.min(scaleX, scaleY); // Fit entirely within view
			
			this.setZoom(newZoom); // setZoom handles clamping, applying, and centering logic
			this.centerCanvas(); // Ensure it's centered after fitting
		});
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
		
		// Store original state (transform, wrapper size, scroll)
		const originalTransform = this.$canvas.css('transform');
		const originalWrapperWidth = this.$canvasWrapper.css('width');
		const originalWrapperHeight = this.$canvasWrapper.css('height');
		const originalScrollLeft = this.$canvasArea.scrollLeft();
		const originalScrollTop = this.$canvasArea.scrollTop();
		
		// Temporarily reset zoom and scroll for accurate capture
		this.$canvas.css('transform', 'scale(1.0)');
		this.$canvasWrapper.css({
			width: this.currentCanvasWidth + 'px',
			height: this.currentCanvasHeight + 'px'
		});
		const wrapperPos = this.$canvasWrapper.position();
		this.$canvasArea.scrollLeft(wrapperPos.left);
		this.$canvasArea.scrollTop(wrapperPos.top);
		
		// Temporarily make all layers visible for export
		const hiddenLayerIds = this.layerManager.getLayers().filter(l => !l.visible).map(l => l.id);
		hiddenLayerIds.forEach(id => $(`#${id}`).show());
		
		const canvasElement = this.$canvas[0];
		const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
		const quality = format === 'jpeg' ? 0.92 : 1.0;
		const filename = `book-cover-export.${format}`;
		
		setTimeout(() => { // Allow browser re-render
			html2canvas(canvasElement, {
				useCORS: true,
				allowTaint: true, // Use with caution if CORS isn't fully working
				logging: false,
				scale: 1,
				width: this.currentCanvasWidth,
				height: this.currentCanvasHeight,
				x: 0,
				y: 0,
				scrollX: 0,
				scrollY: 0,
				backgroundColor: '#ffffff', // Or null for transparency if PNG
				onclone: (clonedDoc) => {
					const clonedCanvas = clonedDoc.getElementById('canvas');
					if (clonedCanvas) {
						clonedCanvas.style.transform = 'scale(1.0)'; // Ensure no transform
						// Remove selection borders
						clonedCanvas.querySelectorAll('.canvas-element.selected').forEach(el => el.classList.remove('selected'));
						// Ensure originally hidden layers are visible in clone
						hiddenLayerIds.forEach(id => {
							const el = clonedCanvas.querySelector(`#${id}`);
							if (el) el.style.display = 'block';
						});
						// Remove resize handles
						clonedCanvas.querySelectorAll('.ui-resizable-handle').forEach(h => h.style.display = 'none');
						// Remove lock class if visual lock shouldn't be exported
						// clonedCanvas.querySelectorAll('.canvas-element.locked').forEach(el => el.classList.remove('locked'));
						
						// *** NEW: Ensure Text Styles are Applied Correctly in Clone ***
						// Re-apply styles using LayerManager's logic on the *cloned* elements
						// This helps if html2canvas doesn't perfectly capture CSS text-stroke etc.
						// Note: This relies on accessing LayerManager's data, which might be tricky in onclone.
						// A simpler approach is to trust html2canvas as much as possible first.
						// If text stroke/shadow isn't exporting well, more complex cloning logic might be needed.
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
				alert("Error exporting canvas. Check console. Cross-origin images or complex CSS might be the cause.");
			}).finally(() => {
				// --- Restore original state ---
				hiddenLayerIds.forEach(id => {
					const layer = this.layerManager.getLayerById(id);
					if (layer && !layer.visible) {
						$(`#${id}`).hide();
					}
				});
				this.$canvas.css('transform', originalTransform);
				this.$canvasWrapper.css({ width: originalWrapperWidth, height: originalWrapperHeight });
				this.$canvasArea.scrollLeft(originalScrollLeft);
				this.$canvasArea.scrollTop(originalScrollTop);
				if (this.layerManager.getSelectedLayer()) {
					$(`#${this.layerManager.getSelectedLayer().id}`).addClass('selected');
				}
			});
		}, 250); // Delay
	}
	
	
	saveDesign() {
		// Ensure layers are sorted by zIndex
		const sortedLayers = [...this.layerManager.getLayers()].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
		const designData = {
			version: "1.2", // Increment version for new properties
			canvas: {
				width: this.currentCanvasWidth,
				height: this.currentCanvasHeight
			},
			// Filter out temporary internal properties before saving
			layers: sortedLayers.map(layer => {
				const { shadowOffsetInternal, shadowAngleInternal, ...layerToSave } = layer;
				return layerToSave;
			})
		};
		// ... (rest of save logic: JSON.stringify, Blob, download) ...
		const jsonData = JSON.stringify(designData, null, 2);
		const blob = new Blob([jsonData], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'book-cover-design.json';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
	
	// Loads a design from a file object or a URL path
	loadDesign(source, isTemplate = false) {
		if (!source) return;
		
		const handleLoad = (designData) => {
			try {
				if (designData && designData.layers && designData.canvas) {
					
					if (!isTemplate) {
						console.log("Loading full design: Clearing history and setting canvas size.");
						this.historyManager.clear();
						this.setCanvasSize(designData.canvas.width, designData.canvas.height);
					} else {
						console.log("Applying template: Keeping existing canvas size and non-text layers.");
						// Text layers should have been removed *before* calling loadDesign for templates
						// We just need to add the template layers.
					}
					
					this.layerManager.setLayers(designData.layers, isTemplate); // Use isTemplate flag directly
					
					// --- Finalize ---
					// Save the loaded/modified state as a single history point
					this.historyManager.saveState();
					
					if (!isTemplate) {
						this.setZoom(1.0); // Reset zoom to 100%
						this.centerCanvas(); // Center the newly loaded canvas
					}
					
					// Deselect any previously selected layer after load/template apply
					this.layerManager.selectLayer(null);
					
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
		
		const handleError = (error, statusText = "") => {
			console.error("Error loading design:", statusText, error);
			alert(`Error reading or fetching the design file: ${statusText}`);
		};
		
		// Check if source is a File object (from input) or a string (path for template)
		if (source instanceof File) {
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const designData = JSON.parse(e.target.result);
					handleLoad(designData); // isTemplate will be false here
				} catch (parseError) {
					handleError(parseError, "JSON Parsing Error");
				}
			};
			reader.onerror = () => handleError(reader.error, "File Reading Error");
			reader.readAsText(source);
		} else if (typeof source === 'string') {
			// Assume source is a URL/path (used for templates)
			$.getJSON(source)
				.done((data) => handleLoad(data)) // isTemplate will be true here
				.fail((jqXHR, textStatus, errorThrown) => handleError(errorThrown, `${textStatus} (${jqXHR.status})`));
		} else {
			alert('Invalid source type for loading design.');
		}
	}
	
	
	// --- Cleanup ---
	destroy() {
		// Remove event listeners
		this.$canvasArea.off('mousedown mousemove mouseup mouseleave');
		this.$canvasArea.css('--canvas-zoom-x', '1'); // Or null
		
		$(document).off('.canvasManagerPan'); // Remove namespaced listeners
		$('#zoom-in').off('click');
		$('#zoom-out').off('click');
		$('#zoom-options-menu').off('click');
		
		if (this.$canvas.hasClass('ui-droppable')) {
			this.$canvas.droppable('destroy');
		}
		// Destroy layer interactivity (draggable/resizable) - handled by LayerManager? No, do it here.
		this.$canvas.find('.canvas-element').each(function() {
			if ($(this).hasClass('ui-draggable')) $(this).draggable('destroy');
			if ($(this).hasClass('ui-resizable')) $(this).resizable('destroy');
		});
		
		
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
		this.layerManager = null; // Break circular reference if any
		this.historyManager = null;
		this.onZoomChange = null;
		
		console.log("CanvasManager destroyed.");
	}
} // End of CanvasManager class
