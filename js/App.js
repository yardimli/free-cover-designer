$(document).ready(function () {
	// --- DOM References ---
	const $canvas = $('#canvas');
	const $layerList = $('#layerList');
	const $canvasArea = $('#canvas-area');
	const $canvasWrapper = $('#canvas-wrapper');
	const $loadDesignInput = $('#loadDesignInput');
	
	// --- Instantiate Managers ---
	const layerManager = new LayerManager($canvas, $layerList, {
		onLayerSelect: handleLayerSelectionChange, // Pass callback for UI updates
		saveState: () => historyManager.saveState() // Pass callback to trigger save
	});
	
	const historyManager = new HistoryManager(layerManager, {
		onUpdate: updateActionButtons // Pass callback to update buttons on history change
	});
	
	const canvasManager = new CanvasManager($canvasArea, $canvasWrapper, $canvas, {
		layerManager: layerManager,
		historyManager: historyManager,
		onZoomChange: handleZoomChange // Pass callback for UI updates
	});
	
	const textToolbar = new TextToolbar({
		getSelectedLayer: () => layerManager.getSelectedLayer(),
		// Pass LayerManager's method directly
		updateLayerStyle: (id, prop, val) => layerManager.updateLayerStyle(id, prop, val),
		saveState: () => historyManager.saveState()
	});
	
	const sidebarManager = new SidebarItemManager({
		templateListSelector: '#templateList', // Updated selector
		coverListSelector: '#coverList',
		coverSearchSelector: '#coverSearch',
		elementListSelector: '#elementList',
		uploadPreviewSelector: '#uploadPreview',
		uploadInputSelector: '#imageUploadInput',
		addImageBtnSelector: '#addImageFromUpload',
		// layoutsUrl: 'data/layouts.json', // Removed layoutsUrl
		coversUrl: 'data/covers.json',
		elementsUrl: 'data/elements.json',
		// New callback for applying templates via CanvasManager
		applyTemplate: (jsonPath) => canvasManager.loadDesign(jsonPath, true),
		// Pass LayerManager's addLayer for uploads/elements
		addLayer: (type, props) => layerManager.addLayer(type, props),
		saveState: () => historyManager.saveState()
	});
	
	// --- Initialization ---
	sidebarManager.loadAll(); // Loads templates, covers, elements
	layerManager.initializeList(); // Init sortable layer list
	canvasManager.initialize(); // Init zoom, pan, rulers, droppable
	// textToolbar is initialized in its constructor
	
	// --- Global Action Listeners (Top Toolbar) ---
	initializeGlobalActions();
	
	// --- Initial State ---
	historyManager.saveState(); // Save the initial empty state
	updateActionButtons(); // Set initial button states
	
	// --- UI Update Callbacks ---
	function handleLayerSelectionChange(selectedLayer) {
		// Update Text Toolbar visibility and content
		textToolbar.populate(selectedLayer);
		// Update Global Action Buttons based on selection and lock state
		updateActionButtons();
	}
	
	function handleZoomChange(currentZoom, minZoom, maxZoom) {
		// Update zoom percentage display
		$('#zoom-percentage').text(`${Math.round(currentZoom * 100)}%`);
		// Enable/disable zoom buttons at limits
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
