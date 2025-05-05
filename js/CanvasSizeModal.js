// free-cover-designer/js/CanvasSizeModal.js
class CanvasSizeModal {
	constructor(canvasManager) {
		if (!canvasManager) {
			throw new Error("CanvasSizeModal requires an instance of CanvasManager.");
		}
		this.canvasManager = canvasManager;
		this.$modal = $('#canvasSizeModal');
		this.$presetRadioGroup = $('input[name="canvasSizePreset"]');
		this.$presetError = $('#presetError');
		// --- UPDATED Checkbox Reference ---
		this.$addSpineAndBackCheckbox = $('#addSpineAndBackCheckbox');
		// --- END UPDATED ---
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
		// --- REMOVED Back Cover Checkbox Reference ---
		// this.$addBackCoverCheckbox = $('#addBackCoverCheckbox');
		// --- END REMOVED ---
		this.$applyBtn = $('#setCanvasSizeBtn');
		this.$previewContainer = $('#canvasPreviewContainer');
		this.$previewArea = $('#canvasPreviewArea');
		this.$previewFront = $('#previewFront');
		this.$previewSpine = $('#previewSpine');
		this.$previewBack = $('#previewBack');
		this.modalInstance = null;
		this.pageNumberData = [];
		this._loadPageNumberData();
		this._bindEvents();
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
	
	_bindEvents() {
		this.$presetRadioGroup.on('change', () => {
			this.$presetError.hide();
			this._updatePreview();
		});
		
		// --- UPDATED: Toggle spine controls based on new checkbox ---
		this.$addSpineAndBackCheckbox.on('change', () => {
			const isChecked = this.$addSpineAndBackCheckbox.is(':checked');
			this.$spineControls.toggle(isChecked);
			this._toggleSpineInputMethod(); // Ensure correct input method shows/hides
			this._updatePreview(); // Update preview on toggle
		});
		// --- END UPDATED ---
		
		this.$spineInputMethodRadios.on('change', () => {
			this._toggleSpineInputMethod();
			this._updatePreview();
		});
		
		// --- REMOVED: Back cover change listener ---
		// this.$addBackCoverCheckbox.on('change', () => { ... });
		// --- END REMOVED ---
		
		let pixelDebounceTimer;
		this.$spineWidthInput.on('input', () => {
			this.$spineWidthError.hide();
			clearTimeout(pixelDebounceTimer);
			pixelDebounceTimer = setTimeout(() => {
				this._updatePreview();
			}, 250);
		});
		
		let calcDebounceTimer;
		const calcUpdateHandler = () => {
			this.$pageCountError.hide();
			this.$spineCalculationError.hide();
			clearTimeout(calcDebounceTimer);
			calcDebounceTimer = setTimeout(() => {
				this._updatePreview();
			}, 300);
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
			this._toggleSpineInputMethod();
			setTimeout(() => this._updatePreview(), 200);
		});
	}
	
	_toggleSpineInputMethod() {
		const method = this.$spineInputMethodRadios.filter(':checked').val();
		// --- UPDATED: Check new checkbox ---
		const spineEnabled = this.$addSpineAndBackCheckbox.is(':checked');
		// --- END UPDATED ---
		
		if (spineEnabled) {
			if (method === 'calculate') {
				this.$spinePixelContainer.hide();
				this.$spineCalculateContainer.show();
			} else {
				this.$spinePixelContainer.show();
				this.$spineCalculateContainer.hide();
			}
		} else {
			this.$spinePixelContainer.hide();
			this.$spineCalculateContainer.hide();
		}
		this.$spineWidthError.hide();
		this.$pageCountError.hide();
		this.$spineCalculationError.hide();
		this.$calculatedSpineInfo.hide();
	}
	
	_calculateSpineWidthFromPages() {
		const $selectedPresetRadio = this.$presetRadioGroup.filter(':checked');
		if (!$selectedPresetRadio.length) return { width: null, error: "No preset selected." };
		const presetValue = $selectedPresetRadio.val();
		const baseSize = $selectedPresetRadio.data('base-size');
		const [presetWidthStr, ] = presetValue.split('x');
		const frontCoverWidth = parseInt(presetWidthStr, 10);
		const pageCount = parseInt(this.$pageCountInput.val(), 10);
		const paperType = this.$paperTypeSelect.val();
		
		if (isNaN(pageCount) || pageCount <= 0) {
			return { width: null, error: "Invalid page count." };
		}
		if (!baseSize || !paperType || isNaN(frontCoverWidth)) {
			return { width: null, error: "Invalid preset or paper type." };
		}
		if (!this.pageNumberData || this.pageNumberData.length === 0) {
			return { width: null, error: "Page number data not available." };
		}
		
		// console.log("Calculating spine width with data:", { baseSize, paperType, pageCount, frontCoverWidth });
		
		const sortedMatches = this.pageNumberData
			.filter(entry => entry.size === baseSize && entry.paper_type === paperType && entry.pages >= pageCount)
			.sort((a, b) => a.pages - b.pages);
		const match = sortedMatches.length > 0 ? sortedMatches[0] : null;
		
		if (match) {
			const totalWidth = match.width;
			const calculatedSpineWidth = totalWidth - (2 * frontCoverWidth);
			if (calculatedSpineWidth > 0) {
				this.$calculatedSpineInfo
					.text(`Using data for ${match.pages} pages. Spine: ${calculatedSpineWidth}px`)
					.show();
				return { width: calculatedSpineWidth, error: null };
			} else {
				console.warn("Calculation resulted in non-positive spine width:", { match, frontCoverWidth, calculatedSpineWidth });
				return { width: null, error: `Calculation error (Result: ${calculatedSpineWidth}px). Check preset/page count.` };
			}
		} else {
			return { width: null, error: "No data found for this size, paper type, and page count." };
		}
	}
	
	_getSpineWidth() {
		// --- UPDATED: Check new checkbox ---
		if (!this.$addSpineAndBackCheckbox.is(':checked')) {
			return 0; // No spine if checkbox is off
		}
		// --- END UPDATED ---
		
		const method = this.$spineInputMethodRadios.filter(':checked').val();
		if (method === 'calculate') {
			const result = this._calculateSpineWidthFromPages();
			if (result.error) {
				this.$spineCalculationError.text(result.error).show();
				this.$calculatedSpineInfo.hide();
				return null; // Indicate error
			} else {
				this.$spineCalculationError.hide();
				// Info is shown in _calculateSpineWidthFromPages
				return result.width;
			}
		} else { // 'pixels' method
			const spineWidth = parseInt(this.$spineWidthInput.val(), 10);
			if (isNaN(spineWidth) || spineWidth <= 0) {
				this.$spineWidthError.show();
				return null; // Indicate error
			} else {
				this.$spineWidthError.hide();
				return spineWidth;
			}
		}
	}
	
	_validateInputs() {
		let isValid = true;
		const $selectedPreset = this.$presetRadioGroup.filter(':checked');
		// --- UPDATED: Check new checkbox ---
		const isSpineAndBackChecked = this.$addSpineAndBackCheckbox.is(':checked');
		// --- END UPDATED ---
		const spineMethod = this.$spineInputMethodRadios.filter(':checked').val();
		
		if (!$selectedPreset.length) {
			this.$presetError.show();
			isValid = false;
		} else {
			this.$presetError.hide();
		}
		
		// --- UPDATED: Validate spine inputs ONLY if new checkbox is enabled ---
		if (isSpineAndBackChecked) {
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
					const calcResult = this._calculateSpineWidthFromPages();
					if(calcResult.error) {
						this.$spineCalculationError.text(calcResult.error).show();
						isValid = false;
					} else {
						this.$spineCalculationError.hide();
					}
				}
			}
		} else { // Clear spine errors if spine is disabled
			this.$spineWidthError.hide();
			this.$pageCountError.hide();
			this.$spineCalculationError.hide();
		}
		// --- END UPDATED ---
		
		return isValid;
	}
	
	_handleSetSize() {
		if (!this._validateInputs()) {
			return;
		}
		
		const presetValue = this.$presetRadioGroup.filter(':checked').val();
		const [presetWidthStr, presetHeightStr] = presetValue.split('x');
		const presetWidth = parseInt(presetWidthStr, 10);
		const presetHeight = parseInt(presetHeightStr, 10);
		
		if (isNaN(presetWidth) || isNaN(presetHeight)) {
			console.error("Invalid preset dimensions parsed:", presetValue);
			alert("An error occurred parsing the selected size.");
			return;
		}
		
		let finalWidth = presetWidth;
		const finalHeight = presetHeight;
		// --- UPDATED: Use new checkbox state ---
		const addSpineAndBack = this.$addSpineAndBackCheckbox.is(':checked');
		// --- END UPDATED ---
		// --- REMOVED: Old back cover variable ---
		// const addBackCover = this.$addBackCoverCheckbox.is(':checked');
		// --- END REMOVED ---
		let spineWidth = 0;
		
		// --- UPDATED: Calculate final width based on new checkbox ---
		if (addSpineAndBack) {
			const calculatedOrEnteredWidth = this._getSpineWidth();
			if (calculatedOrEnteredWidth === null) {
				console.error("Could not determine spine width before applying.");
				alert("Please fix the errors in the spine width settings.");
				return;
			}
			spineWidth = calculatedOrEnteredWidth;
			// Add spine AND back cover width (back cover = front cover)
			finalWidth = presetWidth + spineWidth + presetWidth;
			console.log(`Calculating size: Front(${presetWidth}) + Spine(${spineWidth}) + Back(${presetWidth}) = ${finalWidth} x ${finalHeight}`);
		} else {
			// Only front cover
			finalWidth = presetWidth;
			console.log(`Calculating size: Front(${presetWidth}) = ${finalWidth} x ${finalHeight}`);
		}
		// --- END UPDATED ---
		
		const currentLayers = this.canvasManager.layerManager?.getLayers() || [];
		let proceed = true;
		if (currentLayers.length > 0) {
			proceed = confirm(
				"Changing the canvas size might require rearranging existing layers.\n\n" +
				`The new canvas size will be ${finalWidth} x ${finalHeight} pixels.\n\n` +
				"Do you want to proceed?"
			);
		}
		
		if (proceed) {
			console.log(`Applying new canvas size: ${finalWidth} x ${finalHeight}`);
			this.canvasManager.setCanvasSize(finalWidth, finalHeight);
			// this.canvasManager.setZoom(1.0);
			this.canvasManager.centerCanvas();
			this.hide();
		}
	}
	
	_updatePreview() {
		const $selectedPresetRadio = this.$presetRadioGroup.filter(':checked');
		if (!$selectedPresetRadio.length) {
			this.$previewArea.hide();
			return;
		}
		this.$previewArea.show();
		
		const presetValue = $selectedPresetRadio.val();
		const [presetWidthStr, presetHeightStr] = presetValue.split('x');
		const frontWidth = parseInt(presetWidthStr, 10);
		const coverHeight = parseInt(presetHeightStr, 10);
		// --- UPDATED: Use new checkbox state ---
		const addSpineAndBack = this.$addSpineAndBackCheckbox.is(':checked');
		// --- END UPDATED ---
		// --- REMOVED: Old back cover variable ---
		// const addBackCover = this.$addBackCoverCheckbox.is(':checked');
		// --- END REMOVED ---
		
		let spineWidth = 0;
		let spineDisplayError = false;
		
		// --- UPDATED: Get spine width only if new checkbox is checked ---
		if (addSpineAndBack) {
			const spineResult = this._getSpineWidth();
			if (spineResult === null) {
				spineWidth = 0;
				spineDisplayError = true;
			} else {
				spineWidth = Math.max(0, spineResult);
			}
		}
		// --- END UPDATED ---
		
		const previewContainerWidth = this.$previewContainer.width() * 0.9;
		const previewContainerHeight = this.$previewContainer.height() * 0.9;
		
		if (!previewContainerWidth || !previewContainerHeight || !frontWidth || !coverHeight) {
			console.warn("Cannot update preview, invalid dimensions for calculation.");
			return;
		}
		
		// --- UPDATED: Calculate total layout width based on new checkbox ---
		let totalLayoutWidth = frontWidth;
		if (addSpineAndBack) {
			totalLayoutWidth += spineWidth + frontWidth; // Front + Spine + Back
		}
		// --- END UPDATED ---
		
		if (totalLayoutWidth <= 0) totalLayoutWidth = frontWidth;
		
		const scaleX = previewContainerWidth / totalLayoutWidth;
		const scaleY = previewContainerHeight / coverHeight;
		const scale = Math.min(scaleX, scaleY, 1);
		
		const scaledFrontWidth = frontWidth * scale;
		const scaledHeight = coverHeight * scale;
		const scaledSpineWidth = spineWidth * scale;
		
		this.$previewFront.css({ width: scaledFrontWidth + 'px', height: scaledHeight + 'px' });
		this.$previewFront.text(`Front (${frontWidth}x${coverHeight})`);
		
		// --- UPDATED: Show/hide spine and back based on new checkbox ---
		if (addSpineAndBack) {
			// Show Spine
			this.$previewSpine.css({ width: scaledSpineWidth + 'px', height: scaledHeight + 'px' }).show();
			const spineText = spineDisplayError ? `Spine (Error)` : `Spine (${spineWidth}px)`;
			this.$previewSpine.text(spineText);
			
			// Show Back
			this.$previewBack.css({ width: scaledFrontWidth + 'px', height: scaledHeight + 'px' }).show();
			this.$previewBack.text(`Back (${frontWidth}x${coverHeight})`);
		} else {
			// Hide Spine and Back
			this.$previewSpine.hide();
			this.$previewBack.hide();
		}
		// --- END UPDATED ---
	}
	
	_resetForm() {
		this.$presetRadioGroup.prop('checked', false);
		this.$presetError.hide();
		
		// --- UPDATED: Reset new checkbox ---
		this.$addSpineAndBackCheckbox.prop('checked', false);
		// --- END UPDATED ---
		this.$spineControls.hide();
		// --- REMOVED: Reset old back cover checkbox ---
		// this.$addBackCoverCheckbox.prop('checked', false);
		// --- END REMOVED ---
		
		this.$spineInputMethodRadios.filter('[value="pixels"]').prop('checked', true);
		this.$spineWidthInput.val(100);
		this.$pageCountInput.val(100);
		this.$paperTypeSelect.val('bw');
		this._toggleSpineInputMethod();
		
		this.$spineWidthError.hide();
		this.$pageCountError.hide();
		this.$spineCalculationError.hide();
		this.$calculatedSpineInfo.hide();
		
		this._updatePreview();
	}
	
	show(options = {}) {
		const { defaultPresetValue = null } = options;
		if (!this.modalInstance) {
			this.modalInstance = new bootstrap.Modal(this.$modal[0], {
				backdrop: 'static',
				keyboard: false
			});
		}
		this._resetForm();
		
		if (defaultPresetValue) {
			const $defaultRadio = this.$presetRadioGroup.filter(`[value="${defaultPresetValue}"]`);
			if ($defaultRadio.length) {
				$defaultRadio.prop('checked', true);
				console.log(`Default preset '${defaultPresetValue}' selected.`);
			} else {
				console.warn(`Default preset value '${defaultPresetValue}' not found.`);
			}
		}
		this.modalInstance.show();
		setTimeout(() => this._updatePreview(), 200);
	}
	
	hide() {
		if (this.modalInstance) {
			this.modalInstance.hide();
		}
	}
}
