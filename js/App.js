$(document).ready(function () {
	// --- DOM References ---
	const $canvas = $('#canvas');
	const $layerList = $('#layerList');
	const $canvasArea = $('#canvas-area');
	const $canvasWrapper = $('#canvas-wrapper');
	const $loadDesignInput = $('#loadDesignInput');
	const $inspectorPanel = $('#inspectorPanel');
	
	// --- Instantiate Managers ---
	const canvasManager = new CanvasManager($canvasArea, $canvasWrapper, $canvas, {
		onZoomChange: handleZoomChange
	});
	
	let googleFonts = [];

	// LayerManager needs CanvasManager
	const layerManager = new LayerManager($canvas, $layerList, {
		onLayerSelect: handleLayerSelectionChange,
		onLayerDataUpdate: handleLayerDataUpdate, // Pass the new handler
		saveState: () => historyManager.saveState(),
		canvasManager: canvasManager
	});
	
	// HistoryManager needs LayerManager
	const historyManager = new HistoryManager(layerManager, {
		onUpdate: updateActionButtons // Callback defined below
	});
	
	// InspectorPanel needs LayerManager, HistoryManager, and potentially CanvasManager + Fonts
	const inspectorPanel = new InspectorPanel({
		layerManager: layerManager,
		historyManager: historyManager,
		canvasManager: canvasManager, // Pass canvasManager if needed (e.g., alignment)
		googleFontsList: googleFonts // Pass fonts for picker
	});
	
	// Sidebar Manager needs LayerManager, HistoryManager, CanvasManager (for applyTemplate)
	const sidebarManager = new SidebarItemManager({
		templateListSelector: '#templateList',
		coverListSelector: '#coverList',
		coverSearchSelector: '#coverSearch',
		elementListSelector: '#elementList',
		uploadPreviewSelector: '#uploadPreview',
		uploadInputSelector: '#imageUploadInput',
		addImageBtnSelector: '#addImageFromUpload',
		elementsUrl: 'data/elements.json',
		applyTemplate: (jsonPath) => {
			// Delete existing text layers BEFORE loading the template design
			console.log("Applying template via click, removing existing text layers...");
			const existingLayers = layerManager.getLayers(); // Use the layerManager instance
			const textLayerIdsToDelete = existingLayers
				.filter(layer => layer.type === 'text')
				.map(layer => layer.id);
			
			if (textLayerIdsToDelete.length > 0) {
				textLayerIdsToDelete.forEach(id => layerManager.deleteLayer(id, false)); // Delete without saving history yet
				console.log(`Removed ${textLayerIdsToDelete.length} text layers.`);
			} else {
				console.log("No existing text layers found to remove.");
			}
			// Now call loadDesign, which will add template layers and save history
			canvasManager.loadDesign(jsonPath, true);
		},
		addLayer: (type, props) => layerManager.addLayer(type, props),
		saveState: () => historyManager.saveState(), // Pass saveState function
		layerManager: layerManager,                   // Pass LayerManager instance
		canvasManager: canvasManager                  // Pass CanvasManager instance
	});
	
	// Set cross-dependencies (already done for LM/CM)
	canvasManager.layerManager = layerManager;
	canvasManager.historyManager = historyManager;
	
	// --- Initialization ---
	sidebarManager.loadAll();
	layerManager.initializeList();
	canvasManager.initialize(); // Init zoom, pan, rulers, droppable
	
	// --- Global Action Listeners (Top Toolbar) ---
	initializeGlobalActions(); // Setup Undo, Redo, Save, Load etc.
	
	// --- Initial State ---
	historyManager.saveState();
	updateActionButtons();
	
	
	// --- UI Update Callbacks ---
	function handleLayerSelectionChange(selectedLayer) {
		if (selectedLayer) {
			inspectorPanel.show(selectedLayer); // Show uses the passed data
		} else {
			inspectorPanel.hide();
		}
		updateActionButtons();
	}
	
	function handleLayerDataUpdate(updatedLayer) {
		// Check if the updated layer is the one currently shown in the inspector
		if (inspectorPanel.currentLayer && inspectorPanel.currentLayer.id === updatedLayer.id) {
			// console.log('Refreshing inspector for updated layer:', updatedLayer.id);
			inspectorPanel.populate(updatedLayer);
		}
		// Optionally update other UI elements if needed based on layer data changes
		// updateActionButtons(); // Might be needed if update changes lock state etc.
	}
	
	function handleZoomChange(currentZoom, minZoom, maxZoom) {
		$('#zoom-percentage-toggle').text(`${Math.round(currentZoom * 100)}%`);
		$('#zoom-in').prop('disabled', currentZoom >= maxZoom);
		$('#zoom-out').prop('disabled', currentZoom <= minZoom);
	}
	
	// --- Global Action Button Setup & Updates ---
	function initializeGlobalActions() {
		// Layer Actions
		$('#deleteBtn').on('click', () => layerManager.deleteSelectedLayer());
		$('#lockBtn').on('click', () => layerManager.toggleSelectedLayerLock());
		
		// History Actions
		$('#undoBtn').on('click', () => historyManager.undo());
		$('#redoBtn').on('click', () => historyManager.redo());
		
		// Layer Order Actions
		$('#bringToFrontBtn').on('click', () => layerManager.moveSelectedLayer('front'));
		$('#sendToBackBtn').on('click', () => layerManager.moveSelectedLayer('back'));
		
		// File Menu Actions
		$('#saveDesign').on('click', () => canvasManager.saveDesign());
		$('#loadDesign').on('click', () => $loadDesignInput.click());
		$loadDesignInput.on('change', (event) => {
			const file = event.target.files[0];
			if (file) {
				canvasManager.loadDesign(file, false); // Load from file, not template
			}
			$(event.target).val(''); // Reset input
		});
		
		// Export Actions
		$('#exportPng').on('click', () => canvasManager.exportCanvas('png'));
		$('#exportJpg').on('click', () => canvasManager.exportCanvas('jpeg'));
		
		// Main Download Button
		$('#downloadBtn').on('click', () => canvasManager.exportCanvas('png')); // Default to PNG
	}
	
	function updateActionButtons() {
		const selectedLayer = layerManager.getSelectedLayer();
		const layers = layerManager.getLayers();
		const hasSelection = !!selectedLayer;
		const isLocked = hasSelection && selectedLayer.locked;
		
		// Enable/Disable based on selection & lock state
		$('#deleteBtn').prop('disabled', !hasSelection || isLocked);
		$('#lockBtn').prop('disabled', !hasSelection);
		
		// Update Lock Button Icon
		if (selectedLayer) {
			const lockIconClass = selectedLayer.locked ? 'fa-lock' : 'fa-lock-open';
			$('#lockBtn i').removeClass('fa-lock fa-lock-open').addClass(lockIconClass);
			$('#lockBtn').attr('title', selectedLayer.locked ? 'Unlock Selected' : 'Lock Selected');
		} else {
			$('#lockBtn i').removeClass('fa-lock fa-lock-open').addClass('fa-lock');
			$('#lockBtn').attr('title', 'Lock/Unlock Selected');
		}
		
		// Layer Order Buttons
		let isAtFront = false;
		let isAtBack = false;
		if (hasSelection && layers.length > 1) {
			const sortedLayers = [...layers].sort((a,b) => (a.zIndex || 0) - (b.zIndex || 0));
			const selectedIndex = sortedLayers.findIndex(l => l.id === selectedLayer.id);
			isAtBack = selectedIndex === 0;
			isAtFront = selectedIndex === sortedLayers.length - 1;
		} else if (layers.length <= 1) {
			isAtFront = true; // Consider single layer as both front/back
			isAtBack = true;
		}
		
		$('#bringToFrontBtn').prop('disabled', !hasSelection || isLocked || isAtFront);
		$('#sendToBackBtn').prop('disabled', !hasSelection || isLocked || isAtBack);
		
		// Undo/Redo Buttons
		$('#undoBtn').prop('disabled', !historyManager.canUndo());
		$('#redoBtn').prop('disabled', !historyManager.canRedo());
		
		// Download/Export Buttons (disable if canvas empty)
		$('#downloadBtn, #exportPng, #exportJpg').prop('disabled', layers.length === 0);
		$('#saveDesign').prop('disabled', layers.length === 0); // Also disable save if empty
	}
	
});
