class TextToolbar {
	constructor(options) {
		this.$toolbar = $('#textToolbar');
		this.$fontFamilySelect = $('#fontFamilySelect');
		this.$fontSizeInput = $('#fontSizeInput');
		this.$fontColorInput = $('#fontColorInput'); // Input for 'fill' property
		this.$boldBtn = $('#boldBtn');
		this.$italicBtn = $('#italicBtn');
		this.$underlineBtn = $('#underlineBtn');
		this.$alignBtns = this.$toolbar.find('.btn-group button[data-align]');
		
		// Callbacks provided by the App/LayerManager
		this.getSelectedLayer = options.getSelectedLayer;
		// Expects (layerId, property, value) - LayerManager handles applying it
		this.updateLayerStyle = options.updateLayerStyle;
		this.saveState = options.saveState; // Callback to HistoryManager
		
		this.init();
	}
	
	init() {
		// --- Event Listeners ---
		this.$fontFamilySelect.on('change', () => this.handleStyleChange('fontFamily', this.$fontFamilySelect.val()));
		this.$fontSizeInput.on('input', () => this.handleStyleChange('fontSize', this.$fontSizeInput.val())); // Pass raw value, LayerManager adds 'px' if needed
		this.$fontColorInput.on('input', () => this.handleStyleChange('fill', this.$fontColorInput.val())); // Update 'fill' property
		this.$boldBtn.on('click', () => this.toggleStyle('fontWeight', 'bold', 'normal'));
		this.$italicBtn.on('click', () => this.toggleStyle('fontStyle', 'italic', 'normal'));
		this.$underlineBtn.on('click', () => this.toggleStyle('textDecoration', 'underline', 'none'));
		
		this.$alignBtns.on('click', (e) => {
			const align = $(e.currentTarget).data('align');
			this.handleStyleChange('align', align); // Update 'align' property
		});
		
		// Add listeners for future controls (lineHeight, letterSpacing, shadow etc.) here
		// Example:
		// $('#lineHeightInput').on('input', () => this.handleStyleChange('lineHeight', $('#lineHeightInput').val()));
		// $('#letterSpacingInput').on('input', () => this.handleStyleChange('letterSpacing', $('#letterSpacingInput').val()));
		// $('#shadowEnableCheckbox').on('change', () => this.handleStyleChange('shadowEnabled', $('#shadowEnableCheckbox').prop('checked')));
		// $('#shadowColorInput').on('input', () => this.handleStyleChange('shadowColor', $('#shadowColorInput').val()));
		// ... etc ...
	}
	
	// Handles simple property changes
	handleStyleChange(property, value) {
		const layer = this.getSelectedLayer();
		// Ensure layer exists, is text, and is not locked
		if (layer && layer.type === 'text' && !layer.locked) {
			// Use the callback to update the layer data and visuals
			this.updateLayerStyle(layer.id, property, value);
			// Re-populate toolbar to reflect the change immediately (e.g., button states)
			this.populate(this.getSelectedLayer()); // Get potentially updated layer data
			// Use the callback to save history state
			this.saveState();
		}
	}
	
	// Handles toggling styles like bold, italic, underline
	toggleStyle(property, activeValue, inactiveValue) {
		const layer = this.getSelectedLayer();
		if (layer && layer.type === 'text' && !layer.locked) {
			const currentValue = layer[property]; // Access property directly from layer data
			const newValue = (currentValue === activeValue) ? inactiveValue : activeValue;
			this.handleStyleChange(property, newValue);
			// handleStyleChange takes care of populate and saveState
		}
	}
	
	// Populates the toolbar controls based on the selected layer's data
	populate(layerData) {
		// Hide toolbar if no layer selected, or if selected layer is not text
		if (!layerData || layerData.type !== 'text') {
			this.hide();
			return;
		}
		this.show(); // Show the toolbar
		
		// --- Populate Controls ---
		this.$fontFamilySelect.val(layerData.fontFamily || 'Arial');
		this.$fontSizeInput.val(parseInt(layerData.fontSize) || 16);
		
		// Handle color input - it expects hex, but data might be rgba
		let fillColor = layerData.fill || '#000000';
		if (fillColor.startsWith('rgba')) {
			// Basic conversion attempt (loses alpha for the input)
			try {
				const parts = fillColor.match(/[\d.]+/g);
				if (parts && parts.length >= 3) {
					fillColor = `#${(+parts[0]).toString(16).padStart(2, '0')}${(+parts[1]).toString(16).padStart(2, '0')}${(+parts[2]).toString(16).padStart(2, '0')}`;
				} else {
					fillColor = '#000000'; // Fallback
				}
			} catch (e) { fillColor = '#000000'; }
		}
		this.$fontColorInput.val(fillColor);
		
		// Update button active states
		this.$boldBtn.toggleClass('active', layerData.fontWeight === 'bold');
		this.$italicBtn.toggleClass('active', layerData.fontStyle === 'italic');
		this.$underlineBtn.toggleClass('active', layerData.textDecoration === 'underline');
		
		// Update alignment button active states
		this.$alignBtns.removeClass('active');
		this.$toolbar.find(`.btn-group button[data-align="${layerData.align || 'left'}"]`).addClass('active');
		
		// Populate future controls here
		// $('#lineHeightInput').val(layerData.lineHeight || 1.3);
		// $('#letterSpacingInput').val(layerData.letterSpacing || 0);
		// $('#shadowEnableCheckbox').prop('checked', layerData.shadowEnabled || false);
		// ... etc ...
		
		// Disable controls if the layer is locked
		const isDisabled = layerData.locked;
		this.$toolbar.find('input, select, button').prop('disabled', isDisabled);
	}
	
	show() {
		this.$toolbar.removeClass('d-none');
	}
	
	hide() {
		this.$toolbar.addClass('d-none');
		// Optionally disable all controls when hidden
		this.$toolbar.find('input, select, button').prop('disabled', true);
	}
}
