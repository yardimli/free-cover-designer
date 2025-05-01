class TextToolbar {
	constructor(options) {
		this.$toolbar = $('#textToolbar');
		// this.$fontFamilySelect = $('#fontFamilySelect'); // REMOVED
		this.$fontPickerInput = $('#fontPickerInput'); // ADDED
		this.$fontSizeInput = $('#fontSizeInput');
		this.$fontColorInput = $('#fontColorInput');
		this.$boldBtn = $('#boldBtn');
		this.$italicBtn = $('#italicBtn');
		this.$underlineBtn = $('#underlineBtn');
		this.$alignBtns = this.$toolbar.find('.btn-group button[data-align]');
		
		this.getSelectedLayer = options.getSelectedLayer;
		this.updateLayerStyle = options.updateLayerStyle;
		this.saveState = options.saveState;
		
		// Retrieve pre-loaded Google Fonts from PHP
		try {
			this.googleFontsList = JSON.parse($('#googleFontsData').text() || '[]');
		} catch (e) {
			console.error("Error parsing Google Fonts data", e);
			this.googleFontsList = ['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Playfair Display']; // Fallback
		}
		
		this.init();
	}
	
	init() {
		// --- Initialize jsFontPicker ---
		this.$fontPickerInput.fontpicker({
				lang: 'en',
				variants: false,
				lazyLoad: true,
				showClear: true,
				nrRecents: 3,
			// default: 'Arial', // Default font
			// googleFonts: this.googleFontsList, // Use list from PHP
			// localFonts: { // Define standard web-safe fonts
			// 	"Arial": { "category": "sans-serif", "variants": "400,400i,700,700i" },
			// 	"Verdana": { "category": "sans-serif", "variants": "400,400i,700,700i" },
			// 	"Times New Roman": { "category": "serif", "variants": "400,400i,700,700i" },
			// 	"Georgia": { "category": "serif", "variants": "400,400i,700,700i" },
			// 	"Courier New": { "category": "monospace", "variants": "400,400i,700,700i" },
			// 	"serif": { "category": "serif", "variants": "400" },
			// 	"sans-serif": { "category": "sans-serif", "variants": "400" },
			// 	"monospace": { "category": "monospace", "variants": "400" },
			// 	"'Helvetica Neue', sans-serif": { "category": "sans-serif", "variants": "400" } // Keep existing ones
				// Add other web-safe fonts if desired
			
			// Callback when a font is selected from the picker
			onSelect: (font) => {
					console.log(font);
				// const cleanFontFamily = fontFamily.replace(/^['"]|['"]$/g, '');
				// console.log("Font selected:", cleanFontFamily);
				this.handleStyleChange('fontFamily', font.fontFamily);
			},
		});
		

		
		// --- Event Listeners ---
		// this.$fontFamilySelect.on('change', ...); // REMOVED
		
		this.$fontSizeInput.on('input', () => this.handleStyleChange('fontSize', this.$fontSizeInput.val()));
		this.$fontColorInput.on('input', () => this.handleStyleChange('fill', this.$fontColorInput.val()));
		this.$boldBtn.on('click', () => this.toggleStyle('fontWeight', 'bold', 'normal'));
		this.$italicBtn.on('click', () => this.toggleStyle('fontStyle', 'italic', 'normal'));
		this.$underlineBtn.on('click', () => this.toggleStyle('textDecoration', 'underline', 'none'));
		this.$alignBtns.on('click', (e) => {
			const align = $(e.currentTarget).data('align');
			this.handleStyleChange('align', align);
		});
		
		// Add listeners for future controls
	}
	
	handleStyleChange(property, value) {
		const layer = this.getSelectedLayer();
		if (layer && layer.type === 'text' && !layer.locked) {
			this.updateLayerStyle(layer.id, property, value);
			// If the font family changed via external means (e.g., undo/redo),
			// we might need to update the picker input value here as well.
			// However, the callback handles picker selections, and populate handles layer selections.
			this.populate(this.getSelectedLayer()); // Refresh toolbar state
			this.saveState();
		}
	}
	
	toggleStyle(property, activeValue, inactiveValue) {
		const layer = this.getSelectedLayer();
		if (layer && layer.type === 'text' && !layer.locked) {
			const currentValue = layer[property];
			const newValue = (currentValue === activeValue) ? inactiveValue : activeValue;
			// Update layer data directly first
			layer[property] = newValue;
			// Then call handleStyleChange to apply visually and save state
			this.handleStyleChange(property, newValue);
		}
	}
	
	populate(layerData) {
		if (!layerData || layerData.type !== 'text') {
			this.hide();
			return;
		}
		this.show();
		
		const isDisabled = layerData.locked;
		
		// --- Populate Controls ---
		const currentFont = layerData.fontFamily || 'Arial';
		this.$fontPickerInput.val(currentFont); // Set the input's value
		// Note: This doesn't update the picker's internal "selected" state visually in the dropdown,
		// but shows the correct font in the input box. This is usually sufficient.
		// If you need the dropdown to highlight the font, you might need to trigger
		// an event or use a jsFontPicker API if available.
		
		this.$fontSizeInput.val(parseInt(layerData.fontSize) || 16);
		
		let fillColor = layerData.fill || '#000000';
		// ... (keep color conversion logic) ...
		if (fillColor.startsWith('rgba')) {
			try {
				const parts = fillColor.match(/[\d.]+/g);
				if (parts && parts.length >= 3) {
					fillColor = `#${(+parts[0]).toString(16).padStart(2, '0')}${(+parts[1]).toString(16).padStart(2, '0')}${(+parts[2]).toString(16).padStart(2, '0')}`;
				} else {
					fillColor = '#000000';
				}
			} catch (e) {
				fillColor = '#000000';
			}
		}
		this.$fontColorInput.val(fillColor);
		
		this.$boldBtn.toggleClass('active', layerData.fontWeight === 'bold');
		this.$italicBtn.toggleClass('active', layerData.fontStyle === 'italic');
		this.$underlineBtn.toggleClass('active', layerData.textDecoration === 'underline'); // Check 'underline', not contains
		
		this.$alignBtns.removeClass('active');
		this.$toolbar.find(`.btn-group button[data-align="${layerData.align || 'left'}"]`).addClass('active');
		
		// Disable controls if locked
		this.$toolbar.find('input, select, button').prop('disabled', isDisabled);
		// Specifically disable/enable the font picker input AND its button
		this.$fontPickerInput.prop('disabled', isDisabled);
		// jsFontPicker usually adds a button next to the input
		this.$fontPickerInput.next('.fp-button').prop('disabled', isDisabled); // Adjust selector '.fp-button' if needed
	}
	
	show() {
		this.$toolbar.removeClass('d-none');
	}
	
	hide() {
		this.$toolbar.addClass('d-none');
		this.$toolbar.find('input, select, button').prop('disabled', true);
		// Also disable fontpicker button if it exists
		this.$fontPickerInput.next('.fp-button').prop('disabled', true);
	}
}
