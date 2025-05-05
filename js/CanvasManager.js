// free-cover-designer/js/CanvasManager.js

class CanvasManager {
	constructor($canvasArea, $canvasWrapper, $canvas, options) {
		this.$canvasArea = $canvasArea;
		this.$canvasWrapper = $canvasWrapper;
		this.$canvas = $canvas;
		this.canvasAreaDiv = $canvasArea[0]; // Keep reference to the DOM element
		this.$exportOverlay = $('#export-overlay');
		
		// Dependencies
		this.layerManager = options.layerManager; // Should be passed in App.js
		this.historyManager = options.historyManager; // Should be passed in App.js
		this.onZoomChange = options.onZoomChange || (() => {
		}); // Callback for UI updates
		
		// State
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
			this.$canvasArea.css('--canvas-zoom-x', 1 / this.currentZoom);
		} else {
			console.warn("CanvasManager: $canvasArea not found during initialization for setting CSS variable.");
		}
		
		this.initializePan();
		this.initializeZoomControls();
		this.setZoom(this.currentZoom, false);
		this.centerCanvas();
		this.onZoomChange(this.currentZoom, this.MIN_ZOOM, this.MAX_ZOOM);
		
		if (this.$exportOverlay) {
			this.$exportOverlay.hide();
		}
	}
	
	setCanvasSize(width, height) {
		this.currentCanvasWidth = parseFloat(width) || this.DEFAULT_CANVAS_WIDTH;
		this.currentCanvasHeight = parseFloat(height) || this.DEFAULT_CANVAS_HEIGHT;
		this.$canvas.css({
			width: this.currentCanvasWidth + 'px',
			height: this.currentCanvasHeight + 'px'
		});
		this.updateWrapperSize();
		this.centerCanvas();
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
	
	initializePan() {
		// --- Panning ---
		this.$canvasArea.on('mousedown', (e) => {
			// Check if the click is directly on the area/wrapper OR middle mouse button
			const isBackgroundClick = e.target === this.$canvasArea[0] || e.target === this.$canvasWrapper[0];
			const isMiddleMouse = e.which === 2;
			
			// Find the layer element if clicked inside one
			const $clickedLayerElement = $(e.target).closest('#canvas .canvas-element');
			let isClickOnUnlockedLayer = false;
			let isClickOnLockedLayer = false; // Added flag
			
			if ($clickedLayerElement.length > 0 && !isMiddleMouse) {
				const layerId = $clickedLayerElement.data('layerId');
				// Ensure layerManager is available
				if (this.layerManager) {
					const layer = this.layerManager.getLayerById(layerId);
					if (layer) {
						if (!layer.locked) {
							isClickOnUnlockedLayer = true;
						} else {
							isClickOnLockedLayer = true; // Set flag if layer is locked
						}
					} else {
						// Layer element exists but no data found? Treat as unlocked to be safe.
						console.warn(`Layer data not found for element ID: ${layerId}`);
						isClickOnUnlockedLayer = true;
					}
				} else {
					console.warn("LayerManager not available in CanvasManager mousedown handler.");
					// Fallback: treat click on any layer as potentially unlocked if manager missing
					isClickOnUnlockedLayer = true;
				}
			}
			
			// Prevent panning ONLY if clicking on an UNLOCKED layer (and not middle mouse)
			if (isClickOnUnlockedLayer) {
				// Let the layer handle the click/drag (selection, etc.)
				// Do NOT preventDefault here, as the layer's draggable/click needs it.
				return;
			}
			
			// Allow panning if:
			// 1. Clicking background (isBackgroundClick is true)
			// 2. Using middle mouse (isMiddleMouse is true)
			// 3. Clicking a LOCKED layer (isClickOnLockedLayer is true)
			if (isBackgroundClick || isMiddleMouse || isClickOnLockedLayer) {
				
				// --- Start Panning ---
				this.isPanning = true;
				this.lastPanX = e.clientX;
				this.lastPanY = e.clientY;
				this.$canvasArea.addClass('panning');
				// Prevent default browser actions (like text selection or image drag) ONLY when panning
				e.preventDefault();
				
				// Deselect layer AND hide inspector if clicking background OR a locked layer
				// (and not using middle mouse, as middle mouse shouldn't change selection)
				// Also ensure something *is* selected before trying to deselect.
				if (!isMiddleMouse && (isBackgroundClick || isClickOnLockedLayer) && this.layerManager && this.layerManager.getSelectedLayer()) {
					this.layerManager.selectLayer(null);
				}
				// --- End Panning Start ---
			}
			// If none of the conditions to start panning are met (e.g., click on something else
			// outside canvas/wrapper/layer, or an unlocked layer), do nothing here.
		});
		
		// --- Mouse Move for Panning (No changes needed here) ---
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
		});
		
		// --- Mouse Up/Leave for Panning (No changes needed here) ---
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
		
		const self = this;

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
		});
	}
	
	// Zooms by a factor, keeping the center of the view stable
	zoom(factor) {
		const newZoom = this.currentZoom * factor;
		this.setZoom(newZoom);
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
				return;
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
		});
	}
	
	_isGoogleFont(fontFamily) {
		if (!fontFamily) return false;
		const knownLocal = ['arial', 'verdana', 'times new roman', 'georgia', 'courier new', 'serif', 'sans-serif', 'monospace', 'helvetica neue', 'system-ui'];
		const lowerFont = fontFamily.toLowerCase().replace(/['"]/g, '');
		return !knownLocal.includes(lowerFont) && /^[a-z0-9\s]+$/i.test(lowerFont);
	}
	
	// --- Export ---
	async _getEmbeddedFontsCss(layersData) {
		const uniqueGoogleFonts = new Set();
		layersData.forEach(layer => {
			if (layer.type === 'text' && layer.fontFamily && this._isGoogleFont(layer.fontFamily)) {
				// Encode font name for URL, request common weights/styles
				uniqueGoogleFonts.add(`family=${encodeURIComponent(layer.fontFamily.trim())}:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900`);
			}
		});
		
		if (uniqueGoogleFonts.size === 0) {
			return ''; // No Google Fonts to embed
		}
		
		// Construct the Google Fonts API URL
		const fontFamiliesParam = Array.from(uniqueGoogleFonts).join('&');
		// IMPORTANT: Request specific user agent (like Chrome) to get WOFF2 URLs reliably
		const fontUrl = `https://fonts.googleapis.com/css2?${fontFamiliesParam}&display=swap`;
		let originalCss = '';
		
		try {
			console.log("Fetching Google Fonts CSS:", fontUrl);
			const cssResponse = await fetch(fontUrl, {
				headers: { // Mimic a common browser to get WOFF2
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
				}
			});
			if (!cssResponse.ok) {
				throw new Error(`CSS fetch failed! status: ${cssResponse.status}`);
			}
			originalCss = await cssResponse.text();
			console.log("Successfully fetched Google Fonts CSS definitions.");
			
			// --- Find font URLs and fetch/embed them ---
			const fontUrls = originalCss.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g);
			if (!fontUrls || fontUrls.length === 0) {
				console.warn("No font file URLs found in the fetched CSS.");
				return originalCss; // Return original CSS if no URLs found
			}
			
			// Extract clean URLs
			const urlsToFetch = fontUrls.map(match => match.substring(4, match.length - 1));
			console.log(`Found ${urlsToFetch.length} font files to fetch and embed.`);
			
			// Fetch all font files concurrently
			const fontFetchPromises = urlsToFetch.map(async (url) => {
				try {
					const fontResponse = await fetch(url);
					if (!fontResponse.ok) {
						throw new Error(`Font fetch failed! status: ${fontResponse.status} for ${url}`);
					}
					const blob = await fontResponse.blob();
					const base64 = await this._blobToBase64(blob);
					const mimeType = blob.type || 'font/woff2'; // Use blob type or default to woff2
					return { url, base64, mimeType };
				} catch (fontError) {
					console.error(`Failed to fetch or encode font: ${url}`, fontError);
					return { url, error: true }; // Mark as error
				}
			});
			
			const embeddedFontsData = await Promise.all(fontFetchPromises);
			
			// Replace URLs in the original CSS
			let embeddedCss = originalCss;
			embeddedFontsData.forEach(fontData => {
				if (!fontData.error) {
					const dataUri = `data:${fontData.mimeType};base64,${fontData.base64}`;
					// Escape parentheses in the URL for regex replacement
					const escapedUrl = fontData.url.replace(/\(/g, '\\(').replace(/\)/g, '\\)');
					const regex = new RegExp(`url\\(${escapedUrl}\\)`, 'g');
					embeddedCss = embeddedCss.replace(regex, `url(${dataUri})`);
				}
			});
			
			console.log("Finished embedding font data into CSS.");
			// console.log("Embedded CSS:", embeddedCss); // DEBUG: Log the final CSS
			return embeddedCss;
			
		} catch (error) {
			console.error("Error processing Google Fonts for embedding:", error);
			alert("Warning: Could not process Google Font definitions for export. Export might use fallback fonts.");
			return ''; // Return empty string on error
		}
	}
	
	// --- Helper to convert Blob to Base64 ---
	_blobToBase64(blob) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => {
				// Remove the prefix "data:...;base64,"
				const base64String = reader.result.split(',')[1];
				resolve(base64String);
			};
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}
	
	
	// --- Export ---
	async exportCanvas(format = 'png') { // Still async
		
		if (this.$exportOverlay) {
			this.$exportOverlay.show();
		}
		this.layerManager.selectLayer(null);
		
		// Store original state... (same as before)
		const originalTransform = this.$canvas.css('transform');
		const originalWrapperWidth = this.$canvasWrapper.css('width');
		const originalWrapperHeight = this.$canvasWrapper.css('height');
		const originalScrollLeft = this.$canvasArea.scrollLeft();
		const originalScrollTop = this.$canvasArea.scrollTop();
		
		// Temporarily reset zoom and scroll... (same as before)
		this.$canvas.css('transform', 'scale(1.0)');
		this.$canvasWrapper.css({
			width: this.currentCanvasWidth + 'px',
			height: this.currentCanvasHeight + 'px'
		});
		const wrapperPos = this.$canvasWrapper.position();
		this.$canvasArea.scrollLeft(wrapperPos.left);
		this.$canvasArea.scrollTop(wrapperPos.top);
		
		// Get layer data... (same as before)
		const layersData = this.layerManager.getLayers();
		const defaultFilters = this.layerManager.defaultFilters;
		const defaultTransform = this.layerManager.defaultTransform;
		
		// Temporarily make all layers visible... (same as before)
		const hiddenLayerIds = layersData.filter(l => !l.visible).map(l => l.id);
		hiddenLayerIds.forEach(id => $(`#${id}`).show());
		
		const canvasElement = this.$canvas[0];
		const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
		const quality = format === 'jpeg' ? 0.92 : undefined;
		const filename = `book-cover-export.${format}`;
		
		// --- Get the CSS with embedded fonts ---
		const embeddedFontCss = await this._getEmbeddedFontsCss(layersData);
		
		// --- Options for modern-screenshot ---
		const screenshotOptions = {
			width: this.currentCanvasWidth,
			height: this.currentCanvasHeight,
			scale: 1,
			backgroundColor: '#ffffff',
			quality: quality,
			fetch: {
				// mode: 'cors', // Generally not needed now fonts are embedded
			},
			onCloneNode: (clonedNode) => {
				if (!clonedNode || clonedNode.id !== 'canvas') {
					console.warn("onCloneNode did not receive the expected #canvas clone.");
					return;
				}
				
				// --- Inject the EMBEDDED Font CSS ---
				if (embeddedFontCss) {
					const style = document.createElement('style');
					style.textContent = embeddedFontCss;
					clonedNode.prepend(style); // Prepend to ensure it's available early
					console.log("Injected EMBEDDED Google Fonts CSS into cloned node.");
				}
				// --- END Inject ---
				
				clonedNode.style.transform = 'scale(1.0)';
				
				// Remove selection borders, show hidden layers, remove handles... (same as before)
				clonedNode.querySelectorAll('.canvas-element.selected').forEach(el => el.classList.remove('selected'));
				hiddenLayerIds.forEach(id => {
					const el = clonedNode.querySelector(`#${id}`);
					if (el) el.style.display = 'block';
				});
				clonedNode.querySelectorAll('.ui-resizable-handle').forEach(h => h.style.display = 'none');
				
				// Re-apply Filters, Blend Modes, Transforms, Text Styles... (SAME AS PREVIOUS VERSION)
				layersData.forEach(layer => {
					const clonedElement = clonedNode.querySelector(`#${layer.id}`);
					if (!clonedElement) return;
					
					// Blend Mode
					clonedElement.style.mixBlendMode = layer.blendMode || 'normal';
					
					// Transform
					const rotation = layer.rotation || defaultTransform.rotation;
					const scale = (layer.scale || defaultTransform.scale) / 100;
					clonedElement.style.transform = `rotate(${rotation}deg) scale(${scale})`;
					clonedElement.style.transformOrigin = 'center center';
					
					// Image Filters
					if (layer.type === 'image') {
						const clonedImg = clonedElement.querySelector('img');
						if (clonedImg) {
							const filters = layer.filters || defaultFilters;
							let filterString = '';
							if (filters.brightness !== 100) filterString += `brightness(${filters.brightness}%) `;
							if (filters.contrast !== 100) filterString += `contrast(${filters.contrast}%) `;
							if (filters.saturation !== 100) filterString += `saturate(${filters.saturation}%) `;
							if (filters.grayscale !== 0) filterString += `grayscale(${filters.grayscale}%) `;
							if (filters.sepia !== 0) filterString += `sepia(${filters.sepia}%) `;
							if (filters.hueRotate !== 0) filterString += `hue-rotate(${filters.hueRotate}deg) `;
							if (filters.blur !== 0) filterString += `blur(${filters.blur}px) `;
							clonedImg.style.filter = filterString.trim() || 'none';
						}
					}
					
					// Text Styles (Crucial: Ensure font-family is applied correctly)
					if (layer.type === 'text') {
						const clonedTextContent = clonedElement.querySelector('.text-content');
						if (clonedTextContent) {
							let fontFamily = layer.fontFamily || 'Arial';
							if (fontFamily.includes(' ') && !fontFamily.startsWith("'") && !fontFamily.startsWith('"')) {
								fontFamily = `"${fontFamily}"`;
							}
							clonedTextContent.style.fontFamily = fontFamily; // Apply potentially quoted name
							clonedTextContent.style.fontSize = (layer.fontSize || 16) + 'px';
							clonedTextContent.style.fontWeight = layer.fontWeight || 'normal';
							clonedTextContent.style.fontStyle = layer.fontStyle || 'normal';
							clonedTextContent.style.textDecoration = layer.textDecoration || 'none';
							clonedTextContent.style.color = layer.fill || 'rgba(0,0,0,1)';
							clonedTextContent.style.textAlign = layer.align || 'left';
							clonedTextContent.style.lineHeight = layer.lineHeight || 1.3;
							clonedTextContent.style.letterSpacing = (layer.letterSpacing || 0) + 'px';
							clonedTextContent.style.whiteSpace = 'pre-wrap';
							clonedTextContent.style.wordWrap = 'break-word';
							
							// Text Shadow
							if (layer.shadowEnabled && layer.shadowColor) {
								const shadow = `${layer.shadowOffsetX || 0}px ${layer.shadowOffsetY || 0}px ${layer.shadowBlur || 0}px ${layer.shadowColor}`;
								clonedTextContent.style.textShadow = shadow;
							} else {
								clonedTextContent.style.textShadow = 'none';
							}
							
							// Text Stroke
							const strokeWidth = parseFloat(layer.strokeWidth) || 0;
							if (strokeWidth > 0 && layer.stroke) {
								const strokeColor = layer.stroke || 'rgba(0,0,0,1)';
								clonedTextContent.style.webkitTextStrokeWidth = strokeWidth + 'px';
								clonedTextContent.style.webkitTextStrokeColor = strokeColor;
								clonedTextContent.style.textStrokeWidth = strokeWidth + 'px';
								clonedTextContent.style.textStrokeColor = strokeColor;
								clonedTextContent.style.paintOrder = 'stroke fill';
							} else {
								clonedTextContent.style.webkitTextStrokeWidth = '0';
								clonedTextContent.style.textStrokeWidth = '0';
							}
							
							// Parent Background
							if (layer.backgroundEnabled && layer.backgroundColor) {
								let bgColor = layer.backgroundColor;
								const bgOpacity = layer.backgroundOpacity ?? 1;
								if (bgOpacity < 1) {
									try {
										let tiny = tinycolor(bgColor);
										if (tiny.isValid()) { bgColor = tiny.setAlpha(bgOpacity).toRgbString(); }
									} catch (e) { /* ignore */ }
								}
								clonedElement.style.backgroundColor = bgColor;
								clonedElement.style.borderRadius = (layer.backgroundCornerRadius || 0) + 'px';
								clonedElement.style.padding = (layer.backgroundPadding || 0) + 'px';
							} else {
								clonedElement.style.backgroundColor = 'transparent';
								clonedElement.style.borderRadius = '0';
								clonedElement.style.padding = '0';
							}
						}
					}
				}); // *** END Re-apply ***
			} // End onCloneNode
		}; // End screenshotOptions
		
		// --- Choose format and handle promise --- (same as before)
		let screenshotPromise;
		if (format === 'jpeg') {
			screenshotPromise = modernScreenshot.domToJpeg(canvasElement, screenshotOptions);
		} else {
			screenshotPromise = modernScreenshot.domToPng(canvasElement, screenshotOptions);
		}
		
		// --- Handle the promise with try...finally for restoration --- (same as before)
		try {
			const dataUrl = await screenshotPromise;
			const a = document.createElement('a');
			a.href = dataUrl;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
		} catch (err) {
			console.error(`Error exporting canvas with modernScreenshot (.${format}):`, err);
			alert(`Error exporting canvas as ${format.toUpperCase()}. Check console. Embedded font processing might have failed.`);
		} finally {
			// --- Restore original state --- (same as before)
			hiddenLayerIds.forEach(id => {
				const layer = this.layerManager.getLayerById(id);
				if (layer && !layer.visible) { $(`#${id}`).hide(); }
			});
			this.$canvas.css('transform', originalTransform);
			this.$canvasWrapper.css({ width: originalWrapperWidth, height: originalWrapperHeight });
			this.$canvasArea.scrollLeft(originalScrollLeft);
			this.$canvasArea.scrollTop(originalScrollTop);
			const selectedLayer = this.layerManager.getSelectedLayer();
			if (selectedLayer) { $(`#${selectedLayer.id}`).addClass('selected'); }
			
			if (this.$exportOverlay) {
				this.$exportOverlay.hide();
			}
			
			console.log("Export process finished, restored original state.");
		}
	} // End exportCanvas
	
	
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
				const {shadowOffsetInternal, shadowAngleInternal, ...layerToSave} = layer;
				return layerToSave;
			})
		};
		// ... (rest of save logic: JSON.stringify, Blob, download) ...
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
		
		this.$canvas.find('.canvas-element').each(function () {
			if ($(this).hasClass('ui-draggable')) $(this).draggable('destroy');
			if ($(this).hasClass('ui-resizable')) $(this).resizable('destroy');
		});
		
		
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
