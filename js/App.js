$(document).ready(function () {
	// --- DOM References ---
	const $canvas = $('#canvas');
	const $layerList = $('#layerList');
	const $canvasArea = $('#canvas-area');
	const $canvasWrapper = $('#canvas-wrapper');
	const $loadDesignInput = $('#loadDesignInput');
	const $loadingOverlay = $('#export-overlay'); // Re-use the export overlay
	const $loadingOverlayMessage = $('#loading-overlay-message');
	const $inspectorPanelElement = $('#inspectorPanel');
	
	// Sidebar Panel References
	const $sidebarPanelsContainer = $('#sidebar-panels-container');
	const $sidebarPanels = $('.sidebar-panel');
	const $sidebarNavLinks = $('.sidebar-nav .nav-link[data-panel-target]');
	
	// --- Instantiate Managers ---
	const canvasManager = new CanvasManager($canvasArea, $canvasWrapper, $canvas, {
		onZoomChange: handleZoomChange,
		showLoadingOverlay: showGlobalLoadingOverlay,
		hideLoadingOverlay: hideGlobalLoadingOverlay
	});
	
	const canvasSizeModal = new CanvasSizeModal(canvasManager);
	
	let googleFonts = []; // Placeholder if needed elsewhere
	
	// LayerManager needs CanvasManager
	const layerManager = new LayerManager($canvas, $layerList, {
		onLayerSelect: handleLayerSelectionChange, // Connect the callback
		onLayerDataUpdate: handleLayerDataUpdate,
		saveState: () => historyManager.saveState(),
		canvasManager: canvasManager
	});
	
	const historyManager = new HistoryManager(layerManager, {
		onUpdate: updateActionButtons
	});
	
	// Instantiate InspectorPanel AFTER LayerManager and HistoryManager
	const inspectorPanel = new InspectorPanel({
		layerManager: layerManager,
		historyManager: historyManager,
		canvasManager: canvasManager,
		googleFontsList: googleFonts
	});
	
	// Sidebar Manager
	const sidebarManager = new SidebarItemManager({
		templateListSelector: '#templateList',
		coverListSelector: '#coverList',
		coverSearchSelector: '#coverSearch',
		elementListSelector: '#elementList',
		uploadPreviewSelector: '#uploadPreview',
		uploadInputSelector: '#imageUploadInput',
		addImageBtnSelector: '#addImageFromUpload',
		overlaysListSelector: '#overlayList', // Corrected selector name
		overlaysSearchSelector: '#overlaySearch', // Corrected selector name
		sidebarPanelsContainerSelector: '#sidebar-panels-container',
		applyTemplate: (jsonData) => {
			console.log("Applying template via click, removing existing text layers...");
			const existingLayers = layerManager.getLayers();
			const textLayerIdsToDelete = existingLayers
				.filter(layer => layer.type === 'text')
				.map(layer => layer.id);
			
			if (textLayerIdsToDelete.length > 0) {
				textLayerIdsToDelete.forEach(id => layerManager.deleteLayer(id, false));
				console.log(`Removed ${textLayerIdsToDelete.length} text layers.`);
			} else {
				console.log("No existing text layers found to remove.");
			}
			canvasManager.loadDesign(jsonData, true); // Load as template
		},
		addLayer: (type, props) => layerManager.addLayer(type, props),
		saveState: () => historyManager.saveState(),
		layerManager: layerManager,
		canvasManager: canvasManager,
		showLoadingOverlay: showGlobalLoadingOverlay,
		hideLoadingOverlay: hideGlobalLoadingOverlay
	});
	
	// Set cross-dependencies
	canvasManager.layerManager = layerManager;
	canvasManager.historyManager = historyManager;
	
	// --- Initialization ---
	sidebarManager.loadAll();
	layerManager.initializeList();
	canvasManager.initialize();
	initializeGlobalActions();
	initializeSidebarPanelControls();
	
	// --- Initial State ---
	historyManager.saveState();
	updateActionButtons();
	hideGlobalLoadingOverlay();
	inspectorPanel.hide();
	
	try {
		const kindlePresetValue = "1600x2560"; // Match the value in PHP/HTML
		// Show the modal, passing the default value
		canvasSizeModal.show({defaultPresetValue: kindlePresetValue});
	} catch (error) {
		console.error("Error showing initial canvas size modal:", error);
	}
	
	// --- UI Update Callbacks ---
	
	function handleLayerSelectionChange(selectedLayer) {
		if (selectedLayer) {
			inspectorPanel.show(selectedLayer);
		} else {
			if ($inspectorPanelElement.hasClass('open')) {
				inspectorPanel.populate(null);
			}
		}
		updateActionButtons();
	}
	
	function handleLayerDataUpdate(updatedLayer) {
		if (inspectorPanel.currentLayer && inspectorPanel.currentLayer.id === updatedLayer.id && $inspectorPanelElement.hasClass('open')) {
			inspectorPanel.populate(updatedLayer);
		}
		updateActionButtons();
	}
	
	function handleZoomChange(currentZoom, minZoom, maxZoom) {
		$('#zoom-percentage-toggle').text(`${Math.round(currentZoom * 100)}%`);
		$('#zoom-in').prop('disabled', currentZoom >= maxZoom);
		$('#zoom-out').prop('disabled', currentZoom <= minZoom);
	}
	
	// --- Sidebar Panel Sliding Logic (Left Side) ---
	function initializeSidebarPanelControls() {
		$sidebarNavLinks.on('click', function (e) {
			e.preventDefault();
			const $link = $(this);
			const targetPanelId = $link.data('panel-target');
			const $targetPanel = $(targetPanelId);
			
			if (!$targetPanel.length) {
				console.warn("Target panel not found:", targetPanelId);
				return;
			}
			
			// If clicking the already active icon, close the panel
			if ($link.hasClass('active') && $sidebarPanelsContainer.hasClass('open')) {
				closeSidebarPanel();
			} else {
				openSidebarPanel(targetPanelId);
			}
		});
		
		$canvasArea.on('mousedown', function(e) {
			closeSidebarPanel();
		});
	}
	
	function openSidebarPanel(panelId) {
		const $targetPanel = $(panelId);
		if (!$targetPanel.length) return;
		
		// Deactivate other panels and links
		$sidebarNavLinks.removeClass('active');
		$sidebarPanels.removeClass('active').hide(); // Hide inactive panels
		
		// Activate target panel and link
		$targetPanel.addClass('active').show(); // Show the target panel
		$sidebarNavLinks.filter(`[data-panel-target="${panelId}"]`).addClass('active');
		
		// Open the container
		$sidebarPanelsContainer.addClass('open');
	}
	
	function closeSidebarPanel() {
		$sidebarPanelsContainer.removeClass('open');
		$sidebarNavLinks.removeClass('active');
	}
	
	// --- END Sidebar Panel Logic ---
	
	
	// --- Global Loading Overlay Functions ---
	function showGlobalLoadingOverlay(message = "Processing...") {
		if ($loadingOverlay.length && $loadingOverlayMessage.length) {
			$loadingOverlayMessage.text(message);
			$loadingOverlay.show();
		} else {
			console.warn("Loading overlay elements not found.");
		}
	}
	
	function hideGlobalLoadingOverlay() {
		if ($loadingOverlay.length) {
			$loadingOverlay.hide();
		}
	}

// --- Global Action Button Setup & Updates ---
	function initializeGlobalActions() {
		
		// --- Helper to prevent action on disabled links ---
		const preventDisabled = (e, actionFn) => {
			e.preventDefault(); // Always prevent default for links
			if ($(e.currentTarget).hasClass('disabled')) {
				console.log("Action prevented: Button disabled", e.currentTarget.id);
				return;
			}
			actionFn(); // Execute the action
		};
		
		
		// History Actions
		$('#undoBtn').on('click', () => historyManager.undo());
		$('#redoBtn').on('click', () => historyManager.redo());
		
		// Layer Actions
		$('#deleteBtn').on('click', () => layerManager.deleteSelectedLayer());
		$('#lockBtn').on('click', () => layerManager.toggleSelectedLayerLock());
		$("#visibilityBtn").on('click', () => layerManager.toggleSelectedLayerVisibility());
		$('#bringToFrontBtn').on('click', () => layerManager.moveSelectedLayer('up'));
		$('#sendToBackBtn').on('click', () => layerManager.moveSelectedLayer('down'));

		// File Menu Actions
		$('#saveDesign').on('click', (e) => preventDisabled(e, () => canvasManager.saveDesign()));
		$('#loadDesignIconBtn').on('click', (e) => { // New listener for the icon
			e.preventDefault();
			// No disabled check needed for load
			$loadDesignInput.click();
		});
		$loadDesignInput.on('change', (event) => { // Keep the change listener
			const file = event.target.files[0];
			if (file) {
				canvasManager.loadDesign(file, false); // Load full design
			}
			$(event.target).val(''); // Reset input
		});
		
		// Export Actions
		$('#downloadBtn').on('click', (e) => preventDisabled(e, () => canvasManager.exportCanvas('png', true))); // Default to PNG
		
		$('#openCanvasSizeModalBtn').on('click', (e) => {
			e.preventDefault();
			canvasSizeModal.show();
		});
	}
	
	function updateActionButtons() {
		const selectedLayer = layerManager.getSelectedLayer();
		const layers = layerManager.getLayers();
		const hasSelection = !!selectedLayer;
		const isLocked = hasSelection && selectedLayer.locked;
		
		// Enable/disable based on selection and lock status
		$('#deleteBtn').prop('disabled', !hasSelection || isLocked);
		$('#lockBtn').prop('disabled', !hasSelection); // Can always lock/unlock if selected
		
		// Update lock button icon and title
		if (selectedLayer) {
			const lockIconClass = selectedLayer.locked ? 'fa-lock' : 'fa-lock-open';
			$('#lockBtn i').removeClass('fa-lock fa-lock-open').addClass(lockIconClass);
			$('#lockBtn').attr('title', selectedLayer.locked ? 'Unlock Selected' : 'Lock Selected');
		} else {
			$('#lockBtn i').removeClass('fa-lock fa-lock-open').addClass('fa-lock');
			$('#lockBtn').attr('title', 'Lock/Unlock Selected');
		}
		
		// Layer order buttons
		let isAtFront = false;
		let isAtBack = false;
		if (hasSelection && layers.length > 1) {
			// Sort by zIndex to determine position
			const sortedLayers = [...layers].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
			const selectedIndex = sortedLayers.findIndex(l => l.id === selectedLayer.id);
			isAtBack = selectedIndex === 0;
			isAtFront = selectedIndex === sortedLayers.length - 1;
		} else if (layers.length <= 1) {
			// If only one layer (or none), it's both front and back
			isAtFront = true;
			isAtBack = true;
		}
		$('#bringToFrontBtn').prop('disabled', !hasSelection || isAtFront);
		$('#sendToBackBtn').prop('disabled', !hasSelection || isAtBack);
		
		
		// History buttons
		$('#undoBtn').prop('disabled', !historyManager.canUndo());
		$('#redoBtn').prop('disabled', !historyManager.canRedo());
		
		// Export/Save buttons (disabled if no layers)
		const hasLayers = layers.length > 0;
		$('#downloadBtn, #exportPng, #exportJpg').prop('disabled', !hasLayers);
		$('#saveDesign').prop('disabled', !hasLayers);
	}
	
}); // End document ready
