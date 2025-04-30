class TextToolbar {
	constructor(options) {
		this.$toolbar = $('#textToolbar');
		this.$fontFamilySelect = $('#fontFamilySelect');
		this.$fontSizeInput = $('#fontSizeInput');
		this.$fontColorInput = $('#fontColorInput');
		this.$boldBtn = $('#boldBtn');
		this.$italicBtn = $('#italicBtn');
		this.$underlineBtn = $('#underlineBtn');
		this.$alignBtns = this.$toolbar.find('.btn-group button[data-align]');
		
		// Callbacks provided by the App/LayerManager
		this.getSelectedLayer = options.getSelectedLayer;
		this.updateLayerStyle = options.updateLayerStyle; // Expects (layerId, property, value)
		this.saveState = options.saveState;
		
		this.init();
	}
	
	init() {
		this.$fontFamilySelect.on('change', () => this.handleStyleChange('fontFamily', this.$fontFamilySelect.val()));
		this.$fontSizeInput.on('input', () => this.handleStyleChange('fontSize', this.$fontSizeInput.val() + 'px'));
		this.$fontColorInput.on('input', () => this.handleStyleChange('color', this.$fontColorInput.val()));
		
		this.$boldBtn.on('click', () => {
			const layer = this.getSelectedLayer();
			if (!layer) return;
			const currentWeight = layer.styles?.fontWeight;
			this.handleStyleChange('fontWeight', currentWeight === 'bold' ? 'normal' : 'bold');
		});
		
		this.$italicBtn.on('click', () => {
			const layer = this.getSelectedLayer();
			if (!layer) return;
			const currentStyle = layer.styles?.fontStyle;
			this.handleStyleChange('fontStyle', currentStyle === 'italic' ? 'normal' : 'italic');
		});
		
		this.$underlineBtn.on('click', () => {
			const layer = this.getSelectedLayer();
			if (!layer) return;
			const currentDecoration = layer.styles?.textDecoration;
			this.handleStyleChange('textDecoration', currentDecoration === 'underline' ? 'none' : 'underline');
		});
		
		this.$alignBtns.on('click', (e) => {
			const align = $(e.currentTarget).data('align');
			this.handleStyleChange('textAlign', align);
		});
		
		// Add Effects button listener here if implementing effects
		// $('#textEffectsBtn').on('click', ...);
	}
	
	handleStyleChange(property, value) {
		const layer = this.getSelectedLayer();
		if (layer && layer.type === 'text' && !layer.locked) {
			this.updateLayerStyle(layer.id, property, value); // Use the callback
			this.populate(layer); // Re-populate to update button states immediately
			this.saveState(); // Use the callback
		}
	}
	
	populate(layerData) {
		if (!layerData || layerData.type !== 'text') {
			this.hide();
			return;
		}
		this.show();
		const styles = layerData.styles;
		this.$fontFamilySelect.val(styles.fontFamily || 'Arial');
		this.$fontSizeInput.val(parseInt(styles.fontSize) || 16);
		this.$fontColorInput.val(styles.color || '#000000');
		this.$boldBtn.toggleClass('active', styles.fontWeight === 'bold');
		this.$italicBtn.toggleClass('active', styles.fontStyle === 'italic');
		this.$underlineBtn.toggleClass('active', styles.textDecoration === 'underline');
		this.$alignBtns.removeClass('active');
		this.$toolbar.find(`.btn-group button[data-align="${styles.textAlign || 'left'}"]`).addClass('active');
	}
	
	show() {
		this.$toolbar.removeClass('d-none');
	}
	
	hide() {
		this.$toolbar.addClass('d-none');
	}
}
