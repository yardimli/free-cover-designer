$(document).ready(function () {
	const $canvas = $('#canvas');
	const $layerList = $('#layerList');
	const $textToolbar = $('#textToolbar');
	const $canvasArea = $('#canvas-area'); // <<< Get canvas area
	const $canvasWrapper = $('#canvas-wrapper'); // <<< Get canvas wrapper
	const canvasAreaDiv = document.getElementById('canvas-area');
	
	let layers = []; // Array to hold layer data objects
	let selectedLayer = null;
	let history = [];
	let historyIndex = -1;
	let uniqueIdCounter = 0;
	let rulers = null; // Placeholder for the ruler object
	
	// --- Zoom & Ruler State ---
	let currentZoom = 1.0; // 1.0 = 100%
	const MIN_ZOOM = 0.1; // 10%
	const MAX_ZOOM = 3.0; // 300%
	let isPanning = false; // Optional: For future pan implementation
	let lastPanX, lastPanY;
	
	// --- Initialization ---
	
	loadSidebarContent();
	initializeCanvas();
	initializeLayerList();
	initializeTextToolbar();
	initializeGlobalActions();
	initializeZoomPanAndRulers();
	saveState(); // Initial state
	
	// --- Sidebar Loading ---
	
	function loadSidebarContent() {
		// Load Layouts
		$.getJSON('data/layouts.json', function (data) {
			const $layoutList = $('#layoutList').empty();
			data.forEach(layout => {
				const $thumb = $(`
                    <div class="item-thumbnail layout-thumbnail" title="${layout.name}">
                        <img src="${layout.thumbnail || 'img/placeholder_layout.png'}" alt="${layout.name}">
                        <span>${layout.name}</span>
                    </div>
                `);
				$thumb.data('layoutData', layout.layers); // Store layer data
				$layoutList.append($thumb);
			});
			makeLayoutsDraggable();
		}).fail(() => $('#layoutList').html('<p class="text-danger">Error loading layouts.</p>'));
		
		// Load Covers
		$.getJSON('data/covers.json', function (data) {
			renderCovers(data); // Initial render
			// Search functionality
			$('#coverSearch').on('input', function () {
				const searchTerm = $(this).val().toLowerCase();
				const filteredData = data.filter(cover =>
					cover.title.toLowerCase().includes(searchTerm) ||
					(cover.keywords && cover.keywords.some(k => k.toLowerCase().includes(searchTerm)))
				);
				renderCovers(filteredData);
			});
		}).fail(() => $('#coverList').html('<p class="text-danger">Error loading covers.</p>'));
		
		// Load Elements
		$.getJSON('data/elements.json', function (data) {
			const $elementList = $('#elementList').empty();
			data.forEach(element => {
				const $thumb = $(`
                    <div class="item-thumbnail element-thumbnail" title="${element.name}">
                        <img src="${element.image}" alt="${element.name}">
                        <span>${element.name}</span>
                    </div>
                `);
				$thumb.data('elementSrc', element.image);
				$elementList.append($thumb);
			});
			makeElementsDraggable();
		}).fail(() => $('#elementList').html('<p class="text-danger">Error loading elements.</p>'));
	}
	
	function renderCovers(coverData) {
		const $coverList = $('#coverList').empty();
		if (coverData.length === 0) {
			$coverList.html('<p class="text-muted">No covers found.</p>');
			return;
		}
		coverData.forEach(cover => {
			const $thumb = $(`
                <div class="item-thumbnail cover-thumbnail" title="${cover.title}">
                    <img src="${cover.image}" alt="${cover.title}">
                    <span>${cover.title}</span>
                </div>
            `);
			$thumb.data('coverSrc', cover.image);
			$coverList.append($thumb);
		});
		makeCoversDraggable();
	}
	
	
	// --- Draggable Sidebar Items ---
	
	function makeLayoutsDraggable() {
		$('.layout-thumbnail').draggable({
			helper: 'clone',
			appendTo: 'body',
			zIndex: 1100, // Ensure helper is above everything
			revert: 'invalid',
			start: function (event, ui) {
				$(ui.helper).css({'width': '100px', 'height': 'auto', 'opacity': 0.7});
			}
		});
	}
	
	function makeCoversDraggable() {
		$('.cover-thumbnail').draggable({
			helper: 'clone',
			appendTo: 'body',
			zIndex: 1100,
			revert: 'invalid',
			start: function (event, ui) {
				$(ui.helper).css({'width': '80px', 'height': 'auto', 'opacity': 0.7});
			}
		});
	}
	
	function makeElementsDraggable() {
		$('.element-thumbnail').draggable({
			helper: 'clone',
			appendTo: 'body',
			zIndex: 1100,
			revert: 'invalid',
			start: function (event, ui) {
				$(ui.helper).css({'width': '50px', 'height': '50px', 'opacity': 0.7});
			}
		});
	}
	
	// --- Canvas Initialization & Droppable ---
	
	function initializeCanvas() {
		$canvas.droppable({
			accept: '.layout-thumbnail, .cover-thumbnail, .element-thumbnail',
			drop: function (event, ui) {
				const $draggedItem = $(ui.draggable);
				// Calculate drop position relative to the UNZOOMED canvas origin
				const canvasOffset = $canvasWrapper.offset(); // Use wrapper offset
				const areaScrollLeft = $canvasArea.scrollLeft();
				const areaScrollTop = $canvasArea.scrollTop();
				
				// Mouse position relative to document
				const mouseX = ui.offset.left;
				const mouseY = ui.offset.top;
				
				// Calculate position relative to the canvas wrapper's top-left corner
				const wrapperX = mouseX - canvasOffset.left;
				const wrapperY = mouseY - canvasOffset.top;
				
				// Account for current scroll within the canvas area
				const scrolledWrapperX = wrapperX + areaScrollLeft;
				const scrolledWrapperY = wrapperY + areaScrollTop;
				
				// Account for zoom to get coordinates relative to the unscaled canvas (0,0)
				const dropX = scrolledWrapperX / currentZoom;
				const dropY = scrolledWrapperY / currentZoom;
				
				const dropPosition = {x: dropX, y: dropY};
				
				// --- Rest of the drop logic remains the same ---
				if ($draggedItem.hasClass('layout-thumbnail')) {
					const layoutData = $draggedItem.data('layoutData');
					layoutData.forEach(layerData => {
						addLayer(layerData.type, layerData);
					});
				} else if ($draggedItem.hasClass('cover-thumbnail')) {
					const imgSrc = $draggedItem.data('coverSrc');
					addLayer('image', {content: imgSrc, x: dropPosition.x, y: dropPosition.y, width: 200, height: 300});
					if (layers.length > 0) {
						moveLayer(layers[layers.length - 1].id, 'back');
					}
				} else if ($draggedItem.hasClass('element-thumbnail')) {
					const imgSrc = $draggedItem.data('elementSrc');
					addLayer('image', {content: imgSrc, x: dropPosition.x, y: dropPosition.y, width: 100, height: 100});
				}
				updateLayerList();
				saveState();
			}
		});
		
	}
	
	// --- Layer Management ---
	
	function addLayer(type, props = {}) {
		const layerId = `layer-${uniqueIdCounter++}`;
		// New layers always start at the highest zIndex initially
		const zIndex = layers.length > 0 ? Math.max(...layers.map(l => l.zIndex)) + 1 : 1;
		
		const defaultProps = {
			id: layerId,
			type: type,
			content: type === 'text' ? 'New Text' : '',
			x: props.x ?? 50,
			y: props.y ?? 50,
			width: props.width ?? (type === 'text' ? 200 : 150),
			height: props.height ?? (type === 'text' ? 'auto' : 100),
			zIndex: zIndex, // Assign calculated zIndex
			styles: props.styles ?? (type === 'text' ? {
				fontFamily: 'Arial',
				fontSize: '24px',
				color: '#000000',
				textAlign: 'left'
			} : {}),
			locked: false,
			visible: true // <<< Add visibility property
		};
		
		// Merge provided props with defaults
		const layerData = {...defaultProps, ...props, id: layerId, zIndex: zIndex};
		
		// Deep merge styles if provided partially
		if (props.styles) {
			layerData.styles = {...defaultProps.styles, ...props.styles};
		}
		// Ensure visibility is explicitly carried over if provided
		if (props.visible !== undefined) {
			layerData.visible = props.visible;
		}
		
		
		layers.push(layerData);
		// Sort layers array by zIndex immediately after adding (important for consistency)
		layers.sort((a, b) => a.zIndex - b.zIndex);
		
		renderLayer(layerData);
		return layerData;
	}
	
	function renderLayer(layerData) {
		const $element = $(`<div class="canvas-element" id="${layerData.id}"></div>`)
			.css({
				left: layerData.x + 'px',
				top: layerData.y + 'px',
				width: layerData.width + (typeof layerData.width === 'number' ? 'px' : ''),
				height: layerData.height + (typeof layerData.height === 'number' ? 'px' : ''),
				zIndex: layerData.zIndex,
				// Apply visibility on initial render
				display: layerData.visible ? '' : 'none' // <<< Set display based on visible flag
			})
			.data('layerId', layerData.id);
		
		// Add class if hidden for potential CSS styling
		if (!layerData.visible) {
			$element.addClass('layer-hidden');
		}
		
		if (layerData.type === 'text') {
			const $textContent = $('<div class="text-content"></div>').text(layerData.content);
			applyTextStyles($textContent, layerData.styles);
			$element.append($textContent);
			$element.css('height', 'auto'); // Let text define height initially
			// Double-click to edit text (basic implementation)
			$textContent.on('dblclick', function () {
				if (layerData.locked) return;
				const currentText = $(this).text();
				const newText = prompt("Enter new text:", currentText);
				if (newText !== null && newText !== currentText) {
					layerData.content = newText;
					$(this).text(newText);
					updateLayerData(layerData.id, {content: newText});
					updateLayerList(); // Update name in layer list
					saveState();
				}
			});
			
		} else if (layerData.type === 'image') {
			const $img = $('<img>').attr('src', layerData.content).on('load', function () {
				// Optional: Adjust element size to image aspect ratio if height was 'auto'
				if (layerData.height === 'auto') {
					const aspectRatio = this.naturalWidth / this.naturalHeight;
					const newHeight = layerData.width / aspectRatio;
					$element.css('height', newHeight + 'px');
					updateLayerData(layerData.id, {height: newHeight});
				}
			});
			// Apply image-specific styles if any (e.g., opacity, border)
			applyStyles($element, layerData.styles);
			$element.append($img);
		}
		
		if (layerData.locked) {
			$element.addClass('locked');
		}
		
		$canvas.append($element);
		makeElementInteractive($element);
	}
	
	function makeElementInteractive($element) {
		const layerId = $element.data('layerId');
		const layerData = findLayer(layerId);
		
		// Draggable
		$element.draggable({
			// containment: 'parent', // Containment within the static #canvas div
			containment: $canvas, // Contain within the canvas boundaries
			start: function (event, ui) {
				if ($(this).hasClass('locked')) return false;
				selectLayer(layerId);
				// Optional: Add class for styling during drag
			},
			drag: function (event, ui) {
				// Optional: Update position display in real-time if needed
			},
			stop: function (event, ui) {
				// Position is relative to the offset parent (#canvas)
				// We store these relative positions directly.
				updateLayerData(layerId, {x: ui.position.left, y: ui.position.top});
				saveState();
			}
		});
		
		// Resizable
		$element.resizable({
			handles: 'n, e, s, w, ne, se, sw, nw',
			containment: $canvas, // Contain resize within canvas boundaries
			start: function (event, ui) {
				if ($(this).hasClass('locked')) return false;
				selectLayer(layerId);
			},
			stop: function (event, ui) {
				const newWidth = ui.size.width;
				// Keep text height auto unless explicitly set otherwise?
				const newHeight = layerData.type === 'text' ? 'auto' : ui.size.height;
				
				updateLayerData(layerId, {width: newWidth, height: newHeight});
				
				// If text, might need to re-apply styles or adjust container
				if (layerData.type === 'text') {
					$(this).css('height', 'auto'); // Let content determine height after resize
					// Re-apply styles might be needed if line wrapping changes significantly
					applyTextStyles($(this).find('.text-content'), findLayer(layerId).styles);
				} else {
					$(this).css('height', newHeight + 'px'); // Apply numeric height for images
				}
				saveState();
			}
		});
		
		// Click to select
		$element.on('click', function (e) {
			e.stopPropagation(); // Prevent canvas area click from deselecting
			selectLayer(layerId);
		});
		
		// Apply locked state to interaction
		if (layerData.locked) {
			$element.draggable('disable');
			$element.resizable('disable');
		} else {
			$element.draggable('enable');
			$element.resizable('enable');
		}
	}
	
	function selectLayer(layerId) {
		if (selectedLayer?.id === layerId) return; // Already selected
		
		// Deselect previous
		if (selectedLayer) {
			$(`#${selectedLayer.id}`).removeClass('selected');
		}
		$('.list-group-item.active').removeClass('active'); // Deselect in layer list
		
		selectedLayer = findLayer(layerId);
		
		if (selectedLayer) {
			const $element = $(`#${selectedLayer.id}`);
			$element.addClass('selected');
			$(`.list-group-item[data-layer-id="${layerId}"]`).addClass('active'); // Select in layer list
			
			// Bring selected element visually to the front temporarily (using high z-index)
			// $element.css('z-index', 1000); // Or manage via class
			
			// Show/hide appropriate toolbars
			if (selectedLayer.type === 'text') {
				populateTextToolbar(selectedLayer);
				$textToolbar.removeClass('d-none');
			} else {
				$textToolbar.addClass('d-none');
				// Potentially show a simpler image toolbar later
			}
			updateActionButtons(); // Enable/disable delete/lock buttons
		} else {
			// Deselected all
			$textToolbar.addClass('d-none');
			updateActionButtons();
		}
	}
	
	function findLayer(layerId) {
		return layers.find(l => l.id === layerId);
	}
	
	function updateLayerData(layerId, newData) {
		const layerIndex = layers.findIndex(l => l.id === layerId);
		if (layerIndex > -1) {
			// Merge new data. Be careful with nested objects like 'styles'.
			const currentLayer = layers[layerIndex];
			layers[layerIndex] = {...currentLayer, ...newData};
			
			// Deep merge for styles
			if (newData.styles) {
				layers[layerIndex].styles = {...currentLayer.styles, ...newData.styles};
			}
			
			return layers[layerIndex];
		}
		return null;
	}
	
	function deleteLayer(layerId) {
		const layerIndex = layers.findIndex(l => l.id === layerId);
		if (layerIndex > -1) {
			$(`#${layerId}`).remove(); // Remove from canvas
			layers.splice(layerIndex, 1); // Remove from data array
			if (selectedLayer?.id === layerId) {
				selectLayer(null); // Deselect if the deleted layer was selected
			}
			updateLayerZIndices(); // Adjust z-indices of remaining layers
			updateLayerList();
			saveState();
		}
	}
	
	function updateLayerZIndices() {
		// Re-assign z-index based on the current order in the 'layers' array
		layers.forEach((layer, index) => {
			layer.zIndex = index + 1; // zIndex starts from 1
			$(`#${layer.id}`).css('z-index', layer.zIndex);
		});
		// console.log("Updated Z-Indices:", layers.map(l => ({id: l.id, z: l.zIndex})));
	}
	
	function moveLayer(layerId, direction) { // direction: 'front' or 'back'
		const layerIndex = layers.findIndex(l => l.id === layerId);
		if (layerIndex === -1) return;
		
		const layerToMove = layers.splice(layerIndex, 1)[0]; // Remove layer from array
		
		if (direction === 'front') {
			layers.push(layerToMove); // Add to the end (top)
		} else if (direction === 'back') {
			layers.unshift(layerToMove); // Add to the beginning (bottom)
		}
		
		updateLayerZIndices(); // Recalculate and apply z-indices
		updateLayerList(); // Refresh the list order
		saveState();
	}
	
	function bringSelectedLayerToFront() {
		if (selectedLayer && !selectedLayer.locked) {
			moveLayer(selectedLayer.id, 'front');
		}
	}
	
	function sendSelectedLayerToBack() {
		if (selectedLayer && !selectedLayer.locked) {
			moveLayer(selectedLayer.id, 'back');
		}
	}
	
	function toggleLockLayer(layerId) {
		const layer = findLayer(layerId);
		if (layer) {
			layer.locked = !layer.locked;
			const $element = $(`#${layer.id}`);
			$element.toggleClass('locked', layer.locked);
			
			// Enable/disable jQuery UI interactions
			if (layer.locked) {
				$element.draggable('disable');
				$element.resizable('disable');
			} else {
				$element.draggable('enable');
				$element.resizable('enable');
			}
			updateLayerList(); // Update lock icon in list
			updateActionButtons(); // Update main lock button state
			saveState();
		}
	}
	
	function toggleLayerVisibility(layerId) {
		const layer = findLayer(layerId);
		if (layer) {
			layer.visible = !layer.visible;
			const $element = $(`#${layer.id}`);
			// Toggle visibility on canvas
			$element.toggle(layer.visible);
			// Add/remove class for potential CSS styling
			$element.toggleClass('layer-hidden', !layer.visible);
			
			updateLayerList(); // Update icon in the list
			// No need to call saveState here if updateLayerList calls it,
			// but safer to call it explicitly if needed elsewhere.
			saveState();
		}
	}
	
	
	// --- Layer List Panel ---
	
	function initializeLayerList() {
		$layerList.sortable({
			axis: 'y',
			containment: 'parent', // Ensure it stays within the layers panel
			placeholder: 'ui-sortable-placeholder',
			helper: 'clone',
			items: '> li:not(.text-muted)', // Exclude the "No layers" message
			update: function (event, ui) {
				const newOrderIds = $layerList.find('.list-group-item').map(function () {
					return $(this).data('layerId');
				}).get().reverse(); // <<<< REVERSE because list is displayed top-first
				
				// Reorder the main 'layers' array based on the visual order
				layers.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
				
				updateLayerZIndices(); // Update z-indices based on new array order
				// No need to call updateLayerList() here, sortable handles visual order.
				saveState();
			}
		});
		updateLayerList();
	}
	
	function updateLayerList() {
		$layerList.empty();
		if (layers.length === 0) {
			$layerList.append('<li class="list-group-item text-muted">No layers yet.</li>');
			return;
		}
		
		// Iterate in reverse array order to show top layer first visually
		[...layers].reverse().forEach(layer => {
			const iconClass = layer.type === 'text' ? 'fa-font' : 'fa-image';
			const layerName = layer.type === 'text'
				? (layer.content.substring(0, 20) + (layer.content.length > 20 ? '...' : '')) || 'Empty Text' // Handle empty text
				: `Image (${layer.id.split('-')[1]})`;
			const lockIconClass = layer.locked ? 'fas fa-lock locked' : 'fas fa-lock-open';
			// <<< New Visibility Icon >>>
			const visibilityIconClass = layer.visible ? 'fas fa-eye' : 'fas fa-eye-slash';
			const visibilityTitle = layer.visible ? 'Hide Layer' : 'Show Layer';
			// <<< Add class if hidden for list item styling >>>
			const itemHiddenClass = layer.visible ? '' : 'layer-item-hidden';
			
			const $item = $(`
                <li class="list-group-item ${itemHiddenClass}" data-layer-id="${layer.id}">
                    <span class="layer-icon"><i class="fas ${iconClass}"></i></span>
                    <span class="layer-name">${$('<div>').text(layerName).html()}</span>
                    <span class="layer-controls ms-auto d-flex align-items-center">
                        <!-- Visibility Button -->
                        <button class="btn btn-outline-secondary btn-sm toggle-visibility me-1" title="${visibilityTitle}">
                            <i class="${visibilityIconClass}"></i>
                        </button>
                        <!-- Lock Button -->
                        <button class="btn btn-outline-secondary btn-sm lock-layer me-1" title="Lock/Unlock">
                            <i class="${lockIconClass} lock-icon"></i>
                        </button>
                        <!-- Delete Button -->
                        <button class="btn btn-outline-danger btn-sm delete-layer" title="Delete Layer">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </span>
                </li>
            `);
			
			if (selectedLayer && selectedLayer.id === layer.id) {
				$item.addClass('active');
			}
			
			// Event listeners
			$item.on('click', function (e) {
				if (!$(e.target).closest('button').length) {
					selectLayer(layer.id);
				}
			});
			// <<< Listener for Visibility Button >>>
			$item.find('.toggle-visibility').on('click', function (e) {
				e.stopPropagation();
				toggleLayerVisibility(layer.id);
			});
			$item.find('.lock-layer').on('click', function (e) {
				e.stopPropagation();
				toggleLockLayer(layer.id);
			});
			$item.find('.delete-layer').on('click', function (e) {
				e.stopPropagation();
				if (confirm(`Are you sure you want to delete this layer?`)) {
					deleteLayer(layer.id);
				}
			});
			
			$layerList.append($item);
		});
		// Ensure sortable is refreshed if items were added/removed
		// $layerList.sortable('refresh'); // Usually not needed unless dynamically adding non-sortable items
	}
	
	
	// --- Text Toolbar ---
	
	function initializeTextToolbar() {
		$('#fontFamilySelect').on('change', function () {
			updateSelectedTextStyle('fontFamily', $(this).val());
		});
		$('#fontSizeInput').on('input', function () {
			updateSelectedTextStyle('fontSize', $(this).val() + 'px');
		});
		$('#fontColorInput').on('input', function () {
			updateSelectedTextStyle('color', $(this).val());
		});
		$('#boldBtn').on('click', function () {
			const currentWeight = selectedLayer?.styles?.fontWeight;
			updateSelectedTextStyle('fontWeight', currentWeight === 'bold' ? 'normal' : 'bold');
			$(this).toggleClass('active', selectedLayer?.styles?.fontWeight === 'bold');
		});
		$('#italicBtn').on('click', function () {
			const currentStyle = selectedLayer?.styles?.fontStyle;
			updateSelectedTextStyle('fontStyle', currentStyle === 'italic' ? 'normal' : 'italic');
			$(this).toggleClass('active', selectedLayer?.styles?.fontStyle === 'italic');
		});
		$('#underlineBtn').on('click', function () {
			const currentDecoration = selectedLayer?.styles?.textDecoration;
			updateSelectedTextStyle('textDecoration', currentDecoration === 'underline' ? 'none' : 'underline');
			$(this).toggleClass('active', selectedLayer?.styles?.textDecoration === 'underline');
		});
		$('#textToolbar .btn-group button[data-align]').on('click', function () {
			updateSelectedTextStyle('textAlign', $(this).data('align'));
			$('#textToolbar .btn-group button[data-align]').removeClass('active');
			$(this).addClass('active');
		});
		// Add Effects button listener here if implementing effects
	}
	
	function populateTextToolbar(layerData) {
		if (!layerData || layerData.type !== 'text') return;
		const styles = layerData.styles;
		$('#fontFamilySelect').val(styles.fontFamily || 'Arial');
		$('#fontSizeInput').val(parseInt(styles.fontSize) || 16);
		$('#fontColorInput').val(styles.color || '#000000');
		
		$('#boldBtn').toggleClass('active', styles.fontWeight === 'bold');
		$('#italicBtn').toggleClass('active', styles.fontStyle === 'italic');
		$('#underlineBtn').toggleClass('active', styles.textDecoration === 'underline');
		
		$('#textToolbar .btn-group button[data-align]').removeClass('active');
		$(`#textToolbar .btn-group button[data-align="${styles.textAlign || 'left'}"]`).addClass('active');
	}
	
	function updateSelectedTextStyle(property, value) {
		if (!selectedLayer || selectedLayer.type !== 'text') return;
		const layerId = selectedLayer.id; // Store ID
		
		// Create the new styles object based on the current selectedLayer's styles
		const newStyles = {...selectedLayer.styles, [property]: value};
		
		// Update the layer data in the main 'layers' array
		const updatedLayer = updateLayerData(layerId, {styles: newStyles});
		
		if (updatedLayer) {
			// Update the global selectedLayer reference to the truly updated object
			selectedLayer = updatedLayer; // <<< IMPORTANT: Use the returned updated object
			
			// Update element on canvas using the LATEST styles
			const $element = $(`#${layerId}`);
			const $textContent = $element.find('.text-content');
			applyTextStyles($textContent, selectedLayer.styles); // Pass the latest styles
			
			// Refresh the toolbar to reflect the new state (especially for toggles)
			populateTextToolbar(selectedLayer); // <<< ADD THIS LINE
			
			saveState();
		}
	}
	
	function applyTextStyles($element, styles) {
		$element.css({
			fontFamily: styles.fontFamily || 'Arial',
			fontSize: styles.fontSize || '16px',
			fontWeight: styles.fontWeight || 'normal',
			fontStyle: styles.fontStyle || 'normal',
			textDecoration: styles.textDecoration || 'none',
			color: styles.color || '#000000',
			textAlign: styles.textAlign || 'left',
			// Add other style properties here (lineHeight, letterSpacing, etc.)
		});
	}
	
	function applyStyles($element, styles) {
		// General style application (could be used for images too)
		// Example: Opacity, border, etc.
		if (styles.opacity) $element.css('opacity', styles.opacity);
		if (styles.border) $element.css('border', styles.border);
		// Add more as needed
	}
	
	// --- Upload Panel ---
	let uploadedFile = null;
	$('#imageUploadInput').on('change', function (event) {
		const file = event.target.files[0];
		if (file && file.type.startsWith('image/')) {
			uploadedFile = file;
			const reader = new FileReader();
			reader.onload = function (e) {
				$('#uploadPreview').html(`<img src="${e.target.result}" alt="Upload Preview" style="max-width: 100%; max-height: 150px;">`);
				$('#addImageFromUpload').prop('disabled', false);
			}
			reader.readAsDataURL(file);
		} else {
			uploadedFile = null;
			$('#uploadPreview').empty();
			$('#addImageFromUpload').prop('disabled', true);
			if (file) alert('Please select a valid image file.');
		}
	});
	
	$('#addImageFromUpload').on('click', function () {
		if (uploadedFile) {
			const reader = new FileReader();
			reader.onload = function (e) {
				addLayer('image', {
					content: e.target.result, // Base64 data URL
					x: 20, y: 20, // Default position
					width: 200, height: 'auto' // Default size
				});
				updateLayerList();
				saveState();
				// Optionally clear preview after adding
				// uploadedFile = null;
				// $('#uploadPreview').empty();
				// $('#imageUploadInput').val('');
				// $('#addImageFromUpload').prop('disabled', true);
			}
			reader.readAsDataURL(uploadedFile);
		}
	});
	
	// --- Zoom & Ruler ---
	
	function initializeZoomPanAndRulers() {
		rulers = new DivRulers(canvasAreaDiv, {
			tickMajor: 50,
			tickMinor: 10,
			tickMicro: 5,
			rulerSize: 25,
			indicatorColor: 'blue',
			arrowStyle: 'arrow',
			showLabel: true
		});
		
		// Initial Positioning and Zoom
		centerCanvas(); // Center canvas initially
		setZoom(currentZoom, false); // Apply initial zoom without saving state
		
		// --- Event Listeners ---
		$('#zoom-in').on('click', () => zoom(1.25));
		$('#zoom-out').on('click', () => zoom(0.8));
		
		// Panning Listeners on the canvas area
		$canvasArea.on('mousedown', function (e) {
			// Only pan if clicking directly on the canvas-area background,
			// not on the canvas, its elements, or the zoom controls
			if (e.target === $canvasArea[0]) {
				isPanning = true;
				lastPanX = e.clientX;
				lastPanY = e.clientY;
				$canvasArea.addClass('panning');
				e.preventDefault(); // Prevent text selection during drag
			}
			// Deselect layer if clicking background
			if (e.target === $canvasArea[0] || e.target === $canvasWrapper[0]) {
				selectLayer(null);
			}
		});
		
		// Use document for mousemove and mouseup to capture events
		// even if the cursor leaves the canvasArea during the drag.
		$(document).on('mousemove', function (e) {
			if (!isPanning) return;
			
			const deltaX = e.clientX - lastPanX;
			const deltaY = e.clientY - lastPanY;
			
			console.log(`Panning: ${deltaX}, ${deltaY}`);
			
			// Scroll the canvas area
			$canvasArea.scrollLeft($canvasArea.scrollLeft() - deltaX);
			$canvasArea.scrollTop($canvasArea.scrollTop() - deltaY);
			
			// Update last position for next movement calculation
			lastPanX = e.clientX;
			lastPanY = e.clientY;
			
			// Rulers should update automatically via their own scroll handler,
			// but we might need to manually trigger arrow update if desired during pan
			// $canvasArea.ruler('fixArrowsPosition', e.clientX, e.clientY); // Check if plugin exposes this
		});
		
		$(document).on('mouseup', function (e) {
			if (isPanning) {
				isPanning = false;
				$canvasArea.removeClass('panning');
			}
		});
		
		// Optional: Zoom with mouse wheel
		$canvasArea.on('wheel', function (e) {
			e.preventDefault();
			const delta = e.originalEvent.deltaY;
			const zoomFactor = delta < 0 ? 1.1 : 0.9; // Zoom in or out slightly
			
			// --- Zoom towards mouse pointer ---
			const areaRect = $canvasArea[0].getBoundingClientRect();
			// Mouse position relative to canvas-area viewport
			const mouseX = e.clientX - areaRect.left;
			const mouseY = e.clientY - areaRect.top;
			
			// Calculate mouse position relative to the scrolled content
			const mouseXInContent = $canvasArea.scrollLeft() + mouseX;
			const mouseYInContent = $canvasArea.scrollTop() + mouseY;
			
			// Calculate mouse position relative to the canvas wrapper origin
			const wrapperOffsetX = $canvasWrapper.position().left;
			const wrapperOffsetY = $canvasWrapper.position().top;
			const mouseRelativeToWrapperX = mouseXInContent - wrapperOffsetX;
			const mouseRelativeToWrapperY = mouseYInContent - wrapperOffsetY;
			
			// Calculate mouse position relative to the unscaled canvas origin
			const mouseOnCanvasX = mouseRelativeToWrapperX / currentZoom;
			const mouseOnCanvasY = mouseRelativeToWrapperY / currentZoom;
			
			// Apply the zoom
			const newZoom = currentZoom * zoomFactor;
			setZoom(newZoom); // This updates currentZoom
			
			// Calculate the new wrapper position needed to keep the mouse point stationary
			const newMouseRelativeToWrapperX = mouseOnCanvasX * currentZoom;
			const newMouseRelativeToWrapperY = mouseOnCanvasY * currentZoom;
			
			// Calculate the new scroll position
			const newScrollLeft = (wrapperOffsetX + newMouseRelativeToWrapperX) - mouseX;
			const newScrollTop = (wrapperOffsetY + newMouseRelativeToWrapperY) - mouseY;
			
			$canvasArea.scrollLeft(newScrollLeft);
			$canvasArea.scrollTop(newScrollTop);
			// --- End Zoom towards mouse pointer ---
			
			// Simpler zoom to center:
			// const newZoom = currentZoom * (delta < 0 ? 1.1 : 0.9);
			// setZoom(newZoom);
		});
	}
	
	function zoom(factor) {
		setZoom(currentZoom * factor);
	}
	
	function setZoom(newZoom, save = true) { // `save` parameter is unused currently
		const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
		if (clampedZoom === currentZoom) return; // No change
		
		const oldZoom = currentZoom;
		currentZoom = clampedZoom;
		
		// Apply scale transform to the canvas wrapper for layout scaling
		// $canvasWrapper.css('transform', `scale(${currentZoom})`);
		// Apply scale transform to the canvas itself (simpler for element coords)
		$canvas.css('transform', `scale(${currentZoom})`);
		
		// Update percentage display
		$('#zoom-percentage').text(`${Math.round(currentZoom * 100)}%`);
		
		// Update options if needed
		
		// Update button states
		$('#zoom-in').prop('disabled', currentZoom >= MAX_ZOOM);
		$('#zoom-out').prop('disabled', currentZoom <= MIN_ZOOM);
		
		// Note: Zoom state is NOT saved in history
		// if (save) { saveState(); }
	}
	
	function centerCanvas() {
		
		const areaWidth = $canvasArea.width();
		const areaHeight = $canvasArea.height();
		const wrapperWidth = $canvasWrapper.outerWidth(); // Use outerWidth if it has padding/border
		const wrapperHeight = $canvasWrapper.outerHeight();
		
		const scrollLeft = (wrapperWidth - areaWidth) / 2;
		const scrollTop = (wrapperHeight - areaHeight) / 2;
		
		$canvasArea.scrollLeft(scrollLeft > 0 ? scrollLeft : 0);
		$canvasArea.scrollTop(scrollTop > 0 ? scrollTop : 0);
		
	}
	
	// --- Global Actions (Top Toolbar) ---
	
	function initializeGlobalActions() {
		$('#deleteBtn').on('click', function () {
			if (selectedLayer && !selectedLayer.locked) {
				if (confirm(`Are you sure you want to delete the selected layer?`)) {
					deleteLayer(selectedLayer.id);
				}
			}
		});
		
		$('#lockBtn').on('click', function () {
			if (selectedLayer) {
				toggleLockLayer(selectedLayer.id);
			}
		});
		
		$('#undoBtn').on('click', undo);
		$('#redoBtn').on('click', redo);
		
		$('#bringToFrontBtn').on('click', bringSelectedLayerToFront);
		$('#sendToBackBtn').on('click', sendSelectedLayerToBack);
		
		$('#saveDesign').on('click', saveDesign);
		$('#loadDesign').on('click', () => $('#loadDesignInput').click());
		$('#loadDesignInput').on('change', loadDesign);
		
		// Export Buttons (using html2canvas)
		$('#exportPng').on('click', () => exportCanvas('png'));
		$('#exportJpg').on('click', () => exportCanvas('jpeg'));
		$('#downloadBtn').on('click', () => exportCanvas('png')); // Make default download PNG
		
		updateActionButtons(); // Initial state
	}
	
	function updateActionButtons() {
		const canInteract = selectedLayer; // Can interact if any layer is selected
		const canModify = selectedLayer && !selectedLayer.locked; // Can modify if selected and not locked
		
		$('#deleteBtn').prop('disabled', !canModify);
		$('#lockBtn').prop('disabled', !canInteract);
		
		// <<< Enable/Disable Bring/Send Buttons >>>
		// Disable if nothing selected, or locked, or already at the very front/back
		const isAtFront = selectedLayer && layers.findIndex(l => l.id === selectedLayer.id) === layers.length - 1;
		const isAtBack = selectedLayer && layers.findIndex(l => l.id === selectedLayer.id) === 0;
		$('#bringToFrontBtn').prop('disabled', !canModify || isAtFront);
		$('#sendToBackBtn').prop('disabled', !canModify || isAtBack);
		
		
		// Update lock icon based on selected layer's state
		if (selectedLayer) {
			const lockIconClass = selectedLayer.locked ? 'fa-lock' : 'fa-lock-open';
			$('#lockBtn i').removeClass('fa-lock fa-lock-open').addClass(lockIconClass);
		} else {
			$('#lockBtn i').removeClass('fa-lock fa-lock-open').addClass('fa-lock'); // Default icon
		}
		
		// Undo/Redo buttons
		$('#undoBtn').prop('disabled', historyIndex <= 0);
		$('#redoBtn').prop('disabled', historyIndex >= history.length - 1);
	}
	
	// --- History (Undo/Redo) ---
	
	function saveState() {
		// Clear redo history if we make a new change after undoing
		if (historyIndex < history.length - 1) {
			history = history.slice(0, historyIndex + 1);
		}
		
		// Deep clone the current layers state
		const currentState = JSON.parse(JSON.stringify(layers));
		history.push(currentState);
		historyIndex++;
		
		// Limit history size (optional)
		const maxHistory = 50;
		if (history.length > maxHistory) {
			history.shift(); // Remove the oldest state
			historyIndex--; // Adjust index accordingly
		}
		// console.log("State Saved. Index:", historyIndex, "History Length:", history.length);
		updateActionButtons();
	}
	
	function restoreState(stateIndex) {
		if (stateIndex < 0 || stateIndex >= history.length) {
			console.error("Invalid history index:", stateIndex);
			return;
		}
		
		historyIndex = stateIndex;
		const stateToRestore = JSON.parse(JSON.stringify(history[historyIndex])); // Deep clone
		
		// Clear canvas and internal data
		$canvas.empty();
		layers = [];
		selectedLayer = null; // Deselect everything
		
		// Restore layers from the saved state
		layers = stateToRestore;
		layers.forEach(layerData => {
			renderLayer(layerData); // Re-render each layer
		});
		
		updateLayerList();
		selectLayer(null); // Ensure nothing is selected initially after restore
		updateActionButtons();
		// console.log("State Restored. Index:", historyIndex);
	}
	
	function undo() {
		if (historyIndex > 0) {
			restoreState(historyIndex - 1);
		}
	}
	
	function redo() {
		if (historyIndex < history.length - 1) {
			restoreState(historyIndex + 1);
		}
	}
	
	// --- Save / Load Design ---
	
	function saveDesign() {
		const designData = {
			version: "1.0",
			layers: layers,
			// Optionally save canvas dimensions or other settings
			canvas: {
				width: $canvas.width(),
				height: $canvas.height()
			}
			// Could also save history here if needed, but usually not restored
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
		URL.revokeObjectURL(url);
	}
	
	function loadDesign(event) {
		const file = event.target.files[0];
		if (!file) return;
		
		const reader = new FileReader();
		reader.onload = function (e) {
			try {
				const designData = JSON.parse(e.target.result);
				if (designData && designData.layers) {
					// Clear current state
					$canvas.empty();
					layers = [];
					selectedLayer = null;
					history = []; // Reset history
					historyIndex = -1;
					uniqueIdCounter = 0; // Reset ID counter or find max existing ID
					
					// Load layers
					layers = designData.layers;
					
					// Find max ID to avoid collisions if user adds more layers
					if (layers.length > 0) {
						const maxId = Math.max(...layers.map(l => parseInt(l.id.split('-')[1] || 0)));
						uniqueIdCounter = maxId + 1;
					}
					
					
					// Optional: Adjust canvas size if saved
					if (designData.canvas) {
						// $canvas.css({ width: designData.canvas.width + 'px', height: designData.canvas.height + 'px' });
						// Note: Resizing canvas might require recalculating element positions if they were relative.
						// For simplicity, we assume fixed canvas size for now.
					}
					
					// Re-render all layers
					layers.forEach(layerData => {
						renderLayer(layerData);
					});
					
					updateLayerList();
					selectLayer(null);
					saveState(); // Save the loaded state as the initial history point
					alert('Design loaded successfully!');
				} else {
					alert('Invalid design file format.');
				}
			} catch (error) {
				console.error("Error loading design:", error);
				alert('Error reading or parsing the design file.');
			} finally {
				// Reset file input to allow loading the same file again
				$(event.target).val('');
			}
		};
		reader.onerror = function () {
			alert('Error reading file.');
			$(event.target).val('');
		};
		reader.readAsText(file);
	}
	
	// --- Export Canvas ---
	
	function exportCanvas(format = 'png') {
		selectLayer(null); // Deselect elements before export
		
		// --- Adjustments for Export ---
		// 1. Store original state
		const originalTransform = $canvas.css('transform');
		const originalScrollLeft = $canvasArea.scrollLeft();
		const originalScrollTop = $canvasArea.scrollTop();
		
		// 2. Temporarily reset zoom and scroll for accurate capture
		$canvas.css('transform', 'scale(1.0)'); // Set to 100%
		// Scroll canvas-area so the top-left of the canvas is visible
		// This assumes canvas-wrapper is positioned at the origin of canvas-area scroll content
		const wrapperPos = $canvasWrapper.position(); // pos relative to canvas-area
		$canvasArea.scrollLeft(wrapperPos.left);
		$canvasArea.scrollTop(wrapperPos.top);
		
		
		// 3. Temporarily make all layers visible for export
		const hiddenLayerIds = layers.filter(l => !l.visible).map(l => l.id);
		hiddenLayerIds.forEach(id => $(`#${id}`).show());
		
		const canvasElement = document.getElementById('canvas');
		const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
		const quality = format === 'jpeg' ? 0.9 : 1.0; // JPEG quality
		const filename = `book-cover.${format}`;
		
		// Use a timeout to allow the browser to repaint after style changes
		setTimeout(() => {
			html2canvas(canvasElement, {
				useCORS: true,
				allowTaint: true,
				logging: false,
				scale: 1, // Use native resolution
				x: 0, // Capture from top-left of the element
				y: 0,
				width: $canvas.width(), // Explicitly set capture dimensions
				height: $canvas.height(),
				scrollX: 0, // Ensure html2canvas doesn't try to scroll
				scrollY: 0,
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
						// Ensure wrapper is positioned correctly if needed
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
				// --- Restore original state ---
				hiddenLayerIds.forEach(id => $(`#${id}`).hide());
				$canvas.css('transform', originalTransform); // Restore original zoom
				$canvasArea.scrollLeft(originalScrollLeft); // Restore scroll position
				$canvasArea.scrollTop(originalScrollTop);
			});
		}, 100); // Small delay for rendering changes
	}
	
}); // End document ready
