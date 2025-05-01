class LayerManager {
	constructor($canvas, $layerList, options) {
		this.$canvas = $canvas;
		this.$layerList = $layerList;
		this.layers = []; // Stores layer data in the NEW JSON format
		this.selectedLayerId = null;
		this.uniqueIdCounter = 0;
		// Callbacks provided by the App
		this.onLayerSelect = options.onLayerSelect || (() => { });
		this.saveState = options.saveState || (() => { }); // Callback to trigger history save
		this.canvasManager = options.canvasManager; // <-- Store CanvasManager
		if (!this.canvasManager) {
			console.error("LayerManager requires an instance of CanvasManager!");
			// Handle error appropriately, maybe throw an exception
		}
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
			name: '', // Initialize name as empty, will be set below
			type: type,
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
			stroke: 'black',
			backgroundEnabled: false,
			backgroundColor: '#ffffff',
			backgroundOpacity: 1,
			backgroundCornerRadius: 0,
			backgroundPadding: 0,
			// Image specific defaults
			// content: type === 'image' ? 'path/to/placeholder.png' : '',
		};
		
		// Merge provided props with defaults
		const layerData = { ...defaultProps, ...props };
		
		// --- NEW: Generate default name if not provided ---
		if (!layerData.name) {
			layerData.name = this._generateDefaultLayerName(layerData);
		}
		// --- END NEW ---
		
		
		// Ensure numeric types are numbers
		layerData.x = parseFloat(layerData.x) || 0;
		layerData.y = parseFloat(layerData.y) || 0;
		layerData.width = layerData.width === 'auto' ? 'auto' : (parseFloat(layerData.width) || defaultProps.width);
		layerData.height = layerData.height === 'auto' ? 'auto' : (parseFloat(layerData.height) || defaultProps.height);
		layerData.opacity = parseFloat(layerData.opacity) ?? 1;
		layerData.zIndex = parseInt(layerData.zIndex) || initialZIndex;
		
		if (type === 'text') {
			layerData.fontSize = parseFloat(layerData.fontSize) || defaultProps.fontSize;
			layerData.lineHeight = parseFloat(layerData.lineHeight) || defaultProps.lineHeight;
			layerData.letterSpacing = parseFloat(layerData.letterSpacing) || defaultProps.letterSpacing;
			layerData.shadowBlur = parseFloat(layerData.shadowBlur) || 0;
			layerData.shadowOffsetX = parseFloat(layerData.shadowOffsetX) || 0;
			layerData.shadowOffsetY = parseFloat(layerData.shadowOffsetY) || 0;
			layerData.strokeWidth = parseFloat(layerData.strokeWidth) || 0;
			layerData.backgroundCornerRadius = parseFloat(layerData.backgroundCornerRadius) || 0;
			layerData.backgroundPadding = parseFloat(layerData.backgroundPadding) || 0;
			layerData.backgroundOpacity = parseFloat(layerData.backgroundOpacity) ?? 1;
		}
		
		// Add to layers array and sort by zIndex
		this.layers.push(layerData);
		this.layers.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
		this._renderLayer(layerData);
		this.updateList(); // Update sidebar list
		
		// Don't save state here, let the calling action handle it
		return layerData; // Return the data added
	}
	
	deleteLayer(layerId) {
		const layerIndex = this.layers.findIndex(l => l.id === layerId);
		if (layerIndex > -1) {
			$(`#${layerId}`).remove(); // Remove element from canvas
			this.layers.splice(layerIndex, 1); // Remove data from array
			if (this.selectedLayerId === layerId) {
				this.selectLayer(null); // Deselect if deleted layer was selected
			}
			this._updateZIndices(); // Renumber zIndex for remaining layers
			this.updateList(); // Update sidebar list
			this.saveState(); // Save state after deletion
		}
	}
	
	deleteSelectedLayer() {
		if (this.selectedLayerId) {
			const layer = this.getLayerById(this.selectedLayerId);
			if (layer && !layer.locked) {
				this.deleteLayer(this.selectedLayerId);
			}
		}
	}
	
	// Updates the layer data in the 'this.layers' array
	updateLayerData(layerId, newData) {
		const layerIndex = this.layers.findIndex(l => l.id === layerId);
		if (layerIndex > -1) {
			// Merge new data into the existing layer data
			this.layers[layerIndex] = { ...this.layers[layerIndex], ...newData };
			const updatedLayer = this.layers[layerIndex];
			
			// --- NEW: Update default name if content changed ---
			if (newData.content !== undefined && !newData.name) { // Only update name if content changed AND name wasn't explicitly set in this update
				const currentName = updatedLayer.name;
				const defaultName = this._generateDefaultLayerName(updatedLayer);
				// Only update if the current name IS the old default name or empty
				// This prevents overwriting a user-set custom name just because content changed.
				const oldLayerDataForName = {...updatedLayer, content: this.layers[layerIndex].content}; // Use previous content to check old default
				const oldDefaultName = this._generateDefaultLayerName(oldLayerDataForName);
				if (currentName === oldDefaultName || !currentName) {
					updatedLayer.name = defaultName;
					// Update list immediately if name changed implicitly
					this.updateList();
				}
			}
			// --- END NEW ---
			
			// Update visual representation based on changed data
			const $element = $(`#${layerId}`);
			if (!$element.length) return null; // Element not found
			
			// --- Update common properties ---
			if (newData.x !== undefined) $element.css('left', updatedLayer.x + 'px');
			if (newData.y !== undefined) $element.css('top', updatedLayer.y + 'px');
			if (newData.width !== undefined) $element.css('width', updatedLayer.width === 'auto' ? 'auto' : updatedLayer.width + 'px');
			if (newData.height !== undefined) $element.css('height', updatedLayer.height === 'auto' ? 'auto' : updatedLayer.height + 'px');
			if (newData.opacity !== undefined) $element.css('opacity', updatedLayer.opacity);
			if (newData.visible !== undefined) {
				$element.toggle(updatedLayer.visible);
				$element.toggleClass('layer-hidden', !updatedLayer.visible);
			}
			if (newData.zIndex !== undefined) {
				$element.css('z-index', updatedLayer.zIndex);
			}
			
			// --- Update type-specific properties ---
			if (updatedLayer.type === 'text') {
				const $textContent = $element.find('.text-content');
				if (newData.content !== undefined) {
					$textContent.text(updatedLayer.content);
					// Name update handled above
				}
				// Apply all text styles if any style-related prop changed
				if (Object.keys(newData).some(key => [
					'fontSize', 'fontFamily', 'fontStyle', 'fontWeight', 'textDecoration',
					'fill', 'align', 'lineHeight', 'letterSpacing', 'shadowEnabled',
					'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'shadowColor',
					'strokeWidth', 'stroke', 'backgroundEnabled', 'backgroundColor',
					'backgroundOpacity', 'backgroundCornerRadius', 'backgroundPadding'
				].includes(key))) {
					this._applyTextStyles($textContent, updatedLayer);
				}
				// Adjust height if needed after style changes
				if (updatedLayer.height === 'auto') {
					$element.css('height', 'auto');
				}
			} else if (updatedLayer.type === 'image') {
				if (newData.content !== undefined) {
					$element.find('img').attr('src', updatedLayer.content);
					// Name update handled above
				}
				this._applyStyles($element, updatedLayer);
			}
			
			// Don't save state here, let the calling action handle it
			return updatedLayer;
		}
		return null;
	}
	
	// Convenience method for updating a single style-like property
	updateLayerStyle(layerId, property, value) {
		const layer = this.getLayerById(layerId);
		if (layer) {
			const update = { [property]: value };
			// Handle specific conversions or related properties
			if (property === 'fill') { /* ... */ }
			else if (property === 'fontSize') {
				value = parseFloat(value) || layer.fontSize;
				update[property] = value;
			}
			// Add more specific handling if needed
			this.updateLayerData(layerId, update);
		}
	}
	
	// --- NEW: Method to specifically update the layer name ---
	updateLayerName(layerId, newName) {
		const layer = this.getLayerById(layerId);
		if (layer && layer.name !== newName) {
			layer.name = newName;
			// Update the name in the list item directly for performance
			const $listItem = this.$layerList.find(`.list-group-item[data-layer-id="${layerId}"]`);
			$listItem.find('.layer-name-display').text(newName); // Update display span
			this.saveState(); // Save history state after name change
		}
	}
	// --- END NEW ---
	
	getLayerById(layerId) {
		return this.layers.find(l => l.id === layerId);
	}
	
	getLayers() {
		return JSON.parse(JSON.stringify(this.layers));
	}
	
	setLayers(layersData, keepExisting = false) {
		if (!keepExisting) {
			this.$canvas.empty();
			this.layers = [];
		}
		this.selectedLayerId = null;
		
		if (layersData && layersData.length > 0) {
			const maxId = Math.max(0, ...layersData.map(l => {
				const parts = (l.id || '').split('-');
				const num = parseInt(parts[1] || '0');
				return isNaN(num) ? 0 : num;
			}));
			this.uniqueIdCounter = maxId + 1;
		} else {
			this.uniqueIdCounter = 0;
		}
		
		const sortedLayers = [...layersData].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
		
		sortedLayers.forEach(layerData => {
			// --- NEW: Ensure name exists or generate default ---
			if (!layerData.name) {
				layerData.name = this._generateDefaultLayerName(layerData);
			}
			// --- END NEW ---
			
			// Ensure unique ID if adding to existing or if ID is missing/duplicate
			if (keepExisting || !layerData.id || this.getLayerById(layerData.id)) {
				layerData.id = this._generateId();
			}
			
			const addedLayer = this.addLayer(layerData.type, layerData);
			if (layerData.zIndex !== undefined && addedLayer) {
				addedLayer.zIndex = layerData.zIndex;
				$(`#${addedLayer.id}`).css('z-index', addedLayer.zIndex);
			}
		});
		
		this.layers.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
		this.updateList();
		this.selectLayer(null);
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
		this.onLayerSelect(selectedLayer);
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
	
	toggleLockLayer(layerId) {
		const layer = this.getLayerById(layerId);
		if (layer) {
			layer.locked = !layer.locked;
			const $element = $(`#${layerId}`);
			$element.toggleClass('locked', layer.locked);
			this._updateElementInteractivity($element, layer);
			this.updateList();
			if (layerId === this.selectedLayerId) {
				this.onLayerSelect(layer);
			}
			this.saveState();
		}
	}
	
	toggleSelectedLayerLock() {
		if (this.selectedLayerId) {
			this.toggleLockLayer(this.selectedLayerId);
		}
	}
	
	// --- Layer Order (Z-Index) ---
	moveLayer(layerId, direction) {
		const layerIndex = this.layers.findIndex(l => l.id === layerId);
		if (layerIndex === -1) return;
		
		const currentLayers = [...this.layers];
		const layerToMove = currentLayers.splice(layerIndex, 1)[0];
		
		if (direction === 'front') {
			currentLayers.push(layerToMove);
		} else if (direction === 'back') {
			currentLayers.unshift(layerToMove);
		} else if (direction === 'up' && layerIndex < currentLayers.length) {
			currentLayers.splice(layerIndex + 1, 0, layerToMove);
		} else if (direction === 'down' && layerIndex > 0) {
			currentLayers.splice(layerIndex - 1, 0, layerToMove);
		} else {
			currentLayers.splice(layerIndex, 0, layerToMove);
			return;
		}
		
		currentLayers.forEach((layer, index) => {
			layer.zIndex = index + 1;
		});
		
		this.layers = currentLayers;
		this._updateZIndices();
		this.updateList();
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
		this.layers.forEach((layer) => {
			$(`#${layer.id}`).css('z-index', layer.zIndex || 0);
		});
	}
	
	// --- Rendering & Interaction ---
	_renderLayer(layerData) {
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
			const $textContent = $('<div class="text-content"></div>')
				.text(layerData.content);
			this._applyTextStyles($textContent, layerData);
			$element.append($textContent);
			
			$textContent.on('dblclick', () => {
				const currentLayer = this.getLayerById(layerData.id);
				if (!currentLayer || currentLayer.locked) return;
				const currentText = $textContent.text();
				const newText = prompt("Enter new text:", currentText);
				if (newText !== null && newText !== currentText) {
					// Use updateLayerData which handles name update logic
					this.updateLayerData(currentLayer.id, { content: newText });
					this.saveState();
				}
			});
			
			if (layerData.height === 'auto') $element.css('height', 'auto');
			
		} else if (layerData.type === 'image') {
			const $img = $('<img>')
				.attr('src', layerData.content)
				.css({
					display: 'block',
					width: '100%', // Make image fill the container div
					height: '100%', // Make image fill the container div
					objectFit: 'cover' // Or 'contain', could be a layer property
				})
				.on('error', function () {
					$(this).attr('alt', 'Image failed to load');
				});
			this._applyStyles($element, layerData);
			$element.append($img);
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
				if (!layer || layer.locked) return false;
				self.selectLayer(layerId);
				$(event.target).addClass('ui-draggable-dragging');
				startMouseX = event.pageX;
				startMouseY = event.pageY;
				startElementX = layer.x;
				startElementY = layer.y;
			},
			drag: (event, ui) => {
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) return false;
				const zoom = self.canvasManager.currentZoom;
				const mouseDx = event.pageX - startMouseX;
				const mouseDy = event.pageY - startMouseY;
				const elementDx = mouseDx / zoom;
				const elementDy = mouseDy / zoom;
				const newX = startElementX + elementDx;
				const newY = startElementY + elementDy;
				ui.position.left = newX;
				ui.position.top = newY;
			},
			stop: (event, ui) => {
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) return;
				// Use the final position from ui.position
				self.updateLayerData(layerId, { x: ui.position.left, y: ui.position.top });
				$(event.target).removeClass('ui-draggable-dragging');
				self.saveState();
			}
		});
		
		$element.resizable({
			handles: 'n, e, s, w, ne, se, sw, nw',
			// containment: this.$canvas, // Resizable containment is often tricky with transforms
			start: (event, ui) => {
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) return false;
				self.selectLayer(layerId);
				$(event.target).addClass('ui-resizable-resizing');
				// Store original unscaled size and position for calculations
				ui.originalPositionUnscaled = { left: layer.x, top: layer.y };
				ui.originalSizeUnscaled = { width: layer.width === 'auto' ? $element.width() : layer.width, height: layer.height === 'auto' ? $element.height() : layer.height };
			},
			resize: (event, ui) => {
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) return false;
				const zoom = self.canvasManager.currentZoom;
				
				// Calculate change in scaled dimensions/position provided by jQuery UI
				const cssWidthChange = ui.size.width - ui.originalSize.width;
				const cssHeightChange = ui.size.height - ui.originalSize.height;
				const cssLeftChange = ui.position.left - ui.originalPosition.left;
				const cssTopChange = ui.position.top - ui.originalPosition.top;
				
				// Convert these CSS changes to unscaled changes
				const unscaledWidthChange = cssWidthChange / zoom;
				const unscaledHeightChange = cssHeightChange / zoom;
				const unscaledLeftChange = cssLeftChange / zoom;
				const unscaledTopChange = cssTopChange / zoom;
				
				// Calculate the new unscaled dimensions and position
				const newUnscaledWidth = ui.originalSizeUnscaled.width + unscaledWidthChange;
				const newUnscaledHeight = ui.originalSizeUnscaled.height + unscaledHeightChange;
				const newUnscaledX = ui.originalPositionUnscaled.left + unscaledLeftChange;
				const newUnscaledY = ui.originalPositionUnscaled.top + unscaledTopChange;
				
				// Store these unscaled values for the 'stop' event
				ui.newUnscaled = { width: newUnscaledWidth, height: newUnscaledHeight, x: newUnscaledX, y: newUnscaledY };
				
				// Update the element's CSS directly using the calculated unscaled values
				// This keeps the element's CSS aligned with the unscaled data model
				$element.css({
					left: newUnscaledX + 'px',
					top: newUnscaledY + 'px',
					width: newUnscaledWidth + 'px',
					height: (layer.type === 'text' && layer.height === 'auto') ? 'auto' : newUnscaledHeight + 'px'
				});
				
				// If text layer with auto height, reapply styles to potentially adjust height
				if (layer.type === 'text' && layer.height === 'auto') {
					self._applyTextStyles($element.find('.text-content'), layer);
					$element.css('height', 'auto');
				}
				
			},
			stop: (event, ui) => {
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) return;
				
				// Use the unscaled values calculated during resize
				const finalWidth = ui.newUnscaled.width;
				const finalHeight = (layer.type === 'text' && layer.height === 'auto') ? 'auto' : ui.newUnscaled.height;
				const finalX = ui.newUnscaled.x;
				const finalY = ui.newUnscaled.y;
				
				self.updateLayerData(layerId, {
					x: finalX,
					y: finalY,
					width: finalWidth,
					height: finalHeight
				});
				
				// Ensure final CSS matches data (especially for auto height)
				const $element = $(event.target);
				$element.css({
					left: finalX + 'px',
					top: finalY + 'px',
					width: finalWidth + 'px',
					height: (typeof finalHeight === 'number') ? finalHeight + 'px' : 'auto'
				});
				if (layer.type === 'text' && finalHeight === 'auto') {
					$element.css('height', 'auto'); // Ensure it recalculates if needed
				}
				
				
				$element.removeClass('ui-resizable-resizing');
				self.saveState();
			}
		});
		
		$element.on('click', (e) => {
			e.stopPropagation();
			self.selectLayer(layerId);
		});
		
		self._updateElementInteractivity($element, layerData);
	}
	
	_updateElementInteractivity($element, layerData) {
		const isLocked = layerData.locked;
		try {
			if ($element.hasClass('ui-draggable')) {
				$element.draggable(isLocked ? 'disable' : 'enable');
			}
			if ($element.hasClass('ui-resizable')) {
				$element.resizable(isLocked ? 'disable' : 'enable');
			}
			$element.toggleClass('interactions-disabled', isLocked);
		} catch (error) {
			// console.warn("Error updating interactivity:", error);
		}
	}
	
	_applyTextStyles($textContent, layerData) {
		if (!$textContent || !layerData) return;
		$textContent.css({
			fontFamily: layerData.fontFamily || 'Arial',
			fontSize: (layerData.fontSize || 16) + 'px',
			fontWeight: layerData.fontWeight || 'normal',
			fontStyle: layerData.fontStyle || 'normal',
			textDecoration: layerData.textDecoration || 'none',
			color: layerData.fill || 'rgba(0,0,0,1)',
			textAlign: layerData.align || 'left',
			lineHeight: layerData.lineHeight || 1.3,
			letterSpacing: (layerData.letterSpacing || 0) + 'px',
			padding: (layerData.backgroundPadding || 0) + 'px',
			border: 'none',
			outline: 'none',
			whiteSpace: 'pre-wrap',
			wordWrap: 'break-word',
		});
		
		if (layerData.shadowEnabled && layerData.shadowColor) {
			const shadow = `${layerData.shadowOffsetX || 0}px ${layerData.shadowOffsetY || 0}px ${layerData.shadowBlur || 0}px ${layerData.shadowColor}`;
			$textContent.css('text-shadow', shadow);
		} else {
			$textContent.css('text-shadow', 'none');
		}
		
		if (layerData.strokeWidth > 0 && layerData.stroke) {
			$textContent.css({
				'-webkit-text-stroke-width': layerData.strokeWidth + 'px',
				'-webkit-text-stroke-color': layerData.stroke,
				'text-stroke-width': layerData.strokeWidth + 'px',
				'text-stroke-color': layerData.stroke,
				'paint-order': 'stroke fill'
			});
		} else {
			$textContent.css({
				'-webkit-text-stroke-width': '0',
				'text-stroke-width': '0'
			});
		}
		
		const $parentElement = $textContent.parent('.canvas-element');
		if (layerData.backgroundEnabled && layerData.backgroundColor) {
			$parentElement.css({
				backgroundColor: layerData.backgroundColor,
				borderRadius: (layerData.backgroundCornerRadius || 0) + 'px',
			});
			if (layerData.height === 'auto') $parentElement.css('height', 'auto');
		} else {
			$parentElement.css({
				backgroundColor: 'transparent',
				borderRadius: '0',
			});
			if (layerData.height === 'auto') $parentElement.css('height', 'auto');
		}
	}
	
	_applyStyles($element, layerData) {
		if (!$element || !layerData) return;
		if (layerData.border) {
			$element.css('border', layerData.border);
		} else {
			if (!$element.hasClass('selected')) {
				// Keep transparent border placeholder for consistent spacing if needed
				// $element.css('border', '1px dashed transparent');
				$element.css('border', 'none'); // Or remove border completely
			}
		}
		if (layerData.filters) {
			$element.css('filter', layerData.filters);
		} else {
			$element.css('filter', 'none');
		}
	}
	
	// --- Layer List Panel ---
	initializeList() {
		this.$layerList.sortable({
			axis: 'y',
			containment: 'parent',
			placeholder: 'ui-sortable-placeholder list-group-item',
			helper: 'clone',
			items: '> li:not(.text-muted)',
			tolerance: 'pointer',
			cursor: 'grabbing',
			update: (event, ui) => {
				const newOrderIds = this.$layerList.find('.list-group-item[data-layer-id]')
					.map(function () { return $(this).data('layerId'); })
					.get()
					.reverse(); // Visually top = highest zIndex
				
				this.layers.sort((a, b) => {
					const indexA = newOrderIds.indexOf(a.id);
					const indexB = newOrderIds.indexOf(b.id);
					if (indexA === -1) return 1;
					if (indexB === -1) return -1;
					return indexA - indexB;
				});
				
				// Reassign zIndex based on new order and update CSS
				this.layers.forEach((layer, index) => {
					layer.zIndex = index + 1;
					$(`#${layer.id}`).css('z-index', layer.zIndex);
				});
				
				this.saveState();
				// No need to call updateList() here, sortable handles DOM update
			}
		});
		this.updateList();
	}
	
	updateList() {
		this.$layerList.empty();
		if (this.layers.length === 0) {
			this.$layerList.append('<li class="list-group-item text-muted">No layers yet.</li>');
			if (this.$layerList.hasClass('ui-sortable')) {
				try { this.$layerList.sortable('disable'); } catch (e) { }
			}
			return;
		}
		
		if (this.$layerList.hasClass('ui-sortable')) {
			try { this.$layerList.sortable('enable'); } catch (e) { }
		}
		
		const self = this; // Reference LayerManager for event handlers
		
		// Iterate in reverse array order (highest zIndex first)
		[...this.layers].reverse().forEach(layer => {
			const iconClass = layer.type === 'text' ? 'fa-font' : (layer.type === 'image' ? 'fa-image' : 'fa-square');
			const layerName = layer.name || this._generateDefaultLayerName(layer); // Use stored name or generate default
			
			const lockIconClass = layer.locked ? 'fas fa-lock lock-icon locked' : 'fas fa-lock-open lock-icon';
			const lockTitle = layer.locked ? 'Unlock Layer' : 'Lock Layer';
			const visibilityIconClass = layer.visible ? 'fas fa-eye' : 'fas fa-eye-slash';
			const visibilityTitle = layer.visible ? 'Hide Layer' : 'Show Layer';
			const itemHiddenClass = layer.visible ? '' : 'layer-item-hidden';
			
			// --- MODIFIED: Added layer-name-display span ---
			const $item = $(`
                <li class="list-group-item ${itemHiddenClass}" data-layer-id="${layer.id}">
                    <div class="d-flex align-items-center">
                        <span class="layer-icon me-2"><i class="fas ${iconClass}"></i></span>
                        <span class="layer-name flex-grow-1 me-2"> <!-- Added me-2 for spacing -->
                            <span class="layer-name-display" title="Double-click to rename">${$('<div>').text(layerName).html()}</span> <!-- Display span -->
                        </span>
                        <span class="layer-controls ms-auto d-flex align-items-center flex-shrink-0"> <!-- Added flex-shrink-0 -->
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
			
			if (this.selectedLayerId === layer.id) {
				$item.addClass('active');
			}
			
			// --- Attach Event Listeners ---
			$item.on('click', (e) => {
				if (!$(e.target).closest('button, input, .layer-name-display').length) { // Don't select if clicking buttons, input or name span
					self.selectLayer(layer.id);
				}
			});
			
			// --- NEW: Rename functionality ---
			const $nameDisplay = $item.find('.layer-name-display');
			const $nameContainer = $item.find('.layer-name'); // The container span
			
			$nameDisplay.on('dblclick', (e) => {
				e.stopPropagation();
				const currentName = self.getLayerById(layer.id)?.name || ''; // Get fresh name
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
							
							// Remove input and show display span
							$currentInput.remove();
							$nameDisplay.show();
							
							// Save if name changed and wasn't cancelled by Escape
							if (event.key !== 'Escape' && newName && newName !== currentName) {
								self.updateLayerName(layer.id, newName);
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
			// --- END NEW Rename ---
			
			
			$item.find('.toggle-visibility').on('click', (e) => {
				e.stopPropagation();
				self.toggleLayerVisibility(layer.id);
			});
			
			$item.find('.lock-layer').on('click', (e) => {
				e.stopPropagation();
				self.toggleLockLayer(layer.id);
			});
			
			$item.find('.delete-layer').on('click', (e) => {
				e.stopPropagation();
				const currentLayer = self.getLayerById(layer.id);
				const confirmName = currentLayer?.name || `Layer ${layer.id}`;
				if (confirm(`Are you sure you want to delete layer "${confirmName}"?`)) {
					self.deleteLayer(layer.id);
				}
			});
			
			this.$layerList.append($item);
		});
		
		if (this.$layerList.hasClass('ui-sortable')) {
			try { this.$layerList.sortable('refresh'); } catch (e) { }
		}
	}
} // End of LayerManager class
