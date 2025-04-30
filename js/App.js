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
		updateLayerStyle: (id, prop, val) => layerManager.updateLayerStyle(id, prop, val),
		saveState: () => historyManager.saveState()
	});
	
	const sidebarManager = new SidebarItemManager({
		layoutListSelector: '#layoutList',
		coverListSelector: '#coverList',
		coverSearchSelector: '#coverSearch',
		elementListSelector: '#elementList',
		uploadPreviewSelector: '#uploadPreview',
		uploadInputSelector: '#imageUploadInput',
		addImageBtnSelector: '#addImageFromUpload',
		layoutsUrl: 'data/layouts.json',
		coversUrl: 'data/covers.json',
		elementsUrl: 'data/elements.json',
		addLayer: (type, props) => layerManager.addLayer(type, props), // Pass LayerManager's addLayer
		saveState: () => historyManager.saveState()
	});
	
	// --- Initialization ---
	sidebarManager.loadAll();
	layerManager.initializeList(); // Init sortable list
	canvasManager.initialize(); // Init zoom, pan, rulers, droppable
	// textToolbar is initialized in its constructor
	
	// --- Global Action Listeners (Top Toolbar) ---
	initializeGlobalActions();
	
	// --- Initial State ---
	historyManager.saveState(); // Save the initial empty state
	updateActionButtons(); // Set initial button states
	
	// --- UI Update Callbacks ---
	function handleLayerSelectionChange(selectedLayer) {
		// Update Text Toolbar
		textToolbar.populate(selectedLayer);
		// Update Global Action Buttons
		updateActionButtons();
	}
	
	function handleZoomChange(currentZoom, minZoom, maxZoom) {
		$('#zoom-percentage').text(`${Math.round(currentZoom * 100)}%`);
		$('#zoom-in').prop('disabled', currentZoom >= maxZoom);
		$('#zoom-out').prop('disabled', currentZoom <= minZoom);
	}
	
	// --- Global Action Button Setup & Updates ---
	function initializeGlobalActions() {
		$('#deleteBtn').on('click', () => layerManager.deleteSelectedLayer());
		$('#lockBtn').on('click', () => layerManager.toggleSelectedLayerLock());
		$('#undoBtn').on('click', () => historyManager.undo());
		$('#redoBtn').on('click', () => historyManager.redo());
		$('#bringToFrontBtn').on('click', () => layerManager.moveSelectedLayer('front'));
		$('#sendToBackBtn').on('click', () => layerManager.moveSelectedLayer('back'));
		
		// File Menu
		$('#saveDesign').on('click', () => canvasManager.saveDesign());
		$('#loadDesign').on('click', () => $loadDesignInput.click());
		$loadDesignInput.on('change', (event) => {
			canvasManager.loadDesign(event.target.files[0]);
			// Reset file input to allow loading the same file again
			$(event.target).val('');
		});
		
		// Export Buttons
		$('#exportPng').on('click', () => canvasManager.exportCanvas('png'));
		$('#exportJpg').on('click', () => canvasManager.exportCanvas('jpeg'));
		$('#downloadBtn').on('click', () => canvasManager.exportCanvas('png')); // Default download PNG
	}
	
	function updateActionButtons() {
		const selectedLayer = layerManager.getSelectedLayer();
		const layers = layerManager.getLayers(); // Get current layers array
		
		const canInteract = !!selectedLayer;
		const canModify = canInteract && !selectedLayer.locked;
		
		$('#deleteBtn').prop('disabled', !canModify);
		$('#lockBtn').prop('disabled', !canInteract);
		
		// Layer Order Buttons
		const isAtFront = canInteract && layers.findIndex(l => l.id === selectedLayer.id) === layers.length - 1;
		const isAtBack = canInteract && layers.findIndex(l => l.id === selectedLayer.id) === 0;
		$('#bringToFrontBtn').prop('disabled', !canModify || isAtFront);
		$('#sendToBackBtn').prop('disabled', !canModify || isAtBack);
		
		// Update lock icon
		if (selectedLayer) {
			const lockIconClass = selectedLayer.locked ? 'fa-lock' : 'fa-lock-open';
			$('#lockBtn i').removeClass('fa-lock fa-lock-open').addClass(lockIconClass);
		} else {
			$('#lockBtn i').removeClass('fa-lock fa-lock-open').addClass('fa-lock'); // Default
		}
		
		// Undo/Redo buttons
		$('#undoBtn').prop('disabled', !historyManager.canUndo());
		$('#redoBtn').prop('disabled', !historyManager.canRedo());
	}
	
}); // End document readys
