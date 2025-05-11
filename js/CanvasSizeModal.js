// free-cover-designer/js/CanvasSizeModal.js
class CanvasSizeModal {
	constructor(canvasManager) {
		if (!canvasManager) {
			throw new Error("CanvasSizeModal requires an instance of CanvasManager.");
		}
		this.canvasManager = canvasManager;
		this.$modal = $('#canvasSizeModal');
		this.$presetError = $('#presetError');
		
		// Unit Selection
		this.$unitRadios = $('input[name="canvasUnit"]');
		this.currentUnit = 'inches'; // Default unit
		this.DPI = 300;
		
		// Preset Group Container (dynamic content)
		this.$presetRadioGroupContainer = $('#canvasSizePresetGroup'); // Container for radios
		
		// Custom Size Controls
		this.$customSizeControls = $('#customSizeControls');
		this.$customWidthInput = $('#customWidthInput');
		this.$customHeightInput = $('#customHeightInput');
		this.$customWidthUnitLabel = $('#customWidthUnit');
		this.$customHeightUnitLabel = $('#customHeightUnit');
		this.$customWidthError = $('#customWidthError');
		this.$customHeightError = $('#customHeightError');
		
		// Spine & Back Cover
		this.$addSpineAndBackContainer = $('#addSpineAndBackContainer');
		this.$addSpineAndBackCheckbox = $('#addSpineAndBackCheckbox');
		this.$spineControls = $('#spineControls');
		this.$spineInputMethodRadios = $('input[name="spineInputMethod"]');
		this.$spinePixelContainer = $('#spinePixelInputContainer');
		this.$spineWidthInput = $('#spineWidthInput');
		this.$spineWidthError = $('#spineWidthError');
		this.$spineCalculateContainer = $('#spineCalculateInputContainer');
		this.$pageCountInput = $('#pageCountInput');
		this.$pageCountError = $('#pageCountError');
		this.$paperTypeSelect = $('#paperTypeSelect');
		this.$calculatedSpineInfo = $('#calculatedSpineInfo');
		this.$spineCalculationError = $('#spineCalculationError');
		
		this.$applyBtn = $('#setCanvasSizeBtn');
		this.$previewContainer = $('#canvasPreviewContainer');
		this.$previewArea = $('#canvasPreviewArea');
		this.$previewFront = $('#previewFront');
		this.$previewSpine = $('#previewSpine');
		this.$previewBack = $('#previewBack');
		
		this.modalInstance = null;
		this.pageNumberData = [];
		
		this.customPresetIdentifier = "custom"; // Special value for custom preset radio
		
		// Define presets data
		this._initializePresets();
		
		this._loadPageNumberData();
		this._bindEvents();
	}
	
	_initializePresets() {
		this.commonPresets = [
			{ value: "1600x2560", label: "Kindle (1600 x 2560 px)", base_size: "kindle", allowSpine: false, type: "common" },
			{ value: "3000x3000", label: "Square (3000 x 3000 px)", base_size: "square", allowSpine: false, type: "common" }
		];
		
		this.inchPresets = [
			{ value: "1540x2475", label: "5.00\" x 8.00\" (1540x2475 px)", base_size: "5.00x8.00", allowSpine: true, type: "inch" },
			{ value: "1615x2475", label: "5.25\" x 8.00\" (1615x2475 px)", base_size: "5.25x8.00", allowSpine: true, type: "inch" },
			{ value: "1690x2625", label: "5.50\" x 8.50\" (1690x2625 px)", base_size: "5.50x8.50", allowSpine: true, type: "inch" },
			{ value: "1840x2775", label: "6.00\" x 9.00\" (1840x2775 px)", base_size: "6.00x9.00", allowSpine: true, type: "inch" },
			{ value: "1882x2838", label: "6.14\" x 9.21\" (1882x2838 px)", base_size: "6.14x9.21", allowSpine: true, type: "inch" },
			{ value: "2048x2958", label: "6.69\" x 9.61\" (2048x2958 px)", base_size: "6.69x9.61", allowSpine: true, type: "inch" },
		];
		
		this.mmPresets = [
			// value is "PixelWidthxPixelHeight", label includes mm dimensions
			// A5: 148mm x 210mm -> (148/25.4*300) x (210/25.4*300) = 1748 x 2480 px
			{ value: `${Math.round(148 / 25.4 * this.DPI)}x${Math.round(210 / 25.4 * this.DPI)}`, label: "A5 (148 x 210 mm)", base_size: "A5_mm", allowSpine: true, type: "mm", actualUnit: "mm", actualDims: { w: 148, h: 210 } },
			// A6: 105mm x 74mm -> (105/25.4*300) x (74/25.4*300) = 1240 x 874 px
			{ value: `${Math.round(105 / 25.4 * this.DPI)}x${Math.round(74 / 25.4 * this.DPI)}`, label: "A6 (105 x 74 mm)", base_size: "A6_mm", allowSpine: true, type: "mm", actualUnit: "mm", actualDims: { w: 105, h: 74 } },
			// A4: 210mm x 297mm -> (210/25.4*300) x (297/25.4*300) = 2480 x 3508 px
			{ value: `${Math.round(210 / 25.4 * this.DPI)}x${Math.round(297 / 25.4 * this.DPI)}`, label: "A4 (210 x 297 mm)", base_size: "A4_mm", allowSpine: true, type: "mm", actualUnit: "mm", actualDims: { w: 210, h: 297 } },
			// B5: 176mm x 250mm -> (176/25.4*300) x (250/25.4*300) = 2079 x 2953 px
			{ value: `${Math.round(176 / 25.4 * this.DPI)}x${Math.round(250 / 25.4 * this.DPI)}`, label: "B5 (176 x 250 mm)", base_size: "B5_mm", allowSpine: true, type: "mm", actualUnit: "mm", actualDims: { w: 176, h: 250 } },
			// B6: 125mm x 176mm -> (125/25.4*300) x (176/25.4*300) = 1476 x 2079 px
			{ value: `${Math.round(125 / 25.4 * this.DPI)}x${Math.round(176 / 25.4 * this.DPI)}`, label: "B6 (125 x 176 mm)", base_size: "B6_mm", allowSpine: true, type: "mm", actualUnit: "mm", actualDims: { w: 125, h: 176 } },
			// Trade PB: 127mm x 203mm -> (127/25.4*300) x (203/25.4*300) = 1500 x 2398 px
			{ value: `${Math.round(127 / 25.4 * this.DPI)}x${Math.round(203 / 25.4 * this.DPI)}`, label: "Trade PB (127 x 203 mm)", base_size: "Trade_mm", allowSpine: true, type: "mm", actualUnit: "mm", actualDims: { w: 127, h: 203 } },
			// Mass Market PB: 105mm x 171mm -> (105/25.4*300) x (171/25.4*300) = 1240 x 2020 px
			{ value: `${Math.round(105 / 25.4 * this.DPI)}x${Math.round(171 / 25.4 * this.DPI)}`, label: "Mass Market PB (105 x 171 mm)", base_size: "MassMarket_mm", allowSpine: true, type: "mm", actualUnit: "mm", actualDims: { w: 105, h: 171 } }
		];
	}
	
	
	_loadPageNumberData() {
		try {
			const dataElement = document.getElementById('pageNumberData');
			if (dataElement && dataElement.textContent) {
				this.pageNumberData = JSON.parse(dataElement.textContent);
				console.log("Page number data loaded:", this.pageNumberData.length, "entries");
			} else {
				console.warn("Page number data element not found or empty.");
				this.pageNumberData = [];
			}
		} catch (error) {
			console.error("Error parsing page number data:", error);
			this.pageNumberData = [];
		}
	}
	
	_populatePresetRadios(selectedPresetValueToKeep = null) {
		this.$presetRadioGroupContainer.empty();
		let presetsToShow = [...this.commonPresets]; // Start with common presets
		
		if (this.currentUnit === 'inches') {
			presetsToShow.push(...this.inchPresets);
		} else if (this.currentUnit === 'mm') {
			presetsToShow.push(...this.mmPresets);
		}
		
		// Add Custom option
		presetsToShow.push({ value: this.customPresetIdentifier, label: "Custom Size", allowSpine: true, type: "custom" });
		
		presetsToShow.forEach((preset, index) => {
			const id = `preset_${preset.value.replace(/[^a-zA-Z0-9]/g, '')}_${index}`;
			const $radioDiv = $('<div class="form-check form-check-sm mb-1"></div>');
			const $radioInput = $(`<input class="form-check-input" type="radio" name="canvasSizePreset" id="${id}" value="${preset.value}">`)
				.data('presetData', preset) // Store full preset object
				.data('base-size', preset.base_size || ''); // For spine calculation
			
			if (selectedPresetValueToKeep && preset.value === selectedPresetValueToKeep) {
				$radioInput.prop('checked', true);
			}
			
			const $radioLabel = $(`<label class="form-check-label" for="${id}">${preset.label}</label>`);
			$radioDiv.append($radioInput).append($radioLabel);
			this.$presetRadioGroupContainer.append($radioDiv);
		});
		
		// If no preset was pre-selected, and there are presets, select the first one
		if (!selectedPresetValueToKeep && presetsToShow.length > 0) {
			this.$presetRadioGroupContainer.find('input[name="canvasSizePreset"]').first().prop('checked', true);
		}
		this._handlePresetChange(); // Trigger initial state update based on (newly) selected preset
	}
	
	
	_bindEvents() {
		this.$unitRadios.on('change', () => {
			this.currentUnit = this.$unitRadios.filter(':checked').val();
			const currentSelectedPresetRadio = this.$presetRadioGroupContainer.find('input[name="canvasSizePreset"]:checked');
			let valueToKeep = null;
			if (currentSelectedPresetRadio.length) {
				valueToKeep = currentSelectedPresetRadio.val();
				// If switching units and the current selection is unit-specific, it might disappear.
				// For simplicity, we'll try to keep it if it exists in the new list, otherwise the first will be selected.
				// Or, if it's "custom", keep "custom" selected.
				const presetData = currentSelectedPresetRadio.data('presetData');
				if (presetData && presetData.type !== 'common' && presetData.type !== this.currentUnit && presetData.value !== this.customPresetIdentifier) {
					// If current selection is e.g. an "inch" preset and we switch to "mm", don't try to keep it.
					// valueToKeep = null; // Let _populatePresetRadios select the first default
				}
			}
			this._populatePresetRadios(valueToKeep); // This will also call _handlePresetChange
			this._updatePreview();
		});
		
		// Delegated event for dynamically created preset radios
		this.$presetRadioGroupContainer.on('change', 'input[name="canvasSizePreset"]', () => {
			this.$presetError.hide();
			this._handlePresetChange();
			this._updatePreview();
		});
		
		this.$customWidthInput.on('input', () => { this.$customWidthError.hide(); this._updatePreview(); });
		this.$customHeightInput.on('input', () => { this.$customHeightError.hide(); this._updatePreview(); });
		
		
		this.$addSpineAndBackCheckbox.on('change', () => {
			const isChecked = this.$addSpineAndBackCheckbox.is(':checked');
			this.$spineControls.toggle(isChecked);
			if (isChecked) {
				this._toggleSpineInputMethod();
			}
			this._updatePreview();
		});
		
		this.$spineInputMethodRadios.on('change', () => {
			this._toggleSpineInputMethod();
			this._updatePreview();
		});
		
		let pixelDebounceTimer;
		this.$spineWidthInput.on('input', () => {
			this.$spineWidthError.hide();
			clearTimeout(pixelDebounceTimer);
			pixelDebounceTimer = setTimeout(() => { this._updatePreview(); }, 250);
		});
		
		let calcDebounceTimer;
		const calcUpdateHandler = () => {
			this.$pageCountError.hide();
			this.$spineCalculationError.hide();
			clearTimeout(calcDebounceTimer);
			calcDebounceTimer = setTimeout(() => { this._updatePreview(); }, 300);
		};
		this.$pageCountInput.on('input', calcUpdateHandler);
		this.$paperTypeSelect.on('change', calcUpdateHandler);
		
		this.$applyBtn.on('click', () => {
			this._handleSetSize();
		});
		
		this.$modal.on('hidden.bs.modal', () => {
			this._resetForm();
		});
		
		this.$modal.on('shown.bs.modal', () => {
			// Initial population and state update
			// this._populatePresetRadios(); // Done by show() or resetForm()
			// this._handlePresetChange(); // Called by _populatePresetRadios
			this._toggleSpineInputMethod(); // Ensure correct spine input visibility
			setTimeout(() => this._updatePreview(), 50); // Delay preview slightly
		});
	}
	
	_handlePresetChange() {
		const $selectedPresetRadio = this.$presetRadioGroupContainer.find('input[name="canvasSizePreset"]:checked');
		if (!$selectedPresetRadio.length) {
			this.$customSizeControls.hide();
			this.$addSpineAndBackContainer.hide();
			this.$addSpineAndBackCheckbox.prop('checked', false).trigger('change');
			return;
		}
		
		const presetData = $selectedPresetRadio.data('presetData');
		
		if (presetData && presetData.value === this.customPresetIdentifier) {
			this.$customSizeControls.show();
			const unitLabel = this.currentUnit === 'mm' ? 'mm' : 'inches';
			this.$customWidthUnitLabel.text(unitLabel);
			this.$customHeightUnitLabel.text(unitLabel);
			// Sensible defaults for custom input based on unit
			if (this.currentUnit === 'mm') {
				this.$customWidthInput.val(this.$customWidthInput.val() || 150); // Default to 150mm if empty
				this.$customHeightInput.val(this.$customHeightInput.val() || 210); // Default to 210mm if empty
			} else {
				this.$customWidthInput.val(this.$customWidthInput.val() || 6); // Default to 6in if empty
				this.$customHeightInput.val(this.$customHeightInput.val() || 9);   // Default to 9in if empty
			}
		} else {
			this.$customSizeControls.hide();
		}
		
		if (presetData && presetData.allowSpine) {
			this.$addSpineAndBackContainer.show();
			// Do not automatically check/uncheck, preserve user's choice unless disallowed
		} else {
			this.$addSpineAndBackContainer.hide();
			this.$addSpineAndBackCheckbox.prop('checked', false); // Uncheck and hide spine controls
			this.$spineControls.hide();
		}
		// If spine checkbox was visible and is now hidden, ensure its controls are also hidden
		if (!this.$addSpineAndBackContainer.is(':visible')) {
			this.$spineControls.hide();
		} else {
			// If it became visible, and is checked, show spine controls
			if (this.$addSpineAndBackCheckbox.is(':checked')) {
				this.$spineControls.show();
				this._toggleSpineInputMethod();
			} else {
				this.$spineControls.hide();
			}
		}
	}
	
	
	_toggleSpineInputMethod() {
		const method = this.$spineInputMethodRadios.filter(':checked').val();
		const spineEnabledByCheckbox = this.$addSpineAndBackCheckbox.is(':checked');
		const spineAllowedByPreset = this.$addSpineAndBackContainer.is(':visible');
		
		
		if (spineAllowedByPreset && spineEnabledByCheckbox) {
			this.$spineControls.show(); // Ensure parent is visible
			if (method === 'calculate') {
				this.$spinePixelContainer.hide();
				this.$spineCalculateContainer.show();
			} else {
				this.$spinePixelContainer.show();
				this.$spineCalculateContainer.hide();
			}
		} else {
			this.$spineControls.hide(); // Hide all spine method inputs
			this.$spinePixelContainer.hide();
			this.$spineCalculateContainer.hide();
		}
		
		this.$spineWidthError.hide();
		this.$pageCountError.hide();
		this.$spineCalculationError.hide();
		this.$calculatedSpineInfo.hide();
	}
	
	_calculateSpineWidthFromPages() {
		const $selectedPresetRadio = this.$presetRadioGroupContainer.find('input[name="canvasSizePreset"]:checked');
		if (!$selectedPresetRadio.length) return { width: null, error: "No preset selected." };
		
		// For spine calculation, we need the 'base_size' which is tied to how page-numbers.json is structured.
		// This might primarily work for original inch-based presets or if page-numbers.json is extended.
		const baseSize = $selectedPresetRadio.data('base-size');
		const presetValue = $selectedPresetRadio.val(); // This is PixelWidthxPixelHeight or "custom"
		
		let frontCoverWidthPx;
		const dimensions = this._getCanvasDimensions(); // Gets dimensions in pixels
		if (!dimensions) return { width: null, error: "Could not determine front cover width." };
		frontCoverWidthPx = dimensions.frontWidth;
		
		const pageCount = parseInt(this.$pageCountInput.val(), 10);
		const paperType = this.$paperTypeSelect.val();
		
		if (isNaN(pageCount) || pageCount <= 0) {
			return { width: null, error: "Invalid page count." };
		}
		if (!baseSize || !paperType || isNaN(frontCoverWidthPx)) {
			return { width: null, error: "Invalid preset, paper type, or front width for calculation." };
		}
		if (!this.pageNumberData || this.pageNumberData.length === 0) {
			return { width: null, error: "Page number data not available." };
		}
		
		const sortedMatches = this.pageNumberData
			.filter(entry => entry.size === baseSize && entry.paper_type === paperType && entry.pages >= pageCount)
			.sort((a, b) => a.pages - b.pages);
		
		const match = sortedMatches.length > 0 ? sortedMatches[0] : null;
		
		if (match) {
			const totalWidthFromData = match.width; // This is total width (back + spine + front) in pixels from JSON
			// The frontCoverWidthPx we have is for one panel.
			// The data in page-numbers.json implies totalWidth = frontPx + spinePx + backPx (where frontPx=backPx)
			const calculatedSpineWidth = totalWidthFromData - (2 * frontCoverWidthPx);
			
			if (calculatedSpineWidth > 0) {
				this.$calculatedSpineInfo
					.text(`Using data for ${match.pages} pages. Spine: ${calculatedSpineWidth}px`)
					.show();
				return { width: calculatedSpineWidth, error: null };
			} else {
				console.warn("Calculation resulted in non-positive spine width:", { match, frontCoverWidthPx, calculatedSpineWidth });
				return { width: null, error: `Calculation error (Result: ${calculatedSpineWidth}px). Check preset/page count.` };
			}
		} else {
			return { width: null, error: "No data found for this size, paper type, and page count." };
		}
	}
	
	_getSpineWidth() { // Returns spine width in pixels or null for error
		if (!this.$addSpineAndBackCheckbox.is(':checked') || !this.$addSpineAndBackContainer.is(':visible')) {
			return 0;
		}
		
		const method = this.$spineInputMethodRadios.filter(':checked').val();
		if (method === 'calculate') {
			const result = this._calculateSpineWidthFromPages();
			if (result.error) {
				this.$spineCalculationError.text(result.error).show();
				this.$calculatedSpineInfo.hide();
				return null;
			} else {
				this.$spineCalculationError.hide();
				return result.width;
			}
		} else { // 'pixels' method
			const spineWidth = parseInt(this.$spineWidthInput.val(), 10);
			if (isNaN(spineWidth) || spineWidth <= 0) {
				this.$spineWidthError.show();
				return null;
			} else {
				this.$spineWidthError.hide();
				return spineWidth;
			}
		}
	}
	
	_getCanvasDimensions() { // Returns { frontWidth, finalHeight } in pixels, or null if invalid
		const $selectedPresetRadio = this.$presetRadioGroupContainer.find('input[name="canvasSizePreset"]:checked');
		if (!$selectedPresetRadio.length) {
			this.$presetError.text("Please select a preset.").show();
			return null;
		}
		
		const presetValue = $selectedPresetRadio.val();
		const presetData = $selectedPresetRadio.data('presetData');
		
		let frontWidthPx, finalHeightPx;
		
		if (presetValue === this.customPresetIdentifier) {
			let customWidth = parseFloat(this.$customWidthInput.val());
			let customHeight = parseFloat(this.$customHeightInput.val());
			
			if (isNaN(customWidth) || customWidth <= 0) {
				this.$customWidthError.show(); return null;
			} else { this.$customWidthError.hide(); }
			if (isNaN(customHeight) || customHeight <= 0) {
				this.$customHeightError.show(); return null;
			} else { this.$customHeightError.hide(); }
			
			if (this.currentUnit === 'mm') {
				frontWidthPx = Math.round((customWidth / 25.4) * this.DPI);
				finalHeightPx = Math.round((customHeight / 25.4) * this.DPI);
			} else { // inches
				frontWidthPx = Math.round(customWidth * this.DPI);
				finalHeightPx = Math.round(customHeight * this.DPI);
			}
		} else if (presetData && presetData.value) { // Standard preset
			const parts = presetData.value.split('x');
			if (parts.length === 2) {
				frontWidthPx = parseInt(parts[0], 10);
				finalHeightPx = parseInt(parts[1], 10);
				if (isNaN(frontWidthPx) || isNaN(finalHeightPx)) {
					this.$presetError.text("Invalid preset dimension format.").show(); return null;
				}
			} else {
				this.$presetError.text("Invalid preset value.").show(); return null;
			}
		} else {
			this.$presetError.text("Could not determine preset data.").show(); return null;
		}
		return { frontWidth: frontWidthPx, height: finalHeightPx };
	}
	
	
	_validateInputs() {
		let isValid = true;
		this.$presetError.hide();
		this.$customWidthError.hide();
		this.$customHeightError.hide();
		
		const dimensions = this._getCanvasDimensions(); // This also performs some validation
		if (!dimensions) {
			isValid = false; // Error messages shown by _getCanvasDimensions
		}
		
		const isSpineAndBackChecked = this.$addSpineAndBackCheckbox.is(':checked');
		const isSpineAllowed = this.$addSpineAndBackContainer.is(':visible');
		
		if (isSpineAllowed && isSpineAndBackChecked) {
			const spineMethod = this.$spineInputMethodRadios.filter(':checked').val();
			if (spineMethod === 'pixels') {
				const spineWidth = parseInt(this.$spineWidthInput.val(), 10);
				if (isNaN(spineWidth) || spineWidth <= 0) {
					this.$spineWidthError.show();
					this.$spineWidthInput.trigger('focus');
					isValid = false;
				} else {
					this.$spineWidthError.hide();
				}
			} else { // 'calculate' method
				const pageCount = parseInt(this.$pageCountInput.val(), 10);
				if (isNaN(pageCount) || pageCount <= 0) {
					this.$pageCountError.show();
					this.$pageCountInput.trigger('focus');
					isValid = false;
				} else {
					this.$pageCountError.hide();
					const calcResult = this._calculateSpineWidthFromPages(); // Uses _getCanvasDimensions internally
					if (calcResult.error) {
						this.$spineCalculationError.text(calcResult.error).show();
						isValid = false;
					} else {
						this.$spineCalculationError.hide();
					}
				}
			}
		} else {
			this.$spineWidthError.hide();
			this.$pageCountError.hide();
			this.$spineCalculationError.hide();
		}
		return isValid;
	}
	
	_handleSetSize() {
		if (!this._validateInputs()) {
			return;
		}
		
		const dimensions = this._getCanvasDimensions(); // Get dimensions in pixels
		if (!dimensions) {
			alert("An error occurred determining canvas dimensions.");
			return;
		}
		const { frontWidth: frontWidthPx, height: finalHeightPx } = dimensions;
		
		let totalWidthPx = frontWidthPx;
		let spineWidthPx = 0;
		let backWidthPx = 0;
		
		const addSpineAndBack = this.$addSpineAndBackCheckbox.is(':checked') && this.$addSpineAndBackContainer.is(':visible');
		
		if (addSpineAndBack) {
			const calculatedOrEnteredSpineWidth = this._getSpineWidth(); // Returns pixels or null
			if (calculatedOrEnteredSpineWidth === null) {
				alert("Please fix the errors in the spine width settings.");
				return;
			}
			spineWidthPx = calculatedOrEnteredSpineWidth;
			backWidthPx = frontWidthPx; // Back cover width is same as front
			totalWidthPx = frontWidthPx + spineWidthPx + backWidthPx;
			console.log(`Calculating size: Back(${backWidthPx}px) + Spine(${spineWidthPx}px) + Front(${frontWidthPx}px) = ${totalWidthPx}px x ${finalHeightPx}px`);
		} else {
			console.log(`Calculating size: Front(${frontWidthPx}px) = ${totalWidthPx}px x ${finalHeightPx}px`);
		}
		
		const currentLayers = this.canvasManager.layerManager?.getLayers() || [];
		let proceed = true;
		if (currentLayers.length > 0) {
			proceed = confirm(
				"Changing the canvas size might require rearranging existing layers.\n\n" +
				`The new canvas size will be ${totalWidthPx} x ${finalHeightPx} pixels.\n\n` +
				"Do you want to proceed?"
			);
		}
		
		if (proceed) {
			console.log(`Applying new canvas size: ${totalWidthPx} x ${finalHeightPx}`);
			const sizeConfig = {
				totalWidth: totalWidthPx,
				height: finalHeightPx,
				frontWidth: frontWidthPx,
				spineWidth: spineWidthPx,
				backWidth: backWidthPx
			};
			this.canvasManager.setCanvasSize(sizeConfig);
			this.canvasManager.centerCanvas();
			this.hide();
		}
	}
	
	_updatePreview() {
		const dimensions = this._getCanvasDimensions(); // Gets { frontWidth, height } in pixels
		if (!dimensions) {
			this.$previewArea.hide();
			return;
		}
		this.$previewArea.show();
		
		const { frontWidth: frontWidthPx, height: coverHeightPx } = dimensions;
		const addSpineAndBack = this.$addSpineAndBackCheckbox.is(':checked') && this.$addSpineAndBackContainer.is(':visible');
		let spineWidthPx = 0;
		let spineDisplayError = false;
		
		if (addSpineAndBack) {
			const spineResult = this._getSpineWidth(); // Returns pixels or null
			if (spineResult === null) {
				spineWidthPx = 20; // Default small width for preview on error
				spineDisplayError = true;
			} else {
				spineWidthPx = Math.max(0, spineResult);
			}
		}
		
		const previewContainerWidth = this.$previewContainer.width() * 0.9;
		const previewContainerHeight = this.$previewContainer.height() * 0.9;
		
		if (!previewContainerWidth || !previewContainerHeight || !frontWidthPx || !coverHeightPx) {
			console.warn("Cannot update preview, invalid dimensions for calculation.");
			this.$previewArea.hide();
			return;
		}
		
		let totalLayoutWidthPx = frontWidthPx;
		if (addSpineAndBack) {
			totalLayoutWidthPx += spineWidthPx + frontWidthPx; // Front + Spine + Back
		}
		if (totalLayoutWidthPx <= 0) totalLayoutWidthPx = frontWidthPx; // Fallback
		
		const scaleX = previewContainerWidth / totalLayoutWidthPx;
		const scaleY = previewContainerHeight / coverHeightPx;
		const scale = Math.min(scaleX, scaleY, 1); // Cap scale at 1
		
		const scaledFrontWidth = frontWidthPx * scale;
		const scaledHeight = coverHeightPx * scale;
		const scaledSpineWidth = spineWidthPx * scale;
		
		this.$previewFront.css({ width: scaledFrontWidth + 'px', height: scaledHeight + 'px' });
		this.$previewFront.text(`Front (${frontWidthPx}x${coverHeightPx}px)`);
		
		if (addSpineAndBack) {
			this.$previewSpine.css({ width: scaledSpineWidth + 'px', height: scaledHeight + 'px' }).show();
			const spineText = spineDisplayError ? `Spine (Error)` : `Spine (${spineWidthPx}px)`;
			this.$previewSpine.text(spineText);
			
			this.$previewBack.css({ width: scaledFrontWidth + 'px', height: scaledHeight + 'px' }).show();
			this.$previewBack.text(`Back (${frontWidthPx}x${coverHeightPx}px)`);
		} else {
			this.$previewSpine.hide();
			this.$previewBack.hide();
		}
	}
	
	_resetForm() {
		// Reset unit to inches
		this.$unitRadios.filter('[value="inches"]').prop('checked', true);
		this.currentUnit = 'inches';
		
		// Populate presets for the default unit (inches)
		this._populatePresetRadios(); // This selects the first preset by default and calls _handlePresetChange
		
		// Reset custom inputs
		this.$customWidthInput.val(6); // Default for inches
		this.$customHeightInput.val(9); // Default for inches
		this.$customSizeControls.hide(); // Hide custom controls initially
		this.$customWidthError.hide();
		this.$customHeightError.hide();
		
		// Reset spine and back cover checkbox and controls
		this.$addSpineAndBackCheckbox.prop('checked', false);
		// _handlePresetChange will show/hide $addSpineAndBackContainer based on selected preset
		// and if it's visible and checkbox is unchecked, $spineControls will be hidden.
		
		this.$spineControls.hide(); // Explicitly hide spine controls
		this.$spineInputMethodRadios.filter('[value="calculate"]').prop('checked', true);
		this.$spineWidthInput.val(200); // Default pixel spine width
		this.$pageCountInput.val(200); // Default page count
		this.$paperTypeSelect.val('bw'); // Default paper type
		
		// Clear errors
		this.$presetError.hide();
		this.$spineWidthError.hide();
		this.$pageCountError.hide();
		this.$spineCalculationError.hide();
		this.$calculatedSpineInfo.hide();
		
		this._toggleSpineInputMethod(); // Ensure correct spine input visibility
		this._updatePreview();
	}
	
	show(options = {}) {
		const { defaultPresetValue = null } = options; // e.g., "1600x2560"
		
		if (!this.modalInstance) {
			this.modalInstance = new bootstrap.Modal(this.$modal[0], {
				backdrop: 'static',
				keyboard: false
			});
		}
		this._resetForm(); // Resets to inches, populates presets, selects first
		
		if (defaultPresetValue) {
			// Attempt to find and select the defaultPresetValue
			// It might be in common, inches, or mm list depending on currentUnit (which is 'inches' after reset)
			const $defaultRadio = this.$presetRadioGroupContainer.find(`input[name="canvasSizePreset"][value="${defaultPresetValue}"]`);
			if ($defaultRadio.length) {
				$defaultRadio.prop('checked', true);
				console.log(`Default preset '${defaultPresetValue}' selected.`);
			} else {
				console.warn(`Default preset value '${defaultPresetValue}' not found in the current list (inches).`);
				// The first preset in the list will remain selected from _resetForm -> _populatePresetRadios
			}
		}
		this._handlePresetChange(); // Update UI based on selected preset
		this.modalInstance.show();
		// Delay preview update slightly to ensure modal is fully rendered
		setTimeout(() => this._updatePreview(), 100);
	}
	
	hide() {
		if (this.modalInstance) {
			this.modalInstance.hide();
		}
	}
}
