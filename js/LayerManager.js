// free-cover-designer/js/LayerManager.js

class LayerManager {
	constructor($canvas, $layerList, options) {
		this.$canvas = $canvas;
		this.$layerList = $layerList;
		this.layers = []; // Stores layer data in the NEW JSON format
		this.selectedLayerId = null;
		this.uniqueIdCounter = 0;
		// Callbacks provided by the App
		this.onLayerSelect = options.onLayerSelect || (() => {
		});
		this.saveState = options.saveState || (() => {
		}); // Callback to trigger history save
		this.canvasManager = options.canvasManager; // <-- Store CanvasManager
		if (!this.canvasManager) {
			console.error("LayerManager requires an instance of CanvasManager!"); // Handle error appropriately, maybe throw an exception
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
		const layerData = {...defaultProps, ...props};
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
		if (layerIndex > -1) {
			// Merge new data into the existing layer data
			this.layers[layerIndex] = {...this.layers[layerIndex], ...newData};
			const updatedLayer = this.layers[layerIndex];
			// --- NEW: Update default name if content changed ---
			if (newData.content !== undefined && !newData.name) {
				// Only update name if content changed AND name wasn't explicitly set in this update
				const currentName = updatedLayer.name;
				const defaultName = this._generateDefaultLayerName(updatedLayer);
				// Only update if the current name IS the old default name or empty
				// This prevents overwriting a user-set custom name just because content changed.
				const oldLayerDataForName = {...updatedLayer, content: this.layers[layerIndex].content}; // Use previous content to check old default
				const oldDefaultName = this._generateDefaultLayerName(oldLayerDataForName);
				if (currentName === oldDefaultName || !currentName) {
					updatedLayer.name = defaultName; // Update list immediately if name changed implicitly
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
			// --- Update lock state visual ---
			if (newData.locked !== undefined) {
				$element.toggleClass('locked', updatedLayer.locked);
				this._updateElementInteractivity($element, updatedLayer);
			}
			
			
			// --- Update type-specific properties ---
			if (updatedLayer.type === 'text') {
				const $textContent = $element.find('.text-content');
				if (newData.content !== undefined) {
					$textContent.text(updatedLayer.content); // Name update handled above
				}
				// Apply all text styles if any style-related prop changed
				if (Object.keys(newData).some(key => [
					'fontSize', 'fontFamily', 'fontStyle', 'fontWeight', 'textDecoration',
					'fill', 'align', 'lineHeight', 'letterSpacing', 'shadowEnabled',
					'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'shadowColor', 'strokeWidth',
					'stroke', 'backgroundEnabled', 'backgroundColor', 'backgroundOpacity',
					'backgroundCornerRadius', 'backgroundPadding'
				].includes(key))) {
					this._applyTextStyles($textContent, updatedLayer);
				}
				// Adjust height if needed after style changes
				if (updatedLayer.height === 'auto') {
					$element.css('height', 'auto');
				}
			} else if (updatedLayer.type === 'image') {
				if (newData.content !== undefined) {
					$element.find('img').attr('src', updatedLayer.content); // Name update handled above
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
	
	// --- NEW: Method to specifically update the layer name ---
	updateLayerName(layerId, newName) {
		const layer = this.getLayerById(layerId);
		if (layer && layer.name !== newName) {
			layer.name = newName; // Update the name in the list item directly for performance
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
	
	setLayers(layersData, keepNonTextLayers = false) { // Renamed second parameter
		if (!keepNonTextLayers) {
			this.$canvas.empty();
			this.layers = [];
		} else {
			// Logic to keep non-text layers if needed (currently not used by template load)
			// If this becomes necessary, implement the removal of text layers
			// and re-rendering of kept layers here.
			// For now, template logic handles this externally before calling setLayers.
			console.warn("setLayers called with keepNonTextLayers=true, but specific removal/re-rendering logic might need implementation if requirements change.");
		}
		
		this.selectedLayerId = null;
		if (layersData && layersData.length > 0) {
			const maxId = Math.max(0, ...layersData.map(l => {
				const parts = (l.id || '').split('-');
				const num = parseInt(parts[1] || '0');
				return isNaN(num) ? 0 : num;
			}));
			this.uniqueIdCounter = Math.max(this.uniqueIdCounter, maxId + 1); // Ensure counter is ahead
		} else if (!keepNonTextLayers) { // Only reset counter if not keeping layers
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
			if (keepNonTextLayers || !layerData.id || this.getLayerById(layerData.id)) {
				layerData.id = this._generateId();
			}
			
			// Using addLayer will push to this.layers and render
			// It also handles default values and type conversions
			// We pass the layerData which includes the desired zIndex
			const addedLayer = this.addLayer(layerData.type, layerData);
			
			// AddLayer calculates the next zIndex, override if one was provided
			// Note: This might lead to duplicate zIndices if loading partial data.
			// The subsequent sort and _updateZIndices() should correct this.
			if (layerData.zIndex !== undefined && addedLayer) {
				addedLayer.zIndex = layerData.zIndex;
				$(`#${addedLayer.id}`).css('z-index', addedLayer.zIndex);
			}
		});
		
		// Ensure layers array is sorted and z-indices are correct after adding all
		this.layers.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
		this._updateZIndices(); // Re-apply z-index CSS based on the final sorted array
		
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
					// Use updateLayerData which handles name update logic AND triggers saveState via App
					this.updateLayerData(currentLayer.id, {content: newText});
					this.saveState(); // Save state after direct text edit
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
					// Optionally add a placeholder style or text
				});
			this._applyStyles($element, layerData); // Apply border/filters if any
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
				if (!layer || layer.locked) return false; // Prevent resizing locked layers
				
				self.selectLayer(layerId);
				$(event.target).addClass('ui-resizable-resizing');
				
				// Store original unscaled size and position for precise calculations
				ui.originalPositionUnscaled = {left: layer.x, top: layer.y};
				ui.originalSizeUnscaled = {
					width: layer.width === 'auto' ? $element.outerWidth() / self.canvasManager.currentZoom : layer.width,
					height: layer.height === 'auto' ? $element.outerHeight() / self.canvasManager.currentZoom : layer.height
				};
				// Also store the initial scaled size/position from jQuery UI for delta calculation
				ui.originalCss = {
					left: ui.position.left,
					top: ui.position.top,
					width: ui.size.width,
					height: ui.size.height
				};
			},
			resize: (event, ui) => {
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) return false;
				
				const zoom = self.canvasManager.currentZoom;
				
				// Calculate change in scaled dimensions/position provided by jQuery UI
				const cssWidthChange = ui.size.width - ui.originalCss.width;
				const cssHeightChange = ui.size.height - ui.originalCss.height;
				const cssLeftChange = ui.position.left - ui.originalCss.left;
				const cssTopChange = ui.position.top - ui.originalCss.top;
				
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
				ui.newUnscaled = {
					width: newUnscaledWidth,
					height: newUnscaledHeight,
					x: newUnscaledX,
					y: newUnscaledY
				};
				
				// Update the element's CSS directly using the calculated unscaled values
				// This keeps the element's CSS aligned with the unscaled data model during resize
				$element.css({
					left: newUnscaledX + 'px',
					top: newUnscaledY + 'px',
					width: newUnscaledWidth + 'px',
					height: (layer.type === 'text' && layer.height === 'auto') ? 'auto' : newUnscaledHeight + 'px'
				});
				
				// If text layer with auto height, reapply styles to potentially adjust height
				if (layer.type === 'text' && layer.height === 'auto') {
					// Re-apply styles which might affect layout/size
					self._applyTextStyles($element.find('.text-content'), layer);
					$element.css('height', 'auto'); // Ensure CSS height is auto
				}
			},
			stop: (event, ui) => {
				const layer = self.getLayerById(layerId);
				if (!layer || layer.locked) return;
				
				// Use the final unscaled values calculated during resize
				const finalWidth = ui.newUnscaled.width;
				// Determine final height (use 'auto' for text if applicable)
				const finalHeight = (layer.type === 'text' && layer.height === 'auto') ? 'auto' : ui.newUnscaled.height;
				const finalX = ui.newUnscaled.x;
				const finalY = ui.newUnscaled.y;
				
				// Update layer data with the final unscaled values
				self.updateLayerData(layerId, {
					x: finalX,
					y: finalY,
					width: finalWidth,
					height: finalHeight
				});
				
				// Ensure final CSS matches the updated data (especially for auto height)
				const $element = $(event.target);
				$element.css({
					left: finalX + 'px',
					top: finalY + 'px',
					width: finalWidth + 'px',
					height: (typeof finalHeight === 'number') ? finalHeight + 'px' : 'auto' // Set CSS height correctly
				});
				if (layer.type === 'text' && finalHeight === 'auto') {
					$element.css('height', 'auto'); // Ensure it recalculates if needed after potential content reflow
				}
				
				$element.removeClass('ui-resizable-resizing');
				self.saveState(); // Save state after resize completes
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
			border: 'none', // Text content itself shouldn't have border
			outline: 'none',
			whiteSpace: 'pre-wrap', // Preserve whitespace and wrap
			wordWrap: 'break-word', // Break long words
			boxSizing: 'border-box', // Include padding in width/height calculation
		});
		
		// Text Shadow
		if (layerData.shadowEnabled && layerData.shadowColor) {
			const shadow = `${layerData.shadowOffsetX || 0}px ${layerData.shadowOffsetY || 0}px ${layerData.shadowBlur || 0}px ${layerData.shadowColor}`;
			$textContent.css('text-shadow', shadow);
		} else {
			$textContent.css('text-shadow', 'none');
		}
		
		// Text Stroke (using -webkit-text-stroke for wider browser support)
		if (layerData.strokeWidth > 0 && layerData.stroke) {
			$textContent.css({
				'-webkit-text-stroke-width': layerData.strokeWidth + 'px',
				'-webkit-text-stroke-color': layerData.stroke,
				'text-stroke-width': layerData.strokeWidth + 'px', // Standard property
				'text-stroke-color': layerData.stroke,           // Standard property
				'paint-order': 'stroke fill' // Ensure stroke doesn't obscure fill too much
			});
		} else {
			$textContent.css({
				'-webkit-text-stroke-width': '0',
				'text-stroke-width': '0'
			});
		}
		
		// Parent Element Background (applied to the main .canvas-element div)
		const $parentElement = $textContent.parent('.canvas-element');
		if (layerData.backgroundEnabled && layerData.backgroundColor) {
			// Use RGBA for background opacity
			let bgColor = layerData.backgroundColor;
			// If backgroundOpacity is set and less than 1, convert color to RGBA
			if (layerData.backgroundOpacity !== undefined && layerData.backgroundOpacity < 1) {
				// Basic hex/rgb to rgba conversion (improve if needed)
				const opacity = Math.max(0, Math.min(1, layerData.backgroundOpacity));
				if (bgColor.startsWith('#')) {
					const bigint = parseInt(bgColor.slice(1), 16);
					const r = (bigint >> 16) & 255;
					const g = (bigint >> 8) & 255;
					const b = bigint & 255;
					bgColor = `rgba(${r},${g},${b},${opacity})`;
				} else if (bgColor.startsWith('rgb(')) {
					bgColor = bgColor.replace('rgb(', 'rgba(').replace(')', `,${opacity})`);
				}
				// else assume it's already rgba or another format we don't modify
			}
			
			$parentElement.css({
				backgroundColor: bgColor,
				borderRadius: (layerData.backgroundCornerRadius || 0) + 'px',
			});
			// Ensure height adjusts if needed after background/padding added
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
		// General styles for non-text elements (e.g., images)
		if (!$element || !layerData) return;
		
		// Border (Example - could be extended)
		if (layerData.border) { // Assuming border is a string like "1px solid red"
			$element.css('border', layerData.border);
		} else {
			// Remove border unless selected (selection border is handled by class)
			if (!$element.hasClass('selected')) {
				$element.css('border', 'none'); // Remove default/placeholder border
			}
		}
		
		// Filters (Example - assuming filter is a CSS filter string)
		if (layerData.filters) {
			$element.css('filter', layerData.filters);
		} else {
			$element.css('filter', 'none');
		}
		
		// Add other general styling updates here (e.g., box-shadow, rounded corners for the div itself)
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
