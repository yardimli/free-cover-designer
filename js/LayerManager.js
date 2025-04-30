class LayerManager {
	constructor($canvas, $layerList, options) {
		this.$canvas = $canvas;
		this.$layerList = $layerList;
		this.layers = [];
		this.selectedLayerId = null;
		this.uniqueIdCounter = 0;
		
		// Callbacks provided by the App
		this.onLayerSelect = options.onLayerSelect || (() => {});
		this.saveState = options.saveState || (() => {}); // Callback to trigger history save
	}
	
	// --- Core Layer Management ---
	
	addLayer(type, props = {}) {
		const layerId = `layer-${this.uniqueIdCounter++}`;
		const zIndex = this.layers.length > 0 ? Math.max(...this.layers.map(l => l.zIndex)) + 1 : 1;
		const defaultProps = {
			id: layerId,
			type: type,
			content: type === 'text' ? 'New Text' : '',
			x: props.x ?? 50,
			y: props.y ?? 50,
			width: props.width ?? (type === 'text' ? 200 : 150),
			height: props.height ?? (type === 'text' ? 'auto' : 100),
			zIndex: zIndex,
			styles: props.styles ?? (type === 'text' ? { fontFamily: 'Arial', fontSize: '24px', color: '#000000', textAlign: 'left' } : {}),
			locked: false,
			visible: true
		};
		
		const layerData = {...defaultProps, ...props, id: layerId, zIndex: zIndex};
		if (props.styles) {
			layerData.styles = {...defaultProps.styles, ...props.styles};
		}
		if (props.visible !== undefined) {
			layerData.visible = props.visible;
		}
		
		this.layers.push(layerData);
		this.layers.sort((a, b) => a.zIndex - b.zIndex); // Keep sorted by zIndex
		this._renderLayer(layerData);
		this.updateList();
		// Don't save state here, let the calling action (e.g., drop, load) handle it
		return layerData;
	}
	
	deleteLayer(layerId) {
		const layerIndex = this.layers.findIndex(l => l.id === layerId);
		if (layerIndex > -1) {
			$(`#${layerId}`).remove();
			this.layers.splice(layerIndex, 1);
			if (this.selectedLayerId === layerId) {
				this.selectLayer(null);
			}
			this._updateZIndices();
			this.updateList();
			this.saveState(); // Save state after deletion
		}
	}
	
	deleteSelectedLayer() {
		if (this.selectedLayerId) {
			const layer = this.getLayerById(this.selectedLayerId);
			if (layer && !layer.locked) {
				if (confirm(`Are you sure you want to delete the selected layer?`)) {
					this.deleteLayer(this.selectedLayerId);
				}
			}
		}
	}
	
	updateLayerData(layerId, newData) {
		const layerIndex = this.layers.findIndex(l => l.id === layerId);
		if (layerIndex > -1) {
			const currentLayer = this.layers[layerIndex];
			// Deep merge for styles
			if (newData.styles) {
				newData.styles = {...currentLayer.styles, ...newData.styles};
			}
			this.layers[layerIndex] = {...currentLayer, ...newData};
			
			// Update visual representation if necessary (e.g., position, size)
			const $element = $(`#${layerId}`);
			if (newData.x !== undefined) $element.css('left', newData.x + 'px');
			if (newData.y !== undefined) $element.css('top', newData.y + 'px');
			if (newData.width !== undefined) $element.css('width', newData.width + (typeof newData.width === 'number' ? 'px' : ''));
			if (newData.height !== undefined) $element.css('height', newData.height + (typeof newData.height === 'number' ? 'px' : ''));
			if (newData.content !== undefined && currentLayer.type === 'text') {
				$element.find('.text-content').text(newData.content);
				this.updateList(); // Update name in list
			}
			// Styles are applied separately by TextToolbar or _applyStyles
			
			// Don't save state here, let the calling action handle it
			return this.layers[layerIndex];
		}
		return null;
	}
	
	updateLayerStyle(layerId, property, value) {
		const layer = this.getLayerById(layerId);
		if (layer) {
			const newStyles = { ...layer.styles, [property]: value };
			this.updateLayerData(layerId, { styles: newStyles }); // Update data
			
			// Apply visual style change
			const $element = $(`#${layerId}`);
			if (layer.type === 'text') {
				this._applyTextStyles($element.find('.text-content'), newStyles);
			} else {
				this._applyStyles($element, newStyles); // General styles for images etc.
			}
			// Don't save state here, let TextToolbar handle it
		}
	}
	
	getLayerById(layerId) {
		return this.layers.find(l => l.id === layerId);
	}
	
	getLayers() {
		return this.layers; // Return a shallow copy? JSON.parse(JSON.stringify(this.layers));
	}
	
	setLayers(layersData) {
		// Used by HistoryManager or Load function
		this.$canvas.empty(); // Clear existing elements
		this.layers = layersData;
		this.selectedLayerId = null; // Deselect
		
		// Find max ID to avoid collisions
		if (this.layers.length > 0) {
			const maxId = Math.max(...this.layers.map(l => parseInt(l.id.split('-')[1] || 0)));
			this.uniqueIdCounter = maxId + 1;
		} else {
			this.uniqueIdCounter = 0;
		}
		
		this.layers.forEach(layerData => {
			this._renderLayer(layerData); // Re-render each layer
		});
		this.updateList();
		this.selectLayer(null); // Ensure nothing is selected initially
	}
	
	
	// --- Selection ---
	
	selectLayer(layerId) {
		if (this.selectedLayerId === layerId) return;
		
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
			this._updateElementInteractivity($element, layer); // Enable/disable interactions
			this.updateList();
			this.onLayerSelect(this.getSelectedLayer()); // Update buttons if selected layer was locked/unlocked
			this.saveState();
		}
	}
	
	toggleSelectedLayerLock() {
		if (this.selectedLayerId) {
			this.toggleLockLayer(this.selectedLayerId);
		}
	}
	
	// --- Layer Order (Z-Index) ---
	
	moveLayer(layerId, direction) { // direction: 'front', 'back', 'up', 'down' (up/down relative)
		const layerIndex = this.layers.findIndex(l => l.id === layerId);
		if (layerIndex === -1) return;
		
		const layerToMove = this.layers.splice(layerIndex, 1)[0];
		
		if (direction === 'front') {
			this.layers.push(layerToMove);
		} else if (direction === 'back') {
			this.layers.unshift(layerToMove);
		} else if (direction === 'up' && layerIndex < this.layers.length) { // layers.length because splice reduced it
			this.layers.splice(layerIndex + 1, 0, layerToMove);
		} else if (direction === 'down' && layerIndex > 0) {
			this.layers.splice(layerIndex - 1, 0, layerToMove);
		} else {
			// Put it back if direction is invalid or already at edge
			this.layers.splice(layerIndex, 0, layerToMove);
			return; // No change
		}
		
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
		this.layers.forEach((layer, index) => {
			layer.zIndex = index + 1;
			$(`#${layer.id}`).css('z-index', layer.zIndex);
		});
	}
	
	// --- Rendering & Interaction ---
	
	_renderLayer(layerData) {
		const $element = $(`<div class="canvas-element" id="${layerData.id}"></div>`)
			.css({
				left: layerData.x + 'px',
				top: layerData.y + 'px',
				width: layerData.width + (typeof layerData.width === 'number' ? 'px' : ''),
				height: layerData.height + (typeof layerData.height === 'number' ? 'px' : ''),
				zIndex: layerData.zIndex,
				display: layerData.visible ? '' : 'none'
			})
			.data('layerId', layerData.id);
		
		if (!layerData.visible) {
			$element.addClass('layer-hidden');
		}
		if (layerData.locked) {
			$element.addClass('locked');
		}
		
		if (layerData.type === 'text') {
			const $textContent = $('<div class="text-content"></div>').text(layerData.content);
			this._applyTextStyles($textContent, layerData.styles);
			$element.append($textContent);
			$element.css('height', 'auto'); // Let text define height initially
			
			$textContent.on('dblclick', () => {
				const currentLayer = this.getLayerById(layerData.id); // Get fresh data
				if (currentLayer.locked) return;
				const currentText = $textContent.text();
				const newText = prompt("Enter new text:", currentText);
				if (newText !== null && newText !== currentText) {
					this.updateLayerData(currentLayer.id, { content: newText });
					// Text content already updated by updateLayerData
					this.saveState();
				}
			});
		} else if (layerData.type === 'image') {
			const $img = $('<img>').attr('src', layerData.content).on('load', function() {
				// Optional: Adjust element size to image aspect ratio if height was 'auto'
				// This might require a callback or more complex handling if you want to saveState after load
			});
			this._applyStyles($element, layerData.styles); // Apply general styles
			$element.append($img);
		}
		
		this.$canvas.append($element);
		this._makeElementInteractive($element);
	}
	
	_makeElementInteractive($element) {
		const layerId = $element.data('layerId');
		
		$element.draggable({
			containment: this.$canvas,
			start: (event, ui) => {
				const layer = this.getLayerById(layerId);
				if (layer.locked) return false;
				this.selectLayer(layerId);
			},
			stop: (event, ui) => {
				this.updateLayerData(layerId, { x: ui.position.left, y: ui.position.top });
				this.saveState();
			}
		});
		
		$element.resizable({
			handles: 'n, e, s, w, ne, se, sw, nw',
			containment: this.$canvas,
			start: (event, ui) => {
				const layer = this.getLayerById(layerId);
				if (layer.locked) return false;
				this.selectLayer(layerId);
			},
			stop: (event, ui) => {
				const layer = this.getLayerById(layerId); // Get current data
				const newWidth = ui.size.width;
				const newHeight = layer.type === 'text' ? 'auto' : ui.size.height;
				this.updateLayerData(layerId, { width: newWidth, height: newHeight });
				
				if (layer.type === 'text') {
					$element.css('height', 'auto');
					this._applyTextStyles($element.find('.text-content'), layer.styles);
				} else {
					$element.css('height', newHeight + 'px');
				}
				this.saveState();
			}
		});
		
		$element.on('click', (e) => {
			e.stopPropagation();
			this.selectLayer(layerId);
		});
		
		// Initial lock state
		const layerData = this.getLayerById(layerId);
		this._updateElementInteractivity($element, layerData);
	}
	
	_updateElementInteractivity($element, layerData) {
		if (layerData.locked) {
			if ($element.hasClass('ui-draggable')) $element.draggable('disable');
			if ($element.hasClass('ui-resizable')) $element.resizable('disable');
		} else {
			if ($element.hasClass('ui-draggable')) $element.draggable('enable');
			if ($element.hasClass('ui-resizable')) $element.resizable('enable');
		}
	}
	
	_applyTextStyles($element, styles) {
		$element.css({
			fontFamily: styles.fontFamily || 'Arial',
			fontSize: styles.fontSize || '16px',
			fontWeight: styles.fontWeight || 'normal',
			fontStyle: styles.fontStyle || 'normal',
			textDecoration: styles.textDecoration || 'none',
			color: styles.color || '#000000',
			textAlign: styles.textAlign || 'left',
		});
		// Adjust parent height if text wraps/changes size significantly
		$element.parent('.canvas-element').css('height', 'auto');
	}
	
	_applyStyles($element, styles) {
		// General style application (e.g., opacity, border for images)
		if (styles.opacity) $element.css('opacity', styles.opacity);
		if (styles.border) $element.css('border', styles.border);
		// Add more as needed
	}
	
	
	// --- Layer List Panel ---
	
	initializeList() {
		this.$layerList.sortable({
			axis: 'y',
			containment: 'parent',
			placeholder: 'ui-sortable-placeholder',
			helper: 'clone',
			items: '> li:not(.text-muted)',
			update: (event, ui) => {
				const newOrderIds = this.$layerList.find('.list-group-item').map(function () {
					return $(this).data('layerId');
				}).get().reverse(); // Reverse because list is top-down visually
				
				this.layers.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
				this._updateZIndices();
				// No need to call updateList() here, sortable handles visual order.
				this.saveState();
			}
		});
		this.updateList();
	}
	
	updateList() {
		this.$layerList.empty();
		if (this.layers.length === 0) {
			this.$layerList.append('<li class="list-group-item text-muted">No layers yet.</li>');
			// Ensure sortable is disabled if empty?
			// if (this.$layerList.hasClass('ui-sortable')) this.$layerList.sortable('disable');
			return;
		}
		
		// if (this.$layerList.hasClass('ui-sortable')) this.$layerList.sortable('enable');
		
		// Iterate in reverse array order to show top layer first visually
		[...this.layers].reverse().forEach(layer => {
			const iconClass = layer.type === 'text' ? 'fa-font' : 'fa-image';
			const layerName = layer.type === 'text'
				? (layer.content.substring(0, 20) + (layer.content.length > 20 ? '...' : '')) || 'Empty Text'
				: `Image (${layer.id.split('-')[1]})`;
			const lockIconClass = layer.locked ? 'fas fa-lock locked' : 'fas fa-lock-open';
			const visibilityIconClass = layer.visible ? 'fas fa-eye' : 'fas fa-eye-slash';
			const visibilityTitle = layer.visible ? 'Hide Layer' : 'Show Layer';
			const itemHiddenClass = layer.visible ? '' : 'layer-item-hidden';
			
			const $item = $(`
                <li class="list-group-item ${itemHiddenClass}" data-layer-id="${layer.id}">
                    <span class="layer-icon"><i class="fas ${iconClass}"></i></span>
                    <span class="layer-name">${$('<div>').text(layerName).html()}</span>
                    <span class="layer-controls ms-auto d-flex align-items-center">
                        <button class="btn btn-outline-secondary btn-sm toggle-visibility me-1" title="${visibilityTitle}">
                            <i class="${visibilityIconClass}"></i>
                        </button>
                        <button class="btn btn-outline-secondary btn-sm lock-layer me-1" title="Lock/Unlock">
                            <i class="${lockIconClass} lock-icon"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm delete-layer" title="Delete Layer">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </span>
                </li>
            `);
			
			if (this.selectedLayerId === layer.id) {
				$item.addClass('active');
			}
			
			// Event listeners
			$item.on('click', (e) => {
				if (!$(e.target).closest('button').length) {
					this.selectLayer(layer.id);
				}
			});
			$item.find('.toggle-visibility').on('click', (e) => {
				e.stopPropagation();
				this.toggleLayerVisibility(layer.id);
			});
			$item.find('.lock-layer').on('click', (e) => {
				e.stopPropagation();
				this.toggleLockLayer(layer.id);
			});
			$item.find('.delete-layer').on('click', (e) => {
				e.stopPropagation();
				if (confirm(`Are you sure you want to delete this layer?`)) {
					this.deleteLayer(layer.id);
				}
			});
			
			this.$layerList.append($item);
		});
		// if (this.$layerList.hasClass('ui-sortable')) this.$layerList.sortable('refresh');
	}
}
