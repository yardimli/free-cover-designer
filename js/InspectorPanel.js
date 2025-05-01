class InspectorPanel {
	constructor(options) {
		this.$panel = $('#inspectorPanel');
		this.layerManager = options.layerManager;
		this.historyManager = options.historyManager;
		this.canvasManager = options.canvasManager; // For layer alignment potentially
		this.currentLayer = null;
		this.googleFontsList = options.googleFontsList || [];
		
		this.init();
	}
	
	init() {
		this.bindEvents();
		// Initialize font picker AFTER the element is definitely in the DOM
		this._initFontPicker();
	}
	
	_initFontPicker() {
		try {
			const $fontInput = this.$panel.find('#inspector-font-family');
			if ($fontInput.length && $.fn.fontpicker) {
				$fontInput.fontpicker({
					lang: 'en',
					variants: false,
					lazyLoad: true,
					showClear: false,
					nrRecents: 3,
					// googleFonts: this.googleFontsList, // From PHP
					// localFonts: { // Standard web-safe
					// 	"Arial": { "category": "sans-serif", "variants": "400,700" },
					// 	"Verdana": { "category": "sans-serif", "variants": "400,700" },
					// 	"Times New Roman": { "category": "serif", "variants": "400,700" },
					// 	"Georgia": { "category": "serif", "variants": "400,700" },
					// 	"Courier New": { "category": "monospace", "variants": "400,700" },
					// 	"'Helvetica Neue', sans-serif": { "category": "sans-serif", "variants": "400" }
					// },
					onSelect: (font) => {
						// Ensure font is loaded dynamically if it's a Google Font
						this.layerManager._ensureGoogleFontLoaded(font.fontFamily);
						this._updateLayer('fontFamily', font.fontFamily, true); // Save on select
					}
				});
			} else if (!$fontInput.length) {
				console.warn("InspectorPanel: Font family input not found.");
			} else if (!$.fn.fontpicker) {
				console.warn("InspectorPanel: jsFontPicker plugin not loaded.");
			}
		} catch (e) {
			console.error("Error initializing font picker:", e);
		}
	}
	
	bindEvents() {
		const self = this;
		let historySaveScheduled = false;
		const scheduleHistorySave = () => {
			if (!historySaveScheduled) {
				historySaveScheduled = true;
				setTimeout(() => {
					self.historyManager.saveState();
					historySaveScheduled = false;
				}, 300); // Debounce history save slightly
			}
		};
		
		// --- Helper to update layer and potentially schedule history save ---
		// `saveNow` forces immediate history save (e.g., button clicks, color change final)
		// `saveDebounced` schedules save (e.g., slider input)
		const updateLayer = (prop, value, saveNow = false, saveDebounced = true) => {
			if (this.currentLayer && !this.currentLayer.locked) {
				this.layerManager.updateLayerData(this.currentLayer.id, { [prop]: value });
				if (saveNow) {
					this.historyManager.saveState();
				} else if (saveDebounced) {
					scheduleHistorySave();
				}
			}
		};
		
		// --- Helper for color inputs (Picker + Hex + Opacity) ---
		const bindColorInputGroup = (groupId, layerPropPrefix) => {
			const $picker = $(`#inspector-${groupId}-color`);
			const $hex = $(`#inspector-${groupId}-hex`);
			const $opacitySlider = $(`#inspector-${groupId}-opacity`);
			const $opacityValue = $(`#inspector-${groupId}-opacity-value`);
			
			const updateFromPickerOrHex = (sourceValue, isPicker = false) => {
				if (!this.currentLayer || this.currentLayer.locked) return;
				let tiny = tinycolor(sourceValue);
				if (!tiny.isValid()) return; // Ignore invalid input
				
				const currentOpacity = parseFloat($opacitySlider.val());
				const newRgba = tiny.setAlpha(currentOpacity).toRgbString();
				const hexString = tiny.toHexString().toUpperCase().substring(1); // Remove #
				
				if (isPicker) {
					$hex.val(hexString);
				} else {
					$picker.val(tiny.toHexString()); // Update picker color
				}
				
				updateLayer(layerPropPrefix + 'Color', newRgba, false, false); // Don't save yet
				// Special case: If it's 'fill', update 'fill' property
				if (layerPropPrefix === 'fill') {
					updateLayer('fill', newRgba, false, false);
				} else {
					updateLayer(layerPropPrefix, newRgba, false, false); // Update 'stroke', 'shadowColor', 'backgroundColor'
				}
				
				// Update opacity prop separately if exists (e.g., backgroundOpacity)
				const opacityProp = layerPropPrefix + 'Opacity';
				if (this.currentLayer.hasOwnProperty(opacityProp)) {
					updateLayer(opacityProp, currentOpacity, false, false);
				}
				
			};
			
			$picker.on('input', () => updateFromPickerOrHex($picker.val(), true));
			$hex.on('input', () => updateFromPickerOrHex('#' + $hex.val(), false)); // Add # for tinycolor
			$opacitySlider.on('input', () => {
				if (!this.currentLayer || this.currentLayer.locked) return;
				const opacity = parseFloat($opacitySlider.val());
				$opacityValue.text(`${Math.round(opacity * 100)}%`);
				let tiny = tinycolor($picker.val()); // Get current color
				if (tiny.isValid()) {
					const newRgba = tiny.setAlpha(opacity).toRgbString();
					// Special case: If it's 'fill', update 'fill' property
					if (layerPropPrefix === 'fill') {
						updateLayer('fill', newRgba, false, true);
					} else {
						updateLayer(layerPropPrefix, newRgba, false, true);
					}
					
					// Update opacity prop separately if exists
					const opacityProp = layerPropPrefix + 'Opacity';
					if (this.currentLayer.hasOwnProperty(opacityProp)) {
						updateLayer(opacityProp, opacity, false, true);
					}
				}
			});
			
			// Save history on final change
			$picker.on('change', () => this.historyManager.saveState());
			$hex.on('change', () => this.historyManager.saveState());
			$opacitySlider.on('change', () => this.historyManager.saveState());
			
		};
		
		// Bind color groups
		bindColorInputGroup('fill', 'fill'); // Layer fill color/opacity
		bindColorInputGroup('border', 'stroke'); // Layer border/stroke color/opacity
		bindColorInputGroup('shading', 'shadowColor'); // Text shadow color/opacity
		bindColorInputGroup('background', 'backgroundColor'); // Text background color/opacity
		
		
		// --- Generic Range Slider + Number Input ---
		const bindRangeAndNumber = (rangeId, numberId, layerProp, min, max, step, saveDebounced = true) => {
			const $range = $(`#${rangeId}`);
			const $number = $(`#${numberId}`);
			$range.on('input', () => {
				const val = parseFloat($range.val());
				$number.val(val);
				updateLayer(layerProp, val, false, saveDebounced);
			});
			$number.on('input', () => {
				let val = parseFloat($number.val());
				if (isNaN(val)) return;
				val = Math.max(min, Math.min(max, val)); // Clamp value
				$range.val(val);
				updateLayer(layerProp, val, false, saveDebounced);
			});
			// Save history on final change
			$range.on('change', () => this.historyManager.saveState());
			$number.on('change', () => { // Also update range if number is changed directly
				let val = parseFloat($number.val());
				if (isNaN(val)) val = min;
				val = Math.max(min, Math.min(max, val));
				$range.val(val);
				updateLayer(layerProp, val, true); // Save immediately on direct number change
			});
		};
		
		// Layer Opacity
		this.$panel.find('#inspector-opacity').on('input', (e) => {
			const val = parseFloat($(e.target).val());
			$('#inspector-opacity-value').text(`${Math.round(val * 100)}%`);
			updateLayer('opacity', val);
		}).on('change', () => this.historyManager.saveState());
		
		// Border Weight
		bindRangeAndNumber('inspector-border-weight', 'inspector-border-weight-value', 'strokeWidth', 0, 50, 0.5);
		
		// Text Size
		this.$panel.find('#inspector-font-size').on('input', (e) => {
			const val = parseInt($(e.target).val());
			if (!isNaN(val) && val > 0) {
				updateLayer('fontSize', val, false, true);
			}
		}).on('change', () => this.historyManager.saveState());
		
		// Text Spacing & Line Height
		this.$panel.find('#inspector-letter-spacing').on('input', (e) => updateLayer('letterSpacing', parseFloat($(e.target).val()) || 0))
			.on('change', () => this.historyManager.saveState());
		this.$panel.find('#inspector-line-height').on('input', (e) => updateLayer('lineHeight', parseFloat($(e.target).val()) || 1.3))
			.on('change', () => this.historyManager.saveState());
		
		// Text Style Buttons (Bold, Italic, Underline)
		this.$panel.find('#inspector-bold-btn').on('click', () => this.toggleStyle('fontWeight', 'bold', 'normal'));
		this.$panel.find('#inspector-italic-btn').on('click', () => this.toggleStyle('fontStyle', 'italic', 'normal'));
		this.$panel.find('#inspector-underline-btn').on('click', () => this.toggleStyle('textDecoration', 'underline', 'none'));
		
		// Text Alignment
		this.$panel.find('#inspector-text-align button').on('click', (e) => {
			const align = $(e.currentTarget).data('align');
			updateLayer('align', align, true); // Save immediately
			this.$panel.find('#inspector-text-align button').removeClass('active');
			$(e.currentTarget).addClass('active');
		});
		
		// --- Shading ---
		this.$panel.find('#inspector-shading-enabled').on('change', (e) => {
			const isChecked = $(e.target).prop('checked');
			// Update layer data and save history
			updateLayer('shadowEnabled', isChecked, true);
			// REMOVED: this.populate(this.currentLayer);
			
			// INSTEAD: Directly toggle the visibility of the shading controls section
			$(e.target).closest('.inspector-section').find('.section-content').toggle(isChecked);
		});
		
		bindRangeAndNumber('inspector-shading-blur', 'inspector-shading-blur-value', 'shadowBlur', 0, 100, 1);
		// Offset/Angle require recalculating shadowOffsetX/Y
		const updateShadowOffset = () => {
			const offset = parseFloat($('#inspector-shading-offset').val());
			const angleRad = parseFloat($('#inspector-shading-angle').val()) * Math.PI / 180;
			const offsetX = Math.round(offset * Math.cos(angleRad));
			const offsetY = Math.round(offset * Math.sin(angleRad));
			updateLayer('shadowOffsetX', offsetX, false, false); // Don't save individually
			updateLayer('shadowOffsetY', offsetY, false, true); // Save on Y update
		};
		bindRangeAndNumber('inspector-shading-offset', 'inspector-shading-offset-value', 'shadowOffsetInternal', 0, 100, 1, false); // Internal temp prop
		bindRangeAndNumber('inspector-shading-angle', 'inspector-shading-angle-value', 'shadowAngleInternal', -180, 180, 1, false); // Internal temp prop
		$('#inspector-shading-offset, #inspector-shading-angle').on('input', updateShadowOffset);
		$('#inspector-shading-offset, #inspector-shading-angle').on('change', () => this.historyManager.saveState());
		
		// --- Background (Text Only) ---
		this.$panel.find('#inspector-background-enabled').on('change', (e) => {
			const isChecked = $(e.target).prop('checked');
			// Update layer data and save history
			updateLayer('backgroundEnabled', isChecked, true);
			// REMOVED: this.populate(this.currentLayer);
			
			// INSTEAD: Directly toggle the visibility of the background controls section
			$(e.target).closest('.inspector-section').find('.section-content').toggle(isChecked);
		});
		
		bindRangeAndNumber('inspector-background-radius', 'inspector-background-radius-value', 'backgroundCornerRadius', 0, 100, 0.5);
		
		// Layer Alignment Buttons (Example - Implement actual logic if needed)
		this.$panel.find('#inspector-alignment button[data-align-layer]').on('click', (e) => {
			if(this.currentLayer && !this.currentLayer.locked) {
				console.log("Layer Alignment Clicked:", $(e.currentTarget).data('alignLayer'));
				alert('Layer alignment not fully implemented yet.');
				// Add logic here to calculate new X/Y based on canvasManager.currentCanvasWidth/Height
				// and updateLayerData, then saveState
			}
		});
		
	}
	
	toggleStyle(property, activeValue, inactiveValue) {
		if (this.currentLayer && this.currentLayer.type === 'text' && !this.currentLayer.locked) {
			const currentValue = this.currentLayer[property];
			const newValue = (currentValue === activeValue) ? inactiveValue : activeValue;
			this._updateLayer(property, newValue, true); // Save immediately for toggles
		}
	}
	
	_updateLayer(property, value, saveNow = false) {
		if (this.currentLayer && !this.currentLayer.locked) {
			this.layerManager.updateLayerData(this.currentLayer.id, { [property]: value });
			if (saveNow) {
				this.historyManager.saveState();
			}
			// Re-populate to reflect changes and potentially related states
			// Avoid infinite loops by checking if the value actually changed if necessary
			this.populate(this.layerManager.getLayerById(this.currentLayer.id));
		}
	}
	
	show(layerData) {
		this.currentLayer = layerData;
		if (!layerData) {
			this.hide();
			return;
		}
		this.populate(layerData);
		this.$panel.removeClass('d-none');
	}
	
	hide() {
		this.currentLayer = null;
		this.$panel.addClass('d-none');
	}
	
	// --- Helper to populate color input group ---
	_populateColorInputGroup(groupId, colorValue, opacityValue = 1) {
		const $picker = $(`#inspector-${groupId}-color`);
		const $hex = $(`#inspector-${groupId}-hex`);
		const $opacitySlider = $(`#inspector-${groupId}-opacity`);
		const $opacityValue = $(`#inspector-${groupId}-opacity-value`);
		
		let tiny = tinycolor(colorValue || '#000000'); // Default black if invalid/missing
		if (!tiny.isValid()) {
			tiny = tinycolor('#000000');
		}
		// Handle case where opacity might be separate property or included in colorValue
		let alpha = opacityValue;
		if (colorValue && typeof colorValue === 'string' && (colorValue.startsWith('rgba') || colorValue.startsWith('hsla'))) {
			alpha = tiny.getAlpha(); // Use alpha from the color string itself if present
		}
		alpha = isNaN(alpha) ? 1 : Math.max(0, Math.min(1, alpha)); // Clamp opacity
		
		$picker.val(tiny.toHexString()); // Set color picker (ignores alpha)
		$hex.val(tiny.toHexString().substring(1).toUpperCase()); // Set hex input (no #)
		$opacitySlider.val(alpha);
		$opacityValue.text(`${Math.round(alpha * 100)}%`);
	}
	
	// --- Helper to populate range + number ---
	_populateRangeAndNumber(rangeId, numberId, value, fallback = 0) {
		const numValue = parseFloat(value);
		const finalValue = isNaN(numValue) ? fallback : numValue;
		$(`#${rangeId}`).val(finalValue);
		$(`#${numberId}`).val(finalValue);
	}
	
	
	populate(layerData) {
		if (!layerData) {
			this.hide();
			return;
		}
		this.currentLayer = layerData; // Update internal reference
		
		const isLocked = layerData.locked;
		const isText = layerData.type === 'text';
		
		// --- Enable/Disable Panel Sections ---
		this.$panel.find('#inspector-text').toggle(isText);
		this.$panel.find('#inspector-text-shading').toggle(isText);
		this.$panel.find('#inspector-text-background').toggle(isText);
		// Keep generic sections visible (Layer, Color, Border)
		// Show/hide Alignment based on selection? Maybe always show.
		this.$panel.find('#inspector-alignment').show();
		this.$panel.find('#inspector-layer').show();
		this.$panel.find('#inspector-color').toggle(isText); // Only show fill for text for now
		this.$panel.find('#inspector-border').toggle(isText); // Only show border (stroke) for text
		
		// Disable all controls if locked
		this.$panel.find('input, select, button, textarea').prop('disabled', isLocked);
		// Specifically disable/enable the font picker button if it exists
		this.$panel.find('#inspector-font-family').next('.fp-button').prop('disabled', isLocked);
		
		// --- Populate Common Controls ---
		const opacity = layerData.opacity ?? 1;
		$('#inspector-opacity').val(opacity);
		$('#inspector-opacity-value').text(`${Math.round(opacity * 100)}%`);
		
		// --- Populate Text Controls (if Text Layer) ---
		if (isText) {
			// Fill Color
			this._populateColorInputGroup('fill', layerData.fill, 1); // Text fill opacity is part of the color
			
			// Border (Stroke) Color & Weight
			const strokeWidth = parseFloat(layerData.strokeWidth) || 0;
			this._populateColorInputGroup('border', layerData.stroke, 1); // Stroke opacity part of color
			this._populateRangeAndNumber('inspector-border-weight', 'inspector-border-weight-value', strokeWidth);
			
			// Font
			const font = layerData.fontFamily || 'Arial';
			$('#inspector-font-family').val(font);
			// Attempt to visually update font picker (might need plugin specific method)
			try {
				$('#inspector-font-family').data('fontpicker')?.set(font);
			} catch(e) { console.warn("Couldn't update fontpicker selection visually", e)}
			
			this._populateRangeAndNumber('inspector-font-size', 'inspector-font-size', layerData.fontSize, 24);
			this._populateRangeAndNumber('inspector-letter-spacing', 'inspector-letter-spacing', layerData.letterSpacing, 0);
			this._populateRangeAndNumber('inspector-line-height', 'inspector-line-height', layerData.lineHeight, 1.3);
			
			// Font Styles
			$('#inspector-bold-btn').toggleClass('active', layerData.fontWeight === 'bold');
			$('#inspector-italic-btn').toggleClass('active', layerData.fontStyle === 'italic');
			$('#inspector-underline-btn').toggleClass('active', layerData.textDecoration === 'underline');
			
			// Text Align
			$('#inspector-text-align button').removeClass('active');
			$(`#inspector-text-align button[data-align="${layerData.align || 'left'}"]`).addClass('active');
			
			// Shading / Shadow
			const shadowEnabled = !!layerData.shadowEnabled;
			$('#inspector-shading-enabled').prop('checked', shadowEnabled);
			this.$panel.find('#inspector-text-shading .section-content').toggle(shadowEnabled); // Show/hide details
			
			if (shadowEnabled) {
				this._populateColorInputGroup('shading', layerData.shadowColor, layerData.shadowOpacity); // Pass opacity separately if needed
				this._populateRangeAndNumber('inspector-shading-blur', 'inspector-shading-blur-value', layerData.shadowBlur, 0);
				
				// Calculate Offset/Angle from X/Y for sliders
				const shadowX = parseFloat(layerData.shadowOffsetX) || 0;
				const shadowY = parseFloat(layerData.shadowOffsetY) || 0;
				const shadowOffset = Math.sqrt(shadowX * shadowX + shadowY * shadowY);
				let shadowAngle = Math.atan2(shadowY, shadowX) * 180 / Math.PI;
				shadowAngle = Math.round(shadowAngle); // Round for slider
				
				this._populateRangeAndNumber('inspector-shading-offset', 'inspector-shading-offset-value', shadowOffset);
				this._populateRangeAndNumber('inspector-shading-angle', 'inspector-shading-angle-value', shadowAngle);
			}
			
			// Background
			const backgroundEnabled = !!layerData.backgroundEnabled;
			$('#inspector-background-enabled').prop('checked', backgroundEnabled);
			this.$panel.find('#inspector-text-background .section-content').toggle(backgroundEnabled);
			
			if (backgroundEnabled) {
				this._populateColorInputGroup('background', layerData.backgroundColor, layerData.backgroundOpacity);
				this._populateRangeAndNumber('inspector-background-radius', 'inspector-background-radius-value', layerData.backgroundCornerRadius, 0);
			}
		}
		
		// --- Populate Image Controls (if Image Layer) ---
		// else if (layerData.type === 'image') {
		// Populate image-specific controls here (e.g., filters)
		// }
		
		// Ensure locked state disables controls again after populating
		if (isLocked) {
			this.$panel.find('input, select, button, textarea').prop('disabled', true);
			this.$panel.find('#inspector-font-family').next('.fp-button').prop('disabled', true);
		}
	}
}
