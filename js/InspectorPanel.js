// free-cover-designer/js/InspectorPanel.js

class InspectorPanel {
	constructor(options) {
		this.$panel = $('#inspectorPanel');
		this.layerManager = options.layerManager;
		this.historyManager = options.historyManager;
		this.canvasManager = options.canvasManager; // For layer alignment
		this.currentLayer = null;
		this.googleFontsList = options.googleFontsList || [];
		this.filterUpdateTimeout = null; // For debouncing filter updates
		this.filterUpdateDelay = 150; // ms delay for filter slider updates
		this.init();
	}
	
	init() {
		this.bindEvents();
		this._initFontPicker();
	}
	
	_initFontPicker() {
		// ... (font picker init code remains the same)
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
					// localFonts: { ... },
					onSelect: (font) => {
						this.layerManager._ensureGoogleFontLoaded(font.fontFamily);
						this._updateLayer('fontFamily', font.fontFamily, true);
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
				}, 300);
			}
		};
		
		// --- Helper to update layer and potentially schedule history save ---
		const updateLayer = (prop, value, saveNow = false, saveDebounced = true) => {
			if (this.currentLayer && !this.currentLayer.locked) {
				let updateData = {};
				// --- Handle nested filter update ---
				if (prop.startsWith('filters.')) {
					const filterKey = prop.split('.')[1];
					// Ensure currentLayer.filters exists
					const currentFilters = this.currentLayer.filters || { ...this.layerManager.defaultFilters };
					updateData = {
						filters: {
							...currentFilters, // Spread existing filters
							[filterKey]: value // Update the specific filter
						}
					};
				} else {
					updateData = { [prop]: value };
				}
				
				this.layerManager.updateLayerData(this.currentLayer.id, updateData);
				
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
				if (!tiny.isValid()) return;
				
				const currentOpacity = parseFloat($opacitySlider.val());
				const newRgba = tiny.setAlpha(currentOpacity).toRgbString();
				const hexString = tiny.toHexString().toUpperCase().substring(1);
				
				if (isPicker) {
					$hex.val(hexString);
				} else {
					$picker.val(tiny.toHexString());
				}
				
				// Decide which property to update based on prefix
				if (layerPropPrefix === 'fill') {
					updateLayer('fill', newRgba, false, false);
				} else if (layerPropPrefix === 'stroke') {
					updateLayer('stroke', newRgba, false, false);
				} else if (layerPropPrefix === 'shadowColor') {
					updateLayer('shadowColor', newRgba, false, false);
				} else if (layerPropPrefix === 'backgroundColor') {
					updateLayer('backgroundColor', newRgba, false, false);
					// Background opacity is handled separately below
				}
				
				// Handle separate opacity properties if they exist
				const opacityProp = layerPropPrefix + 'Opacity'; // e.g., 'backgroundOpacity'
				if (this.currentLayer.hasOwnProperty(opacityProp)) {
					updateLayer(opacityProp, currentOpacity, false, false); // Update opacity, don't save yet
				}
			};
			
			$picker.on('input', () => updateFromPickerOrHex($picker.val(), true));
			$hex.on('input', () => updateFromPickerOrHex('#' + $hex.val(), false));
			
			$opacitySlider.on('input', () => {
				if (!this.currentLayer || this.currentLayer.locked) return;
				const opacity = parseFloat($opacitySlider.val());
				$opacityValue.text(`${Math.round(opacity * 100)}%`);
				
				let tiny = tinycolor($picker.val()); // Get current color
				if (tiny.isValid()) {
					const newRgba = tiny.setAlpha(opacity).toRgbString();
					
					// Decide which property to update based on prefix
					if (layerPropPrefix === 'fill') {
						updateLayer('fill', newRgba, false, true); // Debounce save
					} else if (layerPropPrefix === 'stroke') {
						updateLayer('stroke', newRgba, false, true); // Debounce save
					} else if (layerPropPrefix === 'shadowColor') {
						updateLayer('shadowColor', newRgba, false, true); // Debounce save
					} else if (layerPropPrefix === 'backgroundColor') {
						// For background, update the separate opacity property
						updateLayer('backgroundColor', tiny.toHexString(), false, false); // Keep hex color
						updateLayer('backgroundOpacity', opacity, false, true); // Update opacity, debounce save
					}
					
					// Handle separate opacity properties if they exist (Redundant with above?)
					// Maybe just keep the logic within the 'backgroundColor' condition
					// const opacityProp = layerPropPrefix + 'Opacity';
					// if (this.currentLayer.hasOwnProperty(opacityProp)) {
					//     updateLayer(opacityProp, opacity, false, true); // Debounce save
					// }
				}
			});
			
			// Save history on final change
			$picker.on('change', () => this.historyManager.saveState());
			$hex.on('change', () => this.historyManager.saveState());
			$opacitySlider.on('change', () => this.historyManager.saveState());
		};
		
		// Bind color groups
		bindColorInputGroup('fill', 'fill');
		bindColorInputGroup('border', 'stroke');
		bindColorInputGroup('shading', 'shadowColor');
		bindColorInputGroup('background', 'backgroundColor');
		
		// --- Generic Range Slider + Number Input ---
		const bindRangeAndNumber =(rangeId, displayId, layerProp, min, max, step, unit = '', saveDebounced = true, isFilter = false, skipUpdateLayer = false) => {
			const $range = $(`#${rangeId}`);
			const $display = $(`#${displayId}`);
			const self = this;
			
			const updateDisplayAndLayer = () => {
				const val = parseFloat($range.val());
				if (isNaN(val)) return;
				
				// Format value for display (e.g., handle decimals for blur)
				const displayValue = (step < 1) ? val.toFixed(1) : Math.round(val);
				$display.text(`${displayValue}${unit}`);
				
				// Use the generic updateLayer function which handles filters
				// Pass the raw value (not rounded/formatted)
				if (!skipUpdateLayer) {
					updateLayer(layerProp, val, false, saveDebounced);
				}
			};
			
			$range.on('input', updateDisplayAndLayer);
			
			// Save history on final change
			$range.on('change', () => {
				// Ensure final value is applied before saving
				const finalVal = parseFloat($range.val());
				if (!isNaN(finalVal)) {
					updateLayer(layerProp, finalVal, true); // Save immediately
				} else {
					self.historyManager.saveState();
				}
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
		
		// Text Style Buttons
		this.$panel.find('#inspector-bold-btn').on('click', () => this.toggleStyle('fontWeight', 'bold', 'normal'));
		this.$panel.find('#inspector-italic-btn').on('click', () => this.toggleStyle('fontStyle', 'italic', 'normal'));
		this.$panel.find('#inspector-underline-btn').on('click', () => this.toggleStyle('textDecoration', 'underline', 'none'));
		
		// Text Alignment (within text box)
		this.$panel.find('#inspector-text-align button').on('click', (e) => {
			const align = $(e.currentTarget).data('align');
			updateLayer('align', align, true);
			this.$panel.find('#inspector-text-align button').removeClass('active');
			$(e.currentTarget).addClass('active');
		});
		
		// --- Shading ---
		this.$panel.find('#inspector-shading-enabled').on('change', (e) => {
			// ... (shading enabled code remains the same)
			const isChecked = $(e.target).prop('checked');
			updateLayer('shadowEnabled', isChecked, true);
			$(e.target).closest('.inspector-section').find('.section-content').toggle(isChecked);
		});
		
		bindRangeAndNumber('inspector-shading-blur', 'inspector-shading-blur-value', 'shadowBlur', 0, 100, 1);

		const updateShadowOffset = () => {
			const offset = parseFloat($('#inspector-shading-offset').val());
			const angleRad = parseFloat($('#inspector-shading-angle').val()) * Math.PI / 180;
			const offsetX = Math.round(offset * Math.cos(angleRad));
			const offsetY = Math.round(offset * Math.sin(angleRad));
			updateLayer('shadowOffsetX', offsetX, false, false);
			updateLayer('shadowOffsetY', offsetY, false, true);
		};
		
		bindRangeAndNumber('inspector-shading-offset', 'inspector-shading-offset-value', 'shadowOffsetInternal', 0, 100, 1, '', false, false, true);

		bindRangeAndNumber('inspector-shading-angle', 'inspector-shading-angle-value', 'shadowAngleInternal', -180, 180, 1, '', false, false, true);
		
		$('#inspector-shading-offset, #inspector-shading-angle').on('input', updateShadowOffset);
		$('#inspector-shading-offset, #inspector-shading-angle').on('change', () => this.historyManager.saveState());
		
		// --- Background (Text Only) ---
		this.$panel.find('#inspector-background-enabled').on('change', (e) => {
			// ... (background enabled code remains the same)
			const isChecked = $(e.target).prop('checked');
			updateLayer('backgroundEnabled', isChecked, true);
			$(e.target).closest('.inspector-section').find('.section-content').toggle(isChecked);
		});
		
		bindRangeAndNumber('inspector-background-padding', 'inspector-background-padding-value', 'backgroundPadding', 0, 200, 1);

		bindRangeAndNumber('inspector-background-radius', 'inspector-background-radius-value', 'backgroundCornerRadius', 0, 100, 0.5);
		
		const $textContentArea = this.$panel.find('#inspector-text-content');
		
		$textContentArea.on('input', () => {
			if (this.currentLayer && this.currentLayer.type === 'text' && !this.currentLayer.locked) {
				const newContent = $textContentArea.val();
				// Update layer data immediately (live update)
				// Don't save history on every keystroke, let 'change' handle it
				this.layerManager.updateLayerData(this.currentLayer.id, { content: newContent });
				
				// Clear existing timeout if user is still typing
				clearTimeout(this.textareaChangeTimeout);
				// Set a timeout to save history after user stops typing
				this.textareaChangeTimeout = setTimeout(() => {
					console.log("Saving history after textarea pause...");
					this.historyManager.saveState();
				}, 750); // Save 750ms after the last input
			}
		});
		
		
		// --- Layer Alignment Buttons
		this.$panel.find('#inspector-alignment button[data-align-layer]').on('click', (e) => {
			// 1. Get the ID of the currently selected layer from the inspector's state
			const currentLayerId = this.currentLayer?.id;
			const alignType = $(e.currentTarget).data('alignLayer');
			
			// 2. Check if LayerManager and an ID exist
			if (!currentLayerId || !this.layerManager) {
				console.log("Alignment: No layer selected ID or LayerManager missing.");
				return;
			}
			
			// --- FETCH LATEST DATA ---
			// 3. Get the most up-to-date layer data directly from LayerManager
			const layer = this.layerManager.getLayerById(currentLayerId);
			console.log("Alignment: Layer fetched for alignment:", layer);
			// --- END FETCH ---
			
			// 4. Check if the layer exists and is not locked
			if (!layer || layer.locked) {
				console.log("Alignment: Layer not found or is locked.");
				return;
			}
			
			// 5. Check if CanvasManager is available
			if (!this.canvasManager) {
				console.error("Alignment: CanvasManager not available in InspectorPanel.");
				return;
			}
			
			// 6. Get canvas dimensions
			const canvasWidth = this.canvasManager.currentCanvasWidth;
			const canvasHeight = this.canvasManager.currentCanvasHeight;
			
			// 7. Get layer dimensions (handle 'auto' using rendered size)
			const $element = $('#' + layer.id);
			if (!$element.length) {
				console.error("Alignment: Layer element not found for ID:", layer.id);
				return;
			}
			
			const zoom = this.canvasManager.currentZoom;
			let layerWidth = layer.width;
			let layerHeight = layer.height;
			
			if (layerWidth === 'auto' || typeof layerWidth !== 'number') {
				layerWidth = $element.outerWidth() / zoom;
			}
			if (layerHeight === 'auto' || typeof layerHeight !== 'number') {
				layerHeight = $element.outerHeight() / zoom;
			}
			
			layerWidth = parseFloat(layerWidth);
			layerHeight = parseFloat(layerHeight);
			if (isNaN(layerWidth) || isNaN(layerHeight) || layerWidth <= 0 || layerHeight <= 0) {
				console.error("Alignment: Invalid layer dimensions for calculation.", layer);
				return;
			}
			
			// 8. Calculate new X/Y (using the fresh 'layer' data)
			let newX = parseFloat(layer.x);
			let newY = parseFloat(layer.y);
			
			switch (alignType) {
				case 'left': newX = 0; break;
				case 'h-center': newX = (canvasWidth / 2) - (layerWidth / 2); break;
				case 'right': newX = canvasWidth - layerWidth; break;
				case 'top': newY = 0; break;
				case 'v-center': newY = (canvasHeight / 2) - (layerHeight / 2); break;
				case 'bottom': newY = canvasHeight - layerHeight; break;
				default: console.warn("Alignment: Unknown alignment type:", alignType); return;
			}
			
			newX = Math.round(newX);
			newY = Math.round(newY);
			
			// 9. Update layer data only if position actually changed
			if (newX !== Math.round(parseFloat(layer.x)) || newY !== Math.round(parseFloat(layer.y))) {
				console.log(`Alignment: Aligning ${layer.id} to ${alignType}. New pos: (${newX}, ${newY})`);
				// Use LayerManager to update, which will also update the element's CSS
				this.layerManager.updateLayerData(layer.id, { x: newX, y: newY });
				this.historyManager.saveState(); // Save the change
				
				// --- OPTIONAL: Re-populate inspector AFTER update to reflect new state ---
				// This ensures subsequent clicks use the just-set position
				// Fetch the *very latest* data after the update and repopulate
				const finalUpdatedLayer = this.layerManager.getLayerById(layer.id);
				if (finalUpdatedLayer) {
					this.populate(finalUpdatedLayer);
				}
				// --- END OPTIONAL ---
				
			} else {
				console.log(`Alignment: Layer ${layer.id} already aligned to ${alignType}.`);
			}
		});
		// --- Layer Alignment Buttons
		
		bindRangeAndNumber('inspector-filter-brightness', 'inspector-filter-brightness-value', 'filters.brightness', 0, 200, 1, '', true, true);
		bindRangeAndNumber('inspector-filter-contrast', 'inspector-filter-contrast-value', 'filters.contrast', 0, 200, 1, '', true, true);
		bindRangeAndNumber('inspector-filter-saturation', 'inspector-filter-saturation-value', 'filters.saturation', 0, 200, 1, '', true, true);
		bindRangeAndNumber('inspector-filter-grayscale', 'inspector-filter-grayscale-value', 'filters.grayscale', 0, 100, 1, '', true, true);
		bindRangeAndNumber('inspector-filter-sepia', 'inspector-filter-sepia-value', 'filters.sepia', 0, 100, 1, '', true, true);
		bindRangeAndNumber('inspector-filter-hue-rotate', 'inspector-filter-hue-rotate-value', 'filters.hueRotate', 0, 360, 1, '', true, true);
		bindRangeAndNumber('inspector-filter-blur', 'inspector-filter-blur-value', 'filters.blur', 0, 20, 0.1, '', true, true);
		
		// --- Bind Blend Mode Control ---
		this.$panel.find('#inspector-blend-mode').on('change', (e) => {
			const blendMode = $(e.target).val();
			updateLayer('blendMode', blendMode, true); // Save immediately
		});
		
		
	} // End bindEvents
	
	toggleStyle(property, activeValue, inactiveValue) {
		// ... (toggleStyle code remains the same)
		if (this.currentLayer && this.currentLayer.type === 'text' && !this.currentLayer.locked) {
			const currentValue = this.currentLayer[property];
			const newValue = (currentValue === activeValue) ? inactiveValue : activeValue;
			this._updateLayer(property, newValue, true); // Save immediately for toggles
		}
	}
	
	_updateLayer(property, value, saveNow = false) {
		// ... (_updateLayer code remains the same)
		if (this.currentLayer && !this.currentLayer.locked) {
			// Store previous value to compare
			const previousValue = this.currentLayer[property];
			this.layerManager.updateLayerData(this.currentLayer.id, { [property]: value });
			
			if (saveNow) {
				this.historyManager.saveState();
			}
			// Re-populate only if the value actually changed to avoid potential issues/loops
			// And avoid re-populating if the change came FROM populate itself (difficult to track perfectly here)
			// A simple check for value change is usually sufficient
			const updatedLayer = this.layerManager.getLayerById(this.currentLayer.id);
			if(updatedLayer && updatedLayer[property] !== previousValue) {
				// Delay populate slightly to prevent potential issues with rapid updates (e.g. color picker)
				// setTimeout(() => this.populate(updatedLayer), 50);
				// Or just populate directly - test which works best
				this.populate(updatedLayer);
			}
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
	
	_populateColorInputGroup(groupId, colorValue, opacityValue = 1) {
		const $picker = $(`#inspector-${groupId}-color`);
		const $hex = $(`#inspector-${groupId}-hex`);
		const $opacitySlider = $(`#inspector-${groupId}-opacity`);
		const $opacityValue = $(`#inspector-${groupId}-opacity-value`);
		
		let tiny = tinycolor(colorValue || '#000000'); // Default black if invalid/missing
		if (!tiny.isValid()) {
			tiny = tinycolor('#000000');
		}
		
		let alpha = opacityValue; // Use provided opacity value first
		
		// If color string itself has alpha, use that instead (rgba/hsla)
		if (colorValue && typeof colorValue === 'string' && (colorValue.startsWith('rgba') || colorValue.startsWith('hsla'))) {
			alpha = tiny.getAlpha();
		} else if (groupId === 'background') { // Special case for background, use backgroundOpacity
			alpha = this.currentLayer?.backgroundOpacity ?? 1;
		}
		
		
		alpha = isNaN(alpha) ? 1 : Math.max(0, Math.min(1, alpha)); // Clamp opacity
		
		$picker.val(tiny.toHexString()); // Set color picker (ignores alpha)
		$hex.val(tiny.toHexString().substring(1).toUpperCase()); // Set hex input (no #)
		$opacitySlider.val(alpha);
		$opacityValue.text(`${Math.round(alpha * 100)}%`);
	}
	
	
	_populateRangeAndNumber(rangeId, numberId, value, fallback = 0) {
		const numValue = parseFloat(value);
		const finalValue = isNaN(numValue) ? fallback : numValue;
		// Check if elements exist before trying to set value
		const $range = $(`#${rangeId}`);
		const $number = $(`#${numberId}`);
		if ($range.length) $range.val(finalValue);
		if ($number.length) $number.val(finalValue);
	}
	
	populate(layerData) {
		if (!layerData) {
			this.hide();
			return;
		}
		this.currentLayer = layerData; // Update internal reference
		const isLocked = layerData.locked;
		const isText = layerData.type === 'text';
		const isImage = layerData.type === 'image'; // Added for clarity
		
		// --- Enable/Disable Panel Sections ---
		this.$panel.find('#inspector-text').toggle(isText);
		this.$panel.find('#inspector-text-shading').toggle(isText);
		this.$panel.find('#inspector-text-background').toggle(isText);
		this.$panel.find('#inspector-color').toggle(isText);
		this.$panel.find('#inspector-border').toggle(isText);
		
		this.$panel.find('#inspector-image-filters').toggle(isImage);
		this.$panel.find('#inspector-image-blend-mode').toggle(isImage);
		
		// Generic sections always visible (or based on layer type if needed later)
		this.$panel.find('#inspector-alignment').show();
		this.$panel.find('#inspector-layer').show();
		
		// Disable all controls if locked
		this.$panel.find('input, select, button, textarea').prop('disabled', isLocked);
		this.$panel.find('#inspector-font-family').next('.fp-button').prop('disabled', isLocked);
		
		// Re-enable alignment buttons if not locked
		if (!isLocked) {
			this.$panel.find('#inspector-alignment button').prop('disabled', false);
		}
		
		
		// --- Populate Common Controls ---
		const opacity = layerData.opacity ?? 1;
		$('#inspector-opacity').val(opacity);
		$('#inspector-opacity-value').text(`${Math.round(opacity * 100)}%`);
		
		// --- Populate Text Controls (if Text Layer) ---
		if (isText) {
			$('#inspector-text-content').val(layerData.content || '');
			
			// Fill Color (uses layer 'fill' property)
			this._populateColorInputGroup('fill', layerData.fill, 1); // Opacity included in fill RGBA
			
			// Border (Stroke) Color & Weight
			const strokeWidth = parseFloat(layerData.strokeWidth) || 0;
			this._populateColorInputGroup('border', layerData.stroke, 1); // Opacity included in stroke RGBA
			this._populateRangeAndNumber('inspector-border-weight', 'inspector-border-weight-value', strokeWidth);
			
			// Font
			const font = layerData.fontFamily || 'Arial';
			$('#inspector-font-family').val(font);
			try { $('#inspector-font-family').data('fontpicker')?.set(font); } catch(e) { console.warn("Couldn't update fontpicker selection visually", e)}
			this._populateRangeAndNumber('inspector-font-size', 'inspector-font-size', layerData.fontSize, 24);
			this._populateRangeAndNumber('inspector-letter-spacing', 'inspector-letter-spacing', layerData.letterSpacing, 0);
			this._populateRangeAndNumber('inspector-line-height', 'inspector-line-height', layerData.lineHeight, 1.3);
			
			// Font Styles
			$('#inspector-bold-btn').toggleClass('active', layerData.fontWeight === 'bold');
			$('#inspector-italic-btn').toggleClass('active', layerData.fontStyle === 'italic');
			$('#inspector-underline-btn').toggleClass('active', layerData.textDecoration === 'underline');
			
			// Text Align (internal)
			$('#inspector-text-align button').removeClass('active');
			$(`#inspector-text-align button[data-align="${layerData.align || 'left'}"]`).addClass('active');
			
			// Shading / Shadow
			const shadowEnabled = !!layerData.shadowEnabled;
			$('#inspector-shading-enabled').prop('checked', shadowEnabled);
			this.$panel.find('#inspector-text-shading .section-content').toggle(shadowEnabled);
			if (shadowEnabled) {
				// Shading color includes opacity in its RGBA value
				this._populateColorInputGroup('shading', layerData.shadowColor, 1);
				this._populateRangeAndNumber('inspector-shading-blur', 'inspector-shading-blur-value', layerData.shadowBlur, 0);
				
				// Calculate Offset/Angle from X/Y for sliders
				const shadowX = parseFloat(layerData.shadowOffsetX) || 0;
				const shadowY = parseFloat(layerData.shadowOffsetY) || 0;
				const shadowOffset = Math.sqrt(shadowX * shadowX + shadowY * shadowY);
				let shadowAngle = Math.atan2(shadowY, shadowX) * 180 / Math.PI;
				shadowAngle = Math.round(shadowAngle);
				this._populateRangeAndNumber('inspector-shading-offset', 'inspector-shading-offset-value', shadowOffset);
				this._populateRangeAndNumber('inspector-shading-angle', 'inspector-shading-angle-value', shadowAngle);
			}
			
			// Background
			const backgroundEnabled = !!layerData.backgroundEnabled;
			$('#inspector-background-enabled').prop('checked', backgroundEnabled);
			this.$panel.find('#inspector-text-background .section-content').toggle(backgroundEnabled);
			if (backgroundEnabled) {
				// Background color group handles its own opacity slider via backgroundOpacity
				this._populateColorInputGroup('background', layerData.backgroundColor, layerData.backgroundOpacity);
				this._populateRangeAndNumber('inspector-background-padding', 'inspector-background-padding-value', layerData.backgroundPadding, 0);
				this._populateRangeAndNumber('inspector-background-radius', 'inspector-background-radius-value', layerData.backgroundCornerRadius, 0);
			}
		} else
		{
			$('#inspector-text-content').val('');
		}
		
		// --- Populate Image Controls (if Image Layer) ---
		if (isImage) {
			// Populate Filters
			const filters = layerData.filters || this.layerManager.defaultFilters; // Use defaults if missing
			this._populateRangeAndNumber('inspector-filter-brightness', 'inspector-filter-brightness-value', filters.brightness, 100);
			this._populateRangeAndNumber('inspector-filter-contrast', 'inspector-filter-contrast-value', filters.contrast, 100);
			this._populateRangeAndNumber('inspector-filter-saturation', 'inspector-filter-saturation-value', filters.saturation, 100);
			this._populateRangeAndNumber('inspector-filter-grayscale', 'inspector-filter-grayscale-value', filters.grayscale, 0);
			this._populateRangeAndNumber('inspector-filter-sepia', 'inspector-filter-sepia-value', filters.sepia, 0);
			this._populateRangeAndNumber('inspector-filter-hue-rotate', 'inspector-filter-hue-rotate-value', filters.hueRotate, 0);
			this._populateRangeAndNumber('inspector-filter-blur', 'inspector-filter-blur-value', filters.blur, 0);
			
			// Populate Blend Mode
			$('#inspector-blend-mode').val(layerData.blendMode || 'normal');
		}
		
		// Ensure locked state disables controls again after populating
		if (isLocked) {
			this.$panel.find('input, select, button, textarea').prop('disabled', true);
			this.$panel.find('#inspector-font-family').next('.fp-button').prop('disabled', true);
		}
		
	} // End populate
	
} // End class InspectorPanel
