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
	
	// --- Core Layer Management ---
	// Generates a short, unique ID
	_generateId() {
		return `layer-${this.uniqueIdCounter++}`;
	}
	
	// --- NEW: Helper to generate default layer name ---
	_generateDefaultLayerName(layerData) {
		if (layerData.type === 'text') {
			const textContent = (layerData.content || '').trim();
			if (textContent) {
				return textContent.substring(0, 30) + (textContent.length > 30 ? '...' : '');
			}
			return 'Text Layer'; // Default if empty
		} else if (layerData.type === 'image') {
			try {
				// Try to extract filename from URL
				const url = new URL(layerData.content, window.location.href); // Provide base URL for relative paths
				const pathParts = url.pathname.split('/');
				const filename = decodeURIComponent(pathParts[pathParts.length - 1]); // Decode URI component
				if (filename) {
					// Remove extension for cleaner name (optional)
					const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
					return nameWithoutExt.substring(0, 30) + (nameWithoutExt.length > 30 ? '...' : '');
				}
			} catch (e) {
				// Ignore errors (e.g., base64 data URI)
			}
			// Fallback name
			const numericIdPart = layerData.id ? layerData.id.split('-')[1] : 'New';
			return `Image ${numericIdPart}`;
		}
		// Default for other types
		const numericIdPart = layerData.id ? layerData.id.split('-')[1] : 'New';
		return `Layer ${numericIdPart}`;
	}
	
	// --- END NEW HELPER ---
	
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
			// Text specific defaults
			content: type === 'text' ? 'New Text' : '',
			fontSize: 24,
			fontFamily: 'Arial',
			fontStyle: 'normal',
			fontWeight: 'normal',
			textDecoration: 'none',
			fill: 'rgba(0,0,0,1)',
			align: 'left',
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
	
	// UPDATED: Added saveHistory parameter
	deleteLayer(layerId, saveHistory = true) {
		const layerIndex = this.layers.findIndex(l => l.id === layerId);
		if (layerIndex > -1) {
			$(`#${layerId}`).remove(); // Remove element from canvas
			this.layers.splice(layerIndex, 1); // Remove data from array
			if (this.selectedLayerId === layerId) {
				this.selectLayer(null); // Deselect if deleted layer was selected
			}
			this._updateZIndices(); // Renumber zIndex for remaining layers
			this.updateList(); // Update sidebar list
			// MODIFIED: Only save state if requested
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
		
		for (const key in newData) {
			if (newData.hasOwnProperty(key)) {
				let value = newData[key];
				
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
				
				// Parse/Validate specific properties (same as before)
				if (['x', 'y', 'width', 'height', 'opacity', 'fontSize', 'lineHeight', 'letterSpacing', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'strokeWidth', 'backgroundPadding', 'backgroundCornerRadius', 'backgroundOpacity'].includes(key)) {
					value = value === 'auto' ? 'auto' : parseFloat(value);
					if (key === 'opacity' || key === 'backgroundOpacity') value = Math.max(0, Math.min(1, isNaN(value) ? 1 : value)); // Ensure value is number before clamp
					if (key === 'fontSize' && isNaN(value)) value = currentLayer.fontSize;
					
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
				'fill', 'align', 'lineHeight', 'letterSpacing',
				'shadowEnabled', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'shadowColor',
				'strokeWidth', 'stroke',
				'backgroundEnabled', 'backgroundColor', 'backgroundOpacity', 'backgroundPadding', 'backgroundCornerRadius',
				'width' // Width change can affect text wrap
			];
			if (Object.keys(newData).some(key => styleProps.includes(key))) {
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
		
		// Notify the application that layer data has been updated
		this.onLayerDataUpdate(updatedLayer);
		return updatedLayer;
	}
	
	// Convenience method for updating a single style-like property
	updateLayerStyle(layerId, property, value) {
		const layer = this.getLayerById(layerId);
		if (layer) {
			const update = {[property]: value};
			// Handle specific conversions or related properties
			if (property === 'fill') { /* ... */
			} else if (property === 'fontSize') {
				value = parseFloat(value) || layer.fontSize;
				update[property] = value;
			}
			// Add more specific handling if needed
			this.updateLayerData(layerId, update);
		}
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
		if (!keepNonTextLayers) {
			this.$canvas.empty();
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
			return;
		}
		if (this.selectedLayerId) {
			$(`#${this.selectedLayerId}`).removeClass('selected');
		}
		this.$layerList.find('.list-group-item.active').removeClass('active');
		this.selectedLayerId = layerId;
		const selectedLayer = this.getSelectedLayer();
		if (selectedLayer) {
			const $element = $(`#${selectedLayer.id}`);
			$element.addClass('selected');
			this.$layerList.find(`.list-group-item[data-layer-id="${layerId}"]`).addClass('active');
		}
		this.onLayerSelect(selectedLayer); // Call App callback
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
			this.updateList();
			this.saveState();
		}
	}
	
	// UPDATED: Added saveHistory parameter
	toggleLockLayer(layerId, saveHistory = true) {
		const layer = this.getLayerById(layerId);
		if (layer) {
			layer.locked = !layer.locked;
			// updateLayerData will handle visual update and interactivity
			this.updateLayerData(layerId, {locked: layer.locked});
			this.updateList(); // Update list item appearance
			if (layerId === this.selectedLayerId) {
				this.onLayerSelect(layer); // Notify App if selected layer's lock changed
			}
			// MODIFIED: Only save state if requested
			if (saveHistory) {
				this.saveState();
			}
		}
	}
	
	toggleSelectedLayerLock() {
		if (this.selectedLayerId) {
			// Calls toggleLockLayer which now defaults to saving history
			this.toggleLockLayer(this.selectedLayerId);
		}
	}
	
	// --- Layer Order (Z-Index) ---
	moveLayer(layerId, direction) {
		const layerIndex = this.layers.findIndex(l => l.id === layerId);
		if (layerIndex === -1) return;
		
		const currentLayers = [...this.layers]; // Work on a copy for sorting
		// Remove the layer to move
		const layerToMove = currentLayers.splice(layerIndex, 1)[0];
		
		// Re-insert based on direction
		if (direction === 'front') {
			currentLayers.push(layerToMove); // Add to the end (highest index)
		} else if (direction === 'back') {
			currentLayers.unshift(layerToMove); // Add to the beginning (lowest index)
		} else if (direction === 'up' && layerIndex < this.layers.length - 1) { // Check bounds using original length
			// Insert after the next element in the *original* sorted array's position
			// Find the element that was originally after it
			const originalNextLayerId = this.layers[layerIndex + 1].id;
			const insertBeforeIndex = currentLayers.findIndex(l => l.id === originalNextLayerId);
			if (insertBeforeIndex !== -1) {
				currentLayers.splice(insertBeforeIndex + 1, 0, layerToMove); // Insert after it
			} else {
				currentLayers.push(layerToMove); // Fallback: move to front if original next not found
			}
		} else if (direction === 'down' && layerIndex > 0) {
			// Insert before the previous element in the *original* sorted array's position
			const originalPrevLayerId = this.layers[layerIndex - 1].id;
			const insertBeforeIndex = currentLayers.findIndex(l => l.id === originalPrevLayerId);
			if (insertBeforeIndex !== -1) {
				currentLayers.splice(insertBeforeIndex, 0, layerToMove); // Insert before it
			} else {
				currentLayers.unshift(layerToMove); // Fallback: move to back if original prev not found
			}
		} else {
			// Invalid direction or already at boundary, reinsert at original effective position
			currentLayers.splice(layerIndex, 0, layerToMove);
			return; // No change needed
		}
		
		// Reassign zIndex based on the new order in the modified array
		currentLayers.forEach((layer, index) => {
			layer.zIndex = index + 1;
		});
		
		this.layers = currentLayers; // Update the main layers array
		this._updateZIndices(); // Apply CSS z-index
		this.updateList(); // Update sidebar list order
		this.saveState();
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
		// Sort first to ensure array order matches desired zIndex
		this.layers.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
		// Then apply based on sorted order
		this.layers.forEach((layer, index) => {
			// Optionally re-assign zIndex based on current array order
			// layer.zIndex = index + 1; // Uncomment if strict 1-based index is needed
			$(`#${layer.id}`).css('z-index', layer.zIndex || 0);
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
			// Initial text application (full styling done by _applyTextStyles)
			$textContent.text(layerData.content || '');
			$element.append($textContent);
			
			// Apply all styles (including background on parent)
			this._applyTextStyles($textContent, layerData);
			
			// Ensure parent height is auto if text height is auto
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
					pointerEvents: 'none', // Image itself shouldn't capture pointer events
					// Filters applied in _applyStyles
				})
				.on('error', function () {
					console.error("Failed to load image:", layerData.content);
					// Optionally display a placeholder or error indicator
					$(this).parent().addClass('load-error'); // Add class to parent
				});

			$element.append($img);
			this._applyStyles($element, layerData);
		}
		
		this.$canvas.append($element);
		this._makeElementInteractive($element, layerData);
	}
	
	_makeElementInteractive($element, layerData) {
		const layerId = layerData.id;
		const self = this;
		let startMouseX, startMouseY, startElementX, startElementY;
		
		$element.draggable({
			containment: this.$canvas, // Contain within the canvas div itself
			start: (event, ui) => {
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) return false; // Prevent dragging locked layers
				
				self.selectLayer(layerId);
				$(event.target).addClass('ui-draggable-dragging');
				
				// Store start position relative to mouse and unscaled element coords
				startMouseX = event.pageX;
				startMouseY = event.pageY;
				startElementX = layer.x;
				startElementY = layer.y;
			},
			drag: (event, ui) => {
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) return false;
				
				const zoom = self.canvasManager.currentZoom;
				// Calculate mouse delta
				const mouseDx = event.pageX - startMouseX;
				const mouseDy = event.pageY - startMouseY;
				
				// Convert mouse delta to unscaled element delta
				const elementDx = mouseDx / zoom;
				const elementDy = mouseDy / zoom;
				
				// Calculate new unscaled position
				const newX = startElementX + elementDx;
				const newY = startElementY + elementDy;
				
				// Update the ui.position which jQuery UI uses for feedback/containment check
				// It expects values relative to the offset parent (the canvas) in scaled pixels
				// But we are managing position via layerData.x/y (unscaled)
				// So, we update the element's CSS directly with unscaled values
				ui.position.left = newX;
				ui.position.top = newY;
				
				// OPTIONALLY: Update element style directly for immediate feedback *if needed*
				// $element.css({ left: newX + 'px', top: newY + 'px' });
				// Usually setting ui.position is enough, but direct CSS can be a backup
			},
			stop: (event, ui) => {
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) return;
				
				// Use the final position calculated during drag (stored in ui.position)
				self.updateLayerData(layerId, {x: ui.position.left, y: ui.position.top});
				$(event.target).removeClass('ui-draggable-dragging');
				self.saveState(); // Save state after drag completes
			}
		});
		
		$element.resizable({
			handles: 'n, e, s, w, ne, se, sw, nw',
			// containment: this.$canvas, // Resizable containment can be tricky with zoom/transforms
			start: (event, ui) => {
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) return false;
				self.selectLayer(layerId);
				
				// Get the target element itself
				const $target = $(event.target);
				$target.addClass('ui-resizable-resizing');
				
				// Calculate initial unscaled size (handle 'auto')
				const currentZoom = self.canvasManager.currentZoom;
				const initialUnscaledWidth = layer.width === 'auto' ? $target.outerWidth() / currentZoom : layer.width;
				const initialUnscaledHeight = layer.height === 'auto' ? $target.outerHeight() / currentZoom : layer.height;
				
				// --- STORE data on the element ---
				$target.data('resizableStartData', {
					originalPositionUnscaled: {left: layer.x, top: layer.y},
					originalSizeUnscaled: {width: initialUnscaledWidth, height: initialUnscaledHeight},
					// Store the initial CSS values provided by jQuery UI in the start event's ui object
					originalCss: {left: ui.position.left, top: ui.position.top, width: ui.size.width, height: ui.size.height}
				});
				// --- END STORE ---
			},
			resize: (event, ui) => {
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) return false;
				
				// --- RETRIEVE data from the element ---
				const $target = $(event.target);
				const startData = $target.data('resizableStartData');
				if (!startData) {
					console.error("Resizable start data not found during resize for layer:", layerId);
					return; // Cannot proceed without start data
				}
				// --- END RETRIEVE ---
				
				const zoom = self.canvasManager.currentZoom;
				
				// Calculate change in scaled dimensions/position provided by *this* resize event's ui object
				const cssWidthChange = ui.size.width - startData.originalCss.width;
				const cssHeightChange = ui.size.height - startData.originalCss.height;
				const cssLeftChange = ui.position.left - startData.originalCss.left;
				const cssTopChange = ui.position.top - startData.originalCss.top;
				
				// Convert these CSS changes to unscaled changes
				const unscaledWidthChange = cssWidthChange / zoom;
				const unscaledHeightChange = cssHeightChange / zoom;
				const unscaledLeftChange = cssLeftChange / zoom;
				const unscaledTopChange = cssTopChange / zoom;
				
				// Calculate the new unscaled dimensions and position based on the *stored original unscaled values*
				const newUnscaledWidth = startData.originalSizeUnscaled.width + unscaledWidthChange;
				const newUnscaledHeight = startData.originalSizeUnscaled.height + unscaledHeightChange;
				const newUnscaledX = startData.originalPositionUnscaled.left + unscaledLeftChange;
				const newUnscaledY = startData.originalPositionUnscaled.top + unscaledTopChange;
				
				// Update the element's CSS directly using the calculated unscaled values
				// This keeps the element's CSS aligned with the unscaled data model during resize
				$target.css({
					left: newUnscaledX + 'px',
					top: newUnscaledY + 'px',
					width: newUnscaledWidth + 'px',
					// Handle auto height for text layers specifically
					height: (layer.type === 'text' && layer.height === 'auto') ? 'auto' : newUnscaledHeight + 'px'
				});
				
				// If text layer with auto height, reapply styles to potentially adjust height
				if (layer.type === 'text' && layer.height === 'auto') {
					self._applyTextStyles($target.find('.text-content'), layer); // Re-apply styles
					$target.css('height', 'auto'); // Ensure CSS height remains auto
				}
				
				// --- STORE current calculated unscaled values for the stop event ---
				// (Optional but can be cleaner than recalculating in stop)
				$target.data('resizableCurrentUnscaled', {
					x: newUnscaledX,
					y: newUnscaledY,
					width: newUnscaledWidth,
					height: (layer.type === 'text' && layer.height === 'auto') ? 'auto' : newUnscaledHeight
				});
				// --- END STORE ---
			},
			
			stop: (event, ui) => {
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) return;
				
				const $target = $(event.target);
				// --- RETRIEVE the final calculated unscaled values from resize ---
				const finalUnscaled = $target.data('resizableCurrentUnscaled');
				
				if (!finalUnscaled) {
					console.error("Resizable final unscaled data not found during stop for layer:", layerId);
					// Attempt graceful recovery or just log error
				} else {
					// Update layer data with the final unscaled values
					self.updateLayerData(layerId, {
						x: finalUnscaled.x,
						y: finalUnscaled.y,
						width: finalUnscaled.width,
						height: finalUnscaled.height // Already 'auto' if needed
					});
					
					// Ensure final CSS matches the updated data (especially for auto height)
					$target.css({
						left: finalUnscaled.x + 'px',
						top: finalUnscaled.y + 'px',
						width: finalUnscaled.width + 'px',
						height: (typeof finalUnscaled.height === 'number') ? finalUnscaled.height + 'px' : 'auto' // Set CSS height correctly
					});
					
					if (layer.type === 'text' && finalUnscaled.height === 'auto') {
						$target.css('height', 'auto'); // Ensure it recalculates if needed after potential content reflow
					}
					self.saveState(); // Save state after resize completes
				}
				
				
				$target.removeClass('ui-resizable-resizing');
				
				// --- CLEANUP stored data ---
				$target.removeData('resizableStartData');
				$target.removeData('resizableCurrentUnscaled');
				// --- END CLEANUP ---
			}
		});
		
		
		// Single click to select
		$element.on('click', (e) => {
			e.stopPropagation(); // Prevent click from bubbling to canvas area (which deselects)
			self.selectLayer(layerId);
		});
		
		// Ensure initial interactivity state is correct
		self._updateElementInteractivity($element, layerData);
	}
	
	
	_updateElementInteractivity($element, layerData) {
		const isLocked = layerData.locked;
		const isDisabled = !layerData.visible || isLocked; // Consider invisible layers disabled too
		
		try {
			if ($element.hasClass('ui-draggable')) {
				$element.draggable(isDisabled ? 'disable' : 'enable');
			}
			if ($element.hasClass('ui-resizable')) {
				$element.resizable(isDisabled ? 'disable' : 'enable');
			}
			// Add a general class to potentially style locked/hidden elements differently
			$element.toggleClass('interactions-disabled', isDisabled);
			// Ensure correct cursor even if only visibility changes
			$element.css('cursor', isLocked ? 'default' : 'grab');
			
		} catch (error) {
			console.warn("Error updating interactivity for element:", layerData.id, error);
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
		
		// Parent Border (If you want a border around the whole text box, independent of stroke)
		// Example: if (layerData.boxBorderWidth > 0) { $parentElement.css(...) }
		// For now, we only use the 'stroke' property on the text itself.
		
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
		
		// Border (Example - could be extended)
		if (layerData.border) { // Assuming border is a string like "1px solid red"
			$element.css('border', layerData.border);
		} else {
			// Remove border unless selected (selection border is handled by class)
			if (!$element.hasClass('selected')) {
				$element.css('border', 'none'); // Remove default/placeholder border
			}
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
				if (!$(e.target).closest('button, input, .layer-name-display').length) {
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
