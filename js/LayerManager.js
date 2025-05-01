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
			console.error("LayerManager requires an instance of CanvasManager!");
			// Handle error appropriately, maybe throw an exception
		}
	}
	
	// --- Core Layer Management ---
	
	// Generates a short, unique ID
	_generateId() {
		return `layer-${this.uniqueIdCounter++}`;
		// Alternative: More robust random ID
		// return Math.random().toString(36).substring(2, 10);
	}
	
	addLayer(type, props = {}) {
		const layerId = props.id + this._generateId() || this._generateId(); // Use provided ID or generate new
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
			type: type,
			opacity: 1,
			visible: true,
			locked: false,
			x: 50,
			y: 50,
			width: type === 'text' ? 200 : 150,
			height: type === 'text' ? 'auto' : 100,
			zIndex: initialZIndex, // Use calculated zIndex
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
			// Image specific defaults (if any needed beyond width/height/content)
			// content: type === 'image' ? 'path/to/placeholder.png' : '',
		};
		
		// Merge provided props with defaults
		// Important: Deep merge isn't done automatically with spread syntax for nested objects
		// We handle styles/properties individually below if needed, or rely on direct property access
		const layerData = {...defaultProps, ...props};
		
		// Ensure numeric types are numbers
		layerData.x = parseFloat(layerData.x) || 0;
		layerData.y = parseFloat(layerData.y) || 0;
		layerData.width = layerData.width === 'auto' ? 'auto' : (parseFloat(layerData.width) || defaultProps.width);
		layerData.height = layerData.height === 'auto' ? 'auto' : (parseFloat(layerData.height) || defaultProps.height);
		layerData.opacity = parseFloat(layerData.opacity) ?? 1;
		layerData.zIndex = parseInt(layerData.zIndex) || initialZIndex; // Ensure zIndex is integer
		
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
				// Optional: Confirmation dialog
				// if (confirm(`Are you sure you want to delete the selected layer?`)) {
				this.deleteLayer(this.selectedLayerId);
				// }
			}
		}
	}
	
	// Updates the layer data in the 'this.layers' array
	updateLayerData(layerId, newData) {
		const layerIndex = this.layers.findIndex(l => l.id === layerId);
		if (layerIndex > -1) {
			// Merge new data into the existing layer data
			// This preserves properties not included in newData
			this.layers[layerIndex] = {...this.layers[layerIndex], ...newData};
			const updatedLayer = this.layers[layerIndex];
			
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
				// Note: Need to resort this.layers array if zIndex changes significantly
			}
			
			// --- Update type-specific properties ---
			if (updatedLayer.type === 'text') {
				const $textContent = $element.find('.text-content');
				if (newData.content !== undefined) {
					$textContent.text(updatedLayer.content);
					this.updateList(); // Update name in list if content changes
				}
				// Apply all text styles if any style-related prop changed
				// This is simpler than checking each individual style prop
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
				}
				// Apply general styles if needed (e.g., border, filters in the future)
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
			// Create object with the single property change
			const update = {[property]: value};
			
			// Handle specific conversions or related properties
			if (property === 'fill') { // Text color
				// Ensure value is in rgba format if possible? Or let CSS handle it.
			} else if (property === 'fontSize') {
				value = parseFloat(value) || layer.fontSize; // Ensure number
				update[property] = value;
			}
			// Add more specific handling if needed
			
			this.updateLayerData(layerId, update); // Use the main update method
			// updateLayerData handles the visual update
		}
	}
	
	getLayerById(layerId) {
		return this.layers.find(l => l.id === layerId);
	}
	
	// Returns a deep copy of the layers array in the correct format
	getLayers() {
		// Since this.layers already stores data in the target JSON format,
		// we just need a deep copy to prevent external modification.
		return JSON.parse(JSON.stringify(this.layers));
	}
	
	// Replaces all current layers with the provided data (for Load, History, Templates)
	setLayers(layersData, keepExisting = false) {
		if (!keepExisting) {
			this.$canvas.empty(); // Clear existing elements from canvas
			this.layers = []; // Clear internal data array
		}
		this.selectedLayerId = null; // Deselect
		
		// Reset unique ID counter based on loaded data
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
		
		// Add and render each layer from the provided data
		// Ensure they are added in an order that respects zIndex if possible,
		// although sorting after adding handles it too.
		const sortedLayers = [...layersData].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
		
		sortedLayers.forEach(layerData => {
			layerData.id = layerData.id + this._generateId() || this._generateId(); // Ensure unique ID
			// Use addLayer without triggering saveState internally
			const addedLayer = this.addLayer(layerData.type, layerData);
			// Ensure the original zIndex is respected if provided
			if (layerData.zIndex !== undefined && addedLayer) {
				addedLayer.zIndex = layerData.zIndex;
				$(`#${addedLayer.id}`).css('z-index', addedLayer.zIndex);
			}
		});
		
		// Final sort of the internal array after all additions
		this.layers.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
		
		this.updateList(); // Update the sidebar list
		this.selectLayer(null); // Ensure nothing is selected initially
		// Don't save state here - let Load/Undo/Redo handle it
	}
	
	// --- Selection ---
	selectLayer(layerId) {
		if (this.selectedLayerId === layerId) {
			// If clicking the selected layer again, maybe start text edit? (Future enhancement)
			return;
		}
		
		// Deselect previous
		if (this.selectedLayerId) {
			$(`#${this.selectedLayerId}`).removeClass('selected');
		}
		this.$layerList.find('.list-group-item.active').removeClass('active');
		
		this.selectedLayerId = layerId;
		const selectedLayer = this.getSelectedLayer();
		
		if (selectedLayer) {
			const $element = $(`#${selectedLayer.id}`);
			$element.addClass('selected');
			// Bring selected element visually to front of its z-index group (for handles)
			// Note: This doesn't change the actual zIndex data
			//$element.appendTo(this.$canvas); // Re-appending moves it visually last
			
			this.$layerList.find(`.list-group-item[data-layer-id="${layerId}"]`).addClass('active');
		}
		
		// Notify App/UI Manager about selection change
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
			$element.toggleClass('layer-hidden', !layer.visible); // For potential CSS rules
			this.updateList(); // Update icon in list
			this.saveState();
		}
	}
	
	toggleLockLayer(layerId) {
		const layer = this.getLayerById(layerId);
		if (layer) {
			layer.locked = !layer.locked;
			const $element = $(`#${layerId}`);
			$element.toggleClass('locked', layer.locked);
			this._updateElementInteractivity($element, layer); // Enable/disable interactions
			this.updateList(); // Update icon in list
			// Update global buttons if the selected layer was the one being locked/unlocked
			if (layerId === this.selectedLayerId) {
				this.onLayerSelect(layer); // Trigger UI update for buttons
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
	moveLayer(layerId, direction) { // direction: 'front', 'back', 'up', 'down'
		const layerIndex = this.layers.findIndex(l => l.id === layerId);
		if (layerIndex === -1) return;
		
		const currentLayers = [...this.layers]; // Work with a copy for manipulation
		const layerToMove = currentLayers.splice(layerIndex, 1)[0];
		
		if (direction === 'front') {
			currentLayers.push(layerToMove);
		} else if (direction === 'back') {
			currentLayers.unshift(layerToMove);
		} else if (direction === 'up' && layerIndex < currentLayers.length) { // length is already reduced
			currentLayers.splice(layerIndex + 1, 0, layerToMove);
		} else if (direction === 'down' && layerIndex > 0) {
			currentLayers.splice(layerIndex - 1, 0, layerToMove);
		} else {
			// Put it back if direction is invalid or already at edge
			currentLayers.splice(layerIndex, 0, layerToMove);
			return; // No change
		}
		
		// Reassign zIndex based on the new order
		currentLayers.forEach((layer, index) => {
			layer.zIndex = index + 1;
		});
		
		// Update the main layers array and apply CSS
		this.layers = currentLayers;
		this._updateZIndices(); // Applies CSS z-index
		this.updateList(); // Reflect new order in the list
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
	
	// Applies zIndex from data to CSS
	_updateZIndices() {
		this.layers.forEach((layer) => {
			$(`#${layer.id}`).css('z-index', layer.zIndex || 0);
		});
	}
	
	// --- Rendering & Interaction ---
	_renderLayer(layerData) {
		const $element = $(`<div class="canvas-element" id="${layerData.id}"></div>`)
			.css({
				position: 'absolute', // Ensure position is absolute
				left: layerData.x + 'px',
				top: layerData.y + 'px',
				width: layerData.width === 'auto' ? 'auto' : layerData.width + 'px',
				height: layerData.height === 'auto' ? 'auto' : layerData.height + 'px',
				zIndex: layerData.zIndex || 0,
				opacity: layerData.opacity ?? 1,
				display: layerData.visible ? 'block' : 'none', // Use block or flex as appropriate
				// Add pointer-events: none; if locked? Handled by draggable/resizable disable
			})
			.data('layerId', layerData.id); // Store ID for easy access
		
		if (!layerData.visible) {
			$element.addClass('layer-hidden');
		}
		if (layerData.locked) {
			$element.addClass('locked');
		}
		
		if (layerData.type === 'text') {
			const $textContent = $('<div class="text-content"></div>')
				.text(layerData.content); // Set initial text content
			
			// Apply all text styles from the layerData
			this._applyTextStyles($textContent, layerData);
			
			$element.append($textContent);
			
			// Double-click to edit text
			$textContent.on('dblclick', () => {
				const currentLayer = this.getLayerById(layerData.id); // Get fresh data
				if (!currentLayer || currentLayer.locked) return;
				
				// Use a textarea for better editing experience (future enhancement)
				// For now, use prompt:
				const currentText = $textContent.text();
				const newText = prompt("Enter new text:", currentText);
				if (newText !== null && newText !== currentText) {
					this.updateLayerData(currentLayer.id, {content: newText});
					this.saveState();
				}
			});
			
			// If height is auto, set element height to auto initially
			if (layerData.height === 'auto') {
				$element.css('height', 'auto');
			}
			
		} else if (layerData.type === 'image') {
			const $img = $('<img>')
				.attr('src', layerData.content)
				.css({
					display: 'block', // Remove extra space below image
					// width: layerData.width + 'px',
					// height: layerData.height + 'px',
					objectFit: 'cover' // Or 'contain', could be a layer property
				})
				.on('error', function () {
					// Handle broken image links
					$(this).attr('alt', 'Image failed to load');
					// Optionally replace src with a placeholder
				});
			
			// Apply general styles (like border, filters if added later)
			this._applyStyles($element, layerData);
			$element.append($img);
		}
		// Add other layer types here (e.g., shape)
		
		this.$canvas.append($element);
		this._makeElementInteractive($element, layerData); // Make it draggable/resizable
	}
	
	_makeElementInteractive($element, layerData) {
		const layerId = layerData.id;
		const self = this; // Reference LayerManager instance for callbacks
		
		// --- Variables to store drag start state ---
		let startMouseX, startMouseY, startElementX, startElementY;
		
		// --- Draggable ---
		$element.draggable({
			containment: 'parent', // Keep containment as the canvas
			start: (event, ui) => {
				const layer = self.getLayerById(layerId); // Use self
				if (!layer || layer.locked) return false; // Check lock status
				self.selectLayer(layerId); // Select on drag start
				$(event.target).addClass('ui-draggable-dragging'); // Visual feedback
				
				// Store initial mouse position (relative to page)
				startMouseX = event.pageX;
				startMouseY = event.pageY;
				
				// Store initial element position (from layer data - unscaled coords)
				startElementX = layer.x;
				startElementY = layer.y;
				
				// Prevent default browser drag behavior if needed (usually handled by jQuery UI)
				// event.preventDefault();
			},
			drag: (event, ui) => {
				const layer = self.getLayerById(layerId); // Use self
				if (!layer || layer.locked) return false; // Still check lock during drag
				const zoom = self.canvasManager.currentZoom; // Get current zoom from CanvasManager
				
				// Calculate total mouse movement delta since drag start
				const mouseDx = event.pageX - startMouseX;
				const mouseDy = event.pageY - startMouseY;
				
				// Scale the mouse delta based on the zoom level to get the
				// corresponding delta in the unscaled canvas coordinate system.
				const elementDx = mouseDx / zoom;
				const elementDy = mouseDy / zoom;
				
				// Calculate the new target position in the unscaled coordinate system
				const newX = startElementX + elementDx;
				const newY = startElementY + elementDy;
				
				// Update the ui.position object. jQuery UI uses this to set the
				// element's actual CSS 'left' and 'top' properties. Since the element
				// lives inside the unscaled canvas coordinate space (even though the
				// canvas itself is visually scaled), these CSS properties should
				// directly correspond to our calculated newX and newY.
				ui.position.left = newX;
				ui.position.top = newY;
				
				// --- Optional console logging for debugging ---
				// console.log(`Zoom: ${zoom.toFixed(2)} | Mouse dY: ${mouseDy.toFixed(0)} | Element dY: ${elementDy.toFixed(2)} | Start Y: ${startElementY.toFixed(2)} | New Y: ${newY.toFixed(2)} | ui.top: ${ui.position.top.toFixed(2)}`);
				
			},
			stop: (event, ui) => {
				const layer = self.getLayerById(layerId); // Use self
				if (!layer || layer.locked) return; // Check lock on stop
				
				// On stop, ui.position contains the final calculated position (newX, newY)
				// from the last 'drag' event. Update the layer data with these final values.
				self.updateLayerData(layerId, { x: ui.position.left, y: ui.position.top });
				
				$(event.target).removeClass('ui-draggable-dragging'); // Remove visual feedback
				self.saveState(); // Save history state
			}
		});
		
		// --- Resizable ---
		// Keep the existing resizable logic for now, assuming it works correctly.
		// If resizing also shows issues, it might need a similar adjustment,
		// although it's more complex due to different handles affecting size/position.
		$element.resizable({
			handles: 'n, e, s, w, ne, se, sw, nw',
			// containment: 'parent', // Containment can be tricky with zoom/resize
			start: (event, ui) => {
				const layer = self.getLayerById(layerId); // Use self
				if (!layer || layer.locked) return false;
				self.selectLayer(layerId); // Use self
				$(event.target).addClass('ui-resizable-resizing');
			},
			resize: (event, ui) => {
				const layer = self.getLayerById(layerId); // Use self
				if (!layer || layer.locked) return false;
				const zoom = self.canvasManager.currentZoom; // Use self
				
				// --- Using the original resize compensation logic ---
				if (zoom === 1) return;
				
				const dWidth = ui.size.width - ui.originalSize.width;
				const dHeight = ui.size.height - ui.originalSize.height;
				const dLeft = ui.position.left - ui.originalPosition.left;
				const dTop = ui.position.top - ui.originalPosition.top;
				
				const scaledDWidth = dWidth / zoom;
				const scaledDHeight = dHeight / zoom;
				const scaledDLeft = dLeft / zoom;
				const scaledDTop = dTop / zoom;
				
				ui.size.width = ui.originalSize.width + scaledDWidth;
				ui.size.height = ui.originalSize.height + scaledDHeight;
				ui.position.left = ui.originalPosition.left + scaledDLeft;
				ui.position.top = ui.originalPosition.top + scaledDTop;
			},
			stop: (event, ui) => {
				const layer = self.getLayerById(layerId); // Use self
				if (!layer || layer.locked) return;
				
				const newX = ui.position.left;
				const newY = ui.position.top;
				const newWidth = ui.size.width;
				const newHeight = (layer.type === 'text' && layer.height === 'auto') ? 'auto' : ui.size.height;
				
				self.updateLayerData(layerId, { x: newX, y: newY, width: newWidth, height: newHeight }); // Use self
				
				const $element = $(event.target);
				if (layer.type === 'text' && newHeight === 'auto') {
					$element.css('width', newWidth + 'px');
					const updatedLayer = self.getLayerById(layerId); // Use self
					if (updatedLayer) {
						self._applyTextStyles($element.find('.text-content'), updatedLayer); // Use self
					}
					$element.css('height', 'auto');
				} else {
					const finalHeightCSS = (typeof newHeight === 'number') ? newHeight + 'px' : 'auto';
					$element.css({ width: newWidth + 'px', height: finalHeightCSS });
				}
				
				$element.removeClass('ui-resizable-resizing');
				self.saveState(); // Use self
			}
		});
		
		// --- Click to Select ---
		$element.on('click', (e) => {
			e.stopPropagation();
			self.selectLayer(layerId); // Use self
		});
		
		// --- Initial Interactivity State ---
		self._updateElementInteractivity($element, layerData); // Use self
	}
	
	
	// Enable/disable jQuery UI interactions based on lock state
	_updateElementInteractivity($element, layerData) {
		const isLocked = layerData.locked;
		try {
			if ($element.hasClass('ui-draggable')) {
				$element.draggable(isLocked ? 'disable' : 'enable');
			}
			if ($element.hasClass('ui-resizable')) {
				$element.resizable(isLocked ? 'disable' : 'enable');
			}
			// Add specific class for cursor styling via CSS
			$element.toggleClass('interactions-disabled', isLocked);
			
		} catch (error) {
			// Ignore errors if widget not initialized yet
			// console.warn("Error updating interactivity:", error);
		}
	}
	
	// Applies styles from layerData to a text element's content div
	_applyTextStyles($textContent, layerData) {
		if (!$textContent || !layerData) return;
		
		// Basic font properties
		$textContent.css({
			fontFamily: layerData.fontFamily || 'Arial',
			fontSize: (layerData.fontSize || 16) + 'px',
			fontWeight: layerData.fontWeight || 'normal',
			fontStyle: layerData.fontStyle || 'normal',
			textDecoration: layerData.textDecoration || 'none',
			color: layerData.fill || 'rgba(0,0,0,1)', // Use fill for color
			textAlign: layerData.align || 'left',
			lineHeight: layerData.lineHeight || 1.3,
			letterSpacing: (layerData.letterSpacing || 0) + 'px', // Add px unit
			padding: (layerData.backgroundPadding || 0) + 'px', // Apply padding for background
			// Reset properties that might interfere
			border: 'none',
			outline: 'none',
			whiteSpace: 'pre-wrap', // Respect newlines and spaces from content
			wordWrap: 'break-word', // Break long words
			// display: 'flex', // Remove flex from text content itself, handle alignment via text-align
			// alignItems: 'center',
			// justifyContent: 'center',
		});
		
		// Text Shadow
		if (layerData.shadowEnabled && layerData.shadowColor) {
			const shadow = `${layerData.shadowOffsetX || 0}px ${layerData.shadowOffsetY || 0}px ${layerData.shadowBlur || 0}px ${layerData.shadowColor}`;
			$textContent.css('text-shadow', shadow);
		} else {
			$textContent.css('text-shadow', 'none');
		}
		
		// Text Stroke (using non-standard properties, might not work everywhere)
		if (layerData.strokeWidth > 0 && layerData.stroke) {
			$textContent.css({
				'-webkit-text-stroke-width': layerData.strokeWidth + 'px',
				'-webkit-text-stroke-color': layerData.stroke,
				'text-stroke-width': layerData.strokeWidth + 'px', // Standard (future)
				'text-stroke-color': layerData.stroke, // Standard (future)
				// Fallback or alternative: paint-order for SVG-like control (limited support)
				'paint-order': 'stroke fill'
			});
		} else {
			$textContent.css({
				'-webkit-text-stroke-width': '0',
				'text-stroke-width': '0'
			});
		}
		
		// Background
		const $parentElement = $textContent.parent('.canvas-element'); // Apply background to the container
		if (layerData.backgroundEnabled && layerData.backgroundColor) {
			$parentElement.css({
				backgroundColor: layerData.backgroundColor, // Assumes color includes opacity if needed
				borderRadius: (layerData.backgroundCornerRadius || 0) + 'px',
				// Padding is applied to the inner textContent element above
			});
			// Adjust parent height if text wraps/changes size significantly AND height is auto
			if (layerData.height === 'auto') {
				$parentElement.css('height', 'auto');
			}
		} else {
			$parentElement.css({
				backgroundColor: 'transparent',
				borderRadius: '0',
			});
			// Adjust parent height if text wraps/changes size significantly AND height is auto
			if (layerData.height === 'auto') {
				$parentElement.css('height', 'auto');
			}
		}
	}
	
	// Applies general styles (non-text specific) from layerData to the main element container
	_applyStyles($element, layerData) {
		if (!$element || !layerData) return;
		
		// Apply opacity (already handled in _renderLayer and updateLayerData initial CSS)
		// $element.css('opacity', layerData.opacity ?? 1);
		
		// Example: Apply a border if defined (could be a future property)
		if (layerData.border) { // e.g., layerData.border = "2px solid blue"
			$element.css('border', layerData.border);
		} else {
			// Ensure no residual border if property removed, unless it's the selection border
			if (!$element.hasClass('selected')) {
				$element.css('border', '1px dashed transparent'); // Keep the placeholder for selection
			}
		}
		
		// Example: Apply CSS filters if defined
		if (layerData.filters) { // e.g., layerData.filters = "grayscale(1) blur(2px)"
			$element.css('filter', layerData.filters);
		} else {
			$element.css('filter', 'none');
		}
	}
	
	// --- Layer List Panel ---
	initializeList() {
		this.$layerList.sortable({
			axis: 'y', // Allow vertical sorting only
			containment: 'parent', // Keep items within the list container
			placeholder: 'ui-sortable-placeholder list-group-item', // Class for the placeholder
			helper: 'clone', // Use a clone of the item while dragging
			items: '> li:not(.text-muted)', // Only sort actual layer items
			tolerance: 'pointer', // Trigger sorting when pointer overlaps item
			cursor: 'grabbing',
			update: (event, ui) => {
				// Get the new order of layer IDs from the DOM (bottom of list is lowest zIndex visually)
				const newOrderIds = this.$layerList.find('.list-group-item[data-layer-id]')
					.map(function () {
						return $(this).data('layerId');
					})
					.get()
					.reverse(); // Reverse because visually top = highest zIndex
				
				// Reorder the internal layers array based on the new DOM order
				this.layers.sort((a, b) => {
					const indexA = newOrderIds.indexOf(a.id);
					const indexB = newOrderIds.indexOf(b.id);
					// Handle potential errors where an ID might not be found
					if (indexA === -1) return 1;
					if (indexB === -1) return -1;
					return indexA - indexB;
				});
				
				// Update the zIndex property in the data and apply CSS
				this._updateZIndices();
				
				// Save the new state
				this.saveState();
			}
		});
		// Initial list population
		this.updateList();
	}
	
	// Re-draws the entire layer list in the sidebar based on the current this.layers array
	updateList() {
		this.$layerList.empty(); // Clear the current list
		
		if (this.layers.length === 0) {
			this.$layerList.append('<li class="list-group-item text-muted">No layers yet.</li>');
			// Disable sortable if it was enabled and list is now empty
			if (this.$layerList.hasClass('ui-sortable')) {
				try {
					this.$layerList.sortable('disable');
				} catch (e) {
				}
			}
			return;
		}
		
		// Enable sortable if it was disabled and list now has items
		if (this.$layerList.hasClass('ui-sortable')) {
			try {
				this.$layerList.sortable('enable');
			} catch (e) {
			}
		}
		
		
		// Iterate in reverse array order (highest zIndex first) to show top layer at the top of the list
		[...this.layers].reverse().forEach(layer => {
			// Determine icon based on layer type
			const iconClass = layer.type === 'text' ? 'fa-font' : (layer.type === 'image' ? 'fa-image' : 'fa-square'); // Default icon
			
			// Generate a display name for the layer
			let layerName = `Layer ${layer.id.split('-')[1] || layer.id}`; // Default name
			if (layer.type === 'text') {
				const textContent = (layer.content || '').trim();
				layerName = textContent.substring(0, 25) + (textContent.length > 25 ? '...' : '');
				if (!layerName) layerName = 'Empty Text';
			} else if (layer.type === 'image') {
				// Try to get filename from src if it's a URL
				try {
					const url = new URL(layer.content);
					const pathParts = url.pathname.split('/');
					const filename = pathParts[pathParts.length - 1];
					if (filename) {
						layerName = filename.substring(0, 25) + (filename.length > 25 ? '...' : '');
					} else {
						layerName = `Image ${layer.id.split('-')[1] || layer.id}`;
					}
				} catch (e) {
					// If content is not a valid URL (e.g., base64), use default name
					layerName = `Image ${layer.id.split('-')[1] || layer.id}`;
				}
			}
			// Add other type name logic here
			
			// Determine lock and visibility icons and titles
			const lockIconClass = layer.locked ? 'fas fa-lock lock-icon locked' : 'fas fa-lock-open lock-icon';
			const lockTitle = layer.locked ? 'Unlock Layer' : 'Lock Layer';
			const visibilityIconClass = layer.visible ? 'fas fa-eye' : 'fas fa-eye-slash';
			const visibilityTitle = layer.visible ? 'Hide Layer' : 'Show Layer';
			const itemHiddenClass = layer.visible ? '' : 'layer-item-hidden'; // Class for styling hidden layer items
			
			// Create the list item HTML
			const $item = $(`
                <li class="list-group-item ${itemHiddenClass}" data-layer-id="${layer.id}">
                    <div class="d-flex align-items-center">
                        <span class="layer-icon me-2"><i class="fas ${iconClass}"></i></span>
                        <span class="layer-name flex-grow-1">${$('<div>').text(layerName).html()}</span> <!-- Sanitize name -->
                        <span class="layer-controls ms-auto d-flex align-items-center">
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
			
			// Add 'active' class if this layer is selected
			if (this.selectedLayerId === layer.id) {
				$item.addClass('active');
			}
			
			// --- Attach Event Listeners ---
			
			// Click on item (but not buttons) to select the layer
			$item.on('click', (e) => {
				// Only select if the click wasn't on a button within the item
				if (!$(e.target).closest('button').length) {
					this.selectLayer(layer.id);
				}
			});
			
			// Click on visibility button
			$item.find('.toggle-visibility').on('click', (e) => {
				e.stopPropagation(); // Prevent item click selection
				this.toggleLayerVisibility(layer.id);
			});
			
			// Click on lock button
			$item.find('.lock-layer').on('click', (e) => {
				e.stopPropagation();
				this.toggleLockLayer(layer.id);
			});
			
			// Click on delete button
			$item.find('.delete-layer').on('click', (e) => {
				e.stopPropagation();
				// Optional: Add confirmation dialog
				if (confirm(`Are you sure you want to delete layer "${layerName}"?`)) {
					this.deleteLayer(layer.id);
				}
			});
			
			// Append the newly created item to the list
			this.$layerList.append($item);
		});
		
		// Refresh sortable to recognize new items (might not be strictly necessary with 'items' option)
		if (this.$layerList.hasClass('ui-sortable')) {
			try {
				this.$layerList.sortable('refresh');
			} catch (e) {
			}
		}
	}
} // End of LayerManager class
