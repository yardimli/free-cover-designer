// free-cover-designer/js/LayerManager.js

class LayerManager {
	constructor($canvas, $layerList, options) {
		this.$canvas = $canvas;
		this.$layerList = $layerList;
		this.layers = [];
		this.selectedLayerId = null;
		this.uniqueIdCounter = 0;
		this.onLayerSelect = options.onLayerSelect || (() => {
		});
		this.onLayerDataUpdate = options.onLayerDataUpdate || (() => {
		});
		this.saveState = options.saveState || (() => {
		});
		this.canvasManager = options.canvasManager;
		if (!this.canvasManager) {
			console.error("LayerManager requires an instance of CanvasManager!");
		}
		this.loadedGoogleFonts = new Set();
		
		this.defaultFilters = {
			brightness: 100,
			contrast: 100,
			saturation: 100,
			grayscale: 0,
			sepia: 0,
			hueRotate: 0,
			blur: 0,
		};
		
		this.defaultTransform = {
			rotation: 0, // degrees
			scale: 100, // percentage
		};
		
		this.moveableInstance = null;
		this.moveableTargetElement = null;
	}
	
	
	_isGoogleFont(fontFamily) {
		if (!fontFamily) return false;
		// Basic check: not a generic family and not one of the known local fonts
		const knownLocal = ['arial', 'verdana', 'times new roman', 'georgia', 'courier new', 'serif', 'sans-serif', 'monospace', 'helvetica neue'];
		const lowerFont = fontFamily.toLowerCase().replace(/['"]/g, ''); // Normalize
		return !knownLocal.includes(lowerFont) && /^[a-z0-9\s]+$/i.test(lowerFont); // Check if it looks like a font name
	}
	
	_ensureGoogleFontLoaded(fontFamily) {
		const cleanedFontFamily = (fontFamily || '').replace(/^['"]|['"]$/g, ''); // Remove quotes for checks/URL
		
		// Check if it looks like a Google font and hasn't been attempted yet
		if (!cleanedFontFamily || !this._isGoogleFont(cleanedFontFamily) || this.loadedGoogleFonts.has(cleanedFontFamily)) {
			return; // Don't load if already attempted, empty, or likely not a Google Font
		}
		
		console.log(`Dynamically ensuring Google Font: ${cleanedFontFamily}`);
		this.loadedGoogleFonts.add(cleanedFontFamily); // Add optimistically to prevent multiple attempts
		
		// Check if a link tag for this specific font already exists in head
		const encodedFont = encodeURIComponent(cleanedFontFamily);
		if (document.querySelector(`link[href*="family=${encodedFont}"]`)) {
			console.log(`Font link for ${cleanedFontFamily} already exists.`);
			return; // Already present, no need to add another
		}
		
		// Create and append the link tag dynamically
		const fontUrlParam = encodedFont + ':ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900'; // Load common weights/styles
		const fontUrl = `https://fonts.googleapis.com/css?family=${fontUrlParam}&display=swap`;
		
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = fontUrl;
		link.onload = () => {
			console.log(`Dynamically loaded Google Font: ${cleanedFontFamily}`);
			// Optional: Trigger reflow if needed, usually not necessary
		};
		link.onerror = () => {
			console.warn(`Failed to dynamically load Google Font: ${cleanedFontFamily}`);
			this.loadedGoogleFonts.delete(cleanedFontFamily); // Remove from set if failed
		};
		
		document.head.appendChild(link);
	}
	
	// Generates a short, unique ID
	_generateId() {
		return `layer-${this.uniqueIdCounter++}`;
	}
	
	// --- Helper to generate default layer name ---
	_generateDefaultLayerName(layerData) {
		if (layerData.type === 'text') {
			const textContent = (layerData.content || '').trim();
			if (textContent) {
				return textContent.substring(0, 30) + (textContent.length > 30 ? '...' : '');
			}
			return 'Text Layer'; // Default if empty
		} else if (layerData.type === 'image') {
			// --- ADDED Case for Overlay ---
			if (layerData.layerSubType === 'overlay') {
				const numericIdPart = layerData.id ? layerData.id.split('-')[1] : 'New';
				return `Overlay ${numericIdPart}`;
			}
			// --- END ADDED Case ---
			if (layerData.layerSubType === 'cover') {
				const numericIdPart = layerData.id ? layerData.id.split('-')[1] : 'New';
				return `Cover ${numericIdPart}`;
			}
			if (layerData.layerSubType === 'element') {
				const numericIdPart = layerData.id ? layerData.id.split('-')[1] : 'New';
				return `Element ${numericIdPart}`;
			}
			if (layerData.layerSubType === 'upload') {
				const numericIdPart = layerData.id ? layerData.id.split('-')[1] : 'New';
				return `Upload ${numericIdPart}`;
			}
			
			// Fallback for other image types (try filename)
			try {
				const url = new URL(layerData.content, window.location.href);
				const pathParts = url.pathname.split('/');
				const filename = decodeURIComponent(pathParts[pathParts.length - 1]);
				if (filename) {
					const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
					return nameWithoutExt.substring(0, 30) + (nameWithoutExt.length > 30 ? '...' : '');
				}
			} catch (e) { /* Ignore errors */
			}
			
			// Final fallback name
			const numericIdPart = layerData.id ? layerData.id.split('-')[1] : 'New';
			return `Image ${numericIdPart}`;
		}
		// Default for other types
		const numericIdPart = layerData.id ? layerData.id.split('-')[1] : 'New';
		return `Layer ${numericIdPart}`;
	}
	
	
	addLayer(type, props = {}) {
		const layerId = props.id || this._generateId(); // Use provided ID or generate new
		// Ensure uniqueIdCounter is ahead of any loaded IDs
		const numericId = parseInt(layerId.split('-')[1]);
		if (!isNaN(numericId) && numericId >= this.uniqueIdCounter) {
			this.uniqueIdCounter = numericId + 1;
		}
		// Calculate initial zIndex based on current layers
		const initialZIndex = this.layers.length > 0 ? Math.max(...this.layers.map(l => l.zIndex || 0)) + 1 : 1;
		// Define defaults for the NEW structure
		const defaultProps = {
			id: layerId,
			name: '',
			type: type,
			layerSubType: null,
			opacity: 1,
			visible: true,
			locked: false,
			x: 50,
			y: 50,
			width: type === 'text' ? 200 : 150,
			height: type === 'text' ? 'auto' : 100,
			zIndex: initialZIndex,
			rotation: this.defaultTransform.rotation,
			scale: this.defaultTransform.scale,
			definition: 'general',
			// Text specific defaults
			content: type === 'text' ? 'New Text' : '',
			fontSize: 24,
			fontFamily: 'Arial',
			fontStyle: 'normal',
			fontWeight: 'normal',
			textDecoration: 'none',
			fill: 'rgba(0,0,0,1)',
			align: 'left',
			vAlign: 'center',
			lineHeight: 1.3,
			letterSpacing: 0,
			shadowEnabled: false,
			shadowBlur: 5,
			shadowOffsetX: 2,
			shadowOffsetY: 2,
			shadowColor: 'rgba(0,0,0,0.5)',
			strokeWidth: 0,
			stroke: 'rgba(0,0,0,1)',
			backgroundEnabled: false,
			backgroundColor: 'rgba(255,255,255,1)',
			backgroundOpacity: 1,
			backgroundPadding: 0,
			backgroundCornerRadius: 0,
			// NEW: Image specific defaults
			filters: {...this.defaultFilters}, // Clone defaults
			blendMode: 'normal',
		};
		// Merge provided props with defaults
		const layerData = {...defaultProps, ...props};
		
		if (type === 'image') {
			layerData.filters = {...this.defaultFilters, ...(props.filters || {})};
		}
		
		if (!layerData.name) {
			layerData.name = this._generateDefaultLayerName(layerData);
		}
		
		// Ensure numeric types are numbers
		layerData.x = parseFloat(layerData.x) || 0;
		layerData.y = parseFloat(layerData.y) || 0;
		layerData.width = layerData.width === 'auto' ? 'auto' : (parseFloat(layerData.width) || defaultProps.width);
		layerData.height = layerData.height === 'auto' ? 'auto' : (parseFloat(layerData.height) || defaultProps.height);
		layerData.opacity = parseFloat(layerData.opacity) ?? 1;
		layerData.zIndex = parseInt(layerData.zIndex) || initialZIndex;
		layerData.rotation = parseFloat(layerData.rotation) || this.defaultTransform.rotation;
		layerData.scale = parseFloat(layerData.scale) || this.defaultTransform.scale;
		layerData.definition = (typeof layerData.definition === 'string' && layerData.definition.trim() !== '') ? layerData.definition : 'general';
		
		if (type === 'text') {
			layerData.fontSize = Math.max(1, parseFloat(layerData.fontSize) || defaultProps.fontSize);
			layerData.lineHeight = Math.max(0.1, parseFloat(layerData.lineHeight) || defaultProps.lineHeight);
			layerData.letterSpacing = parseFloat(layerData.letterSpacing) || defaultProps.letterSpacing;
			// Shadow
			layerData.shadowBlur = Math.max(0, parseFloat(layerData.shadowBlur) || 0);
			layerData.shadowOffsetX = parseFloat(layerData.shadowOffsetX) || 0;
			layerData.shadowOffsetY = parseFloat(layerData.shadowOffsetY) || 0;
			// Stroke
			layerData.strokeWidth = Math.max(0, parseFloat(layerData.strokeWidth) || 0);
			// Background
			layerData.backgroundPadding = Math.max(0, parseInt(layerData.backgroundPadding) || 0);
			layerData.backgroundCornerRadius = Math.max(0, parseFloat(layerData.backgroundCornerRadius) || 0);
			layerData.backgroundOpacity = Math.max(0, Math.min(1, parseFloat(layerData.backgroundOpacity) ?? 1));
			
			// Ensure colors are valid RGBA strings or default
			layerData.fill = this._ensureRgba(layerData.fill, 'rgba(0,0,0,1)');
			layerData.shadowColor = this._ensureRgba(layerData.shadowColor, 'rgba(0,0,0,0.5)');
			layerData.stroke = this._ensureRgba(layerData.stroke, 'rgba(0,0,0,1)');
			layerData.backgroundColor = this._ensureRgba(layerData.backgroundColor, 'rgba(255,255,255,1)');
		} else if (type === 'image') {
			// Ensure filter values are numbers
			for (const key in layerData.filters) {
				layerData.filters[key] = parseFloat(layerData.filters[key]) || this.defaultFilters[key];
			}
			// Validate blend mode? (Optional, CSS handles invalid values gracefully)
			const validBlendModes = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
			if (!validBlendModes.includes(layerData.blendMode)) {
				layerData.blendMode = 'normal';
			}
		}
		
		// Add to layers array and sort by zIndex
		this.layers.push(layerData);
		this.layers.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
		this._renderLayer(layerData);
		this.updateList();
		return layerData;
	}
	
	_ensureRgba(colorString, defaultColor) {
		if (!colorString) return defaultColor;
		try {
			const tiny = tinycolor(colorString);
			if (tiny.isValid()) {
				return tiny.toRgbString(); // Standardize to rgba()
			}
		} catch (e) { /* Ignore tinycolor errors */
		}
		return defaultColor; // Return default if input is invalid
	}
	
	deleteLayer(layerId, saveHistory = true) {
		const layerIndex = this.layers.findIndex(l => l.id === layerId);
		if (layerIndex > -1) {
			// If the deleted layer was selected, destroy Moveable instance
			if (this.selectedLayerId === layerId && this.moveableInstance) {
				this.moveableInstance.destroy();
				this.moveableInstance = null;
				this.moveableTargetElement = null;
			}
			$(`#${layerId}`).remove();
			this.layers.splice(layerIndex, 1);
			if (this.selectedLayerId === layerId) {
				this.selectLayer(null);
			}
			this._updateZIndices();
			this.updateList();
			if (saveHistory) {
				this.saveState();
			}
		}
	}
	
	deleteSelectedLayer() {
		if (this.selectedLayerId) {
			const layer = this.getLayerById(this.selectedLayerId);
			if (layer && !layer.locked) {
				// Calls deleteLayer which now defaults to saving history
				this.deleteLayer(this.selectedLayerId);
			}
		}
	}
	
	// Updates the layer data in the 'this.layers' array
	updateLayerData(layerId, newData) {
		const layerIndex = this.layers.findIndex(l => l.id === layerId);
		if (layerIndex === -1) return null;
		
		const currentLayer = this.layers[layerIndex];
		const previousContent = currentLayer.content;
		
		const mergedData = {...currentLayer};
		
		// --- Store previous transform/size for Moveable update check ---
		const prevX = currentLayer.x;
		const prevY = currentLayer.y;
		const prevWidth = currentLayer.width;
		const prevHeight = currentLayer.height;
		const prevRotation = currentLayer.rotation;
		const prevScale = currentLayer.scale;
		
		for (const key in newData) {
			if (newData.hasOwnProperty(key)) {
				let value = newData[key];
				console.log(`Updating ${key} for layer ${layerId} value ${value}`);
				
				if (key === 'filters' && typeof value === 'object' && currentLayer.type === 'image') {
					// Merge the incoming filter changes with existing filters
					mergedData.filters = {...currentLayer.filters}; // Start with current
					for (const filterKey in value) {
						if (this.defaultFilters.hasOwnProperty(filterKey)) { // Check if it's a valid filter key
							const filterValue = parseFloat(value[filterKey]);
							mergedData.filters[filterKey] = isNaN(filterValue) ? this.defaultFilters[filterKey] : filterValue;
						}
					}
					continue; // Skip the generic assignment below for 'filters'
				}
				
				if (key === 'definition') { // Handle definition
					if (typeof value !== 'string' || value.trim() === '') {
						value = 'general'; // Fallback if invalid
					}
				}
				
				// Parse/Validate specific properties
				if (['x', 'y', 'width', 'height', 'opacity', 'fontSize', 'lineHeight', 'letterSpacing', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'strokeWidth', 'backgroundPadding', 'backgroundCornerRadius', 'backgroundOpacity', 'rotation', 'scale'].includes(key)) {
					value = value === 'auto' ? 'auto' : parseFloat(value);
					
					if (key === 'opacity' || key === 'backgroundOpacity') value = Math.max(0, Math.min(1, isNaN(value) ? 1 : value));
					if (key === 'fontSize' && isNaN(value)) value = currentLayer.fontSize;
					if (key === 'scale' && (isNaN(value) || value <= 0)) value = currentLayer.scale || 100;
					if (key === 'rotation' && isNaN(value)) value = currentLayer.rotation || 0;
					
				} else if (['zIndex'].includes(key)) {
					value = parseInt(value) || currentLayer.zIndex;
					
				} else if (['fill', 'shadowColor', 'stroke', 'backgroundColor'].includes(key)) {
					value = this._ensureRgba(value, currentLayer[key]); // Ensure valid RGBA
					
				} else if (key === 'blendMode' && currentLayer.type === 'image') {
					const validBlendModes = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
					if (!validBlendModes.includes(value)) {
						value = 'normal'; // Reset to default if invalid
					}
				}
				
				mergedData[key] = value;
				console.log(mergedData);
			}
		}
		
		
		this.layers[layerIndex] = mergedData;
		const updatedLayer = this.layers[layerIndex]; // The final updated data object
		
		if (newData.content !== undefined && newData.content !== previousContent && !newData.name) {
			const currentName = updatedLayer.name;
			const defaultName = this._generateDefaultLayerName(updatedLayer);
			const oldLayerDataForName = {...updatedLayer, content: previousContent};
			const oldDefaultName = this._generateDefaultLayerName(oldLayerDataForName);
			if (currentName === oldDefaultName || !currentName) {
				updatedLayer.name = defaultName;
				this.updateList(); // Update list item name display
			}
		}
		
		// --- Update visual representation ---
		const $element = $(`#${layerId}`);
		if (!$element.length) return null;
		
		// Common properties
		if (newData.x !== undefined) $element.css('left', updatedLayer.x + 'px');
		if (newData.y !== undefined) $element.css('top', updatedLayer.y + 'px');
		if (newData.width !== undefined) $element.css('width', updatedLayer.width === 'auto' ? 'auto' : updatedLayer.width + 'px');
		if (newData.height !== undefined) $element.css('height', updatedLayer.height === 'auto' ? 'auto' : updatedLayer.height + 'px');
		if (newData.opacity !== undefined) $element.css('opacity', updatedLayer.opacity);
		if (newData.visible !== undefined) {
			$element.toggle(updatedLayer.visible);
			$element.toggleClass('layer-hidden', !updatedLayer.visible);
		}
		if (newData.zIndex !== undefined) $element.css('z-index', updatedLayer.zIndex);
		if (newData.locked !== undefined) {
			$element.toggleClass('locked', updatedLayer.locked);
			this._updateElementInteractivity($element, updatedLayer);
		}
		if (newData.rotation !== undefined || newData.scale !== undefined) {
			this._applyTransform($element, updatedLayer);
		}
		
		
		// Type-specific updates
		if (updatedLayer.type === 'text') {
			// ... (text specific updates: content, font, styles) ...
			const $textContent = $element.find('.text-content');
			if (newData.content !== undefined) {
				$textContent.text(updatedLayer.content);
			}
			// Ensure Google Font is loaded if family changes
			if (newData.fontFamily && newData.fontFamily !== currentLayer.fontFamily) {
				this._ensureGoogleFontLoaded(updatedLayer.fontFamily);
			}
			// Re-apply styles if *any* relevant property changed
			const styleProps = [
				'content', 'fontSize', 'fontFamily', 'fontStyle', 'fontWeight', 'textDecoration',
				'fill', 'align', 'vAlign', 'lineHeight', 'letterSpacing',
				'shadowEnabled', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'shadowColor',
				'strokeWidth', 'stroke',
				'backgroundEnabled', 'backgroundColor', 'backgroundOpacity', 'backgroundPadding', 'backgroundCornerRadius',
				'width' // Width change can affect text wrap
			];
			if (Object.keys(newData).some(key => styleProps.includes(key))) {
				console.log("Reapplying text styles for", $textContent, updatedLayer);
				this._applyTextStyles($textContent, updatedLayer);
			}
			// Adjust height if needed
			if (updatedLayer.height === 'auto') {
				$element.css('height', 'auto');
			}
			
		} else if (updatedLayer.type === 'image') {
			if (newData.content !== undefined) {
				$element.find('img').attr('src', updatedLayer.content);
			}
			this._applyStyles($element, updatedLayer); // Apply general styles (border, filters etc)
		}
		
		// --- Update Moveable if this layer is selected and geometry changed ---
		if (this.moveableInstance && this.selectedLayerId === layerId) {
			const geometryChanged = updatedLayer.x !== prevX || updatedLayer.y !== prevY ||
				updatedLayer.width !== prevWidth || updatedLayer.height !== prevHeight ||
				updatedLayer.rotation !== prevRotation || updatedLayer.scale !== prevScale;
			if (geometryChanged) {
				// console.log("Programmatic update detected, updating Moveable rect for", layerId);
				this.moveableInstance.updateRect();
			}
			// Update guidelines if layer visibility status changed
			if (newData.visible !== undefined) {
				this._updateMoveableGuidelines();
			}
		}
		
		// Notify the application that layer data has been updated
		this.onLayerDataUpdate(updatedLayer);
		return updatedLayer;
	}
	
	updateLayerName(layerId, newName) {
		const layer = this.getLayerById(layerId);
		if (layer && layer.name !== newName) {
			layer.name = newName; // Update the name in the list item directly for performance
			const $listItem = this.$layerList.find(`.list-group-item[data-layer-id="${layerId}"]`);
			$listItem.find('.layer-name-display').text(newName); // Update display span
			this.saveState(); // Save history state after name change
		}
	}
	
	getLayerById(layerId) {
		return this.layers.find(l => l.id === layerId);
	}
	
	getLayers() {
		return JSON.parse(JSON.stringify(this.layers));
	}
	
	setLayers(layersData, keepNonTextLayers = false) {
		if (this.moveableInstance) {
			this.moveableInstance.destroy();
			this.moveableInstance = null;
			this.moveableTargetElement = null;
		}
		
		if (!keepNonTextLayers) {
			// this.$canvas.empty(); // This removes everything, including guides
			// Only remove elements that are actual layers managed by LayerManager
			this.$canvas.find('.canvas-element').remove();
			this.layers = [];
		} else {
			console.warn("setLayers called with keepNonTextLayers=true");
		}
		this.selectedLayerId = null;
		
		// Reset uniqueIdCounter based on loaded data
		if (layersData && layersData.length > 0) {
			const maxId = Math.max(0, ...layersData.map(l => {
				const parts = (l.id || '').split('-');
				const num = parseInt(parts[1] || '0');
				return isNaN(num) ? 0 : num;
			}));
			this.uniqueIdCounter = Math.max(this.uniqueIdCounter, maxId + 1);
		} else if (!keepNonTextLayers) {
			this.uniqueIdCounter = 0;
		}
		
		const sortedLayers = [...layersData].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
		
		// Preload fonts before rendering
		sortedLayers.forEach(layerData => {
			if (layerData.type === 'text') {
				this._ensureGoogleFontLoaded(layerData.fontFamily);
			}
		});
		
		// Add layers, ensuring defaults and handling potential ID issues if merging
		sortedLayers.forEach(layerData => {
			if (!layerData.name) {
				layerData.name = this._generateDefaultLayerName(layerData);
			}
			if (keepNonTextLayers || !layerData.id || this.getLayerById(layerData.id)) {
				layerData.id = this._generateId();
			}
			if (layerData.definition === undefined) {
				layerData.definition = 'general';
			}
			const addedLayer = this.addLayer(layerData.type, layerData);
			if (layerData.zIndex !== undefined && addedLayer) {
				addedLayer.zIndex = parseInt(layerData.zIndex) || addedLayer.zIndex;
				$(`#${addedLayer.id}`).css('z-index', addedLayer.zIndex);
			}
		});
		
		// Final sort and Z-index update after all are added
		this.layers.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
		this._updateZIndices();
		
		this.updateList();
		this.selectLayer(null); // Deselect after load
	}
	
	// --- Selection ---
	selectLayer(layerId) {
		if (this.selectedLayerId === layerId) {
			// If clicking the same layer, ensure Moveable is visible (it might hide on canvas click)
			if (this.moveableInstance) this.moveableInstance.updateRect();
			return;
		}
		
		if (this.selectedLayerId) {
			$(`#${this.selectedLayerId}`).removeClass('selected');
		}
		
		this.$layerList.find('.list-group-item.active').removeClass('active');
		
		// Destroy existing Moveable instance
		if (this.moveableInstance) {
			this.moveableInstance.destroy();
			this.moveableInstance = null;
			this.moveableTargetElement = null;
		}
		
		this.selectedLayerId = layerId;
		const selectedLayer = this.getSelectedLayer();
		
		if (selectedLayer) {
			const $element = $(`#${selectedLayer.id}`);
			$element.addClass('selected');
			this.$layerList.find(`.list-group-item[data-layer-id="${layerId}"]`).addClass('active');
			
			// --- Initialize Moveable for the new selection ---
			this.moveableTargetElement = $element[0]; // Get the DOM element
			if (this.moveableTargetElement && selectedLayer.visible && !selectedLayer.locked) {
				console.log("Creating Moveable instance for", selectedLayer.id);
				this._createMoveableInstance(this.moveableTargetElement, selectedLayer);
			}
		}
		this.onLayerSelect(selectedLayer); // Call App callback
	}
	
	_createMoveableInstance(targetElement, layerData) {
		if (this.moveableInstance) {
			this.moveableInstance.destroy();
		}
		
		$(".canvas-element").removeClass('moveable-dragging');
		$(".canvas-element").removeClass('moveable-resizing');
		
		const self = this;
		const layerId = layerData.id;
		const guidelines = this._calculateGuidelines(layerId);
		console.log("Moveable guidelines:", guidelines);
		
		let initialDragData = {x: layerData.x, y: layerData.y};
		let initialResizeData = {x: layerData.x, y: layerData.y, width: layerData.width, height: layerData.height};
		
		this.moveableInstance = new Moveable(this.$canvas[0], { // Parent element
			target: targetElement,
			container: this.$canvas[0], // Keep transforms relative to canvas
			draggable: true,
			resizable: true,
			scalable: false,
			rotatable: false,
			keepRatio: false, // Allow free transform, Shift key usually enforces ratio
			snappable: true,
			isDisplayInnerSnapDigit: false,
			isDisplaySnapDigit: false,
			snapDirections: {
				top: true,
				left: true,
				bottom: true,
				right: true,
				center: true,
				middle: true
			},
			elementSnapDirections: {
				top: true,
				left: true,
				bottom: true,
				right: true,
				center: true,
				middle: true
			},
			maxSnapElementGuidelineDistance: 150,
			snapCenter: true,
			snapThreshold: 5, // Adjust as needed
			elementGuidelines: guidelines.elementGuidelines, // Other elements
			verticalGuidelines: guidelines.verticalGuidelines, // Canvas V lines
			horizontalGuidelines: guidelines.horizontalGuidelines, // Canvas H lines
			throttleDrag: 0,
			throttleResize: 0,
			throttleScale: 0,
			throttleRotate: 0,
			renderDirections: ["nw", "n", "ne", "w", "e", "sw", "s", "se"],
			origin: false, // Rotate/scale around center
			zoom: 3,
			padding: {"left": 0, "top": 0, "right": 0, "bottom": 0}, // Default padding
		});
		
		// --- Moveable Event Handlers ---
		
		this.moveableInstance
			.on("dragStart", ({inputEvent, set}) => {
				const layer = self.getLayerById(layerId);
				console.log("Moveable dragStart", layer);
				if (!layer || layer.locked) {
					inputEvent.stopPropagation();
					return false;
				}
				// Store the starting position from layer data
				initialDragData = {x: layer.x, y: layer.y};
				set([initialDragData.x, initialDragData.y]); // Sync Moveable's internal start position
				$(targetElement).addClass('moveable-dragging');
			})
			.on("drag", ({target, left, top, beforeTranslate, inputEvent}) => {
				// inputEvent is native mouse event
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) return false;
				
				target.style.left = `${left}px`;
				target.style.top = `${top}px`;
			})
			.on("dragEnd", ({target, isDrag, lastEvent, inputEvent}) => {
				// inputEvent is native mouse event
				$(target).removeClass('moveable-dragging');
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked || !isDrag || !lastEvent) return;
				
				// Use the final calculated left/top from the last drag event
				const finalX = lastEvent.left;
				const finalY = lastEvent.top;
				
				// Check if position actually changed (use rounding for robustness)
				if (Math.round(finalX) !== Math.round(initialDragData.x) || Math.round(finalY) !== Math.round(initialDragData.y)) {
					// Update layer data. This will internally update styles again.
					self.updateLayerData(layerId, {x: finalX, y: finalY});
					self.saveState(); // Save history AFTER the change is committed
				} else {
					// If no change, ensure styles are exactly as per data (handles potential rounding issues)
					target.style.left = `${layer.x}px`;
					target.style.top = `${layer.y}px`;
				}
			})
			.on("resizeStart", ({inputEvent, setOrigin, dragStart}) => {
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) {
					inputEvent.stopPropagation();
					return false;
				}
				// Store initial size and position
				initialResizeData = {x: layer.x, y: layer.y, width: layer.width, height: layer.height};
				
				setOrigin(["%", "%"]); // Keep origin at center for scaling/resizing appearance
				
				// If dragStart is available, link it to the initial position
				if (dragStart) {
					dragStart.set([initialResizeData.x, initialResizeData.y]);
				}
				
				$(targetElement).addClass('moveable-resizing');
			})
			.on("resize", ({target, width, height, drag, delta, dist, transform, inputEvent}) => {
				// inputEvent is native mouse event
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) return false;
				
				// Apply width and height directly for feedback
				target.style.width = `${width}px`;
				target.style.height = `${height}px`;
				target.style.transform = drag.transform;
			})
			.on("resizeEnd", ({target, isDrag, lastEvent, inputEvent}) => {
				// inputEvent is native mouse event
				$(target).removeClass('moveable-resizing');
				const layer = self.getLayerById(layerId); // Get the layer data *before* update
				if (!layer || layer.locked || !isDrag || !lastEvent) return;
				
				const finalWidth = lastEvent.width;
				const finalHeight = lastEvent.height;
				
				let parsedTransform = this._parseTransformString(lastEvent.drag.transform);
				console.log(parsedTransform);
				const finalX = initialResizeData.x + parsedTransform.translate.x;
				const finalY = initialResizeData.y + parsedTransform.translate.y;
				
				// Check if position or dimensions actually changed
				const positionChanged = Math.round(finalX) !== Math.round(initialResizeData.x) || Math.round(finalY) !== Math.round(initialResizeData.y);
				const dimensionsChanged = Math.round(finalWidth) !== Math.round(initialResizeData.width) || Math.round(finalHeight) !== Math.round(initialResizeData.height);
				
				if (positionChanged || dimensionsChanged) {
					self.updateLayerData(layerId, {
						width: finalWidth,
						height: finalHeight,
						x: finalX,
						y: finalY
					});
					self.saveState(); // Save history
				}
				
				const updatedLayer = self.getLayerById(layerId); // Get potentially updated data
				if (updatedLayer) {
					self._applyTransform($(target), updatedLayer);
				}
				
				// Crucial: Tell Moveable to update its internal calculation based on the final styles
				if (self.moveableInstance) {
					// Use requestAnimationFrame to ensure styles are applied before updateRect
					requestAnimationFrame(() => {
						if (self.moveableInstance) { // Check again as it might be destroyed
							self.moveableInstance.updateRect();
						}
					});
				}
			});
		
		// Initial positioning update if needed (usually okay, but safe)
		this.moveableInstance.updateRect();
	}
	
	_parseTransformString(transformString) {
		// Extract translate values
		const translateRegex = /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)/;
		const translateMatch = transformString.match(translateRegex);
		
		// Extract rotate value
		const rotateRegex = /rotate\(([-\d.e]+)deg\)/;
		const rotateMatch = transformString.match(rotateRegex);
		
		// Extract scale value
		const scaleRegex = /scale\(([-\d.e]+)\)/;
		const scaleMatch = transformString.match(scaleRegex);
		
		return {
			translate: {
				x: translateMatch ? parseFloat(translateMatch[1]) : 0,
				y: translateMatch ? parseFloat(translateMatch[2]) : 0
			},
			rotate: rotateMatch ? parseFloat(rotateMatch[1]) : 0,
			scale: scaleMatch ? parseFloat(scaleMatch[1]) : 1
		};
	}
	
	_calculateGuidelines(currentLayerId) {
		const canvasWidth = this.canvasManager.currentCanvasWidth;
		const canvasHeight = this.canvasManager.currentCanvasHeight;
		const safeZoneMargin = 100; // px
		
		// Canvas Center Guidelines
		let verticalGuidelines = [0, canvasWidth / 2, canvasWidth];
		let horizontalGuidelines = [0, canvasHeight / 2, canvasHeight];
		
		// Spine/Back Cover Guidelines (from CanvasManager properties)
		// These are only added if CanvasManager created the visual guides,
		// which happens if spineWidth > 0 and backCoverWidth > 0.
		if (this.canvasManager.spineWidth > 0 && this.canvasManager.backCoverWidth > 0) {
			verticalGuidelines.push(this.canvasManager.backCoverWidth);
			verticalGuidelines.push(this.canvasManager.backCoverWidth + this.canvasManager.spineWidth);
		}
		// console.log("After spine guides, Vertical guidelines:", verticalGuidelines);
		
		// Safe Zone Guidelines (100px inset from canvas edges)
		if (canvasWidth > safeZoneMargin * 2) { // Ensure canvas is wide enough
			verticalGuidelines.push(safeZoneMargin);
			verticalGuidelines.push(canvasWidth - safeZoneMargin);
		}
		if (canvasHeight > safeZoneMargin * 2) { // Ensure canvas is tall enough
			horizontalGuidelines.push(safeZoneMargin);
			horizontalGuidelines.push(canvasHeight - safeZoneMargin);
		}
		// console.log("After safe zone, Vertical guidelines:", verticalGuidelines);
		
		// Element Guidelines (other visible, non-locked layers)
		const elementGuidelines = this.layers
			.filter(l => l.id !== currentLayerId && l.visible && !l.locked)
			.map(l => document.getElementById(l.id))
			.filter(el => el); // Filter out nulls if element not found
		
		// Remove duplicates and sort, filter out NaN/undefined
		const uniqueVertical = [...new Set(verticalGuidelines.filter(v => typeof v === 'number' && !isNaN(v)))].sort((a, b) => a - b);
		const uniqueHorizontal = [...new Set(horizontalGuidelines.filter(h => typeof h === 'number' && !isNaN(h)))].sort((a, b) => a - b);
		
		// console.log("Final Vertical guidelines for Moveable:", uniqueVertical);
		// console.log("Final Horizontal guidelines for Moveable:", uniqueHorizontal);
		
		return {
			verticalGuidelines: uniqueVertical,
			horizontalGuidelines: uniqueHorizontal,
			elementGuidelines
		};
	}
	
	// Call this if guidelines need refreshing (e.g., layer added/deleted/visibility changed)
	_updateMoveableGuidelines() {
		if (this.moveableInstance && this.selectedLayerId) {
			const guidelines = this._calculateGuidelines(this.selectedLayerId);
			this.moveableInstance.verticalGuidelines = guidelines.verticalGuidelines;
			this.moveableInstance.horizontalGuidelines = guidelines.horizontalGuidelines;
			this.moveableInstance.elementGuidelines = guidelines.elementGuidelines;
			// console.log("Updated Moveable guidelines");
		}
	}
	
	getSelectedLayer() {
		return this.getLayerById(this.selectedLayerId);
	}
	
	// --- Visibility & Locking ---
	toggleLayerVisibility(layerId) {
		const layer = this.getLayerById(layerId);
		if (layer) {
			layer.visible = !layer.visible;
			const $element = $(`#${layerId}`);
			$element.toggle(layer.visible);
			$element.toggleClass('layer-hidden', !layer.visible);
			
			// Update Moveable if the selected layer's visibility changed
			if (layerId === this.selectedLayerId) {
				this._updateElementInteractivity($element, layer);
			}
			// Update guidelines as visibility changed
			this._updateMoveableGuidelines();
			
			this.updateList();
			this.saveState();
		}
	}
	
	// UPDATED: Added saveHistory parameter
	toggleLockLayer(layerId, saveHistory = true) {
		const layer = this.getLayerById(layerId);
		
		if (layer) {
			layer.locked = !layer.locked;
			this.updateLayerData(layerId, {locked: layer.locked});
			this.updateList();
			
			if (layerId === this.selectedLayerId) {
				this.onLayerSelect(layer);
			}
			
			if (saveHistory) {
				this.saveState();
			}
		}
	}
	
	toggleSelectedLayerLock() {
		if (this.selectedLayerId) {
			this.toggleLockLayer(this.selectedLayerId);
		}
	}
	
	toggleSelectedLayerVisibility() {
		if (this.selectedLayerId) {
			this.toggleLayerVisibility(this.selectedLayerId);
		}
	}
	
	// --- Layer Order (Z-Index) ---
	moveLayer(layerId, direction) {
		// Ensure this.layers is sorted by zIndex, which should be maintained by other operations.
		const layerIndex = this.layers.findIndex(l => l.id === layerId);
		if (layerIndex === -1) return;
		
		const currentLayers = [...this.layers]; // Create a mutable copy
		
		if (direction === 'front') {
			if (layerIndex === currentLayers.length - 1) return; // Already at front
			const layerToMove = currentLayers.splice(layerIndex, 1)[0];
			currentLayers.push(layerToMove);
		} else if (direction === 'back') {
			if (layerIndex === 0) return; // Already at back
			const layerToMove = currentLayers.splice(layerIndex, 1)[0];
			currentLayers.unshift(layerToMove);
		} else if (direction === 'up') {
			if (layerIndex < currentLayers.length - 1) { // Can move up
				// Swap with the element at currentLayers[layerIndex + 1]
				const temp = currentLayers[layerIndex + 1];
				currentLayers[layerIndex + 1] = currentLayers[layerIndex];
				currentLayers[layerIndex] = temp;
			} else {
				return; // Already at the top
			}
		} else if (direction === 'down') {
			if (layerIndex > 0) { // Can move down
				// Swap with the element at currentLayers[layerIndex - 1]
				const temp = currentLayers[layerIndex - 1];
				currentLayers[layerIndex - 1] = currentLayers[layerIndex];
				currentLayers[layerIndex] = temp;
			} else {
				return; // Already at the bottom
			}
		} else {
			console.warn("Unknown moveLayer direction:", direction);
			return;
		}
		
		// Update the main layers array with the new order
		this.layers = currentLayers;
		
		// Re-assign zIndex based on the new order in this.layers
		this.layers.forEach((layer, index) => {
			layer.zIndex = index + 1; // Assign 1-based zIndex
		});
		
		// _updateZIndices will sort by zIndex (which is now consistent with array order)
		// and update CSS z-index for all layers.
		this._updateZIndices();
		this.updateList();    // Update the visual layer list panel
		this.saveState();     // Save history
	}
	
	moveSelectedLayer(direction) {
		if (this.selectedLayerId) {
			const layer = this.getLayerById(this.selectedLayerId);
			if (layer && !layer.locked) {
				this.moveLayer(this.selectedLayerId, direction);
			}
		}
	}
	
	_updateZIndices() {
		this.layers.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
		this.layers.forEach((layer, index) => {
			// layer.zIndex = index + 1; // This line is now handled before calling _updateZIndices
			$(`#${layer.id}`).css('z-index', layer.zIndex || 0);
		});
	}
	
	_applyTransform($element, layerData) {
		const rotation = layerData.rotation || 0;
		const scale = (layerData.scale || 100) / 100; // Convert percentage to decimal
		$element.css({
			'transform': `rotate(${rotation}deg) scale(${scale})`,
			'transform-origin': 'center center' // Ensure rotation/scale happens around the center
		});
	}
	
	// --- Rendering & Interaction ---
	_renderLayer(layerData) { /* ... Update slightly ... */
		const $element = $(`<div class="canvas-element" id="${layerData.id}"></div>`)
			.css({
				position: 'absolute',
				left: layerData.x + 'px',
				top: layerData.y + 'px',
				width: layerData.width === 'auto' ? 'auto' : layerData.width + 'px',
				height: layerData.height === 'auto' ? 'auto' : layerData.height + 'px',
				zIndex: layerData.zIndex || 0,
				opacity: layerData.opacity ?? 1,
				display: layerData.visible ? 'block' : 'none',
			})
			.data('layerId', layerData.id);
		
		if (!layerData.visible) $element.addClass('layer-hidden');
		if (layerData.locked) $element.addClass('locked');
		
		if (layerData.type === 'text') {
			this._ensureGoogleFontLoaded(layerData.fontFamily);
			const $textContent = $('<div class="text-content"></div>');
			
			$textContent.text(layerData.content || '');
			$element.append($textContent);
			this._applyTextStyles($textContent, layerData);
			
			if (layerData.height === 'auto') $element.css('height', 'auto');
			
		} else if (layerData.type === 'image') {
			const $img = $('<img>')
				.attr('src', layerData.content)
				.css({
					display: 'block',
					width: '100%',
					height: '100%',
					objectFit: 'cover', // Or 'contain' depending on desired default
					userSelect: 'none',
					'-webkit-user-drag': 'none',
					pointerEvents: 'none',
				})
				.on('error', function () {
					console.error("Failed to load image:", layerData.content);
					$(this).parent().addClass('load-error'); // Add class to parent
				});
			
			$element.append($img);
			this._applyStyles($element, layerData);
		}
		this._applyTransform($element, layerData);
		
		this.$canvas.append($element);
		//this._makeElementInteractive($element, layerData);
	}
	
	_makeElementInteractive($element, layerData) {
		return;
		const layerId = layerData.id;
		const self = this;
		
		// Remove previous listeners if any (safety)
		$element.off('click.layerManager');
		
		// Single click to select
		$element.on('click.layerManager', (e) => {
			e.stopPropagation(); // Prevent click bubbling to canvas area
			self.selectLayer(layerId);
		});
		
		// Ensure initial interactivity state is correct (cursor, disabled class)
		this._updateElementInteractivity($element, layerData);
	}
	
	
	_updateElementInteractivity($element, layerData) {
		const isLocked = layerData.locked;
		const isHidden = !layerData.visible;
		
		$element.toggleClass('interactions-disabled', isHidden);
		$element.css('cursor', isLocked ? 'default' : 'grab');
		
		// If the layer is currently selected AND becomes disabled, destroy Moveable
		if (this.selectedLayerId === layerData.id && isHidden && this.moveableInstance) {
			console.log("Destroying Moveable for disabled/locked layer:", layerData.id);
			this.moveableInstance.destroy();
			this.moveableInstance = null;
			this.moveableTargetElement = null;
		}
		// If the layer is currently selected AND becomes enabled, create Moveable (if not already present)
		else if (this.selectedLayerId === layerData.id && !isHidden && !isLocked && !this.moveableInstance) {
			console.log("Recreating Moveable for enabled layer:", layerData.id);
			this.moveableTargetElement = $element[0];
			this._createMoveableInstance(this.moveableTargetElement, layerData);
		}
	}
	
	
	_applyTextStyles($textContent, layerData) {
		if (!$textContent || !layerData) return;
		
		let fontFamily = layerData.fontFamily || 'Arial';
		if (fontFamily.includes(' ') && !fontFamily.startsWith("'") && !fontFamily.startsWith('"')) {
			fontFamily = `"${fontFamily}"`;
		}
		
		// Apply styles to the INNER text content div
		$textContent.css({
			fontFamily: fontFamily,
			fontSize: (layerData.fontSize || 16) + 'px',
			fontWeight: layerData.fontWeight || 'normal',
			fontStyle: layerData.fontStyle || 'normal',
			textDecoration: layerData.textDecoration || 'none',
			color: layerData.fill || 'rgba(0,0,0,1)',
			
			textAlign: layerData.align || 'left',
			justifyContent: layerData.align || 'left',
			alignItems: layerData.vAlign || 'center',
			display: 'flex',
			
			lineHeight: layerData.lineHeight || 1.3,
			letterSpacing: (layerData.letterSpacing || 0) + 'px',
			border: 'none', // Text content itself shouldn't have border
			outline: 'none',
			whiteSpace: 'pre-wrap',
			wordWrap: 'break-word',
			boxSizing: 'border-box',
			width: '100%', // Take full width of parent
			height: '100%', // Take full height of parent
		});
		
		// Text Shadow
		if (layerData.shadowEnabled && layerData.shadowColor) {
			const shadow = `${layerData.shadowOffsetX || 0}px ${layerData.shadowOffsetY || 0}px ${layerData.shadowBlur || 0}px ${layerData.shadowColor}`;
			$textContent.css('text-shadow', shadow);
		} else {
			$textContent.css('text-shadow', 'none');
		}
		
		// Text Stroke (Outline) - Apply to text content
		const strokeWidth = parseFloat(layerData.strokeWidth) || 0;
		if (strokeWidth > 0 && layerData.stroke) {
			const strokeColor = layerData.stroke || 'rgba(0,0,0,1)';
			// Use vendor prefixes for wider compatibility
			$textContent.css({
				'-webkit-text-stroke-width': strokeWidth + 'px',
				'-webkit-text-stroke-color': strokeColor,
				'text-stroke-width': strokeWidth + 'px', // Standard property
				'text-stroke-color': strokeColor,     // Standard property
				'paint-order': 'stroke fill' // Ensures stroke is behind fill
			});
		} else {
			$textContent.css({
				'-webkit-text-stroke-width': '0',
				'text-stroke-width': '0'
			});
		}
		
		
		// --- Styles for the PARENT .canvas-element div ---
		const $parentElement = $textContent.parent('.canvas-element');
		if (!$parentElement.length) return;
		
		// Parent Background
		if (layerData.backgroundEnabled && layerData.backgroundColor) {
			let bgColor = this._ensureRgba(layerData.backgroundColor, 'rgba(255,255,255,1)');
			// Apply separate background opacity if needed
			// Note: RGBA already includes opacity, but backgroundOpacity might override
			// Let's prioritize backgroundOpacity if it's < 1
			const bgOpacity = layerData.backgroundOpacity ?? 1;
			if (bgOpacity < 1) {
				try {
					let tiny = tinycolor(bgColor);
					if (tiny.isValid()) {
						bgColor = tiny.setAlpha(bgOpacity).toRgbString();
					}
				} catch (e) { /* Ignore */
				}
			}
			
			$parentElement.css({
				backgroundColor: bgColor,
				borderRadius: (layerData.backgroundCornerRadius || 0) + 'px',
				padding: (layerData.backgroundPadding || 0) + 'px',
			});
			// Re-evaluate parent height if text content drives it
			if (layerData.height === 'auto') $parentElement.css('height', 'auto');
			
		} else {
			$parentElement.css({
				backgroundColor: 'transparent',
				borderRadius: '0',
			});
			// Re-evaluate parent height if text content drives it
			if (layerData.height === 'auto') $parentElement.css('height', 'auto');
		}
	}
	
	_applyStyles($element, layerData) {
		// General styles for non-text elements (e.g., images)
		if (!$element || !layerData) return;
		
		// Apply to the main element container
		$element.css({
			mixBlendMode: layerData.blendMode || 'normal',
			// Add other container styles if needed (e.g., box-shadow)
		});
		
		// Apply filters specifically to the image tag within the container
		const $img = $element.find('img');
		if ($img.length > 0 && layerData.type === 'image') {
			let filterString = '';
			const filters = layerData.filters || this.defaultFilters;
			// Build filter string, only including non-default values
			if (filters.brightness !== 100) filterString += `brightness(${filters.brightness}%) `;
			if (filters.contrast !== 100) filterString += `contrast(${filters.contrast}%) `;
			if (filters.saturation !== 100) filterString += `saturate(${filters.saturation}%) `; // CSS uses 'saturate'
			if (filters.grayscale !== 0) filterString += `grayscale(${filters.grayscale}%) `;
			if (filters.sepia !== 0) filterString += `sepia(${filters.sepia}%) `;
			if (filters.hueRotate !== 0) filterString += `hue-rotate(${filters.hueRotate}deg) `;
			if (filters.blur !== 0) filterString += `blur(${filters.blur}px) `;
			
			$img.css('filter', filterString.trim() || 'none');
		}
	}
	
	
	// --- Layer List Panel ---
	initializeList() {
		this.$layerList.sortable({
			axis: 'y',
			containment: 'parent',
			placeholder: 'ui-sortable-placeholder list-group-item', // Class for placeholder style
			helper: 'clone', // Use a clone of the item while dragging
			items: '> li:not(.text-muted)', // Only allow sorting actual layer items
			tolerance: 'pointer', // Start sorting when pointer overlaps item
			cursor: 'grabbing', // Visual feedback
			update: (event, ui) => {
				// Get the new order of layer IDs from the DOM (top item in list = highest zIndex)
				const newOrderIds = this.$layerList.find('.list-group-item[data-layer-id]')
					.map(function () {
						return $(this).data('layerId');
					})
					.get()
					.reverse(); // Reverse because visually top = highest zIndex
				
				// Reorder the internal 'layers' array based on the new DOM order
				this.layers.sort((a, b) => {
					const indexA = newOrderIds.indexOf(a.id);
					const indexB = newOrderIds.indexOf(b.id);
					// Handle potential errors where an ID might not be found
					if (indexA === -1) return 1;
					if (indexB === -1) return -1;
					return indexA - indexB; // Sort based on position in the reversed DOM order
				});
				
				// Reassign zIndex based on the new sorted array order and update CSS
				this.layers.forEach((layer, index) => {
					layer.zIndex = index + 1; // Assign 1-based zIndex
					$(`#${layer.id}`).css('z-index', layer.zIndex);
				});
				
				// Save the new state after reordering
				this.saveState();
				
				// No need to call updateList() here, sortable handles the DOM move.
				// We just need to update the internal data and CSS z-index.
			}
		});
		this.updateList(); // Initial rendering of the list
	}
	
	updateList() {
		this.$layerList.empty(); // Clear the current list
		
		if (this.layers.length === 0) {
			this.$layerList.append('<li class="list-group-item text-muted">No layers yet.</li>');
			// Disable sortable if list is empty
			if (this.$layerList.hasClass('ui-sortable')) {
				try {
					this.$layerList.sortable('disable');
				} catch (e) { /* Ignore error if not initialized */
				}
			}
			return;
		}
		
		// Enable sortable if list has items
		if (this.$layerList.hasClass('ui-sortable')) {
			try {
				this.$layerList.sortable('enable');
			} catch (e) { /* Ignore error if not initialized */
			}
		}
		
		const self = this; // Reference LayerManager for event handlers
		
		// Iterate in reverse array order (highest zIndex first visually)
		[...this.layers].reverse().forEach(layer => {
			const iconClass = layer.type === 'text' ? 'fa-font' : (layer.type === 'image' ? 'fa-image' : 'fa-square');
			const layerName = layer.name || this._generateDefaultLayerName(layer); // Use stored name or generate default
			
			// Determine lock icon/title
			const lockIconClass = layer.locked ? 'fas fa-lock lock-icon locked' : 'fas fa-lock-open lock-icon';
			const lockTitle = layer.locked ? 'Unlock Layer' : 'Lock Layer';
			
			// Determine visibility icon/title
			const visibilityIconClass = layer.visible ? 'fas fa-eye' : 'fas fa-eye-slash';
			const visibilityTitle = layer.visible ? 'Hide Layer' : 'Show Layer';
			
			// Add class if layer is hidden for potential styling
			const itemHiddenClass = layer.visible ? '' : 'layer-item-hidden';
			
			const $item = $(`
                <li class="list-group-item ${itemHiddenClass}" data-layer-id="${layer.id}">
                    <div class="d-flex align-items-center">
                        <span class="layer-icon me-2"><i class="fas ${iconClass}"></i></span>
                        <span class="layer-name flex-grow-1 me-2">
                            <span class="layer-name-display" title="Double-click to rename">${$('<div>').text(layerName).html()}</span> <!-- Encode name -->
                        </span>
                        <span class="layer-controls ms-auto d-flex align-items-center flex-shrink-0">
                            <button class="btn btn-outline-secondary btn-sm toggle-visibility me-1 p-1" title="${visibilityTitle}">
                                <i class="${visibilityIconClass}"></i>
                            </button>
                            <button class="btn btn-outline-secondary btn-sm lock-layer me-1 p-1" title="${lockTitle}">
                                <i class="${lockIconClass}"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-sm delete-layer p-1" title="Delete Layer">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </span>
                    </div>
                </li>
            `);
			
			// Highlight if selected
			if (this.selectedLayerId === layer.id) {
				$item.addClass('active');
			}
			
			// --- Attach Event Listeners ---
			
			// Click on the item (but not controls or name) to select the layer
			$item.on('click', (e) => {
				// Check if the click target or its parent is one of the controls or the editable name span
				if (!$(e.target).closest('button, input').length) {
					self.selectLayer(layer.id);
				}
			});
			
			// --- Rename functionality ---
			const $nameDisplay = $item.find('.layer-name-display');
			const $nameContainer = $item.find('.layer-name'); // The container span
			
			$nameDisplay.on('dblclick', (e) => {
				e.stopPropagation(); // Prevent item selection trigger
				const currentLayer = self.getLayerById(layer.id);
				if (!currentLayer || currentLayer.locked) return; // Don't rename locked layers
				
				const currentName = currentLayer.name || '';
				$nameDisplay.hide(); // Hide the display span
				
				// Create and configure the input field
				const $input = $('<input type="text" class="form-control form-control-sm layer-name-input">')
					.val(currentName)
					.on('blur keydown', (event) => {
						// Check if blur or Enter key (13) or Escape key (27)
						if (event.type === 'blur' || event.key === 'Enter' || event.key === 'Escape') {
							event.preventDefault();
							event.stopPropagation();
							
							const $currentInput = $(event.target); // Use event.target
							const newName = $currentInput.val().trim();
							
							// Remove input and show display span regardless of action
							$currentInput.remove();
							$nameDisplay.show();
							
							// Save if name changed and wasn't cancelled by Escape
							if (event.key !== 'Escape' && newName && newName !== currentName) {
								self.updateLayerName(layer.id, newName); // This handles data update and saveState
								$nameDisplay.text(newName); // Update display immediately
							} else {
								$nameDisplay.text(currentName); // Revert display if cancelled or no change
							}
						}
					})
					.on('click', (ev) => ev.stopPropagation()); // Prevent item selection when clicking input
				
				// Append input, focus and select text
				$nameContainer.append($input);
				$input.trigger('focus').trigger('select');
			});
			// --- END Rename ---
			
			// Visibility toggle button
			$item.find('.toggle-visibility').on('click', (e) => {
				e.stopPropagation();
				self.toggleLayerVisibility(layer.id); // Handles data, visibility, list update, saveState
			});
			
			// Lock toggle button
			$item.find('.lock-layer').on('click', (e) => {
				e.stopPropagation();
				self.toggleLockLayer(layer.id); // Handles data, lock state, list update, saveState
			});
			
			// Delete button
			$item.find('.delete-layer').on('click', (e) => {
				e.stopPropagation();
				const currentLayer = self.getLayerById(layer.id);
				// Don't allow deleting locked layers via the list item button
				if (currentLayer && currentLayer.locked) {
					alert("Cannot delete a locked layer. Please unlock it first.");
					return;
				}
				
				const confirmName = currentLayer?.name || `Layer ${layer.id}`;
				if (confirm(`Are you sure you want to delete layer "${confirmName}"?`)) {
					self.deleteLayer(layer.id); // Handles data, removal, list update, saveState
				}
			});
			
			this.$layerList.append($item); // Add the fully configured item to the list
		});
		
		// Refresh sortable to recognize new items
		if (this.$layerList.hasClass('ui-sortable')) {
			try {
				this.$layerList.sortable('refresh');
			} catch (e) { /* Ignore */
			}
		}
	}
	
} // End of LayerManager class
