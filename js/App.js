$(document).ready(function () {
	// --- DOM References ---
	const $canvas = $('#canvas');
	const $layerList = $('#layerList');
	const $canvasArea = $('#canvas-area');
	const $canvasWrapper = $('#canvas-wrapper');
	const $loadDesignInput = $('#loadDesignInput');
	
	// --- Instantiate Managers ---
	
	// Instantiate CanvasManager FIRST as LayerManager needs it
	const canvasManager = new CanvasManager($canvasArea, $canvasWrapper, $canvas, {
		// layerManager will be set later if needed, or passed differently
		// historyManager will be set later if needed
		onZoomChange: handleZoomChange // Pass callback for UI updates
	});
	
	const layerManager = new LayerManager($canvas, $layerList, {
		onLayerSelect: handleLayerSelectionChange,
		saveState: () => historyManager.saveState(),
		canvasManager: canvasManager // <-- Inject CanvasManager
	});
	
	const historyManager = new HistoryManager(layerManager, {
		onUpdate: updateActionButtons
	});
	
	// Now set dependencies for CanvasManager if they weren't passed initially
	// (Alternatively, pass them all in the constructor if order allows)
	canvasManager.layerManager = layerManager;
	canvasManager.historyManager = historyManager;
	
	
	const textToolbar = new TextToolbar({
		getSelectedLayer: () => layerManager.getSelectedLayer(),
		updateLayerStyle: (id, prop, val) => layerManager.updateLayerStyle(id, prop, val),
		saveState: () => historyManager.saveState()
	});
	
	const sidebarManager = new SidebarItemManager({
		templateListSelector: '#templateList',
		coverListSelector: '#coverList',
		coverSearchSelector: '#coverSearch',
		elementListSelector: '#elementList',
		uploadPreviewSelector: '#uploadPreview',
		uploadInputSelector: '#imageUploadInput',
		addImageBtnSelector: '#addImageFromUpload',
		coversUrl: 'data/covers.json',
		elementsUrl: 'data/elements.json',
		applyTemplate: (jsonPath) => canvasManager.loadDesign(jsonPath, true),
		addLayer: (type, props) => layerManager.addLayer(type, props),
		saveState: () => historyManager.saveState()
	});
	
	// --- Initialization ---
	sidebarManager.loadAll();
	layerManager.initializeList();
	canvasManager.initialize(); // Init zoom, pan, rulers, droppable
	
	// --- Global Action Listeners (Top Toolbar) ---
	initializeGlobalActions();
	
	// --- Initial State ---
	historyManager.saveState();
	updateActionButtons();
	
	// --- UI Update Callbacks ---
	function handleLayerSelectionChange(selectedLayer) {
		textToolbar.populate(selectedLayer);
		updateActionButtons();
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
		$('#loadDesign').on('click', () => $loadDesignInput.click()); // Trigger hidden file input
		$loadDesignInput.on('change', (event) => {
			const file = event.target.files[0];
			if (file) {
				canvasManager.loadDesign(file, false); // Load from file, not a template
			}
			// Reset file input to allow loading the same file again if needed
			$(event.target).val('');
		});
		
		// Export Actions
		$('#exportPng').on('click', () => canvasManager.exportCanvas('png'));
		$('#exportJpg').on('click', () => canvasManager.exportCanvas('jpeg'));
		// Main Download Button (defaults to PNG)
		$('#downloadBtn').on('click', () => canvasManager.exportCanvas('png'));
	}
	
	function updateActionButtons() {
		const selectedLayer = layerManager.getSelectedLayer();
		const layers = layerManager.getLayers(); // Get current layers array (deep copy)
		
		// --- Enable/Disable based on selection ---
		const hasSelection = !!selectedLayer;
		const isLocked = hasSelection && selectedLayer.locked;
		
		// Delete and Lock buttons require selection
		$('#deleteBtn').prop('disabled', !hasSelection || isLocked); // Cannot delete locked layer
		$('#lockBtn').prop('disabled', !hasSelection);
		
		// --- Update Lock Button Icon ---
		if (selectedLayer) {
			const lockIconClass = selectedLayer.locked ? 'fa-lock' : 'fa-lock-open';
			$('#lockBtn i').removeClass('fa-lock fa-lock-open').addClass(lockIconClass);
			$('#lockBtn').attr('title', selectedLayer.locked ? 'Unlock Selected' : 'Lock Selected');
		} else {
			$('#lockBtn i').removeClass('fa-lock fa-lock-open').addClass('fa-lock'); // Default icon
			$('#lockBtn').attr('title', 'Lock/Unlock Selected');
		}
		
		// --- Layer Order Buttons ---
		let isAtFront = false;
		let isAtBack = false;
		if (hasSelection && layers.length > 0) {
			// Find the actual index based on current zIndex values (more robust)
			const sortedLayers = [...layers].sort((a,b) => (a.zIndex || 0) - (b.zIndex || 0));
			const selectedIndex = sortedLayers.findIndex(l => l.id === selectedLayer.id);
			isAtBack = selectedIndex === 0;
			isAtFront = selectedIndex === sortedLayers.length - 1;
		}
		$('#bringToFrontBtn').prop('disabled', !hasSelection || isLocked || isAtFront || layers.length < 2);
		$('#sendToBackBtn').prop('disabled', !hasSelection || isLocked || isAtBack || layers.length < 2);
		
		
		// --- Undo/Redo Buttons ---
		$('#undoBtn').prop('disabled', !historyManager.canUndo());
		$('#redoBtn').prop('disabled', !historyManager.canRedo());
		
		// --- Download/Export Buttons (always enabled for now) ---
		$('#downloadBtn').prop('disabled', layers.length === 0); // Disable if canvas is empty
		// Could disable file menu items too if needed
	}
	
}); // End document ready
