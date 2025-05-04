$(document).ready(function () {
	// --- DOM References ---
	const $canvas = $('#canvas');
	const $layerList = $('#layerList');
	const $canvasArea = $('#canvas-area');
	const $canvasWrapper = $('#canvas-wrapper');
	const $loadDesignInput = $('#loadDesignInput');
	const $inspectorPanelElement = $('#inspectorPanel'); // Reference the panel element itself
	
	// Sidebar Panel References
	const $sidebarPanelsContainer = $('#sidebar-panels-container');
	const $sidebarPanels = $('.sidebar-panel');
	const $sidebarNavLinks = $('.sidebar-nav .nav-link[data-panel-target]');
	const $closePanelBtns = $('.close-panel-btn');
	
	// --- Instantiate Managers ---
	const canvasManager = new CanvasManager($canvasArea, $canvasWrapper, $canvas, {
		onZoomChange: handleZoomChange
	});
	
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
		elementsUrl: 'data/elements.json', // Example if loading elements via JSON
		applyTemplate: (jsonPath) => {
			// ... (apply template logic - remove text layers, load design) ...
			console.log("Applying template via click, removing existing text layers...");
			const existingLayers = layerManager.getLayers();
			const textLayerIdsToDelete = existingLayers
				.filter(layer => layer.type === 'text')
				.map(layer => layer.id);
			
			if (textLayerIdsToDelete.length > 0) {
				textLayerIdsToDelete.forEach(id => layerManager.deleteLayer(id, false)); // Don't save history per deletion
				console.log(`Removed ${textLayerIdsToDelete.length} text layers.`);
			} else {
				console.log("No existing text layers found to remove.");
			}
			canvasManager.loadDesign(jsonPath, true); // Load as template
		},
		addLayer: (type, props) => layerManager.addLayer(type, props),
		saveState: () => historyManager.saveState(),
		layerManager: layerManager,
		canvasManager: canvasManager
	});
	
	// Set cross-dependencies
	canvasManager.layerManager = layerManager;
	canvasManager.historyManager = historyManager;
	
	// --- Initialization ---
	sidebarManager.loadAll();
	layerManager.initializeList();
	canvasManager.initialize();
	initializeGlobalActions();
	initializeSidebarPanelControls(); // Init left panel sliding
	
	// --- Initial State ---
	historyManager.saveState();
	updateActionButtons();
	inspectorPanel.hide(); // Ensure inspector starts hidden
	
	// --- UI Update Callbacks ---
	
	// MODIFIED: Only show inspector, don't hide on deselect
	function handleLayerSelectionChange(selectedLayer) {
		if (selectedLayer) {
			// If a layer is selected, show the inspector panel
			inspectorPanel.show(selectedLayer);
		} else {
			// If no layer is selected (deselected), DO NOTHING to the inspector.
			// It stays open/closed based on user action (close button).
		}
		updateActionButtons(); // Update buttons based on selection state
	}
	
	function handleLayerDataUpdate(updatedLayer) {
		// If the inspector is currently open and showing the layer that was updated,
		// re-populate the inspector with the fresh data.
		if (inspectorPanel.currentLayer && inspectorPanel.currentLayer.id === updatedLayer.id && $inspectorPanelElement.hasClass('open')) {
			inspectorPanel.populate(updatedLayer);
		}
		// updateActionButtons(); // Might be needed if update changes lock state etc.
	}
	
	function handleZoomChange(currentZoom, minZoom, maxZoom) {
		$('#zoom-percentage-toggle').text(`${Math.round(currentZoom * 100)}%`);
		$('#zoom-in').prop('disabled', currentZoom >= maxZoom);
		$('#zoom-out').prop('disabled', currentZoom <= minZoom);
	}
	
	// --- Sidebar Panel Sliding Logic (Left Side) ---
	function initializeSidebarPanelControls() {
		$sidebarNavLinks.on('click', function(e) {
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
		
		$closePanelBtns.on('click', function() {
			closeSidebarPanel();
		});
		
		// REMOVED: Canvas click listener that closed left panels.
		// $canvasArea.on('mousedown', function(e) { ... });
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
				canvasManager.loadDesign(file, false); // Load full design
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
			const sortedLayers = [...layers].sort((a,b) => (a.zIndex || 0) - (b.zIndex || 0));
			const selectedIndex = sortedLayers.findIndex(l => l.id === selectedLayer.id);
			isAtBack = selectedIndex === 0;
			isAtFront = selectedIndex === sortedLayers.length - 1;
		} else if (layers.length <= 1) {
			// If only one layer (or none), it's both front and back
			isAtFront = true;
			isAtBack = true;
		}
		$('#bringToFrontBtn').prop('disabled', !hasSelection || isLocked || isAtFront);
		$('#sendToBackBtn').prop('disabled', !hasSelection || isLocked || isAtBack);
		
		
		// History buttons
		$('#undoBtn').prop('disabled', !historyManager.canUndo());
		$('#redoBtn').prop('disabled', !historyManager.canRedo());
		
		// Export/Save buttons (disabled if no layers)
		const hasLayers = layers.length > 0;
		$('#downloadBtn, #exportPng, #exportJpg').prop('disabled', !hasLayers);
		$('#saveDesign').prop('disabled', !hasLayers);
	}
	
}); // End document ready
